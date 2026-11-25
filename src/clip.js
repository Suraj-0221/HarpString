// Clip Capture System for Air Harp
// Records 10-second clips from canvas and audio stream, saving as webm without countdowns.

export class ClipRecorder {
  constructor(getCanvasStreamCallback, showToastCallback) {
    this.getCanvasStream = getCanvasStreamCallback;
    this.showToast = showToastCallback;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.clipTimer = null;
  }

  startClip(onComplete = null) {
    if (this.isRecording) {
      this.stopClip();
      return;
    }

    try {
      const stream = this.getCanvasStream();
      if (!stream) {
        if (this.showToast) this.showToast('Unable to capture stage stream');
        return false;
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `air-harp-clip-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        if (this.showToast) this.showToast('Saved 10 s clip');
        if (onComplete) onComplete();
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      if (this.showToast) this.showToast('Recording 10 s clip...');

      // Auto-stop after 10 seconds
      this.clipTimer = setTimeout(() => {
        if (this.isRecording) {
          this.stopClip();
        }
      }, 10000);

      return true;
    } catch (e) {
      console.error('Clip recording error:', e);
      if (this.showToast) this.showToast('Clip recording failed');
      return false;
    }
  }

  stopClip() {
    if (this.clipTimer) {
      clearTimeout(this.clipTimer);
      this.clipTimer = null;
    }
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }
}
