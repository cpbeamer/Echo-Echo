import { describe, it, expect } from 'vitest';
import {
  peaceToFrequency,
  peaceToCutoff,
  factionCountToDetune,
  populationToGain,
  peaceToLfoRate,
} from '../src/engine/vibe-score';

describe('peaceToFrequency', () => {
  it('returns ~60 Hz for full peace', () => {
    expect(peaceToFrequency(1)).toBeCloseTo(60, 0);
  });

  it('returns ~120 Hz for full chaos', () => {
    expect(peaceToFrequency(0)).toBeCloseTo(120, 0);
  });

  it('returns ~90 Hz at midpoint', () => {
    expect(peaceToFrequency(0.5)).toBeCloseTo(90, 0);
  });
});

describe('peaceToCutoff', () => {
  it('returns 200 Hz for full chaos', () => {
    expect(peaceToCutoff(0)).toBeCloseTo(200, 0);
  });

  it('returns 800 Hz for full peace', () => {
    expect(peaceToCutoff(1)).toBeCloseTo(800, 0);
  });

  it('returns mid-range at 0.5', () => {
    expect(peaceToCutoff(0.5)).toBeCloseTo(500, 0);
  });
});

describe('factionCountToDetune', () => {
  it('returns 0 for no factions', () => {
    expect(factionCountToDetune({})).toBe(0);
  });

  it('returns 8 for one faction', () => {
    expect(factionCountToDetune({ hive: 50 })).toBe(8);
  });

  it('returns 32 for four factions', () => {
    expect(factionCountToDetune({ hive: 10, void: 20, citadel: 15, fringe: 5 })).toBe(32);
  });

  it('ignores factions with 0 agents', () => {
    expect(factionCountToDetune({ hive: 10, void: 0, citadel: 5 })).toBe(16);
  });
});

describe('populationToGain', () => {
  it('returns 0 for no agents', () => {
    expect(populationToGain(0)).toBe(0);
  });

  it('scales linearly up to 200 agents', () => {
    expect(populationToGain(100)).toBeCloseTo(0.075, 3);
  });

  it('caps at 0.15 for 200+ agents', () => {
    expect(populationToGain(200)).toBeCloseTo(0.15, 3);
    expect(populationToGain(500)).toBeCloseTo(0.15, 3);
  });
});

describe('peaceToLfoRate', () => {
  it('returns 0.5 Hz for full peace', () => {
    expect(peaceToLfoRate(1)).toBeCloseTo(0.5, 1);
  });

  it('returns 4.5 Hz for full chaos', () => {
    expect(peaceToLfoRate(0)).toBeCloseTo(4.5, 1);
  });

  it('returns mid-range at 0.5', () => {
    expect(peaceToLfoRate(0.5)).toBeCloseTo(2.5, 1);
  });
});
