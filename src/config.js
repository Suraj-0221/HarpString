// Configuration for Air Harp
// Every tunable value in one central location

export const CONFIG = {
  CAMERA: {
    idealWidth: 1280,
    idealHeight: 720,
    facingMode: 'user',
    frameRate: 60,
    brightness: 0.85,
    mirror: true,
  },
  TRACKER: {
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    wasmLoaderUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    oneEuro: {
      minCutoff: 1.2,
      beta: 0.007,
      dCutoff: 1.0,
    },
    emaAlpha: 0.55,
    useOneEuro: true,
  },
  GESTURES: {
    pinchEnterRatio: 0.30,
    pinchExitRatio: 0.45,
    moveGrabRadius: 40,        // px radius from string endpoint to grab
    minStringLength: 80,       // min length in px to lock persistent string
    deleteHoldDuration: 1.2,   // seconds holding fist over string to delete
    deleteProximity: 30,       // px max distance from fist wrist/palm to string line
    pluckDebounceMs: 120,      // debounce ms per string
  },
  STRINGS: {
    maxStrings: 12,
    idleLineWidth: 2,
    idleGlowBlur: 12,
    ghostOffset: 5,
    ghostAlpha: 0.25,
    tickSpacing: 40,
    tickLength: 6,
    tickAlpha: 0.35,
    caliperRadius: 6,
    caliperBarLength: 14,
    visualOscillationW: 2 * Math.PI * 6, // ~37.7 rad/s for readable visual wobble
    visualDecay: 2.0,                    // seconds for amplitude decay
    maxVisualAmplitude: 28,             // max px displacement
    wavePoints: 80,
    wavePointsReduced: 40,
    showNoteLabels: true,
  },
  RESONANCE: {
    pulseSpeed: 1.2,                     // string lengths per second
    pulseWidthRatio: 0.12,               // 12% of string length gaussian width
    maxPulses: 64,
    maxRipples: 24,
    rippleDurationMs: 450,
    endCapFlashDurationMs: 300,
    noteLabelDurationMs: 600,
  },
  SKELETON: {
    boneColor: 'rgba(242, 235, 221, 0.55)',
    boneWidth: 1.5,
    jointColor: 'rgba(242, 235, 221, 0.80)',
    jointRadius: 2.5,
    ringColor: '#F58BC4',
    ringRadius: 5,
    showSkeleton: true,
  },
  AUDIO: {
    defaultScale: 'c_minor',
    rootNote: 'C',
    lowestFreq: 98.0,    // ~G2 (98 Hz)
    highestFreq: 1046.5, // ~C6 (1046.5 Hz)
    maxPolyphony: 16,
    voiceFadeTimeMs: 20,
    masterVolume: 0.8,
    reverbWet: 0.25,
    reverbDecay: 1.8,
    stringDecayTime: 3.0,
    pluckSensitivity: 1.0,
    speedNormPx: 40,     // px/frame velocity for maximum pluck strength (1.0)
    minStrength: 0.15,
    maxStrength: 1.0,
  },
  CHALLENGE: {
    roundDuration: 30,
    startInterval: 1.5,
    endInterval: 0.7,
  },
  LOOP: {
    duration: 8.0,
    maxLayers: 3,
  },
  PERFORMANCE: {
    lowFpsThreshold: 24,
    lowFpsDurationMs: 3000,
  }
};

export const SCALES = {
  c_minor: {
    name: 'C Natural Minor (Eb Major)',
    notes: [0, 2, 3, 5, 7, 8, 10], // Semitones from root: C, D, Eb, F, G, Ab, Bb
  },
  major_pentatonic: {
    name: 'Major Pentatonic',
    notes: [0, 2, 4, 7, 9], // C, D, E, G, A
  },
  minor_pentatonic: {
    name: 'Minor Pentatonic',
    notes: [0, 3, 5, 7, 10], // C, Eb, F, G, Bb
  },
  major: {
    name: 'Major (Ionian)',
    notes: [0, 2, 4, 5, 7, 9, 11], // C, D, E, F, G, A, B
  },
  chromatic: {
    name: 'Chromatic',
    notes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  free: {
    name: 'Free (Continuous)',
    notes: null,
  }
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
