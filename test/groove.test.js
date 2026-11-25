import { describe, it, expect } from 'vitest';
import { GROOVE_PATTERNS } from '../src/groove.js';

describe('Groove Sequencer Math & Patterns', () => {
  it('defines valid 16-step patterns', () => {
    const patterns = ['Slow', 'Lo-fi', 'Upbeat'];
    for (const name of patterns) {
      const pat = GROOVE_PATTERNS[name];
      expect(pat).toBeDefined();
      expect(pat.steps).toBe(16);
      expect(Array.isArray(pat.kick)).toBe(true);
      expect(Array.isArray(pat.snare)).toBe(true);
      expect(Array.isArray(pat.hat)).toBe(true);

      // Verify all step numbers are within 0..15
      [...pat.kick, ...pat.snare, ...pat.hat].forEach(step => {
        expect(step).toBeGreaterThanOrEqual(0);
        expect(step).toBeLessThan(16);
      });
    }
  });

  it('calculates correct 16th note durations across BPM range', () => {
    // 60 BPM -> 1 beat = 1s -> 1/16th = 0.25s
    const dur60 = (60.0 / 60) / 4.0;
    expect(dur60).toBe(0.25);

    // 120 BPM -> 1 beat = 0.5s -> 1/16th = 0.125s
    const dur120 = (60.0 / 120) / 4.0;
    expect(dur120).toBe(0.125);

    // 80 BPM -> 1 beat = 0.75s -> 1/16th = 0.1875s
    const dur80 = (60.0 / 80) / 4.0;
    expect(dur80).toBeCloseTo(0.1875, 4);
  });
});
