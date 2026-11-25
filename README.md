# Air Harp

I built Air Harp as an in-browser musical instrument that you play with your hands in front of a webcam. You pinch both hands to stretch a glowing string in mid-air, let go to anchor it in space, and flick your fingers through it to pluck it.

The sound is synthesized directly in Web Audio using Karplus-Strong physical modeling—there are no audio sample files or external sound recordings in this project.

---

## Running the project

### Requirements
- Node.js (v18 or newer)
- A laptop or desktop with a webcam
- Google Chrome or Chromium (recommended for MediaPipe GPU delegation and Web Audio support)

### Setup & Run
```bash
# Install dependencies
npm install

# Run the test suite
npm test

# Start the Vite development server
npm run dev
```

Open `http://localhost:3000` in Chrome and allow camera access when prompted.

---

## Playing & Gestures

| Gesture | Action |
| :--- | :--- |
| **Two-Hand Pinch** | Pinch thumb and index together on both hands and pull apart to draw a string preview. |
| **Release Pinch** | Open your fingers when the string is at least 80 pixels long to lock it in place. |
| **Fingertip Flick** | Flick an extended index finger (or any finger with "Pluck with all fingers" enabled) across a string to pluck it. |
| **Endpoint Drag** | Pinch near an endpoint (within 40px) to reposition it or change its pitch. |
| **Fist in Air** | Hold a closed fist near a string for 1.2 seconds to delete it. |
| **Open-Palm Swipe** | Sweep an open hand horizontally across the camera to cycle through instrument sounds. |
| **Two-Hand Clap** | Bring open palms together in a quick clap to cycle visual color themes. |

### Keyboard Shortcuts
- `Space` — Mute or unmute master audio
- `Z` — Undo the most recently added string
- `C` — Clear all strings from the stage
- `H` — Toggle the hand skeleton overlay
- `F` — Toggle full screen
- `?` — Open the menu drawer and shortcut guide
- `Esc` — Close any open sheet or drawer

---

## Features

- **Groove Sequencer**: 16-step lookahead drum sequencer (Slow, Lo-fi with swing, and Upbeat) that sits underneath the strings. With "Tidy timing" enabled, plucks occurring within 60ms of a 16th note align to the grid.
- **Curated Vibes**: Six tuned mood presets ("Rainy window", "Night market", "Cathedral", "Basement", "Morning", "Deep sea") accessible via the sparkle button in the dock.
- **Open-Hand Strumming**: With all-finger plucking enabled, sweeping an open hand across a harp layout produces a natural acoustic strum with organic velocity falloff for successive strings.
- **Humanized Sound**: Every pluck applies subtle pitch variations (±2 cents), brightness variations (±8%), and timing jitter (0–4ms) to avoid artificial machine repetition.
- **Songs Mode**: Public-domain melodies (Twinkle Twinkle Little Star, Ode to Joy, Greensleeves, Auld Lang Syne, Scarborough Fair, and Für Elise) with "Learn" mode (waits for correct strings) and "Rhythm" mode (timed hits with star ratings).
- **30-Second Challenge**: Melodic pentatonic target phrases, shrinking timing windows (1.5s down to 0.7s), and combo multipliers up to 4x.
- **8-Second Looper**: Real-time pluck recorder with up to 3 overdub layers and a bottom playhead timeline.
- **Shareable Links**: Encodes your active instrument, scale, theme, groove, tempo, and string coordinates into a URL hash that anyone can open.

---

## How the sound works

The sound engine runs a digital waveguide (Karplus-Strong) algorithm:
1. When you pluck a string, the engine excites a delay line with a short burst of filtered noise shaped by pluck velocity and crossing angle.
2. The delay length $L = f_s / f_0$ sets the fundamental frequency of the string.
3. An internal lowpass filter gradually dampens higher harmonics on each circulation loop, reproducing the natural physical decay of nylon and steel strings.
4. Strings tuned to octaves or fifths of a plucked string ring with sympathetic resonance.

---

## Project Structure

```
HarpString/
├── index.html            # Stage layout, sheets, dock, and drawer
├── package.json          # Dependencies and scripts
├── vite.config.js        # Vite configuration (relative base for Pages)
├── test/                 # Vitest test suite (27 tests)
│   ├── challenge.test.js # Scoring and combo multiplier math
│   ├── gestures.test.js  # Landmark hysteresis and pose classification
│   ├── groove.test.js    # 16-step sequencer timing and pattern validation
│   ├── scales.test.js    # Pitch mapping and scale degrees
│   ├── share.test.js     # URL state hash encode/decode and corrupt handling
│   ├── songs.test.js     # Melody intervals for all 6 songs
│   ├── strings.test.js   # Segment intersection, distances, and locking
│   └── strum.test.js     # Velocity falloff math for multi-string strums
├── src/
│   ├── main.js           # Master RAF loop and mode coordination
│   ├── audio.js          # Web Audio Karplus-Strong waveguide engine
│   ├── strings.js        # String model, standing waves, and pluck logic
│   ├── effects.js        # Traveling wave pulses, ripples, and flashes
│   ├── groove.js         # 16-step lookahead drum sequencer
│   ├── vibes.js          # Curated preset configurations
│   ├── songs.js          # Melody notes and learning engine
│   ├── modes/
│   │   ├── challenge.js  # 30-second target-matching challenge mode
│   │   └── loop.js       # 8-second multi-layer looper
│   ├── achievements.js   # 10 milestone achievements
│   ├── coach.js          # Context-aware onboarding steps
│   ├── storage.js        # Safe localStorage wrapper
│   ├── share.js          # URL base64url hash sharing
│   ├── icons.js          # Custom inline SVG icons
│   ├── handTracker.js    # MediaPipe HandLandmarker wrapper
│   ├── gestures.js       # Geometric landmark pose analyzer
│   ├── instruments.js    # Timbre presets and sparklines
│   ├── themes.js         # Theme color palettes and clap detection
│   ├── render.js         # 2D canvas pipeline, skeleton, and vignette
│   ├── ui.js             # UI controls, drawers, and modal state
│   └── styles/
│       ├── tokens.css    # Colors, type scales, and radii
│       └── app.css       # Layout, dock, drawer, and responsive styles
└── scripts/
    └── verify-ui.js      # Headless Playwright visual verification script
```

---

## Known limitations

- **Lighting sensitivity**: MediaPipe hand landmark detection depends on decent front lighting. In very dim rooms or with heavy backlight, hand tracking confidence drops.
- **Mobile Safari**: While responsive layouts adapt to 390px mobile screens, Web Audio worklet initialization and camera stream policies on iOS Safari are less reliable than desktop Chrome.
- **Fast camera motions**: Extremely rapid hand whips past the camera frame rate (30 FPS) can cause missed string crossings; sweeping at moderate, musical tempos yields the best tactile response.
