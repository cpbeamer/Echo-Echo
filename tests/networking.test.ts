import { describe, it, expect, beforeEach } from 'vitest';
import { SectorHost, serializeFullState } from '../src/engine/sector-host';
import { SectorVisitor } from '../src/engine/sector-visitor';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';
import { serializeAgent, deserializeAgent } from '../src/engine/state-sync';

describe('SectorHost', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('computes a diff between snapshots', () => {
    const host = new SectorHost({ syncTickRate: 1, maxVisitors: 8 });

    const agents = [createAgent(10, 10), createAgent(20, 20)];
    host.initializeSnapshot(agents);

    // Mutate agent-0 position
    agents[0].position = { x: 15, y: 25 };

    const diff = host.computeDiff(agents, 1);

    expect(diff.tick).toBe(1);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].id).toBe('agent-0');
    expect(diff.changed[0].position).toEqual({ x: 15, y: 25 });
  });

  it('detects newly added agents in diff', () => {
    const host = new SectorHost({ syncTickRate: 1, maxVisitors: 8 });

    const agents = [createAgent(10, 10)];
    host.initializeSnapshot(agents);

    // Add a new agent
    agents.push(createAgent(30, 30));

    const diff = host.computeDiff(agents, 2);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].id).toBe('agent-1');
  });

  it('detects removed agents in diff', () => {
    const host = new SectorHost({ syncTickRate: 1, maxVisitors: 8 });

    const agents = [createAgent(10, 10), createAgent(20, 20)];
    host.initializeSnapshot(agents);

    // Remove agent-1
    agents.splice(1, 1);

    const diff = host.computeDiff(agents, 3);

    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]).toBe('agent-1');
  });

  it('processes a remote data bomb', () => {
    const host = new SectorHost({ syncTickRate: 1, maxVisitors: 8 });

    const agents = [createAgent(50, 50), createAgent(50, 51), createAgent(99, 99)];

    const originalVector = { ...agents[0].vector };

    const affectedIds = host.processRemoteBomb(agents, {
      text: 'Order is paramount and must be maintained through discipline',
      target: { x: 50, y: 50 },
      radius: 5,
      type: 'standard',
    });

    // Agents near (50,50) should be affected
    expect(affectedIds).toContain('agent-0');
    expect(affectedIds).toContain('agent-1');
    expect(affectedIds).not.toContain('agent-2');

    // DNA should have shifted
    expect(agents[0].vector.order_chaos).not.toBe(originalVector.order_chaos);
  });

  it('resets state when leaving host role', () => {
    const host = new SectorHost({ syncTickRate: 1, maxVisitors: 8 });

    const agents = [createAgent(10, 10)];
    host.initializeSnapshot(agents);

    host.reset();

    // After reset, diff should treat all agents as "added" since prev is empty
    const diff = host.computeDiff(agents, 0);
    expect(diff.added).toHaveLength(1);
  });
});

describe('SectorVisitor', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('applies a full state snapshot', () => {
    const visitor = new SectorVisitor('peer-abc');

    const agents = [createAgent(10, 10), createAgent(20, 20)];
    const fullDiff = serializeFullState(agents, 0);

    const result = visitor.applyFullState(fullDiff);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('agent-0');
    expect(result[1].id).toBe('agent-1');
    // Deserialized agents should have Map, not Record
    expect(result[0].adjacencyTicks).toBeInstanceOf(Map);
  });

  it('applies a partial diff', () => {
    const visitor = new SectorVisitor('peer-abc');

    const agents = [createAgent(10, 10), createAgent(20, 20)];

    const updated = visitor.applyDiff(agents, {
      tick: 5,
      added: [],
      removed: ['agent-1'],
      changed: [{ id: 'agent-0', energy: 0.33 }],
    });

    expect(updated).toHaveLength(1);
    expect(updated[0].energy).toBe(0.33);
  });

  it('creates a remote data bomb request with sender ID', () => {
    const visitor = new SectorVisitor('peer-xyz');

    const bomb = visitor.createBombRequest({
      text: 'some payload',
      target: { x: 50, y: 50 },
      radius: 5,
      type: 'standard',
    });

    expect(bomb.senderPeerId).toBe('peer-xyz');
    expect(bomb.text).toBe('some payload');
    expect(bomb.target).toEqual({ x: 50, y: 50 });
  });

  it('updates peer ID on reconnection', () => {
    const visitor = new SectorVisitor('peer-old');
    visitor.updatePeerId('peer-new');

    const bomb = visitor.createBombRequest({
      text: 'test',
      target: { x: 0, y: 0 },
      radius: 1,
      type: 'standard',
    });

    expect(bomb.senderPeerId).toBe('peer-new');
  });
});

describe('serializeFullState', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('creates a diff with all agents in the added field', () => {
    const agents = [createAgent(10, 10), createAgent(20, 20)];
    const diff = serializeFullState(agents, 42);

    expect(diff.tick).toBe(42);
    expect(diff.added).toHaveLength(2);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
    expect(diff.added[0].id).toBe('agent-0');
    expect(diff.added[1].id).toBe('agent-1');
  });
});
