// Groove Step Sequencer for Air Harp
// Web Audio lookahead scheduler (16 steps) with synthesized kick, snare, and hat.
// Patterns: Slow (60-75 BPM), Lo-fi (swung, 70-90 BPM), Upbeat (100-120 BPM), Off.
// Includes "Tidy timing" quantization window (60ms).

export const GROOVE_PATTERNS = {
  Off: {
    name: 'Off',
    defaultBpm: 80,
    steps: 16,
    kick: [],
    snare: [],
    hat: []
  },
  Slow: {
    name: 'Slow',
    defaultBpm: 68,
    steps: 16,
    // Gentle ballad / acoustic groove
    kick: [0, 8],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14]
  },
  'Lo-fi': {
    name: 'Lo-fi',
    defaultBpm: 82,
    steps: 16,
    swing: 0.035, // Swing delay on odd 16th notes
    // Relaxed hip-hop groove
    kick: [0, 6, 10],
    snare: [4, 12],
    hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
  },
  Upbeat: {
    name: 'Upbeat',
    defaultBpm: 108,
    steps: 16,
    // Driving upbeat indie-folk groove
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [2, 6, 10, 14]
  }
};

export class GrooveSequencer {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.patternName = 'Off';
    this.bpm = 80;
    this.tidyTiming = true;
    this.volume = 0.28; // Sits pleasantly under strings

    this.isPlaying = false;
    this.currentStep = 0;
    this.nextStepTime = 0;
    this.schedulerTimer = null;
    this.lookaheadMs = 25;
    this.scheduleAheadTime = 0.1; // seconds

    this.onBeatPulse = null; // Callback for subtle 3% string beat pulse
  }

  setPattern(name) {
    if (!GROOVE_PATTERNS[name]) return;
    this.patternName = name;
    const pat = GROOVE_PATTERNS[name];

    if (name === 'Off') {
      this.stop();
    } else {
      if (!this.isPlaying) {
        this.start();
      }
    }
  }

  setBpm(bpm) {
    this.bpm = Math.max(60, Math.min(130, bpm));
  }

  setTidyTiming(enabled) {
    this.tidyTiming = !!enabled;
  }

  start() {
    if (this.patternName === 'Off') return;
    if (this.isPlaying) return;
    if (!this.audioEngine || !this.audioEngine.ctx) return;

    this.isPlaying = true;
    this.currentStep = 0;
    this.nextStepTime = this.audioEngine.ctx.currentTime + 0.05;

    this.scheduleLoop();
  }

  stop() {
    this.isPlaying = false;
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  scheduleLoop() {
    if (!this.isPlaying) return;

    const ctx = this.audioEngine.ctx;
    while (this.nextStepTime < ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }

    this.schedulerTimer = setTimeout(() => this.scheduleLoop(), this.lookaheadMs);
  }

  advanceStep() {
    const secondsPerBeat = 60.0 / this.bpm;
    const secondsPer16th = secondsPerBeat / 4.0;

    const pat = GROOVE_PATTERNS[this.patternName] || GROOVE_PATTERNS.Off;
    let stepDuration = secondsPer16th;

    // Apply swing on odd steps for Lo-fi
    if (pat.swing) {
      if (this.currentStep % 2 === 0) {
        stepDuration += pat.swing;
      } else {
        stepDuration -= pat.swing;
      }
    }

    this.nextStepTime += stepDuration;
    this.currentStep = (this.currentStep + 1) % 16;
  }

  scheduleStep(step, time) {
    const pat = GROOVE_PATTERNS[this.patternName];
    if (!pat) return;

    const ctx = this.audioEngine.ctx;

    // Trigger onBeatPulse callback on quarter note beats (steps 0, 4, 8, 12)
    if (step % 4 === 0 && this.onBeatPulse) {
      const delay = Math.max(0, (time - ctx.currentTime) * 1000);
      setTimeout(() => {
        if (this.isPlaying && this.onBeatPulse) this.onBeatPulse();
      }, delay);
    }

    if (pat.kick.includes(step)) {
      this.playKick(time);
    }
    if (pat.snare.includes(step)) {
      this.playSnare(time);
    }
    if (pat.hat.includes(step)) {
      const isAccent = (step % 4 === 0);
      this.playHat(time, isAccent);
    }
  }

  playKick(time) {
    const ctx = this.audioEngine.ctx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.12);

    gain.gain.setValueAtTime(this.volume * 0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.connect(gain);
    gain.connect(this.audioEngine.masterGain || ctx.destination);

    osc.start(time);
    osc.stop(time + 0.25);
  }

  playSnare(time) {
    const ctx = this.audioEngine.ctx;
    if (!ctx) return;

    // 1. Tonal body
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.08);

    oscGain.gain.setValueAtTime(this.volume * 0.4, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    osc.connect(oscGain);
    oscGain.connect(this.audioEngine.masterGain || ctx.destination);

    // 2. Filtered noise rattle
    const bufferSize = ctx.sampleRate * 0.18;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1100;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(this.volume * 0.45, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.audioEngine.masterGain || ctx.destination);

    osc.start(time);
    osc.stop(time + 0.15);
    noise.start(time);
    noise.stop(time + 0.2);
  }

  playHat(time, isAccent = false) {
    const ctx = this.audioEngine.ctx;
    if (!ctx) return;

    const duration = isAccent ? 0.06 : 0.04;
    const bufferSize = ctx.sampleRate * duration;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 8500;
    filter.Q.value = 3.0;

    const gain = ctx.createGain();
    const peak = (this.volume * (isAccent ? 0.35 : 0.2));
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioEngine.masterGain || ctx.destination);

    noise.start(time);
    noise.stop(time + duration + 0.01);
  }

  // Tidy Timing: delays a pluck to the next 1/16 note if within 60ms of it,
  // otherwise returns 0 (plays immediately)
  getTidyDelayMs() {
    if (!this.tidyTiming || this.patternName === 'Off' || !this.isPlaying) {
      return 0;
    }
    const ctx = this.audioEngine.ctx;
    if (!ctx) return 0;

    const secondsPer16th = (60.0 / this.bpm) / 4.0;
    const diff = this.nextStepTime - ctx.currentTime;

    // If within 60ms of next 16th note, return delay in ms
    if (diff > 0 && diff <= 0.060) {
      return Math.round(diff * 1000);
    }
    return 0;
  }
}
