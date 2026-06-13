# IşıkSchedule — Kalan İşler & İş Bölümü (Claude · opencode-zen · Gemini)

> Codex'in token'ı bitti. Kalan işi **Claude (hands-on implementer, full repo context)**,
> **opencode-zen (derin algoritma/backend muhakemesi)** ve **Gemini (geniş kapsam, analiz, test, doküman)**
> arasında bölüyoruz. Her madde için **sahip** + **neden o ajan** yazıldı. Eşzamanlı çalışmada
> §6'daki dosya-sahipliği kurallarına uyun (aynı dosyada çakışmayın).

Bu dosya canlı yol haritasıdır; iş aldıkça maddeyi güncelleyin (durum: ☐ todo · ◑ devam · ☑ bitti).

---

## 1) Durum (bitenler)

- **Scheduler:** 3-bölgeli command-center (sol katalog · grid+sağlık çubuğu · sağ Build panel), grid'e
  sürükle-ile-meşgul-saat boyama. ☑
- **Results R0 (backend, codex):** locks pre-filter · güvenli yerleşim gruplama (`main_code+type+schedule`)
  · `variants≤5` + `variant_count` · DFS+MRV+bitmask · yapısal diagnosis · MMR top-K · 24 test. ☑
- **Results R1–R3 (frontend, claude):** state-aware (0/1/N) · variant picker · 0-state + diagnosis
  metinleri (tr/en) · "Neden bu program?" paneli · 3'lü metrik-matris karşılaştırma · **birleşik 3-kolon
  workspace** (kart rayı | detay) · **arketip etiketleri**. ☑
- **Son düzeltmeler (claude):** variant seçimi artık **tabloyu da** güncelliyor (sadece metni değil) ·
  arketip etiketleri yalnız **benzersiz-en-iyi + varyasyon** varsa gösteriliyor (yanıltıcı "En çok boş gün"
  kalktı). ☑

---

## 2) Bilinen sorunlar / kullanıcı geri bildirimi

1. **"Aynı puan" sorunu (kök neden — yüksek öncelik).** `score = (10−conflict)*50 + course_count*20 +
   total_ects`. Aynı ders kümesinin **tüm layout'ları aynı skoru** alıyor (course_count/ects sabit,
   conflict çoğu zaman sabit) → 9 program da 598. Sıralama ties içinde anlamsız, kullanıcı "hepsi aynı"
   görüyor. **Çözüm: skor layout kalitesini (boşluk/kompaktlık/boş gün/saat tercihi) içermeli** → Faz 3
   tercih-tabanlı scoring tam da bunu kırar. (zen review + claude Faz 3.)
2. **Skorun öne çıkması.** Hepsi 598 iken büyük "598" rozeti kafa karıştırıcı. Skoru geri plana al,
   ayırt edici insan-metriğini (boşluk/boş gün/ilk-son) öne çıkar. (claude — frontend.)
3. **Variant özelliğinin değeri (ürün sorusu).** Üretici zaten tercih edilen section'ları çıktı veriyor;
   "aynı saatte farklı hoca" seçiciliği faydalı ama gereksiz görünebilir. Konum: korunmalı mı, sadeleşmeli
   mi? (zen/gemini ürün-eleştirisi + claude UX.)

---

## 3) Kalan iş kümeleri

### Scheduler Faz 3 — Akıllı üretim tercihleri  → **Claude (uçtan uca)** — ☑ (UI screenshot hariç)
*Neden claude:* frontend tercih UI'ı + ince backend scoring; kullanıcı "başla ve bitir" dedi.
- ☑ Frontend `PreferencesPanel`: en erken/en geç ders (period aralığı), boş gün çipleri (Pzt–Cum),
  boşluk tercihi (Sıkışık/Dengeli/Seyrek). (maxEcts/maxConflicts yanına.)
- ☑ Params generate isteğine eklendi (§7): `earliest_period, latest_period, days_off, gap_preference`.
- ☑ Backend `solver.py`: tercihler **efektif-skor** (score − misfit penalty) olarak **sıralama+çeşitlilik
  seçimine** katılıyor. **Gösterilen skor/açıklama DEĞİŞMEZ** (compact→0 boşluk, spread→4 boşluk, skor 574
  ikisinde de). Nötr tercihte penalty=0 → regresyon yok.
- ☑ `pytest` 24/24 + fonksiyonel doğrulama; tr/en metinler eklendi.
- ☐ (Kalan) Çalışan UI ekran görüntüsü doğrulaması (dev sunucu açıkken).
- **Not:** "598 her yerde aynı" *görsel* sorunu skoru kasıtlı sabit tuttuğumuz için sürüyor → ayrı
  frontend işi: **skoru geri plana al** (aşağıdaki "Results polish" #2). Tercihler artık seçimi etkiliyor.

### Diversity & scoring modeli (algoritma)  → **opencode-zen**
*Neden zen:* derin algoritma; "aynı puan/benzer layout" kök nedeni ve MMR seçiminin gerçekten ayırt edip
etmediği saf backend muhakemesi.
- ☐ **Critical review:** `_select_diverse_schedules` (MMR) tüm-tied skorlarda gerçekten farklı layout'lar
  mı seçiyor? Mini-grid'ler neden benzer? Çeşitlilik metriği occupancy-mesafesi mi olmalı?
- ☐ Skor ties'ı kırmak için Faz 3 scoring'iyle koordineli öneri (claude scoring'i yazınca review et).
- ☐ Performans: DFS/bitmask 100-layout cap + `search_complete`, büyük seçimlerde `elapsed_ms`.

### Backend geniş eleştiri & test & doküman  → **Gemini**
*Neden gemini:* geniş bağlam + titiz analiz; sözleşme/güvenlik/edge-case/test taraması.
- ☑ **Critical review:** generate.py response sözleşmesi stabilitesi; in-memory `JOBS` (restart'ta kayıp,
  race?); `/api/generate` auth'lu mu/olmalı mı; hata yolları.
- ◑ `excel_loader` sağlamlığı: bozuk/eksik kolonlu xlsx, encoding; **1396→1301 satır neden düşüyor** (veri
  kalitesi).
- ◑ Güvenlik: `file_id` path traversal (iddia: çözüldü — doğrula), upload validasyonu.
- ☑ Test kapsamı: diagnosis kodları, variant gruplama, locks pre-filter, 0-state edge'leri için pytest.
- ☑ Docs-vs-reality: README hâlâ PostgreSQL/Redis/Celery iddia ediyor — gerçekle (SQLite+senkron) hizala.

### Results polish (frontend)  → **Claude**
- ☐ Skoru geri plana al (sorun #2); same-score'da ayırt edici metriği vurgula.
- ☐ ( Opsiyonel ) "favori" programları kalıcılaştır / dışa aktarımda göster.

### Scheduler Faz 4 — Section karşılaştırma paneli (frontend)  → **Claude** (ürün kararı sonrası)
- ☐ Bir derse tıklayınca tüm section'ları yan yana (çakışma önizlemeli); hoca/koltuk/not için opsiyonel
  alan iskeleti. (Önce sorun #3 ürün kararı.)

### Scheduler Faz 5 — Aurora görsel & hareket (frontend)  → **Claude**
- ☐ Scheduler kabuğuna Aurora; blok ekle/çıkar animasyonu; `kombai-ui-prompt.md`'deki performans bütçesi.

---

## 4) zen & Gemini'ye **eleştirel backend** istekleri (özet)

**zen'e:** "solver.py'ı algoritmik olarak eleştir. Özellikle: (1) skor neden aynı ders kümesinin tüm
layout'larında sabit, bu sıralamayı/çeşitliliği nasıl bozuyor; (2) `_select_diverse_schedules` gerçekten
ayırt edici mi yoksa near-duplicate mı döndürüyor; (3) Faz 3 tercih scoring'i ties'ı kırmak için nasıl
modellenmeli. Kod yazmadan önce öneri + risk çıkar."

**Gemini'ye:** "Backend'e geniş eleştirel bak: response sözleşmesi/in-memory JOBS dayanıklılığı, auth,
excel_loader edge-case'leri (1396→1301 satır kaybı), güvenlik (path traversal/upload), eksik test kapsamı,
README-gerçek uyumsuzluğu. Bulguları önceliklendirilmiş liste + dosya:satır referanslarıyla ver."

---

## 5) Önceliklendirme (önerilen sıra)

1. **Claude:** Faz 3 (tercih UI + scoring) — "aynı puan" kökünü çözer, en yüksek etki.
2. **zen:** diversity/scoring review (Faz 3 ile paralel, claude scoring'ini review eder).
3. **Gemini:** backend geniş review + test (bağımsız, paralel).
4. **Claude:** results polish (skor geri plan) → Faz 4 → Faz 5.

---

## 6) Dosya-sahipliği (eşzamanlı çalışmada çakışmayın)

| Alan | Sahip |
|---|---|
| `backend/app/scheduling/solver.py` (scoring terimleri) | **claude** (Faz 3) — zen **review only**, ayrı PR/branch |
| `backend/app/scheduling/solver.py` (`_select_diverse_schedules`, diversity) | **zen** (claude scoring'e dokunmadan) |
| `backend/app/api/routes/generate.py` | **claude** (params plumbing) |
| `backend/tests/` | **gemini** (yeni testler) |
| `backend/app/core/excel_loader.py` | **gemini** (review/robustness) |
| `frontend/app/scheduler/page.tsx`, `components/scheduler/*` | **claude** |
| `frontend/app/components/GeneratedSchedulesView.tsx`, `LanguageContext.tsx` | **claude** |
| `README.md`, docs | **gemini** |

Kural: aynı dosyada iki ajan eşzamanlı düzenleme yapmaz; ayrı branch/worktree, sonra entegrasyon.

---

## 7) Faz 3 params contract (frontend ↔ backend)

Generate isteği `params`'ına **additif** alanlar (mevcut `max_ects`, `max_conflicts` korunur):

```jsonc
"params": {
  "max_ects": 31,
  "max_conflicts": 1,
  "locked_slots": [["Monday", 1]],     // mevcut
  "earliest_period": 2,                 // YENİ — bu period'dan önce ders istenmez (sert kısıt)
  "latest_period": 9,                   // YENİ — bu period'dan sonra ders istenmez (sert kısıt)
  "days_off": ["Friday"],               // YENİ — bu günler boş istenir (yumuşak: skor cezası)
  "gap_preference": "compact"           // YENİ — "compact" | "balanced" | "spread" (yumuşak: skor)
}
```

- **Sert** (earliest/latest/days_off-hard?): seçenekleri product-öncesi budar (locks gibi).
- **Yumuşak** (gap_preference, tercih edilen boş gün): `score`'a ağırlıklı terim → layout'ları ayrıştırır.
- Tümü opsiyonel; yoksa mevcut davranış. Response şekli değişmez (yalnız skor dağılımı çeşitlenir).
- i18n: yeni metinler `LanguageContext` (tr/en), backend prose döndürmez.

---

## 8) Açık ürün soruları (kullanıcı/ekip kararı)

- Same-score programlar: skoru gizle mi, "sıralama puanı" rozeti mi, yoksa Faz 3 scoring yetince yeter mi?
- Variant ("aynı saat farklı hoca") özelliği: korunsun / sadeleşsin / Faz 4 section paneline mi taşınsın?
- `/api/generate` auth gerekli mi (şu an public)?
