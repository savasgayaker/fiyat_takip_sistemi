# DÇK-EÖS Fiyat Endeksi — Yöntem (Metodoloji)

> Yöntem sürümü **v0.1** (`fiyat_takip/endeks`, 11.09.2026). Uygulama hesaplamaz; gece zinciri bu
> yöntemle hesaplar ve sonucu `endeks_gunluk`, `endeks_sinif`, `endeks_sinif_kaynak` tablolarına
> **ekler**. v0.2'de ele alınacak konular: `docs/YONTEM_V02_BEKLEYEN.md`.

## 1. Amaç ve Kapsam

DÇK-EÖS Günlük Fiyat Endeksi, 24 kısımdan (MASTER koşuları) toplanan günlük fiyat gözlemlerinden
hesaplanan yerel (çevrimdışı) bir fiyat endeksidir. Sınıflandırma **COICOP 2018** yapısına dayanır:
**bölüm** (2 hane), **grup** (3 hane), **sınıf4** (4 hane) ve **sınıf5** (5 hane). Ağırlıklar TÜİK 2026
sepetinden alınır (`tuik_agirlik_2026`). Hesap birimi **sınıf**tır: gözlem 5 haneli sınıfa eşlenmişse
sınıf5, yalnız 4 haneye eşlenebiliyorsa sınıf4; ağırlık aynı düzeyin ağırlığıdır.

Kapsam: 145 sınıf, TÜİK ağırlığının %93,5'i (baz gününden itibaren sabit). Kapsanmayan sınıflar
(06310, 04411, 11121, 10102, 09461, 13301, 08330, 07332) yeni kısım gelene kadar dışarıdadır.

## 2. Hesap Adımları

### 2.1 Kalem fiyatı (SQL: `v_kalem_gun_medyan`)
Kalem = (kısım, kimlik). Bir kalemin günlük fiyatı, o gün `kalite_durumu='HAZIR'` ve `fiyat>0` olan
gözlemlerinin **medyanı**dır (çift sayıda gözlemde iki ortanın ortalaması). Hesapta `ln p` kullanılır.

### 2.2 Sınıf endeksi — zincirli günlük Jevons
Sınıf $c$ için, ardışık iki veri gününde de fiyatı olan kalemler $i$ üzerinden:

$$ I_c(t) = I_c(t-1)\cdot\exp\Big(\tfrac{1}{n}\sum_i \big[\ln p_i(t) - \ln p_i(t-1)\big]\Big) $$

"Önceki gün" takvimdeki değil, **veri olan** bir önceki gündür (takvim boşlukları atlanır).
Eşleşme eşiği: $m_c = \min(3,\ \text{sınıftaki toplam kalem sayısı})$; tarife sınıflarında (1–2 kalem)
eşik evrene düşer.

### 2.3 Durum kümesi (sınıf-gün)
| Durum | Koşul | Endeks |
|---|---|---|
| `FRESH` | eşleşen kalem $n \ge m_c$ ve $n>0$ | zincir ilerler |
| `CARRY` | sınıfta veri var, eşleşen kalem eşiğin altında | $I_c(t)=I_c(t-1)$ |
| `CARRY_GUN_YOK` | sınıfta o gün hiç veri yok | $I_c(t)=I_c(t-1)$ |
| `ZINCIR_KOPUK` | bugün veri var, bir önceki veri gününde bu sınıfta veri yok | $I_c(t)=I_c(t-1)$ |
| `BASLANGIC` | pencerenin ilk günü | $I_c=1$ (ham) |

Devreden (carry) sınıflar üst düzey toplamda **ağırlıklarıyla kalır**; kapsanan ağırlık düşmez.
Kullanıcı arayüzündeki "devreden" sayımı `CARRY`, `CARRY_GUN_YOK` ve `ZINCIR_KOPUK`'u kapsar.

### 2.4 Baz ve ölçek
Baz günü **17.08.2026** (`config/endeks.json: baz_gunu`); ilk seçimde "sınıf başına tekil ağırlık
toplamının en yüksek gününün %60'ını ilk aşan gün" kuralı uygulanmıştır, modül yeniden hesaplamaz.
$I_c^{100}(t) = 100\cdot I_c(t)/I_c(\text{baz})$. Bazda olmayan sınıf ilk göründüğü gün 100 kabul edilir.

### 2.5 Hiyerarşi kuralı
4 haneli sınıfın aynı gün endeksi olan 5 haneli alt sınıfı varsa 4 haneli agregat üst düzeyden
**düşülür** (`hiyerarsi_dus`); aksi halde ağırlık iki kez sayılır.

### 2.6 Üst düzey — sabit ağırlıklı Laspeyres
Bölüm ve toplam, o gün endeksi olan (ve düşülmemiş) sınıflar üzerinden yeniden normalize edilir:

$$ I_{\text{üst}}(t) = \frac{\sum_c w_c \cdot I_c(t)}{\sum_c w_c} $$

Grup (3 hane) düzeyi aynı formülle sınıf endekslerinden türetilir. Sepet ekranı aynı doğrusal
birleşimi kullanıcı ağırlıklarıyla uygular (`src/lib/basket.ts`); ağırlıklar dönem boyunca sabittir.

### 2.7 Kaynak kırılımı
Aynı Jevons, `(sınıf, kaynak)` çiftinde ve aynı carry eşiğiyle koşar (`endeks_sinif_kaynak`).
Kaynak anahtarı: `casefold + strip` (Türkçe İ noktası atılır) — `Migros/migros`, `BİM/bim` tek kaynak.

## 3. Dönem Enflasyonu

$$ \pi_{t_1 \to t_2} = \frac{I(t_2)}{I(t_1)} - 1 $$

## 4. Bölüm Katkısı (Puan)

Sabit ağırlıklı Laspeyres'in tam ayrıştırması:

$$ \text{katkı}_B(t_1,t_2) = \frac{w_B\,\big(I_B(t_2) - I_B(t_1)\big)}{\sum_B w_B\, I_B(t_1)} $$

Katkıların toplamı $\pi_{t_1 \to t_2}$'ye **eşittir** (birim test). $t_1$ = baz günü iken
$I_B(t_1)=100$ ve formül $(I_B-100)\cdot w_B/\sum w_B$ biçimine iner (özet metni).

## 5. Dışlama Kuralları (veri katmanı, `veri_turet.py`)

- Fiyatı sıfır veya negatif kayıtlar (endeks adımında `fiyat>0`).
- Kaynağın kalite sözlüğünde "hazır" sayılmayan satırlar (`HAZIR_DEGIL`, alt sebep `kalite_ham`).
- **Bant kapısı:** kalem içi, son geçerli günlük medyana göre `[0,4×, 2,5×]` dışına çıkan gün
  (`BANT_DISI_TURET`); sıçramanın ertesi günü cezalandırılmaz.
- `disi_listesi.json`: kısım/kaynak/tarih/fiyat aralığı kuralları (`DISI:<neden>`).
- Sınıf veya ağırlık eşlemesi olmayan gözlemler endekse girmez (`gozlem_coicop` null).

## 6. Vintage İlkesi

Gece zinciri son 3 günü yeniden yüklediği için $t-1$ kalem fiyatları revize olabilir. $t$ günü
halkası güncel DB'deki $t-1$ ve $t$ fiyatlarıyla kurulur; yayımlanan $I(t-1)$ tablodan okunur ve
**değiştirilmez** (`INSERT OR IGNORE`). Yöntem değişince yeni `yontem_surumu` ile paralel seri.

## 7. Kalite Kodları (rc)

Her gün/kısım MASTER koşusunun çalışma kodu (`master_rc`, `config/rc_kodlari.json`):

| rc | Anlam |
|----|-------|
| 0  | Başarılı |
| 1  | Uyarı (kısmi) |
| 4  | Robots reddi / kısmi veri |
| 5  | Veri yok |
| 6  | Hata |

## 8. Karar Günlüğü

- **2026-08-17**: Baz günü (endeks = 100).
- **2026-09-10**: v0 `endeks_deneme.py` (zincirli Jevons × Laspeyres) ilk üretim koşusu.
- **2026-09-11**: v0.1 — matematik `fiyat_takip/endeks` modülüne taşındı; DB tabloları, vintage ilkesi,
  kaynak kırılımı; belge kodla eşitlendi (carry/kapsam, durum kümesi, hiyerarşi, baz, bant kapısı).
