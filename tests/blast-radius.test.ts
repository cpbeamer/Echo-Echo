import { describe, it, expect, beforeEach } from 'vitest';
import {
  findAgentsInBlastRadius,
  detonateDataBomb,
  manhattanDistance,
} from '../src/engine/blast-radius';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';
import type { DataBomb } from '../src/types';

describe('manhattanDistance', () => {
  it('returns 0 for the same point', () => {
    expect(manhattanDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it('returns correct distance for horizontal offset', () => {
    expect(manhattanDistance({ x: 0, y: 0 }, { x: 7, y: 0 })).toBe(7);
  });

  it('returns correct distance for diagonal offset', () => {
    expect(manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
  });
});

describe('findAgentsInBlastRadius', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('returns agents within Manhattan distance R of center', () => {
    const agents = [
      createAgent(50, 50), // distance 0 from (50,50)
      createAgent(52, 52), // distance 4
      createAgent(53, 53), // distance 6 — outside R=5
      createAgent(55, 50), // distance 5 — on boundary
    ];

    const result = findAgentsInBlastRadius(agents, { x: 50, y: 50 }, 5);

    expect(result).toHaveLength(3);
    expect(result.map((a) => a.id)).toContain('agent-0');
    expect(result.map((a) => a.id)).toContain('agent-1');
    expect(result.map((a) => a.id)).toContain('agent-3'); // exactly on boundary
    expect(result.map((a) => a.id)).not.toContain('agent-2');
  });

  it('returns empty array when no agents are in range', () => {
    const agents = [createAgent(0, 0), createAgent(1, 1)];

    const result = findAgentsInBlastRadius(agents, { x: 99, y: 99 }, 3);

    expect(result).toHaveLength(0);
  });

  it('returns all agents when all are in range', () => {
    const agents = [createAgent(50, 50), createAgent(50, 51), createAgent(51, 50)];

    const result = findAgentsInBlastRadius(agents, { x: 50, y: 50 }, 20);

    expect(result).toHaveLength(3);
  });

  it('excludes dead agents (energy <= 0)', () => {
    const agents = [createAgent(50, 50), createAgent(50, 51)];
    agents[0].energy = 0; // kill agent-0

    const result = findAgentsInBlastRadius(agents, { x: 50, y: 50 }, 10);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('agent-1');
  });
});

describe('detonateDataBomb', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('mutates DNA of affected agents and returns their IDs', () => {
    const agents = [createAgent(50, 50), createAgent(50, 51), createAgent(99, 99)];

    const originalVector0 = { ...agents[0].vector };
    const originalVector1 = { ...agents[1].vector };
    const originalVector2 = { ...agents[2].vector };

    const bomb: DataBomb = {
      text: 'Order, law, structure, discipline, rules, control, system',
      target: { x: 50, y: 50 },
      radius: 5,
    };

    const affectedIds = detonateDataBomb(agents, bomb);

    // Two agents in range
    expect(affectedIds).toHaveLength(2);
    expect(affectedIds).toContain('agent-0');
    expect(affectedIds).toContain('agent-1');

    // DNA should have shifted for affected agents (order keywords push order_chaos down)
    expect(agents[0].vector.order_chaos).not.toBe(originalVector0.order_chaos);
    expect(agents[1].vector.order_chaos).not.toBe(originalVector1.order_chaos);

    // Agent out of range should be untouched
    expect(agents[2].vector).toEqual(originalVector2);
  });

  it('adds lore-cache entries to affected agents', () => {
    const agents = [createAgent(50, 50)];
    expect(agents[0].loreCache).toHaveLength(0);

    const bomb: DataBomb = {
      text: 'Some payload text.',
      target: { x: 50, y: 50 },
      radius: 5,
    };

    detonateDataBomb(agents, bomb);

    expect(agents[0].loreCache).toHaveLength(1);
    expect(agents[0].loreCache[0]).toContain('[Data Bomb]');
  });
});
