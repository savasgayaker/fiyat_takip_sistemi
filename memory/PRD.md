# PRD — DÇK-EÖS Fiyat Endeksi

## Original Problem Statement
Local-first, offline desktop analytics app for a Turkish labour confederation's
daily price index. Turkish UI, English code. React + TypeScript + Recharts +
Tailwind + shadcn/ui frontend; Python 3.12 + FastAPI backend serving MOCK data
from static JSON fixtures (phase 1) via a swappable Repository interface
(FixtureRepository now, SqliteRepository stub later). No DB schema, no auth, no
cloud/telemetry/external calls. Tauri desktop scaffold. 7 screens.

## Architecture
- **backend/** FastAPI, all routes under `/api`.
  - `app/data/repository.py` — `Repository` ABC + `FixtureRepository` + `SqliteRepository` stub.
  - `generate_fixtures.py` → `fixtures/*.json` (nodes, items, item_series, quality, baskets, meta).
  - `app/exports.py` — Excel (openpyxl), PDF bülten (reportlab + DejaVuSans), TÜİK xlsx compare.
  - `tests/test_smoke.py` — 16 endpoint smoke tests (all pass).
- **frontend/** CRA + TypeScript. `src/i18n/tr.ts` (hard-coded TR), `src/lib/` (api, format tr-TR, palette by bolum, dates presets, chart PNG export), `src/context/AppContext.tsx` (global date range + theme + meta), pages + layout + charts + breakdown tree.
- **desktop/** Tauri 2 scaffold (`tauri.conf.json`, `Cargo.toml`, `src/main.rs`).
- `METODOLOJI.md`, `README.md`, `Makefile` (`make dev`), `.gitignore`.

## Data (fixtures)
60 days (2026-07-15…2026-09-12), TOPLAM 100 → 101.56. 13 COICOP-2018 divisions,
59 sinif5 classes with TÜİK-like weights, 8 sources, 188 items. 1 CARRY class
(Zeytinyağı), sections 7 & 12 rc=4, section 19 rc=5. Coverage 98.78%.

## Implemented (2026-06)
- All 7 screens working with fixtures: Pano, Kırılım, Sepet, Kaynaklar & Kalite, TÜİK Kıyas, Dışa Aktar, Yöntem.
- Full API contract implemented. Excel/PDF export + TÜİK xlsx upload all functional.
- Global search (/ hotkey), date presets (1–5 hotkeys), dark/light theme, settings dialog, footer stamp, empty/loading/error states, division colour palette, PNG chart export, KaTeX methodology.
- Verified end-to-end by testing agent: backend 100%, frontend 100%.

## Personas
- Confederation analyst reviewing daily index, division contributions, data quality, and TÜİK comparison; exports bülten/Excel.

## Backlog (out of current scope unless requested)
- P2: Phase-2 `SqliteRepository` reading real `fiyat_takip.sqlite`.
- P2: Real Tauri build on a machine with Rust toolchain.
- P2: TÜİK monthly markers overlaid on Pano chart from an uploaded file.

## Next Tasks
- Awaiting user review of the running app.
