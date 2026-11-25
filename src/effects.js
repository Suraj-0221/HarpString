// Physical Resonance Visual Effects System for Air Harp
// Replaces firework sparks with physical wave mechanics: traveling pulses,
// end-cap reflection flashes, expanding pluck ripples, and rising note labels.

export class EffectsManager {
  constructor() {
    // 1. Traveling pulses (max 64)
    this.maxPulses = 64;
    this.pulses = [];

    // 2. End-cap flash responses (max 32)
    this.maxEndCapFlashes = 32;
    this.endCapFlashes = [];

    // 3. Pluck ripples (max 24)
    this.maxRipples = 24;
    this.ripples = [];

    // 4. Note label rise notifications (max 16)
    this.maxNoteLabels = 16;
    this.noteLabels = [];
  }

  // Triggered on string pluck
  onPluck(str, pluckPos, strength) {
    const stringId = str.id;
    const color = str.colors;

    // A. Two traveling pulses toward both ends
    if (this.pulses.length + 2 <= this.maxPulses) {
      // Pulse toward endpoint A (dir = -1)
      this.pulses.push({
        stringId,
        pos: pluckPos,       // normalized pos 0..1
        dir: -1,             // moving toward A
        speed: 1.2,          // string lengths per second
        life: 2.0,           // 2.0s duration
        maxLife: 2.0,
        strength,
        color,
      });
      // Pulse toward endpoint B (dir = +1)
      this.pulses.push({
        stringId,
        pos: pluckPos,
        dir: 1,              // moving toward B
        speed: 1.2,
        life: 2.0,
        maxLife: 2.0,
        strength,
        color,
      });
    }

    // B. Single pluck ripple ring at crossing point
    if (this.ripples.length < this.maxRipples) {
      const dx = str.b.x - str.a.x;
      const dy = str.b.y - str.a.y;
      const hitX = str.a.x + dx * pluckPos;
      const hitY = str.a.y + dy * pluckPos;

      this.ripples.push({
        x: hitX,
        y: hitY,
        radius: 0,
        maxRadius: 60,
        life: 0.45, // 450 ms
        maxLife: 0.45,
        color: color.coreColor,
      });
    }

    // C. Rising note label at string midpoint
    if (this.noteLabels.length < this.maxNoteLabels && str.noteName) {
      this.noteLabels.push({
        stringId,
        noteName: str.noteName,
        life: 0.6, // 600 ms
        maxLife: 0.6,
        color: color.coreColor,
      });
    }
  }

  triggerEndCapFlash(x, y, color) {
    if (this.endCapFlashes.length < this.maxEndCapFlashes) {
      this.endCapFlashes.push({
        x,
        y,
        radius: 6,
        maxRadius: 14,
        life: 0.3, // 300 ms
        maxLife: 0.3,
        color: color.coreColor,
      });
    }
  }

  update(dt, stringManager) {
    // 1. Update Traveling Pulses
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pulses.splice(i, 1);
        continue;
      }

      // Update position along string
      p.pos += p.dir * p.speed * dt;

      // Handle endcap reflections & flashes
      const str = stringManager.strings.find(s => s.id === p.stringId);
      if (str) {
        if (p.pos <= 0) {
          p.pos = -p.pos;
          p.dir = -p.dir;
          this.triggerEndCapFlash(str.a.x, str.a.y, p.color);
        } else if (p.pos >= 1) {
          p.pos = 2 - p.pos;
          p.dir = -p.dir;
          this.triggerEndCapFlash(str.b.x, str.b.y, p.color);
        }
      }
    }

    // 2. Update End-Cap Flashes
    for (let i = this.endCapFlashes.length - 1; i >= 0; i--) {
      const f = this.endCapFlashes[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.endCapFlashes.splice(i, 1);
        continue;
      }
      const progress = 1.0 - (f.life / f.maxLife);
      f.radius = 6 + (f.maxRadius - 6) * progress;
    }

    // 3. Update Pluck Ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.ripples.splice(i, 1);
        continue;
      }
      const progress = 1.0 - (r.life / r.maxLife);
      // Ease-out expansion
      const easeOut = 1 - Math.pow(1 - progress, 3);
      r.radius = r.maxRadius * easeOut;
    }

    // 4. Update Note Labels
    for (let i = this.noteLabels.length - 1; i >= 0; i--) {
      const n = this.noteLabels[i];
      n.life -= dt;
      if (n.life <= 0) {
        this.noteLabels.splice(i, 1);
      }
    }
  }

  // Returns pulse brightness swell factor at position s (0..1) on a string
  getPulseSwellAt(stringId, s) {
    let swell = 0;
    const pulseWidth = 0.12; // 12% string width
    for (let i = 0; i < this.pulses.length; i++) {
      const p = this.pulses[i];
      if (p.stringId !== stringId) continue;
      const dist = Math.abs(s - p.pos);
      if (dist < pulseWidth * 2) {
        // Gaussian bump
        const env = Math.exp(-Math.pow(dist / pulseWidth, 2));
        const alpha = (p.life / p.maxLife) * p.strength;
        swell += env * alpha;
      }
    }
    return Math.min(1.2, swell);
  }

  render(ctx, stringManager) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Render End-Cap Flashes
    for (let i = 0; i < this.endCapFlashes.length; i++) {
      const f = this.endCapFlashes[i];
      const alpha = (f.life / f.maxLife) * 0.9;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = alpha;
      ctx.stroke();
    }

    // 2. Render Pluck Ripples (One thin 1px ring expanding)
    for (let i = 0; i < this.ripples.length; i++) {
      const r = this.ripples[i];
      const alpha = (r.life / r.maxLife) * 0.8;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.0;
      ctx.globalAlpha = alpha;
      ctx.stroke();
    }

    // 3. Render Rising Note Labels (IBM Plex Mono 12px, rising 14px over 600ms)
    for (let i = 0; i < this.noteLabels.length; i++) {
      const n = this.noteLabels[i];
      const str = stringManager.strings.find(s => s.id === n.stringId);
      if (!str) continue;

      const progress = 1.0 - (n.life / n.maxLife);
      const alpha = (n.life / n.maxLife);
      const riseY = progress * 14;

      const midX = (str.a.x + str.b.x) * 0.5;
      const midY = (str.a.y + str.b.y) * 0.5 - riseY - 10;

      ctx.font = '500 12px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = n.color;
      ctx.globalAlpha = alpha;
      ctx.fillText(n.noteName, midX, midY);
    }

    ctx.restore();
  }

  clear() {
    this.pulses = [];
    this.endCapFlashes = [];
    this.ripples = [];
    this.noteLabels = [];
  }
}
