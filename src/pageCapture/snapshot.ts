import type { CropRect } from './cropRegion';

export async function captureFullFrame(
  video: HTMLVideoElement,
  crop?: CropRect | null,
): Promise<Blob> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error('video has no dimensions yet');

  const sx = crop ? crop.sx : 0;
  const sy = crop ? crop.sy : 0;
  const sw = crop ? crop.sw : w;
  const sh = crop ? crop.sh : h;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('toBlob returned null'));
        else resolve(blob);
      },
      'image/jpeg',
      0.9,
    );
  });
}
