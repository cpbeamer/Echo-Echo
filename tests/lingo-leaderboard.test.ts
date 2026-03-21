import { describe, it, expect, beforeEach } from 'vitest';
import { computeLingoLeaderboard } from '../src/engine/lingo-leaderboard';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';
import type { LingoLeaderboardEntry } from '../src/types/hud';

describe('computeLingoLeaderboard', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('returns entries sorted by count descending', () => {
    const a = createAgent(5, 5);
    const b = createAgent(6, 6);
    const c = createAgent(7, 7);

    a.lingo = { 'Sec-Jedi': 'A leader', common: 'shared' };
    b.lingo = { 'Void-Born': 'A nihilist', common: 'shared' };
    c.lingo = { common: 'shared', rare: 'unique', 'Void-Born': 'loner' };

    const leaderboard = computeLingoLeaderboard([a, b, c]);

    expect(leaderboard[0].term).toBe('common');
    expect(leaderboard[0].count).toBe(3);
    expect(leaderboard[1].term).toBe('Void-Born');
    expect(leaderboard[1].count).toBe(2);
  });

  it('respects the topN limit', () => {
    const a = createAgent(5, 5);
    a.lingo = { a: '1', b: '2', c: '3', d: '4', e: '5' };

    const leaderboard = computeLingoLeaderboard([a], [], 3);

    expect(leaderboard).toHaveLength(3);
  });

  it('returns empty leaderboard for agents with no lingo', () => {
    const a = createAgent(5, 5);
    a.lingo = {};

    const leaderboard = computeLingoLeaderboard([a]);

    expect(leaderboard).toHaveLength(0);
  });

  it('returns empty leaderboard for empty agent array', () => {
    const leaderboard = computeLingoLeaderboard([]);

    expect(leaderboard).toHaveLength(0);
  });

  it('detects trend "up" for new terms not in previous leaderboard', () => {
    const a = createAgent(5, 5);
    a.lingo = { NewTerm: 'brand new' };

    const leaderboard = computeLingoLeaderboard([a], []);

    expect(leaderboard[0].trend).toBe('up');
  });

  it('detects trend "stable" when term stays at same rank', () => {
    const a = createAgent(5, 5);
    const b = createAgent(6, 6);
    a.lingo = { Alpha: 'first' };
    b.lingo = { Alpha: 'first' };

    const previous: LingoLeaderboardEntry[] = [
      { term: 'Alpha', meaning: 'first', count: 1, trend: 'up' },
    ];

    const leaderboard = computeLingoLeaderboard([a, b], previous);

    expect(leaderboard[0].term).toBe('Alpha');
    expect(leaderboard[0].trend).toBe('stable');
  });

  it('detects trend "down" when term drops in rank', () => {
    const a = createAgent(5, 5);
    const b = createAgent(6, 6);
    const c = createAgent(7, 7);

    a.lingo = { Alpha: 'first', Beta: 'second' };
    b.lingo = { Beta: 'second' };
    c.lingo = { Beta: 'second' };

    // Alpha was #0 previously, now Beta is #0 and Alpha is #1
    const previous: LingoLeaderboardEntry[] = [
      { term: 'Alpha', meaning: 'first', count: 2, trend: 'stable' },
      { term: 'Beta', meaning: 'second', count: 1, trend: 'up' },
    ];

    const leaderboard = computeLingoLeaderboard([a, b, c], previous);

    // Beta should be #0 (count 3), Alpha should be #1 (count 1)
    expect(leaderboard[0].term).toBe('Beta');
    expect(leaderboard[0].trend).toBe('up'); // moved up from #1 to #0
    expect(leaderboard[1].term).toBe('Alpha');
    expect(leaderboard[1].trend).toBe('down'); // moved down from #0 to #1
  });

  it('includes the meaning from the first agent encountered', () => {
    const a = createAgent(5, 5);
    const b = createAgent(6, 6);

    a.lingo = { Shared: 'meaning-a' };
    b.lingo = { Shared: 'meaning-b' };

    const leaderboard = computeLingoLeaderboard([a, b]);

    // First agent's meaning is kept
    expect(leaderboard[0].meaning).toBe('meaning-a');
  });
});
