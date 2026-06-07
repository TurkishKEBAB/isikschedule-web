# Frontend UI/UX Todo Plan

Oluşturulma tarihi: 2026-06-06

Bu dosya iki ayrı UI/UX incelemesinin birleşik aksiyon planıdır:

- Codex frontend/UI-UX review sonucu: genel puan 7/10.
- Claude frontend/UI-UX review sonucu: genel puan 7/10.

Amaç: sonraki AI veya geliştirici oturumlarında bağlam kaybını azaltmak, token kullanımını düşürmek ve değişiklikleri küçük, doğrulanabilir parçalara bölmek.

## Kapsam

Yalnızca kullanıcıya görünen frontend, UI/UX, responsive tasarım, erişilebilirlik, görsel tutarlılık, mikro etkileşimler, metinler ve frontend component organizasyonu ele alınacak.

## Kapsam Dışı

- Backend iş mantığı
- API kontratı veya veri modeli değişiklikleri
- Veritabanı
- Authentication güvenlik mimarisi
- Server-side business logic
- Güvenlik review'u

Not: Frontend içinde görünen login/register formları, auth ekran akışı ve kullanıcıya görünen hata/feedback metinleri UI/UX kapsamında değerlendirilebilir. Ancak backend auth davranışı veya güvenlik modeli değiştirilmeyecek.

## Çalışma Kuralları

- Bu dosyayı uygulama planı olarak kullan. Aynı anda bütün maddelere dalma; fazlara göre küçük değişiklik setleri yap.
- Kirli git worktree olabileceğini varsay. Kullanıcının mevcut değişikliklerini revert etme.
- Önce mevcut component ve Tailwind pattern'lerini kullan: `btn-*`, `glass-panel`, `badge-*`, `input-field`, `surface-*`, `isik-*`.
- Yeni UI kütüphanesi ekleme. Gerekirse mevcut `lucide-react` ikonlarını kullan.
- Türkçe ve İngilizce metinleri `LanguageContext.tsx` üzerinden tutarlı yönet.
- Her fazdan sonra en az `npm run lint` çalıştır. Büyük veya layout etkileyen fazlardan sonra `npm run build` ve browser kontrolü yap.
- Backend çalışmıyorsa frontend hata/empty state gözlemlenebilir; backend hatasını çözmeye çalışma.

## Doğrulama Komutları

Frontend dizininde:

```bash
npm run lint
npm run build
npm run dev -- -p 3001
```

Görsel kontrol önerilen route'lar:

- `/`
- `/upload`
- `/login`
- `/register`
- `/scheduler`
- `/shared/nonexistent`
- Auth varsa `/admin`

Önerilen viewport'lar:

- Mobile: 390x844
- Tablet: 768x1024
- Desktop: 1440x900

## Öncelik Özeti

Önce yapılmalı:

- Form label/input bağlantıları
- Toast aria-live
- Global button focus-visible
- Düşük kontrastlı küçük metinler
- Upload/dropzone erişilebilirliği
- Yanıltıcı veya çalışmayan UI vaatleri
- EN moduna sızan Türkçe etiketler
- Scheduler tablet breakpoint

Sonra yapılmalı:

- Scheduler toolbar sadeleştirme
- Modal focus yönetimi
- Renk-only course type ayrımına lejant/etiket ekleme
- Settings/Stats popover tutarlılığı
- Scheduler component parçalama
- Türetilmiş scheduler verilerini memoize etme

En son polish:

- Home product preview
- Ortak AppHeader
- Ortak ScheduleTable/schedule constants
- Branded error/not-found sayfaları
- Auth UX iyileştirmeleri
- Toast çıkış animasyonu

---

# Faz 1: Hızlı Erişilebilirlik ve Güven Düzeltmeleri

Bu faz düşük riskli, yüksek etkili değişiklikleri içerir. Tercihen tek PR veya tek küçük commit grubu olarak yapılabilir.

## 1.1 Form label/input bağlantılarını ekle

Durum: Görsel label'lar var ama `htmlFor` / `id` bağı yok. Label'a tıklamak input'u focus etmiyor; screen reader input etiketini güvenilir şekilde okuyamayabilir.

Etkisi: WCAG 1.3.1 ve 4.1.2 açısından risk. Login/register/admin/scheduler filtreleri daha erişilebilir olur.

Dosyalar:

- `frontend/app/login/page.tsx`
- `frontend/app/register/page.tsx`
- `frontend/app/admin/page.tsx`
- `frontend/app/scheduler/page.tsx`

Todo:

- [x] Login email input: `id="login-email"`, label `htmlFor="login-email"`, `name="email"`, `autoComplete="email"`.
- [x] Login password input: `id="login-password"`, label bağı, `name="password"`, `autoComplete="current-password"`.
- [x] Register email/password/confirm inputlarına aynı pattern'i uygula.
- [x] Admin semester name input'a `id` / `htmlFor` ekle.
- [x] Scheduler desktop select label'larını ilgili select id'leriyle bağla.
- [x] Mobil drawer select'lerinde zaten `aria-label` var; gerekirse koru, desktop label bağını tamamla.

Kabul kriterleri:

- Form label'a tıklayınca doğru input/select focus olur.
- Screen reader snapshot'ta input isimleri anlamlı görünür.
- `npm run lint` temiz geçer.

Örnek:

```tsx
<label htmlFor="login-email" className="...">
  {t.loginEmailLabel}
</label>
<input
  id="login-email"
  name="email"
  type="email"
  autoComplete="email"
  className="input-field !pl-10"
/>
```

## 1.2 Toast bildirimlerini screen reader'a duyur

Durum: Toast container'da `aria-live` yok.

Etkisi: Upload hatası, link kopyalandı, program oluşturuldu gibi geri bildirimler sadece görsel kalıyor.

Dosya:

- `frontend/app/components/Toast.tsx`

Todo:

- [x] Toast container'a `aria-live="polite"` ekle.
- [x] `aria-atomic="false"` ekle.
- [x] Hata toast'larında mümkünse toast item'a `role="alert"` ver.
- [x] Close butonu `aria-label` metnini i18n'e taşımayı değerlendir.

Kabul kriterleri:

- Toast görsel tasarımı değişmez.
- Screen reader duyuruları için canlı bölge vardır.

Örnek:

```tsx
<div
  aria-live="polite"
  aria-atomic="false"
  className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
>
```

## 1.3 Tüm butonlara görünür focus state ekle

Durum: `input-field` focus ring'e sahip, ancak global `.btn` sınıfında focus-visible halkası yok. Çok sayıda icon button da sadece hover/active ile anlaşılır.

Etkisi: Klavye kullanıcıları hangi butonda olduklarını koyu temada zor görür.

Dosya:

- `frontend/app/globals.css`

Todo:

- [x] `.btn` sınıfına `focus-visible:outline-none`, `focus-visible:ring-2`, `focus-visible:ring-isik-blue-lighter/60`, `focus-visible:ring-offset-2`, `focus-visible:ring-offset-surface-900` ekle.
- [x] `.btn-ghost` ve küçük icon button'larda bu ring'in görünür kaldığını kontrol et.
- [x] Standalone icon button'larda `btn` kullanılmıyorsa benzer `focus-visible` sınıfları ekle.

Kabul kriterleri:

- Tab ile gezinirken tüm ana butonlarda net focus halkası görünür.
- Hover/active görsel dili bozulmaz.

Örnek:

```css
.btn {
  @apply inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm
         transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-isik-blue-lighter/60
         focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900;
}
```

## 1.4 Düşük kontrastlı küçük metinleri güçlendir

Durum: `text-slate-600` ve bazı `text-slate-500` kullanımları koyu zeminde düşük kontrast veriyor. Ölçüm: `slate-600` on `surface-900` yaklaşık 2.36:1, `slate-500` yaklaşık 3.75:1.

Etkisi: Helper text, footer, saatler, küçük açıklamalar parlak ortamda zor okunur.

Dosyalar:

- `frontend/app/page.tsx`
- `frontend/app/upload/page.tsx`
- `frontend/app/register/page.tsx`
- `frontend/app/scheduler/page.tsx`
- `frontend/app/shared/[id]/page.tsx`
- `frontend/app/globals.css`

Todo:

- [x] Anlam taşıyan `text-slate-600` kullanımlarını `text-slate-500` veya tercihen `text-slate-400` yap.
- [x] 10-12px küçük metinlerde minimum `text-slate-400` kullan.
- [x] Placeholder'larda `placeholder-slate-500` kabul edilebilir; ancak kritik bilgi placeholder'da bırakılmamalı.
- [x] Footer gibi düşük öncelikli ama okunması gereken metinleri `text-slate-500` üstüne çıkar.

Kabul kriterleri:

- Küçük metinler mobil ve desktop screenshot'ta okunur.
- Dekoratif ayrımlar hala fazla baskın olmaz.

## 1.5 Upload/dropzone erişilebilirliğini düzelt

Durum: Dropzone `cursor-pointer` gösteriyor ama tüm alan tıklanınca dosya seçici açılmıyor; sadece içteki label/span açıyor. Hidden input + span button klavye deneyimi de zayıf.

Etkisi: Kullanıcı paneli tıklanabilir sanıp tıkladığında beklediği aksiyon olmaz. Keyboard kullanıcıları dosya seçimini zor keşfeder.

Dosyalar:

- `frontend/app/upload/page.tsx`
- `frontend/app/scheduler/page.tsx`
- `frontend/app/admin/page.tsx`

Todo:

- [ ] Ortak `UploadDropzone` component'i oluşturmayı değerlendir.
- [ ] Tüm dropzone alanını label/input ile gerçekten tıklanabilir yap.
- [ ] `sr-only` input + `peer-focus-visible` pattern'i kullan.
- [ ] Dropzone'a `onKeyDown` ile Enter/Space desteği gerekiyorsa ekle.
- [ ] Invalid file feedback'i hem toast hem inline küçük açıklamayla desteklemeyi değerlendir.

Kabul kriterleri:

- Dropzone alanının herhangi bir yerine tıklayınca file picker açılır.
- Tab ile dosya seçme kontrolü bulunur ve focus görünür.
- Drag state ve selected file state görsel olarak korunur.

Örnek:

```tsx
<input
  id="course-file"
  type="file"
  accept=".xlsx"
  onChange={handleFileSelect}
  className="peer sr-only"
/>
<label
  htmlFor="course-file"
  className="glass-panel block cursor-pointer p-10 text-center peer-focus-visible:ring-2 peer-focus-visible:ring-isik-blue-lighter"
>
  <span className="btn-primary">Dosya seç</span>
</label>
```

## 1.6 Yanıltıcı veya çalışmayan UI vaatlerini temizle

Durum: Scheduler settings içinde DFS / Genetik / A* seçimi var. Claude raporuna göre backend bu algoritma parametresini yok sayıyor. Ayrıca home copy içinde "boş gün" ve "sabah dersi" gibi UI'da bulunmayan tercihler vaat ediliyor.

Etkisi: Kullanıcı bir kontrolü değiştirip sonuç bekler, ama fark görmez. Ürün güveni zedelenir.

Dosyalar:

- `frontend/app/scheduler/page.tsx`
- `frontend/app/context/LanguageContext.tsx`
- `frontend/app/page.tsx`

Todo:

- [ ] Eğer algoritma seçimi gerçekten sonuçları etkilemiyorsa Genetik/A* seçeneklerini gizle veya disabled yap.
- [ ] Disabled kalacaksa "Yakında" rozeti veya tooltip ekle.
- [ ] Home feature metnini mevcut özelliklere indir: ECTS limiti, çakışma toleransı, kilitli saatler, section seçimi, export/paylaşım.
- [ ] Kullanıcıya vaat edilen her şeyin ekranda karşılığı olduğundan emin ol.

Kabul kriterleri:

- Görünen her ayar gerçek davranışla uyumlu olur.
- Home metinleri ürünün mevcut durumunu abartmaz.

## 1.7 TR/EN tutarlılığını düzelt

Durum: Course type label'ları bazı yerlerde sabit Türkçe. Örnek: `TYPE_STYLES` içinde `label: 'Ders'`. Admin tarih formatı her dilde `tr-TR`.

Etkisi: EN modunda yarı çevrilmiş ürün hissi oluşur.

Dosyalar:

- `frontend/app/scheduler/page.tsx`
- `frontend/app/admin/page.tsx`
- `frontend/app/context/LanguageContext.tsx`

Todo:

- [ ] `TYPE_STYLES` içindeki sabit label'ları kaldır; label'ı `t.lecture`, `t.lab`, `t.problemSession` üzerinden üret.
- [ ] Admin tarih formatında `lang === 'en' ? 'en-GB' : 'tr-TR'` gibi dil uyumlu locale kullan.
- [ ] Türkçe modda "Scheduler" kelimesinin nerelerde kaldığını tara; gerekirse "Program" veya "Planlayıcı" ile değiştir.
- [ ] İngilizce modda Türkçe placeholder/başlık sızıntısı olmadığını browser'da kontrol et.

Kabul kriterleri:

- EN modunda course detail modal'ında "Ders" görünmez.
- TR modunda Türkçe metinler doğal kalır.

## 1.8 Renk-only course type ayrımını kaldır

Durum: Ders/Lab/PS ayrımı takvimde büyük ölçüde renkle veriliyor. Lejant yok; hücre çipinde çoğu zaman sadece course code var.

Etkisi: Renk körü kullanıcılar veya yeni kullanıcılar renk anlamını çıkaramayabilir. WCAG 1.4.1 riski.

Dosyalar:

- `frontend/app/scheduler/page.tsx`
- `frontend/app/shared/[id]/page.tsx`

Todo:

- [ ] Takvim başlığına küçük Ders/Lab/PS lejantı ekle.
- [ ] Course chip içinde çok küçük bir type ikonu veya kısa text göster: `D`, `Lab`, `PS` veya lucide icon.
- [ ] Shared schedule ekranında aynı lejantı kullan.
- [ ] Conflict state sadece kırmızı border ile kalmasın; gerekiyorsa tooltip/title veya küçük conflict indicator ekle.

Kabul kriterleri:

- Renk olmadan da course type anlaşılır.
- Lejant mobilde taşmaz.

Örnek:

```tsx
const getTypeLabel = (type: string) =>
  type === 'lab' ? t.lab : type === 'ps' ? t.problemSession : t.lecture;

<div className="flex items-center gap-3 text-[11px] text-slate-400">
  <span className="inline-flex items-center gap-1">
    <i className="w-2.5 h-2.5 rounded-sm bg-lecture" />
    {t.lecture}
  </span>
  <span className="inline-flex items-center gap-1">
    <i className="w-2.5 h-2.5 rounded-sm bg-lab" />
    {t.lab}
  </span>
  <span className="inline-flex items-center gap-1">
    <i className="w-2.5 h-2.5 rounded-sm bg-ps" />
    {t.problemSession}
  </span>
</div>
```

---

# Faz 2: Responsive ve Ana UX Akışı

Bu faz özellikle scheduler deneyimini daha az sıkışık ve daha sezgisel yapar.

## 2.1 Scheduler tablet breakpoint'ini düzelt

Durum: `md` breakpoint'te 320px sidebar ve tablo aynı anda açılıyor. 768-900px aralığında program tablosu sıkışmaya aday.

Etkisi: Tablet kullanıcılarında taşma, küçük hücreler ve düşük okunabilirlik.

Dosyalar:

- `frontend/app/scheduler/page.tsx`

Todo:

- [ ] Desktop sidebar'ı `hidden lg:flex` yap.
- [ ] Desktop tabloyu `hidden lg:block` yap.
- [ ] Mobil/tablet günlük görünümü `lg:hidden` yap.
- [ ] Course drawer açma butonunu `lg:hidden` yap.
- [ ] 768x1024 ve 900x1024 viewport'ta kontrol et.

Kabul kriterleri:

- Tablet görünümünde ana program günlük kart görünümünü kullanır.
- Sidebar/table birlikte sıkışmaz.
- Desktop 1440px görünüm aynı kalır veya daha iyi olur.

Örnek:

```tsx
<div className="hidden lg:flex w-80 ...">...</div>
<div className="lg:hidden no-print mb-3">...</div>
<div className="hidden lg:block">...</div>
<div className="lg:hidden p-3 space-y-3">...</div>
```

## 2.2 Scheduler toolbar'ı sadeleştir

Durum: Üst barda dil, undo/redo, change file, clear locks, clear selection, export, stats, shortcuts, settings, counter, generate gibi çok fazla kontrol var.

Etkisi: Ana CTA olan "Program oluştur" kayboluyor. Mobil/tablet header sarıp yer kaplıyor.

Dosyalar:

- `frontend/app/scheduler/page.tsx`

Todo:

- [ ] Primary CTA: `Program oluştur` her zaman görünür ve sağda belirgin kalsın.
- [ ] Secondary actions: clear locks, clear selection, export, stats, shortcuts, settings tek `Araçlar` veya `More` menüsüne taşınabilir.
- [ ] Undo/redo kompakt kalabilir ama touch target en az 40px olmalı.
- [ ] Counter görsel olarak daha sakin ve küçük tutulmalı.
- [ ] Menü açık/kapalı state'leri `aria-expanded` ile belirtilmeli.

Kabul kriterleri:

- Mobile/tablet header tek satır veya kontrollü iki satırdan fazla büyümez.
- Primary CTA görsel hiyerarşide ilk 1-2 aksiyondan biri olarak algılanır.
- Icon-only butonlarda `aria-label` korunur.

## 2.3 Mobil navbar'a ana navigasyon ekle

Durum: `Navbar` içinde ana nav `hidden sm:flex`. `sm` altı mobilde Scheduler/Upload/Admin linkleri kayboluyor; yerine hamburger yok.

Etkisi: Mobil kullanıcı sayfalar arası geçişte geri/home veya doğrudan URL'e bağımlı kalır.

Dosya:

- `frontend/app/components/Navbar.tsx`

Todo:

- [ ] Mobil için hamburger veya kısa bottom/nav menu ekle.
- [ ] `aria-expanded`, `aria-controls`, ESC ile kapanma ve outside-click davranışını düşün.
- [ ] Admin linki role göre görünmeye devam etmeli.
- [ ] Login/logout ve language switcher görünür kalmalı.

Kabul kriterleri:

- 390px viewport'ta Scheduler ve Upload'a navbar üzerinden erişilir.
- Menü klavye ile açılıp kapanır.

## 2.4 Settings ve Stats popover davranışını tutarlılaştır

Durum: Export menüsü dışarı tıklayınca kapanıyor; Settings ve Stats fixed panel olarak açılıyor ve dışarı tıklayınca kapanmıyor.

Etkisi: Popover davranışları tutarsız. Dar ekranlarda `fixed top-14 right-4 w-80` taşma riski taşır.

Dosya:

- `frontend/app/scheduler/page.tsx`

Todo:

- [ ] Export'taki outside-click pattern'ini Settings ve Stats için de uygula.
- [ ] Popover'ları mümkünse tetikleyici butona anchor'lı konumlandır.
- [ ] `aria-expanded` ve `aria-controls` ekle.
- [ ] Mobilde popover yerine bottom sheet veya modal kullanmayı değerlendir.

Kabul kriterleri:

- Dışarı tıklayınca açık panel kapanır.
- Dar mobil viewport'ta panel taşmaz.

## 2.5 Modal erişilebilirliğini güçlendir

Durum: Modal ESC ve scroll-lock yapıyor; ancak focus modal'a taşınmıyor, focus trap yok, kapanınca tetikleyiciye dönmüyor. Başlık varken `aria-labelledby` daha doğru.

Etkisi: Klavye ve screen reader kullanıcıları modal açıkken arka sayfaya kaçabilir.

Dosya:

- `frontend/app/components/Modal.tsx`

Todo:

- [ ] Modal açıldığında önceki focused element'i sakla.
- [ ] İlk focusable element'e veya dialog paneline focus ver.
- [ ] Basit focus trap ekle.
- [ ] Kapanınca önceki focused element'e dön.
- [ ] Title varsa `aria-labelledby` kullan; fallback olarak `aria-label` kalabilir.

Kabul kriterleri:

- Tab modal dışına kaçmaz.
- ESC modal'ı kapatır.
- Modal kapanınca tetikleyen butona focus döner.

---

# Faz 3: Component Organizasyonu ve Performans Hissi

Bu faz daha büyük ama bakım maliyetini ciddi düşüren iyileştirmeleri içerir.

## 3.1 Scheduler dosyasını parçalara böl

Durum: `frontend/app/scheduler/page.tsx` yaklaşık 2365 satır. UI, state, helpers, modals, toolbar ve grid tek dosyada.

Etkisi: Küçük UI değişikliklerinde regresyon riski yüksek. AI/geliştirici bağlamdan kolay kopar.

Hedef dosya yapısı önerisi:

```text
frontend/app/scheduler/
  page.tsx
  components/
    SchedulerToolbar.tsx
    CourseFilters.tsx
    CourseList.tsx
    ScheduleGrid.tsx
    MobileDaySchedule.tsx
    CourseDrawer.tsx
    SettingsPanel.tsx
    StatsPanel.tsx
    ShareScheduleModal.tsx
    CourseDetailModal.tsx
    TypeLegend.tsx
  lib/
    schedulerTypes.ts
    schedulerHelpers.ts
```

Todo:

- [ ] Önce types ve pure helper fonksiyonları ayır.
- [ ] `CourseFilters` component'ini çıkar.
- [ ] Desktop sidebar ve mobile drawer içindeki kopya course list JSX'ini tek `CourseList` component'inde birleştir.
- [ ] `ScheduleGrid` ve `MobileDaySchedule` component'lerini ayır.
- [ ] Modal içeriklerini ayrı component'lere taşı.
- [ ] Ana `page.tsx` hedef olarak 600-900 satır altına indir.

Kabul kriterleri:

- Görsel davranış değişmeden dosya bölünür.
- Course card görünümü tek yerde yönetilir.
- Lint/build temiz geçer.

## 3.2 Türetilmiş scheduler verilerini memoize et

Durum: `getCourseListItems`, `buildGrid`, `getAcademicUnitOptions`, `getPrefixOptions`, `getInstructorOptions` render sırasında yeniden çalışıyor. `getCourseListItems` her course için `chooseBestOption` çağırıyor.

Etkisi: Büyük Excel dosyalarında arama yazarken veya filtre değiştirirken lag hissi oluşabilir.

Dosya:

- `frontend/app/scheduler/page.tsx`

Todo:

- [ ] `grid` için `useMemo`.
- [ ] `courseListItems` için `useMemo`.
- [ ] `academicUnitOptions`, `prefixOptions`, `instructorOptions` için `useMemo`.
- [ ] "blocked" hesabını arama filtresinden mümkün olduğunca ayır.
- [ ] `toggleCourse`, `switchSection`, `generateSchedules` gibi callback'leri component extraction sonrası prop stabilitesi için gözden geçir.

Kabul kriterleri:

- Arama input'una yazarken hissedilir takılma olmamalı.
- React lint dependency uyarısı olmamalı.

## 3.3 Ortak schedule constants ve utilities çıkar

Durum: `DAYS`, `PERIODS`, `PERIOD_TIMES`, `TYPE_STYLES` ve grid mantığı scheduler/shared/export tarafında tekrar ediyor.

Etkisi: Bir yerde yapılan görsel/label değişikliği diğer ekranlarda unutulabilir.

Dosyalar:

- `frontend/app/scheduler/page.tsx`
- `frontend/app/shared/[id]/page.tsx`
- `frontend/app/lib/scheduleExport.ts`

Todo:

- [ ] `frontend/app/lib/scheduleConstants.ts` oluştur.
- [ ] `DAYS`, `PERIODS`, `PERIOD_TIMES` tek kaynaktan gelsin.
- [ ] Type style bilgisi tek yerde tutulsun; label yine i18n üzerinden üretilsin.
- [ ] Grid builder pure helper olarak ortaklaştırılsın.

Kabul kriterleri:

- Scheduler ve shared ekran aynı period/day bilgisini kullanır.
- Export davranışı bozulmaz.

## 3.4 Ortak AppHeader düşün

Durum: Home, Navbar, Admin ve Shared kendi header varyantlarını ayrı yazıyor.

Etkisi: Logo, language switcher, nav davranışı ve spacing farklılaşabilir.

Dosyalar:

- `frontend/app/page.tsx`
- `frontend/app/components/Navbar.tsx`
- `frontend/app/admin/page.tsx`
- `frontend/app/shared/[id]/page.tsx`

Todo:

- [ ] `AppHeader` component'i tasarla: `variant="marketing" | "app" | "admin" | "shared"`.
- [ ] Logo ve language switcher tek yerden gelsin.
- [ ] Admin badge ve shared CTA slot olarak geçilebilsin.
- [ ] Mobil nav çözümü bu component içinde ele alınsın.

Kabul kriterleri:

- Header'lar görsel olarak tutarlı olur.
- Sayfa özel aksiyonları kaybolmaz.

---

# Faz 4: Görsel Polish ve İçerik Kalitesi

## 4.1 Home ekranına gerçek ürün önizlemesi ekle

Durum: Home modern ama ilk ekranda ürünün asıl schedule deneyimi görünmüyor. Daha çok landing page hissi veriyor.

Etkisi: Kullanıcı ilk bakışta nasıl bir araç kullanacağını tam görmez.

Dosyalar:

- `frontend/app/page.tsx`
- Gerekirse küçük yeni presentational component.

Todo:

- [ ] Hero altına veya hero içinde kompakt gerçek schedule preview ekle.
- [ ] Örnek course chip'leri, küçük haftalık program veya "3 adım" yerine mini product surface göster.
- [ ] Mobilde preview taşmadan akmalı.
- [ ] Pazarlama metnini kısa tut; primary CTA görünür kalmalı.

Kabul kriterleri:

- İlk viewport'ta ürünün schedule oluşturucu olduğu görsel olarak anlaşılır.
- Home hala hızlı ve sade görünür.

## 4.2 Branded error/not-found sayfaları ekle

Durum: Route seviyesinde genel `error.tsx` veya `not-found.tsx` görünmüyor. Beklenmeyen hata Next default ekranına düşebilir.

Etkisi: Ürün hissi kırılır.

Dosyalar:

- `frontend/app/error.tsx`
- `frontend/app/not-found.tsx`

Todo:

- [ ] Koyu tema ile uyumlu genel hata ekranı ekle.
- [ ] Ana sayfaya dön ve scheduler'a git CTA'ları sun.
- [ ] Backend hata detayına girmeden kullanıcı dostu metin kullan.

Kabul kriterleri:

- Bilinmeyen route branded not-found gösterir.
- Runtime client error branded fallback'e düşer.

## 4.3 Auth ekran UX polish

Durum: Login/Register görsel olarak iyi. Eksikler: inline field hataları sınırlı, "şifremi unuttum" yok, hata kutusunda düz `!` karakteri var.

Dosyalar:

- `frontend/app/login/page.tsx`
- `frontend/app/register/page.tsx`

Todo:

- [ ] Hata ikonlarını lucide `AlertCircle` ile değiştir.
- [ ] Error container'a `role="alert"` ekle.
- [ ] Register password strength veya minimum gereksinim hint'i daha okunur hale getir.
- [ ] "Şifremi unuttum" eklenirse sadece frontend link/placeholder olarak planlanmalı; backend akışı yoksa çalışıyor gibi sunulmamalı.

Kabul kriterleri:

- Hata mesajları hem görsel hem screen reader için net olur.
- Var olmayan backend özelliği vaat edilmez.

## 4.4 Share modal'ını design system'e yaklaştır

Durum: Share modal raw `bg-slate-*` ve custom button kullanıyor; diğer modaller `surface-*` ve `btn-*` sınıflarıyla daha tutarlı.

Dosya:

- `frontend/app/scheduler/page.tsx`

Todo:

- [ ] `bg-slate-800/50`, `border-slate-700/50`, `bg-slate-700` gibi raw class'ları mümkün olduğunca `surface-*` ve `btn-*` ile değiştir.
- [ ] Copy link input'a label veya aria-label ekle.
- [ ] QR alanının beyaz paneli korunabilir; QR okunabilirliği için iyi.

Kabul kriterleri:

- Share modal diğer modallerle aynı ürün ailesinden görünür.
- Copy link alanı erişilebilir isim taşır.

## 4.5 Toast çıkış animasyonu ve ConfirmDialog tone polish

Durum: Toast giriş animasyonu var, çıkış ani. ConfirmDialog `tone="danger"` olsa bile ikon amber kalıyor.

Dosyalar:

- `frontend/app/components/Toast.tsx`
- `frontend/app/components/ConfirmDialog.tsx`

Todo:

- [ ] Toast dismiss sırasında kısa fade/slide-out eklemeyi değerlendir.
- [ ] ConfirmDialog icon background ve icon color `tone` ile uyumlu olsun.
- [ ] Danger confirmation daha net kırmızı, warning amber, primary mavi olsun.

Kabul kriterleri:

- Dialog tonları görsel anlamla uyumlu olur.
- Animasyon doğal ama abartısız kalır.

---

# Sayfa Bazlı Kısa Notlar

## Home

Güçlü:

- Modern koyu tema.
- CTA hiyerarşisi net.
- Mobilde kartlar iyi akıyor.

Risk:

- Gerçek ürün yüzeyi ilk ekranda görünmüyor.
- Bazı feature metinleri mevcut UI ile tam örtüşmeyebilir.
- Header inline yazılmış; ortak Navbar/AppHeader ile birleştirilebilir.

## Navbar

Güçlü:

- Aktif link için `aria-current` kullanılmış.
- Login/logout state'i görsel olarak anlaşılır.

Risk:

- Mobilde ana nav kayboluyor.
- Auth state localStorage'dan ayrı okunuyor; `AuthContext` ile tutarsızlık olabilir. Bu backend değil, frontend state organizasyonu olarak ele alınabilir.

## Login / Register

Güçlü:

- Görsel olarak tutarlı.
- Password show/hide erişilebilir label'a sahip.
- Loading state var.

Risk:

- Label/input bağı yok.
- Error container screen reader için `role="alert"` taşımıyor.
- Bazı helper metin kontrastları düşük.

## Upload

Güçlü:

- Akış sade.
- Dosya seçimi, drag-drop, success card ve redirect feedback var.

Risk:

- Dropzone tamamen tıklanabilir değil.
- Klavye erişilebilirliği zayıf.
- Scheduler upload modal ile tekrar var.

## Scheduler

Güçlü:

- En zengin ürün ekranı.
- Undo/redo, keyboard shortcuts, locked slots, mobile drawer, stats, export/share gibi iyi düşünülmüş özellikler var.
- Mobilde günlük görünüm yaklaşımı doğru.

Risk:

- 2365 satırlık tek dosya.
- Toolbar çok kalabalık.
- Tablet breakpoint sıkışıyor.
- Bazı hesaplar memoize değil.
- Renk-only course type ayrımı.
- Settings/Stats popover davranışı export ile tutarsız.

## Admin

Güçlü:

- Loading/error/empty state'ler ayrılmış.
- Stat cards ve active semester vurgusu net.

Risk:

- Header mobilde sıkışabilir.
- File upload erişilebilirliği upload sayfasıyla aynı problemi taşıyor.
- Tarih locale'i dile göre değişmiyor.

## Shared Schedule

Güçlü:

- Public read-only ekran sade.
- Not-found ekranı kullanıcı dostu.
- Desktop tablo + mobil günlük görünüm iyi.

Risk:

- Lejant yok.
- Conflict state fazla renk/border bağımlı.
- Not-found ikonunda düz karakter yerine lucide icon daha tutarlı olur.

## Modal / Toast / ConfirmDialog

Güçlü:

- Ortak component altyapısı var.
- Modal ESC ve body scroll-lock yapıyor.
- Toast tip ikonları var.

Risk:

- Modal focus trap yok.
- Toast aria-live yok.
- ConfirmDialog tone icon renkleri tam uyumlu değil.

---

# Uygulama Sırası Önerisi

## Batch 1: Low-risk Accessibility Patch

- [x] 1.1 Label/input bağlantıları
- [x] 1.2 Toast aria-live
- [x] 1.3 Button focus-visible
- [x] 1.4 En problemli düşük kontrast metinler
- [ ] 4.3 Error container `role="alert"` ve lucide icon

Doğrulama:

```bash
npm run lint
npm run build
```

Browser kontrol:

- `/login`
- `/register`
- `/upload`
- `/scheduler`

## Batch 2: UI Honesty and i18n Consistency

- [ ] 1.6 Yanıltıcı algoritma/copy düzeltmeleri
- [ ] 1.7 TR/EN label ve tarih formatı
- [ ] 1.8 Course type legend

Doğrulama:

```bash
npm run lint
npm run build
```

Browser kontrol:

- TR ve EN modunda `/`
- TR ve EN modunda `/scheduler`
- TR ve EN modunda `/shared/nonexistent`

## Batch 3: Responsive Scheduler

- [ ] 2.1 Tablet breakpoint
- [ ] 2.2 Toolbar sadeleştirme
- [ ] 2.4 Settings/Stats popover

Doğrulama:

```bash
npm run lint
npm run build
```

Browser kontrol:

- `/scheduler` 390x844
- `/scheduler` 768x1024
- `/scheduler` 1440x900

## Batch 4: Component Extraction

- [ ] 3.1 Scheduler parçalama
- [ ] 3.2 Memoization
- [ ] 3.3 Shared schedule constants

Doğrulama:

```bash
npm run lint
npm run build
```

Ek kontrol:

- Course selection
- Search/filter
- Lock/unlock slots
- Generate button disabled/enabled state
- Export menu opens/closes
- Course detail modal
- Mobile course drawer

## Batch 5: Product Polish

- [ ] 4.1 Home product preview
- [ ] 3.4 AppHeader
- [ ] 4.2 Branded error/not-found
- [ ] 4.4 Share modal design-system cleanup
- [ ] 4.5 Toast/ConfirmDialog polish

Doğrulama:

```bash
npm run lint
npm run build
```

Browser kontrol:

- `/`
- `/upload`
- `/login`
- `/register`
- `/scheduler`
- `/shared/nonexistent`
- bilinmeyen route, ör. `/does-not-exist`

---

# Gelecek AI İçin Kısa Başlangıç Notu

Bu dosyadaki görevler frontend/UI-UX kapsamındadır. Backend, API ve security tarafına dokunma. Başlarken:

1. `git status --short` ile mevcut değişiklikleri gör.
2. İlgili batch'teki dosyaları oku.
3. Küçük ve odaklı değişiklik yap.
4. `npm run lint` çalıştır.
5. Layout etkilenmişse `npm run build` ve browser viewport kontrolü yap.
6. Finalde hangi batch maddelerinin tamamlandığını ve hangi testlerin geçtiğini yaz.

En düşük riskli başlangıç: Batch 1.
