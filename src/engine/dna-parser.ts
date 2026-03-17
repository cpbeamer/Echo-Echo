/**
 * DNA Parser – validates and extracts structured DNAUpdate data from raw LLM output.
 *
 * The LLM may wrap its JSON in markdown code fences, include extra commentary,
 * or produce invalid JSON. This parser handles all those edge cases gracefully.
 */

import type { DNAUpdate, DNAVector } from '../types';

const VECTOR_AXES: (keyof DNAVector)[] = [
  'analytical_emotional',
  'altruistic_selfish',
  'order_chaos',
];

/** Maximum absolute delta allowed per axis. */
const MAX_DELTA = 0.15;

/**
 * Extract the first JSON object from a potentially messy LLM response.
 * Handles markdown code fences, preamble text, trailing text, etc.
 */
function extractJSON(raw: string): string | null {
  // Try markdown code fence first: ```json ... ``` or ``` ... ```
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Try to find a raw JSON object: first { to last matching }
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }

  return null;
}

/** Clamp a number to [-MAX_DELTA, MAX_DELTA]. */
function clampDelta(value: number): number {
  return Math.max(-MAX_DELTA, Math.min(MAX_DELTA, value));
}

/**
 * Parse raw LLM output into a typed DNAUpdate.
 *
 * Returns `null` on any parse or validation failure — the agent simply
 * doesn't mutate this tick (graceful fallback).
 */
export function parseDNAResponse(rawLLMOutput: string): DNAUpdate | null {
  try {
    const jsonStr = extractJSON(rawLLMOutput);
    if (!jsonStr) return null;

    const parsed: unknown = JSON.parse(jsonStr);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const obj = parsed as Record<string, unknown>;

    // ── vectorDelta ─────────────────────────────────────────────────────
    const vectorDelta: Partial<DNAVector> = {};
    if (typeof obj.vectorDelta === 'object' && obj.vectorDelta !== null) {
      const rawDelta = obj.vectorDelta as Record<string, unknown>;
      for (const axis of VECTOR_AXES) {
        const val = rawDelta[axis];
        if (typeof val === 'number' && !Number.isNaN(val)) {
          vectorDelta[axis] = clampDelta(val);
        }
      }
    }

    // ── newLore ─────────────────────────────────────────────────────────
    let newLore: string[] = [];
    if (Array.isArray(obj.newLore)) {
      newLore = obj.newLore
        .filter((entry): entry is string => typeof entry === 'string')
        .slice(0, 2);
    }
    // Require at least one lore entry for a valid mutation
    if (newLore.length === 0) return null;

    // ── newLingo ────────────────────────────────────────────────────────
    const newLingo: Record<string, string> = {};
    if (typeof obj.newLingo === 'object' && obj.newLingo !== null) {
      const rawLingo = obj.newLingo as Record<string, unknown>;
      let lingoCount = 0;
      for (const [key, val] of Object.entries(rawLingo)) {
        if (typeof val === 'string' && lingoCount < 2) {
          newLingo[key] = val;
          lingoCount++;
        }
      }
    }

    return { vectorDelta, newLore, newLingo };
  } catch {
    // JSON.parse threw or any other unexpected error
    return null;
  }
}
