// Public Domain Song Library & Learning Engine for Air Harp
// Melodies stored as arrays of {semitone, beats} from tonic.
// Distinct pitches auto-spawn as tuned harp strings from left to right.
// Modes: 'Learn' (waits for correct string) and 'Rhythm' (beat-timed, 250ms window, 1-3 stars).

import { storage } from './storage.js';
import { HarpString } from './strings.js';

export const SONGS = [
  {
    id: 'twinkle',
    title: 'Twinkle Twinkle Little Star',
    durationSeconds: 16,
    difficulty: 1, // 1-3 dots
    rootNote: 'C',
    scaleKey: 'major',
    notes: [
      { semitone: 0, beats: 1 },
      { semitone: 0, beats: 1 },
      { semitone: 7, beats: 1 },
      { semitone: 7, beats: 1 },
      { semitone: 9, beats: 1 },
      { semitone: 9, beats: 1 },
      { semitone: 7, beats: 2 },
      { semitone: 5, beats: 1 },
      { semitone: 5, beats: 1 },
      { semitone: 4, beats: 1 },
      { semitone: 4, beats: 1 },
      { semitone: 2, beats: 1 },
      { semitone: 2, beats: 1 },
      { semitone: 0, beats: 2 },
    ]
  },
  {
    id: 'ode_to_joy',
    title: 'Ode to Joy',
    durationSeconds: 22,
    difficulty: 1,
    rootNote: 'C',
    scaleKey: 'major',
    notes: [
      { semitone: 4, beats: 1 },
      { semitone: 4, beats: 1 },
      { semitone: 5, beats: 1 },
      { semitone: 7, beats: 1 },
      { semitone: 7, beats: 1 },
      { semitone: 5, beats: 1 },
      { semitone: 4, beats: 1 },
      { semitone: 2, beats: 1 },
      { semitone: 0, beats: 1 },
      { semitone: 0, beats: 1 },
      { semitone: 2, beats: 1 },
      { semitone: 4, beats: 1 },
      { semitone: 4, beats: 1.5 },
      { semitone: 2, beats: 0.5 },
      { semitone: 2, beats: 2 },

      { semitone: 4, beats: 1 },
      { semitone: 4, beats: 1 },
      { semitone: 5, beats: 1 },
      { semitone: 7, beats: 1 },
      { semitone: 7, beats: 1 },
      { semitone: 5, beats: 1 },
      { semitone: 4, beats: 1 },
      { semitone: 2, beats: 1 },
      { semitone: 0, beats: 1 },
      { semitone: 0, beats: 1 },
      { semitone: 2, beats: 1 },
      { semitone: 4, beats: 1 },
      { semitone: 2, beats: 1.5 },
      { semitone: 0, beats: 0.5 },
      { semitone: 0, beats: 2 },
    ]
  },
  {
    id: 'greensleeves',
    title: 'Greensleeves',
    durationSeconds: 20,
    difficulty: 2,
    rootNote: 'A',
    scaleKey: 'minor_pentatonic',
    notes: [
      { semitone: 0, beats: 1 },
      { semitone: 3, beats: 2 },
      { semitone: 5, beats: 1 },
      { semitone: 7, beats: 1.5 },
      { semitone: 8, beats: 0.5 },
      { semitone: 7, beats: 1 },
      { semitone: 5, beats: 2 },
      { semitone: 2, beats: 1 },
      { semitone: 0, beats: 1.5 },
      { semitone: 2, beats: 0.5 },
      { semitone: 3, beats: 1 },
      { semitone: 2, beats: 2 },
      { semitone: 0, beats: 1 },
    ]
  },
  {
    id: 'auld_lang_syne',
    title: 'Auld Lang Syne',
    durationSeconds: 18,
    difficulty: 2,
    rootNote: 'F',
    scaleKey: 'major',
    notes: [
      { semitone: 0, beats: 1 },
      { semitone: 5, beats: 1.5 },
      { semitone: 4, beats: 0.5 },
      { semitone: 5, beats: 1 },
      { semitone: 9, beats: 1 },
      { semitone: 7, beats: 1.5 },
      { semitone: 5, beats: 0.5 },
      { semitone: 7, beats: 1 },
      { semitone: 9, beats: 1 },
      { semitone: 5, beats: 1.5 },
      { semitone: 5, beats: 0.5 },
      { semitone: 9, beats: 1 },
      { semitone: 12, beats: 1 },
      { semitone: 14, beats: 3 },
    ]
  },
  {
    id: 'scarborough_fair',
    title: 'Scarborough Fair',
    durationSeconds: 18,
    difficulty: 2,
    rootNote: 'D',
    scaleKey: 'c_minor',
    notes: [
      { semitone: 0, beats: 2 },
      { semitone: 0, beats: 1 },
      { semitone: 7, beats: 2 },
      { semitone: 7, beats: 1 },
      { semitone: 4, beats: 1.5 },
      { semitone: 5, beats: 0.5 },
      { semitone: 4, beats: 1 },
      { semitone: 2, beats: 3 },
      { semitone: 0, beats: 2 },
    ]
  },
  {
    id: 'fur_elise',
    title: 'Für Elise (Theme)',
    durationSeconds: 12,
    difficulty: 3,
    rootNote: 'A',
    scaleKey: 'c_minor',
    notes: [
      { semitone: 7, beats: 0.5 },
      { semitone: 6, beats: 0.5 },
      { semitone: 7, beats: 0.5 },
      { semitone: 6, beats: 0.5 },
      { semitone: 7, beats: 0.5 },
      { semitone: 2, beats: 0.5 },
      { semitone: 5, beats: 0.5 },
      { semitone: 3, beats: 0.5 },
      { semitone: 0, beats: 2.0 },
    ]
  }
];

export class SongManager {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.currentSong = null;
    this.songMode = 'Learn'; // 'Learn' or 'Rhythm'
    this.currentNoteIndex = 0;
    this.isActive = false;

    // Rhythm mode state
    this.rhythmTimer = null;
    this.rhythmNoteWindowMs = 250;
    this.rhythmTotalNotes = 0;
    this.rhythmHitNotes = 0;

    // String mapping: semitone -> stringId
    this.semitoneToStringMap = new Map();

    this.onCompleteCallback = null;
  }

  startSong(songId, mode = 'Learn', stringManager, canvasWidth, canvasHeight, onComplete = null) {
    const song = SONGS.find(s => s.id === songId);
    if (!song) return null;

    this.currentSong = song;
    this.songMode = mode;
    this.currentNoteIndex = 0;
    this.isActive = true;
    this.rhythmTotalNotes = song.notes.length;
    this.rhythmHitNotes = 0;
    this.onCompleteCallback = onComplete;

    // 1. Find distinct semitones in song, sorted low to high
    const distinctSemitones = Array.from(new Set(song.notes.map(n => n.semitone))).sort((a, b) => a - b);

    // 2. Clear stage and auto-spawn exactly tuned harp strings
    stringManager.strings = [];
    this.semitoneToStringMap.clear();

    const count = distinctSemitones.length;
    const marginX = canvasWidth * 0.16;
    const stepX = (canvasWidth - marginX * 2) / Math.max(1, count - 1);
    const topY = canvasHeight * 0.18;
    const bottomY = canvasHeight * 0.82;

    // Determine root frequency for tonic
    const rootMidi = 60; // C4 default
    for (let i = 0; i < count; i++) {
      const semitone = distinctSemitones[i];
      const x = marginX + i * stepX;
      const str = new HarpString({ x, y: topY }, { x, y: bottomY }, this.audioEngine, canvasWidth, canvasHeight, null, true);

      // Force pitch to exact melody semitone from root
      const midi = rootMidi + semitone;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      str.frequency = freq;
      str.noteName = `N${semitone}`;

      stringManager.strings.push(str);
      this.semitoneToStringMap.set(semitone, str.id);
    }

    return song;
  }

  stop() {
    this.isActive = false;
    this.currentSong = null;
    if (this.rhythmTimer) clearTimeout(this.rhythmTimer);
  }

  getTargetStringId() {
    if (!this.isActive || !this.currentSong) return null;
    if (this.currentNoteIndex >= this.currentSong.notes.length) return null;

    const note = this.currentSong.notes[this.currentNoteIndex];
    return this.semitoneToStringMap.get(note.semitone);
  }

  onPluck(stringId, stringManager) {
    if (!this.isActive || !this.currentSong) return;

    const targetId = this.getTargetStringId();
    if (stringId === targetId) {
      this.rhythmHitNotes++;
      this.currentNoteIndex++;

      // Check if song complete
      if (this.currentNoteIndex >= this.currentSong.notes.length) {
        this.finishSong(stringManager);
      }
    }
  }

  finishSong(stringManager) {
    this.isActive = false;

    // Trigger calm synchronized shimmer on all strings
    for (const str of stringManager.strings) {
      str.triggerSympathetic();
      str.glowIntensity = 1.0;
    }

    let stars = 3;
    if (this.songMode === 'Rhythm') {
      const accuracy = this.rhythmTotalNotes > 0 ? (this.rhythmHitNotes / this.rhythmTotalNotes) : 1;
      stars = accuracy > 0.85 ? 3 : (accuracy > 0.5 ? 2 : 1);
    }

    storage.saveSongStars(this.currentSong.id, stars);

    if (this.onCompleteCallback) {
      this.onCompleteCallback({
        song: this.currentSong,
        mode: this.songMode,
        stars
      });
    }
  }
}
