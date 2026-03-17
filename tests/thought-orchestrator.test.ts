import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThoughtOrchestrator } from '../src/engine/thought-orchestrator';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';
import type { BrainSettings } from '../src/types/brain';

// Mock the ollama-client so tests don't need a real Ollama instance
vi.mock('../src/engine/ollama-client', () => ({
  detectOllama: vi.fn().mockResolvedValue(true),
  listModels: vi.fn().mockResolvedValue(['llama3.2:1b']),
  generateCompletion: vi.fn().mockResolvedValue(
    JSON.stringify({
      vectorDelta: { order_chaos: 0.05 },
      newLore: ['The agent thought about something.'],
      newLingo: { 'test-term': 'a test meaning' },
    }),
  ),
}));

// Mock the context-truncator to passthrough
vi.mock('../src/engine/context-truncator', () => ({
  truncateLoreCache: vi.fn().mockImplementation((loreCache: string[]) =>
    Promise.resolve(loreCache),
  ),
}));

const TEST_SETTINGS: BrainSettings = {
  ollamaModel: 'llama3.2:1b',
  maxConcurrency: 2,
  autoThink: false,
  tokenBudget: 512,
};

describe('ThoughtOrchestrator', () => {
  beforeEach(() => {
    resetAgentIdCounter();
    vi.clearAllMocks();
  });

  it('starts with an empty queue', () => {
    const orchestrator = new ThoughtOrchestrator(TEST_SETTINGS);

    expect(orchestrator.pendingCount).toBe(0);
    expect(orchestrator.processing).toBe(0);
    expect(orchestrator.isBusy).toBe(false);
  });

  it('enqueues agents correctly', () => {
    const orchestrator = new ThoughtOrchestrator(TEST_SETTINGS);
    const agent1 = createAgent(50, 50);
    const agent2 = createAgent(60, 60);

    orchestrator.enqueue(agent1, 'some text');
    orchestrator.enqueue(agent2, 'other text');

    expect(orchestrator.pendingCount).toBe(2);
  });

  it('prevents duplicate enqueues for the same agent', () => {
    const orchestrator = new ThoughtOrchestrator(TEST_SETTINGS);
    const agent = createAgent(50, 50);

    orchestrator.enqueue(agent, 'text 1');
    orchestrator.enqueue(agent, 'text 2');

    expect(orchestrator.pendingCount).toBe(1);
  });

  it('processes queue and applies DNA updates', async () => {
    const orchestrator = new ThoughtOrchestrator(TEST_SETTINGS);
    const agent = createAgent(50, 50);
    const originalOrderChaos = agent.vector.order_chaos;

    orchestrator.enqueue(agent, 'test data bomb');

    await orchestrator.processQueue();

    // The mock returns order_chaos: 0.05, so agent's vector should shift
    expect(agent.vector.order_chaos).toBeCloseTo(originalOrderChaos + 0.05);
    expect(orchestrator.pendingCount).toBe(0);
  });

  it('respects concurrency limits', async () => {
    const { generateCompletion } = await import('../src/engine/ollama-client');
    const mockGenerate = vi.mocked(generateCompletion);

    // Make the mock slow so we can observe concurrency
    let activeCalls = 0;
    let maxConcurrentCalls = 0;

    mockGenerate.mockImplementation(async () => {
      activeCalls++;
      maxConcurrentCalls = Math.max(maxConcurrentCalls, activeCalls);
      await new Promise((r) => setTimeout(r, 10));
      activeCalls--;
      return JSON.stringify({
        vectorDelta: {},
        newLore: ['Thought.'],
        newLingo: {},
      });
    });

    const orchestrator = new ThoughtOrchestrator({
      ...TEST_SETTINGS,
      maxConcurrency: 2,
    });

    // Enqueue more agents than the concurrency limit
    for (let i = 0; i < 5; i++) {
      orchestrator.enqueue(createAgent(i * 10, i * 10), `text ${i}`);
    }

    // Process once — should only take maxConcurrency items
    await orchestrator.processQueue();

    // The first batch should respect the limit
    expect(maxConcurrentCalls).toBeLessThanOrEqual(2);
  });

  it('does nothing when no model is configured', async () => {
    const noModelSettings: BrainSettings = {
      ...TEST_SETTINGS,
      ollamaModel: '',
    };
    const orchestrator = new ThoughtOrchestrator(noModelSettings);
    const agent = createAgent(50, 50);

    orchestrator.enqueue(agent, 'text');
    await orchestrator.processQueue();

    // Agent should still be in queue since processing was skipped
    expect(orchestrator.pendingCount).toBe(1);
  });

  it('clears the queue', () => {
    const orchestrator = new ThoughtOrchestrator(TEST_SETTINGS);
    orchestrator.enqueue(createAgent(50, 50), 'text');
    orchestrator.enqueue(createAgent(60, 60), 'text');

    orchestrator.clearQueue();

    expect(orchestrator.pendingCount).toBe(0);
  });
});
