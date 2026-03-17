/**
 * Conflict Detection – when opposing-faction clusters overlap,
 * trigger merge events where losing agents are consumed.
 */

import type { Agent, Faction } from '../types';
import { areOpposingFactions } from './factions';

/** A detected conflict between two opposing groups. */
export interface Conflict {
  /** Agents from the dominant faction (more agents or higher total energy). */
  dominant: Agent[];
  /** Agents from the losing faction. */
  submissive: Agent[];
  /** Center point of the conflict zone. */
  center: { x: number; y: number };
}

/**
 * Detect conflicts: find clusters of opposing-faction agents
 * that are within `clashRadius` of each other.
 *
 * Groups agents by faction, then finds spatial overlaps between
 * opposing factions. A conflict triggers when ≥2 agents from
 * each opposing side overlap.
 */
export function detectConflicts(agents: Agent[], clashRadius: number = 5): Conflict[] {
  const conflicts: Conflict[] = [];

  // Group agents by faction (skip unaligned)
  const byFaction = new Map<Faction, Agent[]>();
  for (const agent of agents) {
    if (agent.faction === 'unaligned') continue;
    const group = byFaction.get(agent.faction) ?? [];
    group.push(agent);
    byFaction.set(agent.faction, group);
  }

  // Check each pair of opposing factions
  const factions = Array.from(byFaction.keys());
  const checked = new Set<string>();

  for (const factionA of factions) {
    for (const factionB of factions) {
      if (factionA === factionB) continue;
      if (!areOpposingFactions(factionA, factionB)) continue;

      const pairKey = [factionA, factionB].sort().join(':');
      if (checked.has(pairKey)) continue;
      checked.add(pairKey);

      const groupA = byFaction.get(factionA) ?? [];
      const groupB = byFaction.get(factionB) ?? [];

      // Find agents from A that are near any agent from B
      const nearA: Agent[] = [];
      const nearB: Agent[] = [];

      for (const a of groupA) {
        for (const b of groupB) {
          const dx = a.position.x - b.position.x;
          const dy = a.position.y - b.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= clashRadius) {
            if (!nearA.includes(a)) nearA.push(a);
            if (!nearB.includes(b)) nearB.push(b);
          }
        }
      }

      // A conflict requires at least 2 from each side
      if (nearA.length >= 2 && nearB.length >= 2) {
        const allNear = [...nearA, ...nearB];
        const centerX = allNear.reduce((s, a) => s + a.position.x, 0) / allNear.length;
        const centerY = allNear.reduce((s, a) => s + a.position.y, 0) / allNear.length;

        // Dominant side has more total energy
        const energyA = nearA.reduce((s, a) => s + a.energy, 0);
        const energyB = nearB.reduce((s, a) => s + a.energy, 0);

        conflicts.push({
          dominant: energyA >= energyB ? nearA : nearB,
          submissive: energyA >= energyB ? nearB : nearA,
          center: { x: centerX, y: centerY },
        });
      }
    }
  }

  return conflicts;
}

/**
 * Resolve a conflict: consume losing agents by removing them from the population.
 * Returns IDs of consumed agents.
 */
export function resolveConflict(conflict: Conflict): string[] {
  const consumedIds: string[] = [];

  for (const agent of conflict.submissive) {
    // Drain energy — agents with 0 energy are "dead"
    agent.energy = 0;
    consumedIds.push(agent.id);
  }

  // Victors gain a small energy boost
  for (const agent of conflict.dominant) {
    agent.energy = Math.min(1, agent.energy + 0.1);
  }

  return consumedIds;
}
