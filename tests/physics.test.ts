import { describe, it, expect, beforeEach } from 'vitest';
import { tickPhysics } from '../src/engine/physics';
import { createAgents, resetAgentIdCounter } from '../src/engine/agent-factory';
import { DEFAULT_CONFIG } from '../src/types';

describe('Physics Engine', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('moves agents after a tick', () => {
    const agents = createAgents(5);
    const initialPositions = agents.map((a) => ({ ...a.position }));

    tickPhysics(agents, 1, DEFAULT_CONFIG);

    const moved = agents.some(
      (a, i) => a.position.x !== initialPositions[i].x || a.position.y !== initialPositions[i].y,
    );
    expect(moved).toBe(true);
  });

  it('keeps agents within grid bounds after many ticks', () => {
    const agents = createAgents(50);

    for (let i = 0; i < 100; i++) {
      tickPhysics(agents, 1, DEFAULT_CONFIG);
    }

    for (const agent of agents) {
      expect(agent.position.x).toBeGreaterThanOrEqual(0);
      expect(agent.position.x).toBeLessThanOrEqual(DEFAULT_CONFIG.gridWidth);
      expect(agent.position.y).toBeGreaterThanOrEqual(0);
      expect(agent.position.y).toBeLessThanOrEqual(DEFAULT_CONFIG.gridHeight);
    }
  });

  it('does not move dead agents', () => {
    const agents = createAgents(3);
    agents[0].energy = 0;
    const deadPos = { ...agents[0].position };

    tickPhysics(agents, 1, DEFAULT_CONFIG);

    expect(agents[0].position.x).toBe(deadPos.x);
    expect(agents[0].position.y).toBe(deadPos.y);
  });

  it('no permanent overlaps after N ticks', () => {
    const agents = createAgents(20);

    // Place all agents at the same spot
    for (const agent of agents) {
      agent.position.x = 50;
      agent.position.y = 50;
    }

    // Run many ticks — repulsion should spread them out
    for (let i = 0; i < 200; i++) {
      tickPhysics(agents, 1, DEFAULT_CONFIG);
    }

    // Check that not all agents are still at the same exact position
    const uniquePositions = new Set(
      agents.map((a) => `${a.position.x.toFixed(1)},${a.position.y.toFixed(1)}`),
    );
    expect(uniquePositions.size).toBeGreaterThan(1);
  });
});
