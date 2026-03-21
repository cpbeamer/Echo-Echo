/**
 * State Sync – Serialization, diff computation, and application for P2P state transfer.
 *
 * The host computes a minimal StateDiff between two tick snapshots and broadcasts it.
 * Visitors receive the diff and apply it to their local agent array.
 */

import type { Agent } from '../types/agent';
import type { SerializedAgent, StateDiff, AgentPatch } from '../types/networking';

// ── Serialization ───────────────────────────────────────────────────────────

/** Convert a runtime Agent into a JSON-safe SerializedAgent. */
export function serializeAgent(agent: Agent): SerializedAgent {
  return {
    id: agent.id,
    vector: { ...agent.vector },
    loreCache: [...agent.loreCache],
    lingo: { ...agent.lingo },
    faction: agent.faction,
    position: { ...agent.position },
    velocity: { ...agent.velocity },
    energy: agent.energy,
    color: agent.color,
    radius: agent.radius,
    activityLevel: agent.activityLevel,
    deathFrame: agent.deathFrame,
    adjacencyTicks: mapToRecord(agent.adjacencyTicks),
    parentIds: agent.parentIds ? [...agent.parentIds] : null,
    lastReproductionTick: agent.lastReproductionTick,
    memory: agent.memory.map((m) => ({ ...m, keywords: [...m.keywords] })),
  };
}

/** Convert a SerializedAgent back into a runtime Agent. */
export function deserializeAgent(data: SerializedAgent): Agent {
  return {
    id: data.id,
    vector: { ...data.vector },
    loreCache: [...data.loreCache],
    lingo: { ...data.lingo },
    faction: data.faction,
    position: { ...data.position },
    velocity: { ...data.velocity },
    energy: data.energy,
    color: data.color,
    radius: data.radius,
    activityLevel: data.activityLevel,
    deathFrame: data.deathFrame,
    adjacencyTicks: recordToMap(data.adjacencyTicks),
    parentIds: data.parentIds ? [...data.parentIds] : null,
    lastReproductionTick: data.lastReproductionTick,
    memory: data.memory.map((m) => ({ ...m, keywords: [...m.keywords] })),
  };
}

// ── Diff Computation ────────────────────────────────────────────────────────

/**
 * Compute a minimal StateDiff between a previous and current agent snapshot.
 *
 * - Agents present in `curr` but not `prev` → added
 * - Agents present in `prev` but not `curr` → removed
 * - Agents present in both → only changed fields are included
 */
export function computeStateDiff(prev: Agent[], curr: Agent[], tick: number): StateDiff {
  const prevMap = new Map(prev.map((a) => [a.id, a]));
  const currMap = new Map(curr.map((a) => [a.id, a]));

  const added: SerializedAgent[] = [];
  const removed: string[] = [];
  const changed: AgentPatch[] = [];

  // Detect added and changed agents
  for (const [id, agent] of currMap) {
    const prevAgent = prevMap.get(id);
    if (!prevAgent) {
      added.push(serializeAgent(agent));
    } else {
      const patch = computeAgentPatch(prevAgent, agent);
      if (patch) {
        changed.push(patch);
      }
    }
  }

  // Detect removed agents
  for (const id of prevMap.keys()) {
    if (!currMap.has(id)) {
      removed.push(id);
    }
  }

  return { tick, added, removed, changed };
}

/**
 * Apply a StateDiff to a local agent array, returning a new array.
 *
 * - Removes agents listed in `diff.removed`
 * - Adds agents listed in `diff.added`
 * - Patches agents listed in `diff.changed`
 */
export function applyStateDiff(agents: Agent[], diff: StateDiff): Agent[] {
  const removedSet = new Set(diff.removed);

  // Filter out removed agents
  const surviving = agents.filter((a) => !removedSet.has(a.id));

  // Apply patches to changed agents
  for (const patch of diff.changed) {
    const agent = surviving.find((a) => a.id === patch.id);
    if (agent) {
      applyAgentPatch(agent, patch);
    }
  }

  // Add new agents
  const newAgents = diff.added.map(deserializeAgent);

  return [...surviving, ...newAgents];
}

// ── Internal Helpers ────────────────────────────────────────────────────────

/** Compute a sparse patch between two agent states, or null if identical. */
function computeAgentPatch(prev: Agent, curr: Agent): AgentPatch | null {
  const patch: AgentPatch = { id: curr.id };
  let hasChanges = false;

  // Vector comparison
  if (
    prev.vector.analytical_emotional !== curr.vector.analytical_emotional ||
    prev.vector.altruistic_selfish !== curr.vector.altruistic_selfish ||
    prev.vector.order_chaos !== curr.vector.order_chaos
  ) {
    patch.vector = { ...curr.vector };
    hasChanges = true;
  }

  // Position
  if (prev.position.x !== curr.position.x || prev.position.y !== curr.position.y) {
    patch.position = { ...curr.position };
    hasChanges = true;
  }

  // Velocity
  if (prev.velocity.x !== curr.velocity.x || prev.velocity.y !== curr.velocity.y) {
    patch.velocity = { ...curr.velocity };
    hasChanges = true;
  }

  // Scalar fields
  if (prev.energy !== curr.energy) {
    patch.energy = curr.energy;
    hasChanges = true;
  }
  if (prev.color !== curr.color) {
    patch.color = curr.color;
    hasChanges = true;
  }
  if (prev.activityLevel !== curr.activityLevel) {
    patch.activityLevel = curr.activityLevel;
    hasChanges = true;
  }
  if (prev.deathFrame !== curr.deathFrame) {
    patch.deathFrame = curr.deathFrame;
    hasChanges = true;
  }
  if (prev.faction !== curr.faction) {
    patch.faction = curr.faction;
    hasChanges = true;
  }

  // Lore cache (shallow array comparison)
  if (!arraysEqual(prev.loreCache, curr.loreCache)) {
    patch.loreCache = [...curr.loreCache];
    hasChanges = true;
  }

  // Lingo (shallow record comparison)
  if (!recordsEqual(prev.lingo, curr.lingo)) {
    patch.lingo = { ...curr.lingo };
    hasChanges = true;
  }

  // Memory (length check as a fast path)
  if (prev.memory.length !== curr.memory.length) {
    patch.memory = curr.memory.map((m) => ({ ...m, keywords: [...m.keywords] }));
    hasChanges = true;
  }

  return hasChanges ? patch : null;
}

/** Apply a sparse AgentPatch onto a mutable Agent. */
function applyAgentPatch(agent: Agent, patch: AgentPatch): void {
  if (patch.vector) agent.vector = { ...patch.vector };
  if (patch.position) agent.position = { ...patch.position };
  if (patch.velocity) agent.velocity = { ...patch.velocity };
  if (patch.energy !== undefined) agent.energy = patch.energy;
  if (patch.color !== undefined) agent.color = patch.color;
  if (patch.activityLevel !== undefined) agent.activityLevel = patch.activityLevel;
  if (patch.deathFrame !== undefined) agent.deathFrame = patch.deathFrame;
  if (patch.faction) agent.faction = patch.faction;
  if (patch.loreCache) agent.loreCache = [...patch.loreCache];
  if (patch.lingo) agent.lingo = { ...patch.lingo };
  if (patch.memory) agent.memory = patch.memory.map((m) => ({ ...m, keywords: [...m.keywords] }));
  if (patch.adjacencyTicks) agent.adjacencyTicks = recordToMap(patch.adjacencyTicks);
}

/** Convert a Map<string, number> to a plain Record<string, number>. */
function mapToRecord(map: Map<string, number>): Record<string, number> {
  const record: Record<string, number> = {};
  for (const [key, value] of map) {
    record[key] = value;
  }
  return record;
}

/** Convert a plain Record<string, number> to a Map<string, number>. */
function recordToMap(record: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(record).map(([k, v]) => [k, v]));
}

/** Shallow equality check for string arrays. */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Shallow equality check for Record<string, string>. */
function recordsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
