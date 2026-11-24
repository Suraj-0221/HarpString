// Main Application Bootstrap & Master RAF Loop for Air Harp
// Pure, responsive, tactile spatial instrument.
// Stretch strings between two pinched hands in mid-air. Release to lock.
// Flick fingertips to pluck with acoustic Karplus-Strong resonance.

import { CONFIG, SCALES } from './config.js';
import { setupCamera } from './camera.js';
import { HandTracker } from './handTracker.js';
import { GestureAnalyzer } from './gestures.js';
import { StringManager } from './strings.js';
import { EffectsManager } from './effects.js';
import { AudioEngine } from './audio.js';
import { Renderer } from './render.js';
import { UIManager } from './ui.js';
import { InstrumentManager } from './instruments.js';
import { ThemeManager } from './themes.js';
import { ClipRecorder } from './clip.js';

class AirHarpApp {
  constructor() {
    this.canvas = document.getElementById('harp-canvas');
    this.video = document.getElementById('webcam-video');

    // Subsystems
    this.audioEngine = new AudioEngine();
    this.stringManager = new StringManager(this.audioEngine);
    this.effectsManager = new EffectsManager();
    this.renderer = new Renderer(this.canvas);
    this.handTracker = new HandTracker();
    this.gestureAnalyzer = new GestureAnalyzer();
    this.instrumentManager = new InstrumentManager(this.audioEngine);
    this.themeManager = new ThemeManager();

    this.clipRecorder = new ClipRecorder(
      () => this.getCanvasStream(),
      (msg) => { if (this.ui) this.ui.showToast(msg); }
    );

    // Application state
    this.isRunning = false;
    this.isMuted = false;
    this.cameraInstance = null;
    this.currentPresetIdx = 0;
    this.presetNames = ['HARP', 'FAN', 'GRID'];
    this.hasPluckedFirst = false;

    // Viewport & Transform
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.transform = { renderWidth: 1280, renderHeight: 720, renderX: 0, renderY: 0 };

    // Performance monitoring
    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.lowFpsDuration = 0;
    this.lastFrameTime = performance.now();

    // UI Manager
    this.ui = new UIManager({
      onStart: () => this.start(),
      onClear: () => {
        if (this.stringManager.clearAll()) {
          this.ui.showToast('Cleared all strings');
        }
      },
      onUndo: () => {
        if (this.stringManager.undo()) {
          this.ui.showToast('Removed latest string');
        }
      },
      onToggleMute: () => this.toggleMute(),
      onSkeletonToggle: () => {
        this.renderer.showSkeleton = !this.renderer.showSkeleton;
        this.ui.showToast(`Hand skeleton: ${this.renderer.showSkeleton ? 'Visible' : 'Hidden'}`);
      },
      onInstrumentSelect: (name) => this.selectInstrument(name),
      onLayoutCycle: () => this.cycleLayoutPreset(),
      onRecordClip: () => this.clipRecorder.startClip(),
      onKeySelect: (key) => {
        this.audioEngine.setScale(this.audioEngine.scaleKey, key);
        this.ui.showToast(`Key set to ${key}`);
      },
      onScaleSelect: (scale) => {
        this.audioEngine.setScale(scale, this.audioEngine.rootNote);
        this.ui.showToast(`Scale: ${SCALES[scale].name}`);
      },
      onThemeSelect: (theme) => this.selectTheme(theme),
      onDroneToggle: (enabled) => {
        this.audioEngine.toggleDrone(enabled);
        this.ui.showToast(`Drone pad ${enabled ? 'active' : 'disabled'}`);
      },
      onVideoDimChange: (val) => {
        this.themeManager.videoDim = val;
      },
      onVolumeChange: (val) => this.audioEngine.setMasterVolume(val),
      onReverbChange: (val) => this.audioEngine.setReverbWet(val),
    });

    this.initCanvasSize();
    this.bindWindowEvents();
  }

  initCanvasSize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    const vWidth = (this.cameraInstance && this.cameraInstance.width) || CONFIG.CAMERA.idealWidth;
    const vHeight = (this.cameraInstance && this.cameraInstance.height) || CONFIG.CAMERA.idealHeight;
    this.transform = this.renderer.computeCoverFit(vWidth, vHeight, this.canvas.width, this.canvas.height);
  }

  bindWindowEvents() {
    window.addEventListener('resize', () => {
      const oldW = this.canvas.width;
      const oldH = this.canvas.height;
      this.initCanvasSize();
      this.stringManager.handleResize(oldW, oldH, this.canvas.width, this.canvas.height);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.audioEngine.ctx && this.audioEngine.ctx.state === 'running') {
          this.audioEngine.ctx.suspend();
        }
      } else {
        if (this.audioEngine.ctx && this.audioEngine.ctx.state === 'suspended') {
          this.audioEngine.ctx.resume();
        }
      }
    });
  }

  async start() {
    this.ui.hideStartScreen();
    this.ui.showLoader(25);

    // 1. Audio Engine Initialization
    try {
      await this.audioEngine.init();
      this.ui.showLoader(50);
    } catch (e) {
      console.error('Audio initialization error:', e);
    }

    // 2. Camera Setup
    try {
      this.cameraInstance = await setupCamera(this.video, CONFIG.CAMERA);
      this.initCanvasSize();
      this.ui.showLoader(75);
    } catch (camErr) {
      this.ui.showError(camErr.message);
      return;
    }

    // 3. MediaPipe HandLandmarker Setup
    try {
      await this.handTracker.init();
      this.ui.showLoader(100);
      setTimeout(() => this.ui.hideLoader(), 200);
    } catch (trackErr) {
      console.error('HandLandmarker error:', trackErr);
      this.ui.showError('Could not load hand tracking model from CDN.');
      return;
    }

    // Start with a clean stage and current theme
    this.stringManager.setTheme(this.themeManager.getCurrentTheme(), this.canvas.width, this.canvas.height);

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  selectInstrument(name) {
    const inst = this.instrumentManager.setInstrument(name);
    if (inst) {
      this.audioEngine.setInstrumentPreset(inst);
      this.ui.setInstrumentActive(name);
      this.ui.showToast(`Instrument: ${inst.label}`);
    }
  }

  selectTheme(name) {
    const theme = this.themeManager.setTheme(name);
    if (theme) {
      this.stringManager.setTheme(theme, this.canvas.width, this.canvas.height);
      this.ui.showToast(`Theme: ${theme.label}`);
    }
  }

  cycleLayoutPreset() {
    const name = this.presetNames[this.currentPresetIdx];
    this.currentPresetIdx = (this.currentPresetIdx + 1) % this.presetNames.length;
    this.stringManager.spawnPreset(name, this.canvas.width, this.canvas.height);
    this.ui.showToast(`Layout: ${name}`);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.audioEngine.setMasterVolume(this.isMuted ? 0 : CONFIG.AUDIO.masterVolume);
    this.ui.showToast(this.isMuted ? 'Sound muted' : 'Sound unmuted');
  }

  getCanvasStream() {
    const canvasStream = this.canvas.captureStream(60);
    if (this.audioEngine.ctx && this.audioEngine.masterGain) {
      const dest = this.audioEngine.ctx.createMediaStreamDestination();
      this.audioEngine.masterGain.connect(dest);
      dest.stream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
    }
    return canvasStream;
  }

  loop(timestamp) {
    if (!this.isRunning) return;

    const dt = Math.max(0.001, Math.min(0.1, (timestamp - this.lastFrameTime) / 1000));
    this.lastFrameTime = timestamp;

    // 1. Calculate FPS
    this.frameCount++;
    if (timestamp - this.lastFpsUpdate >= 500) {
      this.fps = (this.frameCount * 1000) / (timestamp - this.lastFpsUpdate);
      this.frameCount = 0;
      this.lastFpsUpdate = timestamp;

      if (this.fps < CONFIG.PERFORMANCE.lowFpsThreshold) {
        this.lowFpsDuration += 0.5;
        if (this.lowFpsDuration >= 3.0 && !this.renderer.lowPerformanceMode) {
          this.renderer.lowPerformanceMode = true;
        }
      } else {
        this.lowFpsDuration = 0;
      }
    }

    // 2. Hand Tracking & Gestures
    const rawHands = this.handTracker.detect(this.video, timestamp, this.transform, this.renderer.isMirrored);
    const handResults = [];
    for (let i = 0; i < rawHands.length; i++) {
      const h = rawHands[i];
      const gesture = this.gestureAnalyzer.analyzeHand(h.landmarks, h.handedness, timestamp);
      if (gesture) handResults.push(gesture);
    }

    // Quick gestures: Horizontal swipe for instrument, Clap for theme
    const swiped = this.instrumentManager.checkSwipeGesture(handResults, timestamp);
    if (swiped) {
      this.selectInstrument(swiped.name);
    }

    const clapped = this.themeManager.checkClapGesture(handResults, timestamp);
    if (clapped) {
      this.selectTheme(clapped.name);
    }

    // 3. String Creation & Plucking State Machine
    this.processInteractionStateMachine(handResults, timestamp, dt);

    // 4. Update Resonance Effects & Strings
    this.effectsManager.update(dt, this.stringManager);
    this.stringManager.update(dt);

    // 5. Render Scene
    const fistState = this.stringManager.handleFistDelete(handResults, dt);
    this.renderer.renderFrame(
      this.video,
      this.stringManager,
      this.effectsManager,
      handResults,
      this.transform,
      fistState,
      this.themeManager,
      this.audioEngine
    );

    // 6. Audio Level & Status Updates
    const level = this.audioEngine.getMasterLevel();
    const lastNote = (this.stringManager.strings.length > 0 && this.stringManager.strings[this.stringManager.strings.length - 1].noteName) || '--';
    this.ui.updateNowPlaying(lastNote, level);
    this.ui.updateHandStatus(handResults.length);
    this.ui.updateStats(this.fps, this.stringManager.strings.length);

    requestAnimationFrame((t) => this.loop(t));
  }

  processInteractionStateMachine(handResults, timestamp, dt) {
    const pinchHands = handResults.filter(h => h.isPinching);
    const pointingHands = handResults.filter(h => h.isPointing);

    // Core String Creation:
    // When 2 hands pinch (or 1 pinch + 1 point), stretch a string between the fingers.
    if (pinchHands.length >= 2) {
      this.stringManager.setPreview(pinchHands[0].pinchPoint, pinchHands[1].pinchPoint, this.canvas.width, this.canvas.height);
    } else if (pinchHands.length === 1 && pointingHands.length >= 1) {
      this.stringManager.setPreview(pinchHands[0].pinchPoint, pointingHands[0].indexTip, this.canvas.width, this.canvas.height);
    } else {
      // Pinch released: if preview string exists, effortlessly lock it into the air!
      if (this.stringManager.previewString) {
        const minLen = CONFIG.GESTURES.minStringLength || 80;
        if (this.stringManager.previewString.length >= minLen) {
          const locked = this.stringManager.lockPreview(this.canvas.width, this.canvas.height);
          if (locked) {
            this.ui.showToast(`String placed (${locked.noteName})`);
          }
        } else {
          // Shorter than 80px: cancel preview
          this.stringManager.cancelPreview();
        }
      }
    }

    // Drag-to-move endpoint if pinching near an existing string endpoint
    this.stringManager.handleMove(handResults, this.canvas.width, this.canvas.height);

    // Pluck detection: finger crossing string segments
    this.stringManager.checkPlucks(handResults, timestamp, this.effectsManager, this.canvas.width, (str, tString, strength, plucksInFrame) => {
      if (!this.hasPluckedFirst) {
        this.hasPluckedFirst = true;
        this.ui.hideInstantHint();
      }
      this.ui.pulseTopBar();
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AirHarpApp();
});
