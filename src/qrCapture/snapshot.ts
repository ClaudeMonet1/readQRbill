import type { QRLocation } from './types';

const MARGIN_RATIO = 0.1;

export async function captureQRImage(
  video: HTMLVideoElement,
  location: QRLocation,
): Promise<Blob> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error('video has no dimensions yet');

  const xs = [location.topLeft.x, location.topRight.x, location.bottomLeft.x, location.bottomRight.x];
  const ys = [location.topLeft.y, location.topRight.y, location.bottomLeft.y, location.bottomRight.y];
  const minX = Math.max(0, Math.min(...xs));
  const minY = Math.max(0, Math.min(...ys));
  const maxX = Math.min(w, Math.max(...xs));
  const maxY = Math.min(h, Math.max(...ys));
  const bw = maxX - minX;
  const bh = maxY - minY;

  const mx = bw * MARGIN_RATIO;
  const my = bh * MARGIN_RATIO;
  const sx = Math.max(0, Math.floor(minX - mx));
  const sy = Math.max(0, Math.floor(minY - my));
  const sw = Math.min(w - sx, Math.ceil(bw + 2 * mx));
  const sh = Math.min(h - sy, Math.ceil(bh + 2 * my));

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/jpeg',
      0.9,
    );
  });
}
