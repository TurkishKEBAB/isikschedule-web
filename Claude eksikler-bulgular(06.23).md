# IşıkSchedule — Eksikler & Bulgular (Production-Readiness Review)

**Tarih:** 2026-06-23 · **Kapsam:** Backend + Frontend + Infra/Deployment + Yasal/Uyumluluk
**Hazırlayan:** Claude · **Yöntem:** Kaynak kod + git durumu doğrulamalı inceleme
**Önceki dokümanlar:** `MAINTENANCE_PLAN.md` (Faz 0/0.5/1 ✅), `README.md`, `design-qa.md`

> **Doğrulama notu:** Bu rapor 3 keşif ajanının çıktısı **artı** gerçek kaynak kodu okuyarak yapılan
> doğrulamayla derlendi. Ajan çıktılarındaki birkaç hatalı iddia düzeltildi:
> - Global exception handler **log atıyor** (`main.py:95` `logger.exception`) — "log atmıyor" yanlıştı.
> - SECRET_KEY/admin için **production guard mevcut** (`config.py:87-101`) — koşulsuz blocker değil; git geçmişi sorunu yine de gerçek.
> - `create_admin_user` **sadece yoksa** oluşturuyor — "her başlangıçta sıfırlıyor" yanlıştı.
> - `requirements.txt` artık **UTF-8** ve bağımlılıklar **pinli** — "UTF-16" iddiası eskimişti.
> - `data.db` git'e **commit'li değil** (gitignore'da) — "commit'li" iddiası yanlıştı.
> - Backend Dockerfile **non-root user + healthcheck içeriyor** — "non-root yok" iddiası yanlıştı (frontend Dockerfile için doğru).

## Yönetici Özeti

Kod tabanı işlevsel ve Faz 1 güvenlik temizliği (SECRET_KEY tek kaynak, CORS, upload sertleştirme,
datetime, anonim share sahipliği) yapılmış durumda. Ancak **canlı, çok kullanıcılı bir üniversite
ürünü** olarak yayına almak için hâlâ **go-live blocker** seviyesinde eksikler var. Başlıca dört alan:

1. **Güvenlik:** Auth'suz IDOR endpoint'i, kaynak kodda/git geçmişinde gerçek admin şifresi, rate limiting yokluğu.
2. **Mimari/ölçeklenebilirlik:** Bellek içi senkron generate (çoklu worker'da bozulur), migration yok, backup yok.
3. **Deployment:** Frontend prod imajı `npm run dev` çalıştırıyor, CI yalnızca CodeQL, production start mekanizması yok.
4. **Yasal:** KVKK aydınlatma/gizlilik metni, veri silme/dışa aktarma ve LICENSE yok (öğrenci verisi işleniyor).

**Sayım:** Kritik (blocker): 8 · Yüksek: 11 · Orta: 13 · Düşük: 10

> Önem dereceleri: **Kritik** = canlıya çıkmadan mutlaka · **Yüksek** = ilk hafta · **Orta** = ilk ay · **Düşük** = fırsat buldukça.

---

## A. Güvenlik & Kimlik Doğrulama

### A1. [KRİTİK] Auth'suz IDOR — başka kullanıcıların kayıtlı programlarına erişim
- **Yer:** `backend/app/api/routes/schedules.py:47-62` (`POST /api/schedules/share/{schedule_id}`) + `:65-80` (`GET /api/shared/{share_code}`)
- **Sorun:** `share_schedule` endpoint'inde **hiç auth yok**. Saldırgan `schedule_id` (artan integer) ile enumerate edip herhangi bir kayıtlı programa `share_code` üretebilir; `/shared/{code}` de auth'suz olduğu için içeriği (kurslar, isim) okunur. Sahiplik kontrolü (`schedule.user_id == current_user.id`) yok.
- **Neden önemli:** Doğrudan yetkisiz veri erişimi (IDOR / privacy ihlali). KVKK açısından da risk.
- **Düzeltme yönü:** `Depends(get_current_user)` ekle + sahiplik doğrula; ya da bu endpoint frontend'de kullanılmıyorsa kaldır.

### A2. [KRİTİK] Gerçek admin parolası kaynak kodda ve git geçmişinde
- **Yer:** `backend/app/config.py:12-13` (`DEFAULT_ADMIN_EMAIL = "23soft1040@isik.edu.tr"`, `DEFAULT_ADMIN_PASSWORD = "yigit12okur1212"`)
- **Sorun:** Gerçek bir öğrenci e-postası ve düz-metin parola repo'da ve tüm git geçmişinde. Production guard (`config.py:87-101`) `APP_ENV in {production,prod}` iken default'ları reddediyor (iyi) — **ama** (a) `APP_ENV` yanlış/eksik set edilirse default devreye girer, (b) parola git geçmişinden kalıcı olarak okunabilir.
- **Neden önemli:** Sızmış kimlik bilgisi; parola rotate edilmeli ve geçmişten temizlenmeli.
- **Düzeltme yönü:** Default'ları anlamsız placeholder yap (gerçek değer değil), parolayı **rotate et**, git geçmişini temizle (BFG/filter-repo), prod'da `.env` zorunlu.

### A3. [KRİTİK] Rate limiting hiç yok (brute-force / DoS)
- **Yer:** `auth.py` (login/register), `upload.py` (`/upload`), `generate.py` (`/generate`). `RATE_LIMIT_PER_MINUTE` ayarı (`config.py:49`) **tanımlı ama hiçbir yerde kullanılmıyor** (kod tabanında `slowapi`/limiter yok).
- **Sorun:** `/api/auth/login` parola deneme sınırı yok; 7 günlük token saldırgana bolca zaman verir. `/upload` ve `/generate` (CPU-yoğun) auth'suz ve sınırsız.
- **Neden önemli:** Kimlik bilgisi brute-force ve kaynak tüketimi (DoS).
- **Düzeltme yönü:** `slowapi` ile login/register/upload/generate'a IP başına limit; tercihen başarısız login için exponential backoff.

### A4. [YÜKSEK] Token iptali / gerçek logout yok, 7 gün token
- **Yer:** `auth.py:137-140` (`logout` no-op), `config.py:33` (`ACCESS_TOKEN_EXPIRE_MINUTES = 7 gün`)
- **Sorun:** Logout yalnızca client tarafında token siliyor; sunucuda blacklist/revocation yok. Çalınan token süresi dolana dek (7 gün) geçerli.
- **Düzeltme yönü:** Token süresini kısalt (örn. 1 saat) + refresh token; ya da `jti` tabanlı revocation listesi.

### A5. [YÜKSEK] `/upload` ve `/upload/{file_id}/courses` auth'suz
- **Yer:** `upload.py:57`, `upload.py:127`
- **Sorun:** Kimlik doğrulama yok; anonim kullanıcı dosya yükleyip parse ettirebilir (kaynak tüketimi, disk dolması).
- **Not:** Path traversal (`_FILE_ID_RE`), uzantı/MIME allow-list ve boyut kontrolü **var** (iyi) — ama auth eksikliği abuse'a açık.
- **Düzeltme yönü:** `Depends(get_current_user)` ekle veya en az rate limit + otomatik temizlik.

### A6. [ORTA] Register'da kullanıcı enumeration + zayıf parola politikası
- **Yer:** `auth.py:67-71` ("Email already registered"), `auth.py:59` (min 6 karakter)
- **Sorun:** Register, e-postanın kayıtlı olup olmadığını sızdırır. Parola min 6, karmaşıklık/zayıf-parola kontrolü, e-posta doğrulama ve parola sıfırlama akışı yok.
- **Düzeltme yönü:** Min 8-12 karakter; e-posta doğrulama; "şifremi unuttum" akışı; enumeration'ı azalt.

### A7. [ORTA] `share_id` kısaltılmış UUID (zayıf entropi)
- **Yer:** `schedules.py:30,55` (`str(uuid.uuid4())[:16]`)
- **Sorun:** 16 hex (~64 bit) ve A1 ile birleşince paylaşılan linkler enumerate edilebilir.
- **Düzeltme yönü:** `secrets.token_urlsafe(16)` veya tam UUID.

### A8. [ORTA] Güvenlik header'ları yok (CSP / X-Frame-Options / HSTS)
- **Yer:** `frontend/next.config.js` (headers yok), `backend/app/main.py` (HTTPS/HSTS zorlaması yok)
- **Düzeltme yönü:** `next.config.js` `headers()` ile CSP, `X-Frame-Options: DENY`, HSTS; ya da reverse-proxy (nginx) katmanında.

### A9. [DÜŞÜK] `/docs` ve `/redoc` production'da açık
- **Yer:** `main.py:46-47` (`docs_url="/docs"` koşulsuz)
- **Düzeltme yönü:** Prod'da `docs_url=None if not settings.DEBUG else "/docs"`.

---

## B. Veri Kalıcılığı & Veritabanı

### B1. [KRİTİK] DB migration yok (yalnız `create_all()`)
- **Yer:** `database.py:112-115` (`Base.metadata.create_all`)
- **Sorun:** Şema değişiminde versiyonlu migration/rollback yok. Mevcut on-disk `data.db`, Faz 1.5'teki `user_id` nullable değişikliğini almamış olabilir (yalnızca yeni DB'lerde geçerli). Alembic kurulu değil.
- **Neden önemli:** Canlıda şema değişikliği = elle SQL, downtime ve veri tutarsızlığı riski.
- **Düzeltme yönü:** Alembic kur (`MAINTENANCE_PLAN` B13), başlangıçta `upgrade head`.

### B2. [KRİTİK] Backup stratejisi yok
- **Yer:** Tek `data.db` (SQLite). Backup script/cron/uzak kopya yok.
- **Neden önemli:** Docker volume kalıcı değilse veya dosya bozulursa **tüm kullanıcı/şema verisi kaybolur** (öğrenci verisi — KVKK).
- **Düzeltme yönü:** Zamanlanmış yedek (`sqlite3 .backup` + offsite/S3), saklama politikası, restore testi.

### B3. [YÜKSEK] Friendship benzersizlik kısıtı ve cascade delete yok
- **Yer:** `database.py:69-86` (Friendship — `UniqueConstraint(user_id, friend_id)` yok), FK'ler `ondelete` tanımsız (`:56,74-75,95`)
- **Sorun:** Çift/çelişen arkadaşlık kayıtları DB seviyesinde engellenmiyor; kullanıcı silinirse yetim kayıtlar.
- **Düzeltme yönü:** `UniqueConstraint` ekle; FK'lere `ondelete` stratejisi (CASCADE/SET NULL); migration ile.

### B4. [ORTA] Sık sorgulanan kolonlarda index eksik
- **Yer:** `database.py` — `email`/`share_id` indexli; `GlobalCourse.is_active`, `Friendship.status`, `SavedSchedule.user_id` indexsiz.
- **Düzeltme yönü:** Filtrelenen kolonlara `index=True` (veri büyüdükçe önem kazanır).

### B5. [ORTA] SQLite tek-düğüm yazma kilidi
- **Yer:** `database.py:18-22` (SQLite + `check_same_thread=False`)
- **Not:** K1 kararı gereği sync-first SQLite kabul edilmiş; üniversite ölçeği için makul. Yine de yoğun eşzamanlı yazımda kilitlenme riski — beklenen yük ölçülmeli, gerekiyorsa Postgres (B2 backlog).

---

## C. Generate Akışı / Mimari

### C1. [KRİTİK] Bellek içi senkron JOBS — çoklu worker'da bozulur, restart'ta kaybolur
- **Yer:** `generate.py:43` (`JOBS: dict`), `:138-175` (`start_generation` `run_job`'ı **senkron** çağırıyor), `:179` (`/jobs/{id}` JOBS'tan okuyor)
- **Sorun:** (a) Sonuçlar süreç belleğinde; **restart = kayıp**. (b) Gunicorn/çoklu worker'da her worker'ın kendi JOBS'u olur → `/jobs/{id}` farklı worker'a düşerse **404**. (c) `start_generation` istek thread'inde senkron hesaplıyor (büyük girdide uzun blok).
- **Neden önemli:** Production'da tek worker'a mahkûm; "fake async" polling UI ile tutarsız.
- **Düzeltme yönü:** `MAINTENANCE_PLAN` Faz 2.1 kararı — ya gerçek senkron yanıt (polling kaldır) ya da DB-backed job tablosu. Çoklu worker hedefleniyorsa zorunlu.

### C2. [ORTA] Excel parser dayanıklılığı — hatalı satırların sessizce atlanması
- **Yer:** `backend/app/core/excel_loader.py` (parse döngüsü) — *audit bulgusu, kod üzerinde teyit edilmeli*
- **Sorun:** Bozuk/eksik satırlar sessizce atlanırsa eksik veriyle yayına çıkılabilir.
- **Düzeltme yönü:** Atlanan satır sayısını/nedenini raporla; eşik üstünde upload'ı reddet; edge-case test fixture'ları (Faz 2.5).

### C3. [ORTA] README'deki çoklu algoritma vaadi gerçekleşmiyor
- **Yer:** `README.md:8`, `generate.py:49` (`algorithm` param alınıyor ama yok sayılıyor)
- **Düzeltme yönü:** README'yi gerçekle hizala (K7) veya param'ı kaldır.

---

## D. Hata Yönetimi & Gözlemlenebilirlik

### D1. [YÜKSEK] Yapılandırılmış log + hata izleme (Sentry) yok
- **Yer:** `main.py:17-20` (`logging.basicConfig`, stderr), Sentry/DataDog yok
- **Not:** Global handler **log atıyor** (`main.py:95`) — bu iyi. Ancak structured/aranabilir log ve hata uyarısı yok; `.env.example` `DEBUG=true` default.
- **Düzeltme yönü:** JSON logging, prod'da `DEBUG=false`, Sentry DSN (opsiyonel ama önerilir), erişim/audit log.

### D2. [YÜKSEK] Readiness probe gerçek kontrol yapmıyor
- **Yer:** `health.py:27-31` (`/health/ready` → her zaman `{"ready": True}`, TODO)
- **Sorun:** DB erişilemese bile orchestrator trafiği yönlendirir.
- **Düzeltme yönü:** `SELECT 1` ile DB kontrolü, upload dizini yazılabilirliği; başarısızsa 503.

### D3. [ORTA] Admin işlemleri için audit log yok
- **Yer:** `admin.py` — semester aktivasyon/upload/kullanıcı listeleme loglanmıyor.
- **Düzeltme yönü:** Kim/ne/ne zaman audit kaydı (KVKK izlenebilirlik).

---

## E. Frontend

### E1. [YÜKSEK] Error boundary yok (`error.tsx` / `global-error.tsx`)
- **Yer:** `frontend/app/` altında yok
- **Sorun:** Bir component throw ederse (örn. ~2700 satırlık `scheduler/page.tsx`) kullanıcı boş/bozuk sayfa görür.
- **Düzeltme yönü:** `app/error.tsx` + kritik bölümlerde yerel hata durumları; `not-found.tsx`.

### E2. [YÜKSEK] `NEXT_PUBLIC_API_URL` set edilmezse prod'da localhost'a düşer
- **Yer:** `frontend/app/lib/api.ts:1`, `frontend/next.config.js:5,11` (fallback `http://localhost:8000`)
- **Sorun:** Env unutulursa frontend sessizce localhost'a istek atar ve kırılır; runtime/build doğrulaması yok. Ayrıca kod absolute `API_BASE_URL` kullandığından `next.config.js` `rewrites` fiilen devre dışı → CORS'a bağımlı.
- **Düzeltme yönü:** Prod'da env zorunlu (yoksa build/başlangıçta hata); ya relative `/api` proxy'ye geç ya da CORS'u domaine göre ayarla.

### E3. [YÜKSEK] JWT localStorage'da (XSS exfiltrasyon riski)
- **Yer:** `context/AuthContext.tsx:33-39,60-61,88-89`
- **Sorun:** Token + user (rol dahil) localStorage'da; XSS ile çalınabilir. `RequireAuth` yalnızca **client-side** yönlendirme (`AuthContext.tsx:126-153`) — rol UI'da localStorage'dan okunuyor.
- **Not:** Backend yetkilendirmesi `get_current_admin` ile **sunucuda** zorlanıyor (iyi) → rol sahteciliği yalnızca kozmetik UI etkisi yapar, gerçek yetki yükseltmesi değil.
- **Düzeltme yönü:** httpOnly secure cookie'ye geçiş (backend değişikliği); en azından 401/403'te otomatik logout interceptor'ı.

### E4. [ORTA] 401/403 merkezi yönetimi yok, dağınık fetch + boş catch
- **Yer:** `admin/page.tsx`, `scheduler/page.tsx`, `shared/[id]/page.tsx` vb. — her sayfa kendi `fetch`'i; token süresi dolunca login'e yönlendirme yok; bazı `catch {}` detayları yutuyor.
- **Düzeltme yönü:** Merkezi API client (Faz 3.1): auth header + 401→logout + hata normalizasyonu.

### E5. [ORTA] i18n anahtar paritesi build-time garanti değil + `lang` sabit
- **Yer:** `context/LanguageContext.tsx` (tr/en inline), `layout.tsx:23` (`lang="tr"` sabit)
- **Düzeltme yönü:** Tip güvenli çeviri (eksik anahtar derlemede yakalansın); `lang`'i dile göre dinamik yap.

### E6. [ORTA] SEO/paylaşım: robots.txt, sitemap, OG image yok
- **Yer:** `frontend/public/` + `layout.tsx:8-15` (OG/twitter meta yok)
- **Düzeltme yönü:** Public sayfalar için OG image + robots; özel rotaları (`/admin`,`/scheduler`...) indekslemeden çıkar.

### E7. [DÜŞÜK] Kullanılmayan `axios` bağımlılığı
- **Yer:** `frontend/package.json` — tüm çağrılar native `fetch`; `axios` import edilmiyor.
- **Düzeltme yönü:** Kaldır (bundle).

---

## F. Deployment / Infra / CI

### F1. [KRİTİK] Frontend production imajı geliştirme sunucusu çalıştırıyor
- **Yer:** `frontend/Dockerfile:16,20` (`ENV NODE_ENV=development`, `CMD ["npm","run","dev"]`)
- **Sorun:** Prod'da `next dev` — optimizasyon yok, source map'ler açık, yük altında dayanıksız, modül hatasında çöker.
- **Düzeltme yönü:** Multi-stage build → `next build` + `next start` (veya `standalone`), `NODE_ENV=production`, non-root user, healthcheck, `.dockerignore`.

### F2. [KRİTİK] `docker-compose.yml` çalışmaz (aspirational Postgres/Redis/Celery)
- **Yer:** `docker-compose.yml:1-69` — `DATABASE_URL=postgresql+asyncpg://...`, `celery -A app.tasks worker`, Redis. Kod SQLite + bellek içi; `asyncpg/psycopg/celery/redis` **requirements'ta yok**, `app.tasks` boş.
- **Sorun:** `docker-compose up` başarısız olur; README "Docker Compose ile çalıştır" diyor → yanıltıcı.
- **Düzeltme yönü:** SQLite + backend + frontend'e sadeleştir (K1) veya "aspirational" notuyla backlog'a al.

### F3. [KRİTİK] Yalnızca CodeQL CI — test/lint/build PR'da çalışmıyor
- **Yer:** `.github/workflows/` → sadece `codeql.yml`
- **Sorun:** Backend pytest, ruff, frontend lint/build PR'da koşmuyor → bozuk kod master'a girebilir.
- **Düzeltme yönü:** `backend-test.yml` (pytest + ruff) ve `frontend.yml` (lint + build) ekle; mümkünse coverage eşiği.

### F4. [YÜKSEK] Production başlatma mekanizması yok
- **Yer:** `start-dev.bat` (Windows-only, `--reload`), `backend/Dockerfile:30` (tek uvicorn worker)
- **Sorun:** Gunicorn/worker yönetimi, graceful shutdown, Unix start script yok. Tek worker yük altında istekleri seri işler.
- **Not:** Tek-worker + C1 (bellek içi JOBS) birlikte ele alınmalı (çoklu worker JOBS'u bozar).
- **Düzeltme yönü:** `gunicorn -k uvicorn.workers.UvicornWorker` config'i (C1 çözülünce çoklu worker), `start.sh`, systemd/process manager.

### F5. [ORTA] Reverse proxy / TLS / domain kurgusu tanımsız
- **Yer:** CORS `localhost` defaultları (`config.py:46`), frontend localhost fallback (E2)
- **Düzeltme yönü:** nginx/Caddy ile TLS sonlandırma + `/api` proxy; prod CORS = gerçek domain; HTTPS yönlendirme.

### F6. [DÜŞÜK] `.dockerignore`, Unix start script, `pytest-cache` ACL kilidi, kullanılmayan `REDIS_URL`
- **Yer:** repo geneli — küçük DevEx/hijyen iyileştirmeleri.

---

## G. Yasal & Uyumluluk (Türkiye / üniversite bağlamı)

### G1. [KRİTİK] KVKK aydınlatma/gizlilik metni ve açık rıza yok
- **Yer:** Repo'da gizlilik politikası / KVKK aydınlatma metni / çerez bildirimi yok. Toplanan: e-posta, parola hash, ders programı, arkadaşlık bağları.
- **Neden önemli:** KVKK, veri toplamadan önce aydınlatma zorunlu kılar; canlı öğrenci ürünü için yasal blocker, idari para cezası riski.
- **Düzeltme yönü:** Gizlilik Politikası + Kullanım Şartları (TR), veri sorumlusu/iletişim, saklama süreleri; UI'da link.

### G2. [KRİTİK] Veri silme / dışa aktarma (KVKK madde 11) endpoint'i yok
- **Yer:** `DELETE /api/user/me` veya veri-export yok.
- **Düzeltme yönü:** Hesap + ilişkili veriyi silme ve kişisel veri dışa aktarma uçları.

### G3. [KRİTİK] LICENSE dosyası yok
- **Yer:** Repo kökünde `LICENSE` yok; `README.md:79` "MIT License - See [LICENSE]" diyor → **kırık link**.
- **Düzeltme yönü:** Sahiplik kararına göre LICENSE ekle (MIT mi, üniversite mülkiyeti mi netleştir).

---

## H. Repo Hijyeni & Dokümantasyon

### H1. [DÜŞÜK] Commit'li gereksiz/geçici dosyalar
- **Yer (git-tracked):** `competitor-coursicle-planner.png`, `competitor-mystudylife-login.png`, `login-current-desktop.png`, `login-current-mobile.png`, `fix_excel.py`, `fix_generate.py`, `tmp-scheduler-shot.mjs`, `tmp-seed-shot.mjs`, `test.txt`
- **Düzeltme yönü:** `git rm` + `.gitignore` kuralları. (Not: `data.db` zaten **gitignore'da, commit'li değil** — iyi.)

### H2. [DÜŞÜK] Kök dizinde dağınık dokümantasyon
- **Yer:** Kökte 15+ `.md` (`AGENTS.md`, `FRONTEND_UI_UX_TODO.md`, `kombai-ui-prompt.md`, `new features.md`, `results-*.md` — `results-gemini-review.md` **boş**, `ROADMAP.md`...).
- **Düzeltme yönü:** `docs/` altına taşı; kökte yalnızca README/MAINTENANCE_PLAN/CLAUDE.md kalsın.

### H3. [ORTA] README gerçeği yansıtmıyor
- **Yer:** `README.md` — Docker Compose quick-start (F2 ile çalışmaz), "Multiple algorithms" (C3), `algorithms/`+`tests/` proje ağacı kodla uyuşmuyor.
- **Düzeltme yönü:** K7 — gerçek stack (FastAPI+SQLite+Next, sync-first, Windows dev script) ile yeniden yaz.

### H4. [DÜŞÜK] Bağımlılık denetimi (pip-audit) ve ağır `pandas`
- **Yer:** `requirements.txt` — `python-jose` geçmiş CVE'leri için denetim yok; `pandas==3.0.2` yalnız Excel için ağır (zaten `openpyxl` var).
- **Düzeltme yönü:** CI'da `pip-audit`; pandas gerçekten gerekmiyorsa kaldırmayı değerlendir.

---

## I. Test Kapsamı

### I1. [YÜKSEK] Frontend testi yok
- **Yer:** `frontend/` — Vitest/Jest config ve test dosyası yok (K3 Vitest kararı uygulanmamış).
- **Düzeltme yönü:** Vitest + RTL; kritik akışlar (login, generate, share).

### I2. [ORTA] Backend testleri yalnızca smoke, CI'da koşmuyor
- **Yer:** `backend/tests/` (auth/upload/generate/shared smoke). Yetki (IDOR), rate limit, excel edge-case, friends akışı kapsanmıyor; CI'da çalışmıyor (F3).
- **Düzeltme yönü:** Faz 4 kapsamını uygula; A1 için regresyon testi ekle.

### I3. [DÜŞÜK] Uncommitted working tree (20+ dosya)
- **Yer:** `git status` — modified backend/frontend dosyaları + untracked (`BrandLogo.tsx`, `public/brand/`, `scripts/`, `docs/...`).
- **Düzeltme yönü:** K5 — snapshot branch + mantıksal commit'ler.

---

## Önceliklendirilmiş Yol Haritası

### Aşama 1 — Go-Live Blocker'ları (canlıdan ÖNCE)
1. A2 admin parolasını rotate et + git geçmişini temizle; A1 IDOR'u kapat/kaldır; A3 rate limiting.
2. A5 `/upload` auth/rate limit.
3. B1 Alembic migration + B2 backup stratejisi.
4. C1 generate mimarisi kararı (sync yanıt veya DB job tablosu) — çoklu worker hedefiyle uyumlu.
5. F1 frontend prod Dockerfile; F2 docker-compose sadeleştir; F3 CI (test/lint/build).
6. G1/G2/G3 KVKK metinleri + veri silme/export + LICENSE.

### Aşama 2 — İlk Hafta (Yüksek)
A4 token/logout · D1 logging+Sentry+`DEBUG=false` · D2 readiness · E1 error boundary · E2 API URL zorunlu · E3 401/403 logout · F4 gunicorn+start script · B3 friendship kısıtları · I1 frontend test.

### Aşama 3 — İlk Ay (Orta)
A6/A7/A8/A9 · B4/B5 · C2/C3 · D3 · E4/E5/E6 · F5 · H3 · I2.

### Aşama 4 — Fırsat Buldukça (Düşük)
E7 · F6 · H1/H2/H4 · I3.

---

## Go-Live Checklist
- [ ] `.env`: `APP_ENV=production`, güçlü `SECRET_KEY`, `ADMIN_*` set; `DEBUG=false`; gerçek `CORS_ORIGINS`.
- [ ] Admin parolası rotate edildi; git geçmişi temizlendi.
- [ ] IDOR (A1) kapandı; `/upload` korundu; rate limiting aktif.
- [ ] Alembic migration + otomatik yedek + restore testi.
- [ ] Generate çoklu-worker uyumlu (C1).
- [ ] Frontend prod build imajı; CI yeşil (pytest+ruff+lint+build).
- [ ] HTTPS/TLS + reverse proxy + güvenlik header'ları.
- [ ] KVKK aydınlatma/gizlilik + veri silme/export + LICENSE.
- [ ] `/health/ready` gerçek kontrol; logging+hata izleme; error boundary.
- [ ] Repo hijyeni (gereksiz dosyalar temizlendi, working tree commit'lendi).

---

## Ek: Nasıl yeniden doğrulanır (komutlar)
```powershell
# Rate limiting gerçekten yok mu?
git -C . grep -n "slowapi"            # yalnız MAINTENANCE_PLAN.md çıkmalı
# IDOR endpoint auth'suz mu?
#   schedules.py:47 share_schedule -> Depends(get_current_user) YOK
# data.db commit'li mi? (boş çıktı = değil)
git ls-files data.db backend/data.db
# CI workflow'ları
ls .github/workflows                  # yalnız codeql.yml
```
