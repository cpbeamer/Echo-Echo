/**
 * Networking Store – Svelte 5 reactive state for P2P networking (Epic 3.0).
 *
 * Keeps network-specific state separate from the simulation store while
 * exposing reactive primitives for the NetworkPanel UI.
 */

import type { PeerInfo, PeerRole, NetworkStatus, NetworkEvent, NetworkConfig } from '../../types';
import { DEFAULT_NETWORK_CONFIG } from '../../types';

/** Maximum events retained in the network event log. */
const MAX_NETWORK_EVENTS = 100;

let nextEventId = 0;

class NetworkingState {
  peerId: string | null = $state(null);
  status: NetworkStatus = $state('offline');
  role: PeerRole = $state('disconnected');
  connectedPeers: PeerInfo[] = $state([]);
  config: NetworkConfig = $state({ ...DEFAULT_NETWORK_CONFIG });
  events: NetworkEvent[] = $state([]);
  /** The sector ID this node is hosting or visiting. */
  activeSectorId: string | null = $state(null);

  /** Update our own peer ID after network start. */
  setPeerId(id: string): void {
    this.peerId = id;
  }

  /** Update the overall network status. */
  setStatus(status: NetworkStatus): void {
    this.status = status;
  }

  /** Update our role for the active sector. */
  setRole(role: PeerRole): void {
    this.role = role;
  }

  /** Replace the full peer list (after polling or event-driven refresh). */
  setPeers(peers: PeerInfo[]): void {
    this.connectedPeers = [...peers];
  }

  /** Set the sector we are hosting or visiting. */
  setActiveSector(sectorId: string | null): void {
    this.activeSectorId = sectorId;
  }

  /** Update sync configuration. */
  updateConfig(partial: Partial<NetworkConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /** Push a network event to the log (newest first). */
  pushEvent(event: Omit<NetworkEvent, 'id' | 'timestamp'>): void {
    const fullEvent = {
      ...event,
      id: `net-${nextEventId++}`,
      timestamp: Date.now(),
    } as NetworkEvent;

    this.events = [fullEvent, ...this.events].slice(0, MAX_NETWORK_EVENTS);
  }

  /** Reset all networking state (called on disconnect). */
  reset(): void {
    this.peerId = null;
    this.status = 'offline';
    this.role = 'disconnected';
    this.connectedPeers = [];
    this.activeSectorId = null;
    this.events = [];
    nextEventId = 0;
  }
}

export const networking = new NetworkingState();
