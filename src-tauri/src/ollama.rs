//! Ollama integration – detect running instances and proxy LLM requests.
//!
//! All communication with the local Ollama HTTP API (`http://localhost:11434`)
//! happens here so the frontend never makes direct external HTTP calls.

use serde::Deserialize;

const OLLAMA_BASE_URL: &str = "http://localhost:11434";

// ── API response types ──────────────────────────────────────────────────────

#[derive(Deserialize)]
struct TagsResponse {
    models: Vec<ModelInfo>,
}

#[derive(Deserialize)]
struct ModelInfo {
    name: String,
}

#[derive(Deserialize)]
struct GenerateResponse {
    response: String,
}

// ── Tauri commands ──────────────────────────────────────────────────────────

/// Check whether a local Ollama instance is reachable.
#[tauri::command]
pub async fn detect_ollama() -> Result<bool, String> {
    let url = OLLAMA_BASE_URL;
    match reqwest::get(url).await {
        Ok(resp) => Ok(resp.status().is_success()),
        // Connection refused / timeout → Ollama is not running
        Err(_) => Ok(false),
    }
}

/// List available model names from the local Ollama instance.
#[tauri::command]
pub async fn list_models() -> Result<Vec<String>, String> {
    let url = format!("{}/api/tags", OLLAMA_BASE_URL);
    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("Ollama not found: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama returned status {}", resp.status()));
    }

    let tags: TagsResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse model list: {e}"))?;

    Ok(tags.models.into_iter().map(|m| m.name).collect())
}

/// Send a prompt to Ollama and return the full generated response.
///
/// Uses the non-streaming `/api/generate` endpoint (`stream: false`).
#[tauri::command]
pub async fn generate_completion(model: String, prompt: String) -> Result<String, String> {
    let url = format!("{}/api/generate", OLLAMA_BASE_URL);
    let client = reqwest::Client::new();

    let body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "stream": false,
    });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama returned status {}", resp.status()));
    }

    let gen: GenerateResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {e}"))?;

    Ok(gen.response)
}
