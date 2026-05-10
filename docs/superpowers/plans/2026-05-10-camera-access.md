# Camera Access (Step 1 — Page Capture) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Step 1 of the QR-bill scanner: a mountable page-capture screen that opens the camera over HTTPS, runs stability + sharpness detection on each frame, auto-captures a full-resolution JPEG when both pass for 500 ms, and exposes a `Blob` via callback.

**Architecture:** Functional modules in `src/pageCapture/`. Pure leaves (stability, sharpness, state machine) are unit-tested with Vitest using fixture buffers. I/O surface (camera, capture loop, snapshot, UI) is manually tested in a real browser. A single public `mount(rootEl, { onCapture })` factory owns the screen and returns a cleanup handle.

**Tech Stack:** TypeScript, Vite 8, Vitest 4. Browser APIs only — no runtime npm deps in this plan.

**Spec:** `docs/superpowers/specs/2026-05-10-camera-access-design.md` — read it first if anything below is unclear.

---

## File Structure

Created in this plan:

```
src/
├── main.ts                           # MODIFIED: replace hello banner with mount() call
└── pageCapture/
    ├── index.ts                      # public API: mount(rootEl, { onCapture }) → cleanup
    ├── camera.ts                     # startCamera() → { video, stream, stop }
    ├── frameSampler.ts               # downscaleToGrayscale(video, w, h) → Uint8ClampedArray
    ├── stability.ts                  # PURE: frameDifference(prev, curr) → number
    ├── sharpness.ts                  # PURE: laplacianVariance(img, w, h) → number
    ├── stateMachine.ts               # PURE: transition(state, event) → state, plus types
    ├── captureLoop.ts                # runCaptureLoop({ video, onState, onCapture }) → stop()
    ├── snapshot.ts                   # captureFullFrame(video) → Promise<Blob>
    └── ui/
        ├── render.ts                 # render(rootEl) → handles + injects <style>
        ├── overlay.ts                # SVG A4 guide + setVariant(state)
        └── feedback.ts               # flash(rootEl), vibrate()
tests/
└── pageCapture/
    ├── stability.test.ts
    ├── sharpness.test.ts
    └── stateMachine.test.ts
```

---

## Task 1: stability.ts (pure)

**Files:**
- Create: `src/pageCapture/stability.ts`
- Test: `tests/pageCapture/stability.test.ts`

- [ ] **Step 1: Write the failing test**

Path: `/home/llm/readQRbill/tests/pageCapture/stability.test.ts`

```ts
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
```

- [ ] **Step 2: Run test, verify fail**

Run: `cd /home/llm/readQRbill && npm test -- stability`
Expected: FAIL with module-not-found error for `src/pageCapture/stability`.

- [ ] **Step 3: Write minimal implementation**

Path: `/home/llm/readQRbill/src/pageCapture/stability.ts`

```ts
export const STABILITY_THRESHOLD = 4;

export function frameDifference(
  prev: Uint8ClampedArray,
  curr: Uint8ClampedArray,
): number {
  if (prev.length !== curr.length) {
    throw new Error(`buffer length mismatch: ${prev.length} vs ${curr.length}`);
  }
  let sum = 0;
  for (let i = 0; i < curr.length; i++) {
    sum += Math.abs(curr[i]! - prev[i]!);
  }
  return sum / curr.length;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd /home/llm/readQRbill && npm test -- stability`
Expected: 4 passed.

- [ ] **Step 5: Typecheck**

Run: `cd /home/llm/readQRbill && npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd /home/llm/readQRbill
git add src/pageCapture/stability.ts tests/pageCapture/stability.test.ts
git commit -m "feat(pageCapture): add stability detector (pure)"
```

---

## Task 2: sharpness.ts (pure)

**Files:**
- Create: `src/pageCapture/sharpness.ts`
- Test: `tests/pageCapture/sharpness.test.ts`

- [ ] **Step 1: Write the failing test**

Path: `/home/llm/readQRbill/tests/pageCapture/sharpness.test.ts`

```ts
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
```

- [ ] **Step 2: Run, verify fail**

Run: `cd /home/llm/readQRbill && npm test -- sharpness`
Expected: FAIL (module not found).

- [ ] **Step 3: Write implementation**

Path: `/home/llm/readQRbill/src/pageCapture/sharpness.ts`

```ts
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
```

- [ ] **Step 4: Run, verify pass**

Run: `cd /home/llm/readQRbill && npm test -- sharpness`
Expected: 4 passed.

- [ ] **Step 5: Typecheck**

Run: `cd /home/llm/readQRbill && npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd /home/llm/readQRbill
git add src/pageCapture/sharpness.ts tests/pageCapture/sharpness.test.ts
git commit -m "feat(pageCapture): add sharpness detector (pure)"
```

---

## Task 3: stateMachine.ts (pure)

**Files:**
- Create: `src/pageCapture/stateMachine.ts`
- Test: `tests/pageCapture/stateMachine.test.ts`

- [ ] **Step 1: Write the failing test**

Path: `/home/llm/readQRbill/tests/pageCapture/stateMachine.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  type State,
  type Event,
  transition,
  ARM_DURATION_MS,
} from '../../src/pageCapture/stateMachine';

const frame = (stable: boolean, sharp: boolean, timestamp = 0): Event => ({
  kind: 'frame',
  stable,
  sharp,
  timestamp,
});

describe('transition', () => {
  it('idle + frame → looking', () => {
    expect(transition({ kind: 'idle' }, frame(true, true, 100)))
      .toEqual({ kind: 'looking' });
  });

  it('looking + frame{!stable || !sharp} stays in looking', () => {
    const s: State = { kind: 'looking' };
    expect(transition(s, frame(false, false, 100))).toEqual({ kind: 'looking' });
    expect(transition(s, frame(true, false, 100))).toEqual({ kind: 'looking' });
    expect(transition(s, frame(false, true, 100))).toEqual({ kind: 'looking' });
  });

  it('looking + frame{stable && sharp} → arming with armedSince', () => {
    const s: State = { kind: 'looking' };
    expect(transition(s, frame(true, true, 1234)))
      .toEqual({ kind: 'arming', armedSince: 1234 });
  });

  it('arming + bad frame → looking (resets)', () => {
    const s: State = { kind: 'arming', armedSince: 100 };
    expect(transition(s, frame(false, true, 200))).toEqual({ kind: 'looking' });
    expect(transition(s, frame(true, false, 200))).toEqual({ kind: 'looking' });
  });

  it('arming + good frame, dt < 500 → still arming, same armedSince', () => {
    const s: State = { kind: 'arming', armedSince: 100 };
    expect(transition(s, frame(true, true, 100 + ARM_DURATION_MS - 1)))
      .toEqual({ kind: 'arming', armedSince: 100 });
  });

  it('arming + good frame, dt ≥ 500 → captured', () => {
    const s: State = { kind: 'arming', armedSince: 100 };
    expect(transition(s, frame(true, true, 100 + ARM_DURATION_MS)))
      .toEqual({ kind: 'captured' });
  });

  it('looking + manual_capture → captured', () => {
    expect(transition({ kind: 'looking' }, { kind: 'manual_capture', timestamp: 0 }))
      .toEqual({ kind: 'captured' });
  });

  it('arming + manual_capture → captured', () => {
    expect(transition({ kind: 'arming', armedSince: 100 }, { kind: 'manual_capture', timestamp: 200 }))
      .toEqual({ kind: 'captured' });
  });

  it('captured + frame stays captured', () => {
    expect(transition({ kind: 'captured' }, frame(true, true, 999)))
      .toEqual({ kind: 'captured' });
  });

  it('any + reset → looking', () => {
    expect(transition({ kind: 'idle' }, { kind: 'reset' })).toEqual({ kind: 'looking' });
    expect(transition({ kind: 'arming', armedSince: 1 }, { kind: 'reset' })).toEqual({ kind: 'looking' });
    expect(transition({ kind: 'captured' }, { kind: 'reset' })).toEqual({ kind: 'looking' });
  });

  it('idle + manual_capture → captured (manual works even before frames)', () => {
    expect(transition({ kind: 'idle' }, { kind: 'manual_capture', timestamp: 0 }))
      .toEqual({ kind: 'captured' });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd /home/llm/readQRbill && npm test -- stateMachine`
Expected: FAIL.

- [ ] **Step 3: Write implementation**

Path: `/home/llm/readQRbill/src/pageCapture/stateMachine.ts`

```ts
export type State =
  | { kind: 'idle' }
  | { kind: 'looking' }
  | { kind: 'arming'; armedSince: number }
  | { kind: 'captured' };

export type Event =
  | { kind: 'frame'; stable: boolean; sharp: boolean; timestamp: number }
  | { kind: 'manual_capture'; timestamp: number }
  | { kind: 'reset' };

export const ARM_DURATION_MS = 500;

export function transition(state: State, event: Event): State {
  if (event.kind === 'reset') return { kind: 'looking' };
  if (event.kind === 'manual_capture') return { kind: 'captured' };

  // event.kind === 'frame'
  if (state.kind === 'captured') return state;

  const good = event.stable && event.sharp;

  if (state.kind === 'idle') return { kind: 'looking' };

  if (state.kind === 'looking') {
    return good ? { kind: 'arming', armedSince: event.timestamp } : state;
  }

  // state.kind === 'arming'
  if (!good) return { kind: 'looking' };
  if (event.timestamp - state.armedSince >= ARM_DURATION_MS) {
    return { kind: 'captured' };
  }
  return state;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd /home/llm/readQRbill && npm test -- stateMachine`
Expected: 11 passed.

- [ ] **Step 5: Run all tests**

Run: `cd /home/llm/readQRbill && npm test`
Expected: total ~21 passed (smoke + 4 stability + 4 sharpness + 11 stateMachine + 2 from setup).

- [ ] **Step 6: Typecheck**

Run: `cd /home/llm/readQRbill && npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd /home/llm/readQRbill
git add src/pageCapture/stateMachine.ts tests/pageCapture/stateMachine.test.ts
git commit -m "feat(pageCapture): add capture state machine (pure)"
```

---

## Task 4: frameSampler.ts

**Files:**
- Create: `src/pageCapture/frameSampler.ts`

No unit test — depends on `<canvas>` and `HTMLVideoElement`. Validated manually in the browser later.

- [ ] **Step 1: Write the file**

Path: `/home/llm/readQRbill/src/pageCapture/frameSampler.ts`

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `cd /home/llm/readQRbill && npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /home/llm/readQRbill
git add src/pageCapture/frameSampler.ts
git commit -m "feat(pageCapture): add frame sampler (downscale + grayscale)"
```

---

## Task 5: camera.ts

**Files:**
- Create: `src/pageCapture/camera.ts`

- [ ] **Step 1: Write the file**

Path: `/home/llm/readQRbill/src/pageCapture/camera.ts`

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `cd /home/llm/readQRbill && npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /home/llm/readQRbill
git add src/pageCapture/camera.ts
git commit -m "feat(pageCapture): add camera bootstrap with constraint fallback"
```

---

## Task 6: snapshot.ts

**Files:**
- Create: `src/pageCapture/snapshot.ts`

- [ ] **Step 1: Write the file**

Path: `/home/llm/readQRbill/src/pageCapture/snapshot.ts`

```ts
export async function captureFullFrame(video: HTMLVideoElement): Promise<Blob> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error('video has no dimensions yet');

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(video, 0, 0, w, h);

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
```

- [ ] **Step 2: Typecheck**

Run: `cd /home/llm/readQRbill && npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /home/llm/readQRbill
git add src/pageCapture/snapshot.ts
git commit -m "feat(pageCapture): add full-resolution JPEG snapshot"
```

---

## Task 7: ui/feedback.ts

**Files:**
- Create: `src/pageCapture/ui/feedback.ts`

- [ ] **Step 1: Write the file**

Path: `/home/llm/readQRbill/src/pageCapture/ui/feedback.ts`

```ts
export function vibrate(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(100);
  }
}

export function flash(rootEl: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'pc-flash';
  rootEl.appendChild(overlay);
  // Force reflow so the transition runs
  void overlay.offsetWidth;
  overlay.style.opacity = '0';
  setTimeout(() => overlay.remove(), 250);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /home/llm/readQRbill && npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /home/llm/readQRbill
git add src/pageCapture/ui/feedback.ts
git commit -m "feat(pageCapture/ui): add flash + vibrate feedback"
```

---

## Task 8: ui/overlay.ts

**Files:**
- Create: `src/pageCapture/ui/overlay.ts`

- [ ] **Step 1: Write the file**

Path: `/home/llm/readQRbill/src/pageCapture/ui/overlay.ts`

```ts
import type { State } from '../stateMachine';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface OverlayHandle {
  element: SVGSVGElement;
  setVariant: (state: State['kind']) => void;
}

export function createOverlay(): OverlayHandle {
  // viewBox uses A4 ratio: 100 wide, 141.4 tall, then we wrap it to fit.
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'pc-overlay pc-overlay--idle');
  svg.setAttribute('viewBox', '0 0 100 141.4');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', '2');
  rect.setAttribute('y', '2');
  rect.setAttribute('width', '96');
  rect.setAttribute('height', '137.4');
  rect.setAttribute('rx', '2');
  rect.setAttribute('class', 'pc-overlay__rect');
  svg.appendChild(rect);

  const setVariant = (kind: State['kind']) => {
    svg.setAttribute('class', `pc-overlay pc-overlay--${kind}`);
  };

  return { element: svg, setVariant };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /home/llm/readQRbill && npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /home/llm/readQRbill
git add src/pageCapture/ui/overlay.ts
git commit -m "feat(pageCapture/ui): add SVG A4 guide overlay"
```

---

## Task 9: ui/render.ts

**Files:**
- Create: `src/pageCapture/ui/render.ts`

This file owns the layout, the inline `<style>` block, and returns DOM handles for `index.ts` to wire up.

- [ ] **Step 1: Write the file**

Path: `/home/llm/readQRbill/src/pageCapture/ui/render.ts`

```ts
import { createOverlay, type OverlayHandle } from './overlay';

const STYLE_ID = 'pc-styles';

const STYLES = `
:root { color-scheme: dark; }
html, body { margin: 0; padding: 0; height: 100%; background: #000; color: #eee; font-family: system-ui, -apple-system, sans-serif; }
.pc-root { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.pc-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #000; }
.pc-overlay { position: absolute; width: 80vmin; max-width: 80vw; max-height: 80vh; height: auto; pointer-events: none; }
.pc-overlay__rect { fill: none; stroke-width: 1; stroke-dasharray: 3 2; }
.pc-overlay--idle .pc-overlay__rect,
.pc-overlay--looking .pc-overlay__rect { stroke: #d33; }
.pc-overlay--arming .pc-overlay__rect { stroke: #f80; stroke-dasharray: none; }
.pc-overlay--captured .pc-overlay__rect { stroke: #2c8; stroke-dasharray: none; }
.pc-overlay--error .pc-overlay__rect { stroke: #d33; }
.pc-status { position: absolute; bottom: 96px; left: 0; right: 0; text-align: center; font-size: 16px; padding: 8px 16px; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
.pc-button { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 14px 32px; min-width: 160px; min-height: 48px; font-size: 16px; border: 1px solid #888; border-radius: 24px; background: rgba(0,0,0,0.6); color: #fff; cursor: pointer; }
.pc-button:disabled { opacity: 0.4; cursor: default; }
.pc-flash { position: absolute; inset: 0; background: #fff; opacity: 1; transition: opacity 200ms ease-out; pointer-events: none; }
.pc-error { position: absolute; left: 24px; right: 24px; top: 50%; transform: translateY(-50%); text-align: center; font-size: 18px; }
.pc-preview { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000; gap: 16px; }
.pc-preview img { max-width: 90vw; max-height: 70vh; object-fit: contain; }
`;

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

export interface RenderHandles {
  root: HTMLElement;
  videoSlot: HTMLDivElement;
  overlay: OverlayHandle;
  statusEl: HTMLDivElement;
  manualBtn: HTMLButtonElement;
}

export function render(rootEl: HTMLElement): RenderHandles {
  ensureStyles();
  rootEl.innerHTML = '';
  rootEl.classList.add('pc-root');

  const videoSlot = document.createElement('div');
  videoSlot.className = 'pc-video-slot';
  videoSlot.style.position = 'absolute';
  videoSlot.style.inset = '0';
  rootEl.appendChild(videoSlot);

  const overlay = createOverlay();
  rootEl.appendChild(overlay.element);

  const statusEl = document.createElement('div');
  statusEl.className = 'pc-status';
  rootEl.appendChild(statusEl);

  const manualBtn = document.createElement('button');
  manualBtn.className = 'pc-button';
  manualBtn.type = 'button';
  manualBtn.textContent = 'Capturer';
  rootEl.appendChild(manualBtn);

  return { root: rootEl, videoSlot, overlay, statusEl, manualBtn };
}

export function attachVideo(handles: RenderHandles, video: HTMLVideoElement): void {
  video.classList.add('pc-video');
  handles.videoSlot.appendChild(video);
}

export function showError(handles: RenderHandles, message: string): void {
  handles.root.innerHTML = '';
  ensureStyles();
  const err = document.createElement('div');
  err.className = 'pc-error';
  err.textContent = message;
  handles.root.appendChild(err);
}

export function showPreview(
  handles: RenderHandles,
  blob: Blob,
  onRetry: () => void,
): void {
  handles.root.innerHTML = '';
  ensureStyles();

  const preview = document.createElement('div');
  preview.className = 'pc-preview';

  const img = document.createElement('img');
  img.src = URL.createObjectURL(blob);
  img.alt = 'Photo capturée';
  img.addEventListener('load', () => URL.revokeObjectURL(img.src), { once: true });
  preview.appendChild(img);

  const status = document.createElement('div');
  status.textContent = '✓ Photo prise';
  preview.appendChild(status);

  const btn = document.createElement('button');
  btn.className = 'pc-button';
  btn.style.position = 'static';
  btn.style.transform = 'none';
  btn.type = 'button';
  btn.textContent = 'Recommencer';
  btn.addEventListener('click', onRetry);
  preview.appendChild(btn);

  handles.root.appendChild(preview);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /home/llm/readQRbill && npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /home/llm/readQRbill
git add src/pageCapture/ui/render.ts
git commit -m "feat(pageCapture/ui): add layout, styles, error + preview screens"
```

---

## Task 10: captureLoop.ts

**Files:**
- Create: `src/pageCapture/captureLoop.ts`

- [ ] **Step 1: Write the file**

Path: `/home/llm/readQRbill/src/pageCapture/captureLoop.ts`

```ts
import { downscaleToGrayscale } from './frameSampler';
import { frameDifference, STABILITY_THRESHOLD } from './stability';
import { laplacianVariance, SHARPNESS_THRESHOLD } from './sharpness';
import { transition, type Event, type State } from './stateMachine';
import { captureFullFrame } from './snapshot';

export interface CaptureLoopOpts {
  video: HTMLVideoElement;
  onState: (state: State) => void;
  onCapture: (blob: Blob) => void;
  onError?: (err: Error) => void;
}

const FRAME_INTERVAL_MS = 66; // ~15 FPS
const STAB_W = 32;
const STAB_H = 32;
const SHARP_W = 200;
const SHARP_H = 200;

export interface CaptureLoopHandle {
  stop: () => void;
  dispatch: (event: Event) => void;
}

export function runCaptureLoop(opts: CaptureLoopOpts): CaptureLoopHandle {
  let state: State = { kind: 'idle' };
  let prevStability: Uint8ClampedArray | null = null;
  let stopped = false;
  let captureInFlight = false;

  const apply = (event: Event): void => {
    const next = transition(state, event);
    if (next !== state) {
      state = next;
      opts.onState(state);
      if (state.kind === 'captured' && !captureInFlight) {
        captureInFlight = true;
        captureFullFrame(opts.video)
          .then((blob) => opts.onCapture(blob))
          .catch((err: unknown) => opts.onError?.(err instanceof Error ? err : new Error(String(err))));
      }
    }
  };

  const tick = (): void => {
    if (stopped) return;
    if (state.kind === 'captured') return;
    try {
      const stab = downscaleToGrayscale(opts.video, STAB_W, STAB_H);
      const sharpBuf = downscaleToGrayscale(opts.video, SHARP_W, SHARP_H);
      const stable =
        prevStability !== null &&
        frameDifference(prevStability, stab) < STABILITY_THRESHOLD;
      const sharp = laplacianVariance(sharpBuf, SHARP_W, SHARP_H) >= SHARPNESS_THRESHOLD;
      prevStability = stab;
      apply({ kind: 'frame', stable, sharp, timestamp: performance.now() });
    } catch (err) {
      opts.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const intervalId = window.setInterval(tick, FRAME_INTERVAL_MS);

  // Emit initial state
  opts.onState(state);

  return {
    stop: () => {
      stopped = true;
      window.clearInterval(intervalId);
    },
    dispatch: apply,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /home/llm/readQRbill && npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /home/llm/readQRbill
git add src/pageCapture/captureLoop.ts
git commit -m "feat(pageCapture): add capture loop wiring detectors + state machine"
```

---

## Task 11: pageCapture/index.ts (public API)

**Files:**
- Create: `src/pageCapture/index.ts`

- [ ] **Step 1: Write the file**

Path: `/home/llm/readQRbill/src/pageCapture/index.ts`

```ts
import { startCamera, type CameraHandle } from './camera';
import { runCaptureLoop, type CaptureLoopHandle } from './captureLoop';
import { render, attachVideo, showError, showPreview, type RenderHandles } from './ui/render';
import { flash, vibrate } from './ui/feedback';
import type { State } from './stateMachine';

export interface MountOptions {
  onCapture: (blob: Blob) => void;
}

const STATUS_TEXT: Record<State['kind'], string> = {
  idle: '',
  looking: 'Ajustez le cadrage',
  arming: 'Stabilisez...',
  captured: '✓ Photo prise',
};

const ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError: 'Permissions caméra refusées. Autorisez-les dans les paramètres du navigateur.',
  NotFoundError: 'Aucune caméra détectée.',
  NotReadableError: 'Caméra utilisée par une autre application.',
  NotSupportedError: 'Caméra non disponible sur ce navigateur.',
};

function errorMessageFor(err: unknown): string {
  if (err instanceof DOMException && ERROR_MESSAGES[err.name]) {
    return ERROR_MESSAGES[err.name]!;
  }
  return 'Erreur caméra inattendue. Réessayer ?';
}

export function mount(rootEl: HTMLElement, opts: MountOptions): () => void {
  let handles: RenderHandles;
  let camera: CameraHandle | null = null;
  let loop: CaptureLoopHandle | null = null;
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    loop?.stop();
    camera?.stop();
    rootEl.innerHTML = '';
    rootEl.classList.remove('pc-root');
  };

  const handleCapture = (blob: Blob) => {
    flash(handles.root);
    vibrate();
    opts.onCapture(blob);
    showPreview(handles, blob, () => {
      // Restart from scratch
      cleanup();
      cleaned = false;
      void start();
    });
  };

  const start = async (): Promise<void> => {
    handles = render(rootEl);
    handles.statusEl.textContent = '';

    try {
      camera = await startCamera();
    } catch (err) {
      showError(handles, errorMessageFor(err));
      return;
    }

    attachVideo(handles, camera.video);

    loop = runCaptureLoop({
      video: camera.video,
      onState: (state) => {
        handles.overlay.setVariant(state.kind);
        handles.statusEl.textContent = STATUS_TEXT[state.kind];
      },
      onCapture: handleCapture,
      onError: (err) => showError(handles, errorMessageFor(err)),
    });

    handles.manualBtn.addEventListener('click', () => {
      loop?.dispatch({ kind: 'manual_capture', timestamp: performance.now() });
    });
  };

  void start();

  return cleanup;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /home/llm/readQRbill && npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /home/llm/readQRbill
git add src/pageCapture/index.ts
git commit -m "feat(pageCapture): add public mount() API"
```

---

## Task 12: Wire main.ts

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace main.ts content**

Path: `/home/llm/readQRbill/src/main.ts`

```ts
import { mount } from './pageCapture';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Missing #app root element');
}

mount(root, {
  onCapture: (blob) => {
    // Step 2 (QR scan) will pick this up in a later plan.
    console.log('[pageCapture] captured', blob.size, 'bytes,', blob.type);
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd /home/llm/readQRbill && npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Run all tests**

Run: `cd /home/llm/readQRbill && npm test`
Expected: all green (~21 tests).

- [ ] **Step 4: Commit**

```bash
cd /home/llm/readQRbill
git add src/main.ts
git commit -m "feat: wire pageCapture as the app entry"
```

---

## Task 13: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `cd /home/llm/readQRbill && npm run dev > /tmp/vite-dev.log 2>&1 &`
Wait until: `curl -k -sS -o /dev/null -w "%{http_code}\n" https://localhost:5173/` returns `200`.

- [ ] **Step 2: Open in a browser and check the golden path**

Open `https://localhost:5173/` (accept the self-signed cert warning).

Verify:
1. Browser prompts for camera permission. Allow.
2. Live video appears, A4 guide overlay visible centered.
3. Move the camera around — overlay shows red, status reads "Ajustez le cadrage".
4. Hold a piece of A4-shaped paper or a printed page in view, hold still.
5. Within ~2 seconds: overlay turns orange ("Stabilisez..."), then a flash, then preview screen with the captured image and a Recommencer button.
6. DevTools console shows `[pageCapture] captured <N> bytes, image/jpeg`.
7. Click **Recommencer** — capture loop restarts.

- [ ] **Step 3: Check the manual capture button**

In a fresh page load, before auto-capture fires, click **Capturer**. Verify capture happens immediately and preview appears.

- [ ] **Step 4: Check the permission-denied path**

Reload, this time **deny** the camera prompt. Verify the screen shows: "Permissions caméra refusées. Autorisez-les dans les paramètres du navigateur."

- [ ] **Step 5: Stop the dev server**

Run: `pkill -f vite || true`

- [ ] **Step 6: Tune thresholds if needed**

If auto-capture never fires under realistic conditions, or fires under blurry/moving conditions, adjust constants:
- `STABILITY_THRESHOLD` in `src/pageCapture/stability.ts` (lower = stricter; default 4)
- `SHARPNESS_THRESHOLD` in `src/pageCapture/sharpness.ts` (higher = stricter; default 80)

If you tune them, update the corresponding test (`it('exposes a STABILITY_THRESHOLD constant'…)` is bounded but accommodates a wide range; the relative-magnitude tests in sharpness.test.ts should still pass because the synthetic checkerboard is far above any reasonable threshold).

Re-run: `npm test` and re-verify in the browser.

- [ ] **Step 7: Commit any threshold tuning (or empty marker if none)**

If thresholds were changed:
```bash
cd /home/llm/readQRbill
git add src/pageCapture/stability.ts src/pageCapture/sharpness.ts
git commit -m "tune(pageCapture): calibrate detection thresholds from manual QA"
```

If unchanged:
```bash
cd /home/llm/readQRbill
git commit --allow-empty -m "chore: manual browser QA passed for pageCapture"
```

---

## Task 14: Bundle size check

**Files:** none (verification only)

- [ ] **Step 1: Build production bundle**

Run: `cd /home/llm/readQRbill && npm run build`
Expected: build succeeds. Vite prints sizes.

- [ ] **Step 2: Read sizes**

Run: `cd /home/llm/readQRbill && du -b dist/assets/*.js | grep -v '\.map$' | awk '{s+=$1} END {print s, "bytes total JS"}'`
Expected: a number well under 250000 bytes (the roadmap's 250 KB total budget).

For the camera-only milestone with no `jsQR`/`swissqrbill` yet, expect roughly 4–10 KB total JS.

- [ ] **Step 3: Empty marker commit**

```bash
cd /home/llm/readQRbill
git commit --allow-empty -m "chore: bundle size after pageCapture: <RECORDED_BYTES> bytes JS"
```

Replace `<RECORDED_BYTES>` with the value from step 2.

---

## Final Verification Checklist

Run from `/home/llm/readQRbill`. All must pass:

- [ ] `npm run typecheck` → exit 0
- [ ] `npm test` → ~21 passed (smoke + 19 from this plan)
- [ ] `npm run build` → succeeds; bundle JS under 250 KB
- [ ] `git status` → clean (no uncommitted changes besides untracked roadmap.md)
- [ ] `git log --oneline | head -16` → ~14 commits added by this plan, descriptive messages

---

## Out of Scope (next plans)

- Step 2: QR-bill scan, decode, validation
- Adding `jsQR` and `swissqrbill` runtime deps
- Cross-screen navigation (Step 1 → Step 2)
- Audio capture-confirmation sound
- Torch / flash via `MediaTrackConstraints.torch`
- Resolution enforcement (e.g., reject < 1280×1800)
- Perspective correction, OCR, manual entry — all explicitly out of v1 per roadmap
