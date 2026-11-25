// UI Manager for Air Harp
// Human-crafted, quiet stage interface with Sound sheet, Songs library,
// Menu drawer, context Coach, and sliding mode switch.

import { ICONS } from './icons.js';
import { INSTRUMENTS, INSTRUMENT_KEYS, getSparklineSvgPath } from './instruments.js';
import { SCALES, NOTE_NAMES } from './config.js';
import { GROOVE_PATTERNS } from './groove.js';
import { SONGS } from './songs.js';
import { ACHIEVEMENTS } from './achievements.js';
import { storage } from './storage.js';

export class UIManager {
  constructor(callbacks) {
    this.callbacks = callbacks;

    // DOM Elements
    this.stageUi = document.getElementById('stage-ui');
    this.startScreen = document.getElementById('start-screen');
    this.toastEl = document.getElementById('toast');
    this.coachContainer = document.getElementById('coach-container');
    this.missingHandsPrompt = document.getElementById('missing-hands-prompt');
    this.handDotLeft = document.getElementById('hand-dot-left');
    this.handDotRight = document.getElementById('hand-dot-right');
    this.statsDisplay = document.getElementById('stats-display');

    // Sheets & Drawers
    this.soundSheet = document.getElementById('sound-sheet');
    this.soundBackdrop = document.getElementById('sound-sheet-backdrop');
    this.songsSheet = document.getElementById('songs-sheet');
    this.songsBackdrop = document.getElementById('songs-sheet-backdrop');
    this.menuDrawer = document.getElementById('menu-drawer');
    this.menuBackdrop = document.getElementById('menu-backdrop');
    this.challengeEndModal = document.getElementById('challenge-end-modal');
    this.challengeHud = document.getElementById('challenge-hud');

    // Loop Bar
    this.loopBar = document.getElementById('loop-bar');
    this.loopPlayhead = document.getElementById('loop-playhead');
    this.loopTicksContainer = document.getElementById('loop-ticks-container');

    // Inactivity timer (4s)
    this.idleTimer = null;
    this.missingHandsTimer = null;
    this.lastHandSeenTime = performance.now();

    // Mode Pill
    this.modePill = document.getElementById('mode-sliding-pill');
    this.currentMode = 'PLAY';

    // State for Sound Sheet
    this.currentInstrument = 'HARP';
    this.currentKey = 'C';
    this.currentScale = 'c_minor';
    this.currentGroove = 'Off';
    this.currentBpm = 80;

    this.initIcons();
    this.initStartScreen();
    this.initSoundSheet();
    this.initSongsSheet();
    this.initMenuDrawer();
    this.bindEvents();
    this.updateModePill('PLAY');
  }

  initIcons() {
    // Sound & Menu top icons
    const btnSound = document.getElementById('btn-sound-toggle');
    if (btnSound) btnSound.innerHTML = ICONS.soundOn;

    const btnMenu = document.getElementById('btn-menu-toggle');
    if (btnMenu) btnMenu.innerHTML = ICONS.menu;

    // Close buttons
    const btnCloseSound = document.getElementById('btn-close-sound');
    if (btnCloseSound) btnCloseSound.innerHTML = ICONS.close;

    const btnCloseSongs = document.getElementById('btn-close-songs');
    if (btnCloseSongs) btnCloseSongs.innerHTML = ICONS.close;

    const btnCloseMenu = document.getElementById('btn-close-menu');
    if (btnCloseMenu) btnCloseMenu.innerHTML = ICONS.close;

    // Dock action tool icons
    const btnLayout = document.getElementById('btn-layout');
    if (btnLayout) btnLayout.innerHTML = ICONS.layout;

    const btnVibes = document.getElementById('btn-vibes');
    if (btnVibes) btnVibes.innerHTML = ICONS.sparkle;

    const btnUndo = document.getElementById('btn-undo');
    if (btnUndo) btnUndo.innerHTML = ICONS.undo;

    const btnClear = document.getElementById('btn-clear');
    if (btnClear) btnClear.innerHTML = ICONS.trash;

    const btnRec = document.getElementById('btn-record-clip');
    if (btnRec) btnRec.innerHTML = ICONS.recordDot;

    const btnShare = document.getElementById('btn-share');
    if (btnShare) btnShare.innerHTML = ICONS.shareLink;
  }

  initStartScreen() {
    // Inject start illustrations
    const elPinch = document.getElementById('icon-pinch');
    if (elPinch) elPinch.innerHTML = ICONS.handPinch;

    const elOpen = document.getElementById('icon-open');
    if (elOpen) elOpen.innerHTML = ICONS.handOpen;

    const elFlick = document.getElementById('icon-flick');
    if (elFlick) elFlick.innerHTML = ICONS.handFlick;

    // Check returning streak & best score
    const streak = storage.getStreak();
    const bestScore = storage.getChallengeBest();
    const lineEl = document.getElementById('start-returning-line');

    if (lineEl && (streak >= 2 || bestScore > 0)) {
      const parts = [];
      if (streak >= 2) parts.push(`Day ${streak} in a row.`);
      if (bestScore > 0) parts.push(`Best score: ${bestScore}.`);
      lineEl.textContent = parts.join(' ');
      lineEl.classList.remove('hidden');
    }
  }

  initSoundSheet() {
    // 1. Populate instrument cards
    const listEl = document.getElementById('instrument-cards-list');
    if (listEl) {
      listEl.innerHTML = '';
      INSTRUMENT_KEYS.forEach(key => {
        const inst = INSTRUMENTS[key];
        const card = document.createElement('div');
        card.className = `instrument-card ${key === this.currentInstrument ? 'selected' : ''}`;
        card.setAttribute('data-inst-key', key);

        const sparklineSvg = `
          <svg class="inst-sparkline" viewBox="0 0 60 20">
            <path d="${getSparklineSvgPath(key, 60, 20)}" />
          </svg>
        `;

        card.innerHTML = `
          <div class="inst-card-info">
            <span class="inst-card-name">${inst.label}</span>
            <span class="inst-card-desc">${inst.description}</span>
          </div>
          ${sparklineSvg}
        `;

        card.addEventListener('click', () => {
          this.callbacks.onInstrumentSelect(key);
        });

        listEl.appendChild(card);
      });
    }

    // 2. Populate Key Picker (C D E F G A B)
    const keyRow = document.getElementById('picker-key-row');
    if (keyRow) {
      keyRow.innerHTML = '';
      const keys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      keys.forEach(k => {
        const btn = document.createElement('button');
        btn.className = `seg-item ${k === this.currentKey ? 'selected' : ''}`;
        btn.textContent = k;
        btn.setAttribute('data-key', k);
        btn.addEventListener('click', () => this.callbacks.onKeySelect(k));
        keyRow.appendChild(btn);
      });
    }

    // 3. Populate Scale Picker (Minor, Major, Pentatonic)
    const scaleRow = document.getElementById('picker-scale-row');
    if (scaleRow) {
      scaleRow.innerHTML = '';
      const scales = [
        { id: 'c_minor', label: 'Minor' },
        { id: 'major', label: 'Major' },
        { id: 'minor_pentatonic', label: 'Pentatonic' }
      ];
      scales.forEach(s => {
        const btn = document.createElement('button');
        btn.className = `seg-item ${s.id === this.currentScale ? 'selected' : ''}`;
        btn.textContent = s.label;
        btn.setAttribute('data-scale', s.id);
        btn.addEventListener('click', () => this.callbacks.onScaleSelect(s.id));
        scaleRow.appendChild(btn);
      });
    }

    // 4. Populate Groove Picker (Off, Slow, Lo-fi, Upbeat)
    const grooveRow = document.getElementById('picker-groove-row');
    if (grooveRow) {
      grooveRow.innerHTML = '';
      const grooves = ['Off', 'Slow', 'Lo-fi', 'Upbeat'];
      grooves.forEach(g => {
        const btn = document.createElement('button');
        btn.className = `seg-item ${g === this.currentGroove ? 'selected' : ''}`;
        btn.textContent = g;
        btn.setAttribute('data-groove', g);
        btn.addEventListener('click', () => this.callbacks.onGrooveSelect(g));
        grooveRow.appendChild(btn);
      });
    }
  }

  initSongsSheet() {
    const listEl = document.getElementById('songs-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const progress = storage.getSongProgress();

    SONGS.forEach(song => {
      const card = document.createElement('div');
      card.className = 'song-card';

      const dots = Array.from({ length: 3 }).map((_, i) => {
        return `<span class="diff-dot ${i < song.difficulty ? 'filled' : ''}"></span>`;
      }).join('');

      const starsCount = progress[song.id] || 0;
      const starsHtml = starsCount > 0 ? '★'.repeat(starsCount) : '';

      card.innerHTML = `
        <div class="song-card-info">
          <span class="song-card-title">${song.title}</span>
          <div class="song-card-meta">
            <span>${song.durationSeconds}s</span>
            <span class="song-difficulty-dots" title="Difficulty ${song.difficulty}/3">${dots}</span>
          </div>
        </div>
        <div class="song-stars">${starsHtml}</div>
      `;

      card.addEventListener('click', () => {
        this.toggleSongsSheet(false);
        this.callbacks.onSongSelect(song.id);
      });

      listEl.appendChild(card);
    });
  }

  initMenuDrawer() {
    // Update collected stats
    const streakEl = document.getElementById('collected-streak');
    if (streakEl) streakEl.textContent = storage.getStreak();

    const plucksEl = document.getElementById('collected-plucks');
    if (plucksEl) plucksEl.textContent = storage.getTotalPlucks();

    const bestEl = document.getElementById('collected-best-score');
    if (bestEl) bestEl.textContent = storage.getChallengeBest();

    // Populate achievements
    const achList = document.getElementById('achievements-list');
    if (achList) {
      achList.innerHTML = '';
      const unlocked = storage.getAchievements();

      ACHIEVEMENTS.forEach(ach => {
        const entry = unlocked[ach.id];
        const row = document.createElement('div');
        row.className = 'achievement-row';

        row.innerHTML = `
          <div class="ach-info">
            <span class="ach-title">${ach.title}</span>
            <span class="ach-desc">${ach.desc}</span>
          </div>
          <div class="ach-status">
            ${entry ? `${ICONS.check} <span>${entry.unlockedAt || ''}</span>` : '<span style="color:var(--text-tertiary);">—</span>'}
          </div>
        `;
        achList.appendChild(row);
      });
    }
  }

  bindEvents() {
    // Start camera CTA
    const btnStart = document.getElementById('btn-start-camera');
    if (btnStart) {
      btnStart.addEventListener('click', () => this.callbacks.onStart());
    }

    // Sound sheet toggles
    const chipSound = document.getElementById('chip-sound-sheet');
    if (chipSound) {
      chipSound.addEventListener('click', () => this.toggleSoundSheet());
    }
    const btnCloseSound = document.getElementById('btn-close-sound');
    if (btnCloseSound) {
      btnCloseSound.addEventListener('click', () => this.toggleSoundSheet(false));
    }
    if (this.soundBackdrop) {
      this.soundBackdrop.addEventListener('click', () => this.toggleSoundSheet(false));
    }

    // Songs sheet close
    const btnCloseSongs = document.getElementById('btn-close-songs');
    if (btnCloseSongs) {
      btnCloseSongs.addEventListener('click', () => this.toggleSongsSheet(false));
    }
    if (this.songsBackdrop) {
      this.songsBackdrop.addEventListener('click', () => this.toggleSongsSheet(false));
    }

    // Song mode tabs (Learn / Rhythm)
    const songTabs = document.querySelectorAll('.song-mode-tab');
    songTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        songTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.callbacks.onSongModeChange(tab.getAttribute('data-songmode'));
      });
    });

    // Menu drawer toggles
    const btnMenu = document.getElementById('btn-menu-toggle');
    if (btnMenu) {
      btnMenu.addEventListener('click', () => this.toggleMenuDrawer());
    }
    const btnCloseMenu = document.getElementById('btn-close-menu');
    if (btnCloseMenu) {
      btnCloseMenu.addEventListener('click', () => this.toggleMenuDrawer(false));
    }
    if (this.menuBackdrop) {
      this.menuBackdrop.addEventListener('click', () => this.toggleMenuDrawer(false));
    }

    // Sound toggle button (Mute)
    const btnSoundToggle = document.getElementById('btn-sound-toggle');
    if (btnSoundToggle) {
      btnSoundToggle.addEventListener('click', () => this.callbacks.onToggleMute());
    }

    // Dock action tools
    const btnLayout = document.getElementById('btn-layout');
    if (btnLayout) btnLayout.addEventListener('click', () => this.callbacks.onLayoutCycle());

    const btnVibes = document.getElementById('btn-vibes');
    if (btnVibes) btnVibes.addEventListener('click', () => this.callbacks.onVibesCycle());

    const btnUndo = document.getElementById('btn-undo');
    if (btnUndo) btnUndo.addEventListener('click', () => this.callbacks.onUndo());

    const btnClear = document.getElementById('btn-clear');
    if (btnClear) btnClear.addEventListener('click', () => this.callbacks.onClear());

    const btnRec = document.getElementById('btn-record-clip');
    if (btnRec) btnRec.addEventListener('click', () => this.callbacks.onRecordClip());

    const btnShare = document.getElementById('btn-share');
    if (btnShare) btnShare.addEventListener('click', () => this.callbacks.onShare());

    // Loop clear
    const btnLoopClear = document.getElementById('btn-loop-clear');
    if (btnLoopClear) btnLoopClear.addEventListener('click', () => this.callbacks.onLoopClear());

    // Challenge Go again button
    const btnChallengeRestart = document.getElementById('btn-challenge-restart');
    if (btnChallengeRestart) {
      btnChallengeRestart.addEventListener('click', () => {
        this.hideChallengeEndModal();
        this.callbacks.onChallengeRestart();
      });
    }

    // Camera retry
    const btnRetry = document.getElementById('btn-camera-retry');
    if (btnRetry) {
      btnRetry.addEventListener('click', () => {
        this.hideCameraError();
        this.callbacks.onStart();
      });
    }

    // Mode Switch tabs
    const modeTabs = document.querySelectorAll('.mode-tab');
    modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.getAttribute('data-mode');
        this.setMode(mode);
        this.callbacks.onModeSelect(mode);
      });
    });

    // Tempo Slider
    const tempoSlider = document.getElementById('slider-tempo');
    const tempoVal = document.getElementById('tempo-val');
    if (tempoSlider) {
      tempoSlider.addEventListener('input', (e) => {
        const bpm = parseInt(e.target.value, 10);
        if (tempoVal) tempoVal.textContent = `${bpm} BPM`;
        this.callbacks.onTempoChange(bpm);
      });
    }

    // Tidy Timing toggle
    const tidyToggle = document.getElementById('toggle-tidy-timing');
    if (tidyToggle) {
      tidyToggle.addEventListener('change', (e) => {
        this.callbacks.onTidyTimingChange(e.target.checked);
      });
    }

    // Menu Drawer inputs
    this.bindMenuInputs();

    // Inactivity reset listeners
    const poke = () => this.pokeActivity();
    window.addEventListener('mousemove', poke, { passive: true });
    window.addEventListener('mousedown', poke, { passive: true });
    window.addEventListener('keydown', (e) => {
      poke();
      if (e.key === 'Escape') {
        this.toggleSoundSheet(false);
        this.toggleSongsSheet(false);
        this.toggleMenuDrawer(false);
        this.hideChallengeEndModal();
      } else if (e.code === 'Space') {
        // Prevent page scroll and toggle mute
        if (e.target.tagName !== 'INPUT') {
          e.preventDefault();
          this.callbacks.onToggleMute();
        }
      } else if (e.key === 'z' || e.key === 'Z') {
        if (e.target.tagName !== 'INPUT') this.callbacks.onUndo();
      } else if (e.key === 'c' || e.key === 'C') {
        if (e.target.tagName !== 'INPUT') this.callbacks.onClear();
      } else if (e.key === 'h' || e.key === 'H') {
        if (e.target.tagName !== 'INPUT') this.callbacks.onSkeletonToggle();
      } else if (e.key === 'f' || e.key === 'F') {
        if (e.target.tagName !== 'INPUT') this.toggleFullscreen();
      } else if (e.key === '?') {
        this.toggleMenuDrawer(true);
      }
    });

    this.pokeActivity();
  }

  bindMenuInputs() {
    // Volume
    const volSlider = document.getElementById('slider-master-volume');
    const volVal = document.getElementById('val-master-volume');
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (volVal) volVal.textContent = `${Math.round(val * 100)}%`;
        this.callbacks.onVolumeChange(val);
      });
    }

    // Reverb
    const revSlider = document.getElementById('slider-reverb');
    const revVal = document.getElementById('val-reverb');
    if (revSlider) {
      revSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (revVal) revVal.textContent = `${Math.round(val * 100)}%`;
        this.callbacks.onReverbChange(val);
      });
    }

    // Drone
    const droneCheck = document.getElementById('toggle-drone-pad');
    if (droneCheck) {
      droneCheck.addEventListener('change', (e) => {
        this.callbacks.onDroneToggle(e.target.checked);
      });
    }

    // Video Dim
    const dimSlider = document.getElementById('slider-video-dim');
    const dimVal = document.getElementById('val-video-dim');
    if (dimSlider) {
      dimSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (dimVal) dimVal.textContent = `${Math.round(val * 100)}%`;
        this.callbacks.onVideoDimChange(val);
      });
    }

    // Note Names
    const noteToggle = document.getElementById('toggle-note-names');
    if (noteToggle) {
      noteToggle.addEventListener('change', (e) => {
        this.callbacks.onNoteLabelsToggle(e.target.checked);
      });
    }

    // Show Stats
    const statsToggle = document.getElementById('toggle-show-stats');
    if (statsToggle) {
      statsToggle.addEventListener('change', (e) => {
        if (this.statsDisplay) {
          this.statsDisplay.classList.toggle('hidden', !e.target.checked);
        }
      });
    }

    // Skeleton
    const skelToggle = document.getElementById('toggle-show-skeleton');
    if (skelToggle) {
      skelToggle.addEventListener('change', (e) => {
        this.callbacks.onSkeletonChange(e.target.checked);
      });
    }

    // All fingers
    const allFingersToggle = document.getElementById('toggle-all-fingers');
    if (allFingersToggle) {
      allFingersToggle.addEventListener('change', (e) => {
        this.callbacks.onAllFingersChange(e.target.checked);
      });
    }

    // Fullscreen button in drawer
    const btnFs = document.getElementById('btn-fullscreen-drawer');
    if (btnFs) {
      btnFs.addEventListener('click', () => this.toggleFullscreen());
    }
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
    }, 4000);
  }

  updateHandPresence(handResults, timestamp) {
    let hasLeft = false;
    let hasRight = false;

    if (handResults && handResults.length > 0) {
      this.lastHandSeenTime = timestamp;
      handResults.forEach(h => {
        if (h.handedness === 'Left') hasLeft = true;
        if (h.handedness === 'Right') hasRight = true;
      });
    }

    if (this.handDotLeft) this.handDotLeft.classList.toggle('active', hasLeft);
    if (this.handDotRight) this.handDotRight.classList.toggle('active', hasRight);

    // After 2s of no hand seen, show soft line prompt
    const noHands = (!handResults || handResults.length === 0);
    if (noHands) {
      if (timestamp - this.lastHandSeenTime >= 2000) {
        if (this.missingHandsPrompt) this.missingHandsPrompt.classList.remove('hidden');
      }
    } else {
      if (this.missingHandsPrompt) this.missingHandsPrompt.classList.add('hidden');
    }
  }

  updateStats(fps, stringCount) {
    if (this.statsDisplay && !this.statsDisplay.classList.contains('hidden')) {
      this.statsDisplay.textContent = `${Math.round(fps)} FPS · ${stringCount} strings`;
    }
  }

  showToast(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('hidden');

    // Force animation reflow
    this.toastEl.style.animation = 'none';
    this.toastEl.offsetHeight;
    this.toastEl.style.animation = 'toastFade 2.5s ease forwards';

    setTimeout(() => {
      if (this.toastEl) this.toastEl.classList.add('hidden');
    }, 2500);
  }

  setMode(mode) {
    this.currentMode = mode;
    this.updateModePill(mode);

    // Hide or show mode-specific overlays
    if (this.challengeHud) this.challengeHud.classList.toggle('hidden', mode !== 'CHALLENGE');
    if (this.loopBar) this.loopBar.classList.toggle('hidden', mode !== 'LOOP');

    if (mode === 'SONGS') {
      this.toggleSongsSheet(true);
    } else {
      this.toggleSongsSheet(false);
    }
  }

  updateModePill(mode) {
    const tabs = document.querySelectorAll('.mode-tab');
    tabs.forEach(t => {
      const isMatch = t.getAttribute('data-mode') === mode;
      t.classList.toggle('active', isMatch);
      if (isMatch && this.modePill) {
        this.modePill.style.transform = `translateX(${t.offsetLeft - 2}px)`;
        this.modePill.style.width = `${t.offsetWidth}px`;
      }
    });
  }

  updateSoundChip(instLabel, key, scaleKey) {
    const chipLabel = document.getElementById('chip-sound-label');
    if (!chipLabel) return;

    const scaleName = (SCALES[scaleKey] && SCALES[scaleKey].name) || scaleKey;
    chipLabel.textContent = `${instLabel} · ${key} ${scaleName}`;
  }

  syncSoundSheetState(instrument, key, scale, groove, bpm) {
    this.currentInstrument = instrument;
    this.currentKey = key;
    this.currentScale = scale;
    this.currentGroove = groove;
    this.currentBpm = bpm;

    // Update selected card
    const cards = document.querySelectorAll('.instrument-card');
    cards.forEach(c => {
      c.classList.toggle('selected', c.getAttribute('data-inst-key') === instrument);
    });

    // Update key segmented buttons
    const keyBtns = document.querySelectorAll('#picker-key-row .seg-item');
    keyBtns.forEach(b => {
      b.classList.toggle('selected', b.getAttribute('data-key') === key);
    });

    // Update scale buttons
    const scaleBtns = document.querySelectorAll('#picker-scale-row .seg-item');
    scaleBtns.forEach(b => {
      b.classList.toggle('selected', b.getAttribute('data-scale') === scale);
    });

    // Update groove buttons
    const grooveBtns = document.querySelectorAll('#picker-groove-row .seg-item');
    grooveBtns.forEach(b => {
      b.classList.toggle('selected', b.getAttribute('data-groove') === groove);
    });

    // Update tempo slider
    const tempoSlider = document.getElementById('slider-tempo');
    const tempoVal = document.getElementById('tempo-val');
    if (tempoSlider) tempoSlider.value = bpm;
    if (tempoVal) tempoVal.textContent = `${bpm} BPM`;

    const instCfg = INSTRUMENTS[instrument] || INSTRUMENTS.HARP;
    this.updateSoundChip(instCfg.label, key, scale);
  }

  setMuteState(isMuted) {
    const btn = document.getElementById('btn-sound-toggle');
    if (btn) {
      btn.innerHTML = isMuted ? ICONS.soundOff : ICONS.soundOn;
      btn.classList.toggle('active', isMuted);
    }
  }

  toggleSoundSheet(force) {
    const isVisible = force !== undefined ? !force : !this.soundSheet.classList.contains('hidden');
    this.soundSheet.classList.toggle('hidden', isVisible);
    if (this.soundBackdrop) this.soundBackdrop.classList.toggle('hidden', isVisible);
  }

  toggleSongsSheet(force) {
    const isVisible = force !== undefined ? !force : !this.songsSheet.classList.contains('hidden');
    this.songsSheet.classList.toggle('hidden', isVisible);
    if (this.songsBackdrop) this.songsBackdrop.classList.toggle('hidden', isVisible);
  }

  toggleMenuDrawer(force) {
    const isVisible = force !== undefined ? !force : !this.menuDrawer.classList.contains('hidden');
    this.menuDrawer.classList.toggle('hidden', isVisible);
    if (this.menuBackdrop) this.menuBackdrop.classList.toggle('hidden', isVisible);

    if (!isVisible) {
      // Re-read storage stats & achievements
      this.initMenuDrawer();
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  hideStartScreen() {
    if (this.startScreen) this.startScreen.style.display = 'none';
  }

  showCameraError(msg) {
    const banner = document.getElementById('camera-error-banner');
    const textEl = document.getElementById('camera-error-text');
    if (textEl && msg) textEl.textContent = msg;
    if (banner) banner.classList.remove('hidden');
  }

  hideCameraError() {
    const banner = document.getElementById('camera-error-banner');
    if (banner) banner.classList.add('hidden');
  }

  // Challenge HUD & End Modal
  updateChallengeHud(score, combo, timeLeft) {
    const sEl = document.getElementById('challenge-score');
    const cEl = document.getElementById('challenge-combo');
    const tEl = document.getElementById('challenge-time');

    if (sEl) sEl.textContent = score;
    if (cEl) cEl.textContent = `x${combo}`;
    if (tEl) tEl.textContent = Math.ceil(timeLeft);
  }

  showChallengeEndModal(stats) {
    const scoreEl = document.getElementById('end-card-score');
    const comboEl = document.getElementById('end-stat-combo');
    const accEl = document.getElementById('end-stat-accuracy');
    const hookEl = document.getElementById('end-card-hook');

    if (scoreEl) scoreEl.textContent = stats.score;
    if (comboEl) comboEl.textContent = `x${stats.bestCombo}`;
    if (accEl) accEl.textContent = `${stats.accuracy}%`;

    if (hookEl) {
      if (stats.isNewBest) {
        hookEl.textContent = 'New personal best!';
      } else if (stats.differenceToBest > 0) {
        hookEl.textContent = `${stats.differenceToBest} points to beat your best.`;
      } else {
        hookEl.textContent = 'Try to beat your best on the next round.';
      }
    }

    if (this.challengeEndModal) this.challengeEndModal.classList.remove('hidden');
  }

  hideChallengeEndModal() {
    if (this.challengeEndModal) this.challengeEndModal.classList.add('hidden');
  }

  // Loop Station timeline update
  updateLoopBar(progressPercent, events) {
    if (this.loopPlayhead) {
      this.loopPlayhead.style.left = `${progressPercent}%`;
    }
  }
}
