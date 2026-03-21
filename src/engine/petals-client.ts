/**
 * Petals Client – TypeScript wrappers around the Tauri Rust commands
 * for distributed LLM inference via a Petals-style relay.
 *
 * Mirrors the pattern established by `ollama-client.ts`: all actual
 * network I/O lives in Rust; this module provides typed, error-handled
 * wrappers for the frontend.
 */

import { invoke } from '@tauri-apps/api/core';
import type { PeerCapability } from '../types/networking';

/** Join the distributed model swarm (Petals network). */
export async function connectToPetalsSwarm(): Promise<boolean> {
  try {
    return await invoke<boolean>('connect_petals_swarm');
  } catch (error) {
    console.error('[BRAIN-DEV] Failed to connect to Petals swarm:', error);
    return false;
  }
}

/** Leave the distributed model swarm. */
export async function disconnectFromPetalsSwarm(): Promise<void> {
  try {
    await invoke<void>('disconnect_petals_swarm');
  } catch (error) {
    console.error('[BRAIN-DEV] Failed to disconnect from Petals swarm:', error);
  }
}

/**
 * Send a prompt to the distributed Petals relay for inference.
 * Returns the generated text, or `null` if the request fails.
 */
export async function generateDistributed(model: string, prompt: string): Promise<string | null> {
  try {
    return await invoke<string>('generate_distributed', { model, prompt });
  } catch (error) {
    console.error('[BRAIN-DEV] Distributed inference failed:', error);
    return null;
  }
}

/** Announce this peer's GPU capacity to the swarm. */
export async function reportCapability(vramMb: number, layersHosted: number): Promise<void> {
  try {
    await invoke<void>('report_capability', { vramMb, layersHosted });
  } catch (error) {
    console.error('[BRAIN-DEV] Failed to report capability:', error);
  }
}

/** Retrieve all peers' reported GPU capabilities. */
export async function getPeerCapabilities(): Promise<PeerCapability[]> {
  try {
    return await invoke<PeerCapability[]>('get_peer_capabilities');
  } catch {
    return [];
  }
}
