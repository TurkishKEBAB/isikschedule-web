# Sonuç Ekranı (Generated Schedules) — Eleştirel İnceleme Raporu

> Kapsam: `frontend/app/components/GeneratedSchedulesView.tsx` (program üretildikten sonra açılan
> "Sana en uygun haftalık programı seç" ekranı). ChatGPT yorumlarının değerlendirmesi + kendi
> eleştirel eklemelerim. Mevcut gerçek davranışa dayanır.

## TL;DR (yöneticiye özet)

ChatGPT'nin yorumlarının **çoğu doğru ve uygulanabilir**, ama hepsi aynı tek kök sorunun farklı
yüzleri: **ekran "bol alternatif var" varsayımıyla tasarlanmış, oysa motor çoğu zaman az ya da
birbirine çok benzeyen alternatif üretiyor.** En yüksek getiri sırası:

1. **0-sonuç durumu** (şu an sadece toast — gerçek bir ekran yok) → en büyük güven açığı.
2. **State-aware başlık + aksiyonlar** (1 / birkaç / çok) → ucuz, yüksek etki.
3. **"Neden bu program?" paneli** → zaten yaptığım skor-kırılımı ipucunu görünür panele terfi ettir.
4. **Tek birleşik 3-kolon sonuç ekranı** (ChatGPT #22) → scheduler'da kurduğumuz command-center ile tutarlı son hal.

Ama #22'nin "arketip etiketli kartlar" fikri ancak **anlamlı çeşitlilik** üretirsek dürüst olur —
bu yüzden gerçek ön koşul, ChatGPT'nin hiç adını koymadığı **sonuç çeşitliliği/tekilleştirme** sorunudur.

---

## Madde madde değerlendirme

| # | ChatGPT yorumu | Verdiktim | Değer | Efor | Not |
|---|----------------|-----------|-------|------|-----|
| 1 | Başlık çok büyük; state'e göre değişmeli (1 vs çok) | **State-aware: kabul** / büyüklük: kısmen | Yüksek | Düşük | Başlık hep "…seç" diyor (çoğul varsayımı). Eyebrow zaten sayıyı içeriyor ama başlık & subtitle "favorile/karşılaştır/seç" hep çokluk varsayıyor. |
| 2 | Sağ taraf boş; "Neden bu program?" sağa koy | **Güçlü kabul** | Çok yüksek | Orta | 1-2 kartta kart grid'i (`lg:grid-cols-3`) gerçekten sağda kocaman boşluk bırakıyor. |
| 5 | Tek alternatifte "Karşılaştır" saçma | **Kabul, ucuz** | Orta | Düşük | Buton her kartta sabit; ≤1 sonuçta gizlenmeli. |
| 12 | Buton etiketleri belirsiz/tutarsız | **Çoğu kabul, ucuz** | Orta | Düşük | "Kopyala" → "Bağlantıyı kopyala" (gerçekten linki kopyalıyor) iyi. **Küçük itiraz:** "Takvime ekle" .ics indiriyor, eklemiyor — "Takvime aktar (.ics)" daha dürüst; alt-açıklama eklenebilir. Sentence-case tutarlılığı haklı. |
| 18 | 1 / 0 alternatif durumları özel tasarlanmalı | **En güçlü kabul** | Çok yüksek | Orta | **0-sonuç şu an hiç ekran değil — sadece `backendConflict` toast'ı.** Gerçek bir "uygun program bulunamadı + sebep" ekranı yok. En büyük açık. |
| 19 | Karşılaştırma metrik tablosu + mini takvimler | **Geliştirme olarak kabul** | Yüksek | Orta | **ChatGPT yanılıyor: karşılaştırma "eksik" değil — var** (alt bar + modal, **max 2** program, MiniGrid + ECTS/çakışma/boş gün). Ama metrik matrisi (skor/çakışma/boş gün/ara/ilk/son/yoğun gün) ve 2'den fazla destek gerçek bir yükseltme olur. |
| 20 | "Neden bu program?" açıklaması | **Güçlü kabul; kısmen zaten başladı** | Çok yüksek | Orta (+backend) | Skor-kırılımı ipucunu (LockingTooltip + ScoreExplanation) zaten ekledim. Veriden türetilebilir sebepler (çakışma yok, boş gün, ara süresi, tüm dersler yerleşti) **şimdi** yapılabilir. "BUSI1302.1 seçildi çünkü .2 çakışıyordu" gibi **section-bazlı gerekçe backend'in seçilen/elenen section'ı yayınlamasını gerektirir** (ayrı iş). |
| 22 | Radikal: tek 3-kolon sonuç ekranı, sol arketip kartlar, orta takvim, sağ skor+açıklama | **Son hal olarak kabul** | Çok yüksek | Yüksek | Scheduler'daki command-center ile **tutarlı**. Mevcut iki-bölümlü yapıyı (kart grid + ayrı "paylaşılabilir kart") birleştirir. **Ama** "En dengeli / En az boşluklu / Boş günlü…" etiketleri ancak gerçek çeşitlilik üretirsek anlamlı (aşağıdaki kök sorun). |

---

## ChatGPT'nin kaçırdığı / yanlış olan noktalar (kendi eleştirim)

1. **Kök sorunu adlandırmıyor: sonuç çeşitliliği.** `generate.py` çakışmasız kombinasyonları tek bir
   skora göre sıralayıp ilk 20'yi döndürüyor; ama bu 20'nin çoğu **aynı hocalar, farklı lab/ps** olan
   neredeyse-aynı programlar. "20 alternatif" desek bile **anlamlı** alternatif az. ChatGPT'nin tüm
   "bolluk varsayımı" şikâyetleri buradan kaynaklanıyor. Çözüm: sonuçları **anlamlı farka göre
   tekilleştir/kümele** (farklı ders section'ı, farklı boş gün, farklı ara profili) ve birkaç **belirgin**
   arketip göster. #22'nin etiketli kartları ancak bununla dürüst olur.

2. **"Karşılaştırma eksik" yanlış.** Var ama zayıf: max 2 program ve metrik matrisi değil. Doğru çerçeve
   "yok" değil, "sığ + 2 ile sınırlı".

3. **0-sonuç gerçekten kör nokta.** ChatGPT #18'de değiniyor ama vurgu az. Bugün kullanıcı hiçbir
   açıklama görmeden sadece bir toast alıyor; bu, üründe **güven kaybının** en büyük kaynağı. "Hangi
   ders çifti her seçenekte çakışıyor" client-side hesaplanabilir (seçili main_code'ların ikili çakışma
   matrisi) — backend'siz mümkün.

4. **Skorun "anlamı" sorgulanmıyor.** Büyük "86" rozeti "86 / kaç?" sorusunu davet ediyor. Skor mutlak
   bir kalite değil, **sıralama** için bir sayı. Ya bağlamlandır (eklediğim kırılım panelini görünür yap)
   ya da ham sayıyı geri plana al, **insan-okur metrikleri** (0 çakışma · 1 boş gün · 1s ara) öne çıkar.

5. **Bugün zaten iki-bölüm var.** Kart grid'i + altında ayrı "paylaşılabilir kart" — #22'nin birleştirmesi
   bu mevcut tekrarı da çözer. ChatGPT bunu fark etmemiş.

6. **Mobil plan yok.** 3-kolon (#22) için kartlar yatay kaydırıcıya / sekmeye düşmeli; ChatGPT masaüstü
   varsayıyor.

---

## Doğrulanmış backend bulguları (kodla teyit edildi)

İki kritik üretim hatası **gerçek kodda doğrulandı** — sonuç ekranı kozmetiğinden önce bunlar gelir:

1. **Global en iyi değil, "ilk 100'ün en iyi 20'si".** `generate.py`: `if len(valid_schedules) >= 100: break`
   → skorla → `return schedules[:20]`. Sonuçlar `product()` sırasına bağımlı; daha iyi/farklı kombinasyonlar
   hiç değerlendirilmeyebilir.
2. **`locked_slots` gönderiliyor ama üretimde kullanılmıyor.** Frontend `params.locked_slots` yolluyor
   (`page.tsx:1130`); backend yalnız `max_ects`+`max_conflicts` okuyor; frontend dönen 20'yi **sonradan**
   kilitlere göre filtreliyor (`page.tsx:1148`). → İlk 100 hep kilitli slot kullanırsa **false-negative 0-sonuç**.

**Düzeltme: "hepsini tara" DEĞİL** (`product()` kombinatoryal patlar; cap bu yüzden var). Doğrusu:

- **(en yüksek kaldıraç) Kilitleri product ÖNCESİ uygula** — kilitli slota değen section'ları enumerasyondan
  önce ele. Aynı anda: kilitleri uygular + false-negative'i bitirir + arama uzayını küçültür.
- Artımlı budama (gerçek DFS — param zaten `"dfs"` ama kod `product()`).
- **Occupancy imzasıyla dedup** ((gün,period) kümesi) → işlevsel-aynı programları çök.
- Çeşitlilik seçimi (farklı hedeflerin temsilcileri) — #22 arketiplerinin ön koşulu.
- Yapısal **`diagnosis`** döndür (gerçek-0 vs ECTS/eksik-section/kilit kaynaklı) — client-side teşhis
  tek başına güvenilmez (ECTS, lecture-lab-ps birlikteliği, eksik section da neden olabilir).

## Önerilen yol haritası (sonuç ekranı — scheduler fazlarından ayrı)

**R0 — Üretim doğruluğu & çeşitliliği (ÖNCE; R1 ile paralel yürüyebilir):**
Minimum çekirdek = **kilitleri product öncesi uygula** + **occupancy dedup** (false-negative'i ve "tek
alternatif" görüntüsünün büyük kısmını çözer). Sonra: DFS budama, çeşitlilik seçimi, `diagnosis` alanı.
Backend dokunuşu → `pytest` zorunlu. **Dev bir yeniden yazım değil**; cerrahi tutulmalı.

**R1 — Ucuz & yüksek getiri (state-aware + copy):**
- Başlık/eyebrow/subtitle ve aksiyonlar **duruma göre**:
  - 0 → "Uygun program bulunamadı" + **sebep** (çakışan ders çifti, client-side) + `[Tercihleri değiştir] [Dersleri düzenle]`. (Bugünkü toast'ı gerçek ekrana çevir.)
  - 1 → "1 uygun program bulundu" + `[Programı incele] [Takvime aktar] [PDF]` (Karşılaştır/Favori gizli).
  - ≥2 → mevcut çoklu akış + "Karşılaştır".
- Micro-copy: "Kopyala" → "Bağlantıyı kopyala"; sentence-case tutarlılığı; "Takvime aktar (.ics)" altına küçük ".ics indir" açıklaması.

**R2 — Orta (açıklama + gerçek karşılaştırma):**
- **"Neden bu program?" görünür paneli** — eklediğim `ScoreExplanation` içeriğini hover-tooltip'ten kalıcı sağ panele terfi ettir; veriden türetilen sebepler (tüm dersler yerleşti, çakışma yok, boş gün, toplam ara).
- Karşılaştırmayı **metrik matrisine** yükselt (skor/çakışma/boş gün/ara/ilk/son/yoğun gün) + mini takvimler; 2 sınırını gözden geçir.

**R3 — Büyük bahis (birleşik ekran + çeşitlilik):**
- Tek 3-kolon sonuç ekranı (#22): sol = **tekilleştirilmiş, arketip-etiketli** alternatifler · orta = seçili takvim · sağ = skor + "neden" + ders listesi + dışa aktar.
- Ön koşul: backend/clientte **anlamlı-fark kümeleme** (yoksa etiketler sahte olur).
- (Opsiyonel, backend) generate.py seçilen vs elenen section'ı yayınlasın → section-bazlı gerekçe ("X seçildi çünkü Y çakışıyordu").

---

## Bağlantı: scheduler command-center ile tutarlılık
R3, scheduler için kurduğumuz **sol katalog · orta grid · sağ panel** dilini sonuç ekranına taşır →
ürün baştan sona tek bir görsel/etkileşim dili konuşur. Bu yüzden #22'yi "ayrı bir fikir" değil, aynı
mimarinin ikinci yarısı olarak görüyorum.
