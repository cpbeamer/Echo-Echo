/**
 * Faction Warfare – Epic 3.2
 *
 * Pure-logic module for faction victory tracking, compute boost prioritization,
 * and manifesto bomb defusal mechanics. No Tauri/PixiJS dependencies.
 */

import type { Agent, Faction } from '../types/agent';
import type {
  FactionProgress,
  ComputeBoost,
  ManifestoDefusal,
  FactionWarfareConfig,
  PeerId,
} from '../types/networking';
import { DEFAULT_FACTION_WARFARE_CONFIG } from '../types/networking';

/** The four "real" factions that participate in warfare (excludes unaligned). */
const WARFARE_FACTIONS: Faction[] = ['hive', 'void', 'citadel', 'fringe'];

// ── 3.2.1 – Global Goal Tracker ─────────────────────────────────────────────

/**
 * Create a fresh set of faction progress entries, all starting at zero.
 */
export function createInitialFactionProgress(): FactionProgress[] {
  return WARFARE_FACTIONS.map((faction) => ({
    faction,
    progress: 0,
    totalCompute: 0,
    agentCount: 0,
  }));
}

/**
 * Compute updated faction progress from alive agents.
 *
 * Each alive agent contributes `config.progressPerAgent` to its faction's
 * progress bar per update cycle. Progress is capped at 1.0.
 *
 * Compute totals from active boosts are folded in additively.
 */
export function computeFactionProgress(
  agents: Agent[],
  currentProgress: FactionProgress[],
  boosts: ComputeBoost[],
  config: FactionWarfareConfig = DEFAULT_FACTION_WARFARE_CONFIG,
): FactionProgress[] {
  // Count alive agents per faction
  const counts = new Map<Faction, number>();
  for (const agent of agents) {
    if (agent.energy > 0 && agent.deathFrame === null && agent.faction !== 'unaligned') {
      counts.set(agent.faction, (counts.get(agent.faction) ?? 0) + 1);
    }
  }

  // Sum compute boosts per faction
  const computeByFaction = new Map<Faction, number>();
  for (const boost of boosts) {
    computeByFaction.set(
      boost.faction,
      (computeByFaction.get(boost.faction) ?? 0) + boost.computeUnits,
    );
  }

  return currentProgress.map((fp) => {
    const agentCount = counts.get(fp.faction) ?? 0;
    const factionCompute = computeByFaction.get(fp.faction) ?? 0;

    // Progress increment: base (from agents) + bonus (from compute)
    const baseIncrement = agentCount * config.progressPerAgent;
    const computeBonus = factionCompute * config.progressPerAgent * config.computeBoostMultiplier;
    const newProgress = Math.min(1, fp.progress + baseIncrement + computeBonus);

    return {
      faction: fp.faction,
      progress: newProgress,
      totalCompute: fp.totalCompute + factionCompute,
      agentCount,
    };
  });
}

// ── 3.2.2 – Compute Boost ───────────────────────────────────────────────────

/**
 * Build a priority map from active compute boosts.
 *
 * Factions with more donated compute receive proportionally more thought-cycle
 * slots. Returns a `Map<Faction, number>` where values are multipliers ≥ 1.
 */
export function applyComputeBoost(
  boosts: ComputeBoost[],
  config: FactionWarfareConfig = DEFAULT_FACTION_WARFARE_CONFIG,
): Map<Faction, number> {
  const priorityMap = new Map<Faction, number>();

  // Initialize all factions at baseline 1.0
  for (const f of WARFARE_FACTIONS) {
    priorityMap.set(f, 1);
  }

  if (boosts.length === 0) return priorityMap;

  // Sum compute per faction
  const totals = new Map<Faction, number>();
  for (const boost of boosts) {
    totals.set(boost.faction, (totals.get(boost.faction) ?? 0) + boost.computeUnits);
  }

  // Find the maximum to normalize
  const maxCompute = Math.max(...totals.values(), 1);

  for (const [faction, compute] of totals) {
    // Scale: 1.0 (no boost) → computeBoostMultiplier (max boost)
    const ratio = compute / maxCompute;
    const multiplier = 1 + ratio * (config.computeBoostMultiplier - 1);
    priorityMap.set(faction, multiplier);
  }

  return priorityMap;
}

// ── 3.2.3 – Manifesto Defusal ───────────────────────────────────────────────

/**
 * Create a new ManifestoDefusal when a manifesto bomb lands in a contested sector.
 */
export function startManifestoDefusal(
  bombId: string,
  sectorId: string,
  targetFaction: Faction,
  config: FactionWarfareConfig = DEFAULT_FACTION_WARFARE_CONFIG,
): ManifestoDefusal {
  return {
    bombId,
    sectorId,
    targetFaction,
    defuseProgress: 0,
    requiredCompute: config.defusalComputeThreshold,
    contributedCompute: 0,
    contributors: {},
  };
}

/**
 * Contribute compute toward defusing a manifesto bomb.
 *
 * Only peers whose faction *opposes* the bomb's target faction may contribute.
 * Returns `true` when the defusal is complete (progress ≥ 1.0).
 */
export function contributeToDefusal(
  defusal: ManifestoDefusal,
  peerId: PeerId,
  faction: Faction,
  computeUnits: number,
): boolean {
  // Only opposing factions can defuse — the bomb's own faction cannot
  if (faction === defusal.targetFaction || faction === 'unaligned') {
    return false;
  }

  defusal.contributedCompute += computeUnits;
  defusal.contributors[peerId] = (defusal.contributors[peerId] ?? 0) + computeUnits;
  defusal.defuseProgress = Math.min(1, defusal.contributedCompute / defusal.requiredCompute);

  return defusal.defuseProgress >= 1;
}

/**
 * Check whether a defusal is complete.
 */
export function resolveDefusal(defusal: ManifestoDefusal): boolean {
  return defusal.defuseProgress >= 1;
}

/**
 * Check whether a sector is contested (≥2 distinct factions each with ≥5 agents).
 * Only considers alive, non-unaligned agents.
 */
export function checkContestedSector(agents: Agent[]): boolean {
  const counts = new Map<Faction, number>();
  for (const agent of agents) {
    if (agent.energy > 0 && agent.deathFrame === null && agent.faction !== 'unaligned') {
      counts.set(agent.faction, (counts.get(agent.faction) ?? 0) + 1);
    }
  }

  let factionsAboveThreshold = 0;
  for (const count of counts.values()) {
    if (count >= 5) {
      factionsAboveThreshold++;
    }
  }

  return factionsAboveThreshold >= 2;
}
