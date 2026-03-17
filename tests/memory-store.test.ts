import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractKeywords,
  addMemory,
  retrieveRelevantMemories,
  clearMemory,
} from '../src/engine/memory-store';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';
import { DEFAULT_CONFIG } from '../src/types';

describe('extractKeywords', () => {
  it('lowercases and filters stop words', () => {
    const keywords = extractKeywords('The ORDER of chaos is a LAW of nature');
    expect(keywords).toContain('order');
    expect(keywords).toContain('chaos');
    expect(keywords).toContain('law');
    expect(keywords).toContain('nature');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('of');
    expect(keywords).not.toContain('is');
  });

  it('strips non-alpha characters', () => {
    const keywords = extractKeywords('agent-42 scored 0.85 on the test!');
    expect(keywords).toContain('agent');
    expect(keywords).toContain('scored');
    expect(keywords).toContain('test');
    // Digits and punctuation stripped
    expect(keywords).not.toContain('42');
    expect(keywords).not.toContain('0.85');
  });

  it('deduplicates keywords', () => {
    const keywords = extractKeywords('order order order chaos chaos');
    const orderCount = keywords.filter((k) => k === 'order').length;
    const chaosCount = keywords.filter((k) => k === 'chaos').length;
    expect(orderCount).toBe(1);
    expect(chaosCount).toBe(1);
  });

  it('filters words shorter than 3 characters', () => {
    const keywords = extractKeywords('an ox is by us');
    expect(keywords).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(extractKeywords('')).toHaveLength(0);
  });
});

describe('addMemory', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('adds a memory entry to the agent', () => {
    const agent = createAgent(50, 50);
    expect(agent.memory).toHaveLength(0);

    addMemory(agent, 'Learned about order and discipline', 10);

    expect(agent.memory).toHaveLength(1);
    expect(agent.memory[0].text).toBe('Learned about order and discipline');
    expect(agent.memory[0].tick).toBe(10);
    expect(agent.memory[0].keywords).toContain('learned');
    expect(agent.memory[0].keywords).toContain('order');
    expect(agent.memory[0].keywords).toContain('discipline');
  });

  it('caps memory at maxMemoryEntries', () => {
    const agent = createAgent(50, 50);
    const config = { ...DEFAULT_CONFIG, maxMemoryEntries: 3 };

    addMemory(agent, 'Memory one about chaos', 1, config);
    addMemory(agent, 'Memory two about order', 2, config);
    addMemory(agent, 'Memory three about freedom', 3, config);
    addMemory(agent, 'Memory four about rebellion', 4, config);

    expect(agent.memory).toHaveLength(3);
    // Oldest entry (1) should have been evicted
    expect(agent.memory[0].text).toBe('Memory two about order');
    expect(agent.memory[2].text).toBe('Memory four about rebellion');
  });

  it('skips entirely empty memories', () => {
    const agent = createAgent(50, 50);
    addMemory(agent, '', 5);
    expect(agent.memory).toHaveLength(0);
  });
});

describe('retrieveRelevantMemories', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('returns empty array when agent has no memories', () => {
    const agent = createAgent(50, 50);
    const result = retrieveRelevantMemories(agent, 'order chaos');
    expect(result).toHaveLength(0);
  });

  it('returns most relevant memories by keyword overlap', () => {
    const agent = createAgent(50, 50);
    addMemory(agent, 'Saw explosion and chaos everywhere', 1);
    addMemory(agent, 'Found peace and order in the structure', 2);
    addMemory(agent, 'Complete rebellion and chaos against order', 3);

    // Query about chaos should rank memories with "chaos" higher
    const result = retrieveRelevantMemories(agent, 'chaos rebellion', 2);

    expect(result).toHaveLength(2);
    // Memory 3 has both "chaos" and "rebellion" → best match
    expect(result[0].text).toContain('rebellion and chaos');
    // Memory 1 has "chaos" → second best
    expect(result[1].text).toContain('explosion and chaos');
  });

  it('returns most recent memories when context has no keywords', () => {
    const agent = createAgent(50, 50);
    addMemory(agent, 'Old memory about order', 1);
    addMemory(agent, 'New memory about chaos', 10);
    addMemory(agent, 'Newest memory about structure', 20);

    // Empty context triggers recency fallback
    const result = retrieveRelevantMemories(agent, '', 2);

    expect(result).toHaveLength(2);
    // Most recent last in the array, sliced from end
    expect(result[0].tick).toBe(10);
    expect(result[1].tick).toBe(20);
  });

  it('respects the topK limit', () => {
    const agent = createAgent(50, 50);
    for (let i = 0; i < 10; i++) {
      addMemory(agent, `Memory about chaos number ${i}`, i);
    }

    const result = retrieveRelevantMemories(agent, 'chaos memory', 3);
    expect(result).toHaveLength(3);
  });
});

describe('clearMemory', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('removes all memory entries', () => {
    const agent = createAgent(50, 50);
    addMemory(agent, 'Memory one', 1);
    addMemory(agent, 'Memory two', 2);
    expect(agent.memory).toHaveLength(2);

    clearMemory(agent);

    expect(agent.memory).toHaveLength(0);
  });
});
