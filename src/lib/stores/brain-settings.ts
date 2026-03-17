/**
 * Brain Settings Store – Svelte 5 reactive state for LLM configuration.
 *
 * Persists settings to localStorage. Manages Ollama connection status
 * and available model list.
 */

import type { BrainSettings, OllamaStatus } from '../../types';
import { DEFAULT_BRAIN_SETTINGS } from '../../types';
import { detectOllama, listModels } from '../../engine/ollama-client';

const STORAGE_KEY = 'synaptic-sandbox-brain-settings';

class BrainSettingsState {
  settings: BrainSettings = $state({ ...DEFAULT_BRAIN_SETTINGS });
  ollamaStatus: OllamaStatus = $state('disconnected');
  availableModels: string[] = $state([]);

  constructor() {
    this.loadFromStorage();
  }

  /** Load settings from localStorage if available. */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<BrainSettings>;
        this.settings = { ...DEFAULT_BRAIN_SETTINGS, ...parsed };
      }
    } catch {
      // Corrupt storage — use defaults
      this.settings = { ...DEFAULT_BRAIN_SETTINGS };
    }
  }

  /** Persist current settings to localStorage. */
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      console.error('[BRAIN-DEV] Failed to persist brain settings');
    }
  }

  /** Update a setting and persist. */
  update(partial: Partial<BrainSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.saveToStorage();
  }

  /** Check Ollama connectivity and refresh the model list. */
  async refreshOllamaStatus(): Promise<void> {
    this.ollamaStatus = 'checking';

    const isRunning = await detectOllama();
    if (isRunning) {
      this.ollamaStatus = 'connected';
      this.availableModels = await listModels();

      // Auto-select first model if none is set
      if (!this.settings.ollamaModel && this.availableModels.length > 0) {
        this.update({ ollamaModel: this.availableModels[0] });
      }
    } else {
      this.ollamaStatus = 'disconnected';
      this.availableModels = [];
    }
  }

  /** Set the active model. */
  setModel(model: string): void {
    this.update({ ollamaModel: model });
  }

  /** Set the concurrency limit. */
  setConcurrency(max: number): void {
    this.update({ maxConcurrency: Math.max(1, Math.min(10, max)) });
  }

  /** Toggle auto-think on/off. */
  toggleAutoThink(): void {
    this.update({ autoThink: !this.settings.autoThink });
  }
}

export const brainSettings = new BrainSettingsState();
