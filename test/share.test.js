import { describe, it, expect } from 'vitest';
import { encodeShareState, decodeShareState } from '../src/share.js';

describe('Share State Hash Encoding & Decoding', () => {
  it('round-trips state with normalized string coordinates', () => {
    const originalState = {
      instrument: 'KOTO',
      key: 'D',
      scale: 'minor_pentatonic',
      theme: 'EMBER',
      groove: 'Lo-fi',
      bpm: 82,
      strings: [
        { a: { x: 128, y: 72 }, b: { x: 640, y: 360 } },
        { a: { x: 300, y: 150 }, b: { x: 900, y: 600 } }
      ]
    };

    const hash = encodeShareState(originalState, 1280, 720);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(10);

    const decoded = decodeShareState(hash, 1280, 720);
    expect(decoded).not.toBeNull();
    expect(decoded.instrument).toBe('KOTO');
    expect(decoded.key).toBe('D');
    expect(decoded.scale).toBe('minor_pentatonic');
    expect(decoded.theme).toBe('EMBER');
    expect(decoded.groove).toBe('Lo-fi');
    expect(decoded.bpm).toBe(82);

    expect(decoded.strings.length).toBe(2);
    expect(decoded.strings[0].a.x).toBeCloseTo(128, 0);
    expect(decoded.strings[0].a.y).toBeCloseTo(72, 0);
    expect(decoded.strings[0].b.x).toBeCloseTo(640, 0);
    expect(decoded.strings[0].b.y).toBeCloseTo(360, 0);
  });

  it('handles leading # in hash strings', () => {
    const originalState = {
      instrument: 'GLASS',
      key: 'A',
      scale: 'major',
      theme: 'INK',
      groove: 'Slow',
      bpm: 66,
      strings: []
    };

    const hash = '#' + encodeShareState(originalState, 1280, 720);
    const decoded = decodeShareState(hash, 1280, 720);
    expect(decoded).not.toBeNull();
    expect(decoded.instrument).toBe('GLASS');
    expect(decoded.theme).toBe('INK');
  });

  it('silently ignores corrupt, empty or invalid hashes', () => {
    expect(decodeShareState('')).toBeNull();
    expect(decodeShareState('#')).toBeNull();
    expect(decodeShareState(null)).toBeNull();
    expect(decodeShareState('corrupt-non-json-data-123')).toBeNull();
    expect(decodeShareState('#invalid!base64==')).toBeNull();
  });
});
