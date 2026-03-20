import { describe, it, expect, beforeEach } from 'vitest';
import { SectorManager } from '../src/engine/sector-manager';
import { createAgent, resetAgentIdCounter } from '../src/engine/agent-factory';
import type { PeerInfo } from '../src/types/networking';

describe('SectorManager', () => {
  let manager: SectorManager;

  beforeEach(() => {
    resetAgentIdCounter();
    manager = new SectorManager({
      userThresholdForNewSector: 4,
      maxSectors: 16,
      sectorGridSize: 100,
      migrationEdgeThreshold: 2,
    });
  });

  describe('shouldSpawnSector', () => {
    it('returns true when no sectors exist', () => {
      expect(manager.shouldSpawnSector(1)).toBe(true);
    });

    it('returns false when maxSectors is reached', () => {
      const smallManager = new SectorManager({
        userThresholdForNewSector: 1,
        maxSectors: 2,
        sectorGridSize: 100,
        migrationEdgeThreshold: 2,
      });

      smallManager.spawnSector('peer-a');
      smallManager.spawnSector('peer-b');

      expect(smallManager.shouldSpawnSector(100)).toBe(false);
    });

    it('returns true when user count meets threshold', () => {
      manager.spawnSector('peer-a');
      // threshold = 4 × 1 sector = 4 users needed
      expect(manager.shouldSpawnSector(4)).toBe(true);
    });

    it('returns false when user count is below threshold', () => {
      manager.spawnSector('peer-a');
      // threshold = 4 × 1 sector = 4 users needed, only have 3
      expect(manager.shouldSpawnSector(3)).toBe(false);
    });
  });

  describe('spawnSector', () => {
    it('generates sectors with valid auto-placed bounds', () => {
      const sector0 = manager.spawnSector('peer-a');
      const sector1 = manager.spawnSector('peer-b');

      expect(sector0.sectorId).toBe('sector-0');
      expect(sector0.bounds.originX).toBe(0);
      expect(sector0.bounds.originY).toBe(0);
      expect(sector0.bounds.width).toBe(100);
      expect(sector0.bounds.height).toBe(100);
      expect(sector0.hostPeerId).toBe('peer-a');

      expect(sector1.sectorId).toBe('sector-1');
      // Second sector should be adjacent (column 1, row 0)
      expect(sector1.bounds.originX).toBe(100);
      expect(sector1.bounds.originY).toBe(0);
    });

    it('wraps to a new row when grid columns are filled', () => {
      // maxCols = ceil(sqrt(16)) = 4
      for (let i = 0; i < 4; i++) {
        manager.spawnSector(`peer-${i}`);
      }
      const sector4 = manager.spawnSector('peer-4');

      // Should be at row 1, col 0
      expect(sector4.bounds.originX).toBe(0);
      expect(sector4.bounds.originY).toBe(100);
    });
  });

  describe('addSector / removeSector', () => {
    it('adds and retrieves a sector', () => {
      manager.addSector({
        sectorId: 'test-sector',
        hostPeerId: 'peer-x',
        bounds: { originX: 0, originY: 0, width: 50, height: 50 },
        agentCount: 10,
        dominantFaction: 'hive',
        adjacentSectorIds: [],
      });

      expect(manager.getSector('test-sector')).toBeDefined();
      expect(manager.sectorCount).toBe(1);
    });

    it('removes a sector', () => {
      manager.spawnSector('peer-a');
      expect(manager.sectorCount).toBe(1);

      const removed = manager.removeSector('sector-0');
      expect(removed).toBe(true);
      expect(manager.sectorCount).toBe(0);
    });

    it('returns false when removing a non-existent sector', () => {
      expect(manager.removeSector('nonexistent')).toBe(false);
    });
  });

  describe('getAdjacentSectors', () => {
    it('returns correct neighbors on a grid', () => {
      // Spawn a 2×2 grid of sectors
      manager.spawnSector('peer-a'); // sector-0 at (0,0)
      manager.spawnSector('peer-b'); // sector-1 at (100,0)
      manager.spawnSector('peer-c'); // sector-2 at (200,0)
      manager.spawnSector('peer-d'); // sector-3 at (300,0)

      // sector-0 and sector-1 share a vertical edge at x=100
      const adj0 = manager.getAdjacentSectors('sector-0');
      expect(adj0).toContain('sector-1');

      // sector-1 is adjacent to sector-0 and sector-2
      const adj1 = manager.getAdjacentSectors('sector-1');
      expect(adj1).toContain('sector-0');
      expect(adj1).toContain('sector-2');
    });

    it('returns empty for non-existent sector', () => {
      expect(manager.getAdjacentSectors('ghost')).toEqual([]);
    });
  });

  describe('getSectorAtPosition', () => {
    it('returns the correct sector for given coordinates', () => {
      manager.spawnSector('peer-a'); // sector-0 at (0,0) size 100
      manager.spawnSector('peer-b'); // sector-1 at (100,0) size 100

      const result0 = manager.getSectorAtPosition(50, 50);
      expect(result0?.sectorId).toBe('sector-0');

      const result1 = manager.getSectorAtPosition(150, 50);
      expect(result1?.sectorId).toBe('sector-1');
    });

    it('returns null for coordinates outside any sector', () => {
      manager.spawnSector('peer-a');
      expect(manager.getSectorAtPosition(500, 500)).toBeNull();
    });
  });

  describe('autoAssignHost', () => {
    it('picks the peer with lowest latency', () => {
      const peers: PeerInfo[] = [
        { peerId: 'peer-slow', role: 'visitor', sectorId: null, latencyMs: 200 },
        { peerId: 'peer-fast', role: 'visitor', sectorId: null, latencyMs: 10 },
        { peerId: 'peer-mid', role: 'visitor', sectorId: null, latencyMs: 50 },
      ];

      const best = manager.autoAssignHost(peers);
      expect(best?.peerId).toBe('peer-fast');
    });

    it('prefers peers not already hosting', () => {
      manager.spawnSector('peer-host');

      const peers: PeerInfo[] = [
        { peerId: 'peer-host', role: 'host', sectorId: 'sector-0', latencyMs: 5 },
        { peerId: 'peer-free', role: 'visitor', sectorId: null, latencyMs: 50 },
      ];

      const best = manager.autoAssignHost(peers);
      expect(best?.peerId).toBe('peer-free');
    });

    it('returns null when no peers are available', () => {
      expect(manager.autoAssignHost([])).toBeNull();
    });
  });

  describe('computeDominantFaction', () => {
    it('returns the faction with most agents', () => {
      const agents = [
        createAgent(10, 10),
        createAgent(20, 20),
        createAgent(30, 30),
      ];
      // Force factions
      agents[0].faction = 'hive';
      agents[1].faction = 'hive';
      agents[2].faction = 'void';

      expect(manager.computeDominantFaction(agents)).toBe('hive');
    });

    it('returns unaligned for empty array', () => {
      expect(manager.computeDominantFaction([])).toBe('unaligned');
    });

    it('ignores dead agents', () => {
      const agents = [createAgent(10, 10), createAgent(20, 20)];
      agents[0].faction = 'void';
      agents[0].energy = 0;
      agents[1].faction = 'citadel';

      expect(manager.computeDominantFaction(agents)).toBe('citadel');
    });
  });

  describe('reset', () => {
    it('clears all sectors and resets index', () => {
      manager.spawnSector('peer-a');
      manager.spawnSector('peer-b');
      expect(manager.sectorCount).toBe(2);

      manager.reset();
      expect(manager.sectorCount).toBe(0);
      expect(manager.getAllSectors()).toEqual([]);
    });
  });
});
