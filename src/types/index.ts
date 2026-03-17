/**
 * Synaptic Sandbox – Shared Type Definitions
 */

export type {
  AgentDNA,
  Agent,
  DNAVector,
  DNAUpdate,
  Faction,
  Vec2,
  SimulationConfig,
  DataBomb,
  DataBombRecord,
  Shockwave,
} from './agent';

export { DEFAULT_CONFIG } from './agent';

export type { BrainSettings, OllamaStatus } from './brain';

export { DEFAULT_BRAIN_SETTINGS } from './brain';

export type {
  SimulationEvent,
  MemeSwapEvent,
  ConflictEvent,
  FactionChangeEvent,
  DataBombEvent,
  AgentDeathEvent,
  LingoCluster,
  LingoTerm,
} from './hud';
