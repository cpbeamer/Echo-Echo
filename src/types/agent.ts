/**
 * Agent DNA – The core identity structure for every agent in the simulation.
 *
 * Each agent's "brain" is a persistent state defined by a numerical vector,
 * a short-term memory cache, and a dictionary of culturally-evolved slang.
 */

/** The four faction archetypes agents can belong to. */
export type Faction = 'hive' | 'void' | 'citadel' | 'fringe' | 'unaligned';

/**
 * Numerical personality vector scored on continuous [0, 1] scales.
 * These axes drive behavior, faction classification, and visual identity.
 */
export interface DNAVector {
  /** Analytical (0) ↔ Emotional (1) */
  analytical_emotional: number;
  /** Altruistic (0) ↔ Selfish (1) */
  altruistic_selfish: number;
  /** Order (0) ↔ Chaos (1) */
  order_chaos: number;
}

/** The full DNA payload attached to every agent. */
export interface AgentDNA {
  /** Unique agent identifier. */
  id: string;
  /** The personality vector, scored [0, 1]. */
  vector: DNAVector;
  /** Short-term memory: the last N significant interactions / data ingestions. */
  loreCache: string[];
  /** Culturally-evolved slang dictionary (term → meaning). */
  lingo: Record<string, string>;
  /** Auto-assigned faction based on DNA thresholds. */
  faction: Faction;
}

/** 2D position on the simulation grid. */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * A runtime agent: DNA + physics state + visual metadata.
 * This is what the simulation actually ticks on.
 */
export interface Agent extends AgentDNA {
  /** Current grid position. */
  position: Vec2;
  /** Current velocity for physics integration. */
  velocity: Vec2;
  /** Energy meter [0, 1]: depletes in isolation/conflict. */
  energy: number;
  /** Pre-computed HSL color string derived from DNA vector. */
  color: string;
  /** Radius for rendering and collision (in grid cells). */
  radius: number;
}

/** Structured update returned by the LLM DNA mutation pipeline. */
export interface DNAUpdate {
  /** Delta shifts to apply to the vector (additive, then clamped). */
  vectorDelta: Partial<DNAVector>;
  /** New entries to append to the lore-cache. */
  newLore: string[];
  /** New lingo terms to merge into the agent's dictionary. */
  newLingo: Record<string, string>;
}

/** Configuration for the simulation grid. */
export interface SimulationConfig {
  /** Number of agents to spawn. */
  agentCount: number;
  /** Grid width in cells. */
  gridWidth: number;
  /** Grid height in cells. */
  gridHeight: number;
  /** Size of each sector in cells. */
  sectorSize: number;
  /** Maximum lore-cache entries per agent. */
  maxLoreEntries: number;
  /** Base radius for agents. */
  agentRadius: number;
}

export const DEFAULT_CONFIG: SimulationConfig = {
  agentCount: 200,
  gridWidth: 100,
  gridHeight: 100,
  sectorSize: 25,
  maxLoreEntries: 10,
  agentRadius: 0.4,
};
