// Canvas 2D Renderer for Air Harp
// Mirrored Webcam -> Strings (with afterimages & pulse swell) -> Resonance Effects -> Skeleton

import { CONFIG } from './config.js';

// MediaPipe 21 Hand Landmark Bones
const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm Base
  [5, 9], [9, 13], [13, 17]
];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.showSkeleton = CONFIG.SKELETON.showSkeleton;
    this.showNoteLabels = CONFIG.STRINGS.showNoteLabels;
    this.isMirrored = CONFIG.CAMERA.mirror;
    this.lowPerformanceMode = false;
  }

  computeCoverFit(videoWidth, videoHeight, canvasWidth, canvasHeight) {
    const vWidth = videoWidth || 1280;
    const vHeight = videoHeight || 720;
    const videoRatio = vWidth / vHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let renderWidth, renderHeight, renderX, renderY;

    if (canvasRatio > videoRatio) {
      renderWidth = canvasWidth;
      renderHeight = canvasWidth / videoRatio;
      renderX = 0;
      renderY = (canvasHeight - renderHeight) / 2;
    } else {
      renderHeight = canvasHeight;
      renderWidth = canvasHeight * videoRatio;
      renderX = (canvasWidth - renderWidth) / 2;
      renderY = 0;
    }

    return { renderWidth, renderHeight, renderX, renderY };
  }

  renderFrame(video, stringManager, effectsManager, handResults, transform, fistDeleteState, themeManager, audioEngine) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // 1. Mirrored Webcam Video with Theme Filter
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    const currentTheme = themeManager ? themeManager.getCurrentTheme() : null;

    if (video && video.readyState >= 2) {
      const dim = themeManager ? themeManager.videoDim : 0.75;
      ctx.filter = currentTheme ? currentTheme.videoFilter(dim * 100) : `brightness(75%)`;

      if (this.isMirrored) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        const mirroredX = width - transform.renderX - transform.renderWidth;
        ctx.drawImage(video, mirroredX, transform.renderY, transform.renderWidth, transform.renderHeight);
      } else {
        ctx.drawImage(video, transform.renderX, transform.renderY, transform.renderWidth, transform.renderHeight);
      }
    } else {
      ctx.fillStyle = '#16130F';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();

    // Radial vignette (35% dark at edges) and gentle color grade
    this.drawVignetteAndGrading(ctx, width, height, currentTheme);

    // Sound-reactive audio breathing level
    const audioLevel = audioEngine ? audioEngine.getMasterLevel() : 0;

    // 2. All Strings (Additive neon glow)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const wavePointsCount = this.lowPerformanceMode ? CONFIG.STRINGS.wavePointsReduced : CONFIG.STRINGS.wavePoints;

    for (let i = 0; i < stringManager.strings.length; i++) {
      const str = stringManager.strings[i];
      this.drawHarpString(ctx, str, wavePointsCount, effectsManager, audioLevel);
    }

    // Draw Preview String (while user is pinching)
    if (stringManager.previewString) {
      this.drawPreviewString(ctx, stringManager.previewString);
    }
    ctx.restore();

    // 3. Physical Resonance Visual Effects (C1, C2, C3, C5)
    if (effectsManager) {
      effectsManager.render(ctx, stringManager);
    }

    // 4. Fist-Delete Progress Indicator
    if (fistDeleteState && fistDeleteState.progress > 0) {
      this.drawFistProgress(ctx, fistDeleteState.fistPos, fistDeleteState.progress);
    }

    // 5. Hand Skeleton Overlay
    if (this.showSkeleton && handResults && handResults.length > 0) {
      this.drawSkeleton(ctx, handResults, themeManager);
    }
  }

  drawVignetteAndGrading(ctx, width, height, currentTheme) {
    ctx.save();
    // Radial vignette: 35% dark at edges
    const radius = Math.hypot(width, height) * 0.55;
    const grad = ctx.createRadialGradient(width * 0.5, height * 0.5, radius * 0.35, width * 0.5, height * 0.5, radius);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Color grade matching theme: warm for EMBER, cool for AURORA, desaturated for INK
    if (currentTheme) {
      if (currentTheme.name === 'EMBER') {
        ctx.fillStyle = 'rgba(255, 120, 40, 0.05)';
        ctx.fillRect(0, 0, width, height);
      } else if (currentTheme.name === 'AURORA') {
        ctx.fillStyle = 'rgba(80, 220, 200, 0.05)';
        ctx.fillRect(0, 0, width, height);
      } else if (currentTheme.name === 'INK') {
        ctx.fillStyle = 'rgba(242, 235, 221, 0.03)';
        ctx.fillRect(0, 0, width, height);
      }
    }
    ctx.restore();
  }

  drawHarpString(ctx, str, wavePointsCount, effectsManager, audioLevel = 0) {
    const { a, b, colors, amplitude, isPlucked, glowIntensity, drawOnProgress } = str;
    const dx = (b.x - a.x) * drawOnProgress;
    const dy = (b.y - a.y) * drawOnProgress;
    const currentBx = a.x + dx;
    const currentBy = a.y + dy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const alphaMult = str.isDeleting ? str.deleteAlpha : 1.0;
    if (alphaMult <= 0.01) return;

    // A. Ghost line (offset 5px, 25% alpha)
    const ghostOffset = CONFIG.STRINGS.ghostOffset || 5;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = `hsla(${colors.hue}, 90%, 80%, ${(CONFIG.STRINGS.ghostAlpha * alphaMult).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.moveTo(a.x + nx * ghostOffset, a.y + ny * ghostOffset);
    ctx.lineTo(currentBx + nx * ghostOffset, currentBy + ny * ghostOffset);
    ctx.stroke();
    ctx.restore();

    // B. Fret/Ruler Tick Marks (every 40px)
    const tickSpacing = CONFIG.STRINGS.tickSpacing || 40;
    const tickLen = (CONFIG.STRINGS.tickLength || 6) * 0.5;
    const tickAlpha = (CONFIG.STRINGS.tickAlpha * alphaMult).toFixed(3);

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = `hsla(${colors.hue}, 80%, 75%, ${tickAlpha})`;
    ctx.lineWidth = 1.0;
    const numTicks = Math.floor(len / tickSpacing);
    for (let i = 1; i <= numTicks; i++) {
      const s = (i * tickSpacing) / len;
      const disp = str.sampleDisplacement(s);
      const tx = a.x + dx * s + nx * disp;
      const ty = a.y + dy * s + ny * disp;
      ctx.moveTo(tx - nx * tickLen, ty - ny * tickLen);
      ctx.lineTo(tx + nx * tickLen, ty + ny * tickLen);
    }
    ctx.stroke();
    ctx.restore();

    // C. Standing-Wave Afterimage (Workstream C4)
    // 3 fading ghost copies of wave shape from earlier frames (90ms, 180ms, 270ms at alpha 0.25, 0.12, 0.05)
    if (isPlucked && amplitude > 0.8) {
      const afterimageOffsets = [0.09, 0.18, 0.27];
      const afterimageAlphas = [0.25, 0.12, 0.05];

      for (let ai = 0; ai < 3; ai++) {
        const offsetSec = afterimageOffsets[ai];
        const aiAlpha = afterimageAlphas[ai] * alphaMult;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        for (let i = 1; i <= wavePointsCount; i++) {
          const s = i / wavePointsCount;
          const disp = str.sampleDisplacement(s, offsetSec);
          const px = a.x + dx * s + nx * disp;
          const py = a.y + dy * s + ny * disp;
          ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `hsla(${colors.hue}, 95%, 80%, ${aiAlpha.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    }

    // D. Main Standing Wave / String Line
    ctx.save();
    ctx.beginPath();

    if (isPlucked && amplitude > 0.5) {
      ctx.moveTo(a.x, a.y);
      for (let i = 1; i <= wavePointsCount; i++) {
        const s = i / wavePointsCount;
        const disp = str.sampleDisplacement(s);
        const px = a.x + dx * s + nx * disp;
        const py = a.y + dy * s + ny * disp;
        ctx.lineTo(px, py);
      }
    } else {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(currentBx, currentBy);
    }

    // Pulse brightness swell (Workstream C1)
    const midSwell = effectsManager ? effectsManager.getPulseSwellAt(str.id, 0.5) : 0;
    // Sound-reactive idle breathing (Workstream C6)
    const breathing = audioLevel * 1.5;

    // 1. Wide glow
    const totalGlow = (0.22 * (1 + glowIntensity + midSwell * 0.8 + breathing) * alphaMult);
    ctx.strokeStyle = `hsla(${colors.hue}, 100%, 75%, ${totalGlow.toFixed(3)})`;
    ctx.lineWidth = 8 + midSwell * 4;
    ctx.shadowBlur = this.lowPerformanceMode ? 0 : (CONFIG.STRINGS.idleGlowBlur + glowIntensity * 16 + midSwell * 12);
    ctx.shadowColor = colors.glowColor;
    ctx.stroke();

    // 2. Colored mid stroke
    ctx.strokeStyle = `hsla(${colors.hue}, 95%, 80%, ${(0.7 * alphaMult).toFixed(3)})`;
    ctx.lineWidth = 3 + midSwell * 1.5;
    ctx.stroke();

    // 3. Thin white core
    ctx.strokeStyle = `rgba(255, 255, 255, ${(1.0 * alphaMult).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // E. Caliper End-Caps
    this.drawCaliperEndCap(ctx, a.x, a.y, nx, ny, colors, alphaMult);
    this.drawCaliperEndCap(ctx, currentBx, currentBy, nx, ny, colors, alphaMult);

    // F. Faint Note Label at Midpoint (IBM Plex Mono 12px)
    if (this.showNoteLabels && str.noteName && drawOnProgress > 0.9) {
      const midDisp = str.sampleDisplacement(0.5);
      const mx = a.x + dx * 0.5 + nx * (midDisp + 14);
      const my = a.y + dy * 0.5 + ny * (midDisp + 14);

      ctx.save();
      ctx.font = '400 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `hsla(${colors.hue}, 90%, 90%, ${(0.45 * alphaMult).toFixed(3)})`;
      ctx.fillText(str.noteName, mx, my);
      ctx.restore();
    }
  }

  drawCaliperEndCap(ctx, cx, cy, nx, ny, colors, alphaMult = 1.0) {
    const r = CONFIG.STRINGS.caliperRadius || 6;
    const barHalf = (CONFIG.STRINGS.caliperBarLength || 14) * 0.5;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = `hsla(${colors.hue}, 90%, 85%, ${(0.8 * alphaMult).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.moveTo(cx - nx * barHalf, cy - ny * barHalf);
    ctx.lineTo(cx + nx * barHalf, cy + ny * barHalf);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.95 * alphaMult).toFixed(3)})`;
    ctx.shadowBlur = 8;
    ctx.shadowColor = colors.glowColor;
    ctx.fill();
    ctx.restore();
  }

  drawPreviewString(ctx, prev) {
    const { a, b, colors, shimmer, noteName } = prev;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = prev.length || 1;
    const nx = -dy / len;
    const ny = dx / len;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);

    const alpha = 0.5 + shimmer * 0.45;
    ctx.strokeStyle = `hsla(${colors.hue}, 95%, 85%, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 14;
    ctx.shadowColor = colors.glowColor;
    ctx.stroke();

    this.drawCaliperEndCap(ctx, a.x, a.y, nx, ny, colors, 0.85);
    this.drawCaliperEndCap(ctx, b.x, b.y, nx, ny, colors, 0.85);

    if (noteName) {
      ctx.font = '500 12px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(noteName, (a.x + b.x) * 0.5 + nx * 16, (a.y + b.y) * 0.5 + ny * 16);
    }
    ctx.restore();
  }

  drawFistProgress(ctx, pos, progress) {
    ctx.save();
    const radius = 24;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 77, 77, 0.25)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.strokeStyle = '#FF4D4D';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  drawSkeleton(ctx, handResults, themeManager) {
    ctx.save();
    const currentTheme = themeManager ? themeManager.getCurrentTheme() : null;
    const accent = currentTheme ? currentTheme.accent : '#F58BC4';

    for (let h = 0; h < handResults.length; h++) {
      const hand = handResults[h];
      const lms = hand.landmarks;
      if (!lms || lms.length < 21) continue;

      // Bones: 1.5px, rgba(242, 235, 221, 0.55)
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(242, 235, 221, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < HAND_CONNECTIONS.length; i++) {
        const [a, b] = HAND_CONNECTIONS[i];
        ctx.moveTo(lms[a].x, lms[a].y);
        ctx.lineTo(lms[b].x, lms[b].y);
      }
      ctx.stroke();

      // Joints: 2.5px dots, rgba(242, 235, 221, 0.80)
      ctx.fillStyle = 'rgba(242, 235, 221, 0.80)';
      for (let i = 0; i < 21; i++) {
        if (i === 4 || i === 8) continue; // tips filled with accent
        ctx.beginPath();
        ctx.arc(lms[i].x, lms[i].y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Thumb tip [4] and Index tip [8]: filled with accent
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(lms[4].x, lms[4].y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(lms[8].x, lms[8].y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Pinch feedback: thin ring around pinch point that tightens as pinch closes
      if (hand.pinchPoint) {
        const ratio = hand.pinchRatio !== undefined ? hand.pinchRatio : 0.5;
        const radius = Math.max(6, Math.min(22, ratio * 40));
        ctx.beginPath();
        ctx.strokeStyle = hand.isPinching ? accent : 'rgba(242, 235, 221, 0.4)';
        ctx.lineWidth = hand.isPinching ? 2 : 1;
        ctx.arc(hand.pinchPoint.x, hand.pinchPoint.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        if (hand.isPinching) {
          ctx.beginPath();
          ctx.arc(hand.pinchPoint.x, hand.pinchPoint.y, radius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(242, 235, 221, 0.2)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}
