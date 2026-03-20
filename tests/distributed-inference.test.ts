import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';
import { ThoughtOrchestrator } from '../src/engine/thought-orchestrator';
import {
  classifyInferenceRequest,
  selectInferencePeer,
  distributeRequests,
  computePeerLoad,
} from '../src/engine/inference-load-balancer';
import type { BrainSettings } from '../src/types/brain';
import type { PeerCapability, DistributedInferenceConfig } from '../src/types/networking';

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

// Mock the petals-client
vi.mock('../src/engine/petals-client', () => ({
  connectToPetalsSwarm: vi.fn().mockResolvedValue(true),
  disconnectFromPetalsSwarm: vi.fn().mockResolvedValue(undefined),
  generateDistributed: vi.fn().mockResolvedValue(
    JSON.stringify({
      vectorDelta: { order_chaos: 0.1 },
      newLore: ['God Mode insight from the 70B model.'],
      newLingo: { 'deep-term': 'a profound meaning' },
    }),
  ),
  reportCapability: vi.fn().mockResolvedValue(undefined),
  getPeerCapabilities: vi.fn().mockResolvedValue([]),
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

const TEST_DISTRIBUTED_CONFIG: DistributedInferenceConfig = {
  godModeModel: 'llama3.3:70b',
  standardModel: 'llama3.2:1b',
  maxDistributedConcurrency: 4,
  capacityPollIntervalMs: 5000,
};

const TEST_CAPABILITIES: PeerCapability[] = [
  { peerId: 'peer-a', vramMb: 8192, layersHosted: 10, available: true },
  { peerId: 'peer-b', vramMb: 16384, layersHosted: 20, available: true },
  { peerId: 'peer-c', vramMb: 4096, layersHosted: 5, available: false },
];

// ── Inference Load Balancer ─────────────────────────────────────────────────

describe('classifyInferenceRequest', () => {
  it('returns standard priority by default', () => {
    const req = classifyInferenceRequest('agent-0', 'some prompt', false);

    expect(req.priority).toBe('standard');
    expect(req.agentId).toBe('agent-0');
    expect(req.prompt).toBe('some prompt');
  });

  it('returns critical priority when isCriticalEvent is true', () => {
    const req = classifyInferenceRequest('agent-1', 'war prompt', true);

    expect(req.priority).toBe('critical');
  });
});

describe('selectInferencePeer', () => {
  it('returns local when no peers have capacity', () => {
    const result = selectInferencePeer(
      { agentId: 'a', prompt: 'p', priority: 'standard' },
      [],
    );

    expect(result).toBe('local');
  });

  it('returns local when all peers are unavailable', () => {
    const unavailable: PeerCapability[] = [
      { peerId: 'peer-x', vramMb: 8192, layersHosted: 10, available: false },
    ];

    const result = selectInferencePeer(
      { agentId: 'a', prompt: 'p', priority: 'standard' },
      unavailable,
    );

    expect(result).toBe('local');
  });

  it('picks the peer with highest available VRAM', () => {
    const result = selectInferencePeer(
      { agentId: 'a', prompt: 'p', priority: 'standard' },
      TEST_CAPABILITIES,
    );

    // peer-b has 16384 MB, peer-a has 8192 MB, peer-c is unavailable
    expect(result).toBe('peer-b');
  });

  it('considers current load when selecting a peer', () => {
    const loadMap = new Map([['peer-b', 0.95]]);

    const result = selectInferencePeer(
      { agentId: 'a', prompt: 'p', priority: 'standard' },
      TEST_CAPABILITIES,
      loadMap,
    );

    // peer-b is heavily loaded, so peer-a should be preferred
    expect(result).toBe('peer-a');
  });
});

describe('distributeRequests', () => {
  it('sends all requests to local when no peers are available', () => {
    const requests = [
      { agentId: 'a1', prompt: 'p1', priority: 'standard' as const },
      { agentId: 'a2', prompt: 'p2', priority: 'standard' as const },
    ];

    const result = distributeRequests(requests, []);

    expect(result.get('local')).toHaveLength(2);
    expect(result.size).toBe(1);
  });

  it('assigns requests proportionally to GPU capacity', () => {
    const available: PeerCapability[] = [
      { peerId: 'peer-big', vramMb: 16384, layersHosted: 20, available: true },
      { peerId: 'peer-small', vramMb: 8192, layersHosted: 10, available: true },
    ];

    const requests = Array.from({ length: 9 }, (_, i) => ({
      agentId: `a${i}`,
      prompt: `p${i}`,
      priority: 'standard' as const,
    }));

    const result = distributeRequests(requests, available);

    const bigCount = result.get('peer-big')?.length ?? 0;
    const smallCount = result.get('peer-small')?.length ?? 0;

    // peer-big has 2× VRAM, so should get roughly 2× requests
    expect(bigCount).toBeGreaterThan(smallCount);
    expect(bigCount + smallCount).toBe(9);
  });

  it('handles a single peer correctly', () => {
    const caps: PeerCapability[] = [
      { peerId: 'peer-only', vramMb: 8192, layersHosted: 10, available: true },
    ];

    const requests = [
      { agentId: 'a1', prompt: 'p1', priority: 'standard' as const },
      { agentId: 'a2', prompt: 'p2', priority: 'standard' as const },
    ];

    const result = distributeRequests(requests, caps);

    expect(result.get('peer-only')).toHaveLength(2);
  });
});

describe('computePeerLoad', () => {
  it('returns correct load ratios', () => {
    const caps: PeerCapability[] = [
      { peerId: 'peer-a', vramMb: 5000, layersHosted: 5, available: true },
      { peerId: 'peer-b', vramMb: 5000, layersHosted: 5, available: true },
    ];
    const active = new Map([['peer-a', 3]]);

    const loadMap = computePeerLoad(caps, active);

    // peer-a has load, peer-b has none
    expect(loadMap.get('peer-a')).toBeGreaterThan(0);
    expect(loadMap.get('peer-b')).toBe(0);
  });

  it('returns empty map when no peers are available', () => {
    const loadMap = computePeerLoad([], new Map());

    expect(loadMap.size).toBe(0);
  });
});

// ── Thought Orchestrator (Distributed Path) ─────────────────────────────────

describe('ThoughtOrchestrator – distributed inference', () => {
  beforeEach(() => {
    resetAgentIdCounter();
    vi.clearAllMocks();
  });

  it('falls through to local Ollama when no distributed config is set', async () => {
    const orchestrator = new ThoughtOrchestrator(TEST_SETTINGS);
    const agent = createAgent(50, 50);
    const originalOrderChaos = agent.vector.order_chaos;

    orchestrator.enqueue(agent, 'test data bomb');
    await orchestrator.processQueue();

    // Should use local Ollama mock (0.05 delta)
    expect(agent.vector.order_chaos).toBeCloseTo(originalOrderChaos + 0.05);
  });

  it('routes critical requests to distributed model when God Mode is configured', async () => {
    const { generateDistributed } = await import('../src/engine/petals-client');
    const mockDistributed = vi.mocked(generateDistributed);

    const orchestrator = new ThoughtOrchestrator(TEST_SETTINGS, TEST_DISTRIBUTED_CONFIG);
    orchestrator.updatePeerCapabilities([
      { peerId: 'peer-a', vramMb: 8192, layersHosted: 10, available: true },
    ]);

    const agent = createAgent(50, 50);
    orchestrator.enqueue(agent, 'faction war event', true);
    await orchestrator.processQueue();

    // Should have called generateDistributed for the critical request
    expect(mockDistributed).toHaveBeenCalled();
    const callArgs = mockDistributed.mock.calls[0];
    expect(callArgs[0]).toBe('llama3.3:70b');
  });

  it('distributes standard requests to remote peers when capacity is available', async () => {
    const { generateDistributed } = await import('../src/engine/petals-client');
    const mockDistributed = vi.mocked(generateDistributed);

    const orchestrator = new ThoughtOrchestrator(TEST_SETTINGS, TEST_DISTRIBUTED_CONFIG);
    orchestrator.updatePeerCapabilities([
      { peerId: 'peer-a', vramMb: 8192, layersHosted: 10, available: true },
    ]);

    const agent = createAgent(50, 50);
    orchestrator.enqueue(agent, 'standard thought');
    await orchestrator.processQueue();

    // Standard request should also be distributed when peers are available
    expect(mockDistributed).toHaveBeenCalled();
  });

  it('tracks distributedProcessing count', async () => {
    const { generateDistributed } = await import('../src/engine/petals-client');
    const mockDistributed = vi.mocked(generateDistributed);

    // Slow down the distributed call to observe concurrency counter
    mockDistributed.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return JSON.stringify({
        vectorDelta: {},
        newLore: ['Thought.'],
        newLingo: {},
      });
    });

    const orchestrator = new ThoughtOrchestrator(TEST_SETTINGS, TEST_DISTRIBUTED_CONFIG);
    orchestrator.updatePeerCapabilities([
      { peerId: 'peer-a', vramMb: 8192, layersHosted: 10, available: true },
    ]);

    const agent = createAgent(50, 50);
    orchestrator.enqueue(agent, 'thought', true);

    // Start processing but don't await yet
    const promise = orchestrator.processQueue();

    // While processing, distributedProcessing should eventually be 0
    // after the promise settles
    await promise;
    expect(orchestrator.distributedProcessing).toBe(0);
  });
});
