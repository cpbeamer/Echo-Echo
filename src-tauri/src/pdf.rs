//! PDF text extraction – Tauri command for extracting text from PDF files.
//!
//! Uses the `pdf-extract` crate to pull readable text from a user-selected
//! PDF file. The frontend invokes this via `invoke('extract_pdf_text', ...)`.

/// Extract all readable text from a PDF file at the given path.
///
/// Returns the concatenated text content of all pages, or a descriptive
/// error if the file cannot be read or parsed.
#[tauri::command]
pub async fn extract_pdf_text(file_path: String) -> Result<String, String> {
    let bytes = tokio::fs::read(&file_path)
        .await
        .map_err(|e| format!("Failed to read file '{}': {}", file_path, e))?;

    // pdf-extract is synchronous, so run it on a blocking thread
    let text = tokio::task::spawn_blocking(move || {
        pdf_extract::extract_text_from_mem(&bytes)
            .map_err(|e| format!("Failed to extract PDF text: {e}"))
    })
    .await
    .map_err(|e| format!("PDF extraction task panicked: {e}"))??;

    if text.trim().is_empty() {
        return Err("PDF contains no extractable text (may be image-only or encrypted).".into());
    }

    Ok(text)
}
