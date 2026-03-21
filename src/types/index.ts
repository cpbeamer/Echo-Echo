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
  DnaFileHeader,
  DnaFileAgent,
  DnaFile,
  DnaImportOptions,
  DnaValidationResult,
} from './agent';

export { DEFAULT_CONFIG, DNA_FILE_VERSION } from './agent';

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
  MemeSwapResult,
  LingoSwapBubble,
  LingoLeaderboardEntry,
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
  InferencePriority,
  PeerCapability,
  InferenceRequest,
  InferenceResult,
  DistributedInferenceConfig,
  InferenceRoutedEvent,
  PeerCapacityEvent,
} from './networking';

export {
  DEFAULT_NETWORK_CONFIG,
  DEFAULT_SECTOR_EXPANSION_CONFIG,
  DEFAULT_FACTION_WARFARE_CONFIG,
  DEFAULT_DISTRIBUTED_INFERENCE_CONFIG,
} from './networking';
