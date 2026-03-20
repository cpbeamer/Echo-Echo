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
  DataBombType,
  Shockwave,
  MemoryEntry,
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
  AgentBirthEvent,
  AmnesiaBombEvent,
  ManifestoBombEvent,
  LingoCluster,
  LingoTerm,
} from './hud';

export type {
  PeerId,
  PeerRole,
  NetworkStatus,
  PeerInfo,
  SectorAssignment,
  SerializedAgent,
  StateDiff,
  AgentPatch,
  NetworkConfig,
  RemoteDataBomb,
  NetworkEvent,
  PeerJoinedEvent,
  PeerLeftEvent,
  SectorHostedEvent,
  BombReceivedEvent,
  SectorBounds,
  SectorInfo,
  SectorExpansionConfig,
  SectorSpawnedEvent,
  SectorRemovedEvent,
  AgentMigrationEvent,
  ComputeBoostEvent,
  ManifestoDefusalEvent,
  FactionProgress,
  ComputeBoost,
  ManifestoDefusal,
  FactionWarfareConfig,
} from './networking';

export {
  DEFAULT_NETWORK_CONFIG,
  DEFAULT_SECTOR_EXPANSION_CONFIG,
  DEFAULT_FACTION_WARFARE_CONFIG,
} from './networking';
