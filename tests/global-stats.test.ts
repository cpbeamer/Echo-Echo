import { describe, it, expect, beforeEach } from 'vitest';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';
import type { Agent } from '../src/types';

/**
 * Global stats logic tests – specifically the averagePeaceScore computation.
 *
 * Since SimulationState uses Svelte 5 runes, we test the pure logic directly.
 * Peace score = mean of (1 - order_chaos) across all alive agents.
 */

function computeAveragePeaceScore(agents: Agent[]): number {
  const alive = agents.filter((a) => a.energy > 0);
  if (alive.length === 0) return 0;
  const sum = alive.reduce((acc, a) => acc + (1 - a.vector.order_chaos), 0);
  return sum / alive.length;
}

describe('averagePeaceScore', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('returns 0 for empty agent list', () => {
    expect(computeAveragePeaceScore([])).toBe(0);
  });

  it('returns 1.0 when all agents have order_chaos = 0 (max peace)', () => {
    const a = createAgent(50, 50);
    const b = createAgent(51, 51);
    a.vector.order_chaos = 0;
    b.vector.order_chaos = 0;

    expect(computeAveragePeaceScore([a, b])).toBeCloseTo(1.0);
  });

  it('returns 0.0 when all agents have order_chaos = 1 (max chaos)', () => {
    const a = createAgent(50, 50);
    const b = createAgent(51, 51);
    a.vector.order_chaos = 1;
    b.vector.order_chaos = 1;

    expect(computeAveragePeaceScore([a, b])).toBeCloseTo(0.0);
  });

  it('computes correct mean for mixed values', () => {
    const a = createAgent(50, 50);
    const b = createAgent(51, 51);
    a.vector.order_chaos = 0.2; // peace = 0.8
    b.vector.order_chaos = 0.6; // peace = 0.4

    // Expected: (0.8 + 0.4) / 2 = 0.6
    expect(computeAveragePeaceScore([a, b])).toBeCloseTo(0.6);
  });

  it('excludes dead agents (energy <= 0)', () => {
    const alive = createAgent(50, 50);
    const dead = createAgent(51, 51);
    alive.vector.order_chaos = 0.3; // peace = 0.7
    dead.vector.order_chaos = 1.0;
    dead.energy = 0;

    // Only alive agent contributes → peace = 0.7
    expect(computeAveragePeaceScore([alive, dead])).toBeCloseTo(0.7);
  });

  it('returns 0 when all agents are dead', () => {
    const a = createAgent(50, 50);
    const b = createAgent(51, 51);
    a.energy = 0;
    b.energy = 0;

    expect(computeAveragePeaceScore([a, b])).toBe(0);
  });
});
