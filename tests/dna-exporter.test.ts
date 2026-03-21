import { describe, it, expect, beforeEach } from 'vitest';
import {
  serializeAgentsToDnaFile,
  validateDnaFile,
  migrateDnaFile,
  importDnaFileAgents,
  resetImportIdCounter,
  createAgent,
  resetAgentIdCounter,
  dnaToColor,
} from '../src/engine';
import { DNA_FILE_VERSION, DEFAULT_CONFIG } from '../src/types';
import type { Agent, DnaFile } from '../src/types';

/** Create a test agent with known DNA for deterministic assertions. */
function makeTestAgent(overrides: Partial<Agent> = {}): Agent {
  const base = createAgent(10, 20);
  return {
    ...base,
    loreCache: ['ancient wisdom', 'digital prophecy'],
    lingo: { 'Sec-Jedi': 'A leader of the digital temple' },
    memory: [{ text: 'Witnessed the great merge', tick: 42, keywords: ['merge', 'great'] }],
    ...overrides,
  };
}

/** Build a minimal valid DnaFile for validation tests. */
function makeValidDnaFile(agentOverrides: Record<string, unknown> = {}): unknown {
  return {
    header: {
      version: '1.0.0',
      name: 'Test Cult',
      description: 'A test',
      createdAt: '2026-03-20T00:00:00.000Z',
      agentCount: 1,
    },
    agents: [
      {
        id: 'agent-0',
        vector: { analytical_emotional: 0.5, altruistic_selfish: 0.3, order_chaos: 0.7 },
        loreCache: ['lore'],
        lingo: { term: 'meaning' },
        faction: 'hive',
        parentIds: null,
        memory: [{ text: 'hello', tick: 1, keywords: ['hello'] }],
        ...agentOverrides,
      },
    ],
  };
}

beforeEach(() => {
  resetAgentIdCounter();
  resetImportIdCounter();
});

// ── serializeAgentsToDnaFile ────────────────────────────────────────────────

describe('serializeAgentsToDnaFile', () => {
  it('produces a DnaFile with correct header metadata', () => {
    const agents = [makeTestAgent()];
    const file = serializeAgentsToDnaFile(agents, 'The Hive Mind', 'Agents of order');

    expect(file.header.version).toBe(DNA_FILE_VERSION);
    expect(file.header.name).toBe('The Hive Mind');
    expect(file.header.description).toBe('Agents of order');
    expect(file.header.agentCount).toBe(1);
    expect(file.header.createdAt).toBeTruthy();
  });

  it('strips runtime-only fields from exported agents', () => {
    const agent = makeTestAgent({ energy: 0.3, activityLevel: 0.8 });
    const file = serializeAgentsToDnaFile([agent], 'Test');

    const exported = file.agents[0];

    // DNA identity fields preserved
    expect(exported.vector).toEqual(agent.vector);
    expect(exported.loreCache).toEqual(agent.loreCache);
    expect(exported.lingo).toEqual(agent.lingo);
    expect(exported.faction).toBe(agent.faction);
    expect(exported.memory).toHaveLength(1);

    // Runtime fields absent
    expect(exported).not.toHaveProperty('position');
    expect(exported).not.toHaveProperty('velocity');
    expect(exported).not.toHaveProperty('energy');
    expect(exported).not.toHaveProperty('color');
    expect(exported).not.toHaveProperty('radius');
    expect(exported).not.toHaveProperty('activityLevel');
    expect(exported).not.toHaveProperty('deathFrame');
    expect(exported).not.toHaveProperty('adjacencyTicks');
    expect(exported).not.toHaveProperty('lastReproductionTick');
  });

  it('handles multiple agents', () => {
    const agents = [makeTestAgent(), makeTestAgent(), makeTestAgent()];
    const file = serializeAgentsToDnaFile(agents, 'Trio');

    expect(file.header.agentCount).toBe(3);
    expect(file.agents).toHaveLength(3);
  });

  it('handles empty agent array', () => {
    const file = serializeAgentsToDnaFile([], 'Empty Cult');

    expect(file.header.agentCount).toBe(0);
    expect(file.agents).toHaveLength(0);
  });

  it('defaults description to empty string when omitted', () => {
    const file = serializeAgentsToDnaFile([makeTestAgent()], 'NoDesc');
    expect(file.header.description).toBe('');
  });

  it('deep-copies data so mutations do not leak', () => {
    const agent = makeTestAgent();
    const file = serializeAgentsToDnaFile([agent], 'Copy Test');

    // Mutate the original
    agent.loreCache.push('new entry');
    agent.lingo['new-term'] = 'new meaning';
    agent.memory[0].keywords.push('leaked');

    // Exported file should not be affected
    expect(file.agents[0].loreCache).not.toContain('new entry');
    expect(file.agents[0].lingo).not.toHaveProperty('new-term');
    expect(file.agents[0].memory[0].keywords).not.toContain('leaked');
  });
});

// ── validateDnaFile ────────────────────────────────────────────────────────

describe('validateDnaFile', () => {
  it('accepts a valid DnaFile', () => {
    const data = makeValidDnaFile();
    const result = validateDnaFile(data);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.file.header.name).toBe('Test Cult');
      expect(result.file.agents).toHaveLength(1);
    }
  });

  it('rejects non-object root', () => {
    expect(validateDnaFile('string')).toEqual({
      valid: false,
      error: 'Root value must be a JSON object',
    });
    expect(validateDnaFile(null)).toEqual({
      valid: false,
      error: 'Root value must be a JSON object',
    });
    expect(validateDnaFile(42)).toEqual({
      valid: false,
      error: 'Root value must be a JSON object',
    });
  });

  it('rejects missing header', () => {
    const result = validateDnaFile({ agents: [] });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('header');
  });

  it('rejects missing header.version', () => {
    const data = makeValidDnaFile();
    (data as Record<string, unknown>).header = {
      ...(data as Record<string, Record<string, unknown>>).header,
      version: undefined,
    };
    const result = validateDnaFile(data);
    expect(result.valid).toBe(false);
  });

  it('rejects mismatched agentCount', () => {
    const data = makeValidDnaFile();
    (data as Record<string, Record<string, unknown>>).header.agentCount = 99;
    const result = validateDnaFile(data);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('agentCount');
  });

  it('rejects out-of-range vector values', () => {
    const result = validateDnaFile(
      makeValidDnaFile({
        vector: { analytical_emotional: 1.5, altruistic_selfish: 0.3, order_chaos: 0.7 },
      }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('vector.analytical_emotional');
  });

  it('rejects negative vector values', () => {
    const result = validateDnaFile(
      makeValidDnaFile({
        vector: { analytical_emotional: -0.1, altruistic_selfish: 0.3, order_chaos: 0.7 },
      }),
    );
    expect(result.valid).toBe(false);
  });

  it('rejects invalid faction', () => {
    const result = validateDnaFile(makeValidDnaFile({ faction: 'unknown_faction' }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('faction');
  });

  it('rejects non-array loreCache', () => {
    const result = validateDnaFile(makeValidDnaFile({ loreCache: 'not-array' }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('loreCache');
  });

  it('rejects invalid memory entries', () => {
    const result = validateDnaFile(
      makeValidDnaFile({ memory: [{ text: 123, tick: 'bad', keywords: null }] }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('memory');
  });

  it('rejects invalid parentIds (wrong length)', () => {
    const result = validateDnaFile(makeValidDnaFile({ parentIds: ['only-one'] }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('parentIds');
  });

  it('accepts null parentIds', () => {
    const result = validateDnaFile(makeValidDnaFile({ parentIds: null }));
    expect(result.valid).toBe(true);
  });

  it('accepts valid parentIds tuple', () => {
    const result = validateDnaFile(makeValidDnaFile({ parentIds: ['a', 'b'] }));
    expect(result.valid).toBe(true);
  });
});

// ── migrateDnaFile ─────────────────────────────────────────────────────────

describe('migrateDnaFile', () => {
  it('passes through version 1.0.0 files unchanged', () => {
    const data = makeValidDnaFile();
    const validated = validateDnaFile(data);
    if (!validated.valid) throw new Error('Unexpected invalid file');

    const migrated = migrateDnaFile(validated.file);

    expect(migrated).toEqual(validated.file);
  });
});

// ── importDnaFileAgents ────────────────────────────────────────────────────

describe('importDnaFileAgents', () => {
  let validFile: DnaFile;

  beforeEach(() => {
    const agents = [
      makeTestAgent(),
      makeTestAgent(),
    ];
    validFile = serializeAgentsToDnaFile(agents, 'Import Test');
  });

  it('generates new unique IDs prefixed with "invader-"', () => {
    const imported = importDnaFileAgents(validFile, { spawnPosition: { x: 50, y: 50 }, spreadRadius: 5 });

    expect(imported).toHaveLength(2);
    expect(imported[0].id).toBe('invader-0');
    expect(imported[1].id).toBe('invader-1');
    // Original IDs should not be reused
    expect(imported[0].id).not.toContain('agent-');
  });

  it('places agents near the spawn position within spread radius', () => {
    const spawnPos = { x: 50, y: 50 };
    const radius = 5;
    const imported = importDnaFileAgents(validFile, { spawnPosition: spawnPos, spreadRadius: radius });

    for (const agent of imported) {
      const dx = agent.position.x - spawnPos.x;
      const dy = agent.position.y - spawnPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      expect(distance).toBeLessThanOrEqual(radius);
    }
  });

  it('re-derives color from DNA vector', () => {
    const imported = importDnaFileAgents(validFile, { spawnPosition: { x: 0, y: 0 }, spreadRadius: 1 });

    for (const agent of imported) {
      expect(agent.color).toBe(dnaToColor(agent.vector));
    }
  });

  it('resets energy to 1.0', () => {
    const imported = importDnaFileAgents(validFile, { spawnPosition: { x: 0, y: 0 }, spreadRadius: 1 });

    for (const agent of imported) {
      expect(agent.energy).toBe(1.0);
    }
  });

  it('clears runtime state (velocity, adjacencyTicks, activityLevel, deathFrame)', () => {
    const imported = importDnaFileAgents(validFile, { spawnPosition: { x: 0, y: 0 }, spreadRadius: 1 });

    for (const agent of imported) {
      expect(agent.velocity).toEqual({ x: 0, y: 0 });
      expect(agent.activityLevel).toBe(0);
      expect(agent.deathFrame).toBeNull();
      expect(agent.adjacencyTicks.size).toBe(0);
      expect(agent.lastReproductionTick).toBe(-Infinity);
    }
  });

  it('preserves DNA identity fields (vector, loreCache, lingo, memory)', () => {
    const imported = importDnaFileAgents(validFile, { spawnPosition: { x: 0, y: 0 }, spreadRadius: 1 });

    for (let i = 0; i < imported.length; i++) {
      expect(imported[i].vector).toEqual(validFile.agents[i].vector);
      expect(imported[i].loreCache).toEqual(validFile.agents[i].loreCache);
      expect(imported[i].lingo).toEqual(validFile.agents[i].lingo);
      expect(imported[i].memory).toHaveLength(validFile.agents[i].memory.length);
    }
  });

  it('uses default config when none provided', () => {
    const imported = importDnaFileAgents(validFile, { spawnPosition: { x: 0, y: 0 }, spreadRadius: 1 });

    for (const agent of imported) {
      expect(agent.radius).toBe(DEFAULT_CONFIG.agentRadius);
    }
  });

  it('zero spreadRadius places all agents at exact spawn position', () => {
    const spawnPos = { x: 25, y: 75 };
    const imported = importDnaFileAgents(validFile, { spawnPosition: spawnPos, spreadRadius: 0 });

    for (const agent of imported) {
      expect(agent.position.x).toBe(spawnPos.x);
      expect(agent.position.y).toBe(spawnPos.y);
    }
  });
});
