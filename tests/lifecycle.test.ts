import { describe, it, expect, beforeEach } from 'vitest';
import {
  tickEnergy,
  updateAdjacencyTicks,
  tickReproduction,
  applyNaturalSelection,
} from '../src/engine/lifecycle';
import { resetAgentIdCounter } from '../src/engine/agent-factory';
import type { Agent, SimulationConfig } from '../src/types';
import { DEFAULT_CONFIG } from '../src/types';

/** Helper to create a minimal agent for testing. */
function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: `agent-${Math.random().toString(36).slice(2, 6)}`,
    vector: {
      analytical_emotional: 0.5,
      altruistic_selfish: 0.5,
      order_chaos: 0.5,
    },
    loreCache: [],
    lingo: {},
    faction: 'unaligned',
    position: { x: 50, y: 50 },
    velocity: { x: 0, y: 0 },
    energy: 1.0,
    color: 'hsl(180, 65%, 50%)',
    radius: 0.4,
    activityLevel: 0,
    deathFrame: null,
    adjacencyTicks: new Map(),
    parentIds: null,
    lastReproductionTick: -Infinity,
    memory: [],
    ...overrides,
  };
}

/** Create a config with optional overrides. */
function makeConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

describe('Lifecycle – Energy Depletion', () => {
  it('drains energy at the base rate per tick', () => {
    const agent = makeAgent({ energy: 1.0 });
    // Place a neighbor nearby so isolation doesn't apply
    const neighbor = makeAgent({ energy: 1.0, position: { x: 51, y: 50 } });
    const config = makeConfig({ energyDecayRate: 0.01 });

    tickEnergy([agent, neighbor], config);

    expect(agent.energy).toBeCloseTo(0.99, 5);
  });

  it('drains energy faster when agent is isolated', () => {
    const agent = makeAgent({ energy: 1.0, position: { x: 50, y: 50 } });
    // No neighbors within range (50 cells away)
    const distantAgent = makeAgent({ energy: 1.0, position: { x: 99, y: 99 } });
    const config = makeConfig({ energyDecayRate: 0.01, isolationDecayMultiplier: 3 });

    tickEnergy([agent, distantAgent], config);

    // Should drain at 0.01 * 3 = 0.03 due to isolation
    expect(agent.energy).toBeCloseTo(0.97, 5);
  });

  it('does not drain dead agents', () => {
    const agent = makeAgent({ energy: 0 });
    const config = makeConfig({ energyDecayRate: 0.01 });

    tickEnergy([agent], config);

    expect(agent.energy).toBe(0);
  });

  it('does not drain agents with active death animations', () => {
    const agent = makeAgent({ energy: 0.5, deathFrame: 5 });
    const config = makeConfig({ energyDecayRate: 0.01 });

    tickEnergy([agent], config);

    expect(agent.energy).toBe(0.5);
  });

  it('clamps energy at zero', () => {
    const agent = makeAgent({ energy: 0.005 });
    const config = makeConfig({ energyDecayRate: 0.01, isolationDecayMultiplier: 3 });

    tickEnergy([agent], config);

    expect(agent.energy).toBe(0);
  });
});

describe('Lifecycle – Adjacency Tracking', () => {
  it('increments adjacency ticks for nearby agents', () => {
    const a = makeAgent({ id: 'a1', position: { x: 50, y: 50 } });
    const b = makeAgent({ id: 'b1', position: { x: 51, y: 50 } });

    updateAdjacencyTicks([a, b]);

    expect(a.adjacencyTicks.get('b1')).toBe(1);
    expect(b.adjacencyTicks.get('a1')).toBe(1);
  });

  it('accumulates adjacency ticks over multiple calls', () => {
    const a = makeAgent({ id: 'a1', position: { x: 50, y: 50 } });
    const b = makeAgent({ id: 'b1', position: { x: 51, y: 50 } });

    updateAdjacencyTicks([a, b]);
    updateAdjacencyTicks([a, b]);
    updateAdjacencyTicks([a, b]);

    expect(a.adjacencyTicks.get('b1')).toBe(3);
  });

  it('removes adjacency ticks when agents move apart', () => {
    const a = makeAgent({ id: 'a1', position: { x: 50, y: 50 } });
    const b = makeAgent({ id: 'b1', position: { x: 51, y: 50 } });

    updateAdjacencyTicks([a, b]);
    expect(a.adjacencyTicks.get('b1')).toBe(1);

    // Move b far away
    b.position = { x: 99, y: 99 };
    updateAdjacencyTicks([a, b]);

    expect(a.adjacencyTicks.get('b1')).toBeUndefined();
  });

  it('ignores dead agents', () => {
    const a = makeAgent({ id: 'a1', position: { x: 50, y: 50 } });
    const b = makeAgent({ id: 'b1', position: { x: 51, y: 50 }, energy: 0 });

    updateAdjacencyTicks([a, b]);

    expect(a.adjacencyTicks.get('b1')).toBeUndefined();
  });
});

describe('Lifecycle – Reproduction', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('spawns a child when two similar agents are adjacent long enough', () => {
    const a = makeAgent({
      id: 'parent-a',
      position: { x: 50, y: 50 },
      energy: 0.8,
      vector: { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 },
      lastReproductionTick: -Infinity,
    });
    const b = makeAgent({
      id: 'parent-b',
      position: { x: 51, y: 50 },
      energy: 0.8,
      vector: { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 },
      lastReproductionTick: -Infinity,
    });

    // Set adjacency ticks above threshold
    a.adjacencyTicks.set('parent-b', 60);
    b.adjacencyTicks.set('parent-a', 60);

    const config = makeConfig({
      reproductionThreshold: 50,
      reproductionSimilarity: 0.7,
      reproductionCooldown: 100,
    });

    const children = tickReproduction([a, b], 200, config);

    expect(children).toHaveLength(1);
    expect(children[0].parentIds).toEqual(['parent-a', 'parent-b']);
  });

  it('places child at parent midpoint with blended DNA', () => {
    const a = makeAgent({
      id: 'pa',
      position: { x: 40, y: 40 },
      energy: 0.8,
      vector: { analytical_emotional: 0.2, altruistic_selfish: 0.8, order_chaos: 0.3 },
      lastReproductionTick: -Infinity,
    });
    const b = makeAgent({
      id: 'pb',
      position: { x: 60, y: 60 },
      energy: 0.8,
      vector: { analytical_emotional: 0.6, altruistic_selfish: 0.4, order_chaos: 0.7 },
      lastReproductionTick: -Infinity,
    });

    a.adjacencyTicks.set('pb', 60);
    b.adjacencyTicks.set('pa', 60);

    const config = makeConfig({
      reproductionThreshold: 50,
      reproductionSimilarity: 0.0, // Low threshold for testing
      reproductionCooldown: 0,
    });

    const children = tickReproduction([a, b], 200, config);

    expect(children).toHaveLength(1);
    const child = children[0];

    // Position should be midpoint
    expect(child.position.x).toBe(50);
    expect(child.position.y).toBe(50);

    // DNA should be approximately the average (with jitter ±0.05)
    expect(child.vector.analytical_emotional).toBeCloseTo(0.4, 0);
    expect(child.vector.altruistic_selfish).toBeCloseTo(0.6, 0);
    expect(child.vector.order_chaos).toBeCloseTo(0.5, 0);
  });

  it('deducts energy from parents after reproduction', () => {
    const a = makeAgent({
      id: 'pa',
      energy: 0.8,
      position: { x: 50, y: 50 },
      vector: { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 },
      lastReproductionTick: -Infinity,
    });
    const b = makeAgent({
      id: 'pb',
      energy: 0.8,
      position: { x: 51, y: 50 },
      vector: { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 },
      lastReproductionTick: -Infinity,
    });

    a.adjacencyTicks.set('pb', 60);
    b.adjacencyTicks.set('pa', 60);

    const config = makeConfig({
      reproductionThreshold: 50,
      reproductionSimilarity: 0.5,
      reproductionCooldown: 0,
    });

    tickReproduction([a, b], 200, config);

    // Each parent loses 0.2 energy
    expect(a.energy).toBeCloseTo(0.6, 5);
    expect(b.energy).toBeCloseTo(0.6, 5);
  });

  it('respects reproduction cooldown', () => {
    const a = makeAgent({
      id: 'pa',
      energy: 0.8,
      position: { x: 50, y: 50 },
      vector: { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 },
      lastReproductionTick: 180, // Recent reproduction
    });
    const b = makeAgent({
      id: 'pb',
      energy: 0.8,
      position: { x: 51, y: 50 },
      vector: { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 },
      lastReproductionTick: -Infinity,
    });

    a.adjacencyTicks.set('pb', 60);
    b.adjacencyTicks.set('pa', 60);

    const config = makeConfig({
      reproductionThreshold: 50,
      reproductionSimilarity: 0.5,
      reproductionCooldown: 100,
    });

    // tick=200, parent A's lastRepro=180, cooldown=100 → 200-180=20 < 100 → blocked
    const children = tickReproduction([a, b], 200, config);

    expect(children).toHaveLength(0);
  });

  it('blocks reproduction when energy is too low', () => {
    const a = makeAgent({
      id: 'pa',
      energy: 0.2, // Below MIN_REPRODUCTION_ENERGY (0.3)
      position: { x: 50, y: 50 },
      vector: { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 },
      lastReproductionTick: -Infinity,
    });
    const b = makeAgent({
      id: 'pb',
      energy: 0.8,
      position: { x: 51, y: 50 },
      vector: { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 },
      lastReproductionTick: -Infinity,
    });

    a.adjacencyTicks.set('pb', 60);
    b.adjacencyTicks.set('pa', 60);

    const config = makeConfig({
      reproductionThreshold: 50,
      reproductionSimilarity: 0.5,
      reproductionCooldown: 0,
    });

    const children = tickReproduction([a, b], 200, config);

    expect(children).toHaveLength(0);
  });

  it('blocks reproduction when agents are too ideologically different', () => {
    const a = makeAgent({
      id: 'pa',
      energy: 0.8,
      position: { x: 50, y: 50 },
      vector: { analytical_emotional: 0.0, altruistic_selfish: 0.0, order_chaos: 0.0 },
      lastReproductionTick: -Infinity,
    });
    const b = makeAgent({
      id: 'pb',
      energy: 0.8,
      position: { x: 51, y: 50 },
      vector: { analytical_emotional: 1.0, altruistic_selfish: 1.0, order_chaos: 1.0 },
      lastReproductionTick: -Infinity,
    });

    a.adjacencyTicks.set('pb', 60);
    b.adjacencyTicks.set('pa', 60);

    const config = makeConfig({
      reproductionThreshold: 50,
      reproductionSimilarity: 0.7,
      reproductionCooldown: 0,
    });

    const children = tickReproduction([a, b], 200, config);

    expect(children).toHaveLength(0);
  });
});

describe('Lifecycle – Natural Selection', () => {
  it('drains extra energy from agents with extreme DNA values', () => {
    const extremeAgent = makeAgent({
      energy: 1.0,
      vector: { analytical_emotional: 0.05, altruistic_selfish: 0.5, order_chaos: 0.5 },
    });
    const normalAgent = makeAgent({
      energy: 1.0,
      vector: { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 },
    });

    const config = makeConfig({
      naturalSelectionEnabled: true,
      naturalSelectionPressure: 2.0,
      energyDecayRate: 0.01,
    });

    applyNaturalSelection([extremeAgent, normalAgent], config);

    // Extreme agent: extra decay = 0.01 * (2.0 - 1) = 0.01
    expect(extremeAgent.energy).toBeCloseTo(0.99, 5);
    // Normal agent: no extra decay
    expect(normalAgent.energy).toBe(1.0);
  });

  it('does nothing when natural selection is disabled', () => {
    const extremeAgent = makeAgent({
      energy: 1.0,
      vector: { analytical_emotional: 0.05, altruistic_selfish: 0.5, order_chaos: 0.5 },
    });

    const config = makeConfig({
      naturalSelectionEnabled: false,
      naturalSelectionPressure: 2.0,
      energyDecayRate: 0.01,
    });

    applyNaturalSelection([extremeAgent], config);

    expect(extremeAgent.energy).toBe(1.0);
  });

  it('applies to any axis that is extreme (near 1)', () => {
    const agent = makeAgent({
      energy: 1.0,
      vector: { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.95 },
    });

    const config = makeConfig({
      naturalSelectionEnabled: true,
      naturalSelectionPressure: 1.5,
      energyDecayRate: 0.01,
    });

    applyNaturalSelection([agent], config);

    expect(agent.energy).toBeCloseTo(0.995, 5);
  });

  it('does not affect agents with moderate DNA values', () => {
    const agent = makeAgent({
      energy: 1.0,
      vector: { analytical_emotional: 0.3, altruistic_selfish: 0.6, order_chaos: 0.5 },
    });

    const config = makeConfig({
      naturalSelectionEnabled: true,
      naturalSelectionPressure: 2.0,
      energyDecayRate: 0.01,
    });

    applyNaturalSelection([agent], config);

    expect(agent.energy).toBe(1.0);
  });
});
