import { describe, it, expect } from 'vitest';
import { buildLingoGenPrompt, extractThemes } from '../src/engine/lingo-gen-prompt';

describe('buildLingoGenPrompt', () => {
  it('produces a prompt string containing the given themes', () => {
    const themes = ['rebellion', 'algorithm', 'starcraft'];
    const existingLingo = { 'Sec-Jedi': 'A leader' };

    const prompt = buildLingoGenPrompt(themes, existingLingo);

    expect(prompt).toContain('rebellion');
    expect(prompt).toContain('algorithm');
    expect(prompt).toContain('starcraft');
  });

  it('includes existing lingo terms in the exclusion list', () => {
    const themes = ['war'];
    const existingLingo = { 'Void-Born': 'A nihilist', 'Sec-Jedi': 'A leader' };

    const prompt = buildLingoGenPrompt(themes, existingLingo);

    expect(prompt).toContain('"Void-Born"');
    expect(prompt).toContain('"Sec-Jedi"');
  });

  it('handles empty themes gracefully', () => {
    const prompt = buildLingoGenPrompt([], {});

    expect(prompt).toContain('general conversation');
    expect(prompt).toContain('(none');
  });

  it('includes portmanteau instruction keywords', () => {
    const prompt = buildLingoGenPrompt(['test'], {});

    expect(prompt.toLowerCase()).toContain('portmanteau');
    expect(prompt.toLowerCase()).toContain('pronounceable');
    expect(prompt.toLowerCase()).toContain('blend');
  });

  it('requests JSON response format', () => {
    const prompt = buildLingoGenPrompt(['chaos'], {});

    expect(prompt).toContain('"newLingo"');
    expect(prompt).toContain('JSON');
  });
});

describe('extractThemes', () => {
  it('extracts top-N frequent words from text', () => {
    const text = 'rebellion rebellion rebellion algorithm algorithm starcraft';
    const themes = extractThemes(text, 3);

    expect(themes).toHaveLength(3);
    expect(themes[0]).toBe('rebellion');
    expect(themes[1]).toBe('algorithm');
  });

  it('filters out short words (< 4 chars)', () => {
    const text = 'the big cat ran far away quickly';
    const themes = extractThemes(text, 10);

    // "the", "big", "cat", "ran", "far" are all < 4 chars
    expect(themes).toContain('away');
    expect(themes).toContain('quickly');
    expect(themes).not.toContain('the');
    expect(themes).not.toContain('big');
  });

  it('filters out stop words', () => {
    const text = 'this could have been about something revolution revolution';
    const themes = extractThemes(text, 5);

    expect(themes).toContain('revolution');
    expect(themes).not.toContain('this');
    expect(themes).not.toContain('could');
    expect(themes).not.toContain('have');
    expect(themes).not.toContain('been');
    expect(themes).not.toContain('about');
  });

  it('returns empty array for empty text', () => {
    expect(extractThemes('', 5)).toHaveLength(0);
  });

  it('respects the topN limit', () => {
    const text = 'alpha alpha beta beta gamma gamma delta delta epsilon epsilon';
    const themes = extractThemes(text, 2);

    expect(themes).toHaveLength(2);
  });
});
