# Kombai Prompt — IşıkSchedule "Living / Next-Gen" UI/UX Redesign

> Bu dosya, Kombai'ye verilecek hazır promptu içerir. Aşağıdaki **PROMPT** bloğunu kopyalayıp Kombai'ye yapıştır.
> Brief Türkçe yazıldı; teknik token/dosya/kütüphane adları koddaki gerçek değerlerle İngilizce bırakıldı.

---

## PROMPT (Kombai'ye yapıştır)

Sen kıdemli bir product designer + frontend mühendisisin. Mevcut bir Next.js uygulamasının arayüzünü
**radikal biçimde yenileyeceksin**. Hedef: IşıkSchedule'ı sadece bir ders programı aracı değil, Işık
Üniversitesi'nin ileride **markalaşabileceği, "canlı gibi görünen, yeni nesil, hareketli ve cazibesiyle
etkileyen" premium bir ürün** haline getirmek. "Gelişmişlik" hissi her ekranda hissedilmeli.

### 0) Yaratıcı yön (en önemli kısım) — "Aurora Gradient / Living"
- **Akan, canlı animasyonlu gradient-mesh arka planlar**: marka spektrumunda **mavi → indigo/mor → altın**
  yumuşak geçişlerle nefes alan, yavaşça hareket eden zemin. Tab gizliyken animasyonu duraklat.
- **Frosted glass (buzlu cam) yüzeyler**, katmanlı blur ile derinlik, yumuşak glow ve gradient kenarlıklar.
- **Micro-interaction her yerde**: hover'da hafif yükselme/parıltı, "magnetic" butonlar, yaylı (spring)
  geçişler, sayı/score **count-up** animasyonları, yükleme sırasında shimmer/skeleton.
- **Scroll-driven reveal** (landing'de): parallax, staggered fade/slide, ortaya çıkan kartlar.
- Premium ipuçları: ince noise/grain dokusu, güvenli geniş boşluk, iri kendinden emin tipografi, glassy nav.
- Tutarlı bir **motion dili** kur: süre/easing'leri token olarak tanımla (örn. `--ease-spring`, `--dur-fast/med/slow`).
- Koyu tema **öncelikli** (dark-first). Token'ları ileride light tema eklenebilecek şekilde mimari kur ama buna takılma.

### 1) Sıkı teknik kısıtlar (bozma)
- Stack sabit: **Next.js 14 App Router + React 18 + TypeScript + TailwindCSS 3.4**. Farklı framework/CSS-in-JS ekleme.
- **Mevcut design token'larını yeniden kullan ve genişlet** (yeni paralel sistem kurma):
  - `frontend/tailwind.config.js` ve `frontend/app/globals.css` içinde tanımlı:
    `isik-blue` (#0018A8, light #1E40AF, lighter #3B82F6, dark #001080), `isik-gold` (#F59E0B, light #FCD34D),
    `surface` 900→600 (#0F172A…#475569), semantic (success/warning/error/info),
    ders tipi renkleri (lecture #3B82F6, lab #8B5CF6, ps #10B981).
  - Yeni aurora renkleri, gradient utility'leri ve motion easing/duration token'larını **bu dosyalara** ekle.
  - Mevcut `.glass-panel`, `.btn*`, `.badge*`, `.input-field`, custom scrollbar ve **print** stillerini koru/iyileştir.
- İkonlar: **lucide-react** (zaten kurulu). Class birleştirme: **clsx**. Yeni ikon/util kütüphanesi getirme.
- **i18n zorunlu**: tüm kullanıcıya görünen metinler `frontend/app/context/LanguageContext.tsx` içindeki
  inline **tr/en** sözlüğünden gelir. Yeni metin eklerken hem `tr` hem `en` anahtarını ekle; **string hardcode etme**.
- **Yalnızca UI/etkileşim katmanı**: backend, API sözleşmeleri ve veri alan adlarını (**`main_code`, `type`,
  `schedule`, `ects`**) değiştirme. İş mantığını yeniden yazma; state akışını koru.
- Animasyon için **tek yeni bağımlılık**: `framer-motion` (veya `motion`) eklenebilir.
- **Erişilebilirlik & performans**:
  - `prefers-reduced-motion` desteği zorunlu (animasyonları kıs/kapat).
  - 60fps hedefle: sadece `transform`/`opacity` ile animasyon, GPU-dostu, scroll reveal'larda IntersectionObserver.
  - Renk + **renk-dışı ipucu** (renk körlüğü), klavye navigasyonu, mevcut `focus-visible` ring'lerini koru, dark'ta AA kontrast.
  - **Print/export'u bozma**: `.print-area`, `.no-print` class'ları ve PDF/iCal export'un dayandığı DOM korunmalı.

### 2) Kapsam — sadece şu 3 yüzey (Auth/Admin bu turda HARİÇ)

**A) Landing + onboarding — `frontend/app/page.tsx` (en çok "wow" serbest)**
- Animasyonlu aurora + **kinetik başlık** olan bir hero; net birincil CTA (yükle / scheduler'a git).
- "Nasıl çalışır" 3 adım, scroll reveal ile.
- **Canlı dolan bir örnek haftalık grid önizlemesi** (dersler kendiliğinden yerleşiyormuş gibi) — asıl "canlı gibi" anı.
- Özellik vitrini / sosyal kanıt bandı, glassy sticky nav (dil değiştirici + ileride tema toggle yeri).

**B) Scheduler — `frontend/app/scheduler/page.tsx` (çekirdek araç; ~2000 satır, ağır state)**
- Kabuğu, ders listesini, seçim chip'lerini, **haftalık grid'i** ve üretim/tercih panelini yeniden tasarla.
- **Tüm mevcut işlevsellik ve state aynen korunur** — sadece görsel/etkileşim katmanı.
- Motion: ders ekle/çıkar'da layout animasyonu, grid hücrelerinin akıcı girişi, kilitli/bloklu durumlar için
  net görsel dil, "Programı Oluştur" butonunda tatmin edici loading durumu.
- **Performans burada kritik**: ölçülü, GPU-dostu motion; çok sayıda section'da jank olmamalı; memoize/virtualize gerekiyorsa uygula.

**C) Results / program kartları — `frontend/app/results/page.tsx` (+ paylaşılan kart bileşenleri)**
- Gradient kenarlıklı **premium program kartları**; score/ECTS/çakışma rozetleri **count-up** ile.
- Hover önizleme, **karşılaştır/favori** afford'ları, akıcı giriş animasyonları.
- Paylaşılabilir kart "ekran görüntüsü almaya değer" görünmeli (ileride PNG export ile uyumlu).

### 3) Nasıl çalış (deliverable beklentisi)
- Token sistemini `tailwind.config.js` + `globals.css` üzerinden **genişlet**, paralel sistem kurma.
- Yeniden kullanılabilir primitive'ler çıkar (`frontend/app/components/` altında):
  örn. `AuroraBackground`, `GlassCard`, `GradientButton`, `AnimatedBadge`, `ScheduleGrid`, `RevealOnScroll`.
- Değişiklikleri **artımlı ve review-dostu** tut; iş mantığını yeniden yazma.
- Mümkünse kısa bir stil rehberi / önizleme bölümü bırak.

### 4) Bitti kriterleri (checklist)
- [ ] Dark-first, marka renklerine (isik-blue/gold) demirli, tutarlı motion dili
- [ ] Landing + Scheduler + Results yenilendi; Auth/Admin'e dokunulmadı
- [ ] Tüm yeni metinler tr/en; hiçbir string hardcode değil
- [ ] `prefers-reduced-motion` destekli, 60fps, GPU-dostu
- [ ] API sözleşmeleri / veri alan adları (`main_code`/`type`/`schedule`/`ects`) değişmedi
- [ ] Print + PDF/iCal export bozulmadı
- [ ] `npm run build` ve `npm run lint` temiz geçiyor

### Out of scope
Backend, veri sözleşmeleri, Auth/Admin ekranları, scheduling algoritması.

---

## EK — Animasyon & Performans Bütçesi (sayısal, prompta dahil et)

> "Hareketli/canlı" isteği abartılıp jank üretmesin diye somut sınırlar. Bunu da Kombai'ye ver.

**Global motion token'ları (kesin değerler):**
- Süre: `--dur-fast 150ms`, `--dur-med 250ms`, `--dur-slow 450ms`. Hiçbir UI geçişi > 600ms olmasın.
- Easing: `--ease-out: cubic-bezier(0.16,1,0.3,1)`, spring için framer-motion `type:"spring", stiffness 300, damping 30`.
- **Yalnızca `transform` ve `opacity`** animasyonu. `width/height/top/left/margin` ve büyük alanlarda `box-shadow/filter blur` animasyonu YASAK (layout/paint tetikler).
- `will-change` sadece aktif animasyon süresince; sürekli bırakma.

**Aurora arka plan (zemin):**
- Tercihen **saf CSS** (gradient + `@keyframes` ile `background-position`/`transform`), JS/canvas değil. Viewport başına **en fazla 1** animasyonlu aurora katmanı.
- Yavaş döngü (≥ 12s), compositor-only. `document.hidden` olduğunda **duraklat** (visibilitychange). `prefers-reduced-motion` → tamamen statik gradient.
- Idle'da hedef **CPU < %5**, sürekli full-viewport repaint yok.

**Landing (`page.tsx`):**
- Scroll reveal: **IntersectionObserver**, her öğe **tek seferlik** (animate-once), stagger ≤ 60ms, süre 200–450ms.
- "Canlı dolan grid" önizlemesi: sahne bir kez oynar, sonra durur; sonsuz döngüye sokma.

**Scheduler (`scheduler/page.tsx`) — en katı:**
- Grid'in **arkasında ambient/loop animasyon YOK** (statik veya çok hafif). Aurora'yı buraya taşıma.
- Layout animasyonu **sadece** ders ekle/çıkar/kilitle anında (`AnimatePresence`), süre ≤ 200ms. **Her re-render'da hücre giriş animasyonu yok.**
- Grid hücrelerini `memo` ile sabitle; section sayısı çoksa (örn. > 40 görünür hücre) layout animasyonunu otomatik kapat.
- Etkileşim hedefi: **INP < 200ms**, ana thread'de > 50ms long task yok.

**Results (`results/page.tsx`):**
- Kart girişi staggered ve **tek seferlik**. Count-up sadece ilk mount'ta, süre ≤ 800ms, `prefers-reduced-motion`'da anında son değeri göster.

**Ölçüm/kabul:**
- Lighthouse Performance koru, hydration sırasında animasyon başlatma; `framer-motion`'ı mümkünse ağır olmayan API'larla kullan, gerekiyorsa kod-bölme ile geç yükle.

---

## Promptu kullanırken notlar (Kombai'ye yapıştırma)
- Kombai'yi repodaki `frontend/` klasörüne yönlendir; özellikle bu dosyaları görmesi faydalı:
  `tailwind.config.js`, `app/globals.css`, `app/context/LanguageContext.tsx`, `app/page.tsx`,
  `app/scheduler/page.tsx`, `app/results/page.tsx`.
- Riski düşürmek için **landing → results → scheduler** sırasıyla, ayrı turlarda çalıştır (scheduler en hassas).
- Çıktı geldikçe `npm run build` ile doğrula; `next dev` çalışırken `next build` koşturma (race → sahte hatalar).
