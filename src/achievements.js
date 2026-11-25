// 10 Quiet Achievements for Air Harp
// Earned once, toasted once, and viewed in the Collected drawer with date and check mark.

import { storage } from './storage.js';

export const ACHIEVEMENTS = [
  { id: 'first_string', title: 'First string', desc: 'Stretched and anchored a string in mid-air' },
  { id: 'first_pluck', title: 'First pluck', desc: 'Flicked a fingertip to play a note' },
  { id: 'five_strings', title: 'Five strings', desc: 'Anchored five active strings on stage' },
  { id: 'strum', title: 'Strum', desc: 'Plucked 3 or more strings in under 400 ms' },
  { id: 'ten_combo', title: 'Ten-note combo', desc: 'Reached a 10x combo in Challenge mode' },
  { id: 'song_learned', title: 'Song learned', desc: 'Completed a melody in Songs mode' },
  { id: 'loop_three_layers', title: 'Loop with 3 layers', desc: 'Recorded 3 layers in the loop station' },
  { id: 'all_instruments', title: 'All five instruments tried', desc: 'Explored Harp, Koto, Guitar, Glass, and Bass' },
  { id: 'score_2000', title: 'Score 2000', desc: 'Reached 2,000 points in Challenge mode' },
  { id: 'shared_link', title: 'Shared a link', desc: 'Generated and copied a stage link' },
];

export class AchievementManager {
  constructor(toastCallback) {
    this.toastCallback = toastCallback;
    this.instrumentsTried = new Set();
    this.recentPluckTimes = [];
  }

  check(id) {
    const isNew = storage.unlockAchievement(id);
    if (isNew) {
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach && this.toastCallback) {
        this.toastCallback(`Achievement: ${ach.title}`);
      }
    }
    return isNew;
  }

  recordStringCreated(totalStrings) {
    this.check('first_string');
    if (totalStrings >= 5) {
      this.check('five_strings');
    }
  }

  recordPluck(timestamp) {
    this.check('first_pluck');

    // Strum check: 3+ strings in under 400ms
    this.recentPluckTimes = this.recentPluckTimes.filter(t => timestamp - t < 400);
    this.recentPluckTimes.push(timestamp);
    if (this.recentPluckTimes.length >= 3) {
      this.check('strum');
    }
  }

  recordCombo(combo) {
    if (combo >= 10) {
      this.check('ten_combo');
    }
  }

  recordScore(score) {
    if (score >= 2000) {
      this.check('score_2000');
    }
  }

  recordInstrument(name) {
    this.instrumentsTried.add(name);
    if (this.instrumentsTried.size >= 5) {
      this.check('all_instruments');
    }
  }

  recordSongComplete() {
    this.check('song_learned');
  }

  recordLoopLayer(layerCount) {
    if (layerCount >= 3) {
      this.check('loop_three_layers');
    }
  }

  recordShare() {
    this.check('shared_link');
  }
}
