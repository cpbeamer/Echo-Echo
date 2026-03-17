import { describe, it, expect, beforeEach } from 'vitest';
import { mutateAgentFromText, applyDNAUpdate } from '../src/engine/dna-mutation';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';
import type { DNAUpdate } from '../src/types';

describe('DNA Mutation', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('shifts order axis down when fed pro-order text', () => {
    const agent = createAgent(50, 50);
    const originalOrderChaos = agent.vector.order_chaos;

    mutateAgentFromText(agent, 'We need order, structure, discipline, rules, and control.');

    // Order keywords push order_chaos toward 0 (more orderly)
    expect(agent.vector.order_chaos).toBeLessThan(originalOrderChaos);
  });

  it('shifts chaos axis up when fed pro-chaos text', () => {
    const agent = createAgent(50, 50);
    const originalOrderChaos = agent.vector.order_chaos;

    mutateAgentFromText(agent, 'Freedom! Anarchy! Revolution! Break the system! Chaos!');

    expect(agent.vector.order_chaos).toBeGreaterThan(originalOrderChaos);
  });

  it('adds to lore-cache after mutation', () => {
    const agent = createAgent(50, 50);
    expect(agent.loreCache).toHaveLength(0);

    mutateAgentFromText(agent, 'Some test data bomb text.');

    expect(agent.loreCache).toHaveLength(1);
    expect(agent.loreCache[0]).toContain('[Data Bomb]');
  });

  it('trims lore-cache to 10 entries', () => {
    const agent = createAgent(50, 50);
    for (let i = 0; i < 15; i++) {
      mutateAgentFromText(agent, `Entry ${i}`);
    }
    expect(agent.loreCache).toHaveLength(10);
  });

  it('clamps vector values to [0, 1]', () => {
    const agent = createAgent(50, 50);
    // Force vector to extreme values
    agent.vector.order_chaos = 0.99;

    mutateAgentFromText(
      agent,
      'chaos freedom anarchy rebellion revolution disorder random wild disrupt break',
      0.5,
    );

    expect(agent.vector.order_chaos).toBeLessThanOrEqual(1);
    expect(agent.vector.order_chaos).toBeGreaterThanOrEqual(0);
  });
});

describe('applyDNAUpdate', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('applies vector deltas correctly', () => {
    const agent = createAgent(50, 50);
    agent.vector.analytical_emotional = 0.5;

    const update: DNAUpdate = {
      vectorDelta: { analytical_emotional: 0.2 },
      newLore: ['Processed a manifesto.'],
      newLingo: { 'Sec-Jedi': 'A security-focused leader' },
    };

    applyDNAUpdate(agent, update);

    expect(agent.vector.analytical_emotional).toBeCloseTo(0.7);
    expect(agent.loreCache).toContain('Processed a manifesto.');
    expect(agent.lingo['Sec-Jedi']).toBe('A security-focused leader');
  });
});
