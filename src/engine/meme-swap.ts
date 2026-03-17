/**
 * Meme Swap – neighboring agents exchange lingo entries with probability
 * proportional to their ideological similarity.
 *
 * Similarity is computed as 1 - normalized Euclidean distance on the DNA vector.
 */

import type { Agent, DNAVector } from '../types';

/**
 * Compute ideological similarity between two agents as a [0, 1] score.
 * 1 = identical vectors, 0 = maximally different.
 */
export function ideologicalSimilarity(a: DNAVector, b: DNAVector): number {
  const dx = a.analytical_emotional - b.analytical_emotional;
  const dy = a.altruistic_selfish - b.altruistic_selfish;
  const dz = a.order_chaos - b.order_chaos;

  // Max possible Euclidean distance in a unit cube is sqrt(3) ≈ 1.732
  const maxDist = Math.sqrt(3);
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  return 1 - dist / maxDist;
}

/**
 * Compute spatial distance between two agents.
 */
export function spatialDistance(a: Agent, b: Agent): number {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Attempt a meme swap between two neighboring agents.
 *
 * Swap probability = ideological similarity.
 * If the swap triggers, each agent donates one random lingo entry
 * to the other (if either has lingo to share).
 *
 * Returns true if a swap occurred.
 */
export function attemptMemeSwap(agentA: Agent, agentB: Agent): boolean {
  const similarity = ideologicalSimilarity(agentA.vector, agentB.vector);

  // Roll against similarity — higher similarity = higher swap chance
  if (Math.random() > similarity) {
    return false;
  }

  const lingoKeysA = Object.keys(agentA.lingo);
  const lingoKeysB = Object.keys(agentB.lingo);

  // A donates to B
  if (lingoKeysA.length > 0) {
    const keyA = lingoKeysA[Math.floor(Math.random() * lingoKeysA.length)];
    agentB.lingo[keyA] = agentA.lingo[keyA];
  }

  // B donates to A
  if (lingoKeysB.length > 0) {
    const keyB = lingoKeysB[Math.floor(Math.random() * lingoKeysB.length)];
    agentA.lingo[keyB] = agentB.lingo[keyB];
  }

  return true;
}

/**
 * Process meme swaps for the entire agent population.
 * Only adjacent agents (within `proximityRadius` cells) are eligible.
 * Returns total number of swaps that occurred.
 */
export function processMemeSwaps(agents: Agent[], proximityRadius: number = 3): number {
  let swapCount = 0;

  // Naive O(n²) — fine for 200-500 agents. Spatial hash needed for 5k+.
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      if (spatialDistance(agents[i], agents[j]) <= proximityRadius) {
        if (attemptMemeSwap(agents[i], agents[j])) {
          swapCount++;
        }
      }
    }
  }

  return swapCount;
}
