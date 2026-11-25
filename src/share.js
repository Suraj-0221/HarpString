// URL Share Hash Encoder / Decoder for Air Harp
// Encodes instrument, key, scale, theme, groove, BPM, and normalized strings [0..1000]
// as base64url with version field. Gracefully handles corrupt or empty hashes.

const CURRENT_VERSION = 1;

// Converts Uint8Array or JSON string to base64url
function toBase64Url(str) {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return '';
  }
}

// Converts base64url back to JSON string
function fromBase64Url(base64url) {
  try {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeShareState(state, canvasWidth = 1280, canvasHeight = 720) {
  try {
    const normalizedStrings = (state.strings || []).map(str => {
      return [
        Math.round((str.a.x / canvasWidth) * 1000),
        Math.round((str.a.y / canvasHeight) * 1000),
        Math.round((str.b.x / canvasWidth) * 1000),
        Math.round((str.b.y / canvasHeight) * 1000)
      ];
    });

    const payload = {
      v: CURRENT_VERSION,
      i: state.instrument || 'HARP',
      k: state.key || 'C',
      s: state.scale || 'c_minor',
      t: state.theme || 'NEON',
      g: state.groove || 'Off',
      b: state.bpm || 80,
      st: normalizedStrings
    };

    return toBase64Url(JSON.stringify(payload));
  } catch {
    return '';
  }
}

export function decodeShareState(hash, canvasWidth = 1280, canvasHeight = 720) {
  if (!hash || typeof hash !== 'string') return null;

  // Strip leading # if present
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!cleaned) return null;

  try {
    const jsonStr = fromBase64Url(cleaned);
    if (!jsonStr) return null;

    const parsed = JSON.parse(jsonStr);
    if (!parsed || parsed.v !== CURRENT_VERSION) return null;

    // Denormalize strings to current canvas dimensions
    const strings = Array.isArray(parsed.st)
      ? parsed.st.map(coords => {
          if (!Array.isArray(coords) || coords.length < 4) return null;
          return {
            a: {
              x: (coords[0] / 1000) * canvasWidth,
              y: (coords[1] / 1000) * canvasHeight
            },
            b: {
              x: (coords[2] / 1000) * canvasWidth,
              y: (coords[3] / 1000) * canvasHeight
            }
          };
        }).filter(Boolean)
      : [];

    return {
      version: parsed.v,
      instrument: parsed.i || 'HARP',
      key: parsed.k || 'C',
      scale: parsed.s || 'c_minor',
      theme: parsed.t || 'NEON',
      groove: parsed.g || 'Off',
      bpm: parsed.b || 80,
      strings
    };
  } catch {
    // Corrupt or invalid JSON: ignore silently
    return null;
  }
}
