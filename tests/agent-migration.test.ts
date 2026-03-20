import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectMigrationCandidates,
  migrateAgent,
  receiveMigratedAgent,
} from '../src/engine/agent-migration';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';
import type { SectorBounds, SectorExpansionConfig } from '../src/types/networking';

const TEST_CONFIG: SectorExpansionConfig = {
  userThresholdForNewSector: 4,
  maxSectors: 16,
  sectorGridSize: 100,
  migrationEdgeThreshold: 2,
};

const SECTOR_A_BOUNDS: SectorBounds = {
  originX: 0,
  originY: 0,
  width: 100,
  height: 100,
};

const SECTOR_B_BOUNDS: SectorBounds = {
  originX: 100,
  originY: 0,
  width: 100,
  height: 100,
};

const SECTOR_C_BOUNDS: SectorBounds = {
  originX: 0,
  originY: 100,
  width: 100,
  height: 100,
};

describe('detectMigrationCandidates', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('detects agents near the right edge', () => {
    const agents = [createAgent(99, 50)]; // near right edge of 100-wide sector
    const candidates = detectMigrationCandidates(agents, SECTOR_A_BOUNDS, TEST_CONFIG);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].edge).toBe('right');
    expect(candidates[0].agent.id).toBe('agent-0');
  });

  it('detects agents near the left edge', () => {
    const agents = [createAgent(1, 50)];
    const candidates = detectMigrationCandidates(agents, SECTOR_A_BOUNDS, TEST_CONFIG);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].edge).toBe('left');
  });

  it('detects agents near the top edge', () => {
    const agents = [createAgent(50, 1)];
    const candidates = detectMigrationCandidates(agents, SECTOR_A_BOUNDS, TEST_CONFIG);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].edge).toBe('top');
  });

  it('detects agents near the bottom edge', () => {
    const agents = [createAgent(50, 99)];
    const candidates = detectMigrationCandidates(agents, SECTOR_A_BOUNDS, TEST_CONFIG);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].edge).toBe('bottom');
  });

  it('ignores agents in the center of the sector', () => {
    const agents = [createAgent(50, 50)];
    const candidates = detectMigrationCandidates(agents, SECTOR_A_BOUNDS, TEST_CONFIG);

    expect(candidates).toHaveLength(0);
  });

  it('ignores dead agents', () => {
    const agents = [createAgent(99, 50)];
    agents[0].energy = 0;
    const candidates = detectMigrationCandidates(agents, SECTOR_A_BOUNDS, TEST_CONFIG);

    expect(candidates).toHaveLength(0);
  });

  it('ignores agents with active death animation', () => {
    const agents = [createAgent(99, 50)];
    agents[0].deathFrame = 5;
    const candidates = detectMigrationCandidates(agents, SECTOR_A_BOUNDS, TEST_CONFIG);

    expect(candidates).toHaveLength(0);
  });
});

describe('migrateAgent', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('translates coordinates when migrating right to adjacent sector', () => {
    const agent = createAgent(99, 50); // near right edge of sector A
    const serialized = migrateAgent(agent, SECTOR_A_BOUNDS, SECTOR_B_BOUNDS, 'right');

    // Global position: (0 + 99, 0 + 50) = (99, 50)
    // In sector B (originX=100): localX = 99 - 100 = -1, clamped to 0.5
    expect(serialized.position.x).toBeCloseTo(0.5, 1);
    expect(serialized.position.y).toBeCloseTo(50, 1);
  });

  it('translates coordinates when migrating down to adjacent sector', () => {
    const agent = createAgent(50, 99); // near bottom edge of sector A
    const serialized = migrateAgent(agent, SECTOR_A_BOUNDS, SECTOR_C_BOUNDS, 'bottom');

    // Global position: (0 + 50, 0 + 99) = (50, 99)
    // In sector C (originY=100): localY = 99 - 100 = -1, clamped to 0.5
    expect(serialized.position.x).toBeCloseTo(50, 1);
    expect(serialized.position.y).toBeCloseTo(0.5, 1);
  });

  it('preserves agent DNA through migration', () => {
    const agent = createAgent(99, 50);
    agent.vector = { analytical_emotional: 0.7, altruistic_selfish: 0.3, order_chaos: 0.8 };
    agent.faction = 'void';
    agent.loreCache = ['memory-1', 'memory-2'];
    agent.lingo = { term1: 'meaning1' };

    const serialized = migrateAgent(agent, SECTOR_A_BOUNDS, SECTOR_B_BOUNDS, 'right');

    expect(serialized.vector).toEqual(agent.vector);
    expect(serialized.faction).toBe('void');
    expect(serialized.loreCache).toEqual(['memory-1', 'memory-2']);
    expect(serialized.lingo).toEqual({ term1: 'meaning1' });
    expect(serialized.energy).toBe(agent.energy);
  });
});

describe('receiveMigratedAgent', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('deserializes and clamps agent position to sector bounds', () => {
    const agent = createAgent(99, 50);
    const serialized = migrateAgent(agent, SECTOR_A_BOUNDS, SECTOR_B_BOUNDS, 'right');
    const received = receiveMigratedAgent(serialized, SECTOR_B_BOUNDS);

    // Position should be clamped inside sector B bounds
    expect(received.position.x).toBeGreaterThanOrEqual(0.5);
    expect(received.position.x).toBeLessThanOrEqual(SECTOR_B_BOUNDS.width - 0.5);
    expect(received.position.y).toBeGreaterThanOrEqual(0.5);
    expect(received.position.y).toBeLessThanOrEqual(SECTOR_B_BOUNDS.height - 0.5);
  });

  it('resets adjacency ticks for the new sector', () => {
    const agent = createAgent(99, 50);
    agent.adjacencyTicks.set('agent-99', 10);

    const serialized = migrateAgent(agent, SECTOR_A_BOUNDS, SECTOR_B_BOUNDS, 'right');
    const received = receiveMigratedAgent(serialized, SECTOR_B_BOUNDS);

    expect(received.adjacencyTicks.size).toBe(0);
  });

  it('preserves agent identity through round-trip', () => {
    const agent = createAgent(99, 50);
    agent.vector = { analytical_emotional: 0.5, altruistic_selfish: 0.5, order_chaos: 0.5 };
    agent.loreCache = ['entry1'];
    agent.lingo = { slang: 'cool' };
    agent.memory = [{ text: 'I remember', tick: 42, keywords: ['remember'] }];

    const serialized = migrateAgent(agent, SECTOR_A_BOUNDS, SECTOR_B_BOUNDS, 'right');
    const received = receiveMigratedAgent(serialized, SECTOR_B_BOUNDS);

    expect(received.id).toBe(agent.id);
    expect(received.vector).toEqual(agent.vector);
    expect(received.loreCache).toEqual(agent.loreCache);
    expect(received.lingo).toEqual(agent.lingo);
    expect(received.memory).toHaveLength(1);
    expect(received.memory[0].text).toBe('I remember');
    expect(received.memory[0].keywords).toEqual(['remember']);
    // adjacencyTicks is a Map (not Record)
    expect(received.adjacencyTicks).toBeInstanceOf(Map);
  });
});
