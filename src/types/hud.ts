/**
 * HUD & Observation Layer – Shared type definitions for Epics 1.5 and 4.0.
 */

import type { Vec2 } from './agent';

/** Tagged union of all simulation events logged to the newsfeed. */
export type SimulationEvent =
  | MemeSwapEvent
  | ConflictEvent
  | FactionChangeEvent
  | DataBombEvent
  | AgentDeathEvent
  | AgentBirthEvent
  | AmnesiaBombEvent
  | ManifestoBombEvent;

interface BaseEvent {
  /** Unique event ID. */
  id: string;
  /** Unix timestamp (ms). */
  timestamp: number;
  /** Human-readable message for the newsfeed. */
  message: string;
}

export interface MemeSwapEvent extends BaseEvent {
  type: 'meme_swap';
  /** Number of swaps this tick. */
  swapCount: number;
}

export interface ConflictEvent extends BaseEvent {
  type: 'conflict';
  /** IDs of agents involved. */
  agentIds: string[];
}

export interface FactionChangeEvent extends BaseEvent {
  type: 'faction_change';
  agentId: string;
  fromFaction: string;
  toFaction: string;
}

export interface DataBombEvent extends BaseEvent {
  type: 'data_bomb';
  /** Number of agents affected. */
  affectedCount: number;
  target: Vec2;
}

export interface AgentDeathEvent extends BaseEvent {
  type: 'agent_death';
  agentId: string;
  /** Why the agent died (conflict, starvation, etc.). */
  cause: string;
}

export interface AgentBirthEvent extends BaseEvent {
  type: 'agent_birth';
  /** IDs of the two parent agents. */
  parentIds: [string, string];
  /** ID of the newly spawned child agent. */
  childId: string;
}

export interface AmnesiaBombEvent extends BaseEvent {
  type: 'amnesia_bomb';
  /** Number of agents whose memory was wiped. */
  affectedCount: number;
  target: Vec2;
}

export interface ManifestoBombEvent extends BaseEvent {
  type: 'manifesto_bomb';
  /** Number of agents hit with amplified mutation. */
  affectedCount: number;
  target: Vec2;
}

/** A spatial cluster of agents with their aggregated lingo terms. */
export interface LingoCluster {
  /** Geometric center of the cluster (grid coords). */
  centroid: Vec2;
  /** Aggregated lingo terms sorted by frequency, descending. */
  terms: LingoTerm[];
  /** Number of agents in this cluster. */
  agentCount: number;
}

export interface LingoTerm {
  term: string;
  count: number;
}

// ── Epic 4.0 – The Lingo-Gen ────────────────────────────────────────────────

/** Detailed result of a successful meme swap between two agents. */
export interface MemeSwapResult {
  /** ID of the first agent (donor of termsGiven). */
  fromId: string;
  /** ID of the second agent (donor of termsReceived). */
  toId: string;
  /** Terms agent A gave to agent B. */
  termsGiven: string[];
  /** Terms agent B gave to agent A. */
  termsReceived: string[];
}

/** A floating word bubble animating between two agents during a meme swap. */
export interface LingoSwapBubble {
  /** Unique bubble identifier. */
  id: string;
  /** The lingo term being transferred. */
  term: string;
  /** Grid position of the sending agent at spawn time. */
  fromPosition: Vec2;
  /** Grid position of the receiving agent at spawn time. */
  toPosition: Vec2;
  /** Current animation frame counter (0 → totalFrames). */
  frame: number;
  /** Total animation duration in simulation ticks. */
  totalFrames: number;
}

/** A single entry on the global lingo leaderboard. */
export interface LingoLeaderboardEntry {
  /** The lingo term. */
  term: string;
  /** The meaning/definition assigned by agents. */
  meaning: string;
  /** Number of agents currently carrying this term. */
  count: number;
  /** Trend direction compared to the previous leaderboard snapshot. */
  trend: 'up' | 'down' | 'stable';
}
