import { describe, it, expect } from 'vitest';
import { frameDifference, STABILITY_THRESHOLD } from '../../src/pageCapture/stability';

const buf = (n: number, fill = 0): Uint8ClampedArray => {
  const a = new Uint8ClampedArray(n);
  a.fill(fill);
  return a;
};

describe('frameDifference', () => {
  it('returns 0 for identical buffers', () => {
    const a = buf(1024, 128);
    const b = buf(1024, 128);
    expect(frameDifference(a, b)).toBe(0);
  });

  it('returns 255 for all-0 vs all-255', () => {
    expect(frameDifference(buf(1024, 0), buf(1024, 255))).toBe(255);
  });

  it('returns mean abs diff for partial differences', () => {
    // half pixels differ by 10, half by 0 → mean = 5
    const a = buf(1024, 100);
    const b = buf(1024, 100);
    for (let i = 0; i < 512; i++) b[i] = 110;
    expect(frameDifference(a, b)).toBe(5);
  });

  it('exposes a STABILITY_THRESHOLD constant', () => {
    expect(typeof STABILITY_THRESHOLD).toBe('number');
    expect(STABILITY_THRESHOLD).toBeGreaterThan(0);
    expect(STABILITY_THRESHOLD).toBeLessThan(50);
  });
});
