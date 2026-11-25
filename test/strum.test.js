import { describe, it, expect } from 'vitest';
import { calculateStrumFalloff } from '../src/strings.js';

describe('Open-Hand Strum Velocity Falloff', () => {
  it('preserves full base strength on first string pluck', () => {
    const base = 0.8;
    expect(calculateStrumFalloff(base, 0)).toBeCloseTo(0.8, 2);
  });

  it('falls off smoothly for additional strings crossed within 150ms', () => {
    const base = 1.0;
    // 1 additional string: 1.0 - 1*0.12 = 0.88
    expect(calculateStrumFalloff(base, 1)).toBeCloseTo(0.88, 2);
    // 2 additional strings: 1.0 - 2*0.12 = 0.76
    expect(calculateStrumFalloff(base, 2)).toBeCloseTo(0.76, 2);
    // 3 additional strings: 1.0 - 3*0.12 = 0.64
    expect(calculateStrumFalloff(base, 3)).toBeCloseTo(0.64, 2);
  });

  it('clamps to minimum bound to maintain audible tactile clarity', () => {
    const base = 0.8;
    // 10 strings crossed in rapid succession
    const falloff = calculateStrumFalloff(base, 10);
    expect(falloff).toBeGreaterThanOrEqual(base * 0.45);
  });
});
