mod networking;
mod ollama;
mod pdf;
mod url_fetch;

use std::sync::Arc;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(Mutex::new(networking::NetworkState::default())) as networking::SharedNetworkState)
        .invoke_handler(tauri::generate_handler![
            ollama::detect_ollama,
            ollama::list_models,
            ollama::generate_completion,
            pdf::extract_pdf_text,
            url_fetch::fetch_url_text,
            networking::start_network,
            networking::stop_network,
            networking::get_peer_id,
            networking::get_connected_peers,
            networking::host_sector,
            networking::broadcast_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

