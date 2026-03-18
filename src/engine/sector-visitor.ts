/**
 * Sector Visitor – Receives and applies state snapshots from a sector host.
 *
 * When a node joins a hosted sector as a visitor, SectorVisitor manages
 * applying incoming state diffs and sending local actions (data bombs)
 * back to the host.
 */

import type { Agent, DataBomb } from '../types/agent';
import type { StateDiff, RemoteDataBomb, PeerId } from '../types/networking';
import { applyStateDiff, deserializeAgent } from './state-sync';

export class SectorVisitor {
  private localPeerId: PeerId;

  constructor(localPeerId: PeerId) {
    this.localPeerId = localPeerId;
  }

  /**
   * Apply an incoming state diff to the local agent array.
   * Returns the updated agent array (immutable — does not mutate the input).
   */
  applyDiff(agents: Agent[], diff: StateDiff): Agent[] {
    return applyStateDiff(agents, diff);
  }

  /**
   * Apply the initial full-state snapshot when first joining a sector.
   * The diff's `added` array contains the complete agent list.
   */
  applyFullState(diff: StateDiff): Agent[] {
    return diff.added.map(deserializeAgent);
  }

  /**
   * Create a RemoteDataBomb payload to send to the sector host.
   * The host will process the bomb on its authoritative simulation state.
   */
  createBombRequest(bomb: DataBomb): RemoteDataBomb {
    return {
      ...bomb,
      senderPeerId: this.localPeerId,
    };
  }

  /** Update the local peer ID (e.g. after reconnection). */
  updatePeerId(peerId: PeerId): void {
    this.localPeerId = peerId;
  }
}
