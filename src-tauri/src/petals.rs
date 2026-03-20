//! Petals Distributed Inference – relay interface for distributed LLM inference.
//!
//! Provides Tauri commands that model the Petals swarm for distributed model
//! hosting. Currently uses local Ollama as a backend proxy (same as ollama.rs)
//! so the frontend can be developed and tested without a real Petals cluster.
//! Designed for drop-in replacement with real Petals RPC later.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

// ── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerCapability {
    pub peer_id: String,
    pub vram_mb: f64,
    pub layers_hosted: u32,
    pub available: bool,
}

/// Shared state for the Petals distributed inference subsystem.
pub struct PetalsState {
    /// Whether we are connected to the Petals swarm.
    is_connected: bool,
    /// Our own capability, if reported.
    local_capability: Option<PeerCapability>,
    /// Known peer capabilities (peerId → capability).
    peer_capabilities: HashMap<String, PeerCapability>,
}

impl Default for PetalsState {
    fn default() -> Self {
        Self {
            is_connected: false,
            local_capability: None,
            peer_capabilities: HashMap::new(),
        }
    }
}

/// Thread-safe wrapper for Tauri managed state.
pub type SharedPetalsState = Arc<Mutex<PetalsState>>;

// ── Tauri Commands ──────────────────────────────────────────────────────────

/// Join the distributed model swarm.
#[tauri::command]
pub async fn connect_petals_swarm(
    state: tauri::State<'_, SharedPetalsState>,
    app: AppHandle,
) -> Result<bool, String> {
    let mut petals = state.lock().await;

    if petals.is_connected {
        return Ok(true);
    }

    petals.is_connected = true;

    let _ = app.emit("petals://status", serde_json::json!({
        "status": "connected",
    }));

    Ok(true)
}

/// Leave the distributed model swarm.
#[tauri::command]
pub async fn disconnect_petals_swarm(
    state: tauri::State<'_, SharedPetalsState>,
    app: AppHandle,
) -> Result<(), String> {
    let mut petals = state.lock().await;

    petals.is_connected = false;
    petals.local_capability = None;
    petals.peer_capabilities.clear();

    let _ = app.emit("petals://status", serde_json::json!({
        "status": "disconnected",
    }));

    Ok(())
}

/// Send a prompt to the distributed Petals relay for inference.
///
/// Currently proxies to local Ollama. When real Petals integration is added,
/// this will route to the appropriate peer in the swarm.
#[tauri::command]
pub async fn generate_distributed(
    state: tauri::State<'_, SharedPetalsState>,
    model: String,
    prompt: String,
) -> Result<String, String> {
    let petals = state.lock().await;

    if !petals.is_connected {
        return Err("Not connected to Petals swarm".to_string());
    }

    // Release the lock before making the HTTP call
    drop(petals);

    // Proxy to local Ollama for now (same as ollama::generate_completion)
    let url = format!("http://localhost:11434/api/generate");
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
        .map_err(|e| format!("Distributed inference request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Inference returned status {}", resp.status()));
    }

    #[derive(Deserialize)]
    struct GenerateResponse {
        response: String,
    }

    let gen: GenerateResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse inference response: {e}"))?;

    Ok(gen.response)
}

/// Announce this peer's GPU capacity to the swarm.
#[tauri::command]
pub async fn report_capability(
    state: tauri::State<'_, SharedPetalsState>,
    vram_mb: f64,
    layers_hosted: u32,
) -> Result<(), String> {
    let mut petals = state.lock().await;

    let capability = PeerCapability {
        peer_id: "local".to_string(),
        vram_mb,
        layers_hosted,
        available: true,
    };

    petals.local_capability = Some(capability);

    Ok(())
}

/// Retrieve all known peer GPU capabilities.
#[tauri::command]
pub async fn get_peer_capabilities(
    state: tauri::State<'_, SharedPetalsState>,
) -> Result<Vec<PeerCapability>, String> {
    let petals = state.lock().await;

    let mut caps: Vec<PeerCapability> = petals.peer_capabilities.values().cloned().collect();

    // Include our own capability if reported
    if let Some(local) = &petals.local_capability {
        caps.push(local.clone());
    }

    Ok(caps)
}
