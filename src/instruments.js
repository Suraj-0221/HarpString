// Timbre Presets & Instrument Engine for Air Harp
// HARP, KOTO, GUITAR, GLASS, BASS with acoustic parameter modeling,
// decay envelope sparkline generators, and open-palm swipe gesture recognition.

export const INSTRUMENTS = {
  HARP: {
    name: 'HARP',
    label: 'Harp',
    description: 'Bright and open',
    decayTime: 3.2,
    brightness: 0.58,
    damping: 0.993,
    freqMultiplier: 1.0,
    voiceType: 'karplus',
    inharmonicity: 0.0,
  },
  KOTO: {
    name: 'KOTO',
    label: 'Koto',
    description: 'Plucky and short',
    decayTime: 1.8,
    brightness: 0.68,
    damping: 0.988,
    freqMultiplier: 1.0,
    voiceType: 'karplus',
    pitchBendDrop: -0.05,
  },
  GUITAR: {
    name: 'GUITAR',
    label: 'Guitar',
    description: 'Warm nylon',
    decayTime: 2.6,
    brightness: 0.46,
    damping: 0.989,
    freqMultiplier: 1.0,
    voiceType: 'karplus',
    bodyResonance: true,
  },
  GLASS: {
    name: 'GLASS',
    label: 'Glass',
    description: 'Glassy, long ring',
    decayTime: 4.8,
    brightness: 0.72,
    damping: 0.997,
    freqMultiplier: 1.0,
    voiceType: 'shimmer',
    inharmonicity: 0.25,
  },
  BASS: {
    name: 'BASS',
    label: 'Bass',
    description: 'Deep and round',
    decayTime: 2.2,
    brightness: 0.42,
    damping: 0.982,
    freqMultiplier: 0.5,
    voiceType: 'karplus',
  }
};

export const INSTRUMENT_KEYS = ['HARP', 'KOTO', 'GUITAR', 'GLASS', 'BASS'];

// Generates an SVG path for a 60x20 sparkline representing the instrument's decay envelope
export function getSparklineSvgPath(instrumentKey, width = 60, height = 20) {
  const cfg = INSTRUMENTS[instrumentKey] || INSTRUMENTS.HARP;
  const decayRate = 3.5 / Math.max(0.5, cfg.decayTime);
  const points = [];

  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const normX = i / steps;
    const x = normX * width;
    // Fast attack (first 5%), then exponential decay
    let amp;
    if (normX < 0.06) {
      amp = normX / 0.06;
    } else {
      const decayT = (normX - 0.06) / 0.94;
      amp = Math.exp(-decayT * decayRate * 2.5);
    }

    const y = height - (amp * (height - 3) + 1.5);
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  return points.join(' ');
}

export class InstrumentManager {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.currentInstrument = 'HARP';
    this.lastSwipeTime = 0;
    this.swipeCooldownMs = 1000;
  }

  setInstrument(name) {
    if (!INSTRUMENTS[name]) return;
    this.currentInstrument = name;
    return INSTRUMENTS[name];
  }

  cycleNext() {
    const idx = INSTRUMENT_KEYS.indexOf(this.currentInstrument);
    const nextIdx = (idx + 1) % INSTRUMENT_KEYS.length;
    this.currentInstrument = INSTRUMENT_KEYS[nextIdx];
    return INSTRUMENTS[this.currentInstrument];
  }

  getCurrentConfig() {
    return INSTRUMENTS[this.currentInstrument] || INSTRUMENTS.HARP;
  }

  checkSwipeGesture(handResults, timestamp) {
    if (timestamp - this.lastSwipeTime < this.swipeCooldownMs) return null;

    for (let i = 0; i < handResults.length; i++) {
      const hand = handResults[i];
      if (hand.isPinching || hand.isFist) continue;

      if (hand.velocity && Math.abs(hand.velocity.x) > 380 && Math.abs(hand.velocity.x) > Math.abs(hand.velocity.y) * 1.8) {
        this.lastSwipeTime = timestamp;
        return this.cycleNext();
      }
    }
    return null;
  }
}
