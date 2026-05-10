import { describe, it, expect } from 'vitest';
import { computeCropRect } from '../../src/pageCapture/cropRegion';

const video = (
  videoWidth: number,
  videoHeight: number,
  rect: { left: number; top: number; width: number; height: number },
) => ({ videoWidth, videoHeight, rect });

const r = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height });

describe('computeCropRect', () => {
  it('aspect-matched video, overlay centered → simple scaling', () => {
    // Video native 1000x500, displayed at 200x100 (same aspect).
    // Overlay at 50,25 with size 100x50 (centered, half width/height).
    const result = computeCropRect(
      video(1000, 500, r(0, 0, 200, 100)),
      r(50, 25, 100, 50),
    );
    expect(result).toEqual({ sx: 250, sy: 125, sw: 500, sh: 250 });
  });

  it('letterboxed (video wider than display): horizontal bars', () => {
    // Video native 1000x250 (4:1), display 200x100 (2:1).
    // After object-fit:contain → content 200x50, vertically centered (top=25).
    // Overlay covering full display → crop intersects only content area.
    const result = computeCropRect(
      video(1000, 250, r(0, 0, 200, 100)),
      r(0, 0, 200, 100),
    );
    // Content is at top=25, height=50. Overlay clips to content vertically.
    // Mapped to video coords: full width (1000), height (250).
    expect(result).toEqual({ sx: 0, sy: 0, sw: 1000, sh: 250 });
  });

  it('pillar-boxed (video taller than display): vertical bars', () => {
    // Video native 250x1000 (1:4), display 100x200 (1:2).
    // Content fits height: 200, width = 200 * (250/1000) = 50, horizontally centered (left=25).
    // Overlay covering full display → crop clips horizontally to content.
    const result = computeCropRect(
      video(250, 1000, r(0, 0, 100, 200)),
      r(0, 0, 100, 200),
    );
    // Mapped to video coords: full height (1000), full width (250).
    expect(result).toEqual({ sx: 0, sy: 0, sw: 250, sh: 1000 });
  });

  it('overlay inside content: maps proportionally', () => {
    // Video 2000x1000 displayed at 400x200 (same aspect, no letterbox).
    // Overlay at 100,50 with size 200x100 → 25%..75% of each axis.
    const result = computeCropRect(
      video(2000, 1000, r(0, 0, 400, 200)),
      r(100, 50, 200, 100),
    );
    expect(result).toEqual({ sx: 500, sy: 250, sw: 1000, sh: 500 });
  });

  it('overlay partially outside content: clips to content', () => {
    // Video 1000x500 at 200x100, overlay extends past right edge.
    // Overlay at 100,0, size 200x100 → right edge 300, video right edge 200.
    const result = computeCropRect(
      video(1000, 500, r(0, 0, 200, 100)),
      r(100, 0, 200, 100),
    );
    // Visible part: x=100..200 (width 100), full height.
    // Mapped: sx=500, sw=500, sy=0, sh=500.
    expect(result).toEqual({ sx: 500, sy: 0, sw: 500, sh: 500 });
  });

  it('overlay completely outside content → null', () => {
    const result = computeCropRect(
      video(1000, 500, r(0, 0, 200, 100)),
      r(300, 0, 50, 50),
    );
    expect(result).toBeNull();
  });

  it('zero-area video (metadata not loaded) → null', () => {
    expect(computeCropRect(video(0, 0, r(0, 0, 200, 100)), r(0, 0, 100, 50))).toBeNull();
  });

  it('video with non-zero offset rect (not at viewport origin)', () => {
    // Video element positioned at 50,30 in viewport.
    // Native 1000x500, displayed 200x100 at offset 50,30. Overlay at 100,55 size 100x50.
    // Overlay relative to video display: 50,25 to 150,75 → maps to 250,125 to 750,375 in camera coords.
    const result = computeCropRect(
      video(1000, 500, r(50, 30, 200, 100)),
      r(100, 55, 100, 50),
    );
    expect(result).toEqual({ sx: 250, sy: 125, sw: 500, sh: 250 });
  });
});
