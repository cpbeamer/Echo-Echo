/**
 * Synaptic Sandbox – Shared Game Logic Engine
 */

export { createAgent, createAgents, createChildAgent, dnaToColor, resetAgentIdCounter } from './agent-factory';
export { classifyFaction, areOpposingFactions, FACTION_META } from './factions';
export { mutateAgentFromText, applyDNAUpdate } from './dna-mutation';
export { attemptMemeSwap, ideologicalSimilarity, processMemeSwaps } from './meme-swap';
export type { MemeSwapResult } from './meme-swap';
export { detectConflicts, resolveConflict } from './conflict';
export { tickPhysics } from './physics';

// Epic 1.3 – Brain / LLM Integration
export { detectOllama, listModels, generateCompletion } from './ollama-client';
export { parseDNAResponse } from './dna-parser';
export { truncateLoreCache, estimateTokens, estimateLoreCacheTokens } from './context-truncator';
export { ThoughtOrchestrator } from './thought-orchestrator';
export { buildMutationPrompt } from './prompt-builder';

// Epic 1.4 – Data Bombs
export { findAgentsInBlastRadius, detonateDataBomb, detonateAmnesiaBomb, manhattanDistance } from './blast-radius';

// Epic 1.5 – HUD & Observation
export { clusterAgents, extractLingoCloud, computeLingoClusters } from './lingo-cloud';

// Epic 2.1 – Agent Life Cycle
export { tickEnergy, updateAdjacencyTicks, tickReproduction, applyNaturalSelection } from './lifecycle';

// Epic 2.2 – Persistent Memory
export { addMemory, retrieveRelevantMemories, clearMemory, extractKeywords } from './memory-store';

// Epic 3.0 – P2P Networking
export { serializeAgent, deserializeAgent, computeStateDiff, applyStateDiff } from './state-sync';
export {
  startNetwork,
  stopNetwork,
  getPeerId,
  getConnectedPeers,
  hostSector,
  broadcastState,
  subscribeToNetworkEvents,
  spawnSectorCmd,
  removeSectorCmd,
  getSectors,
} from './network-manager';
export { SectorHost, serializeFullState } from './sector-host';
export { SectorVisitor } from './sector-visitor';

// Epic 3.1 – Sector Expansion
export { SectorManager } from './sector-manager';
export {
  detectMigrationCandidates,
  migrateAgent,
  receiveMigratedAgent,
} from './agent-migration';

// Epic 3.2 – Faction Warfare
export {
  createInitialFactionProgress,
  computeFactionProgress,
  applyComputeBoost,
  startManifestoDefusal,
  contributeToDefusal,
  resolveDefusal,
  checkContestedSector,
} from './faction-warfare';

// Epic 3.3 – Distributed Inference
export {
  connectToPetalsSwarm,
  disconnectFromPetalsSwarm,
  generateDistributed,
  reportCapability,
  getPeerCapabilities,
} from './petals-client';
export {
  classifyInferenceRequest,
  selectInferencePeer,
  distributeRequests,
  computePeerLoad,
} from './inference-load-balancer';

// Epic 4.0 – The Lingo-Gen
export { buildLingoGenPrompt, extractThemes } from './lingo-gen-prompt';
export { computeLingoLeaderboard } from './lingo-leaderboard';
