export interface CameraHandle {
  video: HTMLVideoElement;
  stream: MediaStream;
  stop: () => void;
}

const PREFERRED: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'environment' },
    // Push for the highest resolution the camera can deliver. Browsers pick the
    // closest supported value; on phones with 4K cameras this typically yields
    // 3840×2160 or higher. Cropping to the page guide preserves detail.
    width: { ideal: 4096 },
    height: { ideal: 4096 },
  },
  audio: false,
};

const FALLBACK: MediaStreamConstraints = { video: true, audio: false };

async function requestStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(PREFERRED);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'OverconstrainedError') {
      return await navigator.mediaDevices.getUserMedia(FALLBACK);
    }
    throw err;
  }
}

export async function startCamera(): Promise<CameraHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException('getUserMedia unavailable', 'NotSupportedError');
  }
  const stream = await requestStream();

  const video = document.createElement('video');
  video.setAttribute('playsinline', 'true');
  video.muted = true;
  video.autoplay = true;
  video.srcObject = stream;
  await video.play();

  const stop = () => {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
  return { video, stream, stop };
}
