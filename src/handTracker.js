// Hand Tracking & Landmark Smoothing with MediaPipe Tasks Vision
// Supports GPU delegate with automatic CPU fallback, One-Euro landmark filtering,
// and cover-fit coordinate alignment.

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { CONFIG } from './config.js';

// One-Euro Filter implementation for 1D scalar
class OneEuroFilter {
  constructor(minCutoff = 1.2, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  filter(x, t) {
    if (this.tPrev === null || this.xPrev === null) {
      this.tPrev = t;
      this.xPrev = x;
      this.dxPrev = 0;
      return x;
    }
    const dt = Math.max(0.001, (t - this.tPrev) / 1000);
    this.tPrev = t;

    const dAlpha = (2 * Math.PI * this.dCutoff * dt) / (2 * Math.PI * this.dCutoff * dt + 1);
    const dx = (x - this.xPrev) / dt;
    const edx = dAlpha * dx + (1 - dAlpha) * this.dxPrev;
    this.dxPrev = edx;

    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const alpha = (2 * Math.PI * cutoff * dt) / (2 * Math.PI * cutoff * dt + 1);
    const xFiltered = alpha * x + (1 - alpha) * this.xPrev;
    this.xPrev = xFiltered;
    return xFiltered;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}

// Manages 42 filters (21 x, 21 y) per hand
class HandSmoother {
  constructor() {
    this.filtersX = Array.from({ length: 21 }, () => new OneEuroFilter(CONFIG.TRACKER.oneEuro.minCutoff, CONFIG.TRACKER.oneEuro.beta, CONFIG.TRACKER.oneEuro.dCutoff));
    this.filtersY = Array.from({ length: 21 }, () => new OneEuroFilter(CONFIG.TRACKER.oneEuro.minCutoff, CONFIG.TRACKER.oneEuro.beta, CONFIG.TRACKER.oneEuro.dCutoff));
    this.prevEma = null;
  }

  smooth(rawLandmarks, timestamp, useOneEuro = true, emaAlpha = 0.55) {
    const smoothed = [];
    if (useOneEuro) {
      for (let i = 0; i < 21; i++) {
        const raw = rawLandmarks[i];
        const sx = this.filtersX[i].filter(raw.x, timestamp);
        const sy = this.filtersY[i].filter(raw.y, timestamp);
        smoothed.push({ x: sx, y: sy, z: raw.z || 0 });
      }
    } else {
      if (!this.prevEma) {
        this.prevEma = rawLandmarks.map(p => ({ x: p.x, y: p.y, z: p.z || 0 }));
        return this.prevEma;
      }
      for (let i = 0; i < 21; i++) {
        const raw = rawLandmarks[i];
        const prev = this.prevEma[i];
        const sx = emaAlpha * raw.x + (1 - emaAlpha) * prev.x;
        const sy = emaAlpha * raw.y + (1 - emaAlpha) * prev.y;
        smoothed.push({ x: sx, y: sy, z: raw.z || 0 });
        prev.x = sx;
        prev.y = sy;
      }
    }
    return smoothed;
  }

  reset() {
    this.filtersX.forEach(f => f.reset());
    this.filtersY.forEach(f => f.reset());
    this.prevEma = null;
  }
}

export class HandTracker {
  constructor() {
    this.landmarker = null;
    this.delegate = 'GPU';
    this.lastVideoTime = -1;
    this.smoothers = {
      Left: new HandSmoother(),
      Right: new HandSmoother(),
    };
  }

  async init() {
    console.log('Loading MediaPipe HandLandmarker FilesetResolver from CDN...');
    const vision = await FilesetResolver.forVisionTasks(CONFIG.TRACKER.wasmLoaderUrl);

    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: CONFIG.TRACKER.modelAssetPath,
          delegate: 'GPU',
        },
        runningMode: CONFIG.TRACKER.runningMode || 'VIDEO',
        numHands: CONFIG.TRACKER.numHands || 2,
        minHandDetectionConfidence: CONFIG.TRACKER.minHandDetectionConfidence || 0.5,
        minHandPresenceConfidence: CONFIG.TRACKER.minHandPresenceConfidence || 0.5,
        minTrackingConfidence: CONFIG.TRACKER.minTrackingConfidence || 0.5,
      });
      this.delegate = 'GPU';
      console.log('MediaPipe HandLandmarker successfully initialized with GPU delegate.');
    } catch (gpuError) {
      console.warn('GPU delegate initialization failed. Falling back to CPU delegate...', gpuError);
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: CONFIG.TRACKER.modelAssetPath,
          delegate: 'CPU',
        },
        runningMode: CONFIG.TRACKER.runningMode || 'VIDEO',
        numHands: CONFIG.TRACKER.numHands || 2,
        minHandDetectionConfidence: CONFIG.TRACKER.minHandDetectionConfidence || 0.5,
        minHandPresenceConfidence: CONFIG.TRACKER.minHandPresenceConfidence || 0.5,
        minTrackingConfidence: CONFIG.TRACKER.minTrackingConfidence || 0.5,
      });
      this.delegate = 'CPU';
      console.log('MediaPipe HandLandmarker initialized with CPU delegate.');
    }
  }

  // Detect landmarks for video frame with cover-fit transform & mirroring
  detect(video, timestamp, transform, isMirrored = true) {
    if (!this.landmarker || !video || video.readyState < 2) return [];

    if (video.currentTime === this.lastVideoTime) {
      return this.lastRawResults || [];
    }
    this.lastVideoTime = video.currentTime;

    const mpResults = this.landmarker.detectForVideo(video, timestamp);
    if (!mpResults || !mpResults.landmarks || mpResults.landmarks.length === 0) {
      this.lastRawResults = [];
      return [];
    }

    const transformedHands = [];
    const handednessList = mpResults.handedness || [];

    for (let h = 0; h < mpResults.landmarks.length; h++) {
      const rawLms = mpResults.landmarks[h];
      const handednessObj = handednessList[h] && handednessList[h][0];
      const handednessLabel = handednessObj ? handednessObj.categoryName : (h === 0 ? 'Left' : 'Right');

      const screenPoints = [];
      for (let i = 0; i < rawLms.length; i++) {
        const pt = rawLms[i];
        const normX = isMirrored ? (1.0 - pt.x) : pt.x;
        const normY = pt.y;

        const screenX = transform.renderX + normX * transform.renderWidth;
        const screenY = transform.renderY + normY * transform.renderHeight;
        screenPoints.push({ x: screenX, y: screenY, z: pt.z });
      }

      const smoother = this.smoothers[handednessLabel] || this.smoothers.Right;
      const smoothed = smoother.smooth(screenPoints, timestamp, CONFIG.TRACKER.useOneEuro, CONFIG.TRACKER.emaAlpha);

      transformedHands.push({
        handedness: handednessLabel,
        landmarks: smoothed,
      });
    }

    this.lastRawResults = transformedHands;
    return transformedHands;
  }
}
