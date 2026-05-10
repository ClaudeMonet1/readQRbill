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
