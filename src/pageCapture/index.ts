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
