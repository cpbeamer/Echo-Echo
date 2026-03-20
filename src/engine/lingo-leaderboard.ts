/**
 * Lingo Leaderboard – Computes the top-N most viral lingo terms across all agents.
 *
 * Scans every agent's lingo dictionary, counts global term frequency,
 * and compares to the previous snapshot for trend detection.
 */

import type { Agent } from '../types';
import type { LingoLeaderboardEntry } from '../types/hud';

/**
 * Compute the global lingo leaderboard from all alive agents.
 *
 * @param agents – all alive agents in the simulation.
 * @param previousLeaderboard – the previous leaderboard snapshot for trend comparison.
 * @param topN – maximum entries to return (default 10).
 * @returns sorted array of leaderboard entries, descending by count.
 */
export function computeLingoLeaderboard(
  agents: Agent[],
  previousLeaderboard: LingoLeaderboardEntry[] = [],
  topN: number = 10,
): LingoLeaderboardEntry[] {
  // Count global term frequency and capture the most common meaning per term
  const freq = new Map<string, { count: number; meaning: string }>();

  for (const agent of agents) {
    for (const [term, meaning] of Object.entries(agent.lingo)) {
      const existing = freq.get(term);
      if (existing) {
        existing.count++;
      } else {
        freq.set(term, { count: 1, meaning });
      }
    }
  }

  // Build a lookup set of previous top-N terms for trend detection
  const previousTerms = new Map<string, number>();
  for (let i = 0; i < previousLeaderboard.length; i++) {
    previousTerms.set(previousLeaderboard[i].term, i);
  }

  // Sort by count descending, then alphabetically for ties
  const sorted = Array.from(freq.entries())
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, topN);

  return sorted.map(([term, { count, meaning }], index): LingoLeaderboardEntry => {
    const previousIndex = previousTerms.get(term);
    let trend: 'up' | 'down' | 'stable';

    if (previousIndex === undefined) {
      // New term on the leaderboard
      trend = 'up';
    } else if (index < previousIndex) {
      trend = 'up';
    } else if (index > previousIndex) {
      trend = 'down';
    } else {
      trend = 'stable';
    }

    return { term, meaning, count, trend };
  });
}
