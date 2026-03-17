import { describe, it, expect } from 'vitest';
import { parseDNAResponse } from '../src/engine/dna-parser';

describe('DNAParser', () => {
  it('parses a well-formed JSON response', () => {
    const raw = JSON.stringify({
      vectorDelta: {
        analytical_emotional: 0.1,
        altruistic_selfish: -0.05,
        order_chaos: 0.0,
      },
      newLore: ['Learned about revolutionary ideals.'],
      newLingo: { 'Sec-Jedi': 'A security-focused leader' },
    });

    const result = parseDNAResponse(raw);

    expect(result).not.toBeNull();
    expect(result!.vectorDelta.analytical_emotional).toBeCloseTo(0.1);
    expect(result!.vectorDelta.altruistic_selfish).toBeCloseTo(-0.05);
    expect(result!.newLore).toEqual(['Learned about revolutionary ideals.']);
    expect(result!.newLingo['Sec-Jedi']).toBe('A security-focused leader');
  });

  it('extracts JSON from markdown code fences', () => {
    const raw = `Here is the result:

\`\`\`json
{
  "vectorDelta": { "order_chaos": 0.08 },
  "newLore": ["The agent internalized order."],
  "newLingo": {}
}
\`\`\`

That's it.`;

    const result = parseDNAResponse(raw);

    expect(result).not.toBeNull();
    expect(result!.vectorDelta.order_chaos).toBeCloseTo(0.08);
    expect(result!.newLore).toHaveLength(1);
  });

  it('extracts JSON from raw braces surrounded by text', () => {
    const raw = `Sure! Here is the update:
{"vectorDelta":{"analytical_emotional":-0.1},"newLore":["Processed data."],"newLingo":{}}
Hope that helps!`;

    const result = parseDNAResponse(raw);

    expect(result).not.toBeNull();
    expect(result!.vectorDelta.analytical_emotional).toBeCloseTo(-0.1);
  });

  it('returns null for completely garbled output', () => {
    const result = parseDNAResponse('This is not JSON at all, just random text!');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseDNAResponse('');
    expect(result).toBeNull();
  });

  it('returns null when newLore is missing or empty', () => {
    const raw = JSON.stringify({
      vectorDelta: { order_chaos: 0.05 },
      newLore: [],
      newLingo: {},
    });

    const result = parseDNAResponse(raw);
    expect(result).toBeNull();
  });

  it('clamps vector deltas exceeding the maximum', () => {
    const raw = JSON.stringify({
      vectorDelta: { analytical_emotional: 0.5, order_chaos: -0.9 },
      newLore: ['A dramatic shift.'],
      newLingo: {},
    });

    const result = parseDNAResponse(raw);

    expect(result).not.toBeNull();
    expect(result!.vectorDelta.analytical_emotional).toBe(0.15);
    expect(result!.vectorDelta.order_chaos).toBe(-0.15);
  });

  it('ignores unknown vector axes', () => {
    const raw = JSON.stringify({
      vectorDelta: { analytical_emotional: 0.1, fake_axis: 0.5 },
      newLore: ['Some learning.'],
      newLingo: {},
    });

    const result = parseDNAResponse(raw);

    expect(result).not.toBeNull();
    expect(result!.vectorDelta.analytical_emotional).toBeCloseTo(0.1);
    // fake_axis should not appear
    expect(Object.keys(result!.vectorDelta)).not.toContain('fake_axis');
  });

  it('limits newLore to 2 entries', () => {
    const raw = JSON.stringify({
      vectorDelta: {},
      newLore: ['Entry 1', 'Entry 2', 'Entry 3', 'Entry 4'],
      newLingo: {},
    });

    const result = parseDNAResponse(raw);

    expect(result).not.toBeNull();
    expect(result!.newLore).toHaveLength(2);
  });

  it('limits newLingo to 2 entries', () => {
    const raw = JSON.stringify({
      vectorDelta: {},
      newLore: ['Something.'],
      newLingo: { a: '1', b: '2', c: '3', d: '4' },
    });

    const result = parseDNAResponse(raw);

    expect(result).not.toBeNull();
    expect(Object.keys(result!.newLingo).length).toBeLessThanOrEqual(2);
  });
});
