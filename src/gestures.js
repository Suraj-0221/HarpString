// Gesture detection with hysteresis, stable hand identity, pose classification, and velocity

import { CONFIG } from './config.js';

export function dist(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.hypot(dx, dy);
}

export class GestureAnalyzer {
  constructor() {
    this.handStates = {
      Left: { isPinching: false, prevWrist: null, lastSeen: 0, velocity: { x: 0, y: 0 } },
      Right: { isPinching: false, prevWrist: null, lastSeen: 0, velocity: { x: 0, y: 0 } },
    };
  }

  analyzeHand(landmarks, handednessLabel = 'Right', timestamp = performance.now()) {
    if (!landmarks || landmarks.length < 21) return null;

    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexMCP = landmarks[5];
    const indexPIP = landmarks[6];
    const indexTip = landmarks[8];
    const middleMCP = landmarks[9];
    const middlePIP = landmarks[10];
    const middleTip = landmarks[12];
    const ringMCP = landmarks[13];
    const ringPIP = landmarks[14];
    const ringTip = landmarks[16];
    const pinkyMCP = landmarks[17];
    const pinkyPIP = landmarks[18];
    const pinkyTip = landmarks[20];

    const handSize = Math.max(1, dist(wrist, middleMCP));

    // Pinch calculation with hysteresis
    const thumbIndexDist = dist(thumbTip, indexTip);
    const pinchRatio = thumbIndexDist / handSize;

    let handState = this.handStates[handednessLabel];
    if (!handState) {
      handState = { isPinching: false, prevWrist: null, lastSeen: 0, velocity: { x: 0, y: 0 } };
      this.handStates[handednessLabel] = handState;
    }

    const enterThreshold = CONFIG.GESTURES.pinchEnterRatio || 0.30;
    const exitThreshold = CONFIG.GESTURES.pinchExitRatio || 0.45;

    let isPinching = handState.isPinching;
    if (!isPinching && pinchRatio < enterThreshold) {
      isPinching = true;
    } else if (isPinching && pinchRatio > exitThreshold) {
      isPinching = false;
    }
    handState.isPinching = isPinching;

    // Hand velocity calculation
    let velocity = { x: 0, y: 0 };
    if (handState.prevWrist && handState.lastSeen > 0) {
      const dt = Math.max(0.001, (timestamp - handState.lastSeen) / 1000);
      velocity = {
        x: (wrist.x - handState.prevWrist.x) / dt,
        y: (wrist.y - handState.prevWrist.y) / dt,
      };
    }
    handState.prevWrist = { x: wrist.x, y: wrist.y };
    handState.lastSeen = timestamp;
    handState.velocity = velocity;

    const pinchPoint = {
      x: (thumbTip.x + indexTip.x) * 0.5,
      y: (thumbTip.y + indexTip.y) * 0.5,
    };

    // Pointing detection
    const indexDistWrist = dist(indexTip, wrist);
    const indexPIPDistWrist = dist(indexPIP, wrist);
    const indexExtended = indexDistWrist > indexPIPDistWrist;

    const middleCurled = dist(middleTip, wrist) < dist(middlePIP, wrist);
    const ringCurled = dist(ringTip, wrist) < dist(ringPIP, wrist);
    const pinkyCurled = dist(pinkyTip, wrist) < dist(pinkyPIP, wrist);

    const isPointing = !isPinching && indexExtended && middleCurled && ringCurled && pinkyCurled;

    // Fist detection
    const isFist = (
      dist(indexTip, wrist) < dist(indexMCP, wrist) &&
      dist(middleTip, wrist) < dist(middleMCP, wrist) &&
      dist(ringTip, wrist) < dist(ringMCP, wrist) &&
      dist(pinkyTip, wrist) < dist(pinkyMCP, wrist)
    );

    const palmCenter = {
      x: (wrist.x + middleMCP.x) * 0.5,
      y: (wrist.y + middleMCP.y) * 0.5,
    };

    return {
      handedness: handednessLabel,
      handSize,
      isPinching,
      pinchRatio,
      pinchPoint,
      isPointing,
      isFist,
      palmCenter,
      wrist,
      indexTip,
      thumbTip,
      velocity,
      landmarks,
    };
  }
}
