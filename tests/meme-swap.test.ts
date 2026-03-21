import { describe, it, expect, beforeEach } from 'vitest';
import { attemptMemeSwap, ideologicalSimilarity, processMemeSwaps } from '../src/engine/meme-swap';
import type { MemeSwapResult } from '../src/types/hud';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';

describe('Ideological Similarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 };
    expect(ideologicalSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it('returns 0 for maximally different vectors', () => {
    const a = { analytical_emotional: 0, altruistic_selfish: 0, order_chaos: 0 };
    const b = { analytical_emotional: 1, altruistic_selfish: 1, order_chaos: 1 };
    expect(ideologicalSimilarity(a, b)).toBeCloseTo(0.0);
  });

  it('returns intermediate value for partially similar vectors', () => {
    const a = { analytical_emotional: 0.3, altruistic_selfish: 0.3, order_chaos: 0.3 };
    const b = { analytical_emotional: 0.7, altruistic_selfish: 0.7, order_chaos: 0.7 };
    const sim = ideologicalSimilarity(a, b);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});

describe('Meme Swap', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('swaps lingo between nearby identical agents and returns MemeSwapResult', () => {
    const a = createAgent(50, 50);
    const b = createAgent(50, 50);

    // Force identical vectors for 100% swap probability
    a.vector = { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 };
    b.vector = { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 };

    a.lingo = { 'Sec-Jedi': 'A leader' };
    b.lingo = { 'Void-Born': 'A nihilist' };

    const result: MemeSwapResult | null = attemptMemeSwap(a, b);
    expect(result).not.toBeNull();

    // A should have B's lingo and vice versa
    expect(a.lingo['Void-Born']).toBe('A nihilist');
    expect(b.lingo['Sec-Jedi']).toBe('A leader');

    // Result should contain correct IDs and terms
    expect(result!.fromId).toBe(a.id);
    expect(result!.toId).toBe(b.id);
    expect(result!.termsGiven).toContain('Sec-Jedi');
    expect(result!.termsReceived).toContain('Void-Born');
  });

  it('returns null when swap probability fails', () => {
    const a = createAgent(50, 50);
    const b = createAgent(50, 50);

    // Maximally different vectors → near-zero swap probability
    a.vector = { analytical_emotional: 0, altruistic_selfish: 0, order_chaos: 0 };
    b.vector = { analytical_emotional: 1, altruistic_selfish: 1, order_chaos: 1 };

    a.lingo = { term: 'meaning' };
    b.lingo = { other: 'meaning' };

    // With maximally different agents, similarity is ~0 so swap should almost never happen
    // Run multiple times to verify at least most return null
    let nullCount = 0;
    for (let i = 0; i < 100; i++) {
      // Reset lingo each time
      a.lingo = { term: 'meaning' };
      b.lingo = { other: 'meaning' };
      const result = attemptMemeSwap(a, b);
      if (result === null) nullCount++;
    }

    // With similarity ≈ 0, nearly all attempts should fail
    expect(nullCount).toBeGreaterThan(90);
  });
});

describe('processMemeSwaps', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('returns array of MemeSwapResult for agents within proximity radius', () => {
    const a = createAgent(50, 50);
    const b = createAgent(51, 50); // 1 cell apart — within default radius of 3
    const c = createAgent(90, 90); // far away — not within radius

    a.vector = { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 };
    b.vector = { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 };

    a.lingo = { 'term-a': 'meaning-a' };
    b.lingo = { 'term-b': 'meaning-b' };
    c.lingo = { 'term-c': 'meaning-c' };

    const results: MemeSwapResult[] = processMemeSwaps([a, b, c], 3);

    // a and b should have swapped, c should be untouched
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(a.lingo['term-b']).toBe('meaning-b');
    expect(c.lingo).toEqual({ 'term-c': 'meaning-c' });

    // Verify result structure
    const firstResult = results[0];
    expect(firstResult).toHaveProperty('fromId');
    expect(firstResult).toHaveProperty('toId');
    expect(firstResult).toHaveProperty('termsGiven');
    expect(firstResult).toHaveProperty('termsReceived');
  });
});
