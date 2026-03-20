/**
 * Networking type definitions for Epic 3.0 – P2P Networking Foundation.
 *
 * Covers peer roles, state synchronization diffs, network configuration,
 * and event types emitted by the LibP2P backend.
 */

import type { Vec2, DNAVector, Faction, MemoryEntry, DataBomb } from './agent';

// ── Peer & Role ─────────────────────────────────────────────────────────────

/** Unique string identifier assigned by LibP2P. */
export type PeerId = string;

/** The role a node plays for a given sector. */
export type PeerRole = 'host' | 'visitor' | 'disconnected';

/** Overall network connection state. */
export type NetworkStatus = 'offline' | 'discovering' | 'connected';

/** Summary information about a connected peer. */
export interface PeerInfo {
  peerId: PeerId;
  role: PeerRole;
  /** Sector this peer hosts or visits, if any. */
  sectorId: string | null;
  /** Round-trip latency estimate in milliseconds. */
  latencyMs: number;
}

// ── Sector Assignment ───────────────────────────────────────────────────────

/** Maps a peer to its sector ownership/observation role. */
export interface SectorAssignment {
  peerId: PeerId;
  sectorId: string;
  role: PeerRole;
}

// ── Serialization ───────────────────────────────────────────────────────────

/**
 * JSON-safe representation of an Agent.
 * Converts Map<string, number> (adjacencyTicks) to Record<string, number>.
 */
export interface SerializedAgent {
  id: string;
  vector: DNAVector;
  loreCache: string[];
  lingo: Record<string, string>;
  faction: Faction;
  position: Vec2;
  velocity: Vec2;
  energy: number;
  color: string;
  radius: number;
  activityLevel: number;
  deathFrame: number | null;
  adjacencyTicks: Record<string, number>;
  parentIds: [string, string] | null;
  lastReproductionTick: number;
  memory: MemoryEntry[];
}

// ── State Diff ──────────────────────────────────────────────────────────────

/** Minimal delta describing changes between two simulation snapshots. */
export interface StateDiff {
  /** Tick number this diff represents. */
  tick: number;
  /** Fully serialized agents that were added since last diff. */
  added: SerializedAgent[];
  /** IDs of agents that were removed since last diff. */
  removed: string[];
  /** Partial updates: only mutated fields per agent. */
  changed: AgentPatch[];
}

/** Sparse update payload for a single agent. Only non-undefined fields are applied. */
export interface AgentPatch {
  id: string;
  vector?: DNAVector;
  loreCache?: string[];
  lingo?: Record<string, string>;
  faction?: Faction;
  position?: Vec2;
  velocity?: Vec2;
  energy?: number;
  color?: string;
  activityLevel?: number;
  deathFrame?: number | null;
  adjacencyTicks?: Record<string, number>;
  memory?: MemoryEntry[];
}

// ── Network Configuration ───────────────────────────────────────────────────

/** Configurable parameters for the networking subsystem. */
export interface NetworkConfig {
  /** How often (in simulation ticks) the host broadcasts state diffs to visitors. */
  syncTickRate: number;
  /** Maximum number of visitors allowed in a hosted sector. */
  maxVisitors: number;
}

export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  syncTickRate: 5,
  maxVisitors: 8,
};

// ── Sector Expansion (Epic 3.1) ─────────────────────────────────────────────

/** Axis-aligned bounding rectangle for a sector in global grid coordinates. */
export interface SectorBounds {
  /** Top-left X in global coordinates. */
  originX: number;
  /** Top-left Y in global coordinates. */
  originY: number;
  /** Width of the sector in cells. */
  width: number;
  /** Height of the sector in cells. */
  height: number;
}

/** Metadata describing a sector on the global map. */
export interface SectorInfo {
  sectorId: string;
  hostPeerId: PeerId;
  bounds: SectorBounds;
  /** Number of agents currently in this sector. */
  agentCount: number;
  /** The faction that has the most agents in this sector. */
  dominantFaction: Faction;
  /** IDs of sectors that share a boundary edge with this one. */
  adjacentSectorIds: string[];
}

/** Configurable thresholds for dynamic sector expansion. */
export interface SectorExpansionConfig {
  /** When connectedUsers ≥ threshold × sectorCount, spawn a new sector. */
  userThresholdForNewSector: number;
  /** Hard cap on total sectors. */
  maxSectors: number;
  /** Width/height of each generated sector in grid cells. */
  sectorGridSize: number;
  /** Distance (in cells) from sector edge that qualifies an agent for migration. */
  migrationEdgeThreshold: number;
}

export const DEFAULT_SECTOR_EXPANSION_CONFIG: SectorExpansionConfig = {
  userThresholdForNewSector: 4,
  maxSectors: 16,
  sectorGridSize: 100,
  migrationEdgeThreshold: 2,
};

// ── Remote Data Bomb ────────────────────────────────────────────────────────

/** A data bomb request sent from a visitor to the sector host. */
export interface RemoteDataBomb extends DataBomb {
  /** PeerId of the visitor who sent this bomb. */
  senderPeerId: PeerId;
}

// ── Network Events ──────────────────────────────────────────────────────────

/** Tagged union of all network events surfaced to the UI. */
export type NetworkEvent =
  | PeerJoinedEvent
  | PeerLeftEvent
  | SectorHostedEvent
  | BombReceivedEvent
  | SectorSpawnedEvent
  | SectorRemovedEvent
  | AgentMigrationEvent
  | ComputeBoostEvent
  | ManifestoDefusalEvent
  | InferenceRoutedEvent
  | PeerCapacityEvent;

interface BaseNetworkEvent {
  id: string;
  timestamp: number;
  message: string;
}

export interface PeerJoinedEvent extends BaseNetworkEvent {
  type: 'peer_joined';
  peerId: PeerId;
}

export interface PeerLeftEvent extends BaseNetworkEvent {
  type: 'peer_left';
  peerId: PeerId;
}

export interface SectorHostedEvent extends BaseNetworkEvent {
  type: 'sector_hosted';
  peerId: PeerId;
  sectorId: string;
}

export interface BombReceivedEvent extends BaseNetworkEvent {
  type: 'bomb_received';
  senderPeerId: PeerId;
  affectedCount: number;
}

export interface SectorSpawnedEvent extends BaseNetworkEvent {
  type: 'sector_spawned';
  sectorId: string;
  hostPeerId: PeerId;
}

export interface SectorRemovedEvent extends BaseNetworkEvent {
  type: 'sector_removed';
  sectorId: string;
}

export interface AgentMigrationEvent extends BaseNetworkEvent {
  type: 'agent_migration';
  agentId: string;
  fromSectorId: string;
  toSectorId: string;
}

export interface ComputeBoostEvent extends BaseNetworkEvent {
  type: 'compute_boost';
  peerId: PeerId;
  faction: Faction;
  computeUnits: number;
}

export interface ManifestoDefusalEvent extends BaseNetworkEvent {
  type: 'manifesto_defusal';
  bombId: string;
  sectorId: string;
  defuseProgress: number;
  completed: boolean;
}

// ── Faction Warfare (Epic 3.2) ──────────────────────────────────────────────

/** Per-faction victory progress state. */
export interface FactionProgress {
  faction: Faction;
  /** Victory progress [0, 1]. */
  progress: number;
  /** Cumulative compute units donated to this faction. */
  totalCompute: number;
  /** Current alive agent count for this faction. */
  agentCount: number;
}

/** A peer's GPU compute donation to their faction. */
export interface ComputeBoost {
  peerId: PeerId;
  /** Faction this boost is allocated to. */
  faction: Faction;
  /** Arbitrary compute units contributed. */
  computeUnits: number;
}

/** Active manifesto bomb defusal state. */
export interface ManifestoDefusal {
  /** ID of the manifesto bomb being defused. */
  bombId: string;
  /** Sector where the bomb was dropped. */
  sectorId: string;
  /** Faction the manifesto favors (opponents must defuse). */
  targetFaction: Faction;
  /** Defuse progress [0, 1]. */
  defuseProgress: number;
  /** Total compute needed to fully defuse. */
  requiredCompute: number;
  /** Compute contributed so far. */
  contributedCompute: number;
  /** Per-peer contribution ledger. */
  contributors: Record<PeerId, number>;
}

/** Configurable parameters for the faction warfare subsystem. */
export interface FactionWarfareConfig {
  /** Progress increment per alive agent per update cycle. */
  progressPerAgent: number;
  /** Multiplier applied to thought-cycle slots from compute boosts. */
  computeBoostMultiplier: number;
  /** Compute units required to fully defuse a manifesto bomb. */
  defusalComputeThreshold: number;
}

export const DEFAULT_FACTION_WARFARE_CONFIG: FactionWarfareConfig = {
  progressPerAgent: 0.001,
  computeBoostMultiplier: 1.5,
  defusalComputeThreshold: 100,
};

// ── Distributed Inference (Epic 3.3) ────────────────────────────────────────

/** Inference request priority – standard thoughts vs critical simulation events. */
export type InferencePriority = 'standard' | 'critical';

/** Describes a peer's GPU capacity for inference load balancing. */
export interface PeerCapability {
  peerId: PeerId;
  /** Total GPU VRAM available in megabytes. */
  vramMb: number;
  /** Number of model layers this peer is hosting in the distributed swarm. */
  layersHosted: number;
  /** Whether this peer is currently available for inference requests. */
  available: boolean;
}

/** A typed inference request routed through the load balancer. */
export interface InferenceRequest {
  /** The agent this thought request belongs to. */
  agentId: string;
  /** The fully-built prompt string. */
  prompt: string;
  /** Request priority determines routing (standard → local, critical → God Mode). */
  priority: InferencePriority;
}

/** Response wrapper from a completed inference request. */
export interface InferenceResult {
  /** PeerId that processed the request, or 'local' for local Ollama. */
  processedBy: PeerId | 'local';
  /** Raw generated text from the model. */
  text: string;
  /** Round-trip latency in milliseconds. */
  latencyMs: number;
}

/** Configurable parameters for the distributed inference subsystem. */
export interface DistributedInferenceConfig {
  /** Model name for critical events (70B+ distributed via Petals). Empty = disabled. */
  godModeModel: string;
  /** Model name for standard agent thoughts (local 1B via Ollama). Empty = use BrainSettings model. */
  standardModel: string;
  /** Maximum concurrent distributed inference requests across all peers. */
  maxDistributedConcurrency: number;
  /** How often (ms) to poll peer capabilities. */
  capacityPollIntervalMs: number;
}

export const DEFAULT_DISTRIBUTED_INFERENCE_CONFIG: DistributedInferenceConfig = {
  godModeModel: '',
  standardModel: '',
  maxDistributedConcurrency: 4,
  capacityPollIntervalMs: 5000,
};

export interface InferenceRoutedEvent extends BaseNetworkEvent {
  type: 'inference_routed';
  agentId: string;
  targetPeerId: PeerId | 'local';
  priority: InferencePriority;
}

export interface PeerCapacityEvent extends BaseNetworkEvent {
  type: 'peer_capacity';
  peerId: PeerId;
  vramMb: number;
  layersHosted: number;
}
