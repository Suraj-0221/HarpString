// Web Audio Engine for Air Harp (Revision 2)
// Polyphonic Karplus-Strong plucked string synthesizer with acoustic presets,
// continuous scale snapping, sympathetic resonance tones, master AnalyserNode,
// and background drone pad on root pitch.

import { CONFIG, SCALES, NOTE_NAMES } from './config.js';

// Karplus-Strong AudioWorklet Processor source
const KARPLUS_STRONG_WORKLET_CODE = `
class KarplusStrongProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = null;
    this.bufferSize = 0;
    this.readIdx = 0;
    this.prevSample = 0;
    this.feedback = 0.99;
    this.filterAlpha = 0.5;
    this.active = false;
    this.samplesRemaining = 0;
    this.fadeSamplesRemaining = 0;
    this.fadeTotalSamples = 1;
    this.inharmonicity = 0.0;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'trigger') {
        const freq = Math.max(30, Math.min(2400, msg.frequency));
        const sampleRate = globalThis.sampleRate || 44100;
        this.bufferSize = Math.max(16, Math.round(sampleRate / freq));
        this.buffer = new Float32Array(this.bufferSize);

        const strength = Math.max(0.1, Math.min(1.0, msg.strength || 0.7));
        const pluckPos = Math.max(0.05, Math.min(0.5, msg.pluckPosition || 0.25));
        this.inharmonicity = msg.inharmonicity || 0.0;

        // Pluck position comb shaping and noise burst
        for (let i = 0; i < this.bufferSize; i++) {
          const s = i / this.bufferSize;
          const shape = (s < pluckPos) ? (s / pluckPos) : ((1 - s) / (1 - pluckPos));
          const noise = (Math.random() * 2 - 1);
          // Inharmonic shimmer component for GLASS preset
          const shimmer = this.inharmonicity > 0 ? Math.sin(i * 0.4) * this.inharmonicity : 0;
          this.buffer[i] = (noise + shimmer) * shape * strength;
        }

        this.readIdx = 0;
        this.prevSample = 0;

        // Feedback calculation for desired decay time
        const decayTime = Math.max(0.8, Math.min(6.0, msg.decayTime || 3.0));
        const loopDuration = this.bufferSize / sampleRate;
        this.feedback = Math.pow(0.001, loopDuration / decayTime);
        this.feedback = Math.min(0.9985, Math.max(0.82, this.feedback));

        // Pluck position and brightness
        const presetBrightness = msg.brightness !== undefined ? msg.brightness : 0.55;
        const brightness = presetBrightness + (0.5 - pluckPos) * 0.2 + strength * 0.1;
        this.filterAlpha = Math.min(0.75, Math.max(0.35, brightness));

        this.samplesRemaining = Math.round(sampleRate * decayTime);
        this.active = true;
        this.fadeSamplesRemaining = 0;
      } else if (msg.type === 'fadeout') {
        const ms = msg.ms || 20;
        const sampleRate = globalThis.sampleRate || 44100;
        this.fadeSamplesRemaining = Math.round((ms / 1000) * sampleRate);
        this.fadeTotalSamples = Math.max(1, this.fadeSamplesRemaining);
      } else if (msg.type === 'stop') {
        this.active = false;
        this.samplesRemaining = 0;
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const channel = output[0];
    if (!this.active || !this.buffer || this.samplesRemaining <= 0) {
      if (channel) channel.fill(0);
      return true;
    }

    const len = this.bufferSize;
    const fb = this.feedback;
    const alpha = this.filterAlpha;
    const oneMinusAlpha = 1.0 - alpha;

    for (let i = 0; i < channel.length; i++) {
      if (this.samplesRemaining <= 0) {
        channel[i] = 0;
        this.active = false;
        continue;
      }

      const current = this.buffer[this.readIdx];
      const filtered = (alpha * current + oneMinusAlpha * this.prevSample) * fb;
      this.prevSample = filtered;
      this.buffer[this.readIdx] = filtered;

      this.readIdx = (this.readIdx + 1) % len;
      this.samplesRemaining--;

      let outSample = current;

      if (this.fadeSamplesRemaining > 0) {
        const gain = this.fadeSamplesRemaining / this.fadeTotalSamples;
        outSample *= gain;
        this.fadeSamplesRemaining--;
        if (this.fadeSamplesRemaining <= 0) {
          this.active = false;
        }
      }

      channel[i] = outSample;
    }

    for (let ch = 1; ch < output.length; ch++) {
      output[ch].set(channel);
    }

    return true;
  }
}

registerProcessor('karplus-strong-voice', KarplusStrongProcessor);
`;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isInitialized = false;
    this.hasWorklet = false;

    // Master nodes
    this.masterGain = null;
    this.compressor = null;
    this.dryGain = null;
    this.wetGain = null;
    this.convolver = null;
    this.analyser = null;

    // Drone pad nodes
    this.droneOsc = null;
    this.droneGain = null;
    this.isDroneActive = false;

    // Voice pool
    this.maxVoices = CONFIG.AUDIO.maxPolyphony || 16;
    this.voices = [];
    this.activeVoiceMap = new Map(); // stringId -> voiceIndex
    this.voiceCursor = 0;

    // Current musical scale & root
    this.scaleKey = CONFIG.AUDIO.defaultScale || 'c_minor';
    this.rootNote = CONFIG.AUDIO.rootNote || 'C';
    this.scaleNotes = this.computeScaleNotes();

    // Instrument preset overrides
    this.instrumentPreset = null;
  }

  async init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API not supported in this browser.');
      return;
    }

    this.ctx = new AudioContextClass();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // 1. Master Chain setup
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(CONFIG.AUDIO.masterVolume, this.ctx.currentTime);

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(3.5, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);

    // Master AnalyserNode for sound-reactive breathing & level meter
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.8;

    // Reverb send/return
    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = this.createReverbImpulse(CONFIG.AUDIO.reverbDecay || 1.8);

    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.setValueAtTime(1.0 - (CONFIG.AUDIO.reverbWet || 0.25), this.ctx.currentTime);

    this.wetGain = this.ctx.createGain();
    this.wetGain.gain.setValueAtTime(CONFIG.AUDIO.reverbWet || 0.25, this.ctx.currentTime);

    // Connections
    this.convolver.connect(this.wetGain);
    this.dryGain.connect(this.compressor);
    this.wetGain.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // 2. Load AudioWorklet for Karplus-Strong
    try {
      const blob = new Blob([KARPLUS_STRONG_WORKLET_CODE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await this.ctx.audioWorklet.addModule(workletUrl);
      this.hasWorklet = true;
      URL.revokeObjectURL(workletUrl);
    } catch (e) {
      console.warn('AudioWorklet module loading failed, using fallback synthesizer.', e);
      this.hasWorklet = false;
    }

    // 3. Pre-create voice pool
    this.voices = [];
    for (let i = 0; i < this.maxVoices; i++) {
      const voice = this.createVoiceInstance(i);
      this.voices.push(voice);
    }

    // 4. Pre-warm voices to guarantee latency under 80ms
    if (this.hasWorklet && this.voices.length > 0) {
      this.voices[0].node.port.postMessage({ type: 'trigger', frequency: 220, strength: 0.01, decayTime: 0.1 });
    }

    this.isInitialized = true;
  }

  createVoiceInstance(id) {
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const voiceGain = this.ctx.createGain();
    voiceGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    if (panner) {
      voiceGain.connect(panner);
      panner.connect(this.dryGain);
      panner.connect(this.convolver);
    } else {
      voiceGain.connect(this.dryGain);
      voiceGain.connect(this.convolver);
    }

    let node = null;
    if (this.hasWorklet) {
      node = new AudioWorkletNode(this.ctx, 'karplus-strong-voice', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });
      node.connect(voiceGain);
    }

    return {
      id,
      node,
      panner,
      gainNode: voiceGain,
      inUse: false,
      stringId: null,
      startTime: 0,
    };
  }

  createReverbImpulse(decaySeconds = 1.8) {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * decaySeconds);
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-3.5 * t / decaySeconds);
      left[i] = (Math.random() * 2 - 1) * envelope;
      right[i] = (Math.random() * 2 - 1) * envelope;
    }
    return impulse;
  }

  computeScaleNotes() {
    const scaleDef = SCALES[this.scaleKey] || SCALES.c_minor;
    if (!scaleDef.notes) return null; // free

    const rootIdx = NOTE_NAMES.indexOf(this.rootNote);
    const baseRoot = rootIdx >= 0 ? rootIdx : 0;

    const notes = [];
    for (let midi = 43; midi <= 85; midi++) {
      const pitchClass = (midi % 12);
      const degree = (pitchClass - baseRoot + 12) % 12;
      if (scaleDef.notes.includes(degree)) {
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        const octave = Math.floor(midi / 12) - 1;
        const name = NOTE_NAMES[pitchClass] + octave;
        notes.push({ midi, freq, name });
      }
    }
    return notes;
  }

  setScale(scaleKey, rootNote = 'C') {
    this.scaleKey = scaleKey;
    this.rootNote = rootNote;
    this.scaleNotes = this.computeScaleNotes();
    if (this.isDroneActive) {
      this.updateDroneFrequency();
    }
  }

  setInstrumentPreset(preset) {
    this.instrumentPreset = preset;
  }

  mapLengthToPitch(stringLength, canvasDiagonal) {
    const minL = 0.05;
    const maxL = 0.95;
    const norm = Math.max(minL, Math.min(maxL, stringLength / canvasDiagonal));
    
    const t = (norm - minL) / (maxL - minL);
    const logMin = Math.log(CONFIG.AUDIO.lowestFreq);
    const logMax = Math.log(CONFIG.AUDIO.highestFreq);
    let rawFreq = Math.exp(logMax - t * (logMax - logMin));

    // Instrument frequency multiplier (e.g. BASS drops 1 octave)
    if (this.instrumentPreset && this.instrumentPreset.freqMultiplier) {
      rawFreq *= this.instrumentPreset.freqMultiplier;
    }

    if (!this.scaleNotes || this.scaleNotes.length === 0) {
      return {
        frequency: rawFreq,
        noteName: `${Math.round(rawFreq)}Hz`
      };
    }

    let best = this.scaleNotes[0];
    let minDiff = Math.abs(Math.log(rawFreq / best.freq));
    for (let i = 1; i < this.scaleNotes.length; i++) {
      const diff = Math.abs(Math.log(rawFreq / this.scaleNotes[i].freq));
      if (diff < minDiff) {
        minDiff = diff;
        best = this.scaleNotes[i];
      }
    }

    return {
      frequency: best.freq,
      noteName: best.name
    };
  }

  allocateVoice(stringId) {
    const now = this.ctx ? this.ctx.currentTime : 0;

    if (this.activeVoiceMap.has(stringId)) {
      const prevIdx = this.activeVoiceMap.get(stringId);
      const prevVoice = this.voices[prevIdx];
      if (prevVoice && prevVoice.node && this.hasWorklet) {
        prevVoice.node.port.postMessage({ type: 'fadeout', ms: CONFIG.AUDIO.voiceFadeTimeMs });
      }
    }

    let selected = null;
    for (let i = 0; i < this.maxVoices; i++) {
      const idx = (this.voiceCursor + i) % this.maxVoices;
      if (!this.voices[idx].inUse) {
        selected = this.voices[idx];
        this.voiceCursor = (idx + 1) % this.maxVoices;
        break;
      }
    }

    if (!selected) {
      let oldestTime = Infinity;
      let oldestIdx = 0;
      for (let i = 0; i < this.maxVoices; i++) {
        if (this.voices[i].startTime < oldestTime) {
          oldestTime = this.voices[i].startTime;
          oldestIdx = i;
        }
      }
      selected = this.voices[oldestIdx];
      if (selected.node && this.hasWorklet) {
        selected.node.port.postMessage({ type: 'fadeout', ms: 15 });
      }
      this.voiceCursor = (oldestIdx + 1) % this.maxVoices;
    }

    selected.inUse = true;
    selected.stringId = stringId;
    selected.startTime = now;
    this.activeVoiceMap.set(stringId, selected.id);

    return selected;
  }

  pluck(stringId, frequency, strength, pluckPosition = 0.25, panX = 0.5, decayOverride = null) {
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const clampedStrength = Math.min(CONFIG.AUDIO.maxStrength, Math.max(CONFIG.AUDIO.minStrength, strength));
    const voice = this.allocateVoice(stringId);
    const now = this.ctx.currentTime;

    const pan = (panX - 0.5) * 1.4;
    if (voice.panner) {
      voice.panner.pan.setValueAtTime(Math.max(-0.7, Math.min(0.7, pan)), now);
    }

    const preset = this.instrumentPreset;
    const decayTime = decayOverride || (preset ? preset.decayTime : CONFIG.AUDIO.stringDecayTime) || 3.0;
    const brightness = preset ? preset.brightness : 0.55;
    const inharmonicity = preset ? (preset.inharmonicity || 0.0) : 0.0;

    if (this.hasWorklet && voice.node) {
      voice.node.port.postMessage({
        type: 'trigger',
        frequency,
        strength: clampedStrength,
        pluckPosition,
        decayTime,
        brightness,
        inharmonicity,
      });
    } else {
      this.playFallbackPluck(voice, frequency, clampedStrength, decayTime, pluckPosition);
    }

    setTimeout(() => {
      if (voice.stringId === stringId) {
        voice.inUse = false;
        this.activeVoiceMap.delete(stringId);
      }
    }, decayTime * 1000);
  }

  // Sympathetic resonance audio tone (gain 0.08)
  playSympatheticTone(frequency) {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.dryGain);
      osc.start(now);
      osc.stop(now + 1.25);
    } catch (e) {
      // Ignored
    }
  }

  // Root note Drone Pad
  toggleDrone(enable) {
    if (!this.ctx) return;
    this.isDroneActive = enable;

    if (enable) {
      if (this.droneOsc) return;
      const rootIdx = NOTE_NAMES.indexOf(this.rootNote);
      const rootPitchClass = rootIdx >= 0 ? rootIdx : 0;
      const midi = 36 + rootPitchClass; // C2 range
      const freq = 440 * Math.pow(2, (midi - 69) / 12);

      this.droneOsc = this.ctx.createOscillator();
      this.droneGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      this.droneOsc.type = 'triangle';
      this.droneOsc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 2.5, this.ctx.currentTime);

      this.droneGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      this.droneGain.gain.exponentialRampToValueAtTime(0.035, this.ctx.currentTime + 1.5);

      this.droneOsc.connect(filter);
      filter.connect(this.droneGain);
      this.droneGain.connect(this.dryGain);
      this.droneGain.connect(this.convolver);
      this.droneOsc.start();
    } else {
      if (this.droneOsc && this.droneGain) {
        this.droneGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);
        setTimeout(() => {
          if (this.droneOsc) {
            this.droneOsc.stop();
            this.droneOsc = null;
            this.droneGain = null;
          }
        }, 900);
      }
    }
  }

  updateDroneFrequency() {
    if (this.droneOsc && this.ctx) {
      const rootIdx = NOTE_NAMES.indexOf(this.rootNote);
      const rootPitchClass = rootIdx >= 0 ? rootIdx : 0;
      const midi = 36 + rootPitchClass;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      this.droneOsc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    }
  }

  // Get master audio RMS level for visual breathing & level meter
  getMasterLevel() {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length);
  }

  playFallbackPluck(voice, frequency, strength, decayTime, pluckPos) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(frequency * 2, this.ctx.currentTime);

    const cutoff = frequency * (2.5 + strength * 4.0 + (0.5 - pluckPos) * 2.0);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.8), this.ctx.currentTime + decayTime);

    const now = this.ctx.currentTime;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(strength * 0.7, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, now + decayTime);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(voice.gainNode);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + decayTime + 0.05);
    osc2.stop(now + decayTime + 0.05);
  }

  playLockPop() {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.04);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      osc.connect(gain);
      gain.connect(this.dryGain);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      // Ignored
    }
  }

  playDeleteSound() {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.22);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.dryGain);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      // Ignored
    }
  }

  setMasterVolume(val) {
    if (this.masterGain && this.ctx) {
      const clamped = Math.max(0, Math.min(1, val));
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  }

  setReverbWet(val) {
    if (this.dryGain && this.wetGain && this.ctx) {
      const wet = Math.max(0, Math.min(1, val));
      this.dryGain.gain.setValueAtTime(1.0 - wet, this.ctx.currentTime);
      this.wetGain.gain.setValueAtTime(wet, this.ctx.currentTime);
    }
  }
}
