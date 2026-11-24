// Theme Engine for Air Harp (Revision 2)
// 4 Themes: NEON, INK, AURORA, EMBER with custom string palettes and video treatments.
// Includes two-hand clap gesture detection.

export const THEMES = {
  NEON: {
    name: 'NEON',
    label: 'Neon Light',
    videoFilter: (dimPercent) => `brightness(${dimPercent * 0.85}%)`,
    getPitchColor: (norm) => {
      // Magenta (320) -> Mint (160) -> Yellow-Green (80)
      let hue = 320;
      if (norm < 0.5) {
        hue = 320 - (norm / 0.5) * (320 - 160);
      } else {
        hue = 160 - ((norm - 0.5) / 0.5) * (160 - 80);
      }
      return {
        hue: Math.round(hue),
        coreColor: `hsl(${Math.round(hue)}, 95%, 88%)`,
        glowColor: `hsl(${Math.round(hue)}, 90%, 65%)`,
        dimColor: `hsla(${Math.round(hue)}, 85%, 70%, 0.35)`,
      };
    }
  },
  INK: {
    name: 'INK',
    label: 'Monochrome Ink',
    videoFilter: (dimPercent) => `grayscale(100%) contrast(120%) brightness(${dimPercent * 0.55}%)`,
    getPitchColor: (norm) => {
      return {
        hue: 0,
        coreColor: '#FFFFFF',
        glowColor: 'rgba(216, 255, 62, 0.45)', // subtle acid lime glow
        dimColor: 'rgba(255, 255, 255, 0.25)',
      };
    }
  },
  AURORA: {
    name: 'AURORA',
    label: 'Boreal Aurora',
    videoFilter: (dimPercent) => `hue-rotate(20deg) brightness(${dimPercent * 0.80}%)`,
    getPitchColor: (norm) => {
      // Emerald green (140) to Teal / Cyan (185)
      const hue = 140 + norm * 45;
      return {
        hue: Math.round(hue),
        coreColor: `hsl(${Math.round(hue)}, 95%, 90%)`,
        glowColor: `hsl(${Math.round(hue)}, 90%, 60%)`,
        dimColor: `hsla(${Math.round(hue)}, 85%, 70%, 0.35)`,
      };
    }
  },
  EMBER: {
    name: 'EMBER',
    label: 'Deep Ember',
    videoFilter: (dimPercent) => `sepia(40%) contrast(110%) brightness(${dimPercent * 0.80}%)`,
    getPitchColor: (norm) => {
      // Deep Amber (40) to Ruby Red (5)
      const hue = 40 - norm * 35;
      return {
        hue: Math.round(hue),
        coreColor: `hsl(${Math.round(hue)}, 95%, 88%)`,
        glowColor: `hsl(${Math.round(hue)}, 90%, 55%)`,
        dimColor: `hsla(${Math.round(hue)}, 85%, 65%, 0.35)`,
      };
    }
  }
};

export const THEME_KEYS = ['NEON', 'INK', 'AURORA', 'EMBER'];

export class ThemeManager {
  constructor() {
    this.currentTheme = 'NEON';
    this.videoDim = 1.0; // 0 to 1 (100%)
    this.lastClapTime = 0;
    this.clapCooldownMs = 1200;
  }

  setTheme(name) {
    if (!THEMES[name]) return;
    this.currentTheme = name;
    return THEMES[name];
  }

  cycleNext() {
    const idx = THEME_KEYS.indexOf(this.currentTheme);
    const nextIdx = (idx + 1) % THEME_KEYS.length;
    this.currentTheme = THEME_KEYS[nextIdx];
    return THEMES[this.currentTheme];
  }

  getCurrentTheme() {
    return THEMES[this.currentTheme] || THEMES.NEON;
  }

  // Detect two-hand clap gesture: both open palms closing quickly together
  checkClapGesture(handResults, timestamp) {
    if (handResults.length < 2) return null;
    if (timestamp - this.lastClapTime < this.clapCooldownMs) return null;

    const [h1, h2] = handResults;
    if (h1.isFist || h2.isFist || h1.isPinching || h2.isPinching) return null;

    const dx = h1.palmCenter.x - h2.palmCenter.x;
    const dy = h1.palmCenter.y - h2.palmCenter.y;
    const distance = Math.hypot(dx, dy);

    // If hands are within 75px of each other and approaching
    if (distance < 75) {
      this.lastClapTime = timestamp;
      return this.cycleNext();
    }
    return null;
  }
}
