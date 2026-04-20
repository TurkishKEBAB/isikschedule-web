# IşıkSchedule — Stabilizasyon & Bakım Planı (v2)

> **Amaç:** Kod tabanını istikrarlı bir tabana oturtmak: önce gerçek durumu doğrula, sonra güvenlik + kontrat testleri, sonra generate/share mimarisi, en son büyük frontend parçalama.
>
> **Prensip:** Küçük, geri alınabilir adımlar. Her adımın doğrulama yolu olsun. Metrik (satır sayısı vb.) hedef değil, yalnız rehber. CLAUDE.md kuralları öncelik: "en küçük gerekli değişiklik", büyük dosyaları gereksiz refactor etme.
>
> **Son güncelleme:** 2026-04-20 — v2 (Codex + Copilot/Gemini feedback entegre)

---

## İçindekiler

1. [v2'de Ne Değişti](#v2de-ne-değişti)
2. [Kararlar (Resolved)](#kararlar-resolved)
3. [Gerçek Durum Envanteri](#gerçek-durum-envanteri)
4. [Faz 0 — Temizlik & Baseline](#faz-0--temizlik--baseline)
5. [Faz 0.5 — Smoke Test Altyapısı](#faz-05--smoke-test-altyapısı)
6. [Faz 1 — Güvenlik & Tutarlılık](#faz-1--güvenlik--tutarlılık)
7. [Faz 2 — Generate/Share Mimarisi & Kontratlar](#faz-2--generateshare-mimarisi--kontratlar)
8. [Faz 3 — Frontend Refactor (Kademeli)](#faz-3--frontend-refactor-kademeli)
9. [Faz 4 — Test Kapsamını Genişletme](#faz-4--test-kapsamını-genişletme)
10. [Faz 5 — Dokümantasyon & DevEx](#faz-5--dokümantasyon--devex)
11. [Opsiyonel Backlog](#opsiyonel-backlog)
12. [İlerleme Takibi](#ilerleme-takibi)
13. [Çalışma Prensipleri](#çalışma-prensipleri)

---

## v2'de Ne Değişti

- **Envanter yeniden çıkarıldı.** v1'deki üç yanlış iddia düzeltildi:
  - `docker-compose.yml` **mevcut** ([docker-compose.yml](docker-compose.yml)) — ama Celery/Postgres/Redis kurgusu kodda karşılığı olmayan "aspirational" bir kurulum.
  - `backend/.env.example` **mevcut** ([backend/.env.example](backend/.env.example)) — fakat PostgreSQL default'u kodun gerçek SQLite davranışıyla çelişiyor.
  - `frontend/app/lib/api.ts` **bozuk değil**, sadece `API_BASE_URL` export ediyor. Asıl problem: API çağrıları dağınık, çoğu sayfa kendi `fetch` çağrısını yapıyor.
- **Testler öne alındı.** Faz 0.5 eklendi: Faz 1'deki güvenlik değişiklikleri öncesi auth/upload/generate/shared için minimum smoke test suite.
- **Faz 1 yeniden sıralandı.** CORS önce değil sonra. Yeni sıra: SECRET_KEY tutarsızlığı → config/DB URL tutarlılığı → exception logging → hardcoded admin → anonymous share sahiplik sorunu → datetime → upload sertleştirme → CORS.
- **"JOBS persistence" problemi yeniden tanımlandı.** Asıl mesele arka planda çalışmayan "fake async" yapı. Faz 2'nin tepesinde **Generate akış modeli kararı**: `sync` / `gerçek background task` / `db-backed polling`.
- **Anonymous share sahipliği Faz 1'e alındı.** Codex tespiti: [schedules.py:89-96](backend/app/api/routes/schedules.py#L89-L96) paylaşılan schedule'ları ilk user'a (admin) bağlıyor — "yeni özellik" değil, aktif veri sahipliği/gizlilik sorunu.
- **Frontend satır sayısı hedefleri kaldırıldı.** Metric-driven churn, CLAUDE.md'nin "büyük dosyaları gereksiz refactor etme" prensibine aykırı. Yerine davranışsal kurallar.
- **Opsiyonel backlog ayrıldı.** Celery/Redis, Sonar, audit log, çoklu algoritma, Docker Compose operasyonel duruma getirme → ayrı bölüm. Ana plan daha odaklı.
- **Açık kararlar netleştirildi.** K1 (sync-first), K2 (context kalsın), K4 (her faz feature branch) karar olarak yazıldı; soru olarak değil.

---

## Kararlar (Resolved)

Bu kararlar plan'ın geri kalanının temelidir.

| # | Karar | Gerekçe |
|---|---|---|
| **K1** | **Execution model: sync-first.** Generate akışı SQLite + senkron hesap ile kalacak. Celery/Redis/Postgres **Opsiyonel Backlog**'a alındı. | Üniversite ölçeğinde eşzamanlı kullanıcı düşük; deployment complexity'si anlamsız. `docker-compose.yml` ve `.env.example` bu gerçeğe göre güncellenecek. |
| **K2** | **i18n: `LanguageContext` korunacak, çeviriler JSON dosyalarına taşınacak.** `next-intl` şimdilik eklenmeyecek. | Custom context zaten çalışıyor; yeni dep ekstra yük. Şu anki problem bakım değil, kaynak veriyi koddan ayırmak. |
| **K3** | **Test framework (frontend): Vitest + React Testing Library.** | Next.js 14 ile uyumlu, Jest'ten hızlı, modern. |
| **K4** | **Commit stratejisi: her faz için feature branch; faz içinde atomic commit'ler.** | Geri çekilebilirlik. Her faz merge'den önce CI yeşil. |
| **K5** | **Mevcut uncommitted değişiklikler: önce `backup/pre-stabilization-YYYYMMDD` branch'i**, sonra `master`'a dönüp gözden geçirerek mantıksal gruplarla commit. | 20+ dosya doğrudan commit'lenemez; snapshot olmadan temizlemek de risk. |
| **K6** | **Mevcut API response shape'leri Faz 2'de değiştirilmeyecek.** Pydantic şeması eklenecek ama alan adları/yapı aynı kalacak. | Frontend'i kırmamak. Breaking değişiklik gerekirse ayrı `/api/v2/` prefix'i. |
| **K7** | **README gerçeğe uydurulacak**, kod README'ye değil. | K1 doğal sonucu. |

---

## Gerçek Durum Envanteri

### Backend

| Konu | Gerçek | Not |
|---|---|---|
| Framework | FastAPI 0.136, Python 3.12 | [main.py](backend/app/main.py) |
| Veritabanı | SQLite, `os.getenv("DATABASE_URL")` ile | [database.py:13](backend/app/models/database.py#L13) — `settings.DATABASE_URL`'ı **kullanmıyor**, çift okuma |
| Job store | In-memory `JOBS: Dict[str, dict]` | [generate.py:22](backend/app/api/routes/generate.py#L22) |
| Generate flow | `async def` ama gövdede sync hesap, aynı request'te tamamlanıyor | [generate.py:239-289](backend/app/api/routes/generate.py#L239-L289) — "fake async" |
| SECRET_KEY | `auth.py` hardcoded, `config.py` ayrı default | [auth.py:17](backend/app/core/auth.py#L17), [config.py:25](backend/app/config.py#L25) — iki kaynak, uyumsuz |
| Admin user | `database.py` içinde hardcoded email + şifre | [database.py:117-122](backend/app/models/database.py#L117-L122) |
| Anonymous share | İlk user'a (admin) bağlanıyor | [schedules.py:89-96](backend/app/api/routes/schedules.py#L89-L96) — veri sahipliği sorunu |
| TODO endpoint'ler | `GET /schedules/{job_id}`, export placeholder | [schedules.py:36,43,71-72](backend/app/api/routes/schedules.py#L36) |
| Exception handler | Log atmıyor, sadece response dönüyor | [main.py:77-85](backend/app/main.py#L77-L85) |
| datetime | `utcnow()` kullanımı (Python 3.12 deprecated) | `auth.py:45,47`, `generate.py:257` ve diğer yerler |
| Tests | `backend/test_soft.py` — gerçek test değil, ad-hoc debug script | [test_soft.py](backend/test_soft.py) |
| requirements.txt | **UTF-16 LE** kodlu | [backend/requirements.txt](backend/requirements.txt) |
| Boş modüller | `algorithms/`, `services/`, `tasks/`, `db/` sadece `__init__.py` | Opsiyonel backlog'a (algorithms) veya silinecek |

### Frontend

| Konu | Gerçek | Not |
|---|---|---|
| Framework | Next.js 14, React 18, TS 5 | [package.json](frontend/package.json) |
| Tests | **Yok** | — |
| `api.ts` | Sadece `API_BASE_URL` export | [lib/api.ts](frontend/app/lib/api.ts) — çalışıyor, ama merkezi client yok |
| Dağınık API çağrıları | Login, results, configure, scheduler kendi fetch'i | Faz 3'te merkezi client'a migrate |
| Dev dosyalar | `scheduler/page.tsx` 2008, `results/page.tsx` 981, `LanguageContext.tsx` 508, `configure/page.tsx` 401 | Satır sayısı bilgi amaçlı, hedef değil |
| i18n | Context içinde satır satır çeviri | K2: JSON'a taşınacak |
| Untracked dizinler | `components/`, `lib/`, `shared/` | Faz 0'da commit'lenecek |

### Repo / Infra

| Konu | Gerçek | Not |
|---|---|---|
| `docker-compose.yml` | **Mevcut** ama Postgres+Redis+Celery kurguluyor | Kod bunların hiçbirini kullanmıyor; K1 sonrası simplify edilecek veya backlog'a |
| `backend/.env.example` | **Mevcut** ama PostgreSQL default'u K1 ile çelişiyor | Faz 1'de SQLite default'una çekilecek |
| `.gitignore` | Yeni untracked, içerik doğrulanmalı | Faz 0 |
| `claude.md`, `agent.md` | `CLAUDE.md` ile duplicate/benzer | Faz 0'da birleştir/sil |
| `data.db.bak`, `pytest-cache-files-*` | Repo'da | Faz 0'da sil + ignore |
| `sonar-project.properties` | Mevcut ama CI entegrasyonu yok | Opsiyonel backlog |
| Git durumu | 20+ modified dosya uncommitted | K5 gereği snapshot branch'e alınıp gözden geçirilecek |

### README ↔ Kod Uyumsuzlukları

| README'de yazan | Gerçek | Karar |
|---|---|---|
| PostgreSQL 16 | SQLite | K7: README SQLite diyecek |
| Redis 7, Celery | Yok, in-memory dict | K7: README'den çıkar |
| Docker Compose | `docker-compose.yml` var ama kodla uyumsuz | Faz 5'te ya sync-friendly hale getir ya backlog'a al |
| `backend/tests/` | `test_soft.py` (debug script) | Faz 0.5'te gerçek `tests/` kur |

---

## Faz 0 — Temizlik & Baseline

**Hedef:** Kod davranışı değişmeden repo'yu yaşanılabilir hale getir.
**Risk:** Düşük.
**Önkoşul:** Yok.

### 0.1 Uncommitted değişiklikleri emniyete al (K5)
- `git branch backup/pre-stabilization-20260420` → snapshot
- `git diff master` ile 20+ modified dosyayı kategorize et:
  - Anlamlı değişiklik → mantıksal gruplarla commit
  - Whitespace/accidental → revert
- Untracked dizinleri (`components/`, `lib/`, `shared/`) mantıksal gruplarla commit

### 0.2 `.gitignore` denetle ve tamamla
```gitignore
# Backend
__pycache__/
*.py[cod]
.pytest_cache/
pytest-cache-files-*/
.coverage
htmlcov/
*.db
*.db.bak
.venv/
venv/

# Frontend
node_modules/
.next/
out/
npm-debug.log*

# Env
.env
.env.local
.env.*.local

# Uploads (örnekleri repo'da tutma)
backend/uploads/*
!backend/uploads/.gitkeep

# IDE
.vscode/
.idea/
*.swp
```

### 0.3 Duplicate dokümantasyonlar
- `CLAUDE.md` authoritative. `claude.md` ve `agent.md` → farklı içerik varsa CLAUDE.md'ye birleştir, ikisini sil.

### 0.4 Encoding + requirements.txt kararı
- **Önce karar:** "freeze" dosyası mı (pinned transitive deps) "manifest" mi (sadece top-level)?
  - **Öneri:** Manifest. `requirements.txt` sadece doğrudan deps (fastapi, uvicorn, sqlalchemy, passlib[bcrypt], python-jose, openpyxl, pandas, pydantic-settings, pytest, ruff, reportlab, icalendar, httpx). Transitive deps pip'e bırakılsın. Reproducibility için ayrı `requirements-lock.txt` opsiyonel.
- Sonra encoding fix: UTF-16 LE → UTF-8.

### 0.5 Kirli dosyaları sil
- `backend/data.db.bak` → sil
- `backend/pytest-cache-files-*` → sil
- `backend/__pycache__`, `backend/app/**/__pycache__` → sil
- **DİKKAT:** `backend/data.db` silme — admin user ve kayıtlı schedule'lar olabilir.

### 0.6 `test_soft.py` yer değiştir
- Gerçek test değil, debug script. → `backend/scripts/debug_soft.py`'a taşı, veya kaldır.

### Çıktı
- Temiz `git status`, mantıklı commit'ler, güvenli snapshot branch.

---

## Faz 0.5 — Smoke Test Altyapısı

**Hedef:** Faz 1 güvenlik değişikliklerinden önce **regresyon ağı** kur.
**Risk:** Düşük.
**Önkoşul:** Faz 0.

### 0.5.1 Backend pytest iskeleti
```
backend/tests/
  __init__.py
  conftest.py           # in-memory SQLite, TestClient, auth helper
  test_auth_smoke.py
  test_upload_smoke.py
  test_generate_smoke.py
  test_shared_smoke.py
  fixtures/
    sample_schedule.xlsx   # uploads/ altındakinden türetilmiş küçük örnek
```

### 0.5.2 Minimum test seti (değişmemesi gereken davranışlar)
- **Auth:** register happy path, login happy path, hatalı şifre 401 döner
- **Upload:** valid xlsx → parse sonucu dict list döner, invalid MIME → 400
- **Generate:** valid request → job_id + status dönüyor, geçersiz `selected_main_codes` → 400
- **Shared:** anonymous share POST → share_code dönüyor, `GET /shared/{code}` → aynı schedule

### 0.5.3 Frontend smoke (opsiyonel, Faz 4'e kaydırılabilir)
- Vitest kur (K3)
- 2-3 test: `scheduleExport` output şekli, `schedulerStorage` localStorage roundtrip, `Toast` render

### Çıktı
- Faz 1/2'de hiçbir değişiklik bu smoke suite'i kırmadan yapılacak.
- CI'da çalıştırılmasa bile local'de `pytest backend/tests/` komutu yeşil.

---

## Faz 1 — Güvenlik & Tutarlılık

**Hedef:** Production güvenliğini ve iç tutarlılığı bir sessionda sağlamak.
**Risk:** Orta. Auth ve share akışına dokunuyor — Faz 0.5 smoke testleri kalkan.
**Önkoşul:** Faz 0.5.

### 1.1 SECRET_KEY tek kaynak (en kritik)
- **Şu an:** `auth.py:17` hardcoded, `config.py:25` ayrı default.
- `auth.py` → `from app.config import settings` ve `settings.SECRET_KEY`, `settings.JWT_ALGORITHM`, `settings.ACCESS_TOKEN_EXPIRE_MINUTES` kullansın.
- `config.py` → `APP_ENV == "production"` iken `SECRET_KEY` default kabul edilmesin; validator ekle.
- `.env.example` → `SECRET_KEY` satırına uyarı yorumu.

### 1.2 DATABASE_URL tek kaynak
- **Şu an:** `database.py` kendi başına `os.getenv` yapıyor.
- `database.py` → `from app.config import settings` ve `settings.DATABASE_URL`.
- `settings.DATABASE_URL` default'u SQLite olsun (`sqlite:///./data.db`) — K1.
- `.env.example` default'u da SQLite'a çekilsin (şu an PostgreSQL).

### 1.3 Exception logging
- `main.py:77-85` → global handler exception'ı `logger.exception(...)` ile yaz.
- `app.core.logging` modülü kur (stdlib logging yapılandırması).

### 1.4 Hardcoded admin credentials kaldır
- `config.py` → `ADMIN_EMAIL` ve `ADMIN_PASSWORD` ayarları.
- Development'ta default kabul edilebilir (clear warning log'u ile), production'da zorunlu.
- `database.py:create_admin_user()` → settings'ten oku.

### 1.5 Anonymous share sahiplik düzeltmesi
- **Şu an:** `schedules.py:89-96` share'i ilk user'a (admin) bağlıyor — admin'in "kendi schedule'u" gibi görünüyor.
- Seçenekler:
  - **A)** `SavedSchedule.user_id` nullable yap (migration gerekli). Anonymous share'ler user_id=NULL.
  - **B)** Ayrı `AnonymousShare` tablosu (daha temiz ayrım).
- **Öneri:** (A). Minimum diff.
- Frontend'deki "my schedules" listesinde `user_id IS NOT NULL` filtresi.

### 1.6 `datetime.utcnow` → `datetime.now(timezone.utc)`
- Tüm backend'de değiştir. Grep ile bul: `auth.py:45,47`, `generate.py:257`, `models/database.py` default'ları.

### 1.7 File upload sertleştirmesi
- `upload.py` içinde:
  - MIME type / extension: sadece `.xlsx`
  - Boyut: `settings.MAX_FILE_SIZE_MB` gerçekten uygulanıyor mu? Enforce et.
  - Yazılan dosya adı: kullanıcı filename'i değil, UUID. (Şu an muhtemelen öyle — doğrula.)
  - Path traversal: `file_id` endpoint parametresi regex ile sanitize (yalnız `[a-f0-9-]{36}`).

### 1.8 CORS sıkıştırma
- Dev'de `*` kalabilir. Production'da `allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]`, `allow_headers` explicit liste.

### Çıktı
- Faz 0.5 smoke suite yeşil.
- SECRET_KEY, DATABASE_URL, logging, admin, share sahipliği, datetime, upload, CORS — hepsi elden geçmiş.
- `.env.example` SQLite + clear warnings.

---

## Faz 2 — Generate/Share Mimarisi & Kontratlar

**Hedef:** Generate akışının yapısal sorununu çöz, placeholder endpoint'leri tamamla, pydantic response şemalarıyla kontratları belgele.
**Risk:** Orta-Yüksek. API shape korunacak (K6); davranış değişiklikleri frontend'de doğrulanacak.
**Önkoşul:** Faz 1.

### 2.1 Generate execution model kararı (K1 sonrası netleşti)
- **Karar:** Sync-first. Mevcut "fake async" kalıbı temizlenecek.
- **Seçenekler (şu faz için pick one):**
  - **A) Sync endpoint:** `POST /generate` doğrudan result dönsün. Frontend polling kaldırılır. En basit. Timeout gelirse tekrar düşünülür.
  - **B) DB-backed polling:** SQLite'ta `jobs` tablosu. Endpoint job ekler, ayrı FastAPI `BackgroundTasks` hesabı yapar. Frontend `GET /jobs/{id}` poll eder. Bu gerçek async ama Celery'siz.
  - **C) Gerçek worker:** Opsiyonel backlog'a.
- **Öneri:** Önce (A) ile deneme. 15 ders max (zaten validasyonda var), `itertools.product` kısıtlı (100 limit). Olası timeout'ı ölç; >3sn ise (B)'ye geç.
- **Dosyalar:** [generate.py](backend/app/api/routes/generate.py), frontend'de job polling kaldırma (scheduler + results sayfaları).

### 2.2 `schedules.py` placeholder temizliği
- `GET /schedules/{job_id}` (şu an boş list dönüyor) — ya gerçekten implement et, ya kaldır (2.1'le frontend bunu zaten kullanmıyor olabilir).
- `GET /schedules/{job_id}/{schedule_index}` — sahte veri dönüyor. Aynı karar.
- `POST /schedules/{job_id}/{schedule_index}/export` — TODO'lu export. Frontend export'u zaten `lib/scheduleExport.ts` ile client-side yapıyor — backend tarafı gerekli mi netleştir; gerekmiyorsa endpoint'i kaldır.
- **Prensip:** Kullanılmayan endpoint'i silmek, yarım bırakmaktan iyi.

### 2.3 Pydantic response model'leri (contract)
- **Önemli:** K6 — shape değişmeyecek, sadece tip anotasyonu.
- Yeni dizin: `backend/app/schemas/`
  - `auth.py` — `RegisterRequest`, `LoginRequest`, `TokenResponse`
  - `courses.py` — `Course` (mevcut response shape'inden türet)
  - `schedules.py` — `ScheduleItem`, `JobResult`, `SharedSchedule`
  - `jobs.py` — `JobResponse` (2.1 seçimine göre)
  - `friends.py` — mevcut `friends.py` route'undan çıkar
- Her endpoint'e `response_model=...`. Mevcut davranışı bozmadığını Faz 0.5 testleri doğrulasın.

### 2.4 Error response standardı
- Tek format:
  ```json
  { "error": { "code": "COURSE_NOT_FOUND", "message": "Kullanıcıya gösterilecek mesaj", "details": {} } }
  ```
- `app.core.exceptions` modülü: custom exception sınıfları + handler.
- Mevcut `HTTPException(detail="...")` kullanımları kademeli migration (tek PR'da hepsini değiştirme — migration'ı Faz 2.4'ün sonuna bırak, gerekirse Faz 5'e taşı).

### 2.5 `excel_loader.py` dayanıklılık denetimi
- Null hücreler, eksik kolon, tekrar eden `main_code`, encoding.
- Parse hatalarını **kullanıcı dostu** mesajlarla yükselt: "Row 42: missing course code".
- Faz 0.5'teki smoke'a ek olarak edge case testleri ekle (bozuk xlsx fixture'ı).

### Çıktı
- Generate akışı net bir modelde.
- Placeholder endpoint'ler ya gerçek ya silinmiş.
- Tüm endpoint'ler pydantic response model'li.
- Error response formatı tek tip (migration başladı).

---

## Faz 3 — Frontend Refactor (Kademeli)

**Hedef:** Büyük dosyaları bakımı kolay hale getir, **ama churn üretme**.
**Risk:** Yüksek. 2008 satırlık `scheduler/page.tsx` için her küçük adımdan sonra manuel smoke test.
**Önkoşul:** Faz 0.5 (ve ideal olarak Faz 4'ten bazı frontend testleri).

### Kural (metrik değil davranış)

- **Satır sayısı hedefi yok.** Küçük parça çıkarmak için değil, **aynı kod 3 yerde tekrar ettiğinde** veya **state karmaşası okumayı engellediğinde** çıkart.
- **Her extract'ten sonra:** `npm run dev` → ilgili ekrana git → golden path + 1 edge case manuel test et → commit.
- **State'e dokunma sırası:** Önce presentational (saf UI) component'ler. State taşıması (Zustand migrate, hook extract) en son.

### 3.1 Merkezi API client'a kademeli migrate
- `frontend/app/lib/api.ts` → axios instance kur:
  - baseURL = `API_BASE_URL`
  - Interceptor'lar: auth header, 401 → logout+redirect, error normalization
- Sonra **sayfa sayfa migrate** (her sayfada fetch/axios çağrıları `apiClient`'a çekilecek):
  1. `login/page.tsx`
  2. `register/page.tsx`
  3. `upload/page.tsx`
  4. `scheduler/page.tsx`
  5. `results/page.tsx`
  6. `configure/page.tsx`
  7. `shared/[id]/page.tsx`
  8. `admin/page.tsx`
- Her sayfa ayrı commit; smoke test (manuel).

### 3.2 `LanguageContext` JSON'a taşıma (K2)
- `frontend/app/locales/tr.json` ve `en.json` oluştur.
- Context'ten çeviri map'lerini kes, JSON'dan oku. API değişmeden (`t("key")` aynı).
- Test: her dil için login → upload → scheduler ekranlarında çeviriler doğru.

### 3.3 `scheduler/page.tsx` pilot extract (state'e dokunma)
- **Pilot:** En izole, state'i en az tutan parçadan başla. İyi aday: course tablosu satırı veya filter input'u.
- 1 extract → smoke test → commit. İyi gidiyorsa bir tane daha.
- State taşıması (Zustand vb.) **bu faz'da yok**. Gerekirse ayrı backlog maddesi.

### 3.4 `results/page.tsx` — aynı prensip
- En izole görsel parça (ör. haftalık grid tablosu) extract et, smoke test, commit.

### 3.5 TypeScript ve Tailwind hijyen
- `tsconfig.json` → `strict: true` kontrol.
- `any` kullanımlarını **sadece migrate edilen dosyalarda** temizle (tümünü birden değil).
- Tailwind pattern'leri CLAUDE.md uyarısınca dokunulmaz, **çok tekrarlayan** bir sınıf seti için (örn. button variant'ları) küçük component çıkart.

### Çıktı
- Merkezi API client kurulu, tüm sayfalar migrate edilmiş.
- Çeviriler JSON'da.
- `scheduler/page.tsx` ve `results/page.tsx` bakım riski ölçüsünde (değil "<200 satır") parçalanmış.

---

## Faz 4 — Test Kapsamını Genişletme

**Hedef:** Smoke'un üzerine anlamlı coverage ekle. Hedef: backend %60+, frontend (migrate edilen parçalar için) %50+.
**Risk:** Düşük.
**Önkoşul:** Faz 0.5, Faz 1, Faz 2.

### 4.1 Backend genişletme
- `test_auth.py` — token expiry, email domain validation, admin role guard
- `test_upload.py` — oversize reject, MIME reject, malformed xlsx graceful error
- `test_generate.py` — algoritmanın çıkardığı kombinasyonların çakışma yasasına uyduğu, max_ects limiti
- `test_schedules.py` — save/list, share_id generate
- `test_friends.py` — request→accept→friendship listede, reject akışı
- `test_excel_loader.py` — 5-6 edge case fixture'ı

### 4.2 Frontend genişletme
- Lib: `scheduleExport`, `schedulerStorage`, `api` interceptor'ları
- Components: `Modal`, `Toast`, `TeacherLink`, `ConfirmDialog`, `Navbar`
- Faz 3'te extract edilen her component için render + interaction testi

### 4.3 Geliştirici komutları
- `backend/Makefile` (veya `scripts/`): `make test`, `make lint` (ruff), `make format`
- `frontend/package.json`: `test`, `test:watch`, `coverage`, `lint`

### 4.4 CI (opsiyonel, backlog'da da olabilir)
- GitHub Actions: backend pytest + frontend lint + frontend test. Bu faz'a sıkıştırılmazsa Opsiyonel Backlog.

### Çıktı
- Anlamlı coverage, `make test` tek komutta tüm backend yeşil.

---

## Faz 5 — Dokümantasyon & DevEx

**Hedef:** Yeni geliştirici repo'yu ≤15 dakikada ayağa kaldırsın.
**Risk:** Düşük.
**Önkoşul:** Faz 1 (çünkü env değişkenleri netleşmiş olmalı).

### 5.1 README rewrite (K7)
- Gerçek tech stack: FastAPI + SQLite + Next.js. Postgres/Redis/Celery "future" olarak ayrı "Roadmap" bölümüne.
- Kurulum: Windows + Unix komutları, `start-dev.bat` ve (eklenirse) `start-dev.sh`.
- Gerçek proje ağacı.

### 5.2 `.env.example` açıklamalı
- Her değişkenin **ne yaptığı** yorum satırı olarak.
- Production zorunlu alanlar `# REQUIRED in production` ile işaretli.

### 5.3 `docker-compose.yml` kararı
- **Karar (2 seçenek):**
  - **A)** SQLite + backend + frontend'e simplify et (K1 ile tutarlı).
  - **B)** Aspirational olduğu açıkça belirtilsin (üst yorum), opsiyonel backlog'a referans ver.
- **Öneri:** (A) — simplify. `docker-compose.yml` çalışır durumda olsun ya da olmasın, yanıltıcı olmasın.

### 5.4 API dokümantasyonu
- FastAPI `/docs` otomatik; her endpoint için `summary`, `description`, `responses` örnekleri.

### 5.5 CONTRIBUTING.md (kısa)
- Branch strategy (K4)
- Commit format (Conventional Commits önerilir, zorunlu değil)
- Test ve lint bekleyen kontroller

### 5.6 Pre-commit hooks (opsiyonel)
- `ruff check`, `ruff format`, `next lint`, `prettier`
- Çalıştırması kolay olsun; engelleyici değil.

### Çıktı
- README gerçek, `.env.example` açıklamalı, docker-compose tutarlı veya işaretli.

---

## Opsiyonel Backlog

Bunlar ana plan değil. Faz 5 bittikten sonra öncelik sıralaması yapılır.

| # | Madde | Not |
|---|---|---|
| B1 | **Redis + Celery gerçek worker'a geçiş** | K1 değişirse. Şu an gerek yok. |
| B2 | **PostgreSQL'e migrate** | Eşzamanlı kullanıcı artarsa. |
| B3 | **Docker Compose operasyonel** | Dev'de tek komut ayağa kalkan tam stack. |
| B4 | **SonarQube entegrasyonu** | `sonar-project.properties` zaten var. |
| B5 | **Audit log** | Admin işlemleri için. |
| B6 | **Çoklu algoritma** (DFS, BFS, A*, Genetic) | README vaadi. Şu an `algorithm` param ignored. |
| B7 | **Rate limiting** | `slowapi` ile login/register/upload. |
| B8 | **Job retry & cancellation** | Gerçek async model kurulursa. |
| B9 | **CI (GitHub Actions)** | Faz 4.4 buraya kayabilir. |
| B10 | **Frontend E2E (Playwright)** | Smoke'dan öteye. |
| B11 | **Next-intl'e geçiş** | K2 değişirse. |
| B12 | **Scheduler `page.tsx` state refactor (Zustand)** | Faz 3 yeterli olmazsa. |
| B13 | **Database migration tool (Alembic)** | Şu an `create_all()`. Şema değişince gerekecek. |

---

## İlerleme Takibi

| Faz | Durum | Başlama | Bitiş | Branch | Not |
|---|---|---|---|---|---|
| Faz 0 — Temizlik & Baseline | ⬜ | — | — | — | Buradan başla |
| Faz 0.5 — Smoke Tests | ⬜ | — | — | — | Faz 1 öncesi zorunlu |
| Faz 1 — Güvenlik & Tutarlılık | ⬜ | — | — | — | SECRET_KEY → DB URL → logging → admin → share → datetime → upload → CORS |
| Faz 2 — Generate/Share Mimarisi | ⬜ | — | — | — | 2.1 akış modeli kararı önce |
| Faz 3 — Frontend Refactor | ⬜ | — | — | — | Kademeli; her adım smoke test |
| Faz 4 — Test Kapsamı | ⬜ | — | — | — | |
| Faz 5 — Dokümantasyon | ⬜ | — | — | — | |

**Legend:** ⬜ Yapılmadı · 🟡 Devam · ✅ Tamamlandı · ⏸️ Beklemede

**Kural:**
- Faz başlarken satırı 🟡, branch adı gir.
- Faz bitince ✅, son commit SHA'sı ekle.
- Kapsam genişlerse ilgili faz'a madde ekle; büyük sapma varsa Opsiyonel Backlog'a yeni madde.

---

## Çalışma Prensipleri

Bu plan CLAUDE.md'ye bağlı kalmak zorunda.

1. **En küçük gerekli değişiklik.** Büyük dosyaları gereksiz parçalama. Faz 3 pilot-extract yaklaşımı bunun için.
2. **Frontend/backend senkron.** Response shape değişmeyecek (K6). Değişecekse aynı commit'te her iki taraf.
3. **Kontrat değişikliği yasak (K6 süresince).** Pydantic eklemek OK; alan adı değiştirmek değil.
4. **Her faz kendi branch'inde.** CI (veya local smoke) yeşil olmadan merge yok.
5. **Regresyon ağı önce.** Faz 0.5 olmadan Faz 1 başlamaz.
6. **Commit atomic.** Bir faz = 3-10 mantıksal commit. "Büyük patlama" PR yok.
7. **Belirsizlikte dur, sor.** Açık kararlar (K1–K7) netleştirilmiş; başka bir belirsizlik çıkarsa yeni K# olarak bu dosyaya eklensin.
