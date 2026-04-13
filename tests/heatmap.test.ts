import { describe, it, expect } from 'vitest';
import {
  computeDensityHeatmap,
  computeFactionHeatmap,
  computePeaceWarHeatmap,
  buildGaussianKernel,
  type HeatmapConfig,
} from '../src/engine/heatmap';

const baseConfig: HeatmapConfig = {
  resolution: 1,
  kernelRadius: 2,
  mode: 'density',
};

describe('buildGaussianKernel', () => {
  it('sums to approximately 1', () => {
    const kernel = buildGaussianKernel(3);
    const sum = kernel.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    const kernel = buildGaussianKernel(4);
    for (let i = 0; i < kernel.length; i++) {
      expect(kernel[i]).toBeCloseTo(kernel[kernel.length - 1 - i], 10);
    }
  });

  it('peaks at center', () => {
    const kernel = buildGaussianKernel(3);
    const center = Math.floor(kernel.length / 2);
    for (let i = 0; i < kernel.length; i++) {
      expect(kernel[center]).toBeGreaterThanOrEqual(kernel[i]);
    }
  });
});

describe('computeDensityHeatmap', () => {
  it('returns zero grid for empty agents', () => {
    const grid = computeDensityHeatmap([], 10, 10, baseConfig);
    expect(grid.width).toBe(10);
    expect(grid.height).toBe(10);
    expect(grid.data.every((v) => v === 0)).toBe(true);
  });

  it('produces non-zero density near agent position', () => {
    const agents = [{ position: { x: 5, y: 5 }, energy: 1 }];
    const grid = computeDensityHeatmap(agents, 10, 10, baseConfig);

    // Cell at (5,5) should have density
    expect(grid.data[5 * 10 + 5]).toBeGreaterThan(0);
  });

  it('produces zero density far from agents', () => {
    const agents = [{ position: { x: 1, y: 1 }, energy: 1 }];
    const grid = computeDensityHeatmap(agents, 20, 20, { ...baseConfig, kernelRadius: 1 });

    // Cell at (15,15) should be zero
    expect(grid.data[15 * 20 + 15]).toBe(0);
  });

  it('normalizes values to [0, 1]', () => {
    const agents = [
      { position: { x: 5, y: 5 }, energy: 1 },
      { position: { x: 5, y: 5 }, energy: 1 },
      { position: { x: 5, y: 5 }, energy: 1 },
    ];
    const grid = computeDensityHeatmap(agents, 10, 10, baseConfig);

    // Max should be 1 after normalization
    const max = Math.max(...grid.data);
    expect(max).toBeCloseTo(1, 5);

    // All values should be in [0, 1]
    for (const v of grid.data) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('ignores dead agents (energy <= 0)', () => {
    const agents = [{ position: { x: 5, y: 5 }, energy: 0 }];
    const grid = computeDensityHeatmap(agents, 10, 10, baseConfig);
    expect(grid.data.every((v) => v === 0)).toBe(true);
  });

  it('respects resolution downscaling', () => {
    const agents = [{ position: { x: 5, y: 5 }, energy: 1 }];
    const grid = computeDensityHeatmap(agents, 20, 20, { ...baseConfig, resolution: 2 });

    expect(grid.width).toBe(10);
    expect(grid.height).toBe(10);
  });
});

describe('computeFactionHeatmap', () => {
  it('returns zero grid for empty agents', () => {
    const grid = computeFactionHeatmap([], 10, 10, baseConfig);
    expect(grid.r.every((v) => v === 0)).toBe(true);
    expect(grid.g.every((v) => v === 0)).toBe(true);
    expect(grid.b.every((v) => v === 0)).toBe(true);
  });

  it('produces non-zero RGB near agent position', () => {
    const agents = [{ position: { x: 5, y: 5 }, energy: 1, faction: 'hive' }];
    const grid = computeFactionHeatmap(agents, 10, 10, baseConfig);

    const i = 5 * 10 + 5;
    const intensity = Math.max(grid.r[i], grid.g[i], grid.b[i]);
    expect(intensity).toBeGreaterThan(0);
  });
});

describe('computePeaceWarHeatmap', () => {
  it('returns zero grid for empty agents', () => {
    const grid = computePeaceWarHeatmap([], 10, 10, baseConfig);
    expect(grid.data.every((v) => v === 0)).toBe(true);
  });

  it('returns high values (war) for agents with high order_chaos', () => {
    const agents = [{ position: { x: 5, y: 5 }, energy: 1, vector: { order_chaos: 0.9 } }];
    const grid = computePeaceWarHeatmap(agents, 10, 10, baseConfig);

    // The value at the agent position should be close to 0.9 (warlike)
    expect(grid.data[5 * 10 + 5]).toBeGreaterThan(0.7);
  });

  it('returns low values (peace) for agents with low order_chaos', () => {
    const agents = [{ position: { x: 5, y: 5 }, energy: 1, vector: { order_chaos: 0.1 } }];
    const grid = computePeaceWarHeatmap(agents, 10, 10, baseConfig);

    expect(grid.data[5 * 10 + 5]).toBeLessThan(0.3);
  });
});
