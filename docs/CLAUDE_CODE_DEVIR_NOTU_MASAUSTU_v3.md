# DÇK-EÖS Masaüstü Uygulaması — Claude Code Devir Notu v3 (10.09.2026)

> v2: repo (main, 4 commit) ile karşılaştırıldı; eksik uçlar, sözleşme alanları, bağımlılık ve paketleme riskleri eklendi (**[v2]**).
> v3: hesap yeri kararı netleşti — endeks matematiği tek Python modülünde, gece zincirinde koşar, sonuç DB'ye **eklenerek** yazılır; arka uçta hiçbir Jevons yok; sepet hesabı frontend'de (**[v3]**).

## 0. Durum
- Emergent ile üretilen iskelet GitHub'da (React 19 + TS/CRA + craco, FastAPI 0.110, JSON fikstür, Tauri 2 scaffold).
  İlk Claude Code görevi: **fikstürü gerçek SQLite'a bağlamak, sözleşme dışı fazlalığı budamak, PDF/Excel'i gerçek sayılara oturtmak.**
- Uygulama **hesaplamaz, okur.** Tüm hesaplar gece zinciriyle (GECE_KOSUSU.bat, 00:30) DB'ye yazılır. Tek istisna: Sepet ekranı sınıf endekslerinden anlık yeniden ağırlıklandırma yapar — **[v3]** bu hesap frontend'de yapılır (doğrusal birleşim), arka uç yalnız sepet kaydı ve dışa aktarım için aynı formülü koşar.
- **[v3] Hesap yeri kararı (tartışıldı, kesin):**
  - *SQL view* (`v_kalem_gun_medyan`): kaynak × sınıf × gün × kalem medyanı ve `ln(p)`. Küme işlemi, deterministik, ucuz.
  - *Python, tek modül* `fiyat_takip/endeks/` (saf fonksiyonlar: `jevons`, `carry`, `hiyerarsi_dus`, `laspeyres`, `baz_normalize`, `katki`): gece zinciri çağırır; arka uç yalnız sepet dışa aktarımı için import eder. **İki Jevons kopyası olmayacak.**
  - *DB tablo*: `endeks_gunluk`, `endeks_sinif`, `endeks_sinif_kaynak` — her satırda `run_id, yontem_surumu, hesap_zamani`. **Ekleme (append) — `DROP/CREATE` yok.** Yayımlanan gün dokunulmaz (vintage ilkesi); yöntem değişince yeni `yontem_surumu` ile paralel seri (`endeks_yeniden_hesapla.py --baslangic --surum`). Uygulama varsayılan olarak en yüksek `yontem_surumu`'nu okur, footer'da damgayı gösterir.
  - Neden uygulamada değil: yayımlanan istatistik tekrarlanabilir olmalı; okuma anında hesap geç gelen gözlem/düzeltilen kalite bayrağıyla dünkü sayıyı değiştirir. Neden saf SQL değil: carry, hiyerarşi, CARRY_TEMSIL, 7 günlük K24 düzeltmesi prosedürel; view'da test edilemez.
- Referans belgeler (repoya `docs/` altına konmalı; şu an `docs/` yok): `DCK_EOS_Metodoloji_v0.1.docx`, `EMERGENT_PROMPT_DCK_EOS.md`, bu not. Repoda ayrıca `METODOLOJI.md` var (Yöntem ekranı `/api/method` ile bunu okuyor) — docx ile tutarlı tutulmalı.

### 0.1 Repo gerçeği — notu düzelten bulgular **[v2]**
1. **README'deki "tek satır değişimi" iddiası doğru değil.** `backend/app/exports.py` içindeki `build_pdf` ve `tuik_compare`, `repo._nodes` ve `repo._filter_series` özel alanlarına doğrudan erişiyor. `SqliteRepository` takılınca PDF ve TÜİK kıyas kırılır. Çözüm: `Repository` arayüzüne `class_changes(level, frm, to) -> [{kod, ad_tr, agirlik, endeks_bas, endeks_bit, degisim}]` eklenmeli; `exports.py` yalnız arayüzü kullanmalı.
2. **Sözleşmede notun 2. bölümünde olmayan dört uç var:** `GET /api/index/multi?kodlar=`, `GET /api/baskets`, `GET /api/search?q=`, `GET /api/method`. Eşlemeleri §2'ye eklendi.
3. **Fikstür sözleşmesinin DB'den türetilmesi gereken alanları** (frontend `src/types.ts`):
   - `Item`: `kimlik, urun_adi, kaynak, kisim_no, son_fiyat, degisim, gun` (gun = gözlem gün sayısı)
   - `ItemDetail.series`: `{tarih, fiyat}` (endeks değil)
   - `SeriesPoint`: `{tarih, endeks, eslesen_kalem?, durum?}`; `durum ∈ {FRESH, CARRY, CARRY_GUN_YOK}`
   - `QualitySection`: `{kisim_no, ad, days:[{tarih, rc}]}` → **kısım adı DB'de yok**; `config/kisim_adlari.json` (24 satır) gerekli
   - `CarryClass`: `{kod, ad_tr, agirlik, gun}` (gun = ardışık carry gün sayısı — `endeks_sinif.durum` üzerinden hesaplanır)
   - `Exclusion`: `{neden, satir}` (`kalite_ham` ilk parça × sayım)
   - `Meta`: `data_date, base_day, coverage_weight, class_count, carry_count, app_version`
   - Sayfalama sabit 25 satır (`items`).
4. **PDF font yolu Linux'a sabit:** `FONT_DIR = "/usr/share/fonts/truetype/dejavu"`. Windows/Mac'te çöker. `backend/assets/fonts/DejaVuSans*.ttf` repoya konmalı, yol göreli olmalı.
5. **`server.py`:** `host 0.0.0.0`, `CORS_ORIGINS="*"`, `python-dotenv`. Yerel uygulama için `127.0.0.1`, CORS yalnız `http://localhost:3000` ve `tauri://localhost`; dotenv kaldırılır, ayarlar `config.toml`/`config.json`'dan.
6. **Frontend `REACT_APP_BACKEND_URL` env'e bağımlı** (`src/lib/api.ts`). Tauri'de env yok → varsayılan `http://127.0.0.1:8001`.
7. **Tauri iskeleti Python'u başlatmıyor.** `desktop/src/main.rs` yalnız pencere açıyor; `icons/icon.png` yok; `src-tauri/` düzeni yok. Paketleme için arka ucun PyInstaller ile tek dosya yapılıp Tauri **sidecar** olarak başlatılması gerekir (§6 adım 6).
8. **`requirements.txt` 129 paket**, çoğu Emergent artığı: `emergentintegrations`, `litellm` (Emergent CDN'den wheel!), `boto3`, `stripe`, `openai`, `google-genai`, `google-generativeai`, `huggingface_hub`, `tiktoken`, `pymongo`, `motor`, `passlib`, `bcrypt`, `python-jose`, `PyJWT`, `black/flake8/mypy/isort`… Hedef liste §3'te.
9. **Frontend bağımlılıklarının çoğu kullanılmıyor** (sayfalarda import yok): `swr`, `date-fns`, `framer-motion`, `embla-carousel-react`, `vaul`, `input-otp`, `react-hook-form`, `@hookform/resolvers`, `zod`, `cmdk`, `next-themes`, `lodash`, `react-day-picker`, `react-resizable-panels`; devDep `@emergentbase/visual-edits` (Emergent CDN URL). `components/ui/` altında 47 shadcn dosyası var, sayfalar 8'ini kullanıyor (badge, button, card, input, label, switch, table, tabs). `@types/react` 18 ↔ `react` 19 uyumsuz.
10. **Emergent kalıntı klasörleri:** `.emergent/`, `memory/`, `test_reports/`, `test_result.md`, `frontend/plugins/health-check/`, `frontend/src/constants/testIds/auth.js`, `.gitconfig`. `.gitignore`'da anlamsız `node_modules/.cache/*.pack` satırları.
11. **Smoke test fikstüre bağlı sabitler içeriyor** (`len(tree)==13`, `01111`, `01`). Gerçek DB ile de 13 bölüm doğru (COICOP 2018) ama testler `--fixtures` ile koşmalı; SQLite için ayrı, DB varsa atlanan (`pytest.mark.skipif`) test seti.

## 1. Veri kaynağı: `C:\FiyatTakip\db\fiyat_takip.sqlite` (salt-okunur; `file:...?mode=ro`, `uri=True`)

| Nesne | Ne için | Notlar |
|---|---|---|
| `gozlem` | Tüm fiyat gözlemleri (≈1,8 M satır) | `kalite_durumu='HAZIR'` filtresi şart; sütunlar: kisim_no, panel_tipi, kimlik, kaynak, coicop, urun_adi, tarih, fiyat, birim, miktar, birim_fiyat, kalite_durumu, kalite_ham, konum, magaza, marka, url, run_id, kaynak_tablo, yukleme_zamani |
| `gozlem_coicop` | satir_sha → coicop2018, sinif5, sinif4, sinif3, bolum, agirlik5, agirlik4, yontem | Her gece yeniden kurulur |
| `v_gozlem_tufe` | gozlem ⋈ gozlem_coicop ⋈ tuik adları | Kalem tablosu / arama için tek görünüm |
| `tuik_agirlik_2026` | kod, seviye (2/3/4/5/7), ad_tr, ad_en, agirlik | COICOP ağacı buradan kurulur (seviye 2→3→4→5; 7 haneli maddeler ağaçta gösterilmez) |
| `v_kapsam_sinif5`, `v_kapsam_bolum` | Kapsam kartları | |
| `v_gozlem_ozet`, `v_katalog` | Kısım × gün özetleri; tablo kataloğu | Kalite ekranı |
| **Endeks tabloları — HENÜZ DB'DE YOK** | `endeks_deneme.py` yalnız dosya yazıyor (`C:\FiyatTakip\endeks\*.csv/.xlsx`) | **İlk iş [v3]:** `endeks_deneme.py`'nin matematiğini `fiyat_takip/endeks/` modülüne taşı; gece zinciri şu üç tabloya **ekleme** yapar: `endeks_gunluk(tarih, duzey, kod, endeks, kapsanan_agirlik, sinif, kalem, carry_sinif, run_id, yontem_surumu, hesap_zamani)`, `endeks_sinif(tarih, sinif, endeks, endeks_ham, eslesen_kalem, durum, agirlik, hiyerarsi_dus, run_id, yontem_surumu, hesap_zamani)`, `endeks_sinif_kaynak(tarih, sinif, kaynak, endeks, kalem, run_id, yontem_surumu, hesap_zamani)`. Birincil anahtar `(tarih, kod|sinif[, kaynak], yontem_surumu)`; aynı gün aynı sürüm ikinci kez yazılmaz (`INSERT OR IGNORE`, çakışma log'a). İndeksler: `(yontem_surumu, tarih, kod)`, `(yontem_surumu, sinif, tarih)`. Dosya çıktıları (csv/xlsx) devam eder, tablo kaynağından üretilir. |
| MASTER RC'leri | `C:\FiyatTakip\master\runlar\<run_id>\MASTER_OZET.txt` | Gece zincirine `master_rc(tarih, kisim_no, rc)` tablosu (**tercih: tablo**) |
| **[v3]** `v_kalem_gun_medyan` | kaynak, sinif5, tarih, kimlik → `fiyat_medyan`, `ln_fiyat`, `n_gozlem` | Jevons'un SQL tarafı; gece modülü buradan okur, `gozlem`'e doğrudan gitmez |
| **[v2]** `config/kisim_adlari.json` | `{"1": "İstanbul - Market", ...}` 24 kısım | Kalite ızgarası satır etiketi; DB'de karşılığı yok |
| **[v2]** `config/sepetler.json` | Hazır sepet ağırlıkları (TÜİK 2026, Asgari ücretli, Emekli…) | Fikstürdeki `baskets.json` buraya taşınır; kullanıcı sepetleri de buraya yazılır (tek yazılan dosya) |

## 2. Sözleşme ↔ DB eşlemesi (`repository.py` → `SqliteRepository`)
- `GET /api/meta` → `endeks_gunluk`: `data_date = max(tarih)`, `base_day = min(tarih) where duzey='TOPLAM' and endeks=100`; `coverage_weight` = TOPLAM satırındaki `kapsanan_agirlik`; `class_count`, `carry_count` = TOPLAM satırındaki `sinif`, `carry_sinif`; `app_version` sabitten.
- `GET /api/index?level&kod&from&to` → `endeks_gunluk` (TOPLAM/bolum) veya `endeks_sinif` (sinif5/sinif4); 3 haneli grup düzeyi `endeks_sinif`'ten ağırlıklı ortalamayla türetilir (Laspeyres, aynı normalizasyon). Yanıt `SeriesPoint` alanlarını (`eslesen_kalem`, `durum`) `endeks_sinif`'ten doldurur.
- **[v2]** `GET /api/index/multi?kodlar=a,b,c` → aynı sorgu, `kod IN (...)`, tek roundtrip. **[v3]** `kodlar=*&level=sinif5` biçimi de kabul edilir: Sepet ekranı açılışta seçili düzeyin tüm serilerini bir kez çeker (59 × 60 ≈ 3,5 bin nokta), sonra tarayıcıda hesaplar.
- `GET /api/tree` → `tuik_agirlik_2026` (seviye 2–5) + `endeks_sinif`'ten dönem değişimi (`degisim_donem`: son tarih / ilk tarih − 1). Fikstürde `grup` seviyesi var; DB'de ağırlık var, endeks yok → türetilir.
- `GET /api/contrib?from&to&level` → `endeks_gunluk` bölüm satırları; formül §4.
- `GET /api/sources/{kod}` → **[v3] yalnız** `endeks_sinif_kaynak` tablosu. Arka uçta geçici Jevons yazılmayacak; tablo yoksa uç boş liste ve UI'da "kaynak kırılımı henüz üretilmedi" durumu.
- `GET /api/items/{kod}?page&sort` → `v_gozlem_tufe` (`sinif5=kod` ya da üst kod için `LIKE 'kod%'`), kimlik bazında `son_fiyat` (son tarih medyanı), `degisim` (dönem), `gun` (COUNT DISTINCT tarih); `LIMIT 25 OFFSET`; `sort ∈ {urun_adi, kaynak, son_fiyat, degisim, gun, kisim_no}`, `-` öneki ters.
- `GET /api/item/{kimlik}` → `gozlem` (kimlik, tarih, `MEDIAN(fiyat)` → SQLite'ta yok; `ORDER BY fiyat` + satır sayısı ile ya da Python'da).
- `GET /api/quality?days` → `master_rc` + `kisim_adlari.json`; `endeks_sinif` `durum LIKE 'CARRY%'` son gün için ardışık gün sayısı; `gozlem.kalite_ham` `HAZIR_DEGIL` satırlarında ilk `|` parçası × sayım.
- **[v2]** `GET /api/search?q` → `tuik_agirlik_2026` (`ad_tr LIKE`, `kod LIKE`) ∪ `v_gozlem_tufe` (`urun_adi LIKE`, DISTINCT kimlik); en fazla 30; `LIKE` Türkçe büyük/küçük için `lower()` yerine `COLLATE NOCASE` + Python tarafında `casefold()`.
- **[v2]** `GET /api/baskets` → `config/sepetler.json`.
- **[v2]** `GET /api/method` → `METODOLOJI.md` (değişmez).
- `POST /api/basket/compute` → **[v3] ekran hesabı için çağrılmaz.** Frontend `src/lib/basket.ts` içinde $I_S(t)=\sum_k w_k I_k(t)/\sum_k w_k$ ve katkı ayrıştırmasını her ağırlık değişiminde yerelde hesaplar (tarih üzerinden hizalama, konum indeksi değil). Uç yalnız dışa aktarım için kalır: aynı ağırlıklarla `fiyat_takip.endeks.laspeyres` çalıştırır, PDF/Excel'e basar. Birim test: frontend (`vitest`/`jest`) ve arka uç aynı fikstür sepetinde aynı seriyi üretir (tolerans 1e-9).
- **[v3]** `GET /api/baskets` / `POST /api/baskets` / `DELETE /api/baskets/{ad}` → `config/sepetler.json` (hazır sepetler `sabit: true` ile silinemez). Uygulamanın yazdığı tek dosya.
- `POST /api/tuik/compare` → `tuik_karsilastir.py` mantığı; **[v2]** `repo.class_changes("bolum", frm, to)` üzerinden, özel alan erişimi yok.
- `POST /api/export/excel` → **[v2] iki ayrı yol:** (a) mevcut ekran-tablo dışa aktarımı (frontend `tables` gönderiyor) kalır; (b) yeni `POST /api/export/bulten.xlsx` — `endeks_deneme.py` sayfa yapısı (Toplam, Bölümler, Sınıflar, Kapsam, Özet), arka uçta DB'den.
- `POST /api/export/pdf` → bülten şablonu (kapak, ana grafik, bölüm tablosu, katkılar, en çok artan/azalan 10, yöntem notu, kapsam dipnotu); **[v2]** `repo.class_changes("sinif5", ...)` kullanır; font `backend/assets/fonts/` altından.

## 3. Budama listesi (Emergent artıkları) **[v2 genişletildi]**
- **Arka uç `requirements.txt` hedef listesi (sabit sürüm):** `fastapi`, `uvicorn[standard]`, `pydantic`, `python-multipart`, `openpyxl`, `reportlab`; test: `pytest`, `httpx`. `pandas`/`numpy` yalnız `tuik_compare` gerçekten gerektiriyorsa. Kalanların tamamı silinir; `pip-audit` temiz.
- **Frontend:** §0.1-9'daki kullanılmayan paketler ve `@emergentbase/visual-edits` kaldırılır; `components/ui/` yalnız kullanılan 8 (+ gerekirse `dialog`, `select`, `tooltip`, `skeleton`, `toast`) kalır; `@types/react(-dom)` 19'a çekilir; `craco.config.js`'ten visual-edits ve health-check blokları çıkar; `plugins/`, `constants/testIds/auth.js` silinir. Tek chart (Recharts), tek UI (shadcn/ui), tek veri katmanı (`@tanstack/react-query`), tek tarih (`dayjs`).
- **Kök:** `.emergent/`, `memory/`, `test_reports/`, `test_result.md`, `.gitconfig` silinir; `.gitignore` temizlenir (`*.sqlite`, `.env*` kalır).
- `server.py`: dotenv/CORS `*`/`0.0.0.0` → `config` + `127.0.0.1`; `FixtureRepository` yalnız `--fixtures` bayrağı (ya da `DCK_EOS_FIXTURES=1`) ile; varsayılan `SqliteRepository(config.db_path)`.
- MongoDB/Postgres/ORM, auth, kullanıcı hesabı, telemetri, harici API, bulut anahtarı — kodda yok, yalnız bağımlılıkta; bağımlılıkla birlikte gider.

## 4. Sabitler ve biçim
- Türkçe arayüz; sayılar `tr-TR` (ondalık virgül), yüzde 2 ondalık ve işaretli; tarih API'de ISO, UI'da `dd.MM.yyyy`.
- Bölüm renkleri sabit palet (`frontend/src/lib/palette.ts`, `bolum` koduna göre) — tüm grafiklerde aynı; PDF'te aynı hex'ler.
- Baz günü ve veri tarihi her ekranda footer'da.
- Dönem enflasyonu: `π(t1,t2) = I(t2)/I(t1) − 1`.
- **Bölüm katkısı [v2 netleştirme]:** Genel dönem için sabit ağırlıklı Laspeyres'in tam ayrıştırması
  `katkı_B(t1,t2) = w_B · (I_B(t2) − I_B(t1)) / Σ_B w_B · I_B(t1)` (puan).
  Metodoloji 4.7'deki `(I_B − 100)·w_B/Σw` bunun `t1 = baz günü` özel hâlidir. Fikstürdeki `deg_B · w_B/Σw` biçimi yalnız `I_B(t1)=100` iken tam; diğer dönemlerde yaklaşık. Uygulamada genel formül kullanılmalı; katkılar toplamı `π(t1,t2)`'ye eşit çıkmalı (birim test). **[v3]** Aynı formül `src/lib/basket.ts` ve `fiyat_takip/endeks/katki.py` içinde; iki uygulama tek fikstürle çapraz test edilir.

## 5. Bilinen tasarım kararları (uygulamada "not" olarak görünmeli)
- Kira (04110) = **ilan kirası**; TÜFE'nin ödenen kirasıyla aynı büyüklük değil (Yöntem sayfası ve TÜİK Kıyas ekranı uyarısı).
- Az kalemli yüksek ağırlıklı sınıflar (otel 11201 5 kalem, uçak 07331 6 kalem…) `CARRY_TEMSIL` kuralı gelene kadar uyarı ile: Kapsam kartında "temsil zayıf" etiketi (ağırlık ≥ 0,3 ∧ kalem < 10 ∧ tarife listesinde değil).
- K24 hafta sonu kampanya döngüsü gıda serisinde salınım yaratır (ileride 7 günlük düzeltme).
- Kapsanmayan sınıflar (KISIM 25 gelene kadar): 06310, 04411, 11121, 10102, 09461, 13301, 08330, 07332.
- **[v3] Sepet ekranı kararları:**
  - Ağırlıklar dönem boyunca **sabit** (Laspeyres). Zamanla değişen ağırlık = zincirleme endeks; kapsam dışı, UI'da kapı yok.
  - Bir sepet **tek düzeyde** tanımlanır (bölüm *veya* sinif5). Düzey karışımı (bölümü açıp altını elle bölme) ikinci sürüm; o zaman bölüm ağırlığı alt sınıflara TÜİK oranıyla dağıtılır.
  - Kapsanmayan sınıfa ağırlık verilirse sessizce paydadan düşmez: seçenek (a) sıfırla + uyarı, (b) üst sınıf endeksiyle temsil (`hiyerarsi_dus` ile aynı kural). **Varsayılan (b)**, kart üzerinde "kapsanan ağırlık payı" görünür.
  - Ağırlık toplamı 100'e otomatik ölçeklenir; baz günde her sepet 100'dür (tüm $I_k(\text{baz})=100$), ağırlık değişimi seviyeyi değil eğimi değiştirir.
  - Hazır sepetler: TÜİK 2026, Asgari ücretli, Emekli, Öğrenci (`sepetler.json`, `sabit: true`). "TÜİK'e sıfırla" düğmesi; iki sepet aynı grafikte üst üste (kişisel vs TÜİK ağırlıklı) — `/api/index/multi` verisi zaten bellekte, ek istek yok.
  - İleride: HBS gelir dilimi harcama kalıbı sepetleri — yalnız yeni ağırlık vektörü, hesap katmanına dokunmaz.

## 6. Adım planı (önerilen sıra) **[v2 güncellendi]**
0. **Arayüz onarımı:** `Repository.class_changes()` ekle; `exports.py`'yi arayüze bağla; smoke test fikstürle yeşil. (Yarım gün; bu yapılmadan 2. adımda PDF/TÜİK kırılır.)
1. **[v3]** `endeks_deneme.py` matematiğini `fiyat_takip/endeks/` modülüne çıkar (saf fonksiyon + pytest, eski csv çıktısıyla birebir regresyon testi); `v_kalem_gun_medyan` view'ı; üç endeks tablosu + `master_rc` **ekleme** ile; `run_id/yontem_surumu/hesap_zamani`. Gece zinciri aynı `.bat`, yeni modülü çağırır. **Arka uç yalnız DB okur.**
2. `SqliteRepository`: meta, index, index_multi, tree, contrib, sources, items, item, quality, search, class_changes, baskets — fikstürle birebir aynı JSON; `yontem_surumu` filtresi her sorguda. Doğrulama: `--fixtures` ve DB ile aynı uçlar → aynı şema (`pydantic` response model'leri).
3. Budama + `config` katmanı + `make dev` ile yerel çalıştırma; Pano ve Kırılım gerçek veriyle.
4. **[v3]** Sepet: `src/lib/basket.ts` (frontend hesap) + `POST /api/baskets` kayıt + dışa aktarımda `fiyat_takip.endeks` ile çapraz test. TÜİK kıyas, dışa aktarım (ekran Excel + bülten Excel + PDF) gerçek sayılarla; PDF Türkçe font testi (`ğüşıöçİ`) Windows'ta.
5. **[v3]** (1. adıma katıldı) Kaynak kırılımı ekranı `endeks_sinif_kaynak`'a bağlanır; yöntem sürümü seçici/damgası footer'da.
6. Tauri paketleme: arka uç `PyInstaller --onefile` → `desktop/binaries/dck-eos-backend-<target-triple>` sidecar; `main.rs` sidecar'ı başlatır, kapanışta öldürür; `icons/` üretilir; DB yolu ayarlar diyaloğundan (`SettingsDialog.tsx` var, bağlanacak) → `config.json`; salt-okunur açma. Windows `.msi`, macOS `.app`.
7. README: kurulum, veri yolu, gece zinciri bağımlılığı, sürüm damgası; `docs/` klasörü.

## 7. Dosya yolları (Windows makine)
- Betikler: `C:\FiyatTakip\{veri_yukle,veri_turet,coicop_esleme,endeks_deneme,tuik_karsilastir,gozlem_denetim}.py`, `GECE_KOSUSU.bat`
- Eşlemeler: `C:\FiyatTakip\esleme\kNN.json`, `disi_listesi.json`, `k24_kategori_coicop.json`
- TÜİK: `C:\FiyatTakip\tufe_agirlik.xlsx`; aylık kıyas dosyaları `aylık ve yıllık değişim oranları.xlsx`
- Çıktılar: `C:\FiyatTakip\endeks\`, `C:\FiyatTakip\denetim\`, `C:\FiyatTakip\veri_katmani\log\gece_<YYYYMMDD>.log`
- Mac paralel kurulum: aynı ağaç `~/FiyatTakip/...`; yollar config'ten okunmalı (hard-code yok).

## 8. İlk Claude Code oturumu — yapıştırılacak görev metni **[v2]**
```
Repo: fiyat_takip_sistemi. Önce docs/CLAUDE_CODE_DEVIR_NOTU_MASAUSTU_v2.md ve CLAUDE.md'yi oku.
Bu oturumda yalnız Adım 0 ve Adım 3'ün budama kısmını yap; DB kodu ve endeks matematiği yazma
(endeks matematiği fiyat_takip/endeks/ modülünde yaşayacak, bu repoda değil).

1. backend/app/data/repository.py: Repository arayüzüne
   class_changes(level: str, frm, to) -> list[dict] ekle; FixtureRepository'de uygula.
2. backend/app/exports.py: build_pdf ve tuik_compare içindeki repo._nodes / repo._filter_series
   erişimlerini repo.class_changes(...) ile değiştir. sources() içindeki fikstür Jevons taklidi
   FixtureRepository'de kalabilir; SqliteRepository'de kesinlikle hesap yok, yalnız tablo okuma. Font yolunu backend/assets/fonts/ altına
   göreli yap; DejaVuSans.ttf ve DejaVuSans-Bold.ttf dosyalarını oraya koy.
3. backend/requirements.txt'i §3'teki hedef listeye indir (sabit sürüm); pip-audit çalıştır.
4. frontend/package.json: §0.1-9'daki kullanılmayan paketleri ve @emergentbase/visual-edits'i kaldır;
   craco.config.js'ten visual-edits + health-check bloklarını çıkar; components/ui/ altında
   kullanılmayan dosyaları sil; @types/react ve @types/react-dom'u 19'a çek. yarn build temiz.
5. Kökten .emergent/, memory/, test_reports/, test_result.md, .gitconfig'i sil; .gitignore'u sadeleştir.
6. server.py: host 127.0.0.1, CORS yalnız localhost:3000 ve tauri://localhost, dotenv kaldır;
   --fixtures bayrağı ekle (varsayılan hâlâ FixtureRepository, çünkü DB tabloları henüz yok).
7. cd backend && pytest -q yeşil; cd frontend && yarn build hatasız. Her adım ayrı commit.
```
