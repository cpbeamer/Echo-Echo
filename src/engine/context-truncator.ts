/**
 * Context Truncator – condenses an agent's lore-cache when it exceeds a token budget.
 *
 * Uses a simple chars/4 heuristic for token estimation. When over budget, calls the
 * LLM to summarize the oldest entries while preserving the most recent ones.
 */

import { generateCompletion } from './ollama-client';

/** Rough token estimate: ~4 characters per token for English text. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Estimate total tokens across all lore-cache entries. */
function estimateLoreCacheTokens(loreCache: string[]): number {
  return loreCache.reduce((sum, entry) => sum + estimateTokens(entry), 0);
}

const SUMMARIZATION_PROMPT = `You are a memory compressor for an autonomous agent.
Condense the following memory entries into 1-2 short sentences that preserve the key takeaways.
Return ONLY the condensed text, no explanations or formatting.

Memory entries:
`;

/**
 * Truncate a lore-cache if it exceeds the token budget.
 *
 * Strategy: keep the 3 most recent entries intact (freshest memories),
 * summarize the older entries into a single condensed entry via the LLM.
 *
 * @param loreCache - The agent's current lore entries.
 * @param tokenBudget - Max token budget (default 512).
 * @param model - Ollama model to use for summarization.
 * @returns The condensed lore-cache, or the original if already under budget.
 */
export async function truncateLoreCache(
  loreCache: string[],
  tokenBudget: number,
  model: string,
): Promise<string[]> {
  const currentTokens = estimateLoreCacheTokens(loreCache);

  // Already under budget — no truncation needed
  if (currentTokens <= tokenBudget) {
    return loreCache;
  }

  // Keep the 3 most recent entries intact
  const recentCount = Math.min(3, loreCache.length);
  const olderEntries = loreCache.slice(0, -recentCount);
  const recentEntries = loreCache.slice(-recentCount);

  // If there's nothing to condense, just return the recent entries
  if (olderEntries.length === 0) {
    return recentEntries;
  }

  // Ask the LLM to summarize the older entries
  const prompt = SUMMARIZATION_PROMPT + olderEntries.map((e, i) => `${i + 1}. ${e}`).join('\n');
  const summary = await generateCompletion(model, prompt);

  if (summary) {
    return [`[Summary] ${summary.trim()}`, ...recentEntries];
  }

  // LLM call failed — fallback: just keep the most recent entries
  return recentEntries;
}

export { estimateTokens, estimateLoreCacheTokens };
