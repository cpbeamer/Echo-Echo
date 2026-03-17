/**
 * DNA Mutation – shift agent personality vectors based on ingested text.
 *
 * This is the "local" mutation logic that runs before/without LLM involvement.
 * It uses simple keyword heuristics to determine which axes to shift.
 * The LLM pipeline (Epic 1.3) will produce structured DNAUpdate objects
 * that are applied via applyDNAUpdate().
 */

import type { Agent, DNAUpdate, DNAVector } from '../types';
import { classifyFaction } from './factions';
import { dnaToColor } from './agent-factory';

/** Clamp a number to [0, 1]. */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Simple keyword dictionaries for heuristic mutation (pre-LLM fallback)
const ORDER_KEYWORDS = [
  'order',
  'law',
  'structure',
  'discipline',
  'hierarchy',
  'rules',
  'control',
  'system',
  'regulation',
  'stability',
];
const CHAOS_KEYWORDS = [
  'chaos',
  'freedom',
  'anarchy',
  'rebellion',
  'revolution',
  'disorder',
  'random',
  'wild',
  'disrupt',
  'break',
];
const ALTRUISM_KEYWORDS = [
  'share',
  'help',
  'community',
  'together',
  'give',
  'cooperate',
  'unity',
  'collective',
  'support',
  'care',
];
const SELFISH_KEYWORDS = [
  'mine',
  'power',
  'dominate',
  'conquer',
  'profit',
  'exploit',
  'compete',
  'win',
  'take',
  'own',
];
const ANALYTICAL_KEYWORDS = [
  'logic',
  'reason',
  'data',
  'evidence',
  'calculate',
  'analyze',
  'objective',
  'rational',
  'fact',
  'science',
];
const EMOTIONAL_KEYWORDS = [
  'feel',
  'heart',
  'passion',
  'love',
  'anger',
  'soul',
  'spirit',
  'believe',
  'faith',
  'emotion',
];

/** Count how many keywords from a list appear in the text (case-insensitive). */
function countKeywordHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((count, kw) => count + (lower.includes(kw) ? 1 : 0), 0);
}

/**
 * Heuristic mutation: analyze raw text and shift agent DNA accordingly.
 * delta controls the magnitude of each shift (default 0.05 per keyword hit).
 */
export function mutateAgentFromText(agent: Agent, rawText: string, delta: number = 0.05): void {
  const orderHits = countKeywordHits(rawText, ORDER_KEYWORDS);
  const chaosHits = countKeywordHits(rawText, CHAOS_KEYWORDS);
  const altruismHits = countKeywordHits(rawText, ALTRUISM_KEYWORDS);
  const selfishHits = countKeywordHits(rawText, SELFISH_KEYWORDS);
  const analyticalHits = countKeywordHits(rawText, ANALYTICAL_KEYWORDS);
  const emotionalHits = countKeywordHits(rawText, EMOTIONAL_KEYWORDS);

  // Shift axes toward the dominant keyword direction
  agent.vector.order_chaos = clamp01(agent.vector.order_chaos + (chaosHits - orderHits) * delta);
  agent.vector.altruistic_selfish = clamp01(
    agent.vector.altruistic_selfish + (selfishHits - altruismHits) * delta,
  );
  agent.vector.analytical_emotional = clamp01(
    agent.vector.analytical_emotional + (emotionalHits - analyticalHits) * delta,
  );

  // Append a summary to the lore-cache
  const preview = rawText.slice(0, 80).replace(/\n/g, ' ');
  agent.loreCache.push(`[Data Bomb] "${preview}..."`);

  // Trim lore-cache to max 10 entries
  if (agent.loreCache.length > 10) {
    agent.loreCache = agent.loreCache.slice(-10);
  }

  // Re-classify faction and update color
  agent.faction = classifyFaction(agent.vector);
  agent.color = dnaToColor(agent.vector);
}

/**
 * Apply a structured DNAUpdate (from LLM pipeline) to an agent.
 * Vector deltas are additive and clamped to [0, 1].
 */
export function applyDNAUpdate(agent: Agent, update: DNAUpdate): void {
  const axes: (keyof DNAVector)[] = ['analytical_emotional', 'altruistic_selfish', 'order_chaos'];

  for (const axis of axes) {
    const d = update.vectorDelta[axis];
    if (d !== undefined) {
      agent.vector[axis] = clamp01(agent.vector[axis] + d);
    }
  }

  // Append new lore entries
  agent.loreCache.push(...update.newLore);
  if (agent.loreCache.length > 10) {
    agent.loreCache = agent.loreCache.slice(-10);
  }

  // Merge new lingo
  Object.assign(agent.lingo, update.newLingo);

  // Re-classify faction and update color
  agent.faction = classifyFaction(agent.vector);
  agent.color = dnaToColor(agent.vector);
}
