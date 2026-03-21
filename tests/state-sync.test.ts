import { describe, it, expect, beforeEach } from 'vitest';
import {
  serializeAgent,
  deserializeAgent,
  computeStateDiff,
  applyStateDiff,
} from '../src/engine/state-sync';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';

describe('serializeAgent / deserializeAgent', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('round-trips an agent through serialize/deserialize', () => {
    const agent = createAgent(10, 20);
    agent.loreCache = ['entry-1', 'entry-2'];
    agent.lingo = { sec: 'security', jedi: 'force user' };
    agent.adjacencyTicks.set('agent-99', 5);
    agent.memory = [{ text: 'saw conflict', tick: 10, keywords: ['conflict'] }];

    const serialized = serializeAgent(agent);
    const deserialized = deserializeAgent(serialized);

    expect(deserialized.id).toBe(agent.id);
    expect(deserialized.vector).toEqual(agent.vector);
    expect(deserialized.position).toEqual(agent.position);
    expect(deserialized.velocity).toEqual(agent.velocity);
    expect(deserialized.energy).toBe(agent.energy);
    expect(deserialized.faction).toBe(agent.faction);
    expect(deserialized.loreCache).toEqual(agent.loreCache);
    expect(deserialized.lingo).toEqual(agent.lingo);
    expect(deserialized.color).toBe(agent.color);
    expect(deserialized.radius).toBe(agent.radius);
    expect(deserialized.deathFrame).toBe(agent.deathFrame);
    expect(deserialized.parentIds).toEqual(agent.parentIds);
    expect(deserialized.lastReproductionTick).toBe(agent.lastReproductionTick);
    expect(deserialized.memory).toEqual(agent.memory);

    // Map → Record → Map
    expect(deserialized.adjacencyTicks).toBeInstanceOf(Map);
    expect(deserialized.adjacencyTicks.get('agent-99')).toBe(5);
  });

  it('serializes adjacencyTicks Map as a plain Record', () => {
    const agent = createAgent(0, 0);
    agent.adjacencyTicks.set('a', 1);
    agent.adjacencyTicks.set('b', 2);

    const serialized = serializeAgent(agent);

    // Should be a plain object, not a Map
    expect(serialized.adjacencyTicks).toEqual({ a: 1, b: 2 });
    expect(serialized.adjacencyTicks).not.toBeInstanceOf(Map);
  });

  it('handles null parentIds correctly', () => {
    const agent = createAgent(0, 0);
    agent.parentIds = null;

    const roundTripped = deserializeAgent(serializeAgent(agent));
    expect(roundTripped.parentIds).toBeNull();
  });

  it('handles non-null parentIds correctly', () => {
    const agent = createAgent(0, 0);
    agent.parentIds = ['parent-a', 'parent-b'];

    const roundTripped = deserializeAgent(serializeAgent(agent));
    expect(roundTripped.parentIds).toEqual(['parent-a', 'parent-b']);
  });
});

describe('computeStateDiff', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('produces an empty diff when states are identical', () => {
    const agents = [createAgent(10, 10), createAgent(20, 20)];

    // Clone for prev snapshot (identical data)
    const prevSnapshot = agents.map((a) => ({
      ...a,
      vector: { ...a.vector },
      position: { ...a.position },
      velocity: { ...a.velocity },
      loreCache: [...a.loreCache],
      lingo: { ...a.lingo },
      adjacencyTicks: new Map(a.adjacencyTicks),
      parentIds: a.parentIds ? ([...a.parentIds] as [string, string]) : null,
      memory: a.memory.map((m) => ({ ...m, keywords: [...m.keywords] })),
    }));

    const diff = computeStateDiff(prevSnapshot, agents, 42);

    expect(diff.tick).toBe(42);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it('detects added agents', () => {
    const prev = [createAgent(10, 10)];
    resetAgentIdCounter();
    const curr = [createAgent(10, 10), createAgent(30, 30)];

    const diff = computeStateDiff(prev, curr, 1);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].id).toBe('agent-1');
  });

  it('detects removed agents', () => {
    const agents = [createAgent(10, 10), createAgent(20, 20)];
    const curr = [agents[0]]; // agent-1 removed

    const diff = computeStateDiff(agents, curr, 1);

    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]).toBe('agent-1');
  });

  it('detects changed agent position', () => {
    const prev = [createAgent(10, 10)];
    resetAgentIdCounter();
    const curr = [createAgent(10, 10)];
    curr[0].position = { x: 15, y: 25 };

    const diff = computeStateDiff(prev, curr, 1);

    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].id).toBe('agent-0');
    expect(diff.changed[0].position).toEqual({ x: 15, y: 25 });
  });

  it('detects changed agent energy', () => {
    const prev = [createAgent(10, 10)];
    resetAgentIdCounter();
    const curr = [createAgent(10, 10)];
    curr[0].energy = 0.5;

    const diff = computeStateDiff(prev, curr, 1);

    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].energy).toBe(0.5);
  });

  it('detects changed faction', () => {
    const prev = [createAgent(10, 10)];
    resetAgentIdCounter();
    const curr = [createAgent(10, 10)];
    // Ensure faction differs from prev by choosing one guaranteed to be different
    const newFaction = prev[0].faction === 'void' ? 'hive' : 'void';
    curr[0].faction = newFaction;

    const diff = computeStateDiff(prev, curr, 1);

    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].faction).toBe(newFaction);
  });

  it('detects changed lingo', () => {
    const prev = [createAgent(10, 10)];
    resetAgentIdCounter();
    const curr = [createAgent(10, 10)];
    curr[0].lingo = { newTerm: 'meaning' };

    const diff = computeStateDiff(prev, curr, 1);

    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].lingo).toEqual({ newTerm: 'meaning' });
  });
});

describe('applyStateDiff', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('removes agents listed in diff.removed', () => {
    const agents = [createAgent(10, 10), createAgent(20, 20)];

    const result = applyStateDiff(agents, {
      tick: 1,
      added: [],
      removed: ['agent-1'],
      changed: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('agent-0');
  });

  it('adds agents listed in diff.added', () => {
    const agents = [createAgent(10, 10)];
    const newAgent = serializeAgent(createAgent(30, 30));

    const result = applyStateDiff(agents, {
      tick: 1,
      added: [newAgent],
      removed: [],
      changed: [],
    });

    expect(result).toHaveLength(2);
    expect(result[1].id).toBe(newAgent.id);
  });

  it('patches agents listed in diff.changed', () => {
    const agents = [createAgent(10, 10)];

    const result = applyStateDiff(agents, {
      tick: 1,
      added: [],
      removed: [],
      changed: [{ id: 'agent-0', energy: 0.42, position: { x: 99, y: 99 } }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].energy).toBe(0.42);
    expect(result[0].position).toEqual({ x: 99, y: 99 });
  });

  it('handles combined add/remove/change in a single diff', () => {
    const agents = [createAgent(10, 10), createAgent(20, 20), createAgent(30, 30)];
    const newAgent = serializeAgent(createAgent(50, 50));

    const result = applyStateDiff(agents, {
      tick: 1,
      added: [newAgent],
      removed: ['agent-1'],
      changed: [{ id: 'agent-0', color: '#ff0000' }],
    });

    // agent-0 (patched) + agent-2 (untouched) + new agent = 3
    expect(result).toHaveLength(3);
    expect(result[0].color).toBe('#ff0000');
    expect(result.find((a) => a.id === 'agent-1')).toBeUndefined();
  });
});
