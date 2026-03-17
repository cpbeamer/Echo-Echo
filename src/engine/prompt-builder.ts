/**
 * Prompt Builder – constructs the DNA mutation prompt from a template.
 *
 * Injects agent context (DNA vector, lore-cache, lingo) and the data bomb
 * text into the static prompt template.
 */

import type { Agent } from '../types';

// Static prompt template (kept in sync with src/engine/prompts/dna-mutation.txt)
const TEMPLATE = `You are the cognitive engine of an autonomous agent in the Synaptic Sandbox simulation.
Your job is to analyze new information ("Data Bomb" text) and determine how it shifts the agent's personality and worldview.

## The Agent's Current State

**DNA Vector** (each axis is scored 0.0 to 1.0):
- Analytical (0) ↔ Emotional (1): {{analytical_emotional}}
- Altruistic (0) ↔ Selfish (1): {{altruistic_selfish}}
- Order (0) ↔ Chaos (1): {{order_chaos}}

**Recent Memory (Lore-Cache):**
{{lore_cache}}

**Current Lingo (Slang Dictionary):**
{{lingo}}

## The Data Bomb

The agent has just been exposed to the following information:

---
{{data_bomb_text}}
---

## Your Task

Analyze the Data Bomb text and determine:
1. **How the agent's DNA vector should shift** based on the themes, arguments, and tone of the text. Return small deltas (between -0.15 and 0.15) for each axis. Only shift axes that are clearly influenced by the text.
2. **A short lore entry** summarizing what the agent "learned" or "felt" from this data (max 1-2 sentences).
3. **New slang/lingo** the agent might adopt — creative portmanteaus or phrases inspired by the text's themes (0-2 entries). These should be pronounceable, memorable, and blend concepts from the text.

## Response Format

Respond with ONLY a single JSON object. No explanations, no markdown, no extra text.

{
  "vectorDelta": {
    "analytical_emotional": 0.0,
    "altruistic_selfish": 0.0,
    "order_chaos": 0.0
  },
  "newLore": ["A one-sentence summary of what the agent internalized."],
  "newLingo": {
    "term": "meaning"
  }
}

Rules:
- vectorDelta values MUST be between -0.15 and 0.15
- newLore MUST be an array of 1-2 short strings
- newLingo MUST be an object with 0-2 entries
- Do NOT include any text outside the JSON object`;

/**
 * Build a DNA mutation prompt by injecting agent context into the template.
 */
export function buildMutationPrompt(agent: Agent, dataBombText: string): string {
  const loreCacheStr =
    agent.loreCache.length > 0
      ? agent.loreCache.map((e, i) => `${i + 1}. ${e}`).join('\n')
      : '(empty — no prior memories)';

  const lingoEntries = Object.entries(agent.lingo);
  const lingoStr =
    lingoEntries.length > 0
      ? lingoEntries.map(([term, meaning]) => `- "${term}": ${meaning}`).join('\n')
      : '(empty — no slang adopted yet)';

  return TEMPLATE.replace('{{analytical_emotional}}', agent.vector.analytical_emotional.toFixed(2))
    .replace('{{altruistic_selfish}}', agent.vector.altruistic_selfish.toFixed(2))
    .replace('{{order_chaos}}', agent.vector.order_chaos.toFixed(2))
    .replace('{{lore_cache}}', loreCacheStr)
    .replace('{{lingo}}', lingoStr)
    .replace('{{data_bomb_text}}', dataBombText);
}
