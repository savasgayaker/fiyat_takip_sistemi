# DÇK-EÖS Masaüstü Uygulaması — Claude Code Devir Notu (10.09.2026)

## 0. Durum
- Emergent ile üretilen iskelet GitHub'da (React+TS ön yüz, FastAPI arka uç, fikstür verisi, Tauri scaffold).
  İlk Claude Code görevi: **fikstürü gerçek SQLite'a bağlamak, sözleşme dışı fazlalığı budamak, PDF/Excel'i gerçek sayılara oturtmak.**
- Uygulama **hesaplamaz, okur.** Tüm hesaplar gece zinciriyle (GECE_KOSUSU.bat, 00:30) DB'ye yazılır. Tek istisna: Sepet ekranı sınıf endekslerinden anlık yeniden ağırlıklandırma yapar.
- Referans belgeler (repoya `docs/` altına konmalı): `DCK_EOS_Metodoloji_v0.1.docx` (yöntem + veri deseni + formüller), `EMERGENT_PROMPT_DCK_EOS.md` (API sözleşmesi ve ekran listesi), bu not.

## 1. Veri kaynağı: `C:\FiyatTakip\db\fiyat_takip.sqlite` (salt-okunur açılacak; `?mode=ro`)

| Nesne | Ne için | Notlar |
|---|---|---|
| `gozlem` | Tüm fiyat gözlemleri (≈1,8 M satır) | `kalite_durumu='HAZIR'` filtresi şart; sütunlar: kisim_no, panel_tipi, kimlik, kaynak, coicop, urun_adi, tarih, fiyat, birim, miktar, birim_fiyat, kalite_durumu, kalite_ham, konum, magaza, marka, url, run_id, kaynak_tablo, yukleme_zamani |
| `gozlem_coicop` | satir_sha → coicop2018, sinif5, sinif4, sinif3, bolum, agirlik5, agirlik4, yontem | Her gece yeniden kurulur |
| `v_gozlem_tufe` | gozlem ⋈ gozlem_coicop ⋈ tuik adları | Kalem tablosu / arama için tek görünüm |
| `tuik_agirlik_2026` | kod, seviye (2/3/4/5/7), ad_tr, ad_en, agirlik | COICOP ağacı buradan kurulur (seviye 2→3→4→5; 7 haneli maddeler ağırlıksız, ağaçta gösterilmez) |
| `v_kapsam_sinif5`, `v_kapsam_bolum` | Kapsam kartları | |
| `v_gozlem_ozet`, `v_katalog` | Kısım × gün özetleri; tablo kataloğu | Kalite ekranı |
| **Endeks tabloları — HENÜZ DB'DE YOK** | Bugün `endeks_deneme.py` yalnız dosya yazıyor: `C:\FiyatTakip\endeks\endeks_gunluk_<tarih>.csv`, `sinif_endeksi_<tarih>.csv`, `endeks_<tarih>.xlsx` | **İlk iş:** `endeks_deneme.py`'ye DB yazımı eklemek: `endeks_gunluk(tarih, duzey, kod, endeks, kapsanan_agirlik, sinif, kalem, carry_sinif)` ve `endeks_sinif(tarih, sinif, endeks, endeks_ham, eslesen_kalem, durum, agirlik, hiyerarsi_dus)`; her gece `DROP/CREATE`. Arka uç yalnız bu iki tabloyu okur. |
| MASTER RC'leri | `C:\FiyatTakip\master\runlar\<run_id>\MASTER_OZET.txt` ve `kisimNN_cikti.log` | Kalite ekranındaki 24 × 14 gün ızgarası için: ya bu dosyalar okunur ya da gece zincirine küçük bir `master_rc(tarih, kisim_no, rc)` tablosu yazımı eklenir (**tercih: tablo**) |

## 2. Sözleşme ↔ DB eşlemesi (repository.py'de SqliteRepository)
- `GET /api/meta` → `endeks_gunluk` son tarih, baz günü (endeks_gunluk'ta TOPLAM=100 olan ilk tarih), `v_kapsam_bolum` toplam kapsanan ağırlık, sınıf/carry sayıları (endeks_gunluk TOPLAM satırı), app sürümü.
- `GET /api/index?level&kod&from&to` → `endeks_gunluk` (TOPLAM/bolum) veya `endeks_sinif` (sinif5/sinif4); 3 haneli grup düzeyi yoksa bölüm gibi `endeks_sinif`'ten ağırlıklı ortalamayla türetilir (Laspeyres, aynı normalizasyon).
- `GET /api/tree` → `tuik_agirlik_2026` (seviye 2–5) + `endeks_sinif`'ten dönem değişimi.
- `GET /api/contrib` → `endeks_gunluk` bölüm satırları; katkı = (I_B−100)·w_B/Σw (metodoloji 4.7).
- `GET /api/sources/{kod}` → `v_gozlem_tufe`'den kaynak × gün kalem-medyanı ile **arka uçta** aynı Jevons'u kaynak bazında hesapla (küçük veri; cache 10 dk) — ya da gece zincirine `endeks_sinif_kaynak` tablosu ekle (**tercih: gece tablosu, ikinci adım**).
- `GET /api/items/{kod}` → `v_gozlem_tufe` (sinif5=kod), son fiyat ve dönem değişimi kimlik bazında; sayfalama SQL'de.
- `GET /api/item/{kimlik}` → `gozlem` (kimlik, tarih, fiyat medyanı).
- `GET /api/quality` → `master_rc` (ya da run klasörleri) + `endeks_sinif` durum='CARRY*' + `gozlem.kalite_ham` neden sayımı (`HAZIR_DEGIL` satırlarında `|` ile ayrılmış nedenlerin ilk parçası).
- `POST /api/basket/compute` → `endeks_sinif` üzerinden kullanıcı ağırlıklarıyla Laspeyres; ağırlıklar normalize.
- `POST /api/tuik/compare` → `tuik_karsilastir.py` mantığı (TÜİK xlsx okuma + sınıf eşleme); mevcut betik `C:\FiyatTakip\tuik_karsilastir.py` referans.
- `POST /api/export/*` → Excel: `endeks_deneme.py`'nin sayfa yapısı (Toplam, Bölümler, Sınıflar, Kapsam, Özet); PDF: bülten şablonu (kapak, ana grafik, bölüm tablosu, katkılar, en çok artan/azalan 10, yöntem notu, kapsam dipnotu), DejaVuSans gömülü.

## 3. Budama listesi (Emergent artıkları)
- MongoDB/Postgres/ORM, auth, kullanıcı hesabı, telemetri, harici API çağrısı, `.env`'de bulut anahtarı — hepsi kaldırılır.
- Kullanılmayan bileşen kütüphaneleri; tek chart kütüphanesi (Recharts), tek UI kütüphanesi (shadcn/ui).
- Fikstür kalsın ama `FixtureRepository` yalnız `--fixtures` bayrağıyla; varsayılan SqliteRepository.
- `npm audit`, `pip-audit` temiz; `requirements.txt` sabitlenmiş sürümler.

## 4. Sabitler ve biçim
- Türkçe arayüz; sayılar `tr-TR` (ondalık virgül), yüzde 2 ondalık ve işaretli; tarih API'de ISO, UI'da `dd.MM.yyyy`.
- Bölüm renkleri sabit palet (`bolum` koduna göre) — tüm grafiklerde aynı.
- Baz günü ve veri tarihi her ekranda footer'da.
- Dönem enflasyonu: `I(t2)/I(t1) − 1`. Bölüm katkısı: `(I_B − 100)·w_B/Σw`.

## 5. Bilinen tasarım kararları (uygulamada "not" olarak görünmeli)
- Kira (04110) = **ilan kirası**; TÜFE'nin ödenen kirasıyla aynı büyüklük değil (Yöntem sayfasında ve TÜİK Kıyas ekranında uyarı).
- Az kalemli yüksek ağırlıklı sınıflar (otel 11201 5 kalem, uçak 07331 6 kalem…) `CARRY_TEMSIL` kuralı gelene kadar uyarı ile gösterilmeli (Kapsam kartında "temsil zayıf" etiketi: ağırlık ≥0,3 ve kalem <10 ve tarife listesinde değil).
- K24 hafta sonu kampanya döngüsü gıda serisinde salınım yaratır (ileride 7 günlük düzeltme).
- Kapsanmayan sınıflar (KISIM 25 gelene kadar): 06310, 04411, 11121, 10102, 09461, 13301, 08330, 07332.

## 6. Adım planı (önerilen sıra)
1. `endeks_deneme.py`'ye DB yazımı (+ `master_rc` tablosu) → gece zinciri aynı; **arka uç yalnız DB okur**.
2. `SqliteRepository`: meta, index, tree, contrib, items, item, quality — fikstürle birebir aynı JSON.
3. Budama + `make dev` ile yerel çalıştırma; Pano ve Kırılım gerçek veriyle.
4. Sepet, TÜİK kıyas, dışa aktarım (Excel/PDF) gerçek sayılarla; PDF Türkçe font testi.
5. `endeks_sinif_kaynak` gece tablosu → kaynak kırılımı.
6. Tauri paketleme (Windows .msi, macOS .app); DB yolu ayarlardan; salt-okunur açma.
7. README: kurulum, veri yolu, gece zinciri bağımlılığı, sürüm damgası.

## 7. Dosya yolları (Windows makine)
- Betikler: `C:\FiyatTakip\{veri_yukle,veri_turet,coicop_esleme,endeks_deneme,tuik_karsilastir,gozlem_denetim}.py`, `GECE_KOSUSU.bat`
- Eşlemeler: `C:\FiyatTakip\esleme\kNN.json`, `disi_listesi.json`, `k24_kategori_coicop.json`
- TÜİK: `C:\FiyatTakip\tufe_agirlik.xlsx`; aylık kıyas dosyaları `aylık ve yıllık değişim oranları.xlsx`
- Çıktılar: `C:\FiyatTakip\endeks\`, `C:\FiyatTakip\denetim\`, `C:\FiyatTakip\veri_katmani\log\gece_<YYYYMMDD>.log`
- Mac paralel kurulum: aynı ağaç `~/FiyatTakip/...`; yollar config'ten okunmalı (hard-code yok).
