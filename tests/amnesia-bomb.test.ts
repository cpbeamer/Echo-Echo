import { describe, it, expect, beforeEach } from 'vitest';
import {
  detonateAmnesiaBomb,
  findAgentsInBlastRadius,
} from '../src/engine/blast-radius';
import { addMemory } from '../src/engine/memory-store';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';
import type { DataBomb } from '../src/types';

describe('detonateAmnesiaBomb', () => {
  beforeEach(() => {
    resetAgentIdCounter();
  });

  it('clears memory, loreCache, and lingo for agents in blast radius', () => {
    const agents = [createAgent(50, 50), createAgent(50, 51)];

    // Give agents some state to wipe
    addMemory(agents[0], 'Important memory about order', 10);
    addMemory(agents[0], 'Another memory about chaos', 20);
    agents[0].loreCache = ['Lore entry 1', 'Lore entry 2'];
    agents[0].lingo = { 'sec-jedi': 'security advocate' };

    addMemory(agents[1], 'Some memory about rebellion', 15);
    agents[1].loreCache = ['Other lore'];
    agents[1].lingo = { 'data-punk': 'information anarchist' };

    const bomb: DataBomb = {
      text: '',
      target: { x: 50, y: 50 },
      radius: 5,
      type: 'amnesia',
    };

    const affectedIds = detonateAmnesiaBomb(agents, bomb);

    expect(affectedIds).toHaveLength(2);
    expect(affectedIds).toContain('agent-0');
    expect(affectedIds).toContain('agent-1');

    // Verify everything is wiped
    expect(agents[0].memory).toHaveLength(0);
    expect(agents[0].loreCache).toHaveLength(0);
    expect(Object.keys(agents[0].lingo)).toHaveLength(0);

    expect(agents[1].memory).toHaveLength(0);
    expect(agents[1].loreCache).toHaveLength(0);
    expect(Object.keys(agents[1].lingo)).toHaveLength(0);
  });

  it('does not affect agents outside the blast radius', () => {
    const agents = [createAgent(50, 50), createAgent(99, 99)];

    addMemory(agents[0], 'Memory in range', 1);
    agents[0].loreCache = ['Lore in range'];

    addMemory(agents[1], 'Memory out of range', 1);
    agents[1].loreCache = ['Lore out of range'];
    agents[1].lingo = { term: 'meaning' };

    const bomb: DataBomb = {
      text: '',
      target: { x: 50, y: 50 },
      radius: 5,
      type: 'amnesia',
    };

    const affectedIds = detonateAmnesiaBomb(agents, bomb);

    expect(affectedIds).toHaveLength(1);
    expect(affectedIds).toContain('agent-0');

    // In-range agent is wiped
    expect(agents[0].memory).toHaveLength(0);
    expect(agents[0].loreCache).toHaveLength(0);

    // Out-of-range agent is untouched
    expect(agents[1].memory).toHaveLength(1);
    expect(agents[1].loreCache).toHaveLength(1);
    expect(Object.keys(agents[1].lingo)).toHaveLength(1);
  });

  it('excludes dead agents (energy <= 0)', () => {
    const agents = [createAgent(50, 50), createAgent(50, 51)];
    agents[0].energy = 0; // kill agent-0

    addMemory(agents[0], 'Dead agent memory', 1);
    addMemory(agents[1], 'Alive agent memory', 1);

    const bomb: DataBomb = {
      text: '',
      target: { x: 50, y: 50 },
      radius: 10,
      type: 'amnesia',
    };

    const affectedIds = detonateAmnesiaBomb(agents, bomb);

    expect(affectedIds).toHaveLength(1);
    expect(affectedIds).toContain('agent-1');

    // Dead agent's memory should be intact (not affected)
    expect(agents[0].memory).toHaveLength(1);
    // Alive agent's memory should be wiped
    expect(agents[1].memory).toHaveLength(0);
  });
});
