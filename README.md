# HarpString

An interactive in-browser spatial string instrument that uses webcam hand tracking. Users can stretch virtual strings between their fingers in mid-air and pluck them to produce acoustic Karplus-Strong synthesized tones.

---

## Key Highlights

- **Spatial String Creation**: Pinch with both hands to draw a glowing string across space; releasing the pinch anchors the string in mid-air.
- **Physical Pluck Interaction**: Flick an extended index fingertip across any anchored string to trigger sound and visual standing wave ripples.
- **Karplus-Strong Sound Engine**: Audio is synthesized dynamically using digital waveguide / Karplus-Strong physical modeling, with zero external audio assets.
- **Optical Resonance**: Real-time traveling wave pulses, end-cap reflections, and sympathetic resonance replace particle effects for a clean, instrument-focused aesthetic.
- **Visual Timbre & Stage Presets**: 5 sound presets (Harp, Koto, Guitar, Glass, Bass) and 4 stage palettes (Neon, Ink, Aurora, Ember).
- **Zero-Latency Tracking**: Hand landmarks are tracked using MediaPipe with One-Euro smoothing to eliminate jitter.

---

## Quickstart

### Prerequisites
- Node.js (version 18 or newer recommended)
- A webcam-enabled laptop or desktop
- Modern Chromium-based browser (Chrome, Edge, Brave)

### Installation & Run

```bash
# Install project dependencies
npm install

# Execute Vitest test suite
npm test

# Run local Vite server
npm run dev
```

Visit `http://localhost:3000` to interact with the instrument.

---

## Controls & Gestures

| Gesture | Description |
| :--- | :--- |
| **Two-Hand Pinch** | Stretch a preview string between two hands. |
| **Release Pinch** | Locks the string into the environment (minimum 80px length). |
| **Index Fingertip Crossing** | Plucks the intersected string with velocity-sensitive dynamics. |
| **Endpoint Drag** | Pinch within 40px of a string end-cap to reposition or retune. |
| **Closed Fist** | Hold near a string for 1.2s to delete it. |
| **Horizontal Swipe** | Cycle instrument timbres. |
| **Two-Hand Clap** | Cycle stage themes. |

### Hotkeys

- `H` — Toggle hand skeleton overlay
- `C` — Clear all strings
- `Z` — Undo most recently added string
- `F` — Toggle full screen
- `Space` — Master audio mute toggle
- `Esc` — Close settings drawer

---

## Project Structure

```
HarpString/
├── index.html            # Stage interface and HUD
├── package.json          # Dependencies and scripts
├── vite.config.js        # Vite bundling setup
├── test/                 # Vitest test suite
│   ├── gestures.test.js  # Pinch, point, and fist classification tests
│   ├── scales.test.js    # Musical tuning and scale mapping tests
│   └── strings.test.js   # Intersection and string lifecycle tests
└── src/
    ├── main.js           # Core loop and gesture orchestration
    ├── config.js         # Tunable parameters and scales
    ├── camera.js         # Camera stream handling
    ├── handTracker.js    # MediaPipe detector wrapper
    ├── gestures.js       # Geometric analysis of hand landmarks
    ├── strings.js        # String physics and standing wave simulation
    ├── effects.js        # Wave pulses, reflections, and ripples
    ├── audio.js          # Web Audio Karplus-Strong synthesizer
    ├── instruments.js    # Timbre presets and swipe detection
    ├── themes.js         # Stage color themes and clap detection
    ├── clip.js           # Canvas clip recorder
    ├── render.js         # 2D canvas drawing pipeline
    └── ui.js             # UI controls, drawer, and toasts
```

---

## Testing

Run unit tests via:

```bash
npm test
```

All 13 tests verify gesture classification, scale mapping, segment intersection, and string placement logic.
