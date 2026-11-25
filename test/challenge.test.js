import { describe, it, expect } from 'vitest';
import { getComboMultiplier, calculatePoints } from '../src/modes/challenge.js';

describe('Challenge Mode Scoring & Combo Logic', () => {
  it('calculates correct combo multipliers', () => {
    expect(getComboMultiplier(0)).toBe(1);
    expect(getComboMultiplier(1)).toBe(1);
    expect(getComboMultiplier(4)).toBe(1);
    expect(getComboMultiplier(5)).toBe(2);
    expect(getComboMultiplier(9)).toBe(2);
    expect(getComboMultiplier(10)).toBe(3);
    expect(getComboMultiplier(19)).toBe(3);
    expect(getComboMultiplier(20)).toBe(4);
    expect(getComboMultiplier(50)).toBe(4);
  });

  it('calculates points scaled by combo multiplier', () => {
    // 100 base points
    expect(calculatePoints(100, 0)).toBe(100);
    expect(calculatePoints(100, 4)).toBe(100);
    expect(calculatePoints(100, 5)).toBe(200);
    expect(calculatePoints(100, 10)).toBe(300);
    expect(calculatePoints(100, 20)).toBe(400);
  });
});
