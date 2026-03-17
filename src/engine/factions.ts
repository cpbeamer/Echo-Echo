/**
 * Faction classification – auto-assign agents to archetypes based on DNA thresholds.
 *
 * Threshold logic:
 *  - Hive:    High altruism (low selfish) + high order  → collectivist conformists
 *  - Void:    High chaos + high selfish                 → nihilist destroyers
 *  - Citadel: High order + high analytical              → rigid bureaucrats
 *  - Fringe:  High emotional + mid-range everything     → cult isolationists
 *  - Unaligned: doesn't strongly match any archetype
 */

import type { DNAVector, Faction } from '../types';

/** Visual identity for each faction. */
export interface FactionMeta {
  label: string;
  color: string;
  glowColor: string;
  description: string;
}

export const FACTION_META: Record<Faction, FactionMeta> = {
  hive: {
    label: 'The Hive',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.6)',
    description: 'Radical Collectivism — total homogeneity.',
  },
  void: {
    label: 'The Void',
    color: '#8b5cf6',
    glowColor: 'rgba(139, 92, 246, 0.6)',
    description: 'Aggressive Nihilism — destroy all bonds.',
  },
  citadel: {
    label: 'The Citadel',
    color: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.6)',
    description: 'Rigid Logic — maximum efficiency, zero drift.',
  },
  fringe: {
    label: 'The Fringe',
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.6)',
    description: 'Cult-like Isolationism — survive as minority.',
  },
  unaligned: {
    label: 'Unaligned',
    color: '#6b7280',
    glowColor: 'rgba(107, 114, 128, 0.4)',
    description: 'No strong ideological alignment.',
  },
};

const THRESHOLD = 0.65;
const LOW_THRESHOLD = 0.35;

/**
 * Classify an agent into a faction based on DNA vector thresholds.
 * Returns the best-matching faction, or 'unaligned' if no archetype fits.
 */
export function classifyFaction(vector: DNAVector): Faction {
  const { analytical_emotional, altruistic_selfish, order_chaos } = vector;

  // Hive: altruistic (low selfish) + orderly
  if (altruistic_selfish < LOW_THRESHOLD && order_chaos < LOW_THRESHOLD) {
    return 'hive';
  }

  // Void: selfish + chaotic
  if (altruistic_selfish > THRESHOLD && order_chaos > THRESHOLD) {
    return 'void';
  }

  // Citadel: analytical (low emotional) + orderly
  if (analytical_emotional < LOW_THRESHOLD && order_chaos < LOW_THRESHOLD) {
    return 'citadel';
  }

  // Fringe: emotional + mid-range selfish
  if (
    analytical_emotional > THRESHOLD &&
    altruistic_selfish > LOW_THRESHOLD &&
    altruistic_selfish < THRESHOLD
  ) {
    return 'fringe';
  }

  return 'unaligned';
}

/** Check if two factions are ideologically opposed. */
export function areOpposingFactions(a: Faction, b: Faction): boolean {
  if (a === 'unaligned' || b === 'unaligned') return false;
  const oppositions: Record<string, string> = {
    hive: 'void',
    void: 'hive',
    citadel: 'fringe',
    fringe: 'citadel',
  };
  return oppositions[a] === b;
}
