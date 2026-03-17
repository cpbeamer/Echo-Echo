/**
 * Lingo Cloud – Spatial clustering and term-frequency extraction for the
 * word-cloud overlay rendered above agent clusters.
 *
 * Uses a grid-based spatial bucketing approach (O(n)) to avoid
 * expensive pairwise distance checks.
 */

import type { Agent } from '../types';
import type { LingoCluster, LingoTerm } from '../types/hud';

/**
 * Bucket agents into spatial clusters using a grid hash.
 *
 * Each cell of the hash grid has dimensions `clusterRadius × clusterRadius`.
 * All agents that fall into the same cell are grouped together.
 *
 * @param agents – all alive agents in the simulation.
 * @param clusterRadius – size of each spatial bucket in grid cells (default 10).
 * @returns array of clusters, each with a centroid and a list of agents.
 */
export function clusterAgents(
  agents: Agent[],
  clusterRadius: number = 10,
): { centroid: { x: number; y: number }; agents: Agent[] }[] {
  if (agents.length === 0 || clusterRadius <= 0) return [];

  const buckets = new Map<string, Agent[]>();

  for (const agent of agents) {
    const bx = Math.floor(agent.position.x / clusterRadius);
    const by = Math.floor(agent.position.y / clusterRadius);
    const key = `${bx},${by}`;

    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(agent);
    } else {
      buckets.set(key, [agent]);
    }
  }

  const clusters: { centroid: { x: number; y: number }; agents: Agent[] }[] = [];

  for (const bucket of buckets.values()) {
    // Skip singletons — not meaningful clusters
    if (bucket.length < 2) continue;

    let cx = 0;
    let cy = 0;
    for (const a of bucket) {
      cx += a.position.x;
      cy += a.position.y;
    }
    cx /= bucket.length;
    cy /= bucket.length;

    clusters.push({ centroid: { x: cx, y: cy }, agents: bucket });
  }

  return clusters;
}

/**
 * Extract the top-N most common lingo terms from a cluster of agents.
 *
 * @param clusterAgents – the agents in a single cluster.
 * @param topN – maximum terms to return (default 10).
 * @returns sorted array of `{ term, count }`, descending by count.
 */
export function extractLingoCloud(clusterAgents: Agent[], topN: number = 10): LingoTerm[] {
  const freq = new Map<string, number>();

  for (const agent of clusterAgents) {
    for (const term of Object.keys(agent.lingo)) {
      freq.set(term, (freq.get(term) ?? 0) + 1);
    }
  }

  const sorted = Array.from(freq.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count);

  return sorted.slice(0, topN);
}

/**
 * Convenience: cluster agents and extract lingo clouds in one pass.
 *
 * @returns array of `LingoCluster` objects ready for rendering.
 */
export function computeLingoClusters(
  agents: Agent[],
  clusterRadius: number = 10,
  topN: number = 10,
): LingoCluster[] {
  const rawClusters = clusterAgents(agents, clusterRadius);

  return rawClusters.map((c) => ({
    centroid: c.centroid,
    agentCount: c.agents.length,
    terms: extractLingoCloud(c.agents, topN),
  }));
}
