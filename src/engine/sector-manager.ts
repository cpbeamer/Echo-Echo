/**
 * Sector Manager – Dynamic sector lifecycle for Epic 3.1 Sector Expansion.
 *
 * Manages a registry of sectors on a virtual grid, handles auto-placement of
 * new sectors, determines adjacency, and provides host assignment logic.
 */

import type { Agent, Faction } from '../types/agent';
import type {
  PeerInfo,
  SectorInfo,
  SectorBounds,
  SectorExpansionConfig,
} from '../types/networking';
import { DEFAULT_SECTOR_EXPANSION_CONFIG } from '../types/networking';

/**
 * Manages the lifecycle and registry of all sectors in the global simulation.
 */
export class SectorManager {
  private sectors: Map<string, SectorInfo> = new Map();
  private config: SectorExpansionConfig;
  private nextSectorIndex = 0;

  constructor(config: SectorExpansionConfig = DEFAULT_SECTOR_EXPANSION_CONFIG) {
    this.config = { ...config };
  }

  /** Register a new sector. */
  addSector(info: SectorInfo): void {
    this.sectors.set(info.sectorId, info);
    this.refreshAdjacency();
  }

  /** Remove a sector by ID. */
  removeSector(sectorId: string): boolean {
    const removed = this.sectors.delete(sectorId);
    if (removed) {
      this.refreshAdjacency();
    }
    return removed;
  }

  /** Get a sector by ID. */
  getSector(sectorId: string): SectorInfo | undefined {
    return this.sectors.get(sectorId);
  }

  /** Return all sectors as an array. */
  getAllSectors(): SectorInfo[] {
    return Array.from(this.sectors.values());
  }

  /** Current sector count. */
  get sectorCount(): number {
    return this.sectors.size;
  }

  /**
   * Whether a new sector should be spawned based on connected user count.
   *
   * Logic: spawn if `connectedUserCount >= threshold × currentSectorCount`
   * and `sectorCount < maxSectors`. Always spawns the first sector.
   */
  shouldSpawnSector(connectedUserCount: number): boolean {
    if (this.sectors.size === 0) return true;
    if (this.sectors.size >= this.config.maxSectors) return false;
    return connectedUserCount >= this.config.userThresholdForNewSector * this.sectors.size;
  }

  /**
   * Spawn a new sector, auto-placing it on a grid layout.
   * Returns the newly created SectorInfo.
   */
  spawnSector(hostPeerId: string): SectorInfo {
    const gridSize = this.config.sectorGridSize;
    // Place sectors in a grid pattern: row-major order
    const maxCols = Math.ceil(Math.sqrt(this.config.maxSectors));
    const col = this.nextSectorIndex % maxCols;
    const row = Math.floor(this.nextSectorIndex / maxCols);

    const sectorId = `sector-${this.nextSectorIndex}`;
    this.nextSectorIndex++;

    const info: SectorInfo = {
      sectorId,
      hostPeerId,
      bounds: {
        originX: col * gridSize,
        originY: row * gridSize,
        width: gridSize,
        height: gridSize,
      },
      agentCount: 0,
      dominantFaction: 'unaligned',
      adjacentSectorIds: [],
    };

    this.addSector(info);
    return info;
  }

  /**
   * Pick the best peer to host a new sector.
   * Prefers peers with the lowest latency that aren't already hosting.
   */
  autoAssignHost(peers: PeerInfo[]): PeerInfo | null {
    if (peers.length === 0) return null;

    const currentHostIds = new Set(this.getAllSectors().map((s) => s.hostPeerId));

    // Prefer peers that aren't already hosting a sector
    const nonHostPeers = peers.filter((p) => !currentHostIds.has(p.peerId));
    const candidates = nonHostPeers.length > 0 ? nonHostPeers : peers;

    // Sort by lowest latency
    const sorted = [...candidates].sort((a, b) => a.latencyMs - b.latencyMs);
    return sorted[0];
  }

  /** Return IDs of sectors adjacent to the given sector. */
  getAdjacentSectors(sectorId: string): string[] {
    const sector = this.sectors.get(sectorId);
    return sector ? [...sector.adjacentSectorIds] : [];
  }

  /** Find which sector contains a global coordinate. */
  getSectorAtPosition(globalX: number, globalY: number): SectorInfo | null {
    for (const sector of this.sectors.values()) {
      const b = sector.bounds;
      if (
        globalX >= b.originX &&
        globalX < b.originX + b.width &&
        globalY >= b.originY &&
        globalY < b.originY + b.height
      ) {
        return sector;
      }
    }
    return null;
  }

  /**
   * Compute the dominant faction from an agent array.
   * Returns the faction with the highest agent count, or 'unaligned' if empty.
   */
  computeDominantFaction(agents: Agent[]): Faction {
    if (agents.length === 0) return 'unaligned';

    const counts: Record<string, number> = {};
    for (const agent of agents) {
      if (agent.energy > 0 && agent.deathFrame === null) {
        counts[agent.faction] = (counts[agent.faction] ?? 0) + 1;
      }
    }

    let maxFaction: Faction = 'unaligned';
    let maxCount = 0;
    for (const [faction, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxFaction = faction as Faction;
      }
    }
    return maxFaction;
  }

  /** Update expansion configuration. */
  updateConfig(partial: Partial<SectorExpansionConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /** Get the current expansion configuration. */
  getConfig(): SectorExpansionConfig {
    return { ...this.config };
  }

  /** Reset all state. */
  reset(): void {
    this.sectors.clear();
    this.nextSectorIndex = 0;
  }

  /**
   * Recompute adjacency for all sectors.
   * Two sectors are adjacent if their bounding rectangles share an edge.
   */
  private refreshAdjacency(): void {
    const all = this.getAllSectors();

    for (const sector of all) {
      sector.adjacentSectorIds = [];
    }

    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (this.sharesEdge(all[i].bounds, all[j].bounds)) {
          all[i].adjacentSectorIds.push(all[j].sectorId);
          all[j].adjacentSectorIds.push(all[i].sectorId);
        }
      }
    }
  }

  /**
   * Check if two rectangles share a collinear edge (not just a corner).
   * Edges must overlap by more than zero length.
   */
  private sharesEdge(a: SectorBounds, b: SectorBounds): boolean {
    const aRight = a.originX + a.width;
    const aBottom = a.originY + a.height;
    const bRight = b.originX + b.width;
    const bBottom = b.originY + b.height;

    // Horizontal edge: one's right == other's left, and vertical ranges overlap
    if (aRight === b.originX || bRight === a.originX) {
      const overlapStart = Math.max(a.originY, b.originY);
      const overlapEnd = Math.min(aBottom, bBottom);
      return overlapEnd > overlapStart;
    }

    // Vertical edge: one's bottom == other's top, and horizontal ranges overlap
    if (aBottom === b.originY || bBottom === a.originY) {
      const overlapStart = Math.max(a.originX, b.originX);
      const overlapEnd = Math.min(aRight, bRight);
      return overlapEnd > overlapStart;
    }

    return false;
  }
}
