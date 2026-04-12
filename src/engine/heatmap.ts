/**
 * Heatmap – CPU-based density computation for ideology visualization.
 *
 * Given agent positions and attributes, produces a 2D density grid
 * suitable for rendering as a colored overlay on the PixiJS canvas.
 * Uses Gaussian kernel density estimation at a configurable resolution.
 */

import type { Faction } from '../types';
import { FACTION_META } from './factions';

/** A 2D grid of density values, one per downsampled cell. */
export interface HeatmapGrid {
  /** Width of the grid in downsampled cells. */
  width: number;
  /** Height of the grid in downsampled cells. */
  height: number;
  /** Flat array of density values [0, 1], row-major. */
  data: Float32Array;
}

/** RGB heatmap for faction-colored mode. */
export interface FactionHeatmapGrid {
  width: number;
  height: number;
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
}

export interface HeatmapConfig {
  /** Downscale factor: 1 = full resolution, 2 = half (default), 4 = quarter. */
  resolution: number;
  /** Gaussian kernel radius in grid cells for density smoothing. */
  kernelRadius: number;
  /** Heatmap visualization mode. */
  mode: 'density' | 'faction' | 'peace_war';
}

export const DEFAULT_HEATMAP_CONFIG: HeatmapConfig = {
  resolution: 2,
  kernelRadius: 3,
  mode: 'density',
};

/** Minimal agent shape needed for density computation. */
interface HeatmapAgent {
  position: { x: number; y: number };
  energy: number;
}

/** Agent with faction info for faction-colored mode. */
interface FactionHeatmapAgent extends HeatmapAgent {
  faction: string;
}

/** Agent with DNA vector for peace/war mode. */
interface PeaceWarHeatmapAgent extends HeatmapAgent {
  vector: { order_chaos: number };
}

/**
 * Precompute a 1D Gaussian kernel of the given radius.
 * Returns weights for offsets -radius..+radius (length = 2*radius+1).
 */
export function buildGaussianKernel(radius: number): Float32Array {
  const size = 2 * radius + 1;
  const kernel = new Float32Array(size);
  const sigma = radius / 2.5;
  let sum = 0;

  for (let i = 0; i < size; i++) {
    const d = i - radius;
    kernel[i] = Math.exp(-(d * d) / (2 * sigma * sigma));
    sum += kernel[i];
  }

  // Normalize
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

/**
 * Splat agents onto a density grid using separable Gaussian convolution.
 * Returns a raw (un-normalized) density grid.
 */
function splatDensity(
  agents: ReadonlyArray<HeatmapAgent>,
  gridWidth: number,
  gridHeight: number,
  config: HeatmapConfig,
  weightFn?: (agent: HeatmapAgent) => number,
): Float32Array {
  const w = Math.ceil(gridWidth / config.resolution);
  const h = Math.ceil(gridHeight / config.resolution);
  const data = new Float32Array(w * h);

  const kernel = buildGaussianKernel(config.kernelRadius);
  const r = config.kernelRadius;

  for (const agent of agents) {
    if (agent.energy <= 0) continue;

    const cx = Math.floor(agent.position.x / config.resolution);
    const cy = Math.floor(agent.position.y / config.resolution);
    const weight = weightFn ? weightFn(agent) : 1;

    for (let dy = -r; dy <= r; dy++) {
      const gy = cy + dy;
      if (gy < 0 || gy >= h) continue;
      const ky = kernel[dy + r];

      for (let dx = -r; dx <= r; dx++) {
        const gx = cx + dx;
        if (gx < 0 || gx >= w) continue;
        const kx = kernel[dx + r];

        data[gy * w + gx] += weight * kx * ky;
      }
    }
  }

  return data;
}

/** Normalize a Float32Array to [0, 1] range. Mutates in place. */
function normalizeInPlace(data: Float32Array): void {
  let max = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] > max) max = data[i];
  }
  if (max > 0) {
    for (let i = 0; i < data.length; i++) {
      data[i] /= max;
    }
  }
}

/**
 * Compute a density heatmap from agent positions.
 * Higher values = more agents concentrated in that area.
 */
export function computeDensityHeatmap(
  agents: ReadonlyArray<HeatmapAgent>,
  gridWidth: number,
  gridHeight: number,
  config: HeatmapConfig = DEFAULT_HEATMAP_CONFIG,
): HeatmapGrid {
  const w = Math.ceil(gridWidth / config.resolution);
  const h = Math.ceil(gridHeight / config.resolution);

  if (agents.length === 0) {
    return { width: w, height: h, data: new Float32Array(w * h) };
  }

  const data = splatDensity(agents, gridWidth, gridHeight, config);
  normalizeInPlace(data);

  return { width: w, height: h, data };
}

/**
 * Compute a faction-colored heatmap.
 * Returns per-cell RGB triplets based on dominant faction density.
 */
export function computeFactionHeatmap(
  agents: ReadonlyArray<FactionHeatmapAgent>,
  gridWidth: number,
  gridHeight: number,
  config: HeatmapConfig = DEFAULT_HEATMAP_CONFIG,
): FactionHeatmapGrid {
  const w = Math.ceil(gridWidth / config.resolution);
  const h = Math.ceil(gridHeight / config.resolution);

  const r = new Float32Array(w * h);
  const g = new Float32Array(w * h);
  const b = new Float32Array(w * h);

  if (agents.length === 0) {
    return { width: w, height: h, r, g, b };
  }

  // Build per-faction density grids
  const factions = ['hive', 'void', 'citadel', 'fringe'] as const;
  const factionGrids: Record<string, Float32Array> = {};

  for (const faction of factions) {
    const factionAgents = agents.filter((a) => a.faction === faction);
    factionGrids[faction] = splatDensity(factionAgents, gridWidth, gridHeight, config);
  }

  // Blend: at each cell, color is weighted average of faction colors
  for (let i = 0; i < w * h; i++) {
    let totalDensity = 0;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;

    for (const faction of factions) {
      const density = factionGrids[faction][i];
      if (density <= 0) continue;

      totalDensity += density;
      const color = parseFactionColor(faction);
      rSum += density * color.r;
      gSum += density * color.g;
      bSum += density * color.b;
    }

    if (totalDensity > 0) {
      r[i] = rSum / totalDensity;
      g[i] = gSum / totalDensity;
      b[i] = bSum / totalDensity;
    }
  }

  // Compute combined density for alpha channel normalization
  const combinedDensity = splatDensity(agents, gridWidth, gridHeight, config);
  normalizeInPlace(combinedDensity);

  // Scale RGB by normalized density (so sparse areas are dim)
  for (let i = 0; i < w * h; i++) {
    const d = combinedDensity[i];
    r[i] *= d;
    g[i] *= d;
    b[i] *= d;
  }

  return { width: w, height: h, r, g, b };
}

/**
 * Compute a peace/war gradient heatmap.
 * Blue = peaceful (low order_chaos), Red = warlike (high order_chaos).
 * Density is agent count; color is weighted by agents' order_chaos values.
 */
export function computePeaceWarHeatmap(
  agents: ReadonlyArray<PeaceWarHeatmapAgent>,
  gridWidth: number,
  gridHeight: number,
  config: HeatmapConfig = DEFAULT_HEATMAP_CONFIG,
): HeatmapGrid {
  const w = Math.ceil(gridWidth / config.resolution);
  const h = Math.ceil(gridHeight / config.resolution);

  if (agents.length === 0) {
    return { width: w, height: h, data: new Float32Array(w * h) };
  }

  // Weight by order_chaos: 0 = full peace, 1 = full war
  const warGrid = splatDensity(agents, gridWidth, gridHeight, config, (a) => {
    return (a as PeaceWarHeatmapAgent).vector.order_chaos;
  });

  const countGrid = splatDensity(agents, gridWidth, gridHeight, config);

  // Ratio: war / count → [0, 1] where 0 = peace, 1 = war
  const data = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    data[i] = countGrid[i] > 0 ? warGrid[i] / countGrid[i] : 0;
  }

  return { width: w, height: h, data };
}

/** Parse faction meta color string to RGB [0,1]. */
function parseFactionColor(faction: string): { r: number; g: number; b: number } {
  const meta = FACTION_META[faction as Faction];
  if (!meta) return { r: 0.4, g: 0.4, b: 0.4 };

  const match = meta.color.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (match && match[1] && match[2] && match[3]) {
    return {
      r: parseInt(match[1], 16) / 255,
      g: parseInt(match[2], 16) / 255,
      b: parseInt(match[3], 16) / 255,
    };
  }

  // Fallback: try rgba()
  const rgba = meta.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgba && rgba[1] && rgba[2] && rgba[3]) {
    return {
      r: parseInt(rgba[1]) / 255,
      g: parseInt(rgba[2]) / 255,
      b: parseInt(rgba[3]) / 255,
    };
  }

  return { r: 0.4, g: 0.4, b: 0.4 };
}
