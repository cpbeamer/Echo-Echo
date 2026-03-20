/**
 * Lingo-Gen Prompt – Dedicated prompt builder for portmanteau slang generation.
 *
 * Instructs the LLM to create creative, pronounceable portmanteau terms by
 * blending concepts from a set of thematic keywords. This prompt is used for
 * richer, standalone lingo generation beyond the standard DNA mutation pipeline.
 */

/**
 * Build a prompt that instructs the LLM to generate creative portmanteau slang
 * terms from a set of thematic keywords.
 *
 * @param themes – Keywords or short phrases representing the data bomb themes.
 * @param existingLingo – The agent's current lingo dictionary to avoid duplicates.
 * @returns The fully assembled prompt string.
 */
export function buildLingoGenPrompt(
  themes: string[],
  existingLingo: Record<string, string>,
): string {
  const themesStr =
    themes.length > 0 ? themes.map((t) => `- ${t}`).join('\n') : '- (general conversation)';

  const existingKeys = Object.keys(existingLingo);
  const excludeStr =
    existingKeys.length > 0
      ? existingKeys.map((k) => `"${k}"`).join(', ')
      : '(none — no existing terms)';

  return LINGO_GEN_TEMPLATE.replace('{{themes}}', themesStr).replace(
    '{{existing_lingo}}',
    excludeStr,
  );
}

/** Common stop words filtered out during theme extraction (module-level to avoid per-call allocation). */
const STOP_WORDS = new Set([
  'this',
  'that',
  'with',
  'from',
  'they',
  'have',
  'been',
  'will',
  'would',
  'could',
  'should',
  'their',
  'there',
  'were',
  'what',
  'when',
  'where',
  'which',
  'about',
  'into',
  'more',
  'than',
  'then',
  'them',
  'some',
  'also',
  'just',
  'very',
  'much',
  'each',
  'only',
  'other',
  'like',
  'over',
  'such',
  'after',
  'before',
  'between',
  'through',
  'does',
  'done',
  'make',
  'made',
  'being',
  'because',
]);

/**
 * Extract theme keywords from raw data bomb text using simple frequency analysis.
 * Returns the top-N most distinctive words (length ≥ 4, excluding stop words).
 */
export function extractThemes(text: string, topN: number = 6): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));

  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

const LINGO_GEN_TEMPLATE = `You are a creative language engine for the Synaptic Sandbox simulation.
Your job is to invent new slang terms by blending the given themes into catchy, pronounceable portmanteaus.

## Rules for Portmanteau Generation

1. **Blend 2+ theme words** into a single pronounceable word (e.g., "security" + "Jedi" → "Sec-Jedi").
2. Terms MUST be **pronounceable** — they should sound natural when spoken aloud.
3. Terms should be **memorable** and **evocative** of the source themes.
4. Each term needs a short, punchy **definition** (max 8 words).
5. Do NOT duplicate any of the agent's existing terms.
6. Generate exactly **2 to 4** new terms.

## Themes to Blend

{{themes}}

## Existing Terms to Avoid Duplicating

{{existing_lingo}}

## Response Format

Respond with ONLY a JSON object. No explanations, no markdown, no extra text.

{
  "newLingo": {
    "TermOne": "short definition here",
    "TermTwo": "short definition here"
  }
}

Rules:
- newLingo MUST be an object with 2-4 entries
- Each key is the portmanteau term, each value is the definition
- Do NOT include any text outside the JSON object`;
