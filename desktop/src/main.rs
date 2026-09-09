// Tauri desktop entrypoint (scaffold).
// The Python FastAPI backend is expected to be running on localhost:8001;
// the WebView loads the built frontend which talks to it over /api.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running DÇK-EÖS Fiyat Endeksi");
}
