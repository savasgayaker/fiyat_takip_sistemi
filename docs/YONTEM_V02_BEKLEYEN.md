# Yöntem v0.2 — bekleyen konular (kodlanmadı)

> v0.1 = `endeks_deneme.py` (10.09.2026) matematiğinin birebir taşınması (`C:\FiyatTakip\fiyat_takip\endeks\`).
> Aşağıdakiler v0.1'de **bilinçli olarak değiştirilmedi**; v0.2'de yeni `yontem_surumu` ile paralel seri olarak
> ele alınacak (`endeks_yeniden_hesapla.py --baslangic --surum`). Karar tarihi: 11.09.2026.

## 1. Zincir sapması (chain drift) — günlük zincirli eşleşen-çift Jevons
- v0.1 sınıf endeksi her gün bir önceki güne zincirlenir: `I(t) = I(t−1)·exp(mean_i[ln p_i(t) − ln p_i(t−1)])`.
  Eşleşen kalem kümesi her gün değişir; fiyatı geçici düşüp geri gelen kalemler (K24 hafta sonu kampanya döngüsü,
  Market/Gıda promosyonları) kümeye giriş-çıkışla **sistematik sapma** yaratabilir (klasik "chain drift").
- Belirti: gıda serisinde hafta sonu salınımı; uzun dönemde zincirli seri sabit-bazlı seriden ayrışır.
- v0.2 adayları: (a) **sabit baza karşı Jevons** (`I(t) = exp(mean_i[ln p_i(t) − ln p_i(baz)])`, baz gününde fiyatı olan
  kalemler; yeni kalemler bazsız kalır → kapsam daralır), (b) **pencere-GEKS** (örn. 13 günlük pencere, çok yönlü
  eşleşme; drift'siz, hesap ağır), (c) 7 günlük hareketli düzeltme (K24 için geçici). Karşılaştırma ölçütü: aynı
  pencerede zincirli vs sabit-bazlı vs GEKS serisinin farkı (puan) ve TÜİK aylık değişimle uyum.

## 2. CARRY_TEMSIL kuralı
- Az kalemli yüksek ağırlıklı sınıflar (otel 11201 → 5 kalem, uçak 07331 → 6 kalem…) tek kalem hareketiyle bölüm
  endeksini sürükleyebiliyor. v0.1'de yalnız UI etiketi var ("temsil zayıf": ağırlık ≥ 0,3 ∧ kalem < 10 ∧ tarife
  listesinde değil).
- v0.2 adayı: eşik altı temsilde sınıf endeksi **üst sınıf (4 hane / grup) endeksiyle temsil edilir** (`CARRY_TEMSIL`
  durumu), ağırlık üst sınıfa devredilir; kalem sayısı eşiği aşınca kendi zincirine döner. `hiyerarsi_dus` ile aynı
  mantık, ters yönde. Tarife sınıfları (config/tarife_siniflari.json) muaf.

## 3. Vintage politikası (yayımlanan gün dokunulmaz) — **belge kararı, v0.1'de uygulanıyor**
- Gece zinciri `veri_yukle --gun 3` son üç günü yeniden yükler; `coicop_esleme` eşlemeyi her gece yeniden kurar.
  Dolayısıyla t−1 gününün kalem medyanları t günü koşusunda **revize olabilir**.
- Kural: t günü halkası **güncel DB'deki** t−1 ve t kalem fiyatlarıyla kurulur (`ln p_i(t) − ln p_i(t−1)` revize
  fiyatlarla); yayımlanan `I(t−1)` ve `ham(t−1)` **tablodan okunur, değiştirilmez** (`INSERT OR IGNORE`).
  Tam yeniden hesap yalnız yeni `yontem_surumu` ile paralel seri olarak yapılır.
- Sonuç: tablo serisi ile "bugün sıfırdan hesaplanan" seri küçük farklar taşıyabilir. Regresyon testi bunu ölçer
  (`tests/test_regresyon.py` (b): 09-09 ve 09-10 csv sapmaları `tests/regresyon_raporu.txt`'a yazılır).

## 4. Diğer notlar (v0.1'de olduğu gibi kalır)
- `eslesme_min = 3`, sınıf evreni küçükse eşik evrene düşer (tarife sınıfları için 1–2 kalem).
- Bazda olmayan sınıf ilk göründüğü gün 100 kabul edilir; ilk günden itibaren `CARRY_GUN_YOK` ile taşınır ve
  Laspeyres paydasına ağırlığıyla girer (kapsanan ağırlık sabit %93,54, 145 sınıf).
- Kaynak kırılımı (`endeks_sinif_kaynak`) aynı Jevons'u `(sınıf, kaynak)` çiftinde koşturur; kaynak anahtarı
  `casefold + strip` (+ Türkçe İ noktası atılır): `Migros/migros`, `BİM/bim` tek kaynak; `ŞOK/sok` ayrı kalır
  (ASCII katlama v0.2'de değerlendirilebilir).
- Dışlama (§5): `veri_turet.py` bant kapısı **[0,4×, 2,5×]** (son geçerli günlük medyana göre, kalem içi) ve
  `disi_listesi.json`; "±%40" ifadesi yanlıştı, METODOLOJI.md düzeltildi.
