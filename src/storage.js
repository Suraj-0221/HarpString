// Safe, resilient localStorage wrapper for session state, streak tracking,
// achievements, challenge records, and custom link sharing.

const PREFIX = 'airharp:';

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
      return true;
    } catch {
      return false;
    }
  },

  // Streak & Activity Tracking
  recordSession() {
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = this.get('last_session_date', null);
    let streak = this.get('streak_days', 0);

    if (!lastDate) {
      streak = 1;
    } else if (lastDate === today) {
      // Already counted today
    } else {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (lastDate === yesterday) {
        streak += 1;
      } else {
        streak = 1;
      }
    }

    this.set('last_session_date', today);
    this.set('streak_days', streak);
    return streak;
  },

  getStreak() {
    return this.get('streak_days', 0);
  },

  // Total Plucks Counter
  incrementPlucks(count = 1) {
    const total = this.get('total_plucks', 0) + count;
    this.set('total_plucks', total);
    return total;
  },

  getTotalPlucks() {
    return this.get('total_plucks', 0);
  },

  // Challenge Scores
  getChallengeBest() {
    return this.get('challenge_best', 0);
  },

  recordChallengeScore(score, bestCombo, accuracy) {
    const currentBest = this.getChallengeBest();
    if (score > currentBest) {
      this.set('challenge_best', score);
    }

    const history = this.get('challenge_history', []);
    history.unshift({ score, bestCombo, accuracy, timestamp: Date.now() });
    if (history.length > 5) history.length = 5;
    this.set('challenge_history', history);

    return {
      isNewBest: score > currentBest,
      best: Math.max(score, currentBest)
    };
  },

  // Song Progress (stars: 1, 2, or 3)
  getSongProgress() {
    return this.get('song_stars', {});
  },

  saveSongStars(songId, stars) {
    const all = this.getSongProgress();
    if (!all[songId] || stars > all[songId]) {
      all[songId] = stars;
      this.set('song_stars', all);
    }
    return all;
  },

  // Achievements
  getAchievements() {
    return this.get('achievements', {});
  },

  unlockAchievement(id) {
    const list = this.getAchievements();
    if (list[id]) return false; // Already unlocked

    list[id] = {
      unlockedAt: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    };
    this.set('achievements', list);
    return true;
  }
};
