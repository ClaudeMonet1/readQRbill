import jsQR from 'jsqr';
import type { QRLocation } from './types';

export interface DecodeLoopOpts {
  video: HTMLVideoElement;
  onDecoded: (payload: string, location: QRLocation) => void;
  onTimeout: () => void;
  onError?: (err: Error) => void;
  timeoutMs?: number;
}

const FRAME_INTERVAL_MS = 66; // ~15 FPS
const SCAN_W = 640;
const SCAN_H = 480;
const DEFAULT_TIMEOUT_MS = 30_000;

export function runDecodeLoop(opts: DecodeLoopOpts): () => void {
  const canvas = document.createElement('canvas');
  canvas.width = SCAN_W;
  canvas.height = SCAN_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    opts.onError?.(new Error('2D context unavailable'));
    return () => {};
  }

  let stopped = false;
  let tick = 0;
  const startedAt = performance.now();
  const limit = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const intervalId = window.setInterval(() => {
    if (stopped) return;
    tick++;
    if (tick % 2 !== 0) return; // 1 frame on 2

    if (performance.now() - startedAt > limit) {
      stopped = true;
      window.clearInterval(intervalId);
      opts.onTimeout();
      return;
    }

    try {
      ctx.drawImage(opts.video, 0, 0, SCAN_W, SCAN_H);
      const image = ctx.getImageData(0, 0, SCAN_W, SCAN_H);
      const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
      if (result && result.data) {
        stopped = true;
        window.clearInterval(intervalId);
        const sx = opts.video.videoWidth / SCAN_W;
        const sy = opts.video.videoHeight / SCAN_H;
        const m = (p: { x: number; y: number }) => ({ x: p.x * sx, y: p.y * sy });
        opts.onDecoded(result.data, {
          topLeft: m(result.location.topLeftCorner),
          topRight: m(result.location.topRightCorner),
          bottomLeft: m(result.location.bottomLeftCorner),
          bottomRight: m(result.location.bottomRightCorner),
        });
      }
    } catch (err) {
      opts.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, FRAME_INTERVAL_MS);

  return () => {
    stopped = true;
    window.clearInterval(intervalId);
  };
}
