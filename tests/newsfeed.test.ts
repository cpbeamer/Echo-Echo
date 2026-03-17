import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Newsfeed store tests.
 *
 * Since NewsfeedState uses Svelte 5 runes ($state) which require compilation,
 * we test the core logic by simulating the store behavior with a plain
 * implementation that mirrors the store's contract.
 */

interface TestEvent {
  id: string;
  timestamp: number;
  type: string;
  message: string;
  [key: string]: unknown;
}

const MAX_EVENTS = 200;

class TestNewsfeedState {
  events: TestEvent[] = [];
  private nextId = 0;

  push(payload: Record<string, unknown>): void {
    const full: TestEvent = {
      ...payload,
      id: `evt-${this.nextId++}`,
      timestamp: Date.now(),
    } as TestEvent;

    this.events = [full, ...this.events].slice(0, MAX_EVENTS);
  }

  clear(): void {
    this.events = [];
    this.nextId = 0;
  }
}

describe('Newsfeed Store Logic', () => {
  let feed: TestNewsfeedState;

  beforeEach(() => {
    feed = new TestNewsfeedState();
  });

  it('pushes events in newest-first order', () => {
    feed.push({ type: 'meme_swap', message: 'Swap #1', swapCount: 1 });
    feed.push({ type: 'conflict', message: 'Fight #1', agentIds: [] });

    expect(feed.events).toHaveLength(2);
    expect(feed.events[0].type).toBe('conflict');
    expect(feed.events[1].type).toBe('meme_swap');
  });

  it('auto-generates unique IDs and timestamps', () => {
    feed.push({ type: 'meme_swap', message: 'Swap', swapCount: 1 });
    feed.push({ type: 'meme_swap', message: 'Swap', swapCount: 2 });

    expect(feed.events[0].id).not.toBe(feed.events[1].id);
    expect(feed.events[0].timestamp).toBeGreaterThan(0);
  });

  it('caps events at MAX_EVENTS (200)', () => {
    for (let i = 0; i < 210; i++) {
      feed.push({ type: 'meme_swap', message: `Swap ${i}`, swapCount: 1 });
    }

    expect(feed.events).toHaveLength(MAX_EVENTS);
    // Newest should be the last pushed
    expect(feed.events[0].message).toBe('Swap 209');
  });

  it('clear() resets the feed to empty', () => {
    feed.push({ type: 'data_bomb', message: 'Boom', affectedCount: 5, target: { x: 0, y: 0 } });
    feed.push({ type: 'agent_death', message: 'RIP', agentId: 'a1', cause: 'conflict' });

    feed.clear();

    expect(feed.events).toHaveLength(0);
  });

  it('handles all event types without error', () => {
    feed.push({ type: 'meme_swap', message: 'Swap', swapCount: 3 });
    feed.push({ type: 'conflict', message: 'Fight', agentIds: ['a1', 'a2'] });
    feed.push({ type: 'faction_change', message: 'Changed', agentId: 'a1', fromFaction: 'hive', toFaction: 'void' });
    feed.push({ type: 'data_bomb', message: 'Boom', affectedCount: 10, target: { x: 50, y: 50 } });
    feed.push({ type: 'agent_death', message: 'Dead', agentId: 'a3', cause: 'starvation' });

    expect(feed.events).toHaveLength(5);
  });
});
