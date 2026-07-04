import { describe, it, expect } from 'vitest';
import { analyzeReadingLevel } from '../../utils/readingLevel';

describe('analyzeReadingLevel', () => {
  it('returns easy for simple text', () => {
    const result = analyzeReadingLevel('The cat sat on the mat. It was a good day.');
    expect(result.level).toBe('easy');
    expect(result.score).toBeGreaterThan(60);
  });

  it('returns advanced for medium-to-complex text', () => {
    const result = analyzeReadingLevel(
      'The implementation of the software architecture requires careful consideration of the various dependencies and their potential impact on system performance and maintainability over time.'
    );
    // Long sentence with multi-syllable words scores low on Flesch
    expect(result.level).toBe('advanced');
    expect(result.score).toBeLessThan(30);
  });

  it('returns advanced for complex academic text', () => {
    const result = analyzeReadingLevel(
      'The epistemological ramifications of quantum indeterminacy necessitate a fundamental reconceptualization of ontological presuppositions inherent in classical metaphysical frameworks, particularly regarding the phenomenological constitution of observational objectivity.'
    );
    expect(result.level).toBe('advanced');
    expect(result.score).toBeLessThan(30);
  });

  it('handles empty text gracefully', () => {
    const result = analyzeReadingLevel('');
    expect(result.score).toBe(100);
    expect(result.level).toBe('easy');
    expect(result.grade).toBe('K');
  });

  it('handles single word', () => {
    const result = analyzeReadingLevel('Hello.');
    // Single two-syllable word in one sentence — formula yields moderate
    expect(['easy', 'moderate']).toContain(result.level);
  });

  it('returns a numeric score between 0 and 100', () => {
    const result = analyzeReadingLevel('This is a test sentence with some words in it.');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns a grade string', () => {
    const result = analyzeReadingLevel('The project schedule indicates several delays in the critical path that require immediate attention from the management team.');
    expect(typeof result.grade).toBe('string');
    expect(result.grade.length).toBeGreaterThan(0);
  });
});
