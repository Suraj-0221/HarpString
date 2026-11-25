// Curated Vibes Presets for Air Harp
// Each preset sets: instrument, key, scale, theme, layout, groove, and BPM.

export const VIBES = [
  {
    name: 'Rainy window',
    instrument: 'GLASS',
    key: 'A',
    scale: 'minor_pentatonic',
    theme: 'INK',
    layout: 'FAN',
    groove: 'Slow',
    bpm: 66
  },
  {
    name: 'Night market',
    instrument: 'KOTO',
    key: 'D',
    scale: 'minor_pentatonic',
    theme: 'EMBER',
    layout: 'HARP',
    groove: 'Lo-fi',
    bpm: 82
  },
  {
    name: 'Cathedral',
    instrument: 'HARP',
    key: 'C',
    scale: 'major',
    theme: 'AURORA',
    layout: 'GRID',
    groove: 'Off',
    bpm: 80
  },
  {
    name: 'Basement',
    instrument: 'BASS',
    key: 'E',
    scale: 'minor_pentatonic',
    theme: 'EMBER',
    layout: 'HARP',
    groove: 'Lo-fi',
    bpm: 76
  },
  {
    name: 'Morning',
    instrument: 'GUITAR',
    key: 'G',
    scale: 'major',
    theme: 'NEON',
    layout: 'FAN',
    groove: 'Upbeat',
    bpm: 108
  },
  {
    name: 'Deep sea',
    instrument: 'GLASS',
    key: 'F#',
    scale: 'c_minor', // natural minor
    theme: 'AURORA',
    layout: 'HARP',
    groove: 'Slow',
    bpm: 62
  }
];

export class VibeManager {
  constructor() {
    this.currentIdx = 0;
  }

  cycleNext() {
    const vibe = VIBES[this.currentIdx];
    this.currentIdx = (this.currentIdx + 1) % VIBES.length;
    return vibe;
  }

  getCurrent() {
    return VIBES[this.currentIdx];
  }
}
