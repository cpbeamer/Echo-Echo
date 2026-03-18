/**
 * Sector Host – Owns the tick loop for a sector and broadcasts state diffs.
 *
 * When a node assumes the "host" role for a sector, SectorHost manages
 * computing state deltas and pushing them to connected visitors at a
 * configurable tick rate.
 */

import type { Agent, DataBomb } from '../types/agent';
import type { StateDiff, NetworkConfig } from '../types/networking';
import { DEFAULT_NETWORK_CONFIG } from '../types/networking';
import { computeStateDiff, serializeAgent } from './state-sync';
import { broadcastState } from './network-manager';
import { findAgentsInBlastRadius } from './blast-radius';
import { mutateAgentFromText } from './dna-mutation';

export class SectorHost {
  private previousSnapshot: Agent[] = [];
  private ticksSinceLastSync = 0;
  private config: NetworkConfig;

  constructor(config: NetworkConfig = DEFAULT_NETWORK_CONFIG) {
    this.config = config;
  }

  /**
   * Called after each simulation tick. Accumulates ticks and broadcasts
   * a state diff when the sync interval is reached.
   */
  async onTick(agents: Agent[], tick: number): Promise<void> {
    this.ticksSinceLastSync++;

    if (this.ticksSinceLastSync >= this.config.syncTickRate) {
      const diff = this.computeDiff(agents, tick);
      await this.broadcast(diff);
      this.previousSnapshot = agents.map((a) => this.shallowCloneAgent(a));
      this.ticksSinceLastSync = 0;
    }
  }

  /**
   * Compute a StateDiff between the last broadcast snapshot and the current state.
   * Exposed publicly for testing.
   */
  computeDiff(agents: Agent[], tick: number): StateDiff {
    return computeStateDiff(this.previousSnapshot, agents, tick);
  }

  /**
   * Take the initial snapshot, typically called right before the first tick.
   */
  initializeSnapshot(agents: Agent[]): void {
    this.previousSnapshot = agents.map((a) => this.shallowCloneAgent(a));
    this.ticksSinceLastSync = 0;
  }

  /**
   * Process a data bomb sent by a remote visitor.
   * Returns the IDs of affected agents.
   */
  processRemoteBomb(agents: Agent[], bomb: DataBomb): string[] {
    const affected = findAgentsInBlastRadius(agents, bomb.target, bomb.radius);
    for (const agent of affected) {
      mutateAgentFromText(agent, bomb.text);
    }
    return affected.map((a) => a.id);
  }

  /** Update the sync configuration. */
  updateConfig(config: Partial<NetworkConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Reset host state (called when leaving host role). */
  reset(): void {
    this.previousSnapshot = [];
    this.ticksSinceLastSync = 0;
  }

  /** Broadcast a diff to all visitors via the Rust backend. */
  private async broadcast(diff: StateDiff): Promise<void> {
    try {
      await broadcastState(diff);
    } catch {
      // Network errors are non-fatal; the simulation continues locally
      console.warn('[SectorHost] Failed to broadcast state diff');
    }
  }

  /**
   * Create a minimal clone of an agent for snapshot comparison.
   * Deep-copies mutable structures (Map, arrays) to avoid reference sharing.
   */
  private shallowCloneAgent(agent: Agent): Agent {
    return {
      ...agent,
      vector: { ...agent.vector },
      position: { ...agent.position },
      velocity: { ...agent.velocity },
      loreCache: [...agent.loreCache],
      lingo: { ...agent.lingo },
      adjacencyTicks: new Map(agent.adjacencyTicks),
      parentIds: agent.parentIds ? [...agent.parentIds] : null,
      memory: agent.memory.map((m) => ({ ...m, keywords: [...m.keywords] })),
    };
  }
}

/** Serialize an agent array for full-state transfer (initial sync). */
export function serializeFullState(agents: Agent[], tick: number): StateDiff {
  return {
    tick,
    added: agents.map(serializeAgent),
    removed: [],
    changed: [],
  };
}
