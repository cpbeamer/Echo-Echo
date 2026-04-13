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

/** A single long-term memory entry stored per-agent. */
export interface MemoryEntry {
  /** Human-readable summary of what happened. */
  text: string;
  /** Simulation tick when this memory was formed. */
  tick: number;
  /** Pre-extracted lowercase keywords for retrieval. */
  keywords: string[];
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
  /** Activity level [0, 1]: 0 = idle, 1 = mid-thought. Drives wobble shader intensity. */
  activityLevel: number;
  /** Frame counter for death dissolve animation, or null if alive. */
  deathFrame: number | null;
  /** Tracks consecutive ticks each neighboring agent has been adjacent (agentId → tickCount). */
  adjacencyTicks: Map<string, number>;
  /** Parent agent IDs if this agent was born via reproduction, null for original agents. */
  parentIds: [string, string] | null;
  /** Tick number when this agent last reproduced, used for cooldown. */
  lastReproductionTick: number;
  /** Long-term memory entries that persist across lore-cache truncations. */
  memory: MemoryEntry[];
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

  // --- Lifecycle (Epic 2.1) ---

  /** Base energy drain per tick. */
  energyDecayRate: number;
  /** Energy drain multiplier when an agent has no nearby neighbors. */
  isolationDecayMultiplier: number;
  /** Consecutive adjacency ticks required before two agents can reproduce. */
  reproductionThreshold: number;
  /** Minimum ideological similarity [0,1] for reproduction eligibility. */
  reproductionSimilarity: number;
  /** Ticks an agent must wait after reproducing before it can reproduce again. */
  reproductionCooldown: number;
  /** Toggle for natural selection pressure on extreme DNA vectors. */
  naturalSelectionEnabled: boolean;
  /** Extra energy-drain multiplier for agents with extreme (near 0 or 1) DNA values. */
  naturalSelectionPressure: number;

  // --- Persistent Memory (Epic 2.2) ---

  /** Maximum long-term memory entries retained per agent. */
  maxMemoryEntries: number;

  // --- Advanced Data Bombs (Epic 2.3) ---

  /** Blast radius multiplier for manifesto bombs (default 2×). */
  manifestoRadiusMultiplier: number;
  /** Mutation delta multiplier for manifesto bombs (default 2×). */
  manifestoDeltaMultiplier: number;
}

export const DEFAULT_CONFIG: SimulationConfig = {
  agentCount: 200,
  gridWidth: 100,
  gridHeight: 100,
  sectorSize: 25,
  maxLoreEntries: 10,
  agentRadius: 0.4,

  // Lifecycle defaults
  energyDecayRate: 0.001,
  isolationDecayMultiplier: 3,
  reproductionThreshold: 50,
  reproductionSimilarity: 0.7,
  reproductionCooldown: 100,
  naturalSelectionEnabled: false,
  naturalSelectionPressure: 1.5,

  // Persistent Memory defaults
  maxMemoryEntries: 50,

  // Advanced Data Bombs defaults
  manifestoRadiusMultiplier: 2,
  manifestoDeltaMultiplier: 2,
};

/** The kind of data bomb. */
export type DataBombType = 'standard' | 'amnesia' | 'pdf' | 'url' | 'manifesto';

/** Payload for dropping a data bomb onto the grid. */
export interface DataBomb {
  /** Raw text payload that will influence affected agents (ignored for amnesia). */
  text: string;
  /** Grid coordinate where the bomb is dropped. */
  target: Vec2;
  /** Blast radius in grid cells (Manhattan distance). */
  radius: number;
  /** Bomb variant. Defaults to 'standard' if omitted. */
  type: DataBombType;
}

/** Recorded history entry for a detonated data bomb. */
export interface DataBombRecord extends DataBomb {
  /** Unique record identifier. */
  id: string;
  /** Unix timestamp (ms) of when the bomb was dropped. */
  timestamp: number;
  /** IDs of all agents affected by the blast. */
  affectedAgentIds: string[];
  /** First 80 characters of the bomb text for display. */
  contentPreview: string;
}

/** Active shockwave animation state rendered on the canvas. */
export interface Shockwave {
  /** Grid coordinate of the blast center. */
  center: Vec2;
  /** Maximum radius the ring expands to. */
  maxRadius: number;
  /** Current animation frame (0 → totalFrames). */
  frame: number;
  /** Total animation duration in render frames. */
  totalFrames: number;
  /** Optional hex color override (default: 0xef4444). Manifesto bombs use 0xff2222. */
  color?: number;
}

// ── Epic 4.1 – Exportable DNA ─────────────────────────────────────────────────

/** Current `.dna` file schema version. */
export const DNA_FILE_VERSION = '1.0.0';

/** Metadata envelope at the top of every `.dna` file. */
export interface DnaFileHeader {
  /** Schema version string (semver). */
  version: string;
  /** User-given name for this "cult" of agents. */
  name: string;
  /** Optional human-readable description. */
  description: string;
  /** ISO-8601 timestamp of when the file was created. */
  createdAt: string;
  /** Number of agents stored in this file. */
  agentCount: number;
}

/**
 * JSON-safe representation of an agent's DNA identity for export.
 * Excludes runtime-only fields (position, velocity, energy, color, radius,
 * activityLevel, deathFrame, adjacencyTicks, lastReproductionTick).
 */
export interface DnaFileAgent {
  /** Original agent identifier (re-assigned on import). */
  id: string;
  /** Personality vector scored [0, 1]. */
  vector: DNAVector;
  /** Short-term lore-cache entries. */
  loreCache: string[];
  /** Culturally-evolved slang dictionary. */
  lingo: Record<string, string>;
  /** Faction classification. */
  faction: Faction;
  /** Parent agent IDs if born via reproduction, null otherwise. */
  parentIds: [string, string] | null;
  /** Long-term memory entries. */
  memory: MemoryEntry[];
}

/** Top-level `.dna` file schema. */
export interface DnaFile {
  header: DnaFileHeader;
  agents: DnaFileAgent[];
}

/** Options for importing a `.dna` file into the simulation. */
export interface DnaImportOptions {
  /** Center point where imported agents will spawn. */
  spawnPosition: Vec2;
  /** Maximum scatter distance (grid cells) from the spawn center. */
  spreadRadius: number;
}

/** Discriminated result from `.dna` file validation. */
export type DnaValidationResult = { valid: true; file: DnaFile } | { valid: false; error: string };
