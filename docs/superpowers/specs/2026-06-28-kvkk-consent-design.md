# KVKK/Gizlilik Metni ve Kullanıcı Onayı — Tasarım (Issue #73)

- **Tarih:** 2026-06-28
- **Issue:** #73 (Blocks: #74, #34, production go-live)
- **Branch:** `feat/issue-73-kvkk-consent`
- **Onay modeli:** UI onayı + backend kaydı (denetlenebilir)
- **İçerik organizasyonu:** Yaklaşım A — ayrı legal sayfalar + ayrı içerik modülü
- **Dil:** TR asıl/bağlayıcı + EN nezaket çevirisi (dil anahtarına göre render)

## 1. Problem ve kapsam

Uygulamada KVKK aydınlatma metni, gizlilik politikası, kullanım şartları veya kullanıcı onay akışı yok. Uygulama öğrenci verisi işliyor (e-posta, parola hash'i, kayıtlı ders programları, paylaşım linkleri, arkadaşlık ilişkileri). Türkiye'de canlıya çıkış için aydınlatma metni + onay akışı go-live blocker.

**Kapsam (bu issue):**
- Türkçe KVKK aydınlatma/gizlilik metni + kullanım şartları (TR + EN).
- Register/login/landing akışında görünür linkler.
- Register'da zorunlu onay kutusu (client) + backend'de onay kaydı.

**Kapsam dışı (YAGNI / başka issue):**
- Veri silme ve dışa aktarma akışı → #74.
- Politika sürümü değişince yeniden onay, onay geri çekme, amaç bazında granular onay.
- Cookie banner (uygulama analytics/3. taraf çerez kullanmıyor).

## 2. Sabit hukuki bilgiler (kullanıcı tarafından sağlandı)

- **Veri sorumlusu:** Yiğit Okur (bağımsız öğrenci projesi; resmî İşık Üniversitesi ürünü değil).
- **İletişim (yan yana yayınlanacak):** `23SOFT1040@isik.edu.tr` | `yigitokur29@gmail.com`
- **İşlenen veriler:** e-posta adresi, parola (hash'lenmiş), oluşturulan/kayıtlı ders programları, paylaşım linkleri, arkadaşlık ilişkileri.
- **Amaç:** Ders programı oluşturma/saklama/paylaşma hizmetini sunmak ve hesap kimlik doğrulaması.
- **Hukuki sebep (KVKK md.5):** Hizmetin sunulması için açık rıza / sözleşmenin ifası.
- **Saklama süresi:** Hesap aktif olduğu sürece; kullanıcı silme talebinde **30 gün** içinde imha.
- **Üçüncü taraf aktarımı:** Pazarlama/analitik amacıyla yok. Yalnızca uygulamanın çalıştığı barındırma altyapısında işlenir (sağlayıcı adı verilmedi — genel ifade). Analytics yok.
- **Haklar:** KVKK md.11 (bilgi talebi, düzeltme, silme, itiraz vb.); başvuru iletişim adreslerinden.
- **Son güncelleme / sürüm:** `2026-06-28`.

## 3. Mimari

### 3.1 Frontend — sayfalar (App Router)
- `frontend/app/privacy/page.tsx` → "KVKK Aydınlatma Metni & Gizlilik Politikası".
- `frontend/app/terms/page.tsx` → "Kullanım Şartları".
- Her iki sayfa: mevcut görsel dil (AuroraBackground, glass-panel, BrandLogo, LanguageSwitcher), client component, `useLanguage()` ile dile göre içerik. Üstte "ana sayfaya/geri" linki, altta "Son güncelleme: 2026-06-28".

### 3.2 Frontend — içerik modülü
- `frontend/app/legal/content.ts` → `privacyContent` ve `termsContent`, her biri `{ tr: Section[], en: Section[] }`.
- `Section = { heading: string; body: string[] }` (paragraf dizisi). İletişim/veri sorumlusu sabitleri tek yerde tutulur.
- Uzun metin merkezi `LanguageContext`'e GİRMEZ (dosya şişmesini önler — CLAUDE.md).

### 3.3 Frontend — i18n (LanguageContext)
`tr` ve `en` nesnelerine yalnızca KISA UI anahtarları eklenir:
- `legalPrivacyLink` ("Gizlilik & KVKK" / "Privacy & KVKK")
- `legalTermsLink` ("Kullanım Şartları" / "Terms of Use")
- `legalLastUpdated` ("Son güncelleme" / "Last updated")
- `legalBack` ("Geri" / "Back")
- `registerConsentPrefix` / `registerConsentAnd` / `registerConsentSuffix` (onay kutusu metnini link parçalarıyla kurmak için)
- `registerConsentRequired` (hata: "Devam etmek için aydınlatma metni ve şartları kabul etmelisiniz." / EN karşılığı)

### 3.4 Frontend — görünür linkler (kabul kriteri 3)
- **Landing footer** ([page.tsx:167](frontend/app/page.tsx#L167)): `© 2026 IşıkSchedule` satırının yanına `/privacy` ve `/terms` linkleri.
- **Login kartı** ve **Register kartı** alt kısmına aynı iki link.

### 3.5 Frontend — onay akışı (register)
- Submit butonunun üstüne zorunlu `<input type="checkbox" id="register-consent">` + label (içinde `/privacy` ve `/terms`'e `Link`).
- `handleSubmit`: `accepted` false ise `setError(t.registerConsentRequired)` ve `return` (mevcut validasyon kalıbıyla aynı — domain/parola kontrolleri gibi).
- `AuthContext.register` imzası: `register(email, password, acceptedTerms: boolean)`; fetch body'ye `accepted_terms` eklenir.

### 3.6 Backend — model (`backend/app/models/database.py`)
`User` modeline iki nullable kolon:
```python
kvkk_consent_at = Column(DateTime, nullable=True)
consent_version = Column(String(32), nullable=True)
```

### 3.7 Backend — idempotent kolon migration
Projede Alembic yok (`create_all` only). `init_db()` içinde, SQLite için kolon yoksa ekleyen idempotent yardımcı:
```python
def _ensure_consent_columns():
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.connect() as conn:
        cols = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(users)")}
        if "kvkk_consent_at" not in cols:
            conn.exec_driver_sql("ALTER TABLE users ADD COLUMN kvkk_consent_at DATETIME")
        if "consent_version" not in cols:
            conn.exec_driver_sql("ALTER TABLE users ADD COLUMN consent_version VARCHAR(32)")
        conn.commit()
```
`init_db()` → `Base.metadata.create_all(...)` sonrasında çağrılır. Mevcut `data.db` elle müdahale gerektirmez.

### 3.8 Backend — sürüm sabiti (`backend/app/config.py`)
Modül seviyesinde sabit: `CONSENT_VERSION = "2026-06-28"` (mevcut `DEFAULT_ADMIN_*` sabitleriyle aynı yerde).

### 3.9 Backend — register endpoint (`backend/app/api/routes/auth.py`)
- `RegisterRequest`'e alan: `accepted_terms: bool = False`.
- Domain/parola kontrollerinden sonra:
  ```python
  if not request.accepted_terms:
      raise HTTPException(status_code=400,
          detail="KVKK aydınlatma metni ve kullanım şartları kabul edilmeden kayıt yapılamaz.")
  ```
- Kullanıcı oluşturulurken: `kvkk_consent_at=_utcnow()`, `consent_version=CONSENT_VERSION`.
- Sürüm **server-authoritative**; client'tan gelen sürüm yok sayılır.
- **Response shape değişmez** (K6): `TokenResponse` aynı. `/me` (`UserResponse`) değişmez — onay alanı içeride tutulur, #74 dışa açabilir.

## 4. Veri akışı

```
Register sayfası
  checkbox (zorunlu) ──> handleSubmit (client validation)
       │ accepted=false → hata, dur
       ▼ accepted=true
  AuthContext.register(email, password, true)
       ▼ POST /api/auth/register { email, password, accepted_terms: true }
  Backend register()
       │ accepted_terms=false → 400
       ▼ kullanıcı + kvkk_consent_at=now + consent_version="2026-06-28"
  TokenResponse (değişmedi) ──> localStorage ──> /scheduler
```

## 5. Hata yönetimi
- Client: onay yoksa kullanıcıya okunaklı hata (mevcut kırmızı hata kutusu).
- Backend: onay yoksa 400 + okunaklı `detail` (global exception handler şekli korunur, K6).
- Legal sayfaları statik içerik; backend bağımlılığı yok.

## 6. Test stratejisi (backend smoke suite)
`backend/tests/test_auth_smoke.py` (veya yeni `test_consent.py`):
- `register` `accepted_terms` olmadan / `false` → 400.
- `register` `accepted_terms=true` → 200; oluşan kullanıcının `kvkk_consent_at` dolu, `consent_version == CONSENT_VERSION`.
- Mevcut auth smoke testleri yeşil kalır (gerekirse mevcut register çağrılarına `accepted_terms=true` eklenir).

## 7. Dosya değişiklikleri (özet)
**Yeni:**
- `frontend/app/privacy/page.tsx`
- `frontend/app/terms/page.tsx`
- `frontend/app/legal/content.ts`

**Değişen:**
- `frontend/app/context/LanguageContext.tsx` (kısa UI anahtarları, tr+en)
- `frontend/app/context/AuthContext.tsx` (`register` imzası + body)
- `frontend/app/register/page.tsx` (onay kutusu + linkler)
- `frontend/app/login/page.tsx` (linkler)
- `frontend/app/page.tsx` (footer linkleri)
- `backend/app/models/database.py` (2 kolon + `_ensure_consent_columns`)
- `backend/app/config.py` (`CONSENT_VERSION`)
- `backend/app/api/routes/auth.py` (`accepted_terms` + kayıt)
- `backend/tests/` (onay testleri)

## 8. Kabul kriteri eşlemesi (issue #73)
- [x] Türkçe KVKK aydınlatma/gizlilik metni → `privacy` sayfası + içerik modülü (TR/EN).
- [x] Veri sorumlusu/iletişim, veri türleri, amaç, saklama, üçüncü taraf, haklar açık → §2 sabitleri metne işlenir.
- [x] Register/login/landing'de görünür link → §3.4.
- [x] Onay için UI + backend kaydı kararı net → UI checkbox + `kvkk_consent_at`/`consent_version`.

## 9. Riskler / notlar
- KVKK metni hukuki danışman onayından geçmedi; "iyi niyetli, eksiksiz alan kapsayan" taslak. İleride hukuki gözden geçirme önerilir (issue notu).
- EN metin nezaket çevirisidir; uyuşmazlıkta TR esas alınır (her iki sayfada belirtilir).
- `_ensure_consent_columns` yalnızca SQLite; Postgres yolu aspirational (mevcut runtime SQLite).
