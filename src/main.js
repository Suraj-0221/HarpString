// Main Application Bootstrap & Master RAF Loop for Air Harp
// A small stage with a warm light on it.
// Tactile spatial string instrument with real-time hand tracking,
// Karplus-Strong waveguide synthesis, grooves, curated vibes, song learning,
// and a 30-second challenge station.

import { CONFIG, SCALES } from './config.js';
import { setupCamera } from './camera.js';
import { HandTracker } from './handTracker.js';
import { GestureAnalyzer } from './gestures.js';
import { StringManager, HarpString } from './strings.js';
import { EffectsManager } from './effects.js';
import { AudioEngine } from './audio.js';
import { Renderer } from './render.js';
import { UIManager } from './ui.js';
import { InstrumentManager } from './instruments.js';
import { ThemeManager } from './themes.js';
import { GrooveSequencer } from './groove.js';
import { VibeManager } from './vibes.js';
import { ChallengeMode } from './modes/challenge.js';
import { SongManager } from './songs.js';
import { LoopManager } from './modes/loop.js';
import { AchievementManager } from './achievements.js';
import { Coach } from './coach.js';
import { encodeShareState, decodeShareState } from './share.js';
import { storage } from './storage.js';
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

    this.groove = new GrooveSequencer(this.audioEngine);
    this.vibeManager = new VibeManager();
    this.challengeMode = new ChallengeMode(this.audioEngine);
    this.songManager = new SongManager(this.audioEngine);
    this.loopManager = new LoopManager(this.audioEngine);

    this.achievements = new AchievementManager((msg) => {
      if (this.ui) this.ui.showToast(msg);
    });

    this.clipRecorder = new ClipRecorder(
      () => this.getCanvasStream(),
      (msg) => { if (this.ui) this.ui.showToast(msg); }
    );

    // Application state
    this.isRunning = false;
    this.isMuted = false;
    this.cameraInstance = null;
    this.currentMode = 'PLAY'; // 'PLAY', 'SONGS', 'CHALLENGE', 'LOOP'
    this.currentPresetIdx = 0;
    this.presetNames = ['HARP', 'FAN', 'GRID'];

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
        this.stringManager.clearAll();
      },
      onUndo: () => {
        this.stringManager.undo();
      },
      onToggleMute: () => this.toggleMute(),
      onSkeletonToggle: () => {
        this.renderer.showSkeleton = !this.renderer.showSkeleton;
      },
      onSkeletonChange: (show) => {
        this.renderer.showSkeleton = show;
      },
      onAllFingersChange: (enabled) => {
        this.stringManager.pluckWithAllFingers = enabled;
      },
      onInstrumentSelect: (name) => this.selectInstrument(name),
      onKeySelect: (key) => this.selectKey(key),
      onScaleSelect: (scale) => this.selectScale(scale),
      onGrooveSelect: (grooveName) => this.selectGroove(grooveName),
      onTempoChange: (bpm) => this.groove.setBpm(bpm),
      onTidyTimingChange: (enabled) => {
        this.groove.setTidyTiming(enabled);
        this.loopManager.tidyTiming = enabled;
      },
      onModeSelect: (mode) => this.selectMode(mode),
      onSongSelect: (songId) => this.selectSong(songId),
      onSongModeChange: (mode) => {
        this.songManager.songMode = mode;
      },
      onLayoutCycle: () => this.cycleLayoutPreset(),
      onVibesCycle: () => this.cycleVibe(),
      onShare: () => this.shareCurrentSetup(),
      onRecordClip: () => this.clipRecorder.startClip(),
      onLoopClear: () => this.loopManager.clear(),
      onChallengeRestart: () => this.startChallengeRound(),
      onDroneToggle: (enabled) => {
        this.audioEngine.toggleDrone(enabled);
      },
      onVideoDimChange: (val) => {
        this.themeManager.videoDim = val;
      },
      onVolumeChange: (val) => this.audioEngine.setMasterVolume(val),
      onReverbChange: (val) => this.audioEngine.setReverbWet(val),
      onNoteLabelsToggle: (show) => {
        this.renderer.showNoteLabels = show;
      }
    });

    // Context Coach
    this.coach = new Coach(
      document.getElementById('coach-container'),
      () => this.cycleVibe()
    );

    // Subtle beat pulse for strings from groove
    this.groove.onBeatPulse = () => {
      for (const str of this.stringManager.strings) {
        str.glowIntensity = Math.min(1.0, str.glowIntensity + 0.08);
      }
    };

    this.initCanvasSize();
    this.bindWindowEvents();

    // Start background idle preview on start screen
    this.initStartScreenIdleAnimation();
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
        this.groove.stop();
      } else {
        if (this.audioEngine.ctx && this.audioEngine.ctx.state === 'suspended') {
          this.audioEngine.ctx.resume();
        }
        if (this.groove.patternName !== 'Off') {
          this.groove.start();
        }
      }
    });
  }

  // Real string renderer running behind text on the start screen
  initStartScreenIdleAnimation() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Create 5 idle strings
    this.stringManager.strings = [];
    const count = 5;
    const marginX = w * 0.22;
    const stepX = (w - marginX * 2) / (count - 1);
    const topY = h * 0.2;
    const bottomY = h * 0.8;

    for (let i = 0; i < count; i++) {
      const x = marginX + i * stepX;
      const str = new HarpString({ x, y: topY }, { x, y: bottomY }, this.audioEngine, w, h, this.themeManager.getCurrentTheme(), false);
      this.stringManager.strings.push(str);
    }

    let lastScriptedPluck = performance.now();
    let pluckIdx = 0;

    const idleLoop = (t) => {
      if (this.isRunning) return; // Exit once user enters camera stage

      const dt = 0.016;
      // Scripted pre-baked fingertip plucks every 2.4s (visual only, audio silent)
      if (t - lastScriptedPluck > 2400 && this.stringManager.strings.length > 0) {
        const str = this.stringManager.strings[pluckIdx % this.stringManager.strings.length];
        str.triggerPluck(0.7, 0.45, t);
        this.effectsManager.onPluck(str, 0.45, 0.7);
        lastScriptedPluck = t;
        pluckIdx++;
      }

      this.effectsManager.update(dt, this.stringManager);
      this.stringManager.update(dt);

      this.renderer.renderFrame(
        null,
        this.stringManager,
        this.effectsManager,
        [],
        this.transform,
        null,
        this.themeManager,
        this.audioEngine
      );

      requestAnimationFrame(idleLoop);
    };

    requestAnimationFrame(idleLoop);
  }

  async start() {
    // 1. Record daily streak
    storage.recordSession();

    this.ui.hideStartScreen();
    this.ui.hideCameraError();

    // 2. Audio Engine Initialization
    try {
      await this.audioEngine.init();
    } catch (e) {
      console.error('Audio initialization error:', e);
    }

    // 3. Camera Setup
    try {
      this.cameraInstance = await setupCamera(this.video, CONFIG.CAMERA);
      this.initCanvasSize();
    } catch (camErr) {
      console.error('Camera error:', camErr);
      this.ui.showCameraError('The camera is blocked. Allow it in the address bar, then try again.');
      return;
    }

    // 4. MediaPipe HandLandmarker Setup
    try {
      await this.handTracker.init();
    } catch (trackErr) {
      console.error('HandLandmarker error:', trackErr);
      this.ui.showCameraError("Hand tracking didn't load. Check your connection and reload.");
      return;
    }

    // 5. Restore Shared Setup if hash is present
    let restored = false;
    if (window.location.hash) {
      const decoded = decodeShareState(window.location.hash, this.canvas.width, this.canvas.height);
      if (decoded) {
        this.applyRestoredSetup(decoded);
        restored = true;
      }
    }

    if (!restored) {
      // Start with clean empty stage
      this.stringManager.clearAll();
      this.stringManager.setTheme(this.themeManager.getCurrentTheme(), this.canvas.width, this.canvas.height);
    }

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  applyRestoredSetup(state) {
    if (state.theme) this.selectTheme(state.theme);
    if (state.instrument) this.selectInstrument(state.instrument);
    if (state.key) this.selectKey(state.key);
    if (state.scale) this.selectScale(state.scale);
    if (state.groove) this.selectGroove(state.groove);
    if (state.bpm) {
      this.groove.setBpm(state.bpm);
    }

    if (state.strings && state.strings.length > 0) {
      this.stringManager.strings = [];
      state.strings.forEach(coords => {
        const str = new HarpString(coords.a, coords.b, this.audioEngine, this.canvas.width, this.canvas.height, this.themeManager.getCurrentTheme(), true);
        this.stringManager.strings.push(str);
      });
      this.achievements.recordStringCreated(this.stringManager.strings.length);
    }
  }

  selectInstrument(name) {
    const inst = this.instrumentManager.setInstrument(name);
    if (inst) {
      this.audioEngine.setInstrumentPreset(inst);
      this.achievements.recordInstrument(name);
      this.ui.syncSoundSheetState(
        inst.name,
        this.audioEngine.rootNote,
        this.audioEngine.scaleKey,
        this.groove.patternName,
        this.groove.bpm
      );
      this.coach.completeStep('swipe');
    }
  }

  selectTheme(name) {
    const theme = this.themeManager.setTheme(name);
    if (theme) {
      this.stringManager.setTheme(theme, this.canvas.width, this.canvas.height);
    }
  }

  selectKey(key) {
    this.audioEngine.setScale(this.audioEngine.scaleKey, key);
    this.ui.syncSoundSheetState(
      this.instrumentManager.currentInstrument,
      key,
      this.audioEngine.scaleKey,
      this.groove.patternName,
      this.groove.bpm
    );
  }

  selectScale(scaleKey) {
    this.audioEngine.setScale(scaleKey, this.audioEngine.rootNote);
    this.ui.syncSoundSheetState(
      this.instrumentManager.currentInstrument,
      this.audioEngine.rootNote,
      scaleKey,
      this.groove.patternName,
      this.groove.bpm
    );
  }

  selectGroove(patternName) {
    this.groove.setPattern(patternName);
    this.ui.syncSoundSheetState(
      this.instrumentManager.currentInstrument,
      this.audioEngine.rootNote,
      this.audioEngine.scaleKey,
      patternName,
      this.groove.bpm
    );
  }

  cycleVibe() {
    const vibe = this.vibeManager.cycleNext();
    if (!vibe) return;

    this.selectTheme(vibe.theme);
    this.selectInstrument(vibe.instrument);
    this.selectKey(vibe.key);
    this.selectScale(vibe.scale);
    this.selectGroove(vibe.groove);
    this.groove.setBpm(vibe.bpm);
    this.stringManager.spawnPreset(vibe.layout, this.canvas.width, this.canvas.height);

    this.ui.showToast(vibe.name);
    this.coach.completeStep('vibe');
  }

  cycleLayoutPreset() {
    const name = this.presetNames[this.currentPresetIdx];
    this.currentPresetIdx = (this.currentPresetIdx + 1) % this.presetNames.length;
    this.stringManager.spawnPreset(name, this.canvas.width, this.canvas.height);
    this.achievements.recordStringCreated(this.stringManager.strings.length);
  }

  selectMode(mode) {
    this.currentMode = mode;

    if (mode === 'CHALLENGE') {
      this.startChallengeRound();
    } else {
      this.challengeMode.stopRound();
      this.ui.hideChallengeEndModal();
    }

    if (mode === 'SONGS') {
      this.ui.toggleSongsSheet(true);
    } else {
      this.songManager.stop();
    }

    if (mode === 'LOOP') {
      this.loopManager.toggleRecording(this.groove.bpm);
    } else {
      this.loopManager.clear();
    }
  }

  selectSong(songId) {
    const song = this.songManager.startSong(
      songId,
      this.songManager.songMode,
      this.stringManager,
      this.canvas.width,
      this.canvas.height,
      (res) => {
        this.achievements.recordSongComplete();
        this.ui.initSongsSheet(); // update stars
        this.ui.showToast(`Completed: ${res.song.title}`);
      }
    );
  }

  startChallengeRound() {
    if (this.stringManager.strings.length === 0) {
      this.stringManager.spawnPreset('HARP', this.canvas.width, this.canvas.height);
    }

    this.challengeMode.startRound(this.stringManager, (stats) => {
      this.achievements.recordScore(stats.score);
      this.ui.showChallengeEndModal(stats);
    });
  }

  shareCurrentSetup() {
    const hash = encodeShareState({
      instrument: this.instrumentManager.currentInstrument,
      key: this.audioEngine.rootNote,
      scale: this.audioEngine.scaleKey,
      theme: this.themeManager.currentTheme,
      groove: this.groove.patternName,
      bpm: this.groove.bpm,
      strings: this.stringManager.strings
    }, this.canvas.width, this.canvas.height);

    const shareUrl = `${window.location.origin}${window.location.pathname}#${hash}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      this.ui.showToast('Link copied.');
      this.achievements.recordShare();
    }).catch(() => {
      this.ui.showToast('Link copied.');
    });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.audioEngine.setMasterVolume(this.isMuted ? 0 : CONFIG.AUDIO.masterVolume);
    this.ui.setMuteState(this.isMuted);
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

    // Update hand indicator dots & prompt
    this.ui.updateHandPresence(handResults, timestamp);

    // Gestures: Swipe for instrument, Clap for theme
    const swiped = this.instrumentManager.checkSwipeGesture(handResults, timestamp);
    if (swiped) {
      this.selectInstrument(swiped.name);
    }

    const clapped = this.themeManager.checkClapGesture(handResults, timestamp);
    if (clapped) {
      this.selectTheme(clapped.name);
      this.coach.completeStep('vibe');
    }

    // 3. String Creation & Plucking State Machine
    this.processInteractionStateMachine(handResults, timestamp, dt);

    // 4. Update Modes, Effects & Strings
    this.effectsManager.update(dt, this.stringManager);
    this.stringManager.update(dt);

    if (this.currentMode === 'CHALLENGE') {
      this.challengeMode.update(dt, this.stringManager);
      this.ui.updateChallengeHud(this.challengeMode.score, this.challengeMode.combo, this.challengeMode.timeRemaining);
    }

    if (this.currentMode === 'LOOP') {
      this.loopManager.update(dt, this.stringManager, this.effectsManager);
      this.ui.updateLoopBar(this.loopManager.getProgress(), this.loopManager.getAllEvents());
    }

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

    // Mode-specific canvas render overlays
    if (this.currentMode === 'CHALLENGE') {
      this.challengeMode.renderTarget(this.renderer.ctx, this.stringManager, this.themeManager.getCurrentTheme().accent);
    }

    // 6. Coach Idle Check & Telemetry
    this.coach.updateActivity(this.stringManager.strings.length);
    this.ui.updateStats(this.fps, this.stringManager.strings.length);

    requestAnimationFrame((t) => this.loop(t));
  }

  processInteractionStateMachine(handResults, timestamp, dt) {
    const pinchHands = handResults.filter(h => h.isPinching);
    const pointingHands = handResults.filter(h => h.isPointing);

    // Core String Creation
    if (pinchHands.length >= 2) {
      this.stringManager.setPreview(pinchHands[0].pinchPoint, pinchHands[1].pinchPoint, this.canvas.width, this.canvas.height);
      this.coach.completeStep('pinch');
    } else if (pinchHands.length === 1 && pointingHands.length >= 1) {
      this.stringManager.setPreview(pinchHands[0].pinchPoint, pointingHands[0].indexTip, this.canvas.width, this.canvas.height);
      this.coach.completeStep('pinch');
    } else {
      // Pinch released: if preview string exists, lock it
      if (this.stringManager.previewString) {
        const minLen = CONFIG.GESTURES.minStringLength || 80;
        if (this.stringManager.previewString.length >= minLen) {
          const locked = this.stringManager.lockPreview(this.canvas.width, this.canvas.height);
          if (locked) {
            this.coach.completeStep('lock');
            this.achievements.recordStringCreated(this.stringManager.strings.length);
          }
        } else {
          this.stringManager.cancelPreview();
        }
      }
    }

    // Drag-to-move endpoint
    this.stringManager.handleMove(handResults, this.canvas.width, this.canvas.height);

    // Pluck detection
    this.stringManager.checkPlucks(handResults, timestamp, this.effectsManager, this.canvas.width, (str, tString, strength, plucksInFrame) => {
      this.coach.completeStep('pluck');
      this.achievements.recordPluck(timestamp);
      storage.incrementPlucks(1);

      // Challenge mode evaluation
      if (this.currentMode === 'CHALLENGE') {
        const res = this.challengeMode.onPluck(str.id, this.stringManager);
        if (res && res.hit) {
          this.achievements.recordCombo(res.combo);
        }
      }

      // Song mode evaluation
      if (this.currentMode === 'SONGS') {
        this.songManager.onPluck(str.id, this.stringManager);
      }

      // Loop mode recording
      if (this.currentMode === 'LOOP') {
        this.loopManager.recordPluck(str.id, strength, tString, this.groove.bpm);
        this.achievements.recordLoopLayer(this.loopManager.layers.length);
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AirHarpApp();
});
