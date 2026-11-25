// Challenge Mode for Air Harp
// 30-second rounds with pentatonic melodic motifs, speed ramp (1.5s down to 0.7s),
// combo multipliers (x2 at 5, x3 at 10, x4 at 20), scoring and end card stats.

import { storage } from '../storage.js';

export function getComboMultiplier(combo) {
  if (combo >= 20) return 4;
  if (combo >= 10) return 3;
  if (combo >= 5) return 2;
  return 1;
}

export function calculatePoints(basePoints, combo) {
  return basePoints * getComboMultiplier(combo);
}

export class ChallengeMode {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.isActive = false;
    this.roundDuration = 30; // seconds
    this.timeRemaining = 30;

    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.totalTargets = 0;
    this.successfulHits = 0;

    this.targetStringId = null;
    this.targetDuration = 1.5;
    this.targetTimeLeft = 1.5;

    // Pentatonic melodic step offsets
    this.motifPattern = [0, 2, 4, 7, 9, 7, 4, 2];
    this.motifIndex = 0;

    this.onEndCallback = null;
  }

  startRound(stringManager, onEnd = null) {
    this.isActive = true;
    this.timeRemaining = this.roundDuration;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.totalTargets = 0;
    this.successfulHits = 0;
    this.motifIndex = 0;
    this.onEndCallback = onEnd;

    this.pickNextTarget(stringManager);
  }

  stopRound() {
    this.isActive = false;
    this.targetStringId = null;
  }

  pickNextTarget(stringManager) {
    const strings = stringManager.strings;
    if (!strings || strings.length === 0) {
      this.targetStringId = null;
      return;
    }

    // Follow melodic pentatonic sequence across strings
    const sorted = [...strings].sort((a, b) => a.frequency - b.frequency);
    const motifStep = this.motifPattern[this.motifIndex % this.motifPattern.length];
    this.motifIndex++;

    const targetIdx = motifStep % sorted.length;
    this.targetStringId = sorted[targetIdx].id;

    // Window shrinks from 1.5s to 0.7s as round progresses
    const progress = 1.0 - (this.timeRemaining / this.roundDuration);
    this.targetDuration = 1.5 - progress * (1.5 - 0.7);
    this.targetTimeLeft = this.targetDuration;
    this.totalTargets++;
  }

  onPluck(pluckedStringId, stringManager) {
    if (!this.isActive) return null;

    if (pluckedStringId === this.targetStringId) {
      // Hit
      this.combo++;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo;
      this.successfulHits++;

      const pts = calculatePoints(100, this.combo);
      this.score += pts;

      this.pickNextTarget(stringManager);
      return { hit: true, points: pts, combo: this.combo, score: this.score };
    } else {
      // Wrong string: combo reset
      this.combo = 0;
      return { hit: false, combo: 0, score: this.score };
    }
  }

  update(dt, stringManager, onComplete = null) {
    if (!this.isActive) return;

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    this.targetTimeLeft = Math.max(0, this.targetTimeLeft - dt);

    // Target expired (miss)
    if (this.targetTimeLeft <= 0) {
      this.combo = 0;
      this.pickNextTarget(stringManager);
    }

    // Round ended
    if (this.timeRemaining <= 0) {
      this.isActive = false;
      const accuracy = this.totalTargets > 0
        ? Math.round((this.successfulHits / this.totalTargets) * 100)
        : 0;

      const record = storage.recordChallengeScore(this.score, this.bestCombo, accuracy);

      const stats = {
        score: this.score,
        bestCombo: this.bestCombo,
        accuracy,
        best: record.best,
        isNewBest: record.isNewBest,
        differenceToBest: Math.max(0, record.best - this.score)
      };

      if (this.onEndCallback) this.onEndCallback(stats);
      if (onComplete) onComplete(stats);
    }
  }

  renderTarget(ctx, stringManager, themeAccent = '#F58BC4') {
    if (!this.isActive || !this.targetStringId) return;

    const str = stringManager.strings.find(s => s.id === this.targetStringId);
    if (!str) return;

    ctx.save();
    // 1. Accent outline on targeted string
    ctx.beginPath();
    ctx.moveTo(str.a.x, str.a.y);
    ctx.lineTo(str.b.x, str.b.y);
    ctx.strokeStyle = themeAccent;
    ctx.lineWidth = 4;
    ctx.shadowColor = themeAccent;
    ctx.shadowBlur = 16;
    ctx.stroke();

    // 2. Shrinking target ring at midpoint
    const midX = (str.a.x + str.b.x) * 0.5;
    const midY = (str.a.y + str.b.y) * 0.5;
    const progress = Math.max(0, this.targetTimeLeft / Math.max(0.01, this.targetDuration));
    const radius = 10 + progress * 24;

    ctx.beginPath();
    ctx.arc(midX, midY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = themeAccent;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX, midY, 6, 0, Math.PI * 2);
    ctx.fillStyle = themeAccent;
    ctx.fill();

    ctx.restore();
  }
}
