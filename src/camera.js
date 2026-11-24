// Camera management with robust error handling and constraints

export async function setupCamera(videoElement, cameraConfig) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Webcam API (navigator.mediaDevices.getUserMedia) is not supported in this browser.');
  }

  const constraints = {
    audio: false,
    video: {
      width: { ideal: cameraConfig.idealWidth || 1280 },
      height: { ideal: cameraConfig.idealHeight || 720 },
      frameRate: { ideal: cameraConfig.frameRate || 60, min: 30 },
      facingMode: cameraConfig.facingMode || 'user',
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = stream;
    videoElement.playsInline = true;
    videoElement.muted = true;

    await new Promise((resolve) => {
      if (videoElement.readyState >= 2) {
        resolve();
      } else {
        videoElement.onloadedmetadata = () => resolve();
      }
    });

    await videoElement.play();

    return {
      stream,
      video: videoElement,
      width: videoElement.videoWidth || cameraConfig.idealWidth,
      height: videoElement.videoHeight || cameraConfig.idealHeight,
      cleanup: () => {
        stream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
      }
    };
  } catch (err) {
    console.error('Camera initialization error:', err);
    let friendlyMessage = 'Failed to access camera.';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      friendlyMessage = 'Camera access was blocked. Click the camera icon in your browser address bar to allow access.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      friendlyMessage = 'No camera detected. Please connect a webcam and try again.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      friendlyMessage = 'Your camera is already in use by another app or browser tab. Close other video apps and try again.';
    } else if (err.name === 'OverconstrainedError') {
      friendlyMessage = 'Camera does not satisfy requested resolution. Attempting fallback...';
      // Attempt fallback with loose constraints
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        videoElement.srcObject = fallbackStream;
        videoElement.playsInline = true;
        videoElement.muted = true;
        await videoElement.play();
        return {
          stream: fallbackStream,
          video: videoElement,
          width: videoElement.videoWidth || 1280,
          height: videoElement.videoHeight || 720,
          cleanup: () => {
            fallbackStream.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
          }
        };
      } catch (fallbackErr) {
        throw new Error('Camera failed even with fallback constraints: ' + fallbackErr.message);
      }
    } else {
      friendlyMessage = `Camera error (${err.name}): ${err.message}`;
    }

    const error = new Error(friendlyMessage);
    error.originalError = err;
    throw error;
  }
}
