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
