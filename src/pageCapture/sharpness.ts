export const SHARPNESS_THRESHOLD = 80;

export function laplacianVariance(
  img: Uint8ClampedArray,
  w: number,
  h: number,
): number {
  if (img.length !== w * h) {
    throw new Error(`size mismatch: ${img.length} != ${w}*${h}`);
  }
  // 3x3 Laplacian: response = 4*center - top - bottom - left - right
  // Skip 1-pixel border. Compute mean and variance of responses in one pass.
  const inner = (w - 2) * (h - 2);
  let sum = 0;
  let sumSq = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = img[y * w + x]!;
      const t = img[(y - 1) * w + x]!;
      const b = img[(y + 1) * w + x]!;
      const l = img[y * w + (x - 1)]!;
      const r = img[y * w + (x + 1)]!;
      const v = 4 * c - t - b - l - r;
      sum += v;
      sumSq += v * v;
    }
  }
  const mean = sum / inner;
  return sumSq / inner - mean * mean;
}
