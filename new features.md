# IşıkSchedule — Yeni Özellik Fikirleri

> Bu dosya, IşıkSchedule ile aynı amaca hizmet eden (üniversite ders programı oluşturucu) en iyi örneklerin
> incelenmesiyle toplanan özellik fikirlerini biriktirir. Amaç: **eklenebilecek** yeni özellikler ve
> mevcut akışlarda **düzenlenebilecek** noktalar.
>
> Not: Öneriler bu repodaki gerçek mimariye göre önceliklendirildi (senkron üretim, in-memory `JOBS`,
> SQLite, canlı kontenjan beslemesi yok). Her madde için kabaca *efor* ve *dokunulacak yer* belirtildi.

---

## 1. Kıyaslanan en iyi örnekler (benchmark)

| Ürün | Kapsam | Öne çıkan / "çalınacak" özellikler |
|------|--------|-------------------------------------|
| **Coursicle** | ABD genel, mobil + web | Açık kontenjan bildirimi (dolu derste yer açılınca anında push), renkli haftalık grid, çoklu yedek program, cihazlar arası senkron, LMS'ten (Canvas/Moodle…) ödev içe aktarma |
| **AntAlmanac** (UCI) | Tek üniversite, öğrenci yapımı | Bölümler arası arama, **not dağılımı** (grade distribution), section karşılaştırma, **derslerin kampüs haritasında** gösterimi |
| **Berkeleytime** (UC Berkeley) | Öğrenci yapımı | Ortalama nota / açık koltuğa göre filtre-sırala, hoca+dönem bazlı not dağılımı, programı kaydet & paylaş, **gerçek zamanlı kontenjan takibi** |
| **CourseTable** (Yale) | Öğrenci yapımı | Ders+hoca **değerlendirmeleri ve yorumları**, iş yükü (workload) sütunu, mobil takvim, arkadaşlar, Google Calendar entegrasyonu |
| **uAchieve / Stellic / DegreeWorks** | Kurumsal | **Mezuniyet/degree audit**, çok dönemli plan, ön koşul doğrulama, GPA "what-if" hesaplayıcı, mezuniyet geri sayımı |
| **Modern Campus Navigate / College Scheduler** | Kurumsal | Müsaitlik + tercih girip **saniyeler içinde çakışmasız program listesi**, "şu saatte ders olmasın" blokları |

**Genel çıkarım:** Bizde *üretim motoru* var ama rakiplerin asıl değer kattığı yerler şunlar →
(1) **tercih tabanlı akıllı optimizasyon**, (2) **karar destek verisi** (hoca puanı, not dağılımı, iş yükü),
(3) **kontenjan/bildirim**, (4) **sosyal/karşılaştırma**, (5) **takvim & mobil entegrasyon**.

---

## 2. Şu an üründe zaten olanlar (tekrar önermemek için)

- Excel yükleme + parse, global aktif dönem (admin yönetir)
- `main_code` ile ders seçimi, ders **bloklama**, section **kilitleme** (locked slots)
- **Instructor (hoca) filtresi**, ön koşul/yan koşul (prereq/coreq) uyarıları
- Çakışmasız kombinasyon üretimi (`max_ects`, `max_conflicts`), basit skorlama
- Program **kaydetme**, **paylaşım linki** (`/shared/[id]`), **arkadaş** sistemi
- **PDF / iCal** export (client-side), **tr/en** dil desteği, admin paneli, JWT auth

---

## 3. Eklenebilecek özellikler (öncelikli)

### P0 — Düşük efor, yüksek değer (mevcut mimariye oturur)

1. **Tercih tabanlı akıllı program puanlama** *(efor: orta · backend `generate.py`)*
   Rakiplerin temel farkı bu. `params`'a yeni tercihler ekle ve skoru zenginleştir:
   - "Sabah 9 öncesi ders olmasın", "Cuma boş olsun", belirli saat aralıklarını blokla
   - **Boşlukları (gap) azalt** / günleri sıkıştır, ya da tersine "araları seyrek" iste
   - Haftada en az X gün tamamen boş
   - Mevcut skor sadece (çakışma, ders sayısı, ECTS) bakıyor → bu tercihleri ağırlıklandır.
   `frontend/app/scheduler/page.tsx` zaten `params` gönderiyor; UI'a tercih paneli eklenir.

2. **Zaman bloğu çizme ("bu saatlerde müsait değilim")** *(efor: orta · scheduler grid)*
   Haftalık grid üzerinde iş/spor/servis saatlerini boyayıp üretimde "yasak slot" olarak gönder.
   Coursicle/Navigate'in en sevilen özelliği. Özel etkinlik (custom event) olarak da takvime girer.

3. **Program karşılaştırma & favori/pin** *(efor: düşük · `results/page.tsx`)*
   Üretilen 20 program arasında 2-3 tanesini yan yana karşılaştır, favorile, "yedek program" olarak işaretle.
   Coursicle "multiple backup schedules" mantığı.

4. **PNG / görsel export + sosyal paylaşım** *(efor: düşük · `lib/scheduleExport.ts`)*
   PDF/iCal var; haftalık grid'in PNG görselini indir/kopyala (Instagram story, WhatsApp için). Çok talep edilir.

5. **Koyu tema (dark mode)** *(efor: düşük · Tailwind)*
   Standart beklenti, görece ucuz.

### P1 — Orta efor, belirgin değer

6. **Karar destek verisi: hoca puanı / ders değerlendirmesi** *(efor: orta-yüksek · yeni tablo + UI)*
   CourseTable/Berkeleytime'ın kalbi. Section listesinde hoca yanında **yıldız/puan ve yorum**.
   - Aşama 1: Kendi içinde basit değerlendirme (1-5 + yorum), `GlobalCourse`'a bağlı yeni `CourseReview` tablosu.
   - Aşama 2 (varsa veri): geçmiş **not dağılımı** rozeti ( "ortalama BA", AntAlmanac/Berkeleytime tarzı).

7. **Arkadaş programı çakıştırma / ortak boş zaman** *(efor: orta · `friends.py` + UI)*
   Arkadaş zaten var ama pasif. "Arkadaşımla **ortak boş saatleri** bul" (yemek/çalışma molası),
   programları üst üste bindirip karşılaştır. CourseTable "friends" özelliğinin asıl faydası bu.

8. **Çok dönemli plan + basit mezuniyet takibi** *(efor: yüksek · yeni model)*
   Stellic/DegreeWorks tarzı hafif sürüm: dönem dönem ders planı, alınan/kalan kredi sayacı,
   ön koşul doğrulaması (prereq verisi zaten parse ediliyor), GPA "what-if" hesaplayıcı, mezuniyet geri sayımı.

9. **Çakışmaya izin yerine "section değiştir" akıllı önerisi** *(efor: orta · `generate.py`)*
   `max_conflicts > 0` ile çakışmalı program üretmek yerine, çakışan section için **alternatif section öner**
   ("D2 grubu çakışıyor, D4'e geçersen sorun kalmıyor"). scheduler'da kısmen alternatif mantığı var, üretime taşı.

10. **Google Calendar iki yönlü / canlı abonelik (.ics feed)** *(efor: orta)*
    Tek seferlik iCal indirme yerine, takvime **abone olunan** bir feed URL'si (program değişince güncellenir),
    "Add to Google Calendar" butonu. CourseTable bunu ekledi.

### P2 — Yüksek efor / altyapı gerektirir

11. **Açık kontenjan takibi & bildirim** *(efor: yüksek · canlı veri kaynağı gerekir)*
    Coursicle'ın "killer feature"'ı. Dolu section'da yer açılınca e-posta/push.
    ⚠️ Excel anlık görüntü olduğu için **canlı kontenjan beslemesi** (OBS scrape/API) ister; mimari karar.

12. **Kampüs haritası & binalar arası yürüme süresi** *(efor: yüksek · konum verisi gerekir)*
    AntAlmanac tarzı: derslerin haritada gösterimi, ardışık derslerde "10 dk'da yetişemezsin" uyarısı.
    Işık kampüsü bina koordinatları gerekir.

13. **Doğal dil / AI asistanı** *(efor: yüksek)*
    "Cuma boş, sabah 10'dan önce ders yok, X hoca olsun" → otomatik tercih + üretim.
    P0 #1'deki tercih motoru üstüne ince bir LLM katmanı olarak oturur.

14. **PWA / mobil + push** *(efor: yüksek)*
    Mobil uygulama veya yüklenebilir PWA; #11'deki bildirimlerin taşıyıcısı.

15. **LMS/ödev entegrasyonu** *(efor: yüksek)*
    Coursicle'daki Canvas/Moodle ödev içe aktarma; program ile ödev/sınav takvimini birleştir.

---

## 4. Mevcut özelliklerde düzenlenebilecekler (iyileştirme)

- **Üretim sonuçlarının kalıcılığı:** `JOBS` in-memory → restart'ta kaybolur. Üretilen/kaydedilen
  programları DB'ye al, "program geçmişi" özelliğine dönüştür. (MAINTENANCE_PLAN Phase 2.1 ile uyumlu.)
- **Skorlama şeffaflığı:** `generate.py` skoru (`(10-conflict)*50 + ...`) kullanıcıya gizli. Her programın
  yanında **neden bu sırada** (rozetler: "0 çakışma", "Cuma boş", "kompakt") gösterilsin.
- **`max_ects` / `max_conflicts` UI'ı:** Şu an sayısal alanlar; tercih paneliyle (P0 #1) birleştirip
  anlaşılır hale getir; varsayılanlar (`DEFAULT_MAX_ECTS=31`, `MAX_CONFLICTS=1`) açıklamalı sunulsun.
- **Sonuç limiti:** Üretim 100'de kesip 20 döndürüyor. Büyük seçimlerde "en iyi 20" yerine sayfalama/
  "daha fazla göster" ve hangi kriterle elendiğini belirt.
- **Instructor filtresi:** Tek hoca seçtiriyor; çoklu seçim + "bu hocadan kaçın" (negatif filtre) eklenebilir.
- **Paylaşım linki UX'i:** `/shared/[id]` salt görüntü; "bu programı kopyala/düzenlemeye başla" CTA'sı ekle.
- **Arkadaş sistemi:** Yalnızca istek/kabul var; programı arkadaşa **paylaş** ve karşılaştır akışıyla anlam kazanır (P1 #7).
- **Boş ekran/onboarding:** İlk girişte Excel formatı + örnek dosya + 3 adımlık rehber; yükleme hatalarında
  daha açıklayıcı mesaj (parse hataları kullanıcı diline).
- **Erişilebilirlik:** Grid'de renk + desen/etiket (renk körlüğü), klavye navigasyonu, kontrast.
- **README vs. gerçek:** README hâlâ PostgreSQL/Redis/Celery/çok algoritma iddia ediyor; `algorithm`
  parametresi yok sayılıyor. Doküman gerçek (SQLite + senkron) ile hizalanmalı (CLAUDE.md "Docs vs reality").

---

## 5. Önerilen sıralama (yol haritası özeti)

1. **Önce P0**: tercih tabanlı puanlama (#1) + zaman bloğu çizme (#2) — rakiplerle en büyük farkı kapatır, mimariyi değiştirmez.
2. **Sonra karar destek**: hoca puanı/değerlendirme (#6) ve skor şeffaflığı (Bölüm 4) — geri dönüş/tutundurma artırır.
3. **Sonra sosyal**: arkadaş çakıştırma (#7) + görsel paylaşım (#4).
4. **Altyapı hazırsa**: kontenjan bildirimi (#11) ve çok dönemli plan (#8) büyük yatırımlar.

---

## Kaynaklar

- [Coursicle — College Schedule Maker](https://www.coursicle.com/college-schedule-maker/)
- [Coursicle — Free Course Planner](https://www.coursicle.com/course-planner/)
- [AntAlmanac (UCI Schedule Planner)](https://antalmanac.com/)
- [Berkeleytime — Scheduler](https://berkeleytime.com/schedules) · [Releases](https://berkeleytime.com/releases)
- [CourseTable büyüyor, yeni özellikler — Yale Daily News](https://yaledailynews.com/articles/coursetable-grows-in-popularity-adds-new-features)
- [uAchieve Schedule Builder — CollegeSource](https://collegesource.com/degree-planning-tools/uachieve-schedule-builder/)
- [Stellic Progress — Degree Planner](https://www.stellic.com/progress)
- [Course Compass — AI Academic Advisor](https://course-compass.com/)
- [Modern Campus Navigate — Student Schedule Optimization](https://moderncampus.com/products/student-schedule-optimization.html)
- [Cal Poly Schedule Builder (waitlist göstergeleri)](https://registrar.calpoly.edu/schedulebuilder)
- [Rate My Professors](https://www.ratemyprofessors.com/)
