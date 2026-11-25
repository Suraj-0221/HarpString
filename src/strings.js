// String Manager & Physics Simulation for Air Harp
// Core mechanics: two-hand pinch string creation & locking, drag-to-move,
// fist delete, physical standing wave vibration, traveling pulse resonance,
// and layout presets.

import { CONFIG } from './config.js';

let nextStringId = 1;

// Computes distance from point P to line segment AB
export function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

// Velocity falloff calculation for strumming multiple strings within 150ms
export function calculateStrumFalloff(baseStrength, recentPluckCount) {
  const falloff = Math.max(0.45, 1.0 - recentPluckCount * 0.12);
  return baseStrength * falloff;
}

// 2D segment-segment intersection
export function checkSegmentIntersection(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-6) return null;

  const p31x = p3.x - p1.x;
  const p31y = p3.y - p1.y;

  const t = (p31x * d2y - p31y * d2x) / denom;
  const u = (p31x * d1y - p31y * d1x) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      tFinger: t,
      tString: u,
      point: {
        x: p3.x + u * d2x,
        y: p3.y + u * d2y,
      }
    };
  }
  return null;
}

export function getPitchColor(frequency, themeConfig = null) {
  const minF = CONFIG.AUDIO.lowestFreq || 98;
  const maxF = CONFIG.AUDIO.highestFreq || 1046;
  const logMin = Math.log(minF);
  const logMax = Math.log(maxF);
  const norm = Math.max(0, Math.min(1, (Math.log(frequency) - logMin) / (logMax - logMin)));

  if (themeConfig && themeConfig.getPitchColor) {
    return themeConfig.getPitchColor(norm);
  }

  // Pale neon palette: low = magenta/pink (320), mid = mint (160), high = yellow-green (80)
  let hue = 320;
  if (norm < 0.5) {
    hue = 320 - (norm / 0.5) * (320 - 160);
  } else {
    hue = 160 - ((norm - 0.5) / 0.5) * (160 - 80);
  }

  return {
    hue: Math.round(hue),
    coreColor: `hsl(${Math.round(hue)}, 95%, 88%)`,
    glowColor: `hsl(${Math.round(hue)}, 90%, 65%)`,
    dimColor: `hsla(${Math.round(hue)}, 85%, 70%, 0.35)`,
  };
}

export class HarpString {
  constructor(a, b, audioEngine, canvasWidth, canvasHeight, themeConfig = null, animateIn = false) {
    this.id = nextStringId++;
    this.a = { x: a.x, y: a.y };
    this.b = { x: b.x, y: b.y };
    this.length = Math.hypot(b.x - a.x, b.y - a.y);

    this.updatePitch(audioEngine, canvasWidth, canvasHeight, themeConfig);

    // Visual standing wave physics
    this.isPlucked = false;
    this.amplitude = 0;
    this.timeSincePluck = 999;
    this.pluckStrength = 0;
    this.pluckPosition = 0.5;
    this.glowIntensity = 0;

    // Sympathetic resonance shimmer
    this.sympatheticAmp = 0;

    // Draw-on progress for presets
    this.drawOnProgress = animateIn ? 0.0 : 1.0;

    // Delete animation
    this.isDeleting = false;
    this.deleteProgress = 0;
    this.deleteAlpha = 1.0;
    this.deleteScale = 1.0;

    // Debouncing
    this.lastPluckTime = 0;

    // Drag-to-move
    this.draggedEndpoint = null;
  }

  updatePitch(audioEngine, canvasWidth, canvasHeight, themeConfig = null) {
    this.length = Math.hypot(this.b.x - this.a.x, this.b.y - this.a.y);
    const diagonal = Math.hypot(canvasWidth, canvasHeight);
    const pitch = audioEngine.mapLengthToPitch(this.length, diagonal);
    this.frequency = pitch.frequency;
    this.noteName = pitch.noteName;
    this.colors = getPitchColor(this.frequency, themeConfig);
  }

  triggerPluck(strength, pluckPosition = 0.5, timestamp = performance.now()) {
    this.isPlucked = true;
    this.timeSincePluck = 0;
    this.pluckStrength = strength;
    this.pluckPosition = Math.max(0.05, Math.min(0.95, pluckPosition));
    this.amplitude = (CONFIG.STRINGS.maxVisualAmplitude || 28) * strength;
    this.glowIntensity = 1.0;
    this.lastPluckTime = timestamp;
  }

  triggerSympathetic() {
    this.sympatheticAmp = (CONFIG.STRINGS.maxVisualAmplitude || 28) * 0.15;
  }

  update(dt) {
    if (this.drawOnProgress < 1.0) {
      this.drawOnProgress = Math.min(1.0, this.drawOnProgress + dt * 2.5);
    }

    if (this.isPlucked) {
      this.timeSincePluck += dt;
      const decay = CONFIG.STRINGS.visualDecay || 2.0;
      if (this.timeSincePluck > decay * 1.5) {
        this.isPlucked = false;
        this.amplitude = 0;
      }
      this.glowIntensity = Math.max(0, this.glowIntensity - dt * 1.2);
    }

    if (this.sympatheticAmp > 0.01) {
      this.sympatheticAmp = Math.max(0, this.sympatheticAmp - dt * 6.0);
    }

    if (this.isDeleting) {
      this.deleteProgress += dt * 3.5;
      this.deleteAlpha = Math.max(0, 1.0 - this.deleteProgress);
      this.deleteScale = Math.max(0.05, 1.0 - this.deleteProgress * 0.7);
    }
  }

  sampleDisplacement(s, timeOffset = 0) {
    const t = Math.max(0, this.timeSincePluck - timeOffset);
    if (!this.isPlucked && this.sympatheticAmp <= 0.01) return 0;

    const decay = CONFIG.STRINGS.visualDecay || 2.0;
    const env = Math.exp(-t / decay);
    const w = CONFIG.STRINGS.visualOscillationW || (2 * Math.PI * 6);

    const mode1 = Math.sin(Math.PI * s * 1) * Math.cos(w * t);
    const mode2 = 0.35 * Math.sin(Math.PI * s * 2) * Math.cos(2 * w * t);

    const p = this.pluckPosition;
    const tri = (s < p) ? (s / p) : ((1 - s) / (1 - p));

    let disp = this.amplitude * env * (mode1 + mode2) * (0.6 + 0.4 * tri);

    if (this.sympatheticAmp > 0.01) {
      disp += this.sympatheticAmp * Math.sin(Math.PI * s) * Math.cos(w * 1.5 * t);
    }

    return disp;
  }
}

export class StringManager {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.strings = [];
    this.previewString = null;
    this.prevFingerPositions = new Map();

    this.fistDeleteTarget = null;
    this.fistProgress = 0;
    this.activeDrag = null;
    this.history = [];
    this.themeConfig = null;
    this.pluckWithAllFingers = true;
    this.recentPluckTimestamps = [];
  }

  setTheme(themeConfig, canvasWidth, canvasHeight) {
    this.themeConfig = themeConfig;
    for (let i = 0; i < this.strings.length; i++) {
      this.strings[i].updatePitch(this.audioEngine, canvasWidth, canvasHeight, themeConfig);
    }
  }

  handleResize(oldWidth, oldHeight, newWidth, newHeight) {
    if (!oldWidth || !oldHeight || oldWidth === 0 || oldHeight === 0) return;
    const scaleX = newWidth / oldWidth;
    const scaleY = newHeight / oldHeight;

    for (const str of this.strings) {
      str.a.x *= scaleX;
      str.a.y *= scaleY;
      str.b.x *= scaleX;
      str.b.y *= scaleY;
      str.updatePitch(this.audioEngine, newWidth, newHeight, this.themeConfig);
    }

    if (this.previewString) {
      this.previewString.a.x *= scaleX;
      this.previewString.a.y *= scaleY;
      this.previewString.b.x *= scaleX;
      this.previewString.b.y *= scaleY;
    }
  }

  setPreview(pointA, pointB, canvasWidth, canvasHeight) {
    if (!pointA || !pointB) return;

    const len = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
    const diagonal = Math.hypot(canvasWidth, canvasHeight);
    const pitch = this.audioEngine.mapLengthToPitch(len, diagonal);
    const colors = getPitchColor(pitch.frequency, this.themeConfig);

    this.previewString = {
      a: { x: pointA.x, y: pointA.y },
      b: { x: pointB.x, y: pointB.y },
      length: len,
      frequency: pitch.frequency,
      noteName: pitch.noteName,
      colors,
      shimmer: (Math.sin(performance.now() * 0.008) + 1) * 0.5,
    };
  }

  cancelPreview() {
    this.previewString = null;
  }

  lockPreview(canvasWidth, canvasHeight) {
    if (!this.previewString) return null;
    const minLen = CONFIG.GESTURES.minStringLength || 80;
    if (this.previewString.length < minLen) {
      this.previewString = null;
      return null;
    }

    const maxStrings = CONFIG.STRINGS.maxStrings || 12;
    if (this.strings.length >= maxStrings) {
      const oldest = this.strings.shift();
      if (oldest) oldest.isDeleting = true;
    }

    const newStr = new HarpString(this.previewString.a, this.previewString.b, this.audioEngine, canvasWidth, canvasHeight, this.themeConfig);
    this.strings.push(newStr);
    this.history.push({ action: 'create', string: newStr });
    this.previewString = null;

    this.audioEngine.playLockPop();
    return newStr;
  }

  spawnPreset(name, canvasWidth, canvasHeight) {
    this.strings = [];
    const w = canvasWidth;
    const h = canvasHeight;

    if (name === 'HARP') {
      const count = 7;
      const marginX = w * 0.16;
      const stepX = (w - marginX * 2) / (count - 1);
      const topY = h * 0.18;
      const bottomY = h * 0.82;

      for (let i = 0; i < count; i++) {
        const x = marginX + i * stepX;
        const str = new HarpString({ x, y: topY }, { x, y: bottomY }, this.audioEngine, w, h, this.themeConfig, true);
        this.strings.push(str);
      }
    } else if (name === 'FAN') {
      const count = 7;
      const rootX = w * 0.5;
      const rootY = h * 0.88;
      const topY = h * 0.16;
      const marginX = w * 0.12;
      const stepX = (w - marginX * 2) / (count - 1);

      for (let i = 0; i < count; i++) {
        const topX = marginX + i * stepX;
        const str = new HarpString({ x: rootX, y: rootY }, { x: topX, y: topY }, this.audioEngine, w, h, this.themeConfig, true);
        this.strings.push(str);
      }
    } else if (name === 'GRID') {
      const hCount = 3;
      const vCount = 3;
      const leftX = w * 0.22;
      const rightX = w * 0.78;
      const topY = h * 0.22;
      const bottomY = h * 0.78;

      const vStep = (rightX - leftX) / (vCount - 1);
      for (let i = 0; i < vCount; i++) {
        const x = leftX + i * vStep;
        const str = new HarpString({ x, y: topY }, { x, y: bottomY }, this.audioEngine, w, h, this.themeConfig, true);
        this.strings.push(str);
      }

      const hStep = (bottomY - topY) / (hCount - 1);
      for (let i = 0; i < hCount; i++) {
        const y = topY + i * hStep;
        const str = new HarpString({ x: leftX, y }, { x: rightX, y }, this.audioEngine, w, h, this.themeConfig, true);
        this.strings.push(str);
      }
    }

    return this.strings;
  }

  undo() {
    if (this.strings.length === 0) return false;
    this.strings.pop();
    this.audioEngine.playDeleteSound();
    return true;
  }

  clearAll() {
    if (this.strings.length > 0) {
      this.audioEngine.playDeleteSound();
      this.strings = [];
      this.history = [];
      return true;
    }
    return false;
  }

  checkPlucks(handResults, timestamp, effectsManager, canvasWidth, onPluckCallback = null) {
    const debounceMs = CONFIG.GESTURES.pluckDebounceMs || 120;
    let plucksInFrame = 0;

    // Prune plucks older than 150ms for strum velocity falloff
    this.recentPluckTimestamps = this.recentPluckTimestamps.filter(t => timestamp - t < 150);

    for (const hand of handResults) {
      if (hand.isPinching) {
        // Pinching hands are drawing or dragging, not plucking
        if (hand.landmarks && this.pluckWithAllFingers) {
          [4, 8, 12, 16, 20].forEach(tipIdx => {
            const key = `${hand.handedness}_${tipIdx}`;
            const pt = hand.landmarks[tipIdx];
            if (pt) this.prevFingerPositions.set(key, { x: pt.x, y: pt.y });
          });
        } else {
          this.prevFingerPositions.set(hand.handedness, { x: hand.indexTip.x, y: hand.indexTip.y });
        }
        continue;
      }

      // Determine tips to evaluate
      const tipsToCheck = [];
      if (this.pluckWithAllFingers && hand.landmarks && hand.landmarks.length >= 21) {
        [4, 8, 12, 16, 20].forEach(tipIdx => {
          const pt = hand.landmarks[tipIdx];
          if (pt) tipsToCheck.push({ key: `${hand.handedness}_${tipIdx}`, pt });
        });
      } else {
        tipsToCheck.push({ key: hand.handedness, pt: hand.indexTip });
      }

      for (const { key, pt: currPos } of tipsToCheck) {
        const prevPos = this.prevFingerPositions.get(key);

        if (prevPos) {
          const fingerDist = Math.hypot(currPos.x - prevPos.x, currPos.y - prevPos.y);

          // Must be moving faster than threshold across string
          if (fingerDist > 1.8) {
            for (const str of this.strings) {
              if (str.isDeleting || str.drawOnProgress < 0.8) continue;
              if (timestamp - str.lastPluckTime < debounceMs) continue;

              const hit = checkSegmentIntersection(prevPos, currPos, str.a, str.b);
              if (hit) {
                plucksInFrame++;
                const speedPx = fingerDist;
                const baseStrength = Math.max(
                  CONFIG.AUDIO.minStrength || 0.15,
                  Math.min(CONFIG.AUDIO.maxStrength || 1.0, speedPx / (CONFIG.AUDIO.speedNormPx || 40))
                );

                // Open-hand strum: falloff slightly for each additional string crossed within 150ms
                const strength = calculateStrumFalloff(baseStrength, this.recentPluckTimestamps.length);
                this.recentPluckTimestamps.push(timestamp);

                str.triggerPluck(strength, hit.tString, timestamp);

                const panX = hit.point.x / Math.max(1, canvasWidth);
                this.audioEngine.pluck(str.id, str.frequency, strength, hit.tString, panX);

                if (effectsManager) {
                  effectsManager.onPluck(str, hit.tString, strength);
                }

                // Sympathetic Resonance
                for (const other of this.strings) {
                  if (other.id === str.id) continue;
                  const ratio = other.frequency / str.frequency;
                  const isOctave = Math.abs(ratio - 2.0) < 0.06 || Math.abs(ratio - 0.5) < 0.03;
                  const isFifth = Math.abs(ratio - 1.5) < 0.05 || Math.abs(ratio - 0.667) < 0.03;

                  if (isOctave || isFifth) {
                    other.triggerSympathetic();
                    this.audioEngine.playSympatheticTone(other.frequency);
                  }
                }

                if (onPluckCallback) {
                  onPluckCallback(str, hit.tString, strength, plucksInFrame);
                }
              }
            }
          }
        }

        this.prevFingerPositions.set(key, { x: currPos.x, y: currPos.y });
      }
    }
  }

  handleMove(handResults, canvasWidth, canvasHeight) {
    const grabRadius = CONFIG.GESTURES.moveGrabRadius || 40;

    for (const hand of handResults) {
      if (this.activeDrag && this.activeDrag.handLabel === hand.handedness) {
        if (!hand.isPinching) {
          this.activeDrag = null;
        } else {
          const target = (this.activeDrag.endpoint === 'a') ? this.activeDrag.string.a : this.activeDrag.string.b;
          target.x = Math.max(10, Math.min(canvasWidth - 10, hand.pinchPoint.x));
          target.y = Math.max(10, Math.min(canvasHeight - 10, hand.pinchPoint.y));
          this.activeDrag.string.updatePitch(this.audioEngine, canvasWidth, canvasHeight, this.themeConfig);
        }
        return;
      }

      if (hand.isPinching && !this.activeDrag) {
        for (const str of this.strings) {
          if (str.isDeleting) continue;
          if (Math.hypot(hand.pinchPoint.x - str.a.x, hand.pinchPoint.y - str.a.y) < grabRadius) {
            this.activeDrag = { string: str, endpoint: 'a', handLabel: hand.handedness };
            return;
          }
          if (Math.hypot(hand.pinchPoint.x - str.b.x, hand.pinchPoint.y - str.b.y) < grabRadius) {
            this.activeDrag = { string: str, endpoint: 'b', handLabel: hand.handedness };
            return;
          }
        }
      }
    }
  }

  handleFistDelete(handResults, dt) {
    let fistHand = null;
    for (const hand of handResults) {
      if (hand.isFist) {
        fistHand = hand;
        break;
      }
    }

    if (!fistHand) {
      this.fistDeleteTarget = null;
      this.fistProgress = 0;
      return null;
    }

    const proximity = CONFIG.GESTURES.deleteProximity || 30;
    const requiredDuration = CONFIG.GESTURES.deleteHoldDuration || 1.2;

    let nearestStr = null;
    let minD = Infinity;

    for (const str of this.strings) {
      if (str.isDeleting) continue;
      const d = distToSegment(fistHand.palmCenter, str.a, str.b);
      if (d < proximity && d < minD) {
        minD = d;
        nearestStr = str;
      }
    }

    if (nearestStr) {
      if (this.fistDeleteTarget && this.fistDeleteTarget.id === nearestStr.id) {
        this.fistDeleteTarget.holdTime += dt;
        this.fistProgress = Math.min(1.0, this.fistDeleteTarget.holdTime / requiredDuration);

        if (this.fistDeleteTarget.holdTime >= requiredDuration) {
          nearestStr.isDeleting = true;
          this.audioEngine.playDeleteSound();
          this.fistDeleteTarget = null;
          this.fistProgress = 0;
        }
      } else {
        this.fistDeleteTarget = { id: nearestStr.id, holdTime: dt };
        this.fistProgress = dt / requiredDuration;
      }
    } else {
      this.fistDeleteTarget = null;
      this.fistProgress = 0;
    }

    return {
      fistPos: fistHand.palmCenter,
      progress: this.fistProgress,
    };
  }

  update(dt) {
    for (let i = this.strings.length - 1; i >= 0; i--) {
      const str = this.strings[i];
      str.update(dt);
      if (str.isDeleting && str.deleteProgress >= 1.0) {
        this.strings.splice(i, 1);
      }
    }
  }
}
