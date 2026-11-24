// Timbre Presets & Instrument Engine for Air Harp (Revision 2)
// HARP, KOTO, GUITAR, GLASS, BASS with acoustic parameter modeling
// and open-palm swipe gesture recognition.

export const INSTRUMENTS = {
  HARP: {
    name: 'HARP',
    label: 'Concert Harp',
    decayTime: 3.2,
    brightness: 0.58,
    damping: 0.993,
    freqMultiplier: 1.0,
    voiceType: 'karplus',
    inharmonicity: 0.0,
  },
  KOTO: {
    name: 'KOTO',
    label: 'Traditional Koto',
    decayTime: 1.8,
    brightness: 0.68,
    damping: 0.988,
    freqMultiplier: 1.0,
    voiceType: 'karplus',
    pitchBendDrop: -0.05, // subtle pitch drop on attack
  },
  GUITAR: {
    name: 'GUITAR',
    label: 'Nylon Guitar',
    decayTime: 2.6,
    brightness: 0.46,
    damping: 0.989,
    freqMultiplier: 1.0,
    voiceType: 'karplus',
    bodyResonance: true,
  },
  GLASS: {
    name: 'GLASS',
    label: 'Glass Harmonica',
    decayTime: 4.8,
    brightness: 0.72,
    damping: 0.997,
    freqMultiplier: 1.0,
    voiceType: 'shimmer',
    inharmonicity: 0.25,
  },
  BASS: {
    name: 'BASS',
    label: 'Acoustic Bass',
    decayTime: 2.2,
    brightness: 0.42,
    damping: 0.982,
    freqMultiplier: 0.5, // 1 octave lower
    voiceType: 'karplus',
  }
};

export const INSTRUMENT_KEYS = ['HARP', 'KOTO', 'GUITAR', 'GLASS', 'BASS'];

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

  // Detect open-palm horizontal swipe gesture to cycle instruments
  checkSwipeGesture(handResults, timestamp) {
    if (timestamp - this.lastSwipeTime < this.swipeCooldownMs) return null;

    for (let i = 0; i < handResults.length; i++) {
      const hand = handResults[i];
      // Open palm: all fingers extended, not pinching, not fist
      if (hand.isPinching || hand.isFist) continue;

      // Check if velocity is fast and horizontal
      if (hand.velocity && Math.abs(hand.velocity.x) > 380 && Math.abs(hand.velocity.x) > Math.abs(hand.velocity.y) * 1.8) {
        this.lastSwipeTime = timestamp;
        const next = this.cycleNext();
        return next;
      }
    }
    return null;
  }
}
