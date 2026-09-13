# CLAUDE.md — DÇK-EÖS Fiyat Endeksi (masaüstü)

Yerel-öncelikli, çevrimdışı, tek makine. **Uygulama hesaplamaz, okur.** Endeks matematiği bu repoda
değil, **tek motor** `C:\FiyatTakip\endeks_deneme.py` içindedir (`veri_oku → hesapla → ozet_metni → dosyalari_yaz`);
`C:\FiyatTakip\fiyat_takip/endeks/` yalnız DB katmanıdır (şema, yazma, okuma). Gece zinciri
(`GECE_KOSUSU.bat`, 00:30) `endeks_gece.py` ile aynı fonksiyonları çağırıp sonucu `fiyat_takip.sqlite`'a
yazar (`run_id, yontem_surumu, hesap_zamani`; seri her gece tüm tarihçe üzerinden yeniden hesaplanır,
tablo = csv; `endeks_kosu.etiket='deneme'` olduğu sürece resmi seri `endeks_deneme.py`'nin csv/xlsx'idir).
Masaüstü boru hattı DB'ye yalnız `endeks_*` ve `master_rc` yazar. Arka uç yalnız `endeks_gunluk`,
`endeks_sinif`, `endeks_sinif_kaynak`, `endeks_kosu`, `master_rc`, `tuik_agirlik_2026`, `v_gozlem_tufe`,
`gozlem` okur. **Arka uçta Jevons/Laspeyres kodu yazma; ikinci bir motor yazma.**
Tek istisna: Sepet ekranı — saklanan sınıf endekslerinin doğrusal birleşimi, **frontend'de** (`src/lib/basket.ts`)
hesaplanır; arka uç yalnız sepet kaydı (`config/sepetler.json`) ve dışa aktarım için `fiyat_takip.endeks`'i import eder.

Ayrıntılı devir notu: `docs/CLAUDE_CODE_DEVIR_NOTU_MASAUSTU_v3.md`. Yöntem: `METODOLOJI.md`
(Yöntem ekranı bunu `/api/method` ile render eder — `docs/DCK_EOS_Metodoloji_v0.1.docx` ile tutarlı tut).

## Yapı
- `backend/` — Python 3.12 + FastAPI. Tek veri arayüzü `app/data/repository.py::Repository`;
  `FixtureRepository` (JSON, yalnız `--fixtures`), `SqliteRepository` (varsayılan, salt-okunur `?mode=ro`).
  `app/exports.py` yalnız `Repository` arayüzünü kullanır — **özel alan erişimi (`repo._nodes` vb.) yasak.**
- `frontend/` — React 19 + TS (CRA + craco). Recharts, shadcn/ui, `@tanstack/react-query`, `dayjs`, `axios`.
  API sözleşmesi `src/types.ts` + `src/lib/api.ts`; arka uç varsayılan `http://127.0.0.1:8001`.
- `desktop/` — Tauri 2. Arka uç PyInstaller sidecar olarak başlatılır (paketleme adımında).
- `config/` — `kisim_adlari.json`, `sepetler.json`, `config.json` (DB yolu). Kod içinde sabit yol yok.

## Kurallar
- Arayüz Türkçe; kod, tanımlayıcı ve commit mesajı İngilizce. Sayılar `tr-TR`, tarih UI'da `dd.MM.yyyy`, API'de ISO.
- Sözleşmeyi değiştirme: uç ve alan adları `src/types.ts` ile birebir. Yeni alan gerekiyorsa önce `types.ts`, sonra fikstür, sonra SQLite.
- Formüller: `π = I(t2)/I(t1) − 1`; katkı `w_k·(I_k(t2)−I_k(t1)) / Σ w_k·I_k(t1)` (katkılar toplamı = π; birim test). Sepet: `I_S(t) = Σ w_k I_k(t) / Σ w_k`, ağırlık dönem boyunca sabit, tek düzey, kapsanmayan sınıf üst sınıfla temsil edilir ve kapsanan pay kartta görünür. Frontend ve Python uygulamaları aynı fikstürde çapraz test edilir.
- Bölüm renk paleti `src/lib/palette.ts`; PDF aynı hex'leri kullanır.
- Baz günü ve veri tarihi her ekranın footer'ında.
- Her endeks sorgusu `yontem_surumu` ile filtrelenir (varsayılan en yüksek sürüm), damga footer'da.
- Ağır sorgular (`gozlem` ≈ 1,8 M satır) her zaman `kalite_durumu='HAZIR'` filtresiyle ve indeksli sütun üzerinden; kalem detayı dışında `gozlem`'e doğrudan gitme, `v_gozlem_tufe` kullan.
- Bağımlılık ekleme: arka uçta `fastapi, uvicorn, pydantic, python-multipart, openpyxl, reportlab, pytest, httpx` dışına çıkmadan önce sor. Ağ, auth, telemetri, bulut, ORM yok.
- Her adım ayrı commit; `cd backend && pytest -q` ve `cd frontend && yarn build` yeşil olmadan commit yok.
- Gerçek DB olmayan makinede (Mac/CI) `--fixtures` ile çalış; SQLite testleri `DCK_EOS_DB` yoksa `skip`.

## Çalıştırma
```
make dev                       # backend :8001 + frontend :3000 (varsayılan SQLite)
cd backend && python server.py --fixtures                   # fikstürle (ya da DCK_EOS_FIXTURES=1)
cd backend && pytest -q
cd frontend && yarn build
```

## Bilinen tasarım notları (UI'da "not" olarak görünür)
- 04110 kira = ilan kirası (TÜFE ödenen kira değil).
- Az kalemli yüksek ağırlıklı sınıflar: "temsil zayıf" etiketi (ağırlık ≥ 0,3 ∧ kalem < 10 ∧ tarife listesinde değil).
- Kapsanmayan sınıflar (KISIM 25'e kadar): 06310, 04411, 11121, 10102, 09461, 13301, 08330, 07332.
