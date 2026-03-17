import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgent,
  createAgents,
  dnaToColor,
  resetAgentIdCounter,
} from '../src/engine/agent-factory';
import { DEFAULT_CONFIG } from '../src/types';

describe('AgentFactory', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('creates a single agent with valid DNA', () => {
    const agent = createAgent(50, 50);
    expect(agent.id).toBe('agent-0');
    expect(agent.position).toEqual({ x: 50, y: 50 });
    expect(agent.velocity).toEqual({ x: 0, y: 0 });
    expect(agent.energy).toBe(1.0);
    expect(agent.vector.analytical_emotional).toBeGreaterThanOrEqual(0);
    expect(agent.vector.analytical_emotional).toBeLessThanOrEqual(1);
    expect(agent.vector.altruistic_selfish).toBeGreaterThanOrEqual(0);
    expect(agent.vector.altruistic_selfish).toBeLessThanOrEqual(1);
    expect(agent.vector.order_chaos).toBeGreaterThanOrEqual(0);
    expect(agent.vector.order_chaos).toBeLessThanOrEqual(1);
    expect(agent.loreCache).toEqual([]);
    expect(agent.lingo).toEqual({});
  });

  it('creates 200 unique agents', () => {
    const agents = createAgents(200);
    expect(agents).toHaveLength(200);

    const ids = new Set(agents.map((a) => a.id));
    expect(ids.size).toBe(200);
  });

  it('places agents within grid bounds', () => {
    const agents = createAgents(100);
    for (const agent of agents) {
      expect(agent.position.x).toBeGreaterThanOrEqual(1);
      expect(agent.position.x).toBeLessThanOrEqual(DEFAULT_CONFIG.gridWidth - 1);
      expect(agent.position.y).toBeGreaterThanOrEqual(1);
      expect(agent.position.y).toBeLessThanOrEqual(DEFAULT_CONFIG.gridHeight - 1);
    }
  });

  it('generates valid HSL color strings', () => {
    const color = dnaToColor({
      analytical_emotional: 0.5,
      altruistic_selfish: 0.3,
      order_chaos: 0.7,
    });
    expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
  });

  it('assigns every agent a faction', () => {
    const agents = createAgents(100);
    const validFactions = ['hive', 'void', 'citadel', 'fringe', 'unaligned'];
    for (const agent of agents) {
      expect(validFactions).toContain(agent.faction);
    }
  });
});
