/**
 * Agent Lifecycle Engine – energy depletion, reproduction, and natural selection.
 *
 * All functions are pure (or agent-mutating) with no side effects beyond
 * the agents array itself. The simulation store orchestrates calling these
 * in the correct order each tick.
 */

import type { Agent, SimulationConfig } from '../types';
import { ideologicalSimilarity, spatialDistance } from './meme-swap';
import { createChildAgent } from './agent-factory';

/** Proximity radius for neighbor checks (in grid cells). */
const NEIGHBOR_RADIUS = 3;

/** Minimum energy a parent must have to reproduce. */
const MIN_REPRODUCTION_ENERGY = 0.3;

/** Energy cost deducted from each parent after reproduction. */
const REPRODUCTION_ENERGY_COST = 0.2;

/** Threshold for "extreme" DNA values triggering natural selection. */
const EXTREME_BOUNDARY = 0.1;

/**
 * Drain energy from all alive agents each tick.
 *
 * - Base drain: `config.energyDecayRate`
 * - Isolated agents (no neighbors within NEIGHBOR_RADIUS): drain × `config.isolationDecayMultiplier`
 */
export function tickEnergy(agents: Agent[], config: SimulationConfig): void {
  const baseDecay = config.energyDecayRate;

  for (const agent of agents) {
    if (agent.energy <= 0 || agent.deathFrame !== null) continue;

    // Count neighbors
    let hasNeighbor = false;
    for (const other of agents) {
      if (other === agent || other.energy <= 0) continue;
      if (spatialDistance(agent, other) <= NEIGHBOR_RADIUS) {
        hasNeighbor = true;
        break;
      }
    }

    const decay = hasNeighbor ? baseDecay : baseDecay * config.isolationDecayMultiplier;
    agent.energy = Math.max(0, agent.energy - decay);
  }
}

/**
 * Update adjacency tick counters for all agent pairs.
 * Increments for pairs within proximity, resets to 0 for those that moved apart.
 */
export function updateAdjacencyTicks(agents: Agent[]): void {
  const aliveAgents = agents.filter((a) => a.energy > 0 && a.deathFrame === null);

  // Build a lookup map for O(1) access by ID (avoids O(n) `find` in decay loop)
  const agentById = new Map<string, Agent>();
  for (const a of aliveAgents) {
    agentById.set(a.id, a);
  }

  // Track which pairs are currently adjacent using a normalized key (lexicographic ID order)
  const currentlyAdjacent = new Set<string>();

  for (let i = 0; i < aliveAgents.length; i++) {
    for (let j = i + 1; j < aliveAgents.length; j++) {
      const a = aliveAgents[i];
      const b = aliveAgents[j];

      if (spatialDistance(a, b) <= NEIGHBOR_RADIUS) {
        // Normalize pair key: always smaller ID first
        const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        currentlyAdjacent.add(pairKey);

        // Increment both directions
        a.adjacencyTicks.set(b.id, (a.adjacencyTicks.get(b.id) ?? 0) + 1);
        b.adjacencyTicks.set(a.id, (b.adjacencyTicks.get(a.id) ?? 0) + 1);
      }
    }
  }

  // Decay adjacency for agents that are no longer adjacent
  for (const agent of aliveAgents) {
    // Collect keys to delete to avoid modifying the map during iteration
    const toDelete: string[] = [];

    for (const [otherId] of agent.adjacencyTicks) {
      if (!agentById.has(otherId)) {
        toDelete.push(otherId);
        continue;
      }

      const pairKey =
        agent.id < otherId ? `${agent.id}:${otherId}` : `${otherId}:${agent.id}`;

      if (!currentlyAdjacent.has(pairKey)) {
        toDelete.push(otherId);
      }
    }

    for (const id of toDelete) {
      agent.adjacencyTicks.delete(id);
    }
  }
}

/**
 * Attempt reproduction between eligible adjacent agent pairs.
 *
 * Eligibility requires:
 * 1. Both agents are alive with energy > MIN_REPRODUCTION_ENERGY
 * 2. Adjacent for >= reproductionThreshold ticks
 * 3. Ideological similarity >= reproductionSimilarity
 * 4. Both agents' reproduction cooldown has elapsed
 *
 * Returns an array of newly spawned child agents.
 */
export function tickReproduction(
  agents: Agent[],
  tick: number,
  config: SimulationConfig,
): Agent[] {
  const newborns: Agent[] = [];
  const aliveAgents = agents.filter((a) => a.energy > 0 && a.deathFrame === null);

  // Track which agents have already reproduced this tick to avoid polygamy
  const reproducedThisTick = new Set<string>();

  for (let i = 0; i < aliveAgents.length; i++) {
    const a = aliveAgents[i];
    if (reproducedThisTick.has(a.id)) continue;
    if (a.energy <= MIN_REPRODUCTION_ENERGY) continue;
    if (tick - a.lastReproductionTick < config.reproductionCooldown) continue;

    for (let j = i + 1; j < aliveAgents.length; j++) {
      const b = aliveAgents[j];
      if (reproducedThisTick.has(b.id)) continue;
      if (b.energy <= MIN_REPRODUCTION_ENERGY) continue;
      if (tick - b.lastReproductionTick < config.reproductionCooldown) continue;

      // Check adjacency duration
      const ticksAdjacent = a.adjacencyTicks.get(b.id) ?? 0;
      if (ticksAdjacent < config.reproductionThreshold) continue;

      // Check ideological similarity
      const similarity = ideologicalSimilarity(a.vector, b.vector);
      if (similarity < config.reproductionSimilarity) continue;

      // Reproduce!
      const child = createChildAgent(a, b, tick, config);
      newborns.push(child);

      // Deduct reproduction cost from parents
      a.energy = Math.max(0, a.energy - REPRODUCTION_ENERGY_COST);
      b.energy = Math.max(0, b.energy - REPRODUCTION_ENERGY_COST);

      // Set cooldown
      a.lastReproductionTick = tick;
      b.lastReproductionTick = tick;

      // Reset adjacency counters for this pair
      a.adjacencyTicks.delete(b.id);
      b.adjacencyTicks.delete(a.id);

      // Only one reproduction per agent per tick
      reproducedThisTick.add(a.id);
      reproducedThisTick.add(b.id);
      break;
    }
  }

  return newborns;
}

/**
 * Apply natural selection pressure: agents with extreme DNA values
 * (within EXTREME_BOUNDARY of 0 or 1 on any axis) suffer extra energy drain.
 *
 * Only active when `config.naturalSelectionEnabled` is true.
 */
export function applyNaturalSelection(agents: Agent[], config: SimulationConfig): void {
  if (!config.naturalSelectionEnabled) return;

  const extraDecay = config.energyDecayRate * (config.naturalSelectionPressure - 1);

  for (const agent of agents) {
    if (agent.energy <= 0 || agent.deathFrame !== null) continue;

    const { analytical_emotional, altruistic_selfish, order_chaos } = agent.vector;

    const isExtreme =
      analytical_emotional < EXTREME_BOUNDARY ||
      analytical_emotional > 1 - EXTREME_BOUNDARY ||
      altruistic_selfish < EXTREME_BOUNDARY ||
      altruistic_selfish > 1 - EXTREME_BOUNDARY ||
      order_chaos < EXTREME_BOUNDARY ||
      order_chaos > 1 - EXTREME_BOUNDARY;

    if (isExtreme) {
      agent.energy = Math.max(0, agent.energy - extraDecay);
    }
  }
}
