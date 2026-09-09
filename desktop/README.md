# Tauri Masaüstü İskeleti

Bu klasör, uygulamanın masaüstü (Tauri 2) paketleme iskeletini içerir. Web
uygulaması aynı kod tabanından `yarn start` + `uvicorn` ile de çalışır.

## Yapı

- `tauri.conf.json` — pencere, build ve bundle yapılandırması
- `Cargo.toml` — Rust bağımlılıkları
- `src/main.rs` — WebView giriş noktası

## Geliştirme

```bash
# Ön koşul: Rust + Tauri CLI (cargo install tauri-cli --version "^2")
cd desktop
cargo tauri dev
```

Geliştirme sırasında WebView `http://localhost:3000` adresini yükler; üretim
paketinde `../frontend/build` klasörü gömülür. Her iki durumda da arayüz,
localhost:8001 üzerindeki FastAPI backend'i ile `/api` üzerinden konuşur.

> Not: Bu ortamda Rust derleyicisi bulunmayabilir; iskelet, hedef makinede
> `cargo tauri build` ile paketlenmek üzere hazırdır.
