/**
 * Synaptic Sandbox – Shared Game Logic Engine
 */

export { createAgent, createAgents, dnaToColor, resetAgentIdCounter } from './agent-factory';
export { classifyFaction, areOpposingFactions, FACTION_META } from './factions';
export { mutateAgentFromText, applyDNAUpdate } from './dna-mutation';
export { attemptMemeSwap, ideologicalSimilarity, processMemeSwaps } from './meme-swap';
export { detectConflicts, resolveConflict } from './conflict';
export { tickPhysics } from './physics';
