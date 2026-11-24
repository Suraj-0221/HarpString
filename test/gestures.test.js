import { describe, it, expect, beforeEach } from 'vitest';
import { GestureAnalyzer, dist } from '../src/gestures.js';

// Helper to generate 21 landmarks initialized at base coordinates
function createNeutralLandmarks() {
  const lms = [];
  for (let i = 0; i < 21; i++) {
    lms.push({ x: 100, y: 100 + i * 5 });
  }
  // Wrist [0] at (100, 100), Middle MCP [9] at (100, 200) -> handSize = 100
  lms[0] = { x: 100, y: 100 };
  lms[9] = { x: 100, y: 200 };
  return lms;
}

describe('Gesture Analyzer Unit Tests', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new GestureAnalyzer();
  });

  it('calculates distance correctly', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('detects pinch with hysteresis', () => {
    const lms = createNeutralLandmarks();
    // handSize = 100
    // Set thumb tip [4] and index tip [8] 25px apart -> ratio = 0.25 (< 0.30 enter)
    lms[4] = { x: 100, y: 150 };
    lms[8] = { x: 125, y: 150 };

    let res = analyzer.analyzeHand(lms, 'Right', 1000);
    expect(res.isPinching).toBe(true);
    expect(res.pinchRatio).toBeCloseTo(0.25, 2);

    // Hysteresis test: move tips to 38px apart -> ratio = 0.38
    // Should STAY true because exit ratio is 0.45
    lms[8] = { x: 138, y: 150 };
    res = analyzer.analyzeHand(lms, 'Right', 1016);
    expect(res.isPinching).toBe(true);

    // Now move tips to 50px apart -> ratio = 0.50 (> 0.45 exit)
    lms[8] = { x: 150, y: 150 };
    res = analyzer.analyzeHand(lms, 'Right', 1032);
    expect(res.isPinching).toBe(false);

    // Move back to 38px apart while false: should STAY false
    lms[8] = { x: 138, y: 150 };
    res = analyzer.analyzeHand(lms, 'Right', 1048);
    expect(res.isPinching).toBe(false);
  });

  it('detects pointing pose', () => {
    const lms = createNeutralLandmarks();
    // Index finger extended: tip [8] farther from wrist [0] than PIP [6]
    lms[0] = { x: 100, y: 100 };
    lms[6] = { x: 100, y: 180 }; // PIP
    lms[8] = { x: 100, y: 260 }; // Tip extended

    // Middle, ring, pinky curled: each tip closer to wrist than its PIP
    // Middle PIP [10], Tip [12]
    lms[10] = { x: 120, y: 180 };
    lms[12] = { x: 120, y: 140 }; // curled back toward wrist

    // Ring PIP [14], Tip [16]
    lms[14] = { x: 140, y: 170 };
    lms[16] = { x: 140, y: 130 };

    // Pinky PIP [18], Tip [20]
    lms[18] = { x: 160, y: 160 };
    lms[20] = { x: 160, y: 120 };

    // Thumb tip [4] far from index tip [8] so not pinching
    lms[4] = { x: 40, y: 120 };

    const res = analyzer.analyzeHand(lms, 'Right', 1000);
    expect(res.isPointing).toBe(true);
    expect(res.isPinching).toBe(false);
  });

  it('detects fist pose', () => {
    const lms = createNeutralLandmarks();
    // Wrist at (100, 100)
    lms[0] = { x: 100, y: 100 };

    // MCPs at y = 180 (dist = 80)
    lms[5] = { x: 80, y: 180 };  // Index MCP
    lms[9] = { x: 100, y: 180 }; // Middle MCP
    lms[13] = { x: 120, y: 180 };// Ring MCP
    lms[17] = { x: 140, y: 180 };// Pinky MCP

    // Tips curled in closer to wrist (y = 140, dist = 40)
    lms[8] = { x: 80, y: 140 };  // Index tip
    lms[12] = { x: 100, y: 140 };// Middle tip
    lms[16] = { x: 120, y: 140 };// Ring tip
    lms[20] = { x: 140, y: 140 };// Pinky tip

    const res = analyzer.analyzeHand(lms, 'Right', 1000);
    expect(res.isFist).toBe(true);
  });
});
