// Cached <canvas> per (w,h) pair. iOS Safari 14 doesn't support OffscreenCanvas.
const canvasCache = new Map<string, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>();

function getCanvas(w: number, h: number) {
  const key = `${w}x${h}`;
  let entry = canvasCache.get(key);
  if (!entry) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D context unavailable');
    entry = { canvas, ctx };
    canvasCache.set(key, entry);
  }
  return entry;
}

export function downscaleToGrayscale(
  video: HTMLVideoElement,
  w: number,
  h: number,
): Uint8ClampedArray {
  const { canvas, ctx } = getCanvas(w, h);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // RGBA → grayscale via Rec. 601 luminosity
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    out[j] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
  }
  return out;
}
