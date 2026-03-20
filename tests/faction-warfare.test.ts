import { describe, it, expect, beforeEach } from 'vitest';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';
import type { Agent } from '../src/types/agent';
import type { ComputeBoost, ManifestoDefusal } from '../src/types/networking';
import {
  createInitialFactionProgress,
  computeFactionProgress,
  applyComputeBoost,
  startManifestoDefusal,
  contributeToDefusal,
  resolveDefusal,
  checkContestedSector,
} from '../src/engine/faction-warfare';
import { DEFAULT_FACTION_WARFARE_CONFIG } from '../src/types/networking';

/** Helper: create agents with a specific faction. */
function createFactionAgent(x: number, y: number, faction: Agent['faction']): Agent {
  const agent = createAgent(x, y);
  agent.faction = faction;
  return agent;
}

describe('createInitialFactionProgress', () => {
  it('creates progress entries for all four warfare factions', () => {
    const progress = createInitialFactionProgress();

    expect(progress).toHaveLength(4);
    expect(progress.map((p) => p.faction)).toEqual(['hive', 'void', 'citadel', 'fringe']);
    for (const p of progress) {
      expect(p.progress).toBe(0);
      expect(p.totalCompute).toBe(0);
      expect(p.agentCount).toBe(0);
    }
  });
});

describe('computeFactionProgress', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('increments progress based on agent count per faction', () => {
    const agents = [
      createFactionAgent(10, 10, 'hive'),
      createFactionAgent(20, 20, 'hive'),
      createFactionAgent(30, 30, 'void'),
    ];

    const current = createInitialFactionProgress();
    const updated = computeFactionProgress(agents, current, []);

    const hive = updated.find((p) => p.faction === 'hive')!;
    const voidFaction = updated.find((p) => p.faction === 'void')!;
    const citadel = updated.find((p) => p.faction === 'citadel')!;

    // 2 hive agents × 0.001 = 0.002
    expect(hive.progress).toBeCloseTo(0.002);
    expect(hive.agentCount).toBe(2);
    // 1 void agent × 0.001 = 0.001
    expect(voidFaction.progress).toBeCloseTo(0.001);
    expect(voidFaction.agentCount).toBe(1);
    // no citadel agents
    expect(citadel.progress).toBe(0);
    expect(citadel.agentCount).toBe(0);
  });

  it('excludes dead and unaligned agents', () => {
    const agents = [
      createFactionAgent(10, 10, 'hive'),
      createFactionAgent(20, 20, 'unaligned'),
    ];
    // Kill the first agent
    agents[0].energy = 0;

    const current = createInitialFactionProgress();
    const updated = computeFactionProgress(agents, current, []);

    for (const p of updated) {
      expect(p.progress).toBe(0);
      expect(p.agentCount).toBe(0);
    }
  });

  it('caps progress at 1.0', () => {
    const agents = [createFactionAgent(10, 10, 'hive')];
    const current = createInitialFactionProgress().map((p) =>
      p.faction === 'hive' ? { ...p, progress: 0.9999 } : p,
    );

    const updated = computeFactionProgress(agents, current, []);
    const hive = updated.find((p) => p.faction === 'hive')!;

    expect(hive.progress).toBeLessThanOrEqual(1.0);
  });

  it('includes compute boost bonus in progress', () => {
    const agents = [createFactionAgent(10, 10, 'hive')];
    const boosts: ComputeBoost[] = [
      { peerId: 'peer-1', faction: 'hive', computeUnits: 10 },
    ];

    const current = createInitialFactionProgress();
    const updated = computeFactionProgress(agents, current, boosts);

    const hive = updated.find((p) => p.faction === 'hive')!;
    // 1 agent × 0.001 + 10 compute × 0.001 × 1.5 = 0.001 + 0.015 = 0.016
    expect(hive.progress).toBeCloseTo(0.016);
    expect(hive.totalCompute).toBe(10);
  });
});

describe('applyComputeBoost', () => {
  it('returns baseline 1.0 for all factions when no boosts exist', () => {
    const priorityMap = applyComputeBoost([]);

    expect(priorityMap.get('hive')).toBe(1);
    expect(priorityMap.get('void')).toBe(1);
    expect(priorityMap.get('citadel')).toBe(1);
    expect(priorityMap.get('fringe')).toBe(1);
  });

  it('scales factions proportionally to donated compute', () => {
    const boosts: ComputeBoost[] = [
      { peerId: 'peer-1', faction: 'hive', computeUnits: 100 },
      { peerId: 'peer-2', faction: 'void', computeUnits: 50 },
    ];

    const priorityMap = applyComputeBoost(boosts);

    // Hive has max compute → gets full multiplier (1.5)
    expect(priorityMap.get('hive')).toBeCloseTo(1.5);
    // Void has 50/100 ratio → multiplier = 1 + 0.5 × 0.5 = 1.25
    expect(priorityMap.get('void')).toBeCloseTo(1.25);
    // Citadel/Fringe untouched → baseline 1.0
    expect(priorityMap.get('citadel')).toBe(1);
    expect(priorityMap.get('fringe')).toBe(1);
  });

  it('uses custom config multiplier', () => {
    const boosts: ComputeBoost[] = [
      { peerId: 'peer-1', faction: 'citadel', computeUnits: 100 },
    ];

    const priorityMap = applyComputeBoost(boosts, {
      ...DEFAULT_FACTION_WARFARE_CONFIG,
      computeBoostMultiplier: 3.0,
    });

    // citadel at max → multiplier = 3.0
    expect(priorityMap.get('citadel')).toBeCloseTo(3.0);
  });
});

describe('startManifestoDefusal', () => {
  it('creates a defusal with correct initial state', () => {
    const defusal = startManifestoDefusal('bomb-42', 'sector-a', 'hive');

    expect(defusal.bombId).toBe('bomb-42');
    expect(defusal.sectorId).toBe('sector-a');
    expect(defusal.targetFaction).toBe('hive');
    expect(defusal.defuseProgress).toBe(0);
    expect(defusal.requiredCompute).toBe(DEFAULT_FACTION_WARFARE_CONFIG.defusalComputeThreshold);
    expect(defusal.contributedCompute).toBe(0);
    expect(defusal.contributors).toEqual({});
  });
});

describe('contributeToDefusal', () => {
  let defusal: ManifestoDefusal;

  beforeEach(() => {
    defusal = startManifestoDefusal('bomb-1', 'sector-x', 'hive');
  });

  it('allows opposing faction to contribute', () => {
    const complete = contributeToDefusal(defusal, 'peer-a', 'void', 30);

    expect(complete).toBe(false);
    expect(defusal.contributedCompute).toBe(30);
    expect(defusal.defuseProgress).toBeCloseTo(0.3);
    expect(defusal.contributors['peer-a']).toBe(30);
  });

  it('rejects contributions from the target faction', () => {
    const complete = contributeToDefusal(defusal, 'peer-a', 'hive', 50);

    expect(complete).toBe(false);
    expect(defusal.contributedCompute).toBe(0);
    expect(defusal.defuseProgress).toBe(0);
  });

  it('rejects contributions from unaligned peers', () => {
    const complete = contributeToDefusal(defusal, 'peer-a', 'unaligned', 50);

    expect(complete).toBe(false);
    expect(defusal.contributedCompute).toBe(0);
  });

  it('returns true when defusal is complete', () => {
    contributeToDefusal(defusal, 'peer-a', 'void', 60);
    const complete = contributeToDefusal(defusal, 'peer-b', 'citadel', 40);

    expect(complete).toBe(true);
    expect(defusal.defuseProgress).toBe(1);
    expect(defusal.contributedCompute).toBe(100);
  });

  it('accumulates contributions from the same peer', () => {
    contributeToDefusal(defusal, 'peer-a', 'void', 20);
    contributeToDefusal(defusal, 'peer-a', 'void', 30);

    expect(defusal.contributors['peer-a']).toBe(50);
    expect(defusal.contributedCompute).toBe(50);
  });

  it('caps progress at 1.0 even with excess compute', () => {
    contributeToDefusal(defusal, 'peer-a', 'void', 200);

    expect(defusal.defuseProgress).toBe(1);
  });
});

describe('resolveDefusal', () => {
  it('returns true for completed defusals', () => {
    const defusal = startManifestoDefusal('bomb-1', 'sector-x', 'hive');
    contributeToDefusal(defusal, 'peer-a', 'void', 100);

    expect(resolveDefusal(defusal)).toBe(true);
  });

  it('returns false for incomplete defusals', () => {
    const defusal = startManifestoDefusal('bomb-1', 'sector-x', 'hive');
    contributeToDefusal(defusal, 'peer-a', 'void', 50);

    expect(resolveDefusal(defusal)).toBe(false);
  });
});

describe('checkContestedSector', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('returns true when ≥2 factions each have ≥5 agents', () => {
    const agents: Agent[] = [];
    for (let i = 0; i < 5; i++) {
      agents.push(createFactionAgent(i, 0, 'hive'));
    }
    for (let i = 0; i < 5; i++) {
      agents.push(createFactionAgent(i, 10, 'void'));
    }

    expect(checkContestedSector(agents)).toBe(true);
  });

  it('returns false when only one faction has ≥5 agents', () => {
    const agents: Agent[] = [];
    for (let i = 0; i < 10; i++) {
      agents.push(createFactionAgent(i, 0, 'hive'));
    }
    for (let i = 0; i < 3; i++) {
      agents.push(createFactionAgent(i, 10, 'void'));
    }

    expect(checkContestedSector(agents)).toBe(false);
  });

  it('excludes dead agents from the count', () => {
    const agents: Agent[] = [];
    for (let i = 0; i < 5; i++) {
      agents.push(createFactionAgent(i, 0, 'hive'));
    }
    for (let i = 0; i < 5; i++) {
      const a = createFactionAgent(i, 10, 'void');
      a.energy = 0; // dead
      agents.push(a);
    }

    expect(checkContestedSector(agents)).toBe(false);
  });

  it('excludes unaligned agents', () => {
    const agents: Agent[] = [];
    for (let i = 0; i < 5; i++) {
      agents.push(createFactionAgent(i, 0, 'hive'));
    }
    for (let i = 0; i < 5; i++) {
      agents.push(createFactionAgent(i, 10, 'unaligned'));
    }

    expect(checkContestedSector(agents)).toBe(false);
  });

  it('returns true with three factions above threshold', () => {
    const agents: Agent[] = [];
    for (let i = 0; i < 5; i++) {
      agents.push(createFactionAgent(i, 0, 'hive'));
    }
    for (let i = 0; i < 5; i++) {
      agents.push(createFactionAgent(i, 10, 'void'));
    }
    for (let i = 0; i < 5; i++) {
      agents.push(createFactionAgent(i, 20, 'citadel'));
    }

    expect(checkContestedSector(agents)).toBe(true);
  });
});
