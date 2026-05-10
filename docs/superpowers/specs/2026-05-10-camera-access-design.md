# Camera Access — Step 1 (Page Capture) Design

**Date:** 2026-05-10
**Scope:** Roadmap section 2.1 ("Étape 1 — Capture de la page complète") and section 3.5 detection algorithms.
**Out of scope:** QR scanning (Step 2), `jsQR`, `swissqrbill` parsing, multi-screen navigation.

## 1. Goal

Produce a working "Step 1" page-capture screen: open camera over HTTPS, show live video, detect stability + sharpness, auto-trigger a full-resolution JPEG snapshot when both pass for ~500 ms. Fall back to a manual capture button. Emit the resulting `Blob` to the host caller.

The output of this plan is a single mountable component `mount(rootEl, { onCapture })` that fully owns the screen for now (no router, no Step 2 transition yet — that comes in the next plan).

## 2. Architectural choice

**Functional modules** (chosen over class-based or single-file):
- Pure-logic files (detectors, state machine) export plain functions taking and returning plain data.
- I/O files (camera, capture loop, snapshot, UI) export factory functions that return `cleanup()` handles.
- No classes, no inheritance, no DI container — closures hold state.

This maps cleanly to the test strategy: pure files get Vitest unit tests with fixture `ImageData`; I/O files are exercised manually in a real browser.

## 3. File structure

```
src/
├── main.ts                       # entry; calls mount(document.getElementById('app'), { onCapture })
├── pageCapture/
│   ├── index.ts                  # public API: mount(rootEl, opts) → cleanup
│   ├── camera.ts                 # startCamera(constraints) → { video, stream, stop() }
│   ├── frameSampler.ts           # downscaleToGrayscale(video, w, h) → Uint8ClampedArray
│   ├── stability.ts              # frameDifference(prev, curr) → number      (PURE)
│   ├── sharpness.ts              # laplacianVariance(img, w, h) → number     (PURE)
│   ├── stateMachine.ts           # transition(state, event) → state          (PURE)
│   ├── captureLoop.ts            # runCaptureLoop({ video, onState, onCapture }) → stop()
│   ├── snapshot.ts               # captureFullFrame(video) → Promise<Blob>
│   └── ui/
│       ├── render.ts             # render(rootEl) → { video, overlay, statusEl, manualBtn }
│       ├── overlay.ts            # SVG A4-proportioned guide; setVariant(state)
│       └── feedback.ts           # flash(rootEl), vibrate()
└── version.ts                    # existing

tests/
└── pageCapture/
    ├── stability.test.ts
    ├── sharpness.test.ts
    └── stateMachine.test.ts
```

## 4. Detection algorithms (per roadmap §3.5)

### 4.1 Stability

```ts
// stability.ts — pure
export function frameDifference(
  prev: Uint8ClampedArray,
  curr: Uint8ClampedArray
): number {
  // Both inputs are 32×32 grayscale buffers (1024 bytes each).
  // Returns mean absolute difference, 0..255.
  let sum = 0;
  for (let i = 0; i < curr.length; i++) sum += Math.abs(curr[i]! - prev[i]!);
  return sum / curr.length;
}
```

**Threshold:** `STABILITY_THRESHOLD = 4` (mean abs diff in 0..255). Frames with `frameDifference < 4` are "stable enough". Calibrated against fixture pairs in tests; may need tuning during manual QA.

### 4.2 Sharpness

```ts
// sharpness.ts — pure
export function laplacianVariance(
  img: Uint8ClampedArray,  // grayscale, w*h bytes
  w: number,
  h: number
): number {
  // 3×3 Laplacian kernel: [0,-1,0; -1,4,-1; 0,-1,0]
  // Compute response at each interior pixel, then return variance.
  // Skip 1-pixel border.
  // Returns variance value (unbounded; higher = sharper).
}
```

**Input size:** 200×200 grayscale (40,000 bytes).
**Threshold:** `SHARPNESS_THRESHOLD = 80`. Frames with variance ≥ 80 are "sharp enough". Empirical; tune in manual QA.

### 4.3 Sampling

```ts
// frameSampler.ts
export function downscaleToGrayscale(
  video: HTMLVideoElement,
  targetW: number,
  targetH: number
): Uint8ClampedArray {
  // Reuses two hidden <canvas> elements (32×32 and 200×200) cached at module level.
  // (Not OffscreenCanvas: iOS Safari 14, which the roadmap requires, does not support it.)
  // drawImage(video, 0, 0, targetW, targetH), getImageData, convert RGBA → grayscale (luminosity: 0.299R + 0.587G + 0.114B).
  // Returns Uint8ClampedArray of length targetW*targetH.
}
```

Cached canvases avoid per-frame allocation. The two sizes cover both detectors.

## 5. State machine

```ts
// stateMachine.ts — pure
export type State =
  | { kind: 'idle' }
  | { kind: 'looking' }
  | { kind: 'arming'; armedSince: number }   // both stable + sharp; counting down to 500 ms
  | { kind: 'captured' };

export type Event =
  | { kind: 'frame'; stable: boolean; sharp: boolean; timestamp: number }
  | { kind: 'manual_capture'; timestamp: number }
  | { kind: 'reset' };

export const ARM_DURATION_MS = 500;

export function transition(state: State, event: Event): State {
  // Rules:
  //  - any state + reset                                     → looking
  //  - looking + frame{stable && sharp}                      → arming{armedSince: t}
  //  - arming + frame{!stable || !sharp}                     → looking
  //  - arming + frame{stable && sharp, t - armedSince ≥ 500} → captured
  //  - looking|arming + manual_capture                       → captured
  //  - captured + anything                                   → captured (terminal until reset)
  //  - idle + frame                                          → looking (start)
}
```

**Why a state machine:** the auto-capture rule has timing (500 ms armed) and is easy to get wrong with ad-hoc booleans. A pure transition function is trivial to test exhaustively.

## 6. Capture loop

```ts
// captureLoop.ts
export interface CaptureLoopOpts {
  video: HTMLVideoElement;
  onState: (state: State) => void;
  onCapture: (blob: Blob) => void;
}

export function runCaptureLoop(opts: CaptureLoopOpts): () => void {
  // Driven by setInterval at ~15 FPS (66 ms).
  //  1. downscale to 32×32 grayscale → diff with prev → stable?
  //  2. downscale to 200×200 grayscale → laplacianVariance → sharp?
  //  3. dispatch frame event; call transition.
  //  4. emit state via onState (always, so UI can update).
  //  5. when state.kind === 'captured': captureFullFrame(video) → onCapture(blob); stop loop.
  // Returns a stop() that cancels the interval and forgets prev frame.
}
```

The loop is the only place that wires pure functions to the live video. Manual capture is wired separately by `index.ts` — clicking the button dispatches `manual_capture` to the same transition function.

## 7. Snapshot

```ts
// snapshot.ts
export async function captureFullFrame(video: HTMLVideoElement): Promise<Blob> {
  // Create canvas at video.videoWidth × video.videoHeight (no downscaling).
  // drawImage(video).
  // canvas.toBlob(resolve, 'image/jpeg', 0.9).
  // If toBlob returns null → reject with Error('snapshot failed').
}
```

JPEG quality 0.9 — roadmap acceptance is "Résolution minimum 1280×1800 for archivage lisible"; we honor whatever the camera delivers (often 1920×1080 or higher).

## 8. Camera + error handling

```ts
// camera.ts
export interface CameraHandle {
  video: HTMLVideoElement;
  stream: MediaStream;
  stop: () => void;
}

export async function startCamera(): Promise<CameraHandle> {
  // 1. Try getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
  // 2. On OverconstrainedError → retry with { video: true } (relaxed)
  // 3. Create video element, set: playsInline=true, muted=true, autoplay=true. Assign srcObject.
  // 4. Await video.play().
  // 5. Return handle. stop() = stream.getTracks().forEach(t => t.stop()).
}
```

Errors propagate as typed exceptions handled by `index.ts`:

| Error name              | UI message                                                 |
|-------------------------|------------------------------------------------------------|
| `NotAllowedError`       | "Permissions caméra refusées. Autorisez-les dans les paramètres du navigateur." |
| `NotFoundError`         | "Aucune caméra détectée."                                  |
| `NotReadableError`      | "Caméra utilisée par une autre application."               |
| Other                   | "Erreur caméra inattendue. Réessayer ?" + retry button     |

`OverconstrainedError` is handled internally (retry with relaxed constraints), not surfaced.

## 9. UI

### 9.1 Layout (full screen)

```
┌─────────────────────────────────────┐
│                                     │
│         [live video, contain]       │
│                                     │
│     ┌─────────────────────┐         │
│     │   A4 guide overlay  │         │
│     │   (SVG, dashed)     │         │
│     └─────────────────────┘         │
│                                     │
│         "Cadrez la facture"         │
│                                     │
│                                     │
│           [ Capturer ]              │ ← always visible manual button
└─────────────────────────────────────┘
```

Background `#000`. Video fills viewport (`object-fit: contain`). Overlay is an absolutely-positioned SVG sized to ~80 % of the shorter viewport edge, with A4 ratio (1:√2 ≈ 1:1.414).

**Decision: manual button is always visible**, not hidden behind a fallback timer. The roadmap calls it a "fallback" but UX-wise, hiding the only manual escape hatch creates dead time. Always-visible is simpler and lets the user override auto-capture whenever they want.

### 9.2 Visual states (per roadmap §4.2)

| State     | Overlay color | Status text                |
|-----------|---------------|----------------------------|
| idle      | gray, dashed  | (none)                     |
| looking   | red, dashed   | "Ajustez le cadrage"       |
| arming    | orange→green animated stroke | "Stabilisez..."   |
| captured  | green + flash | "✓ Photo prise"            |
| error     | red, dashed   | (error message from §8)    |

`overlay.ts` exposes `setVariant(name)` that swaps a CSS class. `feedback.ts` runs the flash (200 ms white overlay) and `navigator.vibrate(100)` on capture.

### 9.3 After capture

`captured` state shows the captured Blob as an `<img>` preview with a **Recommencer** button that calls `reset` and restarts the loop. The `onCapture` callback is fired on capture — host integration uses that.

For this plan, `main.ts` simply logs the blob and sets the preview screen. The proper Step 2 transition is the next plan.

## 10. Public API

```ts
// pageCapture/index.ts
export interface MountOptions {
  onCapture: (blob: Blob) => void;
}

export function mount(rootEl: HTMLElement, opts: MountOptions): () => void {
  // 1. render(rootEl) → DOM handles
  // 2. startCamera() → assign stream to handles.video
  //    On error, swap to error UI; return early.
  // 3. runCaptureLoop({ video, onState: applyVariant, onCapture: showPreview + opts.onCapture })
  // 4. wire manual button → dispatch manual_capture
  // 5. wire Recommencer → reset + restart loop
  // Returns a cleanup() that stops camera + loop and clears the rootEl.
}
```

Single import from `main.ts`. No globals, no module-level mutable state.

## 11. Testing

### Unit (Vitest, pure logic)

- `stability.test.ts` — frameDifference of identical buffers → 0; of all-0 vs all-255 → 255; of small noise → expected mean.
- `sharpness.test.ts` — laplacianVariance of solid-gray (blurry-fixture) → 0; of synthetic checkerboard → high (> threshold). Two synthetic fixtures generated in the test file.
- `stateMachine.test.ts` — exhaustive transitions: idle/looking/arming × frame{stable,sharp} × {true,false}^2 + manual + reset, plus the 500 ms arming timeout. ~12 cases.

### Manual / browser

- Open `https://localhost:5173/` on desktop Chrome, Firefox, Safari → camera prompt → live video → wave hand (instability) → keep still → auto-capture → see preview.
- Same on iOS Safari (over LAN IP).
- Permission denial path → error UI displays correct message.
- Manual button at any time → captures the current frame.

## 12. Out of scope (later plans)

- Step 2 (QR scan + decode + validation)
- `jsQR`, `swissqrbill` integration
- Multi-screen navigation
- Audio capture-confirmation sound (asset; "désactivable" per roadmap)
- Torch/flash via `MediaTrackConstraints.torch`
- Perspective correction
- Resolution enforcement (the roadmap's "min 1280×1800" — we deliver whatever the camera gives; enforcement waits until we know what real devices return)
