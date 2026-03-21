import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  estimateTokens,
  estimateLoreCacheTokens,
  truncateLoreCache,
} from '../src/engine/context-truncator';

// Mock the ollama-client at the top level so the static import inside
// context-truncator.ts picks up the mock.
vi.mock('../src/engine/ollama-client', () => ({
  detectOllama: vi.fn().mockResolvedValue(true),
  listModels: vi.fn().mockResolvedValue(['llama3.2:1b']),
  generateCompletion: vi.fn().mockResolvedValue('Condensed memory summary.'),
}));

describe('Context Truncator – Token Estimation', () => {
  it('estimates tokens as roughly chars / 4', () => {
    expect(estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75 → ceil = 3
  });

  it('estimates zero tokens for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates total tokens across lore entries', () => {
    const lore = ['Entry one.', 'Entry two is longer than the first.'];
    const total = estimateLoreCacheTokens(lore);

    expect(total).toBe(estimateTokens(lore[0]) + estimateTokens(lore[1]));
  });

  it('handles empty lore-cache', () => {
    expect(estimateLoreCacheTokens([])).toBe(0);
  });
});

describe('Context Truncator – truncateLoreCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns lore-cache unchanged when under budget', async () => {
    const shortLore = ['Short entry.'];
    const result = await truncateLoreCache(shortLore, 512, 'llama3.2:1b');

    expect(result).toEqual(shortLore);
  });

  it('condenses older entries when over budget', async () => {
    const { generateCompletion } = await import('../src/engine/ollama-client');
    vi.mocked(generateCompletion).mockResolvedValue('Condensed memory summary.');

    // Create a lore-cache that exceeds a tight budget (20 tokens ≈ 80 chars)
    const longLore = Array.from(
      { length: 10 },
      (_, i) =>
        `This is a fairly long lore entry number ${i} with lots of detail about what happened.`,
    );

    const result = await truncateLoreCache(longLore, 20, 'llama3.2:1b');

    // Should have 1 summary entry + 3 most recent entries = 4 total
    expect(result).toHaveLength(4);
    expect(result[0]).toContain('[Summary]');
    expect(result[0]).toContain('Condensed memory summary.');
  });

  it('falls back to recent entries when LLM call fails', async () => {
    const { generateCompletion } = await import('../src/engine/ollama-client');
    vi.mocked(generateCompletion).mockResolvedValue(null as unknown as string);

    const longLore = Array.from(
      { length: 10 },
      (_, i) => `Long entry ${i} with substantial content padding to exceed the budget.`,
    );

    const result = await truncateLoreCache(longLore, 20, 'llama3.2:1b');

    // Fallback: just the 3 most recent entries
    expect(result).toHaveLength(3);
  });
});
