/**
 * Network Manager – Front-end bridge to the Rust LibP2P backend.
 *
 * Wraps `@tauri-apps/api/core` invoke calls and Tauri event listeners
 * into a typed, ergonomic API for the simulation store and UI.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { PeerInfo, StateDiff } from '../types/networking';

// ── Network Lifecycle ───────────────────────────────────────────────────────

/** Start the P2P networking subsystem. Returns our PeerId. */
export async function startNetwork(): Promise<string> {
  return invoke<string>('start_network');
}

/** Stop the P2P networking subsystem. */
export async function stopNetwork(): Promise<void> {
  return invoke<void>('stop_network');
}

// ── Peer Information ────────────────────────────────────────────────────────

/** Get this node's LibP2P peer ID. */
export async function getPeerId(): Promise<string | null> {
  return invoke<string | null>('get_peer_id');
}

/** Get the list of currently connected peers. */
export async function getConnectedPeers(): Promise<PeerInfo[]> {
  return invoke<PeerInfo[]>('get_connected_peers');
}

// ── Sector Management ───────────────────────────────────────────────────────

/** Announce this node as the host for a given sector. */
export async function hostSector(sectorId: string): Promise<void> {
  return invoke<void>('host_sector', { sectorId });
}

// ── State Broadcasting ──────────────────────────────────────────────────────

/** Broadcast a serialized state diff to all connected visitors. */
export async function broadcastState(diff: StateDiff): Promise<void> {
  const diffJson = JSON.stringify(diff);
  return invoke<void>('broadcast_state', { diffJson });
}

// ── Event Listeners ─────────────────────────────────────────────────────────

export interface NetworkEventCallbacks {
  onStatusChange?: (payload: { status: string; peerId?: string }) => void;
  onPeerJoined?: (payload: { peerId: string }) => void;
  onPeerLeft?: (payload: { peerId: string }) => void;
  onSectorHosted?: (payload: { peerId: string; sectorId: string }) => void;
  onStateUpdate?: (payload: { diff: string }) => void;
}

/**
 * Subscribe to all network events from the Rust backend.
 * Returns an unlisten function to tear down all subscriptions.
 */
export async function subscribeToNetworkEvents(
  callbacks: NetworkEventCallbacks,
): Promise<UnlistenFn> {
  const unlisteners: UnlistenFn[] = [];

  if (callbacks.onStatusChange) {
    const cb = callbacks.onStatusChange;
    unlisteners.push(
      await listen('network://status', (event) => {
        cb(event.payload as { status: string; peerId?: string });
      }),
    );
  }

  if (callbacks.onPeerJoined) {
    const cb = callbacks.onPeerJoined;
    unlisteners.push(
      await listen('network://peer-joined', (event) => {
        cb(event.payload as { peerId: string });
      }),
    );
  }

  if (callbacks.onPeerLeft) {
    const cb = callbacks.onPeerLeft;
    unlisteners.push(
      await listen('network://peer-left', (event) => {
        cb(event.payload as { peerId: string });
      }),
    );
  }

  if (callbacks.onSectorHosted) {
    const cb = callbacks.onSectorHosted;
    unlisteners.push(
      await listen('network://sector-hosted', (event) => {
        cb(event.payload as { peerId: string; sectorId: string });
      }),
    );
  }

  if (callbacks.onStateUpdate) {
    const cb = callbacks.onStateUpdate;
    unlisteners.push(
      await listen('network://state-update', (event) => {
        cb(event.payload as { diff: string });
      }),
    );
  }

  return () => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  };
}
