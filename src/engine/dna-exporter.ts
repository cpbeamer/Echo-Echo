/**
 * DNA Exporter – serialize, validate, migrate, and import `.dna` cult files.
 *
 * All functions are pure-logic (no Tauri FS calls) so they can be tested
 * and composed freely from any context.
 */

import type {
  Agent,
  DnaFile,
  DnaFileAgent,
  DnaImportOptions,
  DnaValidationResult,
  SimulationConfig,
  DNAVector,
  Faction,
  MemoryEntry,
} from '../types/agent';
import { DEFAULT_CONFIG, DNA_FILE_VERSION } from '../types/agent';
import { dnaToColor } from './agent-factory';
import { classifyFaction } from './factions';

// ── Valid value sets for validation ─────────────────────────────────────────

const VALID_FACTIONS: ReadonlySet<string> = new Set<Faction>([
  'hive',
  'void',
  'citadel',
  'fringe',
  'unaligned',
]);

const VECTOR_KEYS: ReadonlyArray<keyof DNAVector> = [
  'analytical_emotional',
  'altruistic_selfish',
  'order_chaos',
];

// ── Export ──────────────────────────────────────────────────────────────────

/**
 * Strip runtime-only fields from an Agent, keeping only DNA identity data.
 */
function agentToDnaFileAgent(agent: Agent): DnaFileAgent {
  return {
    id: agent.id,
    vector: { ...agent.vector },
    loreCache: [...agent.loreCache],
    lingo: { ...agent.lingo },
    faction: agent.faction,
    parentIds: agent.parentIds ? [...agent.parentIds] : null,
    memory: agent.memory.map((m) => ({ ...m, keywords: [...m.keywords] })),
  };
}

/**
 * Serialize a selection of agents into a `.dna` file object.
 *
 * @param agents   The agents to export.
 * @param cultName User-given name for this cult.
 * @param description Optional description text.
 * @returns A `DnaFile` object ready to be JSON.stringify'd and saved to disk.
 */
export function serializeAgentsToDnaFile(
  agents: Agent[],
  cultName: string,
  description = '',
): DnaFile {
  return {
    header: {
      version: DNA_FILE_VERSION,
      name: cultName,
      description,
      createdAt: new Date().toISOString(),
      agentCount: agents.length,
    },
    agents: agents.map(agentToDnaFileAgent),
  };
}

// ── Validation ─────────────────────────────────────────────────────────────

/** Type-guard: value is a non-null object. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate a single vector value: must be a number in [0, 1]. */
function isValidVectorValue(v: unknown): v is number {
  return typeof v === 'number' && v >= 0 && v <= 1;
}

/** Validate a single memory entry shape. */
function isValidMemoryEntry(m: unknown): m is MemoryEntry {
  if (!isObject(m)) return false;
  if (typeof m.text !== 'string') return false;
  if (typeof m.tick !== 'number') return false;
  if (!Array.isArray(m.keywords) || !m.keywords.every((k: unknown) => typeof k === 'string'))
    return false;
  return true;
}

/** Validate a single DnaFileAgent shape. */
function validateAgent(agent: unknown, index: number): string | null {
  if (!isObject(agent)) return `agents[${index}]: not an object`;

  if (typeof agent.id !== 'string') return `agents[${index}].id: must be a string`;

  // Vector
  if (!isObject(agent.vector)) return `agents[${index}].vector: must be an object`;
  for (const key of VECTOR_KEYS) {
    if (!isValidVectorValue((agent.vector as Record<string, unknown>)[key])) {
      return `agents[${index}].vector.${key}: must be a number in [0, 1]`;
    }
  }

  // Faction
  if (typeof agent.faction !== 'string' || !VALID_FACTIONS.has(agent.faction)) {
    return `agents[${index}].faction: must be one of ${[...VALID_FACTIONS].join(', ')}`;
  }

  // loreCache
  if (
    !Array.isArray(agent.loreCache) ||
    !agent.loreCache.every((e: unknown) => typeof e === 'string')
  ) {
    return `agents[${index}].loreCache: must be a string array`;
  }

  // lingo
  if (!isObject(agent.lingo)) return `agents[${index}].lingo: must be an object`;
  for (const [k, v] of Object.entries(agent.lingo)) {
    if (typeof k !== 'string' || typeof v !== 'string') {
      return `agents[${index}].lingo: all keys and values must be strings`;
    }
  }

  // parentIds
  if (agent.parentIds !== null) {
    if (
      !Array.isArray(agent.parentIds) ||
      agent.parentIds.length !== 2 ||
      !agent.parentIds.every((p: unknown) => typeof p === 'string')
    ) {
      return `agents[${index}].parentIds: must be null or a [string, string] tuple`;
    }
  }

  // memory
  if (!Array.isArray(agent.memory) || !agent.memory.every(isValidMemoryEntry)) {
    return `agents[${index}].memory: must be an array of valid MemoryEntry objects`;
  }

  return null;
}

/**
 * Validate raw parsed JSON against the `.dna` file schema.
 *
 * @param data Arbitrary data (e.g. `JSON.parse(fileContent)`).
 * @returns A discriminated result with either the typed `DnaFile` or an error message.
 */
export function validateDnaFile(data: unknown): DnaValidationResult {
  if (!isObject(data)) {
    return { valid: false, error: 'Root value must be a JSON object' };
  }

  // Header
  if (!isObject(data.header)) {
    return { valid: false, error: 'Missing or invalid "header" object' };
  }

  const header = data.header as Record<string, unknown>;

  if (typeof header.version !== 'string') {
    return { valid: false, error: 'header.version must be a string' };
  }
  if (typeof header.name !== 'string') {
    return { valid: false, error: 'header.name must be a string' };
  }
  if (typeof header.description !== 'string') {
    return { valid: false, error: 'header.description must be a string' };
  }
  if (typeof header.createdAt !== 'string') {
    return { valid: false, error: 'header.createdAt must be a string' };
  }
  if (typeof header.agentCount !== 'number') {
    return { valid: false, error: 'header.agentCount must be a number' };
  }

  // Agents array
  if (!Array.isArray(data.agents)) {
    return { valid: false, error: 'Missing or invalid "agents" array' };
  }

  // Agent count consistency
  if (data.agents.length !== header.agentCount) {
    return {
      valid: false,
      error: `header.agentCount (${header.agentCount}) does not match agents array length (${data.agents.length})`,
    };
  }

  // Validate each agent
  for (let i = 0; i < data.agents.length; i++) {
    const agentError = validateAgent(data.agents[i], i);
    if (agentError) {
      return { valid: false, error: agentError };
    }
  }

  return { valid: true, file: data as unknown as DnaFile };
}

// ── Migration ──────────────────────────────────────────────────────────────

/**
 * Migrate an older `.dna` file schema to the current version.
 * Currently a no-op since version 1.0.0 is the only version.
 * Future schema changes will add migration steps here.
 */
export function migrateDnaFile(file: DnaFile): DnaFile {
  // v1.0.0 → current: no-op
  return file;
}

// ── Import ─────────────────────────────────────────────────────────────────

let importIdCounter = 0;

/** Reset the import ID counter (useful for deterministic tests). */
export function resetImportIdCounter(): void {
  importIdCounter = 0;
}

/**
 * Convert a validated `.dna` file into runtime Agents placed at the specified location.
 *
 * - Assigns new unique IDs (prefixed `invader-`)
 * - Scatters agents randomly within `spreadRadius` of `spawnPosition`
 * - Re-derives color from DNA vector
 * - Resets energy to 1.0 and clears all runtime state
 * - Re-classifies faction from vector (in case thresholds changed)
 *
 * @param file    A validated DnaFile.
 * @param options Spawn position and spread radius.
 * @param config  Simulation config for agent defaults.
 */
export function importDnaFileAgents(
  file: DnaFile,
  options: DnaImportOptions,
  config: SimulationConfig = DEFAULT_CONFIG,
): Agent[] {
  const { spawnPosition, spreadRadius } = options;

  return file.agents.map((dnaAgent) => {
    // Random offset within spread radius
    const angle = Math.random() * 2 * Math.PI;
    const dist = Math.random() * spreadRadius;
    const offsetX = Math.cos(angle) * dist;
    const offsetY = Math.sin(angle) * dist;

    return {
      id: `invader-${importIdCounter++}`,
      vector: { ...dnaAgent.vector },
      loreCache: [...dnaAgent.loreCache],
      lingo: { ...dnaAgent.lingo },
      faction: classifyFaction(dnaAgent.vector),
      position: {
        x: spawnPosition.x + offsetX,
        y: spawnPosition.y + offsetY,
      },
      velocity: { x: 0, y: 0 },
      energy: 1.0,
      color: dnaToColor(dnaAgent.vector),
      radius: config.agentRadius,
      activityLevel: 0,
      deathFrame: null,
      adjacencyTicks: new Map<string, number>(),
      parentIds: dnaAgent.parentIds ? [...dnaAgent.parentIds] : null,
      lastReproductionTick: -Infinity,
      memory: dnaAgent.memory.map((m) => ({ ...m, keywords: [...m.keywords] })),
    };
  });
}
