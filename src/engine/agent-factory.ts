/**
 * AgentFactory – spawns agents with randomized DNA within configurable bounds.
 *
 * Color derivation maps the 3-axis DNA vector to HSL:
 *   Hue        = analytical_emotional × 360
 *   Saturation = 50% + altruistic_selfish × 30%
 *   Lightness  = 40% + order_chaos × 20%
 */

import type { Agent, DNAVector, SimulationConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { classifyFaction } from './factions';

/** Derive an HSL color string from a DNA vector. */
export function dnaToColor(vector: DNAVector): string {
  const hue = Math.round(vector.analytical_emotional * 360);
  const saturation = Math.round(50 + vector.altruistic_selfish * 30);
  const lightness = Math.round(40 + vector.order_chaos * 20);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/** Generate a random float in [min, max). */
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Clamp a value to [0, 1]. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Generate a random DNA vector with each axis in [0, 1]. */
function randomVector(): DNAVector {
  return {
    analytical_emotional: Math.random(),
    altruistic_selfish: Math.random(),
    order_chaos: Math.random(),
  };
}

let nextId = 0;

/** Create a single agent with randomized DNA at a given position. */
export function createAgent(
  x: number,
  y: number,
  config: SimulationConfig = DEFAULT_CONFIG,
): Agent {
  const vector = randomVector();
  const faction = classifyFaction(vector);
  const id = `agent-${nextId++}`;

  return {
    id,
    vector,
    loreCache: [],
    lingo: {},
    faction,
    position: { x, y },
    velocity: { x: 0, y: 0 },
    energy: 1.0,
    color: dnaToColor(vector),
    radius: config.agentRadius,
    activityLevel: 0,
    deathFrame: null,
    adjacencyTicks: new Map(),
    parentIds: null,
    lastReproductionTick: -Infinity,
  };
}

/**
 * Create a child agent from two parents with blended DNA.
 * Child is placed at the midpoint between parents.
 * Each DNA axis = weighted average of parents + small random jitter (±0.05).
 */
export function createChildAgent(
  parentA: Agent,
  parentB: Agent,
  tick: number,
  config: SimulationConfig = DEFAULT_CONFIG,
): Agent {
  const jitter = () => (Math.random() - 0.5) * 0.1;

  const vector: DNAVector = {
    analytical_emotional: clamp01(
      (parentA.vector.analytical_emotional + parentB.vector.analytical_emotional) / 2 + jitter(),
    ),
    altruistic_selfish: clamp01(
      (parentA.vector.altruistic_selfish + parentB.vector.altruistic_selfish) / 2 + jitter(),
    ),
    order_chaos: clamp01(
      (parentA.vector.order_chaos + parentB.vector.order_chaos) / 2 + jitter(),
    ),
  };

  const faction = classifyFaction(vector);
  const id = `agent-${nextId++}`;

  // Merge lore-caches: interleave and cap at maxLoreEntries
  const mergedLore: string[] = [];
  const maxLore = config.maxLoreEntries;
  for (let i = 0; i < maxLore; i++) {
    if (i < parentA.loreCache.length) mergedLore.push(parentA.loreCache[i]);
    if (mergedLore.length >= maxLore) break;
    if (i < parentB.loreCache.length) mergedLore.push(parentB.loreCache[i]);
    if (mergedLore.length >= maxLore) break;
  }

  // Merge lingo dictionaries (parent A entries take precedence on key conflicts)
  const mergedLingo: Record<string, string> = { ...parentB.lingo, ...parentA.lingo };

  return {
    id,
    vector,
    loreCache: mergedLore,
    lingo: mergedLingo,
    faction,
    position: {
      x: (parentA.position.x + parentB.position.x) / 2,
      y: (parentA.position.y + parentB.position.y) / 2,
    },
    velocity: { x: 0, y: 0 },
    energy: 0.5,
    color: dnaToColor(vector),
    radius: config.agentRadius,
    activityLevel: 0,
    deathFrame: null,
    adjacencyTicks: new Map(),
    parentIds: [parentA.id, parentB.id],
    lastReproductionTick: tick,
  };
}

/**
 * Batch-spawn N agents distributed randomly across the grid.
 * Agents are placed with small jitter to avoid exact overlaps.
 */
export function createAgents(
  count: number = DEFAULT_CONFIG.agentCount,
  config: SimulationConfig = DEFAULT_CONFIG,
): Agent[] {
  const agents: Agent[] = [];
  for (let i = 0; i < count; i++) {
    const x = randomInRange(1, config.gridWidth - 1);
    const y = randomInRange(1, config.gridHeight - 1);
    agents.push(createAgent(x, y, config));
  }
  return agents;
}

/** Reset the internal ID counter (useful for tests). */
export function resetAgentIdCounter(): void {
  nextId = 0;
}
