# R0 ↔ R1 Sonuç Sözleşmesi (frontend tüketici önerisi)

> Amaç: codex'in R0 (backend üretim doğruluğu/çeşitliliği) tasarımı ile Claude'un R1 (sonuç ekranı UX)
> işini **stabil bir JSON sözleşmesi** üzerinden ayırmak. Aşağısı R1'in backend'den **gerçekten ihtiyaç
> duyduğu** şeyin önerisidir; codex nihai sahibi — onaylasın/düzeltsin.
>
> Tümü **additif** (mevcut alanlar değişmez) → K6 / response-shape stabil.

## 1) Program nesnesi (mevcut + ekler)

```jsonc
{
  "id": "1",
  "courses": [ /* section listesi — MEVCUT; = variants[0] (geri uyum) */ ],
  "total_ects": 28,        // mevcut
  "conflict_count": 0,     // mevcut
  "course_count": 5,       // mevcut
  "score": 86,             // mevcut (UI'da "sıralama puanı" olarak geri plana alınacak)

  // YENİ — codex onayı: gruplama imzası = (main_code + type + schedule); section kodu/hoca DAHİL DEĞİL.
  // Aynı haftalık yerleşimin hoca/section varyantları. Payload'da en çok 5 varyant.
  "variant_count": 12,     // gerçek toplam (payload 5 ile sınırlı olsa da UI "12 varyant" diyebilsin)
  "variants": [
    [ /* section-set A */ ],
    [ /* section-set B */ ]
  ]
}
```

- `courses` **= `variants[0]`** kalır (mevcut tüketiciler kırılmaz).
- Gruplama anahtarı **`main_code+type+schedule`** (codex onayı) — salt occupancy değil; farklı dersler yer
  değiştiriyorsa yanlış birleşmez. Payload **en çok 5** varyant; gerçek toplam `variant_count`.
- `variant_count ≤ 1` ise UI tek program; ≥2 ise "aynı saat düzeni · N hoca/section seçeneği".
- Varyantlar arasındaki farkı (hoca/section kodu) **frontend diff'ler**; backend ekstra etiket vermesin.

## 2) Üst zarf + teşhis (YENİ)

```jsonc
{
  "schedules": [ /* yukarıdaki nesneler — MEVCUT */ ],

  "diagnosis": {                       // YENİ
    "status": "ok" | "empty",
    "result_count": 3,                 // dedup sonrası DISTINCT program sayısı
    "reasons": [                       // yapısal — DÜZ METİN DEĞİL; codex onaylı başlangıç kümesi
      { "code": "missing_course",             "data": { "course": "ELEC2207" } },
      { "code": "missing_required_component", "data": { "course": "ELEC2207", "type": "lab" } },
      { "code": "locked_blocks_course",       "data": { "course": "GİTA1106" } },
      { "code": "ects_exceeded",              "data": { "limit": 31, "min_possible": 34 } },
      { "code": "conflict_limit_exceeded",    "data": { "limit": 0 } }
    ]
    // pair_conflict: yalnız "tüm geçerli section kombinasyonlarında bu çift engelliyor" İSPATLANIRSA. Backend tahmin yürütmez.
  }
}
```

- **i18n kararı:** `reasons` yalnız `code` + `data` taşır; tr/en metni **frontend** (`LanguageContext`)
  üretir. → backend prose döndürmez, `LanguageContext.tsx`'e dokunmaz.
- `status: "empty"` + dolu `reasons` = R1'in "Uygun program bulunamadı + sebep" ekranını besler.
- Locks artık product-öncesi uygulanacağı için (R0), "empty" gerçek-empty demektir (false-negative biter).

## 3) Frontend kendi hesaplar — backend'den İSTEMİYORUM
`free_days`, `total_gaps`, `earliest/latest`, `busiest_day`, "Neden bu program?" veri-sebepleri →
mevcut `computeScheduleStats(courses)` ile **frontend** üretir. Backend per-schedule metrik eklemesin
(sözleşmeyi küçük tutar).

## 4) Kararlar (codex onayladı)
1. Varyant anahtarı = **`main_code + type + schedule`** (section/hoca hariç) — salt occupancy DEĞİL.
2. Varyant **üst sınırı 5** + `variant_count` (gerçek toplam) dönülür.
3. Diagnosis başlangıç kodları: `missing_course`, `missing_required_component`, `locked_blocks_course`, `ects_exceeded`, `conflict_limit_exceeded`. `pair_conflict` yalnız ispatlanırsa.
4. **`score` kalır, `rank` yok** (çeşitlilik seçimi gelince sıra saf-skor olmayabilir). İleride `selection_reason`/`highlights`.

**R0 çekirdek kapsamı (codex):** `locked_slots` normalizasyonu + arama-öncesi seçenek filtreleme ·
güvenli yerleşim gruplama · `courses=variants[0]` · `variant_count` · backend testleri.
Derin diagnosis / DFS / çeşitlilik seçimi sonraki tur.

## 5) Dosya sahipliği (eşzamanlı çalışma)
| Alan | Sahip |
|---|---|
| `backend/app/api/routes/generate.py`, arama/dedup, pytest | **codex** |
| `frontend/app/components/GeneratedSchedulesView.tsx` (sonuç UI) | **claude** |
| `frontend/app/context/LanguageContext.tsx` (R1 metinleri + diagnosis stringleri) | **claude** |
| `frontend/app/scheduler/page.tsx` — yalnız 0-sonuç akış teli (results'ı diagnosis ile aç) | **claude** (küçük) |

- Ayrı branch/worktree; `generate.py`'a ben dokunmam, frontend dosyalarına codex dokunmaz.
- Sıra: codex contract+R0 çekirdek → claude R1 (bu sözleşmeye göre) → codex entegrasyon/edge review →
  sonra DFS/çeşitlilik/diagnosis derinleştirme → en son Faz 3 scoring.
