import { describe, it, expect } from 'vitest';
import { AudioEngine } from '../src/audio.js';
import { SCALES } from '../src/config.js';

describe('Musical Scale Quantization Unit Tests', () => {
  it('computes C Natural Minor scale notes correctly', () => {
    const audio = new AudioEngine();
    audio.setScale('c_minor', 'C');
    expect(audio.scaleNotes).not.toBeNull();
    expect(audio.scaleNotes.length).toBeGreaterThan(15);

    // Check that notes contain C, D, Eb, F, G, Ab, Bb
    const pitchClasses = new Set(audio.scaleNotes.map(n => n.midi % 12));
    // C=0, D=2, Eb=3, F=5, G=7, Ab=8, Bb=10
    expect(pitchClasses).toEqual(new Set([0, 2, 3, 5, 7, 8, 10]));
  });

  it('snaps raw string lengths to valid scale pitches', () => {
    const audio = new AudioEngine();
    audio.setScale('c_minor', 'C');

    const diagonal = 1400;

    // Short string -> high pitch
    const shortPitch = audio.mapLengthToPitch(150, diagonal);
    expect(shortPitch.frequency).toBeGreaterThan(400);
    expect(shortPitch.noteName).toBeTruthy();

    // Long string -> low pitch
    const longPitch = audio.mapLengthToPitch(1200, diagonal);
    expect(longPitch.frequency).toBeLessThan(200);
    expect(longPitch.noteName).toBeTruthy();
    expect(longPitch.frequency).toBeLessThan(shortPitch.frequency);
  });

  it('supports major pentatonic scale without half steps', () => {
    const audio = new AudioEngine();
    audio.setScale('major_pentatonic', 'C');
    const pitchClasses = new Set(audio.scaleNotes.map(n => n.midi % 12));
    // C=0, D=2, E=4, G=7, A=9
    expect(pitchClasses).toEqual(new Set([0, 2, 4, 7, 9]));
  });
});
