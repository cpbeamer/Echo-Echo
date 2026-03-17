/**
 * Memory Store – per-agent long-term memory with keyword-based retrieval.
 *
 * Unlike the short-term lore-cache (FIFO, max 10 entries), the memory store
 * provides persistent memories that survive lore-cache truncation and can
 * be retrieved via keyword similarity for LLM thought prompts.
 */

import type { Agent, MemoryEntry, SimulationConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';

/**
 * Common English stop words filtered out during keyword extraction.
 * Keeps retrieval focused on content-bearing words.
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'it', 'its', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him',
  'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'what',
  'which', 'who', 'whom', 'how', 'when', 'where', 'why', 'not', 'no',
  'so', 'if', 'then', 'than', 'too', 'very', 'just', 'about', 'up',
  'out', 'from', 'as', 'into', 'all', 'each', 'every', 'both', 'more',
  'some', 'any', 'such', 'only', 'also', 'back', 'after', 'use', 'two',
]);

/**
 * Extract meaningful keywords from text.
 * Lowercases, strips non-alpha characters, removes stop words and short tokens.
 */
export function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Deduplicate while preserving order
  return [...new Set(words)];
}

/**
 * Add a memory entry to an agent's long-term memory.
 * Automatically extracts keywords from the text and caps memory at the configured limit.
 */
export function addMemory(
  agent: Agent,
  text: string,
  tick: number,
  config: SimulationConfig = DEFAULT_CONFIG,
): void {
  const keywords = extractKeywords(text);

  // Skip empty memories (no content-bearing words)
  if (keywords.length === 0 && text.trim().length === 0) return;

  const entry: MemoryEntry = { text, tick, keywords };
  agent.memory.push(entry);

  // Cap at configured maximum, evicting oldest entries first
  if (agent.memory.length > config.maxMemoryEntries) {
    agent.memory = agent.memory.slice(-config.maxMemoryEntries);
  }
}

/**
 * Retrieve the most relevant memories for a given context string.
 * Uses keyword overlap scoring: shared keywords between the context and each memory.
 */
export function retrieveRelevantMemories(
  agent: Agent,
  contextText: string,
  topK: number = 3,
): MemoryEntry[] {
  if (agent.memory.length === 0) return [];

  const contextKeywords = new Set(extractKeywords(contextText));
  if (contextKeywords.size === 0) {
    // No meaningful context — return most recent memories instead
    return agent.memory.slice(-topK);
  }

  // Score each memory by the number of shared keywords
  const scored = agent.memory.map((entry) => {
    const overlap = entry.keywords.filter((kw) => contextKeywords.has(kw)).length;
    return { entry, score: overlap };
  });

  // Sort descending by score, then by recency (tick) as a tiebreaker
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.entry.tick - a.entry.tick;
  });

  return scored.slice(0, topK).map((s) => s.entry);
}

/**
 * Clear all long-term memory entries for an agent.
 * Used by the Amnesia Bomb.
 */
export function clearMemory(agent: Agent): void {
  agent.memory = [];
}
