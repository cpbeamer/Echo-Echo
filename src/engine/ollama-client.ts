/**
 * Ollama Client – TypeScript wrappers around the Tauri Rust commands.
 *
 * All Ollama HTTP communication lives in Rust (`src-tauri/src/ollama.rs`).
 * This module provides typed, error-handled wrappers for the frontend.
 */

import { invoke } from '@tauri-apps/api/core';

/** Check if a local Ollama instance is reachable. */
export async function detectOllama(): Promise<boolean> {
  try {
    return await invoke<boolean>('detect_ollama');
  } catch {
    return false;
  }
}

/** List available model names from the running Ollama instance. */
export async function listModels(): Promise<string[]> {
  try {
    return await invoke<string[]>('list_models');
  } catch {
    return [];
  }
}

/**
 * Send a prompt to Ollama and return the generated text.
 * Returns `null` if the request fails or the response schema is invalid.
 */
export async function generateCompletion(model: string, prompt: string): Promise<string | null> {
  try {
    const result = await invoke<unknown>('generate_completion', { model, prompt });
    if (typeof result !== 'string') {
      console.error('[BRAIN-DEV] Ollama response schema invalid: expected string, got', typeof result);
      return null;
    }
    return result;
  } catch (error) {
    console.error('[BRAIN-DEV] Ollama completion failed:', error);
    return null;
  }
}
