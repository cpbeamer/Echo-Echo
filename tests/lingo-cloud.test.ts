import { describe, it, expect, beforeEach } from 'vitest';
import { clusterAgents, extractLingoCloud, computeLingoClusters } from '../src/engine/lingo-cloud';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';

describe('clusterAgents', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('groups nearby agents into the same cluster', () => {
    const a = createAgent(5, 5);
    const b = createAgent(6, 6);
    const c = createAgent(7, 7); // all within radius 10

    const clusters = clusterAgents([a, b, c], 10);

    // All 3 agents fall in the same 10×10 bucket (bucket 0,0)
    expect(clusters).toHaveLength(1);
    expect(clusters[0].agents).toHaveLength(3);
  });

  it('separates distant agents into different clusters', () => {
    const a = createAgent(5, 5);
    const b = createAgent(6, 6);
    const c = createAgent(55, 55); // far away

    const clusters = clusterAgents([a, b, c], 10);

    // a,b in one bucket; c is alone (singleton, excluded)
    expect(clusters).toHaveLength(1);
    expect(clusters[0].agents).toHaveLength(2);
  });

  it('excludes singleton agents (clusters of size 1)', () => {
    const a = createAgent(5, 5);
    const b = createAgent(55, 55);
    const c = createAgent(95, 95);

    const clusters = clusterAgents([a, b, c], 10);

    expect(clusters).toHaveLength(0);
  });

  it('computes correct centroids', () => {
    const a = createAgent(10, 10);
    const b = createAgent(12, 14);

    const clusters = clusterAgents([a, b], 20);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].centroid.x).toBeCloseTo(11);
    expect(clusters[0].centroid.y).toBeCloseTo(12);
  });

  it('returns empty array for empty input', () => {
    expect(clusterAgents([], 10)).toHaveLength(0);
  });

  it('returns empty array for zero radius', () => {
    const a = createAgent(5, 5);
    expect(clusterAgents([a], 0)).toHaveLength(0);
  });
});

describe('extractLingoCloud', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('returns top-N terms sorted by frequency', () => {
    const a = createAgent(5, 5);
    const b = createAgent(6, 6);
    const c = createAgent(7, 7);

    a.lingo = { 'Sec-Jedi': 'A leader', 'common': 'shared' };
    b.lingo = { 'Void-Born': 'A nihilist', 'common': 'shared' };
    c.lingo = { 'common': 'shared', 'rare': 'unique' };

    const cloud = extractLingoCloud([a, b, c], 3);

    expect(cloud).toHaveLength(3);
    // "common" appears in all 3 agents → highest count
    expect(cloud[0].term).toBe('common');
    expect(cloud[0].count).toBe(3);
  });

  it('returns empty for agents with no lingo', () => {
    const a = createAgent(5, 5);
    a.lingo = {};

    const cloud = extractLingoCloud([a], 10);

    expect(cloud).toHaveLength(0);
  });

  it('respects the topN limit', () => {
    const a = createAgent(5, 5);
    a.lingo = { 'a': '1', 'b': '2', 'c': '3', 'd': '4', 'e': '5' };

    const cloud = extractLingoCloud([a], 2);

    expect(cloud).toHaveLength(2);
  });
});

describe('computeLingoClusters', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('returns LingoCluster objects with centroid, agentCount, and terms', () => {
    const a = createAgent(5, 5);
    const b = createAgent(6, 6);

    a.lingo = { 'term-a': 'meaning-a' };
    b.lingo = { 'term-a': 'meaning-a', 'term-b': 'meaning-b' };

    const clusters = computeLingoClusters([a, b], 10, 5);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].agentCount).toBe(2);
    expect(clusters[0].terms[0].term).toBe('term-a');
    expect(clusters[0].terms[0].count).toBe(2);
    expect(clusters[0].centroid).toBeDefined();
  });
});
