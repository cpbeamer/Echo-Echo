/**
 * Blast Radius – spatial query and batch mutation for data bombs.
 *
 * Uses Manhattan distance to determine which agents fall within a bomb's
 * blast radius, then applies heuristic DNA mutation to each affected agent.
 */

import type { Agent, DataBomb, Vec2 } from '../types';
import { mutateAgentFromText } from './dna-mutation';
import { clearMemory } from './memory-store';

/**
 * Calculate the Manhattan distance between two 2D points.
 */
export function manhattanDistance(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Find all living agents within Manhattan distance `radius` of `center`.
 */
export function findAgentsInBlastRadius(agents: Agent[], center: Vec2, radius: number): Agent[] {
  return agents.filter(
    (agent) => agent.energy > 0 && manhattanDistance(agent.position, center) <= radius,
  );
}

/**
 * Detonate a data bomb: mutate DNA of every agent in the blast radius.
 *
 * @param delta - Optional mutation strength override (default 0.05). Manifesto bombs pass 2×.
 * Returns the IDs of all affected agents so the caller can record them.
 */
export function detonateDataBomb(agents: Agent[], bomb: DataBomb, delta?: number): string[] {
  const affected = findAgentsInBlastRadius(agents, bomb.target, bomb.radius);

  for (const agent of affected) {
    mutateAgentFromText(agent, bomb.text, delta);
  }

  return affected.map((a) => a.id);
}

/**
 * Detonate an amnesia bomb: wipe memory, lore-cache, and lingo for all
 * agents within the blast radius. Agents reset to baseline behavior.
 *
 * Returns the IDs of all affected agents.
 */
export function detonateAmnesiaBomb(agents: Agent[], bomb: DataBomb): string[] {
  const affected = findAgentsInBlastRadius(agents, bomb.target, bomb.radius);

  for (const agent of affected) {
    clearMemory(agent);
    agent.loreCache = [];
    agent.lingo = {};
  }

  return affected.map((a) => a.id);
}
