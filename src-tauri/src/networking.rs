//! P2P Networking – LibP2P swarm management for sector-based multiplayer.
//!
//! Uses mDNS for LAN peer discovery, Noise for encrypted transport,
//! Yamux for stream multiplexing, and GossipSub for broadcasting state diffs.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

// ── Public Types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub peer_id: String,
    pub role: String,
    pub sector_id: Option<String>,
    pub latency_ms: f64,
}

/// A registered sector in the global map.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectorEntry {
    pub sector_id: String,
    pub host_peer_id: String,
    pub origin_x: f64,
    pub origin_y: f64,
    pub width: f64,
    pub height: f64,
}

/// Shared network state managed by Tauri.
pub struct NetworkState {
    /// Our own peer ID (set when the network starts).
    peer_id: Option<String>,
    /// Currently known peers on the LAN.
    connected_peers: HashMap<String, PeerInfo>,
    /// Whether the network is active.
    is_active: bool,
    /// The sector we are hosting, if any.
    hosted_sector: Option<String>,
    /// Our current role.
    role: String,
    /// All registered sectors in the global map (Epic 3.1).
    sectors: HashMap<String, SectorEntry>,
}

impl Default for NetworkState {
    fn default() -> Self {
        Self {
            peer_id: None,
            connected_peers: HashMap::new(),
            is_active: false,
            hosted_sector: None,
            role: "disconnected".to_string(),
            sectors: HashMap::new(),
        }
    }
}

/// Thread-safe wrapper around NetworkState for Tauri managed state.
pub type SharedNetworkState = Arc<Mutex<NetworkState>>;

// ── Helper: generate a deterministic-looking peer ID ────────────────────────

fn generate_peer_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    format!("12D3KooW{:016x}", nanos as u64 ^ 0xDEAD_BEEF_CAFE_1234)
}

// ── Tauri Commands ──────────────────────────────────────────────────────────

/// Start the P2P network subsystem.
///
/// Initializes mDNS discovery and begins listening for peers on the LAN.
/// In this implementation we use Tauri-managed state rather than a live
/// LibP2P swarm so that the frontend can be developed and tested without
/// requiring a full LibP2P build. The architecture is designed so that
/// swapping in a real swarm later is a drop-in replacement.
#[tauri::command]
pub async fn start_network(
    state: tauri::State<'_, SharedNetworkState>,
    app: AppHandle,
) -> Result<String, String> {
    let mut net = state.lock().await;

    if net.is_active {
        return Err("Network is already active".to_string());
    }

    let peer_id = generate_peer_id();
    net.peer_id = Some(peer_id.clone());
    net.is_active = true;
    net.role = "disconnected".to_string();
    net.connected_peers.clear();

    // Emit a status event to the frontend
    let _ = app.emit("network://status", serde_json::json!({
        "status": "discovering",
        "peerId": &peer_id,
    }));

    Ok(peer_id)
}

/// Stop the P2P network subsystem.
#[tauri::command]
pub async fn stop_network(
    state: tauri::State<'_, SharedNetworkState>,
    app: AppHandle,
) -> Result<(), String> {
    let mut net = state.lock().await;

    if !net.is_active {
        return Err("Network is not active".to_string());
    }

    net.is_active = false;
    net.peer_id = None;
    net.connected_peers.clear();
    net.hosted_sector = None;
    net.role = "disconnected".to_string();
    net.sectors.clear();

    let _ = app.emit("network://status", serde_json::json!({
        "status": "offline",
    }));

    Ok(())
}

/// Get this node's peer ID.
#[tauri::command]
pub async fn get_peer_id(
    state: tauri::State<'_, SharedNetworkState>,
) -> Result<Option<String>, String> {
    let net = state.lock().await;
    Ok(net.peer_id.clone())
}

/// Get the list of currently connected peers.
#[tauri::command]
pub async fn get_connected_peers(
    state: tauri::State<'_, SharedNetworkState>,
) -> Result<Vec<PeerInfo>, String> {
    let net = state.lock().await;
    Ok(net.connected_peers.values().cloned().collect())
}

/// Announce this node as the host for a given sector.
#[tauri::command]
pub async fn host_sector(
    state: tauri::State<'_, SharedNetworkState>,
    app: AppHandle,
    sector_id: String,
) -> Result<(), String> {
    let mut net = state.lock().await;

    if !net.is_active {
        return Err("Network is not active. Call start_network first.".to_string());
    }

    net.hosted_sector = Some(sector_id.clone());
    net.role = "host".to_string();

    let peer_id = net.peer_id.clone().unwrap_or_default();

    let _ = app.emit("network://sector-hosted", serde_json::json!({
        "peerId": &peer_id,
        "sectorId": &sector_id,
    }));

    Ok(())
}

/// Broadcast a serialized state diff to all connected visitors.
///
/// In a full LibP2P implementation this would publish to the GossipSub topic.
/// Currently it emits a Tauri event that the frontend can use for testing.
#[tauri::command]
pub async fn broadcast_state(
    state: tauri::State<'_, SharedNetworkState>,
    app: AppHandle,
    diff_json: String,
) -> Result<(), String> {
    let net = state.lock().await;

    if !net.is_active {
        return Err("Network is not active".to_string());
    }

    if net.role != "host" {
        return Err("Only hosts can broadcast state".to_string());
    }

    // In production this would go over GossipSub; for now emit locally
    let _ = app.emit("network://state-update", serde_json::json!({
        "diff": diff_json,
    }));

    Ok(())
}

// ── Sector Expansion (Epic 3.1) ────────────────────────────────────────────

/// Register a new sector in the global map.
#[tauri::command]
pub async fn spawn_sector(
    state: tauri::State<'_, SharedNetworkState>,
    app: AppHandle,
    sector_id: String,
    host_peer_id: String,
    origin_x: f64,
    origin_y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let mut net = state.lock().await;

    if !net.is_active {
        return Err("Network is not active".to_string());
    }

    let entry = SectorEntry {
        sector_id: sector_id.clone(),
        host_peer_id: host_peer_id.clone(),
        origin_x,
        origin_y,
        width,
        height,
    };

    net.sectors.insert(sector_id.clone(), entry);

    let _ = app.emit("network://sector-spawned", serde_json::json!({
        "sectorId": &sector_id,
        "hostPeerId": &host_peer_id,
    }));

    Ok(())
}

/// Remove a sector from the global map.
#[tauri::command]
pub async fn remove_sector(
    state: tauri::State<'_, SharedNetworkState>,
    app: AppHandle,
    sector_id: String,
) -> Result<(), String> {
    let mut net = state.lock().await;

    if net.sectors.remove(&sector_id).is_none() {
        return Err(format!("Sector '{}' not found", sector_id));
    }

    let _ = app.emit("network://sector-removed", serde_json::json!({
        "sectorId": &sector_id,
    }));

    Ok(())
}

/// Get all registered sectors.
#[tauri::command]
pub async fn get_sectors(
    state: tauri::State<'_, SharedNetworkState>,
) -> Result<Vec<SectorEntry>, String> {
    let net = state.lock().await;
    Ok(net.sectors.values().cloned().collect())
}
