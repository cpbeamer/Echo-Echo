/**
 * HUD & Observation Layer – Shared type definitions for Epic 1.5.
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
  | AmnesiaBombEvent;

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
