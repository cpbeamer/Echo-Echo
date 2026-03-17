/**
 * Brain-related type definitions for LLM integration.
 */

/** Ollama connection status. */
export type OllamaStatus = 'connected' | 'disconnected' | 'checking';

/** Persistent settings for the Brain / LLM subsystem. */
export interface BrainSettings {
  /** Which Ollama model to use for agent "thought" requests. */
  ollamaModel: string;
  /** Maximum number of concurrent LLM requests. */
  maxConcurrency: number;
  /** When true, agents think continuously each tick cycle. */
  autoThink: boolean;
  /** Token budget for lore-cache before truncation kicks in. */
  tokenBudget: number;
}

/** Sensible defaults for a first-time user. */
export const DEFAULT_BRAIN_SETTINGS: BrainSettings = {
  ollamaModel: '',
  maxConcurrency: 3,
  autoThink: false,
  tokenBudget: 512,
};
