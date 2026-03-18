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
  | BombReceivedEvent;

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
