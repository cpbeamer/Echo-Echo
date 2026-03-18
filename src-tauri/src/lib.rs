mod ollama;
mod pdf;
mod url_fetch;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            ollama::detect_ollama,
            ollama::list_models,
            ollama::generate_completion,
            pdf::extract_pdf_text,
            url_fetch::fetch_url_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
