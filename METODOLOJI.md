# DÇK-EÖS Fiyat Endeksi — Yöntem (Metodoloji)

> Bu belge bir yer tutucudur. Endeksin resmi metodolojisi burada tutulur.

## 1. Amaç ve Kapsam

DÇK-EÖS Günlük Fiyat Endeksi, seçilmiş tüketim sınıfları için günlük fiyat
gözlemlerinden hesaplanan yerel (offline) bir fiyat endeksidir. Sınıflandırma
**COICOP 2018** yapısına dayanır: **bölüm** (2 hane), **grup** (3 hane),
**sınıf4** (4 hane) ve **sınıf5** (5 hane).

## 2. Endeks Formülü

Baz gün için endeks değeri **100** kabul edilir. Bir üst düzey düğümün endeksi,
alt düğümlerin ağırlıklı ortalamasıdır:

$$ I_{\text{üst}}(t) = \frac{\sum_i w_i \cdot I_i(t)}{\sum_i w_i} $$

burada $w_i$ ilgili alt sınıfın TÜİK 2026 sepet ağırlığıdır.

## 3. Dönem Enflasyonu

İki tarih $t_1$ ve $t_2$ arasındaki dönem enflasyonu:

$$ \pi_{t_1 \to t_2} = \frac{I(t_2)}{I(t_1)} - 1 $$

## 4. Bölüm Katkısı (Puan)

Bir bölümün genel endekse dönem katkısı puan cinsinden:

$$ \text{katkı}_B = (I_B - 100) \cdot \frac{w_B}{\sum w} $$

Bölüm katkılarının toplamı, genel endeksin dönem değişimine (yaklaşık) eşittir.

## 5. Dışlama Kuralları

Aşağıdaki gözlemler hesaplamaya dahil edilmez:

- Fiyatı sıfır veya negatif olan kayıtlar
- Aşırı fiyat değişimi (mutlak değişim > %40) gösteren aykırı kayıtlar
- Kaynak eşleşmesi yapılamayan kayıtlar
- Miktar/birim bilgisi eksik kayıtlar
- Ürünün stok dışı olduğu kayıtlar

## 6. Devreden Fiyat (Carry)

Bir sınıf için o gün taze gözlem yoksa, en son geçerli fiyat devreden
(**CARRY**) olarak taşınır. Ardışık taze gözlem yokluğu **CARRY_GUN_YOK**
olarak işaretlenir ve kapsam (coverage) düşer.

## 7. Kalite Kodları (rc)

Her gün/kısım koşumu için çalışma kodu:

| rc | Anlam | Renk |
|----|-------|------|
| 0  | Başarılı | Yeşil |
| 1  | Uyarı | Sarı |
| 4  | Kısmi hata | Turuncu |
| 5  | Hata | Kırmızı |
| 6  | Kritik hata | Kırmızı |

## 8. Karar Günlüğü

- **2026-07-15**: Baz gün belirlendi (endeks = 100).
- **2026-09-12**: Fixture veri seti son güncelleme tarihi.
