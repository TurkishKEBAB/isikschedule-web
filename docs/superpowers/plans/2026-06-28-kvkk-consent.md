# KVKK Consent + Privacy/Terms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Turkish (TR + EN) KVKK/privacy and terms pages, visible links on register/login/landing, and a required registration consent that is recorded server-side.

**Architecture:** Long legal text lives in a dedicated frontend content module rendered by a shared `LegalPage` component at `/privacy` and `/terms`; only short UI labels go into the central i18n context. Registration requires a consent checkbox (client) and the backend stores `kvkk_consent_at` + `consent_version` on the user; register/login responses keep their existing shape (K6).

**Tech Stack:** FastAPI + SQLAlchemy + SQLite (Python 3.12), Next.js 14 App Router + React 18 + TypeScript + Tailwind.

## Global Constraints

- Data controller (verbatim in legal text): `Yiğit Okur` (bağımsız öğrenci projesi; not an official İşık University product).
- Contact (verbatim, side by side): `23SOFT1040@isik.edu.tr | yigitokur29@gmail.com`
- Retention: account active süresince; on deletion request destroyed within **30 gün**.
- Third parties: none for marketing/analytics; processed only on hosting infrastructure (no provider name). No analytics.
- Consent version constant (verbatim): `2026-06-28`.
- Backend response shapes for `/api/auth/register`, `/api/auth/login`, `/api/auth/me` MUST NOT change (K6).
- Course field naming (`main_code`, `type`, `schedule`, `ects`) must not change.
- i18n: every key added to the `tr` object MUST also be added to the `en` object (the context types `t` as `translations[lang]`).
- `useLanguage()` returns `{ lang, setLang, t }` — the language field is `lang` (`'tr' | 'en'`), not `language`.
- Backend tests run from `backend/` with `..\.venv\Scripts\python.exe -m pytest`; lint with `..\.venv\Scripts\python.exe -m ruff check .`.
- Frontend has no unit-test harness (Vitest deferred); frontend tasks are verified with `npm run lint` and `npm run build`.

---

### Task 1: Backend — record registration consent

**Files:**
- Modify: `backend/app/config.py` (add `CONSENT_VERSION` constant)
- Modify: `backend/app/models/database.py` (User columns + idempotent migration)
- Modify: `backend/app/api/routes/auth.py` (require + record consent)
- Modify: `backend/tests/conftest.py:149-152` (auth_headers payload)
- Modify: `backend/tests/test_auth_smoke.py` (existing register calls)
- Modify: `backend/tests/test_shared_smoke.py:13-15` (register call)
- Create: `backend/tests/test_consent.py`

**Interfaces:**
- Consumes: existing `register()` route, `User` model, `get_db`, `client` + `db_session` fixtures.
- Produces:
  - `app.config.CONSENT_VERSION: str = "2026-06-28"`
  - `User.kvkk_consent_at: datetime | None`, `User.consent_version: str | None`
  - `RegisterRequest.accepted_terms: bool` (default `False`); register returns **400** when false.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_consent.py`:

```python
"""Consent capture tests for /api/auth/register (issue #73)."""

from app.config import CONSENT_VERSION
from app.models.database import User


def test_register_without_consent_is_rejected(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "no-consent@isik.edu.tr", "password": "pw-123456"},
    )
    assert response.status_code == 400, response.text


def test_register_with_consent_false_is_rejected(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "false-consent@isik.edu.tr",
            "password": "pw-123456",
            "accepted_terms": False,
        },
    )
    assert response.status_code == 400, response.text


def test_register_with_consent_records_timestamp_and_version(client, db_session):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "ok-consent@isik.edu.tr",
            "password": "pw-123456",
            "accepted_terms": True,
        },
    )
    assert response.status_code == 200, response.text

    user = db_session.query(User).filter(User.email == "ok-consent@isik.edu.tr").first()
    assert user is not None
    assert user.kvkk_consent_at is not None
    assert user.consent_version == CONSENT_VERSION


def test_register_response_shape_unchanged(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "shape@isik.edu.tr",
            "password": "pw-123456",
            "accepted_terms": True,
        },
    )
    body = response.json()
    assert set(body.keys()) == {"access_token", "token_type", "user"}
    assert set(body["user"].keys()) == {"id", "email", "role"}
```

- [ ] **Step 2: Run the tests to verify they fail**

```
cd backend
..\.venv\Scripts\python.exe -m pytest tests/test_consent.py -v
```
Expected: import error / failures — `CONSENT_VERSION` not defined and consent not enforced.

- [ ] **Step 3: Add the version constant**

In `backend/app/config.py`, after the `DEFAULT_ADMIN_PASSWORD` line (line 16), add:

```python
# KVKK/consent (issue #73). Server-authoritative consent text version recorded
# on each user at registration. Bump when the privacy/terms text materially changes.
CONSENT_VERSION = "2026-06-28"
```

- [ ] **Step 4: Add the User columns and idempotent migration**

In `backend/app/models/database.py`, add two columns to `User` after `is_active` (line 40):

```python
    # KVKK consent (issue #73): when the user accepted, and which text version.
    kvkk_consent_at = Column(DateTime, nullable=True)
    consent_version = Column(String(32), nullable=True)
```

Add this helper at module scope (e.g. before `init_db`) and call it from `init_db`:

```python
def _ensure_consent_columns() -> None:
    """Idempotently add the KVKK consent columns to an existing SQLite users table.

    This project has no migration tool (create_all only); ALTER TABLE ADD COLUMN
    is safe and idempotent here. No-op for non-SQLite engines (aspirational).
    """
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.connect() as conn:
        existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(users)")}
        if "kvkk_consent_at" not in existing:
            conn.exec_driver_sql("ALTER TABLE users ADD COLUMN kvkk_consent_at DATETIME")
        if "consent_version" not in existing:
            conn.exec_driver_sql("ALTER TABLE users ADD COLUMN consent_version VARCHAR(32)")
        conn.commit()
```

Update `init_db`:

```python
def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
    _ensure_consent_columns()
    print("Database tables created.")
```

- [ ] **Step 5: Require and record consent in register**

In `backend/app/api/routes/auth.py`:

Extend the config import (line 11):

```python
from ...config import settings, CONSENT_VERSION
```

Extend the database import (line 12) to also bring in `_utcnow`:

```python
from ...models.database import get_db, User, _utcnow
```

Extend `RegisterRequest` (lines 25-27):

```python
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    accepted_terms: bool = False
```

In `register()`, after the password-length check (after line 63), add:

```python
    # KVKK consent is mandatory (issue #73).
    if not request.accepted_terms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="KVKK aydınlatma metni ve kullanım şartları kabul edilmeden kayıt yapılamaz."
        )
```

Update the `User(...)` construction (lines 74-78) to record consent:

```python
    user = User(
        email=request.email,
        password_hash=get_password_hash(request.password),
        role="user",
        kvkk_consent_at=_utcnow(),
        consent_version=CONSENT_VERSION,
    )
```

- [ ] **Step 6: Update existing register calls in fixtures/tests**

`backend/tests/conftest.py` — `auth_headers` payload (lines 149-152):

```python
    register_payload = {
        "email": "smoke-user@isik.edu.tr",
        "password": "smoke-pass-123",
        "accepted_terms": True,
    }
```

`backend/tests/test_auth_smoke.py` — add `"accepted_terms": True` to all three register `json=` bodies (alice line 12, bob line 26, carol line 40). Example for alice:

```python
        json={"email": "alice@isik.edu.tr", "password": "alice-pw-1", "accepted_terms": True},
```

`backend/tests/test_shared_smoke.py` — register body (line 14):

```python
        json={"email": "owner@isik.edu.tr", "password": "owner-pw-1", "accepted_terms": True},
```

- [ ] **Step 7: Run the full backend suite to verify green**

```
cd backend
..\.venv\Scripts\python.exe -m pytest -v
```
Expected: all tests pass, including the four new `test_consent.py` tests.

- [ ] **Step 8: Lint**

```
cd backend
..\.venv\Scripts\python.exe -m ruff check .
```
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add backend/app/config.py backend/app/models/database.py backend/app/api/routes/auth.py backend/tests/
git commit -m "feat(auth): require and record KVKK consent at registration (#73)"
```

---

### Task 2: Frontend — legal content module + privacy & terms pages

**Files:**
- Create: `frontend/app/legal/content.ts`
- Create: `frontend/app/legal/LegalPage.tsx`
- Create: `frontend/app/privacy/page.tsx`
- Create: `frontend/app/terms/page.tsx`
- Modify: `frontend/app/context/LanguageContext.tsx` (add legal UI labels to `tr` and `en`)

**Interfaces:**
- Produces:
  - `LegalDoc` type, `privacyContent`, `termsContent` (`{ tr: LegalDoc; en: LegalDoc }`), `LEGAL_VERSION`, `CONTACT_LINE`, `DATA_CONTROLLER` from `content.ts`.
  - `LegalPage` component consuming `{ content: { tr: LegalDoc; en: LegalDoc } }`.
  - i18n keys (both `tr` and `en`): `legalPrivacyLink`, `legalTermsLink`, `legalLastUpdated`, `legalBack`, `legalTrGoverns`.

- [ ] **Step 1: Create the content module with the full legal text**

Create `frontend/app/legal/content.ts`:

```typescript
export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; sections: LegalSection[] };

export const DATA_CONTROLLER = 'Yiğit Okur';
export const CONTACT_LINE = '23SOFT1040@isik.edu.tr | yigitokur29@gmail.com';
export const LEGAL_VERSION = '2026-06-28';

export const privacyContent: { tr: LegalDoc; en: LegalDoc } = {
  tr: {
    title: 'KVKK Aydınlatma Metni ve Gizlilik Politikası',
    sections: [
      {
        heading: '1. Veri Sorumlusu',
        body: [
          `Bu uygulama, Işık Üniversitesi öğrencileri için geliştirilmiş bağımsız bir öğrenci projesidir ve üniversitenin resmî bir ürünü değildir. Veri sorumlusu: ${DATA_CONTROLLER}.`,
          `İletişim: ${CONTACT_LINE}`,
        ],
      },
      {
        heading: '2. İşlenen Kişisel Veriler',
        body: [
          'E-posta adresiniz, şifreniz (yalnızca geri döndürülemez biçimde hash’lenerek), oluşturduğunuz ve kaydettiğiniz ders programları, oluşturduğunuz paylaşım linkleri ve arkadaşlık ilişkileriniz işlenir.',
        ],
      },
      {
        heading: '3. İşleme Amaçları',
        body: [
          'Kişisel verileriniz; hesabınızın oluşturulması ve kimlik doğrulaması, ders programı oluşturma/saklama/paylaşma hizmetinin sunulması ve hizmetin güvenliğinin sağlanması amaçlarıyla işlenir.',
        ],
      },
      {
        heading: '4. Hukuki Sebep',
        body: [
          'Verileriniz KVKK madde 5 uyarınca, hizmetin sunulabilmesi için sözleşmenin ifası ve kayıt sırasında verdiğiniz açık rıza kapsamında işlenir.',
        ],
      },
      {
        heading: '5. Saklama Süresi',
        body: [
          'Verileriniz hesabınız aktif olduğu sürece saklanır. Hesabınızı sildiğinizde veya silme talebinde bulunduğunuzda, ilgili verileriniz makul bir süre içinde (en geç 30 gün) imha edilir.',
        ],
      },
      {
        heading: '6. Üçüncü Taraflara Aktarım',
        body: [
          'Kişisel verileriniz pazarlama veya analitik amacıyla üçüncü taraflarla paylaşılmaz. Veriler yalnızca uygulamanın çalıştığı barındırma altyapısında işlenir. Uygulamada üçüncü taraf analitik/izleme aracı kullanılmaz.',
        ],
      },
      {
        heading: '7. Haklarınız (KVKK madde 11)',
        body: [
          'Kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme veya yok edilmesini isteme, işlemeye itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz.',
          `Bu haklarınızı kullanmak için ${CONTACT_LINE} adresleri üzerinden başvurabilirsiniz.`,
        ],
      },
      {
        heading: '8. Veri Güvenliği',
        body: [
          'Şifreler geri döndürülemez biçimde hash’lenerek saklanır. Verilerinize yetkisiz erişimi önlemek için makul teknik ve idari tedbirler alınır.',
        ],
      },
      {
        heading: '9. Değişiklikler',
        body: [
          'Bu metin zaman zaman güncellenebilir. Güncel sürüm her zaman bu sayfada yayımlanır; yürürlükteki sürüm aşağıda belirtilen tarihtir.',
        ],
      },
    ],
  },
  en: {
    title: 'KVKK Privacy Notice & Privacy Policy',
    sections: [
      {
        heading: '1. Data Controller',
        body: [
          `This application is an independent student project built for Işık University students and is not an official university product. Data controller: ${DATA_CONTROLLER}.`,
          `Contact: ${CONTACT_LINE}`,
        ],
      },
      {
        heading: '2. Personal Data Processed',
        body: [
          'Your email address, your password (stored only as an irreversible hash), the course schedules you create and save, the share links you generate, and your friendship relationships are processed.',
        ],
      },
      {
        heading: '3. Purposes of Processing',
        body: [
          'Your data is processed to create your account and authenticate you, to provide the schedule creation/storage/sharing service, and to keep the service secure.',
        ],
      },
      {
        heading: '4. Legal Basis',
        body: [
          'Under Article 5 of the Turkish Data Protection Law (KVKK), your data is processed for the performance of the service contract and based on the explicit consent you give at registration.',
        ],
      },
      {
        heading: '5. Retention Period',
        body: [
          'Your data is retained while your account is active. When you delete your account or request deletion, your data is destroyed within a reasonable period (at most 30 days).',
        ],
      },
      {
        heading: '6. Transfers to Third Parties',
        body: [
          'Your data is not shared with third parties for marketing or analytics. Data is processed only on the hosting infrastructure that runs the application. No third-party analytics/tracking tools are used.',
        ],
      },
      {
        heading: '7. Your Rights (KVKK Article 11)',
        body: [
          'You have the right to learn whether your data is processed, to request information, correction, deletion or destruction, to object to processing, and to request remedy of damages.',
          `To exercise these rights, contact ${CONTACT_LINE}.`,
        ],
      },
      {
        heading: '8. Data Security',
        body: [
          'Passwords are stored as irreversible hashes. Reasonable technical and administrative measures are taken to prevent unauthorized access to your data.',
        ],
      },
      {
        heading: '9. Changes',
        body: [
          'This notice may be updated from time to time. The current version is always published on this page; the version in effect is the date shown below.',
        ],
      },
    ],
  },
};

export const termsContent: { tr: LegalDoc; en: LegalDoc } = {
  tr: {
    title: 'Kullanım Şartları',
    sections: [
      {
        heading: '1. Hizmetin Tanımı',
        body: [
          'IşıkSchedule, ders programı oluşturmaya yardımcı olan bağımsız bir öğrenci projesidir. Işık Üniversitesi’nin resmî bir ürünü değildir.',
        ],
      },
      {
        heading: '2. Uygunluk',
        body: [
          'Hizmet yalnızca @isik.edu.tr veya @isikun.edu.tr uzantılı e-posta adresine sahip kullanıcılar tarafından kullanılabilir.',
        ],
      },
      {
        heading: '3. Kullanıcı Yükümlülükleri',
        body: [
          'Doğru bilgi vermeyi, hesap güvenliğinizi korumayı ve hizmeti kötüye kullanmamayı kabul edersiniz. Hesabınızla yapılan işlemlerden siz sorumlusunuz.',
        ],
      },
      {
        heading: '4. Garanti Reddi',
        body: [
          'Hizmet “olduğu gibi” sunulur. Oluşturulan ders programlarının doğruluğu veya kesintisizliği garanti edilmez; resmî ders kaydı için üniversitenin kendi sistemleri esastır.',
        ],
      },
      {
        heading: '5. Sorumluluğun Sınırlandırılması',
        body: [
          'Yürürlükteki hukukun izin verdiği ölçüde, hizmetin kullanımından doğan dolaylı veya sonuç niteliğindeki zararlardan veri sorumlusu sorumlu tutulamaz.',
        ],
      },
      {
        heading: '6. Hesap Sonlandırma',
        body: [
          'Hesabınızı dilediğiniz zaman silebilirsiniz. Bu şartların ihlali hâlinde hizmete erişiminiz kısıtlanabilir.',
        ],
      },
      {
        heading: '7. Değişiklikler ve İletişim',
        body: [
          `Bu şartlar güncellenebilir; güncel sürüm bu sayfada yayımlanır. Sorularınız için: ${CONTACT_LINE}`,
        ],
      },
    ],
  },
  en: {
    title: 'Terms of Use',
    sections: [
      {
        heading: '1. Description of the Service',
        body: [
          'IşıkSchedule is an independent student project that helps you build course schedules. It is not an official product of Işık University.',
        ],
      },
      {
        heading: '2. Eligibility',
        body: [
          'The service may be used only by users with an @isik.edu.tr or @isikun.edu.tr email address.',
        ],
      },
      {
        heading: '3. User Responsibilities',
        body: [
          'You agree to provide accurate information, keep your account secure, and not misuse the service. You are responsible for activity carried out with your account.',
        ],
      },
      {
        heading: '4. Disclaimer of Warranty',
        body: [
          'The service is provided “as is”. The accuracy or availability of generated schedules is not guaranteed; the university’s own systems are authoritative for official course registration.',
        ],
      },
      {
        heading: '5. Limitation of Liability',
        body: [
          'To the extent permitted by applicable law, the data controller is not liable for indirect or consequential damages arising from use of the service.',
        ],
      },
      {
        heading: '6. Account Termination',
        body: [
          'You may delete your account at any time. Access to the service may be restricted in case of a breach of these terms.',
        ],
      },
      {
        heading: '7. Changes and Contact',
        body: [
          `These terms may be updated; the current version is published on this page. Questions: ${CONTACT_LINE}`,
        ],
      },
    ],
  },
};
```

- [ ] **Step 2: Add i18n labels to LanguageContext**

In `frontend/app/context/LanguageContext.tsx`, add these keys to BOTH the `tr` object and the `en` object (place near other shared keys, e.g. after `homeFooterText`). TR values:

```typescript
    legalPrivacyLink: 'Gizlilik & KVKK',
    legalTermsLink: 'Kullanım Şartları',
    legalLastUpdated: 'Son güncelleme',
    legalBack: 'Geri',
    legalTrGoverns: 'İngilizce metin nezaket çevirisidir; uyuşmazlık hâlinde Türkçe metin esas alınır.',
```

EN values (add to the `en` object at the matching place):

```typescript
    legalPrivacyLink: 'Privacy & KVKK',
    legalTermsLink: 'Terms of Use',
    legalLastUpdated: 'Last updated',
    legalBack: 'Back',
    legalTrGoverns: 'The English text is a courtesy translation; in case of conflict the Turkish text governs.',
```

- [ ] **Step 3: Create the shared LegalPage component**

Create `frontend/app/legal/LegalPage.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LanguageSwitcher, useLanguage } from '../context/LanguageContext';
import { AuroraBackground } from '../components/AuroraBackground';
import { BrandLogo } from '../components/BrandLogo';
import { LEGAL_VERSION, type LegalDoc } from './content';

export function LegalPage({ content }: { content: { tr: LegalDoc; en: LegalDoc } }) {
    const { t, lang } = useLanguage();
    const doc = content[lang];

    return (
        <div className="relative min-h-screen overflow-hidden bg-surface-900 text-slate-100">
            <AuroraBackground variant="absolute" vignette={false} className="opacity-60" />
            <div className="absolute right-4 top-4 z-10">
                <LanguageSwitcher />
            </div>

            <div className="relative z-[1] mx-auto max-w-3xl px-4 py-12 sm:px-6">
                <div className="mb-8 flex items-center justify-between">
                    <Link href="/" aria-label="IşıkSchedule">
                        <BrandLogo size="md" priority />
                    </Link>
                    <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        {t.legalBack}
                    </Link>
                </div>

                <article className="glass-panel border-white/10 bg-surface-800/70 p-6 sm:p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
                    <h1 className="mb-6 text-2xl font-bold text-white">{doc.title}</h1>

                    <div className="space-y-6">
                        {doc.sections.map((section) => (
                            <section key={section.heading}>
                                <h2 className="mb-2 text-base font-semibold text-isik-blue-lighter">{section.heading}</h2>
                                {section.body.map((paragraph, index) => (
                                    <p key={index} className="mb-2 text-sm leading-relaxed text-slate-300">{paragraph}</p>
                                ))}
                            </section>
                        ))}
                    </div>

                    <p className="mt-8 border-t border-white/10 pt-4 text-xs text-slate-500">
                        {t.legalLastUpdated}: {LEGAL_VERSION}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{t.legalTrGoverns}</p>
                </article>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Create the two route pages**

Create `frontend/app/privacy/page.tsx`:

```tsx
'use client';

import { LegalPage } from '../legal/LegalPage';
import { privacyContent } from '../legal/content';

export default function PrivacyPage() {
    return <LegalPage content={privacyContent} />;
}
```

Create `frontend/app/terms/page.tsx`:

```tsx
'use client';

import { LegalPage } from '../legal/LegalPage';
import { termsContent } from '../legal/content';

export default function TermsPage() {
    return <LegalPage content={termsContent} />;
}
```

- [ ] **Step 5: Lint and build**

```
cd frontend
npm run lint
npm run build
```
Expected: lint clean; build succeeds and lists `/privacy` and `/terms` as routes. (Ensure no `next dev` is running concurrently — see memory note about the .next build/dev race.)

- [ ] **Step 6: Manual smoke**

Start the app and visit `/privacy` and `/terms`; toggle the language switcher and confirm TR/EN content swaps and "Geri/Back" returns to `/`.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/legal frontend/app/privacy frontend/app/terms frontend/app/context/LanguageContext.tsx
git commit -m "feat(frontend): add KVKK privacy and terms pages (TR/EN) (#73)"
```

---

### Task 3: Frontend — required consent checkbox on register

**Files:**
- Modify: `frontend/app/context/AuthContext.tsx` (register signature + body)
- Modify: `frontend/app/register/page.tsx` (checkbox + validation + links)
- Modify: `frontend/app/context/LanguageContext.tsx` (consent labels in `tr` and `en`)

**Interfaces:**
- Consumes: i18n link labels from Task 2; `/privacy`, `/terms` routes from Task 2.
- Produces: `register(email, password, acceptedTerms: boolean)` on the auth context; POST body now includes `accepted_terms`.

- [ ] **Step 1: Add consent i18n labels**

In `frontend/app/context/LanguageContext.tsx`, add to BOTH `tr` and `en` (near the other `register*` keys). TR:

```typescript
    registerConsentPrefix: 'Devam ederek',
    registerConsentAnd: 've',
    registerConsentSuffix: 'belgelerini okuduğumu ve kabul ettiğimi onaylıyorum.',
    registerConsentRequired: 'Devam etmek için aydınlatma metni ve kullanım şartlarını kabul etmelisiniz.',
```

EN:

```typescript
    registerConsentPrefix: 'By continuing, I confirm that I have read and accept the',
    registerConsentAnd: 'and',
    registerConsentSuffix: 'documents.',
    registerConsentRequired: 'You must accept the privacy notice and terms of use to continue.',
```

- [ ] **Step 2: Update AuthContext.register**

In `frontend/app/context/AuthContext.tsx`:

Change the interface (line 19):

```typescript
    register: (email: string, password: string, acceptedTerms: boolean) => Promise<void>;
```

Change the implementation (lines 71-92) signature and body:

```typescript
    const register = async (email: string, password: string, acceptedTerms: boolean) => {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, accepted_terms: acceptedTerms }),
        });
```
(Leave the rest of the function unchanged.)

- [ ] **Step 3: Add the checkbox and validation to the register page**

In `frontend/app/register/page.tsx`:

Add a state hook after `confirmPassword` (line 16):

```typescript
    const [acceptedTerms, setAcceptedTerms] = useState(false);
```

In `handleSubmit`, after the password-length check (after line 27), add:

```typescript
        if (!acceptedTerms) { setError(t.registerConsentRequired); return; }
```

Change the `register` call (line 37):

```typescript
            await register(email, password, acceptedTerms);
```

Add the checkbox block inside the `<form>`, immediately before the submit `<button>` (before line 123):

```tsx
                        <label htmlFor="register-consent" className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer">
                            <input
                                id="register-consent"
                                type="checkbox"
                                checked={acceptedTerms}
                                onChange={(event) => setAcceptedTerms(event.target.checked)}
                                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-white/20 bg-surface-800 accent-isik-blue-lighter"
                            />
                            <span>
                                {t.registerConsentPrefix}{' '}
                                <Link href="/privacy" target="_blank" className="text-isik-blue-lighter hover:text-blue-300 underline">{t.legalPrivacyLink}</Link>
                                {' '}{t.registerConsentAnd}{' '}
                                <Link href="/terms" target="_blank" className="text-isik-blue-lighter hover:text-blue-300 underline">{t.legalTermsLink}</Link>
                                {' '}{t.registerConsentSuffix}
                            </span>
                        </label>
```

- [ ] **Step 4: Lint and build**

```
cd frontend
npm run lint
npm run build
```
Expected: clean lint, successful build, no TypeScript errors (the `register` call now passes three args at its only call site).

- [ ] **Step 5: Manual smoke**

On `/register`: submitting with the box unchecked shows the consent error; checking it and submitting valid credentials registers and redirects to `/scheduler`. The two links open `/privacy` and `/terms` in a new tab.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/context/AuthContext.tsx frontend/app/register/page.tsx frontend/app/context/LanguageContext.tsx
git commit -m "feat(frontend): require KVKK/terms consent on register (#73)"
```

---

### Task 4: Frontend — visible legal links on login and landing

**Files:**
- Modify: `frontend/app/login/page.tsx` (links under the domain note)
- Modify: `frontend/app/page.tsx` (footer links)

**Interfaces:**
- Consumes: i18n labels `legalPrivacyLink`, `legalTermsLink` (Task 2); `/privacy`, `/terms` routes (Task 2).

- [ ] **Step 1: Add links to the login page**

In `frontend/app/login/page.tsx`, replace the closing domain-note paragraph (lines 158-160) with the note plus links:

```tsx
                <p className="text-center text-xs text-slate-400 mt-6">
                    {t.loginDomainNote}
                </p>
                <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-500">
                    <Link href="/privacy" className="hover:text-slate-300 transition-colors">{t.legalPrivacyLink}</Link>
                    <span aria-hidden="true">·</span>
                    <Link href="/terms" className="hover:text-slate-300 transition-colors">{t.legalTermsLink}</Link>
                </div>
```
(`Link` is already imported in this file.)

- [ ] **Step 2: Add links to the landing footer**

In `frontend/app/page.tsx`, replace the footer inner container (lines 168-174) so the legal links appear alongside the existing copy:

```tsx
                <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <BrandLogo size="sm" showWordmark={false} />
                        <span>© 2026 IşıkSchedule</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 sm:items-end">
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                            <Link href="/privacy" className="hover:text-slate-200 transition-colors">{t.legalPrivacyLink}</Link>
                            <span aria-hidden="true">·</span>
                            <Link href="/terms" className="hover:text-slate-200 transition-colors">{t.legalTermsLink}</Link>
                        </div>
                        <p className="text-center text-sm text-slate-400 sm:text-right">{t.homeFooterText}</p>
                    </div>
                </div>
```
(`Link` is already imported in this file.)

- [ ] **Step 3: Lint and build**

```
cd frontend
npm run lint
npm run build
```
Expected: clean lint and successful build.

- [ ] **Step 4: Manual smoke**

Landing footer and login card both show "Gizlilik & KVKK · Kullanım Şartları" links that navigate to `/privacy` and `/terms`.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/login/page.tsx frontend/app/page.tsx
git commit -m "feat(frontend): show privacy/terms links on login and landing (#73)"
```

---

## Self-Review

**1. Spec coverage:**
- KVKK/privacy text (TR + EN) → Task 2 `content.ts` + pages. ✓
- Required fields (controller, contact, data types, purpose, retention, third parties, rights) → Task 2 privacy sections 1–9. ✓
- Visible links on register/login/landing → register (Task 3 consent label links), login + landing (Task 4). ✓
- Consent UI + backend record → Task 3 checkbox + Task 1 `kvkk_consent_at`/`consent_version`. ✓
- Response shape stability (K6) → Task 1 Step 1 `test_register_response_shape_unchanged`. ✓
- Idempotent migration for existing data.db → Task 1 Step 4 `_ensure_consent_columns`. ✓

**2. Placeholder scan:** No TBD/TODO; all code blocks and legal text are concrete. ✓

**3. Type consistency:** `accepted_terms` (backend snake_case) ↔ `acceptedTerms` (frontend camelCase) mapped explicitly in the AuthContext body. `register()` arity changed to 3 and updated at its only call site (register page). i18n keys referenced in Tasks 3/4 (`legalPrivacyLink`, `legalTermsLink`, `registerConsent*`) are all defined in Task 2/Task 3. `useLanguage()` field is `lang` (used in LegalPage). `CONSENT_VERSION` defined in Task 1 Step 3, imported in route + test. ✓

**Notes for the executor:**
- Run tasks in order (2 before 3/4 because they reuse Task 2's i18n labels and routes).
- Backend lifespan runs `init_db()` under the test client; `_ensure_consent_columns` is idempotent and safe.
- Watch the `.next` build/dev race: do not run `npm run build` while `npm run dev` is active.
