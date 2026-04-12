//! P2P Networking – Real LibP2P swarm for sector-based multiplayer.
//!
//! Uses mDNS for LAN peer discovery, Noise for encrypted transport,
//! Yamux for stream multiplexing, and GossipSub for broadcasting state diffs.
//! The swarm runs in a dedicated tokio task; Tauri commands communicate via
//! an mpsc channel.

use libp2p::{
    gossipsub, identify, mdns, noise,
    swarm::{NetworkBehaviour, SwarmEvent},
    tcp, yamux, Multiaddr, PeerId, Swarm, SwarmBuilder,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};

// ── Gossipsub topic name ───────────────────────────────────────────────────

const GOSSIP_TOPIC: &str = "synaptic-sandbox/state";

// ── Public Types ───────────────────────────────────────────────────────────

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

// ── Swarm Behaviour ────────────────────────────────────────────────────────

#[derive(NetworkBehaviour)]
struct SandboxBehaviour {
    gossipsub: gossipsub::Behaviour,
    mdns: mdns::tokio::Behaviour,
    identify: identify::Behaviour,
}

// ── Commands sent from Tauri handlers to the swarm task ────────────────────

enum SwarmCommand {
    BroadcastState { diff_json: String },
    Shutdown,
}

// ── Network State ──────────────────────────────────────────────────────────

/// Shared network state managed by Tauri.
pub struct NetworkState {
    /// Our own peer ID.
    peer_id: Option<String>,
    /// Currently known peers on the LAN.
    connected_peers: HashMap<String, PeerInfo>,
    /// Whether the network is active.
    is_active: bool,
    /// The sector we are hosting, if any.
    hosted_sector: Option<String>,
    /// Our current role.
    role: String,
    /// All registered sectors in the global map.
    sectors: HashMap<String, SectorEntry>,
    /// Channel to send commands to the running swarm task.
    command_tx: Option<mpsc::Sender<SwarmCommand>>,
    /// Handle to the swarm task for cleanup.
    swarm_handle: Option<tokio::task::JoinHandle<()>>,
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
            command_tx: None,
            swarm_handle: None,
        }
    }
}

/// Thread-safe wrapper around NetworkState for Tauri managed state.
pub type SharedNetworkState = Arc<Mutex<NetworkState>>;

// ── Swarm event loop ───────────────────────────────────────────────────────

/// Spawn the libp2p swarm in a background tokio task.
/// Returns the local PeerId and a command channel sender.
async fn spawn_swarm(
    app: AppHandle,
    state: SharedNetworkState,
) -> Result<(String, mpsc::Sender<SwarmCommand>), String> {
    let mut swarm = SwarmBuilder::with_new_identity()
        .with_tokio()
        .with_tcp(
            tcp::Config::default(),
            noise::Config::new,
            yamux::Config::default,
        )
        .map_err(|e| format!("TCP transport error: {e}"))?
        .with_behaviour(|key| {
            // GossipSub with default config
            let gossipsub_config = gossipsub::ConfigBuilder::default()
                .heartbeat_interval(Duration::from_secs(1))
                .validation_mode(gossipsub::ValidationMode::Permissive)
                .build()
                .expect("valid gossipsub config");

            let gossipsub = gossipsub::Behaviour::new(
                gossipsub::MessageAuthenticity::Signed(key.clone()),
                gossipsub_config,
            )
            .expect("valid gossipsub behaviour");

            let mdns =
                mdns::tokio::Behaviour::new(mdns::Config::default(), key.public().to_peer_id())
                    .expect("valid mDNS behaviour");

            let identify = identify::Behaviour::new(identify::Config::new(
                "/synaptic-sandbox/1.0.0".to_string(),
                key.public(),
            ));

            Ok(SandboxBehaviour {
                gossipsub,
                mdns,
                identify,
            })
        })
        .map_err(|e| format!("Behaviour error: {e}"))?
        .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(60)))
        .build();

    // Subscribe to our gossipsub topic
    let topic = gossipsub::IdentTopic::new(GOSSIP_TOPIC);
    swarm
        .behaviour_mut()
        .gossipsub
        .subscribe(&topic)
        .map_err(|e| format!("GossipSub subscribe error: {e}"))?;

    // Listen on a random TCP port
    swarm
        .listen_on("/ip4/0.0.0.0/tcp/0".parse::<Multiaddr>().unwrap())
        .map_err(|e| format!("Listen error: {e}"))?;

    let local_peer_id = *swarm.local_peer_id();
    let peer_id_str = local_peer_id.to_string();

    let (cmd_tx, mut cmd_rx) = mpsc::channel::<SwarmCommand>(64);

    let app_clone = app.clone();
    let state_clone = state.clone();
    let peer_id_for_task = peer_id_str.clone();

    // Spawn the event loop
    let handle = tokio::spawn(async move {
        loop {
            tokio::select! {
                event = swarm.select_next_some() => {
                    match event {
                        SwarmEvent::Behaviour(SandboxBehaviourEvent::Mdns(
                            mdns::Event::Discovered(list),
                        )) => {
                            for (peer_id, addr) in list {
                                let pid = peer_id.to_string();
                                log::info!("mDNS discovered: {pid} at {addr}");

                                // Add to gossipsub
                                swarm
                                    .behaviour_mut()
                                    .gossipsub
                                    .add_explicit_peer(&peer_id);

                                // Update state
                                {
                                    let mut net = state_clone.lock().await;
                                    net.connected_peers.insert(
                                        pid.clone(),
                                        PeerInfo {
                                            peer_id: pid.clone(),
                                            role: "visitor".to_string(),
                                            sector_id: None,
                                            latency_ms: 0.0,
                                        },
                                    );
                                }

                                let _ = app_clone.emit(
                                    "network://peer-joined",
                                    serde_json::json!({ "peerId": &pid }),
                                );
                            }

                            // Update status to connected if we have peers
                            let _ = app_clone.emit(
                                "network://status",
                                serde_json::json!({
                                    "status": "connected",
                                    "peerId": &peer_id_for_task,
                                }),
                            );
                        }
                        SwarmEvent::Behaviour(SandboxBehaviourEvent::Mdns(
                            mdns::Event::Expired(list),
                        )) => {
                            for (peer_id, _addr) in list {
                                let pid = peer_id.to_string();
                                log::info!("mDNS expired: {pid}");

                                swarm
                                    .behaviour_mut()
                                    .gossipsub
                                    .remove_explicit_peer(&peer_id);

                                {
                                    let mut net = state_clone.lock().await;
                                    net.connected_peers.remove(&pid);
                                }

                                let _ = app_clone.emit(
                                    "network://peer-left",
                                    serde_json::json!({ "peerId": &pid }),
                                );
                            }
                        }
                        SwarmEvent::Behaviour(SandboxBehaviourEvent::Gossipsub(
                            gossipsub::Event::Message {
                                message, ..
                            },
                        )) => {
                            if let Ok(diff_str) = String::from_utf8(message.data.clone()) {
                                let _ = app_clone.emit(
                                    "network://state-update",
                                    serde_json::json!({ "diff": diff_str }),
                                );
                            }
                        }
                        SwarmEvent::Behaviour(SandboxBehaviourEvent::Identify(
                            identify::Event::Received { peer_id, info, .. },
                        )) => {
                            log::info!(
                                "Identified peer {}: {} with {} addrs",
                                peer_id,
                                info.protocol_version,
                                info.listen_addrs.len()
                            );
                        }
                        _ => {}
                    }
                }
                cmd = cmd_rx.recv() => {
                    match cmd {
                        Some(SwarmCommand::BroadcastState { diff_json }) => {
                            let topic = gossipsub::IdentTopic::new(GOSSIP_TOPIC);
                            if let Err(e) = swarm
                                .behaviour_mut()
                                .gossipsub
                                .publish(topic, diff_json.as_bytes())
                            {
                                log::warn!("GossipSub publish error: {e}");
                            }
                        }
                        Some(SwarmCommand::Shutdown) | None => {
                            log::info!("Swarm shutting down");
                            break;
                        }
                    }
                }
            }
        }
    });

    // Store handle in state
    {
        let mut net = state.lock().await;
        net.swarm_handle = Some(handle);
    }

    Ok((peer_id_str, cmd_tx))
}

// ── Tauri Commands ─────────────────────────────────────────────────────────

/// Start the P2P network subsystem.
///
/// Initializes a real libp2p swarm with mDNS discovery and GossipSub.
#[tauri::command]
pub async fn start_network(
    state: tauri::State<'_, SharedNetworkState>,
    app: AppHandle,
) -> Result<String, String> {
    {
        let net = state.lock().await;
        if net.is_active {
            return Err("Network is already active".to_string());
        }
    }

    let shared = (*state).clone();
    let (peer_id, cmd_tx) = spawn_swarm(app.clone(), shared).await?;

    {
        let mut net = state.lock().await;
        net.peer_id = Some(peer_id.clone());
        net.is_active = true;
        net.role = "disconnected".to_string();
        net.connected_peers.clear();
        net.command_tx = Some(cmd_tx);
    }

    let _ = app.emit(
        "network://status",
        serde_json::json!({
            "status": "discovering",
            "peerId": &peer_id,
        }),
    );

    Ok(peer_id)
}

/// Stop the P2P network subsystem.
#[tauri::command]
pub async fn stop_network(
    state: tauri::State<'_, SharedNetworkState>,
    app: AppHandle,
) -> Result<(), String> {
    let (tx, handle) = {
        let mut net = state.lock().await;
        if !net.is_active {
            return Err("Network is not active".to_string());
        }
        (net.command_tx.take(), net.swarm_handle.take())
    };

    // Signal the swarm to shut down
    if let Some(tx) = tx {
        let _ = tx.send(SwarmCommand::Shutdown).await;
    }

    // Wait for clean exit
    if let Some(handle) = handle {
        let _ = handle.await;
    }

    {
        let mut net = state.lock().await;
        net.is_active = false;
        net.peer_id = None;
        net.connected_peers.clear();
        net.hosted_sector = None;
        net.role = "disconnected".to_string();
        net.sectors.clear();
    }

    let _ = app.emit(
        "network://status",
        serde_json::json!({ "status": "offline" }),
    );

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

    let _ = app.emit(
        "network://sector-hosted",
        serde_json::json!({
            "peerId": &peer_id,
            "sectorId": &sector_id,
        }),
    );

    Ok(())
}

/// Broadcast a serialized state diff to all connected peers via GossipSub.
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

    // Send to swarm task for GossipSub publishing
    if let Some(tx) = &net.command_tx {
        tx.send(SwarmCommand::BroadcastState {
            diff_json: diff_json.clone(),
        })
        .await
        .map_err(|e| format!("Failed to send broadcast command: {e}"))?;
    }

    // Also emit locally for the host's own frontend
    let _ = app.emit(
        "network://state-update",
        serde_json::json!({ "diff": diff_json }),
    );

    Ok(())
}

// ── Sector Expansion (Epic 3.1) ───────────────────────────────────────────

/// Register a new sector in the global map.
#[tauri::command]
pub async fn spawn_sector(
    state: tauri::State<'_, SharedNetworkState>,
    app: AppHandle,
    entry: SectorEntry,
) -> Result<(), String> {
    let mut net = state.lock().await;

    if !net.is_active {
        return Err("Network is not active".to_string());
    }

    let sector_id = entry.sector_id.clone();
    let host_peer_id = entry.host_peer_id.clone();

    net.sectors.insert(sector_id.clone(), entry);

    let _ = app.emit(
        "network://sector-spawned",
        serde_json::json!({
            "sectorId": &sector_id,
            "hostPeerId": &host_peer_id,
        }),
    );

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

    let _ = app.emit(
        "network://sector-removed",
        serde_json::json!({ "sectorId": &sector_id }),
    );

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

// ── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_network_state_default() {
        let state = NetworkState::default();
        assert!(!state.is_active);
        assert_eq!(state.role, "disconnected");
        assert!(state.peer_id.is_none());
        assert!(state.connected_peers.is_empty());
        assert!(state.sectors.is_empty());
    }

    #[test]
    fn test_sector_entry_serialization() {
        let entry = SectorEntry {
            sector_id: "sector-1".to_string(),
            host_peer_id: "12D3KooW123".to_string(),
            origin_x: 0.0,
            origin_y: 0.0,
            width: 50.0,
            height: 50.0,
        };

        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: SectorEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(entry.sector_id, deserialized.sector_id);
        assert_eq!(entry.host_peer_id, deserialized.host_peer_id);
    }

    #[test]
    fn test_peer_info_serialization() {
        let info = PeerInfo {
            peer_id: "12D3KooW456".to_string(),
            role: "host".to_string(),
            sector_id: Some("sector-a".to_string()),
            latency_ms: 12.5,
        };

        let json = serde_json::to_string(&info).unwrap();
        let deserialized: PeerInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(info.peer_id, deserialized.peer_id);
        assert_eq!(info.role, deserialized.role);
        assert_eq!(info.latency_ms, deserialized.latency_ms);
    }
}
