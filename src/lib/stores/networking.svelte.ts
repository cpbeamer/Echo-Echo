/**
 * Networking Store – Svelte 5 reactive state for P2P networking (Epic 3.0 + 3.1 + 3.2).
 *
 * Keeps network-specific state separate from the simulation store while
 * exposing reactive primitives for the NetworkPanel and GlobalMapView UIs.
 */

import type {
  PeerInfo,
  PeerRole,
  NetworkStatus,
  NetworkEvent,
  NetworkConfig,
  SectorInfo,
  SectorExpansionConfig,
  FactionProgress,
  ComputeBoost,
  ManifestoDefusal,
  FactionWarfareConfig,
  PeerCapability,
  DistributedInferenceConfig,
} from '../../types';
import {
  DEFAULT_NETWORK_CONFIG,
  DEFAULT_SECTOR_EXPANSION_CONFIG,
  DEFAULT_FACTION_WARFARE_CONFIG,
  DEFAULT_DISTRIBUTED_INFERENCE_CONFIG,
} from '../../types';
import { createInitialFactionProgress } from '../../engine/faction-warfare';

/** Maximum events retained in the network event log. */
const MAX_NETWORK_EVENTS = 100;

let nextEventId = 0;

class NetworkingState {
  peerId: string | null = $state(null);
  status: NetworkStatus = $state('offline');
  role: PeerRole = $state('disconnected');
  connectedPeers: PeerInfo[] = $state([]);
  config: NetworkConfig = $state({ ...DEFAULT_NETWORK_CONFIG });
  events: NetworkEvent[] = $state([]);
  /** The sector ID this node is hosting or visiting. */
  activeSectorId: string | null = $state(null);

  /** All sectors in the global map (Epic 3.1). */
  sectors: SectorInfo[] = $state([]);
  /** Sector expansion configuration (Epic 3.1). */
  expansionConfig: SectorExpansionConfig = $state({ ...DEFAULT_SECTOR_EXPANSION_CONFIG });
  /** Whether the global map overlay is visible (Epic 3.1). */
  showGlobalMap: boolean = $state(false);

  // ── Faction Warfare (Epic 3.2) ─────────────────────────────────────────

  /** Per-faction victory progress bars. */
  factionProgress: FactionProgress[] = $state(createInitialFactionProgress());
  /** Active compute boost donations from peers. */
  computeBoosts: ComputeBoost[] = $state([]);
  /** In-progress manifesto defusals. */
  activeDefusals: ManifestoDefusal[] = $state([]);
  /** Faction warfare configuration. */
  warfareConfig: FactionWarfareConfig = $state({ ...DEFAULT_FACTION_WARFARE_CONFIG });

  // ── Distributed Inference (Epic 3.3) ─────────────────────────────────────

  /** Configuration for distributed inference routing. */
  distributedInferenceConfig: DistributedInferenceConfig = $state({ ...DEFAULT_DISTRIBUTED_INFERENCE_CONFIG });
  /** Known peer GPU capabilities for load balancing. */
  peerCapabilities: PeerCapability[] = $state([]);
  /** Number of distributed inference requests currently in-flight. */
  distributedActive: number = $state(0);
  /** Number of distributed inference requests pending dispatch. */
  distributedPending: number = $state(0);

  /** Update our own peer ID after network start. */
  setPeerId(id: string): void {
    this.peerId = id;
  }

  /** Update the overall network status. */
  setStatus(status: NetworkStatus): void {
    this.status = status;
  }

  /** Update our role for the active sector. */
  setRole(role: PeerRole): void {
    this.role = role;
  }

  /** Replace the full peer list (after polling or event-driven refresh). */
  setPeers(peers: PeerInfo[]): void {
    this.connectedPeers = [...peers];
  }

  /** Set the sector we are hosting or visiting. */
  setActiveSector(sectorId: string | null): void {
    this.activeSectorId = sectorId;
  }

  /** Update sync configuration. */
  updateConfig(partial: Partial<NetworkConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /** Push a network event to the log (newest first). */
  pushEvent(event: Omit<NetworkEvent, 'id' | 'timestamp'>): void {
    const fullEvent = {
      ...event,
      id: `net-${nextEventId++}`,
      timestamp: Date.now(),
    } as NetworkEvent;

    this.events = [fullEvent, ...this.events].slice(0, MAX_NETWORK_EVENTS);
  }

  // ── Sector Expansion (Epic 3.1) ─────────────────────────────────────────

  /** Replace the entire sectors list. */
  setSectors(sectors: SectorInfo[]): void {
    this.sectors = [...sectors];
  }

  /** Add a single sector to the list. */
  addSector(info: SectorInfo): void {
    this.sectors = [...this.sectors, info];
  }

  /** Remove a sector by ID. */
  removeSector(sectorId: string): void {
    this.sectors = this.sectors.filter((s) => s.sectorId !== sectorId);
  }

  /** Update the expansion configuration. */
  updateExpansionConfig(partial: Partial<SectorExpansionConfig>): void {
    this.expansionConfig = { ...this.expansionConfig, ...partial };
  }

  /** Toggle global map visibility. */
  toggleGlobalMap(): void {
    this.showGlobalMap = !this.showGlobalMap;
  }

  // ── Faction Warfare (Epic 3.2) ─────────────────────────────────────────

  /** Replace the entire faction progress array. */
  updateFactionProgress(progress: FactionProgress[]): void {
    this.factionProgress = [...progress];
  }

  /** Register a new compute boost from a peer. */
  addComputeBoost(boost: ComputeBoost): void {
    // Replace any existing boost from the same peer
    this.computeBoosts = [
      ...this.computeBoosts.filter((b) => b.peerId !== boost.peerId),
      boost,
    ];
  }

  /** Remove a peer's compute boost (e.g., on disconnect). */
  removeComputeBoost(peerId: string): void {
    this.computeBoosts = this.computeBoosts.filter((b) => b.peerId !== peerId);
  }

  /** Add a new manifesto defusal. */
  addDefusal(defusal: ManifestoDefusal): void {
    this.activeDefusals = [...this.activeDefusals, defusal];
  }

  /** Update an existing defusal's progress. */
  updateDefusal(bombId: string, patch: Partial<ManifestoDefusal>): void {
    this.activeDefusals = this.activeDefusals.map((d) =>
      d.bombId === bombId ? { ...d, ...patch } : d,
    );
  }

  /** Remove a completed or expired defusal. */
  removeDefusal(bombId: string): void {
    this.activeDefusals = this.activeDefusals.filter((d) => d.bombId !== bombId);
  }

  /** Update the warfare configuration. */
  updateWarfareConfig(partial: Partial<FactionWarfareConfig>): void {
    this.warfareConfig = { ...this.warfareConfig, ...partial };
  }

  // ── Distributed Inference (Epic 3.3) ─────────────────────────────────────

  /** Update the distributed inference configuration. */
  updateDistributedInferenceConfig(partial: Partial<DistributedInferenceConfig>): void {
    this.distributedInferenceConfig = { ...this.distributedInferenceConfig, ...partial };
  }

  /** Replace the known peer capabilities. */
  setPeerCapabilities(capabilities: PeerCapability[]): void {
    this.peerCapabilities = [...capabilities];
  }

  /** Update distributed inference HUD stats. */
  updateDistributedStats(active: number, pending: number): void {
    this.distributedActive = active;
    this.distributedPending = pending;
  }

  /** Reset all networking state (called on disconnect). */
  reset(): void {
    this.peerId = null;
    this.status = 'offline';
    this.role = 'disconnected';
    this.connectedPeers = [];
    this.activeSectorId = null;
    this.events = [];
    this.sectors = [];
    this.showGlobalMap = false;
    this.factionProgress = createInitialFactionProgress();
    this.computeBoosts = [];
    this.activeDefusals = [];
    this.distributedInferenceConfig = { ...DEFAULT_DISTRIBUTED_INFERENCE_CONFIG };
    this.peerCapabilities = [];
    this.distributedActive = 0;
    this.distributedPending = 0;
    nextEventId = 0;
  }
}

export const networking = new NetworkingState();

