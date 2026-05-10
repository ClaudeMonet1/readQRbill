export interface CameraHandle {
  video: HTMLVideoElement;
  stream: MediaStream;
  stop: () => void;
}

const PREFERRED: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
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
