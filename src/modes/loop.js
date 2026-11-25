// 8-Second Loop Station for Air Harp
// Multi-pass overdubbing (up to 3 layers), quantizing to 1/16 if Tidy timing on,
// synchronized replay with soft string flashes, and bottom timeline state.

export class LoopManager {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.duration = 8.0; // 8 seconds per bar
    this.maxLayers = 3;

    this.isRecording = false;
    this.isPlaying = false;
    this.currentLayer = 0;
    this.currentTime = 0;

    // Array of layers: each layer is an array of { time, stringId, strength, tString }
    this.layers = [];
    this.tidyTiming = true;

    // Track which events have already fired in the current loop cycle
    this.firedEventIndices = new Set();
  }

  toggleRecording(grooveBpm = 80) {
    if (!this.isRecording) {
      // Start recording a new layer
      if (this.layers.length >= this.maxLayers) {
        // Recycle oldest layer or cap
        this.layers.shift();
      }

      this.currentLayer = this.layers.length;
      this.layers.push([]);
      this.isRecording = true;
      this.isPlaying = true;
      this.currentTime = 0;
      this.firedEventIndices.clear();

      return { status: 'recording', layer: this.currentLayer + 1 };
    } else {
      // Stop recording, continue looping
      this.isRecording = false;
      this.isPlaying = true;
      return { status: 'looping', layer: this.currentLayer + 1 };
    }
  }

  clear() {
    this.isRecording = false;
    this.isPlaying = false;
    this.layers = [];
    this.currentLayer = 0;
    this.currentTime = 0;
    this.firedEventIndices.clear();
  }

  recordPluck(stringId, strength, tString, grooveBpm = 80) {
    if (!this.isRecording || this.currentLayer >= this.layers.length) return;

    let eventTime = this.currentTime;

    // Quantize to 1/16 note if tidy timing is on
    if (this.tidyTiming && grooveBpm) {
      const stepDuration = (60.0 / grooveBpm) / 4.0;
      eventTime = Math.round(eventTime / stepDuration) * stepDuration;
      eventTime = Math.max(0, Math.min(this.duration - 0.05, eventTime));
    }

    const currentLayerEvents = this.layers[this.currentLayer];
    currentLayerEvents.push({
      time: eventTime,
      stringId,
      strength,
      tString,
      layer: this.currentLayer
    });
  }

  update(dt, stringManager, effectsManager) {
    if (!this.isPlaying && !this.isRecording) return;

    const prevTime = this.currentTime;
    this.currentTime += dt;

    // Loop cycle boundary wrap
    if (this.currentTime >= this.duration) {
      this.currentTime = this.currentTime % this.duration;
      this.firedEventIndices.clear();

      // If recording, auto-transition to playback or next overdub
      if (this.isRecording) {
        if (this.layers.length >= this.maxLayers) {
          this.isRecording = false;
        } else {
          // Continue recording onto next layer
          this.currentLayer = this.layers.length;
          this.layers.push([]);
        }
      }
    }

    // Trigger scheduled events across all layers
    for (let l = 0; l < this.layers.length; l++) {
      const layerEvents = this.layers[l];
      for (let i = 0; i < layerEvents.length; i++) {
        const ev = layerEvents[i];
        const key = `${l}_${i}`;

        if (!this.firedEventIndices.has(key)) {
          // Check if playhead passed this event
          if (ev.time >= prevTime && ev.time <= this.currentTime) {
            this.firedEventIndices.add(key);
            this.replayPluck(ev, stringManager, effectsManager);
          }
        }
      }
    }
  }

  replayPluck(event, stringManager, effectsManager) {
    const str = stringManager.strings.find(s => s.id === event.stringId);
    if (!str) return;

    // Soft flash & standing wave vibration
    str.triggerPluck(event.strength * 0.85, event.tString);
    this.audioEngine.pluck(str.id, str.frequency, event.strength * 0.85, event.tString, 0.5);

    if (effectsManager) {
      effectsManager.onPluck(str, event.tString, event.strength * 0.8);
    }
  }

  getProgress() {
    return (this.currentTime / this.duration) * 100;
  }

  getAllEvents() {
    const all = [];
    for (let l = 0; l < this.layers.length; l++) {
      all.push(...this.layers[l]);
    }
    return all;
  }
}
