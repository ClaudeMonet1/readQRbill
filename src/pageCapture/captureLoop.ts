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
