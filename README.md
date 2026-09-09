# DÇK-EÖS Fiyat Endeksi

Yerel-öncelikli (local-first, offline) masaüstü fiyat endeksi analiz uygulaması.
Türkçe arayüz; kod ve tanımlayıcılar İngilizce.

## Mimari

- **frontend/** — React + TypeScript, Recharts, Tailwind, shadcn/ui
- **backend/** — Python 3.12 + FastAPI, salt-okunur veri erişimi
  - `app/data/repository.py` — tek arayüz; `FixtureRepository` (JSON fixtures)
    ve `SqliteRepository` (faz-2 stub)
  - `fixtures/` — statik JSON mock veri (API sözleşmesine birebir uygun)
  - `app/exports.py` — Excel / PDF / TÜİK karşılaştırma
- **desktop/** — Tauri iskeleti (`tauri.conf.json`)
- **METODOLOJI.md** — yöntem/metodoloji (KaTeX ile render edilir)

Backend yalnızca localhost'ta çalışır. Kimlik doğrulama, hesap, bulut, telemetri
veya dış API çağrısı yoktur.

## Çalıştırma (web)

```bash
# Backend
cd backend
pip install -r requirements.txt
python generate_fixtures.py          # fixtures/*.json üretir (bir kez)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend
cd frontend
yarn install
yarn start                           # http://localhost:3000
```

Ya da kısayol:

```bash
make dev        # backend + frontend birlikte
```

## Masaüstü (Tauri)

```bash
cd desktop
cargo tauri dev     # geliştirme
cargo tauri build   # paketleme
```

## API Sözleşmesi

Tüm uçlar `/api` önekiyle sunulur: `/meta`, `/index`, `/index/multi`, `/tree`,
`/contrib`, `/sources/{kod}`, `/items/{kod}`, `/item/{kimlik}`, `/quality`,
`/basket/compute`, `/tuik/compare`, `/export/excel`, `/export/pdf`.

## Faz 2

`fiyat_takip.sqlite` gece üretilir. Geçiş için yalnızca `server.py` içindeki tek
`FixtureRepository(...)` kurulum satırı `SqliteRepository(...)` ile değiştirilir.
