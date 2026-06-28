# IsikSchedule - Codex Eksikler ve Bulgular (06.23)

**Hazirlanma tarihi:** 2026-06-24  
**Dosya adi:** Kullanici talebine uygun olarak `06.23` korunmustur.  
**Kapsam:** Production-readiness review; backend, frontend, generate/results, Vercel + ayri FastAPI API deployment, test/CI, dokumantasyon.  
**Hedef varsayim:** Frontend Vercel'de, FastAPI backend ayri bir hostta calisacak.  
**Sinir:** Bu dosya disinda kod/config duzeltilmedi; review-only calisildi.

## Kisa Sonuc

Urun artik prototip seviyesinden cikmaya yaklasmis: backend smoke testleri geciyor, solver tarafinda onceki locked-slot/diagnosis/variant sorunlarinin onemli kismi kapanmis, frontend production build geciyor ve tasarim parity script'i yesil. Buna ragmen canliya cikis icin hala net bloklayicilar var.

En kritik tablo:

- Backend release gate kirmizi: `ruff check .` 8 bulguyla fail.
- Frontend dependency gate kirmizi: `npm audit --audit-level=high` 10 vulnerability, 6 high.
- `master` dalinda buyuk, commitlenmemis degisiklik seti var.
- Saved schedule share endpoint'i auth/sahiplik kontrolu olmadan share code uretebiliyor.
- Admin semester upload, normal upload kadar sertlestirilmemis.
- Generate sonuc store'u process-memory `JOBS`; restart, multi-worker ve load balancer altinda kirilir.
- Migration, backup, production CI ve Vercel/API env sozlesmesi eksik.

## Dogrulama Ozeti

Bu komutlar bugunku repo durumunda calistirildi:

| Komut | Sonuc |
|---|---|
| `git status --short` | `master` uzerinde 14 modified tracked dosya + untracked rapor/brand/design/script dosyalari |
| `backend`: `python -m pytest -q` | `27 passed` |
| `backend`: `python -m pytest --cov=app --cov-report=term-missing -q` | `TOTAL 70%`; admin `35%`, friends `34%`, core models `0%` |
| `backend`: `python -m ruff check .` | Fail, 8 bulgu |
| `frontend`: `npm run lint` | Pass |
| `frontend`: `npm run build` | Pass, Next `14.2.35`, 12 static page generated |
| `frontend`: `npm run test:design` | Pass |
| `frontend`: `npm audit --audit-level=high` | Fail, 10 vulnerability: 6 high, 4 moderate |
| `backend`: `python --version` | Python `3.14.3`; docs hala `3.12` diyor |

---

# P0 Blocker

## P0-1. Release branch kirli ve dogrudan `master` uzerinde

**Alan:** Release/worktree status  
**Dosya/satir:** Git state; `git status --short`  
**Kanit:** `master` aktif dal. 14 tracked dosyada `1138 insertions(+), 701 deletions(-)` ve untracked `Claude eksikler-bulgular(06.23).md`, `design-qa.md`, `docs/design-qa/`, `BrandLogo.tsx`, `frontend/public/brand/`, `frontend/scripts/` var.  
**Production etkisi:** Hangi degisikliklerin release'e dahil oldugu belirsiz. Rollback ve review disiplini zayiflar; untracked asset/script unutulursa Vercel build veya runtime farkli davranabilir.  
**Onerilen fix:** Once snapshot branch al, sonra degisiklikleri mantiksal commitlere bol: backend solver/share, frontend design, brand assets, design QA script, raporlar. Release'i temiz bir branch/PR uzerinden cikar.  
**Dogrulama komutu:** `git status --short && git diff --stat && git branch --show-current`

## P0-2. Backend lint release gate kirmizi

**Alan:** Testing/CI/release quality  
**Dosya/satir:** `backend/app/api/routes/admin.py:174`, `backend/app/api/routes/courses.py:9,19`, `backend/app/api/routes/friends.py:1`, `backend/app/core/excel_loader.py:45`, `backend/tests/conftest.py:12`, `backend/tests/test_edge_cases.py:1`  
**Kanit:** `python -m ruff check .` 8 hata ile fail: E712, F401, F601.  
**Production etkisi:** Backend kalite kapisi kirmizi iken release almak, basit regresyon ve CI disiplini acisindan kabul edilmemeli. `excel_loader.py` icindeki duplicate key ayrica parse mapping niyetini belirsizlestiriyor.  
**Onerilen fix:** Ruff bulgularini kucuk bir cleanup commitinde duzelt. `GlobalCourse.is_active == True` yerine SQLAlchemy uyumlu truth expression kullan, unused importlari sil, duplicate `"KTS Kred"` mapping'i temizle.  
**Dogrulama komutu:** `cd backend; ..\.venv\Scripts\python.exe -m ruff check .`

## P0-3. Saved schedule share endpoint'i auth/sahiplik kontrolu olmadan share code uretiyor

**Alan:** Security, backend/API  
**Dosya/satir:** `backend/app/api/routes/schedules.py:47-55`, `backend/app/api/routes/schedules.py:66-68`  
**Kanit:** `POST /api/schedules/share/{schedule_id}` sadece `db: Session = Depends(get_db)` aliyor; `get_current_user` veya owner check yok. Artan integer `schedule_id` ile mevcut schedule bulunursa `share_id` uretiliyor. `GET /api/shared/{share_code}` public olarak schedule'i donduruyor.  
**Production etkisi:** IDOR riski. Saldirgan schedule id enumerate ederek baskasinin kayitli programina public share link uretebilir. Ogrenci ders plani ve schedule adi gizlilik verisi sayilabilir.  
**Onerilen fix:** Endpoint'i auth'lu yap: `current_user = Depends(get_current_user)`. `SavedSchedule.user_id == current_user.id` kontrolu ekle. Endpoint frontend'de kullanilmiyorsa kaldir. Anonymous share endpoint'i `/schedules/share` ayrica kalabilir, cunku payload client tarafindan gonderiliyor ve owner yok.  
**Dogrulama komutu:** `rg -n "schedules/share|share_schedule|get_current_user|share_id" backend/app/api/routes/schedules.py`

## P0-4. Admin semester upload normal upload kadar sertlestirilmemis

**Alan:** Security, backend upload surface  
**Dosya/satir:** `backend/app/api/routes/admin.py:47`, `backend/app/api/routes/admin.py:56`, `backend/app/api/routes/admin.py:60-62`; karsilastirma: `backend/app/api/routes/upload.py:23-30`, `backend/app/api/routes/upload.py:68-94`  
**Kanit:** Admin upload `.xlsx` ve `.xls` kabul ediyor, MIME/boyut kontrolu yok, dosya yolu `UPLOAD_DIR / f"global_{semester}_{file.filename}"` ile kullanici girdilerinden olusuyor. Normal upload ise sadece `.xlsx`, MIME allow-list, max size, UUID dosya adi ve `_resolve_upload_path` regex'i kullaniyor.  
**Production etkisi:** Admin yetkisi gerekse de admin paneli en yuksek etkili yuzey. Filename/semester path hijyeni, legacy `.xls` parser riski ve disk dolumu canli sistemde gereksiz risk.  
**Onerilen fix:** Admin upload'u normal `upload.py` politikasi ile ayni hale getir: sadece `.xlsx`, MIME + size enforce, UUID storage name, sanitize edilen semester metadata, parse fail'de temiz cleanup.  
**Dogrulama komutu:** `rg -n "upload-semester|endswith|file_path|copyfileobj|_ALLOWED_EXTS|_resolve_upload_path" backend/app/api/routes/admin.py backend/app/api/routes/upload.py`

## P0-5. Frontend dependency audit kirmizi

**Alan:** Security, dependency management, Vercel readiness  
**Dosya/satir:** `frontend/package.json:17-20`, `frontend/package-lock.json`  
**Kanit:** `npm audit --audit-level=high` 10 vulnerability raporluyor: 6 high, 4 moderate. High bulgular arasinda `next`, `form-data`, `glob`, `minimatch` var. Build lock'ta Next `14.2.35` kuruluyor, package range `^14.1.0`.  
**Production etkisi:** Vercel WAF veya platform korumalari defense-in-depth olabilir ama dependency patch yerine gecmez. App Router/Next advisory'leri public frontend icin release blocker olarak ele alinmali.  
**Onerilen fix:** Once non-breaking `npm audit fix` dene; Next/React major upgrade gerektiren bulgular icin resmi advisory'leri kontrol ederek hedef patch versiyonunu belirle. Upgrade sonrasi `npm run lint`, `npm run build`, `npm run test:design` ve browser smoke calistir.  
**Dogrulama komutu:** `cd frontend; npm audit --audit-level=high`

## P0-6. Generate sonuclari process-memory `JOBS` icinde; restart/multi-worker uyumsuz

**Alan:** Generate/results correctness, backend architecture  
**Dosya/satir:** `backend/app/api/routes/generate.py:43`, `backend/app/api/routes/generate.py:138-170`, `backend/app/api/routes/generate.py:179-204`  
**Kanit:** `JOBS: dict[str, JobState] = {}` process icinde tutuluyor. `POST /generate` job id olusturup `run_job(...)` fonksiyonunu ayni request icinde senkron calistiriyor; frontend yine `/api/jobs/{job_id}` poll ediyor.  
**Production etkisi:** Backend restart olursa sonuc kaybolur. Gunicorn/uvicorn multi-worker veya load balancer altinda `POST /generate` ve `GET /jobs/{id}` farkli worker'a giderse 404 doner. Tek worker'a mahkum kalmak da performans/availability riskidir.  
**Onerilen fix:** K1 sync-first karariyla uyumlu net model sec: ya `POST /generate` dogrudan result envelope dondursun ve polling kalksin, ya da SQLite-backed `generation_jobs` tablosu ile job/result persisted olsun. Multi-worker hedefleniyorsa memory dict kullanma.  
**Dogrulama komutu:** `rg -n "JOBS|run_job|/generate|/jobs|result|created_at" backend/app/api/routes/generate.py`

## P0-7. Migration ve backup stratejisi yok

**Alan:** Backend/data model, operations  
**Dosya/satir:** `backend/app/models/database.py:112-114`, `backend/app/models/database.py:56`, `backend/app/models/database.py:60`  
**Kanit:** DB init sadece `Base.metadata.create_all(bind=engine)`. `SavedSchedule.user_id` nullable gibi schema degisiklikleri mevcut `data.db` uzerinde otomatik migrate edilmez. Alembic veya migration directory yok. Backup/restore script'i de gorunmuyor.  
**Production etkisi:** Canli data.db schema drift yasayabilir. Rollback/migration plan olmadan release almak veri kaybi veya manuel SQL riski yaratir. Backup yoksa tek SQLite dosyasi bozuldugunda tum kullanici ve semester verisi kaybolur.  
**Onerilen fix:** Alembic ekle, mevcut schema icin initial migration olustur, release oncesi `alembic upgrade head` calistir. SQLite backup icin zamanlanmis `.backup` veya host-level snapshot + restore testi ekle.  
**Dogrulama komutu:** `rg -n "create_all|nullable=True|share_id|alembic" backend/app backend`

## P0-8. Vercel + ayri API env sozlesmesi net ve zorlayici degil

**Alan:** Vercel deployment, frontend/API integration  
**Dosya/satir:** `frontend/app/lib/api.ts:1`, `frontend/next.config.js:5`, `frontend/next.config.js:7-11`, `backend/.env.example:27`, `backend/app/main.py:59-65`  
**Kanit:** `API_BASE_URL` env yoksa `http://localhost:8000`'e duser. `next.config.js` rewrite tanimli ama uygulama absolute `API_BASE_URL` ile fetch ediyor; rewrite cogu akista devre disi. Backend CORS prod'da explicit origin ister; `.env.example` sadece localhost.  
**Production etkisi:** Vercel production env unutulursa frontend kullanicinin kendi makinesindeki localhost'a istek atar. Env/CORS uyumsuzlugu production'da sessiz  network hatalarina neden olur.  
**Onerilen fix:** Vercel project env'de `NEXT_PUBLIC_API_URL=https://api.<domain>` zorunlu olsun. Build-time env validation ekle. Backend `CORS_ORIGINS=https://<vercel-prod-domain>,https://<custom-domain>` ile deploy edilmeli. Alternatif: frontend relative `/api` kullanip Vercel rewrite/proxy sozlesmesini tek kaynak yap.  
**Dogrulama komutu:** `rg -n "NEXT_PUBLIC_API_URL|localhost:8000|rewrites|CORS_ORIGINS|allow_origins" frontend/app/lib/api.ts frontend/next.config.js backend/.env.example backend/app/main.py`

---

# P1 High

## P1-1. Production CI kalite kapisi yok; sadece CodeQL var

**Alan:** Testing/CI/observability  
**Dosya/satir:** `.github/workflows/codeql.yml:12`, `.github/workflows/codeql.yml:98`; workflow dizini  
**Kanit:** `.github/workflows/` altinda CodeQL workflow var, ancak backend pytest/ruff veya frontend lint/build workflow'u yok.  
**Production etkisi:** Lokal olarak ruff kirmizi oldugu halde PR/main korumasi yakalamaz. Vercel build gecse bile backend release bozuk kalabilir.  
**Onerilen fix:** GitHub Actions ekle: backend job (`python`, install, `pytest`, `ruff check`), frontend job (`npm ci`, `npm run lint`, `npm run build`, `npm run test:design`, `npm audit --audit-level=high` icin policy karari). Branch protection ile zorunlu yap.  
**Dogrulama komutu:** `Get-ChildItem .github/workflows; rg -n "pytest|ruff|npm run build|npm run lint" .github README.md`

## P1-2. Rate limiting tanimli ama uygulanmiyor

**Alan:** Security, abuse prevention  
**Dosya/satir:** `backend/app/config.py:49`, `backend/.env.example:30`, auth/upload/generate routes  
**Kanit:** `RATE_LIMIT_PER_MINUTE` var; `slowapi`, limiter middleware veya decorator yok. `/api/auth/login`, `/api/upload`, `/api/generate` public kaynak tuketen yuzeyler.  
**Production etkisi:** Brute force, upload spam ve CPU-bound generate DoS riski. Vercel frontend ayri olsa da API host direkt hedeflenebilir.  
**Onerilen fix:** IP + endpoint bazli rate limit ekle. Login icin basarisiz deneme backoff; upload/generate icin daha dusuk limit ve max payload policy. Reverse proxy/WAF limitleriyle destekle.  
**Dogrulama komutu:** `rg -n "RATE_LIMIT|slowapi|limiter|/generate|/upload|/login" backend/app backend/.env.example`

## P1-3. Hardcoded admin default credential hala kaynak kodda

**Alan:** Security/config  
**Dosya/satir:** `backend/app/config.py:12-13`, `backend/app/config.py:57-58`, `backend/app/config.py:97-99`  
**Kanit:** Production validator default admin/secret'i reddediyor; bu iyi. Ancak gercek email ve parola degeri kaynak kodda duruyor.  
**Production etkisi:** `APP_ENV` yanlis set edilirse veya dev DB internete acilirsa bilinen admin credential riski dogar. Git history'deki credential da rotate edilmeden guvenli sayilmaz.  
**Onerilen fix:** Defaultlari gercek olmayan placeholder'a cevir, gercek parolayi rotate et, gerekiyorsa git history temizligi yap. Prod env'de admin credential'i secret manager/Vercel/API host env olarak tut.  
**Dogrulama komutu:** `rg -n "DEFAULT_ADMIN|ADMIN_PASSWORD|SECRET_KEY" backend/app/config.py backend/.env.example`

## P1-4. Upload ve generate anonymous abuse'a acik

**Alan:** Backend/API security  
**Dosya/satir:** `backend/app/api/routes/upload.py:57`, `backend/app/api/routes/upload.py:127`, `backend/app/api/routes/generate.py:138`  
**Kanit:** Upload ve generate routes auth dependency almiyor. Upload size kontrollu ama public; generate 15 course limitli ama CPU-bound solver cagiriyor.  
**Production etkisi:** Public API host disk/CPU tuketimiyle yorulabilir. Vercel frontend arkasinda olmasi API endpointlerini korumaz.  
**Onerilen fix:** En az rate limiting; tercihen upload/generate icin auth veya anonymous quota/session. Uploaded dosyalar icin TTL cleanup ekle.  
**Dogrulama komutu:** `rg -n "@router.post\\(\"/upload\"|@router.get\\(\"/upload|@router.post\\(\"/generate\"|get_current_user" backend/app/api/routes/upload.py backend/app/api/routes/generate.py`

## P1-5. Frontend Dockerfile production imaji degil

**Alan:** Deployment/infra  
**Dosya/satir:** `frontend/Dockerfile:16`, `frontend/Dockerfile:20`  
**Kanit:** `ENV NODE_ENV=development` ve `CMD ["npm", "run", "dev"]`.  
**Production etkisi:** Vercel hedefinde Dockerfile kullanilmayabilir; yine de repo deployment dokumani ve alternatif self-host icin yaniltici. `next dev` production server degildir.  
**Onerilen fix:** Vercel hedefi icin Dockerfile'i dokumanda "dev only" diye isaretle veya production multi-stage Dockerfile'a cevir: `npm ci`, `npm run build`, `NODE_ENV=production`, `next start` veya standalone output.  
**Dogrulama komutu:** `Get-Content frontend/Dockerfile`

## P1-6. `docker-compose.yml` gercek runtime ile uyumsuz

**Alan:** Deployment/infra, docs vs reality  
**Dosya/satir:** `docker-compose.yml:8-9`, `docker-compose.yml:20-25`, `docker-compose.yml:32-50`, `docker-compose.yml:58`  
**Kanit:** Compose Postgres, Redis ve Celery worker kuruyor; uygulama ise SQLite + sync-first + process-memory jobs. `app.tasks` bos, Celery runtime ana akis degil.  
**Production etkisi:** Yeni gelistirici veya deploy pipeline `docker-compose up` ile calisir sanip bozuk/yaniltici stack'e gider. Vercel + ayri API stratejisiyle de uyumsuz.  
**Onerilen fix:** Compose'u ya dev-only SQLite backend + frontend haline sadeleştir ya da kaldirip README'de aspirational/backlog olarak isaretle. Vercel icin ayrica frontend env ve backend host runbook yaz.  
**Dogrulama komutu:** `rg -n "postgresql|redis|celery|NEXT_PUBLIC_API_URL" docker-compose.yml`

## P1-7. Readiness probe gercek readiness kontrolu yapmiyor

**Alan:** Observability/operations  
**Dosya/satir:** `backend/app/api/routes/health.py:27-31`  
**Kanit:** `/health/ready` TODO ile her zaman `{"ready": True}` donduruyor.  
**Production etkisi:** DB acilmazsa, upload dizini yazilamazsa veya config bozuksa orchestrator/API gateway yine trafik yonlendirebilir.  
**Onerilen fix:** Readiness icinde DB `SELECT 1`, upload dir exists/writable, critical config checks. Hata durumunda 503.  
**Dogrulama komutu:** `rg -n "ready|TODO|Check database|return" backend/app/api/routes/health.py`

## P1-8. Frontend unit/E2E test suite yok

**Alan:** Frontend quality  
**Dosya/satir:** `frontend/package.json`, `frontend/app/scheduler/page.tsx`, `frontend/app/components/GeneratedSchedulesView.tsx`  
**Kanit:** `package.json` icinde `test` script yok; `rg` Vitest/Jest/RTL test dosyasi bulmuyor. En buyuk client components: scheduler yaklasik 142 KB, generated schedules yaklasik 66 KB.  
**Production etkisi:** Scheduler/results gibi en kritik akislarda regresyonlar lint/build ile yakalanmayabilir. Manual QA'ya asiri bagimlilik olusur.  
**Onerilen fix:** Vitest + React Testing Library ekle. Ilk test seti: `scheduleExport`, diagnosis reason rendering, variant selection, empty result state, auth redirect behavior, upload invalid file UI. Sonra Playwright/Vercel preview smoke.  
**Dogrulama komutu:** `rg -n "vitest|jest|@testing-library|describe\\(|it\\(|test\\(" frontend --glob "!node_modules/**" --glob "!.next/**"`

## P1-9. JWT localStorage'da ve merkezi auth/error client yok

**Alan:** Frontend security/API client  
**Dosya/satir:** `frontend/app/context/AuthContext.tsx:33-34`, `frontend/app/context/AuthContext.tsx:60-61`, `frontend/app/context/AuthContext.tsx:88-89`, `frontend/app/admin/page.tsx:47-109`  
**Kanit:** Token/user localStorage'a yaziliyor. Fetch cagrilari sayfalara dagilmis; 401/403 merkezi logout/redirect yok.  
**Production etkisi:** XSS durumunda token exfiltration riski. Token expire oldugunda sayfa bazli kopuk hata deneyimi. Backend admin endpointleri server-side auth yaptigi icin role spoof gercek yetki vermez, ama UX ve token guvenligi zayif.  
**Onerilen fix:** Orta vadede httpOnly secure cookie modeli. Kisa vadede merkezi API client: auth header, 401/403 logout, error normalization, prod base URL validation.  
**Dogrulama komutu:** `rg -n "localStorage|Authorization|fetch\\(|API_BASE_URL" frontend/app`

---

# P2 Medium

## P2-1. Backend coverage toplam iyi gorunse de kritik alanlar zayif

**Alan:** Backend testing  
**Dosya/satir:** Coverage output; `backend/tests/`  
**Kanit:** Toplam coverage `70%`, ancak `admin.py 35%`, `friends.py 34%`, `core/models.py 0%`, `courses.py 59%`, `core/auth.py 60%`.  
**Production etkisi:** Admin semester upload, friendship flow, auth edge cases ve domain model davranislari canliya yakin senaryolarda yeterince korunmuyor.  
**Onerilen fix:** Coverage'i sadece toplam yuzde olarak degil risk bazli artir. Oncelik: admin upload security tests, share IDOR regression, friends request/accept/reject, auth inactive/token expiry, courses empty/active states.  
**Dogrulama komutu:** `cd backend; ..\.venv\Scripts\python.exe -m pytest --cov=app --cov-report=term-missing -q`

## P2-2. `MAX_SCHEDULES_PER_JOB` ve `JOB_TIMEOUT_SECONDS` config'te var ama solver route bunlari kullanmiyor

**Alan:** Backend config consistency  
**Dosya/satir:** `backend/app/config.py:52-53`, `backend/app/scheduling/solver.py:13-14`, `backend/app/api/routes/generate.py`  
**Kanit:** Config `MAX_SCHEDULES_PER_JOB=50`, `JOB_TIMEOUT_SECONDS=300`; solver constants `MAX_DISCOVERED_LAYOUTS = 100`, `MAX_RETURNED_SCHEDULES = 20`. Route timeout kullanmiyor.  
**Production etkisi:** Operasyonel ayar var gibi gorunuyor ama davranisi degistirmiyor. Vercel/API host performans tuning'i yaniltici olur.  
**Onerilen fix:** Tek kaynak belirle. Ya config'i solver'a gecir, ya unused settings'i kaldir/dokumante et. Timeout icin request duration policy veya background job timeout ekle.  
**Dogrulama komutu:** `rg -n "MAX_SCHEDULES_PER_JOB|JOB_TIMEOUT_SECONDS|MAX_DISCOVERED_LAYOUTS|MAX_RETURNED_SCHEDULES" backend/app`

## P2-3. Frontend API rewrites ile actual fetch modeli uyumsuz

**Alan:** Vercel deployment/frontend architecture  
**Dosya/satir:** `frontend/next.config.js:7-11`, `frontend/app/lib/api.ts:1`, `frontend/app/scheduler/page.tsx:341-359`, `frontend/app/scheduler/page.tsx:1225-1252`  
**Kanit:** Next rewrite `/api/:path*` tanimli, fakat uygulama mutlak `${API_BASE_URL}/api/...` fetch ediyor.  
**Production etkisi:** Iki farkli API yonlendirme modeli var. CORS, proxy ve env debugging zorlasir.  
**Onerilen fix:** Vercel hedefi icin karar ver: relative `/api` + rewrite/proxy, veya absolute API domain + CORS. Ikisini ayni anda "ana yol" gibi tutma.  
**Dogrulama komutu:** `rg -n "rewrites|API_BASE_URL|fetch\\(\\`\\$\\{API_BASE_URL\\}" frontend/next.config.js frontend/app`

## P2-4. Error/not-found/SEO route dosyalari eksik

**Alan:** Frontend UX, production polish  
**Dosya/satir:** `frontend/app/`  
**Kanit:** `rg` route-level `error.tsx`, `global-error.tsx`, `not-found.tsx`, `robots`, `sitemap`, `openGraph` bulmadi; sadece basic metadata var. Next build default `/_not-found` uretiyor.  
**Production etkisi:** Runtime client/server hatalari ve 404'ler marka deneyimiyle uyumlu olmayabilir. Public landing SEO/paylasim zayif kalir.  
**Onerilen fix:** `app/error.tsx`, `app/not-found.tsx`, robots/sitemap ve openGraph/twitter metadata ekle. Admin/scheduler gibi private sayfalari index disi tut.  
**Dogrulama komutu:** `rg -n "error\\.tsx|not-found\\.tsx|global-error|robots|sitemap|openGraph|twitter" frontend/app frontend/public`

## P2-5. Modal focus trap/restore tamamlanmamis

**Alan:** Frontend accessibility  
**Dosya/satir:** `frontend/app/components/Modal.tsx:24-28`  
**Kanit:** Modal focus'u panel'e aliyor, ancak yorumda "Full focus trap + restore is TODO 2.5" yaziyor.  
**Production etkisi:** Klavye/screen reader kullanicilari modal acikken arka sayfaya kacabilir veya modal kapaninca onceki focus noktasina donemeyebilir.  
**Onerilen fix:** Focus trap, previous active element restore, Tab/Shift+Tab cycle ve aria-labelledby/aria-describedby standardini tamamla.  
**Dogrulama komutu:** `rg -n "Full focus trap|panelRef|focus|aria-modal" frontend/app/components/Modal.tsx`

## P2-6. Startup loglari emoji `print` ile Windows pipe altinda riskli

**Alan:** Backend operations/devex  
**Dosya/satir:** `backend/app/main.py:28-39`  
**Kanit:** Lifespan `print("🚀 ...")`, `print("🗄️ ...")` kullaniyor. Repo skill notlarinda Windows cp1252 pipe altinda `PYTHONUTF8=1` gerektirdigi kayitli.  
**Production etkisi:** Windows service/CI/background process altinda backend startup crash edebilir. Host Linux ise dusuk risk; yine de print yerine logger daha saglam.  
**Onerilen fix:** Emoji printleri stdlib logger'a cevir veya ASCII mesaj kullan. `start-dev.bat` icin `PYTHONUTF8=1` set et.  
**Dogrulama komutu:** `rg -n "print\\(" backend/app/main.py backend/app/models/database.py start-dev.bat`

## P2-7. FastAPI docs/redoc production'da kosulsuz acik

**Alan:** Security hardening  
**Dosya/satir:** `backend/app/main.py:46-47`  
**Kanit:** `docs_url="/docs"`, `redoc_url="/redoc"` kosulsuz.  
**Production etkisi:** Public API dokumantasyonu saldiri yuzeyini kesfetmeyi kolaylastirir. Kritik degil ama production hardening icin kapatilmasi veya basic auth/VPN arkasina alinmasi tercih edilir.  
**Onerilen fix:** Prod'da `docs_url=None`, `redoc_url=None`; staging/dev'de acik tut.  
**Dogrulama komutu:** `rg -n "docs_url|redoc_url|APP_ENV" backend/app/main.py backend/app/config.py`

## P2-8. Python surum dokumani runtime ile uyumsuz

**Alan:** Docs vs reality, DevEx  
**Dosya/satir:** `README.md:17`, `README.md:26`, `AGENTS.md:64`, `MAINTENANCE_PLAN.md:67`; runtime `Python 3.14.3`  
**Kanit:** Docs Python 3.12 diyor, aktif venv Python 3.14.3. Backend Dockerfile `python:3.12-slim` kullaniyor.  
**Production etkisi:** Lokal testler Python 3.14 ile, Docker/prod Python 3.12 ile farkli davranabilir. Ozellikle pydantic/SQLAlchemy/pytest ve datetime edge'lerinde surum farki hata saklayabilir.  
**Onerilen fix:** Desteklenen Python surumunu kararlastir. CI ve Docker ayni surumu kullansin. Dokumanlari bu gercekle guncelle.  
**Dogrulama komutu:** `cd backend; ..\.venv\Scripts\python.exe --version; rg -n "Python 3\\.12|python:3\\.12" README.md AGENTS.md MAINTENANCE_PLAN.md backend/Dockerfile`

## P2-9. README/backend README ve compose hala aspirational stack anlatiyor

**Alan:** Docs vs reality  
**Dosya/satir:** `README.md:8`, `README.md:24-40`, `README.md:79`, `backend/README.md:7-9`, `docker-compose.yml:19-50`  
**Kanit:** README multiple algorithms ve Docker Compose quick start iddia ediyor; backend README PostgreSQL/Redis/Celery diyor. Ana kod SQLite + sync-first. `README.md:79` LICENSE linki var ama repo kokunde LICENSE gorunmuyor.  
**Production etkisi:** Yeni dev veya deploy yapan kisi yanlis stack kurar; release runbook guvenilmez olur. LICENSE eksikligi dagitim/sahiplik kararini belirsizlestirir.  
**Onerilen fix:** README'yi Vercel + ayri FastAPI hedefiyle yeniden yaz: frontend env, backend env, SQLite path/backup, test komutlari, known limitations. LICENSE kararini netlestir.  
**Dogrulama komutu:** `rg -n "PostgreSQL|Redis|Celery|Multiple scheduling algorithms|Docker Compose|LICENSE|MIT" README.md backend/README.md docker-compose.yml`

## P2-10. Dependency CVE taramasi backend icin eksik

**Alan:** Security/dependency management  
**Dosya/satir:** `backend/requirements.txt`, local env  
**Kanit:** `pip check` temiz olsa da `pip-audit` kurulu degil (`No module named pip_audit`). `pip list --outdated` cok sayida paket icin daha yeni versiyon gosteriyor.  
**Production etkisi:** Python paketlerinde bilinen advisory olup olmadigi release gate'te gorunmez.  
**Onerilen fix:** CI'a `pip-audit` veya `uv pip audit` benzeri bir adim ekle. False positive policy ve allowlist dosyasi tanimla.  
**Dogrulama komutu:** `cd backend; ..\.venv\Scripts\python.exe -m pip_audit --version`

---

# P3 Polish/Backlog

## P3-1. Scheduler/results dosyalari hala cok buyuk

**Alan:** Frontend maintainability  
**Dosya/satir:** `frontend/app/scheduler/page.tsx`, `frontend/app/components/GeneratedSchedulesView.tsx`, `frontend/app/context/LanguageContext.tsx`  
**Kanit:** Dosya boyutlari yaklasik: scheduler `142 KB`, GeneratedSchedulesView `66 KB`, LanguageContext `41 KB`.  
**Production etkisi:** Dogrudan canli blocker degil; fakat kucuk UI degisikliklerinde regresyon riski ve review maliyeti yuksek.  
**Onerilen fix:** Once test ekle, sonra parca parca presentational component ve pure helper extraction. State tasimasini en sona birak.  
**Dogrulama komutu:** `Get-ChildItem -Recurse frontend/app -Include *.tsx,*.ts | Sort-Object Length -Descending | Select-Object -First 10 FullName,Length`

## P3-2. i18n hala tek buyuk context icinde

**Alan:** Frontend maintainability/i18n  
**Dosya/satir:** `frontend/app/context/LanguageContext.tsx`  
**Kanit:** Inline TR/EN metinleri buyuk context dosyasinda duruyor. `MAINTENANCE_PLAN.md` K2 JSON'a tasima kararini kaydetmis.  
**Production etkisi:** Eksik ceviri/parite hatalari build-time yakalanmaz; yeni ekran eklemek riskli.  
**Onerilen fix:** `frontend/app/locales/tr.json` ve `en.json` dosyalarina tasima; typed key check; `t("key")` API'sini koru.  
**Dogrulama komutu:** `Get-Item frontend/app/context/LanguageContext.tsx | Format-List Length`

## P3-3. Upload cleanup/retention policy gorunmuyor

**Alan:** Operations/data retention  
**Dosya/satir:** `backend/app/api/routes/upload.py:89-100`, `backend/app/api/routes/admin.py:60-66`  
**Kanit:** Uploaded files `uploads/` altina yaziliyor; TTL cleanup job/script gorunmuyor.  
**Production etkisi:** Public upload + admin upload zamanla disk sisirebilir. KVKK/data retention icin de saklama suresi net degil.  
**Onerilen fix:** Uploadlara TTL ve cleanup command ekle. Parse sonrasi DB'ye course JSON kaydediliyorsa raw upload dosyasini silmeyi degerlendir.  
**Dogrulama komutu:** `rg -n "UPLOAD_DIR|uploads|cleanup|ttl|unlink" backend/app backend/scripts`

## P3-4. Security headers ve CSP yok

**Alan:** Frontend/API hardening  
**Dosya/satir:** `frontend/next.config.js`, API reverse proxy config yok  
**Kanit:** `next.config.js` headers() tanimlamiyor.  
**Production etkisi:** XSS/clickjacking etkisini azaltacak default defense eksik. Vercel bazi headerlari saglasa da CSP uygulama seviyesinde tasarlanmalidir.  
**Onerilen fix:** `headers()` ile CSP, `X-Frame-Options` veya `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`; backend/reverse proxy icin HSTS.  
**Dogrulama komutu:** `rg -n "headers\\(|Content-Security-Policy|X-Frame-Options|Permissions-Policy" frontend/next.config.js backend`

---

# Kapanmis veya Eski Bulgular

Bu kisim, onceki raporlardaki stale TODO'larin aynen tasinmamasi icindir.

- **Normal upload path traversal ve filename riski kapanmis gorunuyor.** `upload.py` UUID dosya adi, `_FILE_ID_RE`, `.xlsx` allow-list, MIME ve size kontrolu kullaniyor (`upload.py:23-30`, `upload.py:68-94`, `upload.py:130`).
- **SECRET_KEY iki kaynak sorunu kapanmis.** Auth `settings.SECRET_KEY` kullaniyor; production validator default secret/admin degerlerini reddediyor (`config.py:92-99`). Gercek admin default credential yine ayri risk olarak yukarida duruyor.
- **Anonymous share'in admin user'a baglanmasi kapanmis.** `SavedSchedule.user_id` nullable ve anonymous share `user_id=None` olusturuyor (`database.py:56`, `schedules.py:33-36`).
- **Generate locked-slot/false-negative eski bulgusu buyuk olcude kapanmis.** Solver `locked_slots`, MRV/bitmask, diagnosis, variants ve score breakdown kullaniyor (`solver.py:978-989`, `solver.py:1032-1083`).
- **Frontend build artik geciyor.** Onceki `useSearchParams`/Suspense build problemi kapanmis; `npm run build` 12 route ile pass.
- **Toast aria-live eklenmis.** `Toast.tsx` `aria-live="polite"` ve error toast icin `role="alert"` kullaniyor.
- **Design parity kontrolu var ve geciyor.** `frontend/scripts/check-design-parity.mjs` `Design parity contract passed` dondurdu.

---

# Vercel + Ayri FastAPI Go-Live Checklist

## Cikis Oncesi Zorunlu

- [ ] Working tree temiz, release branch/PR hazir.
- [ ] `ruff check .` yesil.
- [ ] `npm audit --audit-level=high` policy karariyla yesil veya kabul edilmis exception dosyali.
- [ ] Saved schedule share IDOR kapali.
- [ ] Admin upload normal upload ile ayni sertlikte.
- [ ] Generate sonucu ya direct sync response ya persisted job store.
- [ ] Alembic migration ve SQLite backup/restore plan hazir.
- [ ] Vercel `NEXT_PUBLIC_API_URL` production env set.
- [ ] Backend `APP_ENV=production`, `DEBUG=false`, guclu `SECRET_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, gercek `CORS_ORIGINS` set.
- [ ] Backend API host TLS, process manager ve readiness probe ile yayinda.
- [ ] CI: backend pytest + ruff, frontend lint + build + design + dependency audit.

## Ilk Hafta

- [ ] Rate limiting.
- [ ] Frontend unit tests.
- [ ] Central API client / 401 handling.
- [ ] Error boundary ve branded not-found.
- [ ] Backend dependency audit.
- [ ] README + backend README + deployment runbook gercege uyarlandi.

