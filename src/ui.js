// UI Manager for Air Harp
// Restrained, instrument-like design system.
// Start screen with 6s looping vector demo, top bar, bottom dock,
// vertical NOW PLAYING readout, right drawer settings, and responsive layout.

export class UIManager {
  constructor(callbacks) {
    this.callbacks = callbacks;

    // DOM Elements
    this.startScreen = document.getElementById('start-screen');
    this.stageUi = document.getElementById('stage-ui');
    this.topBar = document.getElementById('top-bar');
    this.topLoader = document.getElementById('top-loader');
    this.settingsDrawer = document.getElementById('settings-drawer');
    this.errorBanner = document.getElementById('error-banner');
    this.toastContainer = document.getElementById('toast-container');
    this.handStatus = document.getElementById('hand-status');
    this.statsDisplay = document.getElementById('stats-display');
    this.instantHint = document.getElementById('instant-hint');
    this.nowPlayingNote = document.getElementById('now-playing-note');
    this.meterBars = document.querySelectorAll('.meter-bar');

    // Inactivity fading (dim to 25% after 3s of no activity)
    this.idleTimer = null;
    this.isIdle = false;

    // Start screen 6s vector demo canvas
    this.demoCanvas = document.getElementById('demo-canvas');
    this.demoCtx = this.demoCanvas ? this.demoCanvas.getContext('2d') : null;
    this.demoStartTime = performance.now();
    this.isDemoRunning = true;

    this.bindEvents();
    this.setupDemoLoop();
  }

  bindEvents() {
    // Start camera button
    const btnStart = document.getElementById('btn-start-camera');
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        this.isDemoRunning = false;
        this.callbacks.onStart();
      });
    }

    // Try again button on error banner
    const btnRetry = document.getElementById('btn-error-retry');
    if (btnRetry) {
      btnRetry.addEventListener('click', () => {
        this.hideError();
        this.callbacks.onStart();
      });
    }

    // Settings Drawer Open / Close
    const btnSettings = document.getElementById('btn-settings-toggle');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => this.toggleSettings());
    }
    if (btnCloseDrawer) {
      btnCloseDrawer.addEventListener('click', () => this.toggleSettings(false));
    }

    // Fullscreen Toggle
    const btnFs = document.getElementById('btn-fullscreen');
    if (btnFs) {
      btnFs.addEventListener('click', () => this.toggleFullscreen());
    }

    // Mute Toggle
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) {
      btnMute.addEventListener('click', () => this.callbacks.onToggleMute());
    }

    // Instrument segmented buttons
    const instrumentBtns = document.querySelectorAll('[data-instrument]');
    instrumentBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-instrument');
        this.callbacks.onInstrumentSelect(name);
      });
    });

    // Layout presets button
    const btnLayout = document.getElementById('btn-layout-presets');
    if (btnLayout) {
      btnLayout.addEventListener('click', () => this.callbacks.onLayoutCycle());
    }

    // Undo button
    const btnUndo = document.getElementById('btn-undo');
    if (btnUndo) {
      btnUndo.addEventListener('click', () => this.callbacks.onUndo());
    }

    // Clear all button
    const btnClear = document.getElementById('btn-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => this.callbacks.onClear());
    }

    // Record clip button
    const btnRec = document.getElementById('btn-record-clip');
    if (btnRec) {
      btnRec.addEventListener('click', () => this.callbacks.onRecordClip());
    }

    // Settings Inputs
    this.bindSettingsInputs();

    // Idle activity listeners
    const resetIdle = () => this.pokeActivity();
    window.addEventListener('mousemove', resetIdle, { passive: true });
    window.addEventListener('mousedown', resetIdle, { passive: true });
    window.addEventListener('keydown', (e) => {
      resetIdle();
      if (e.key === 'Escape') {
        this.toggleSettings(false);
      } else if (e.key === 'h' || e.key === 'H') {
        this.callbacks.onSkeletonToggle();
      } else if (e.key === 'c' || e.key === 'C') {
        this.callbacks.onClear();
      } else if (e.key === 'z' || e.key === 'Z') {
        this.callbacks.onUndo();
      } else if (e.key === 'f' || e.key === 'F') {
        this.toggleFullscreen();
      } else if (e.code === 'Space') {
        e.preventDefault();
        this.callbacks.onToggleMute();
      }
    });

    this.pokeActivity();
  }

  pokeActivity() {
    if (this.stageUi) {
      this.stageUi.classList.remove('idle');
    }
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.stageUi) {
        this.stageUi.classList.add('idle');
      }
    }, 3000);
  }

  bindSettingsInputs() {
    // Key select
    const keySelect = document.getElementById('drawer-key-select');
    if (keySelect) {
      keySelect.addEventListener('change', (e) => {
        this.callbacks.onKeySelect(e.target.value);
        const keyStatus = document.getElementById('status-key');
        if (keyStatus) keyStatus.textContent = `${e.target.value} SCALE`;
      });
    }

    // Scale select
    const scaleSelect = document.getElementById('drawer-scale-select');
    if (scaleSelect) {
      scaleSelect.addEventListener('change', (e) => {
        this.callbacks.onScaleSelect(e.target.value);
      });
    }

    // Theme select
    const themeSelect = document.getElementById('drawer-theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        this.callbacks.onThemeSelect(e.target.value);
      });
    }

    // Drone pad toggle
    const droneCheck = document.getElementById('toggle-drone-pad');
    if (droneCheck) {
      droneCheck.addEventListener('change', (e) => {
        this.callbacks.onDroneToggle(e.target.checked);
      });
    }

    // Master volume slider
    const volSlider = document.getElementById('slider-master-volume');
    const volVal = document.getElementById('slider-master-volume-val');
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (volVal) volVal.textContent = Math.round(val * 100);
        this.callbacks.onVolumeChange(val);
      });
    }

    // Reverb wet slider
    const revSlider = document.getElementById('slider-reverb');
    const revVal = document.getElementById('slider-reverb-val');
    if (revSlider) {
      revSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (revVal) revVal.textContent = Math.round(val * 100);
        this.callbacks.onReverbChange(val);
      });
    }

    // Video Dim slider
    const dimSlider = document.getElementById('slider-video-dim');
    const dimVal = document.getElementById('slider-video-dim-val');
    if (dimSlider) {
      dimSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (dimVal) dimVal.textContent = `${Math.round(val * 100)}%`;
        this.callbacks.onVideoDimChange(val);
      });
    }

    // Telemetry display toggle
    const statsToggle = document.getElementById('toggle-show-stats');
    if (statsToggle) {
      statsToggle.addEventListener('change', (e) => {
        if (this.statsDisplay) {
          this.statsDisplay.style.display = e.target.checked ? 'block' : 'none';
        }
      });
    }
  }

  setupDemoLoop() {
    if (!this.demoCanvas || !this.demoCtx) return;

    const renderDemo = (now) => {
      if (!this.isDemoRunning) return;
      const elapsed = ((now - this.demoStartTime) / 1000) % 6.0;
      this.drawDemoFrame(elapsed);
      requestAnimationFrame(renderDemo);
    };
    requestAnimationFrame(renderDemo);
  }

  drawDemoFrame(t) {
    const ctx = this.demoCtx;
    const w = this.demoCanvas.width;
    const h = this.demoCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Subtle dark surface background
    ctx.fillStyle = '#121214';
    ctx.fillRect(0, 0, w, h);

    // Subtle coordinate grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 30; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 30; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Timeline phases:
    // 0.0s - 2.5s: Two pinch hands stretch a string
    // 2.5s - 4.5s: String locks, third pointing hand sweeps through to pluck
    // 4.5s - 6.0s: Plucked string vibrates with resonance, loop resets
    const handA = { x: 80, y: 120 };
    const handB = { x: 280, y: 120 };

    if (t < 2.5) {
      const p = Math.min(1.0, t / 2.0);
      const ease = 1 - Math.pow(1 - p, 3);
      const currentB = { x: 100 + 180 * ease, y: 120 };

      // Drawing preview string
      ctx.strokeStyle = '#D8FF3E';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(handA.x, handA.y);
      ctx.lineTo(currentB.x, currentB.y);
      ctx.stroke();
      ctx.setLineDash([]);

      this.drawDemoPinch(handA.x, handA.y, 'L');
      this.drawDemoPinch(currentB.x, currentB.y, 'R');

      ctx.fillStyle = '#9A9A96';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('01 PINCH & STRETCH', w / 2, 215);

    } else if (t < 4.5) {
      // String locked
      ctx.strokeStyle = '#ECECEA';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(handA.x, handA.y);
      ctx.lineTo(handB.x, handB.y);
      ctx.stroke();

      this.drawDemoEndcap(handA.x, handA.y);
      this.drawDemoEndcap(handB.x, handB.y);

      // Fingertip plucking across the string
      const pluckP = (t - 2.5) / 2.0;
      const fingerX = handA.x + 80 + pluckP * 40;
      const fingerY = 60 + pluckP * 120;

      this.drawDemoFinger(fingerX, fingerY);

      ctx.fillStyle = '#9A9A96';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('02 RELEASE TO LOCK & PLUCK', w / 2, 215);

    } else {
      // Vibrating string
      const vibT = t - 4.5;
      const amp = Math.exp(-vibT * 2.0) * 14 * Math.sin(vibT * 28);

      ctx.strokeStyle = '#D8FF3E';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(handA.x, handA.y);
      ctx.quadraticCurveTo(handA.x + 100, handA.y + amp, handB.x, handB.y);
      ctx.stroke();

      this.drawDemoEndcap(handA.x, handA.y);
      this.drawDemoEndcap(handB.x, handB.y);

      ctx.fillStyle = '#D8FF3E';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('03 RESONATE (C4)', w / 2, 215);
    }
  }

  drawDemoPinch(x, y, label) {
    const ctx = this.demoCtx;
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#D8FF3E';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#D8FF3E';
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }

  drawDemoEndcap(x, y) {
    const ctx = this.demoCtx;
    ctx.fillStyle = '#ECECEA';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#9A9A96';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 8);
    ctx.stroke();
  }

  drawDemoFinger(x, y) {
    const ctx = this.demoCtx;
    ctx.fillStyle = '#ECECEA';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#D8FF3E';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  hideStartScreen() {
    if (this.startScreen) {
      this.startScreen.classList.add('hidden');
    }
  }

  showLoader(progress) {
    if (this.topLoader) {
      this.topLoader.style.width = `${progress}%`;
      this.topLoader.classList.add('active');
    }
  }

  hideLoader() {
    if (this.topLoader) {
      this.topLoader.style.width = '100%';
      setTimeout(() => {
        this.topLoader.classList.remove('active');
        this.topLoader.style.width = '0%';
      }, 300);
    }
  }

  showError(msg) {
    if (this.errorBanner) {
      const bannerText = document.getElementById('error-banner-text');
      if (bannerText) bannerText.textContent = msg;
      this.errorBanner.classList.add('active');
    }
  }

  hideError() {
    if (this.errorBanner) {
      this.errorBanner.classList.remove('active');
    }
  }

  showToast(msg) {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('out');
      setTimeout(() => toast.remove(), 200);
    }, 2400);
  }

  hideInstantHint() {
    if (this.instantHint) {
      this.instantHint.classList.add('hidden');
    }
  }

  pulseTopBar() {
    if (this.topBar) {
      this.topBar.classList.add('pulse-beat');
      setTimeout(() => {
        this.topBar.classList.remove('pulse-beat');
      }, 45);
    }
  }

  updateNowPlaying(noteName, level) {
    if (this.nowPlayingNote) {
      this.nowPlayingNote.textContent = noteName;
    }

    if (this.meterBars && this.meterBars.length > 0) {
      const activeCount = Math.round(level * this.meterBars.length);
      for (let i = 0; i < this.meterBars.length; i++) {
        if (i < activeCount) {
          this.meterBars[i].classList.add('active');
        } else {
          this.meterBars[i].classList.remove('active');
        }
      }
    }
  }

  updateHandStatus(handCount) {
    if (!this.handStatus) return;
    if (handCount === 0) {
      this.handStatus.textContent = 'SHOW YOUR HANDS';
      this.handStatus.style.color = 'var(--text-tertiary)';
    } else if (handCount === 1) {
      this.handStatus.textContent = '1 HAND DETECTED (PINCH WITH 2 TO CREATE)';
      this.handStatus.style.color = 'var(--text-secondary)';
    } else {
      this.handStatus.textContent = '2 HANDS READY &bull; PINCH TO DRAW STRING';
      this.handStatus.style.color = 'var(--accent)';
    }
  }

  updateStats(fps, stringCount) {
    if (this.statsDisplay) {
      this.statsDisplay.textContent = `${Math.round(fps)} FPS / ${stringCount} STRINGS`;
    }
  }

  setInstrumentActive(name) {
    const btns = document.querySelectorAll('[data-instrument]');
    btns.forEach(btn => {
      if (btn.getAttribute('data-instrument') === name) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const statusBadge = document.getElementById('status-instrument');
    if (statusBadge) {
      statusBadge.textContent = name;
    }
  }

  toggleSettings(forceState) {
    if (!this.settingsDrawer) return;
    const isVisible = forceState !== undefined ? forceState : this.settingsDrawer.classList.contains('active');
    this.settingsDrawer.classList.toggle('active', !isVisible);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
}
