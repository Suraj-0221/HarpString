import { describe, it, expect } from 'vitest';
import { checkSegmentIntersection, distToSegment, StringManager, HarpString } from '../src/strings.js';

describe('Strings Geometry & Physics Unit Tests', () => {
  it('detects perpendicular segment intersection', () => {
    // String segment: (100, 200) to (300, 200) [horizontal]
    const stringA = { x: 100, y: 200 };
    const stringB = { x: 300, y: 200 };

    // Finger motion segment: (200, 150) to (200, 250) [vertical, crosses midpoint]
    const fingerPrev = { x: 200, y: 150 };
    const fingerCurr = { x: 200, y: 250 };

    const hit = checkSegmentIntersection(fingerPrev, fingerCurr, stringA, stringB);
    expect(hit).not.toBeNull();
    expect(hit.point.x).toBeCloseTo(200, 2);
    expect(hit.point.y).toBeCloseTo(200, 2);
    expect(hit.tString).toBeCloseTo(0.5, 2); // Crossed at midpoint
    expect(hit.tFinger).toBeCloseTo(0.5, 2);
  });

  it('returns null when segments do not cross', () => {
    const stringA = { x: 100, y: 200 };
    const stringB = { x: 300, y: 200 };

    // Motion parallel or above the string
    const fingerPrev = { x: 100, y: 100 };
    const fingerCurr = { x: 300, y: 100 };

    const hit = checkSegmentIntersection(fingerPrev, fingerCurr, stringA, stringB);
    expect(hit).toBeNull();
  });

  it('returns null when finger motion falls short of the string', () => {
    const stringA = { x: 100, y: 200 };
    const stringB = { x: 300, y: 200 };

    // Motion stops at y = 180 (string is at y = 200)
    const fingerPrev = { x: 200, y: 150 };
    const fingerCurr = { x: 200, y: 180 };

    const hit = checkSegmentIntersection(fingerPrev, fingerCurr, stringA, stringB);
    expect(hit).toBeNull();
  });

  it('calculates point to segment distance correctly', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 0 };

    // Point perpendicular to midpoint at (50, 30) -> dist = 30
    expect(distToSegment({ x: 50, y: 30 }, a, b)).toBeCloseTo(30, 2);

    // Point beyond endpoint b at (130, 40) -> dist to b (100, 0) = sqrt(30^2 + 40^2) = 50
    expect(distToSegment({ x: 130, y: 40 }, a, b)).toBeCloseTo(50, 2);
  });

  it('creates and locks preview string when released with sufficient length', () => {
    const mockAudioEngine = {
      mapLengthToPitch: (len, diag) => ({ frequency: 261.63, noteName: 'C4' }),
      playLockPop: () => {},
      playDeleteSound: () => {},
    };

    const manager = new StringManager(mockAudioEngine);
    expect(manager.strings.length).toBe(0);

    // Two pinch points 200px apart (>= 80px min length)
    const pA = { x: 100, y: 200 };
    const pB = { x: 300, y: 200 };

    manager.setPreview(pA, pB, 1280, 720);
    expect(manager.previewString).not.toBeNull();
    expect(manager.previewString.length).toBe(200);

    // Locking preview on pinch release
    const locked = manager.lockPreview(1280, 720);
    expect(locked).not.toBeNull();
    expect(locked.noteName).toBe('C4');
    expect(manager.strings.length).toBe(1);
    expect(manager.previewString).toBeNull();
  });

  it('cancels preview if string is too short (< 80px)', () => {
    const mockAudioEngine = {
      mapLengthToPitch: () => ({ frequency: 500, noteName: 'B4' }),
      playLockPop: () => {},
    };

    const manager = new StringManager(mockAudioEngine);
    manager.setPreview({ x: 100, y: 100 }, { x: 130, y: 100 }, 1280, 720); // 30px
    const locked = manager.lockPreview(1280, 720);
    expect(locked).toBeNull();
    expect(manager.strings.length).toBe(0);
  });
});
