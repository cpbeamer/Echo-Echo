import { describe, it, expect } from 'vitest';
import { classifyFaction, areOpposingFactions } from '../src/engine/factions';
import type { DNAVector } from '../src/types';

describe('Faction Classification', () => {
  it('classifies Hive: altruistic + orderly', () => {
    const vector: DNAVector = {
      analytical_emotional: 0.5,
      altruistic_selfish: 0.1,
      order_chaos: 0.1,
    };
    expect(classifyFaction(vector)).toBe('hive');
  });

  it('classifies Void: selfish + chaotic', () => {
    const vector: DNAVector = {
      analytical_emotional: 0.5,
      altruistic_selfish: 0.9,
      order_chaos: 0.9,
    };
    expect(classifyFaction(vector)).toBe('void');
  });

  it('classifies Citadel: analytical + orderly', () => {
    const vector: DNAVector = {
      analytical_emotional: 0.1,
      altruistic_selfish: 0.5,
      order_chaos: 0.1,
    };
    expect(classifyFaction(vector)).toBe('citadel');
  });

  it('classifies Fringe: emotional + mid-selfish', () => {
    const vector: DNAVector = {
      analytical_emotional: 0.8,
      altruistic_selfish: 0.5,
      order_chaos: 0.5,
    };
    expect(classifyFaction(vector)).toBe('fringe');
  });

  it('returns unaligned for balanced vectors', () => {
    const vector: DNAVector = {
      analytical_emotional: 0.5,
      altruistic_selfish: 0.5,
      order_chaos: 0.5,
    };
    expect(classifyFaction(vector)).toBe('unaligned');
  });
});

describe('Faction Opposition', () => {
  it('Hive opposes Void', () => {
    expect(areOpposingFactions('hive', 'void')).toBe(true);
    expect(areOpposingFactions('void', 'hive')).toBe(true);
  });

  it('Citadel opposes Fringe', () => {
    expect(areOpposingFactions('citadel', 'fringe')).toBe(true);
    expect(areOpposingFactions('fringe', 'citadel')).toBe(true);
  });

  it('same faction does not oppose itself', () => {
    expect(areOpposingFactions('hive', 'hive')).toBe(false);
  });

  it('unaligned opposes no one', () => {
    expect(areOpposingFactions('unaligned', 'hive')).toBe(false);
  });
});
