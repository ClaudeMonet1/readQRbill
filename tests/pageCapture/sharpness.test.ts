import { describe, it, expect } from 'vitest';
import { laplacianVariance, SHARPNESS_THRESHOLD } from '../../src/pageCapture/sharpness';

const W = 200;
const H = 200;

const solidGray = (): Uint8ClampedArray => {
  const a = new Uint8ClampedArray(W * H);
  a.fill(128);
  return a;
};

const checkerboard = (): Uint8ClampedArray => {
  const a = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      a[y * W + x] = (x + y) % 2 === 0 ? 0 : 255;
    }
  }
  return a;
};

describe('laplacianVariance', () => {
  it('returns 0 for a uniform image (no edges)', () => {
    expect(laplacianVariance(solidGray(), W, H)).toBe(0);
  });

  it('returns a high value for a high-frequency checkerboard', () => {
    const v = laplacianVariance(checkerboard(), W, H);
    expect(v).toBeGreaterThan(10000);
  });

  it('checkerboard is well above threshold; solid gray is below', () => {
    expect(laplacianVariance(checkerboard(), W, H)).toBeGreaterThan(SHARPNESS_THRESHOLD);
    expect(laplacianVariance(solidGray(), W, H)).toBeLessThan(SHARPNESS_THRESHOLD);
  });

  it('exposes a SHARPNESS_THRESHOLD constant', () => {
    expect(typeof SHARPNESS_THRESHOLD).toBe('number');
    expect(SHARPNESS_THRESHOLD).toBeGreaterThan(0);
  });
});
