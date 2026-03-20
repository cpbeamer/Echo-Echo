/**
 * Agent Migration – Cross-sector agent movement for Epic 3.1.
 *
 * Detects agents near sector boundaries, translates their coordinates
 * into the adjacent sector's space, and handles receiving migrated agents.
 */

import type { Agent } from '../types/agent';
import type { SectorBounds, SerializedAgent, SectorExpansionConfig } from '../types/networking';
import { DEFAULT_SECTOR_EXPANSION_CONFIG } from '../types/networking';
import { serializeAgent, deserializeAgent } from './state-sync';

/** Which edge of the sector an agent is near. */
export type MigrationEdge = 'left' | 'right' | 'top' | 'bottom';

/** An agent that has been detected near a sector edge and is eligible for migration. */
export interface MigrationCandidate {
  agent: Agent;
  edge: MigrationEdge;
}

/**
 * Detect agents whose position is within `migrationEdgeThreshold` cells
 * of a sector boundary edge. These agents are eligible for migration
 * to an adjacent sector.
 *
 * Agent positions are in local sector coordinates (0,0 = sector origin).
 */
export function detectMigrationCandidates(
  agents: Agent[],
  sectorBounds: SectorBounds,
  config: SectorExpansionConfig = DEFAULT_SECTOR_EXPANSION_CONFIG,
): MigrationCandidate[] {
  const threshold = config.migrationEdgeThreshold;
  const candidates: MigrationCandidate[] = [];

  for (const agent of agents) {
    // Skip dead agents
    if (agent.energy <= 0 || agent.deathFrame !== null) continue;

    // Local position within sector
    const localX = agent.position.x;
    const localY = agent.position.y;

    if (localX <= threshold) {
      candidates.push({ agent, edge: 'left' });
    } else if (localX >= sectorBounds.width - threshold) {
      candidates.push({ agent, edge: 'right' });
    } else if (localY <= threshold) {
      candidates.push({ agent, edge: 'top' });
    } else if (localY >= sectorBounds.height - threshold) {
      candidates.push({ agent, edge: 'bottom' });
    }
  }

  return candidates;
}

/**
 * Prepare an agent for migration from one sector to an adjacent sector.
 *
 * Translates the agent's position from the source sector's coordinate space
 * into the destination sector's coordinate space using global coordinates as
 * an intermediary. The result is clamped to the destination bounds, so the
 * agent appears at the receiving edge regardless of direction.
 */
export function migrateAgent(
  agent: Agent,
  fromBounds: SectorBounds,
  toBounds: SectorBounds,
  _edge: MigrationEdge,
): SerializedAgent {
  // Convert local position → global → destination local
  const globalX = fromBounds.originX + agent.position.x;
  const globalY = fromBounds.originY + agent.position.y;

  // Clamp to destination bounds to avoid out-of-bounds placement
  const newLocalX = Math.max(0.5, Math.min(toBounds.width - 0.5, globalX - toBounds.originX));
  const newLocalY = Math.max(0.5, Math.min(toBounds.height - 0.5, globalY - toBounds.originY));

  // Clone agent with translated position
  const migrated: Agent = {
    ...agent,
    position: { x: newLocalX, y: newLocalY },
    velocity: { ...agent.velocity },
    vector: { ...agent.vector },
    loreCache: [...agent.loreCache],
    lingo: { ...agent.lingo },
    adjacencyTicks: new Map(agent.adjacencyTicks),
    parentIds: agent.parentIds ? [...agent.parentIds] : null,
    memory: agent.memory.map((m) => ({ ...m, keywords: [...m.keywords] })),
  };

  return serializeAgent(migrated);
}

/**
 * Receive a migrated agent into a sector.
 *
 * Deserializes the agent and clamps its position to valid bounds.
 */
export function receiveMigratedAgent(
  serialized: SerializedAgent,
  sectorBounds: SectorBounds,
): Agent {
  const agent = deserializeAgent(serialized);

  // Clamp position to sector bounds
  agent.position.x = Math.max(0.5, Math.min(sectorBounds.width - 0.5, agent.position.x));
  agent.position.y = Math.max(0.5, Math.min(sectorBounds.height - 0.5, agent.position.y));

  // Reset adjacency ticks since the agent is in a new neighborhood
  agent.adjacencyTicks = new Map();

  return agent;
}
