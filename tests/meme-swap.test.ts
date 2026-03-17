import { describe, it, expect, beforeEach } from 'vitest';
import { attemptMemeSwap, ideologicalSimilarity, processMemeSwaps } from '../src/engine/meme-swap';
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

  it('swaps lingo between nearby identical agents', () => {
    // Create two agents at same position with identical DNA → guaranteed swap
    const a = createAgent(50, 50);
    const b = createAgent(50, 50);

    // Force identical vectors for 100% swap probability
    a.vector = { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 };
    b.vector = { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 };

    a.lingo = { 'Sec-Jedi': 'A leader' };
    b.lingo = { 'Void-Born': 'A nihilist' };

    const swapped = attemptMemeSwap(a, b);
    expect(swapped).toBe(true);

    // A should have B's lingo and vice versa
    expect(a.lingo['Void-Born']).toBe('A nihilist');
    expect(b.lingo['Sec-Jedi']).toBe('A leader');
  });
});

describe('processMemeSwaps', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('processes swaps for agents within proximity radius', () => {
    const a = createAgent(50, 50);
    const b = createAgent(51, 50); // 1 cell apart — within default radius of 3
    const c = createAgent(90, 90); // far away — not within radius

    a.vector = { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 };
    b.vector = { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 };

    a.lingo = { 'term-a': 'meaning-a' };
    b.lingo = { 'term-b': 'meaning-b' };
    c.lingo = { 'term-c': 'meaning-c' };

    const swapCount = processMemeSwaps([a, b, c], 3);

    // a and b should have swapped, c should be untouched
    expect(swapCount).toBeGreaterThanOrEqual(1);
    expect(a.lingo['term-b']).toBe('meaning-b');
    expect(c.lingo).toEqual({ 'term-c': 'meaning-c' }); // c unchanged
  });
});
