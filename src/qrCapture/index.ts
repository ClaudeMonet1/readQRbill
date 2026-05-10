import { startCamera, type CameraHandle } from '../lib/camera';
import { runDecodeLoop } from './decodeLoop';
import { captureQRImage } from './snapshot';
import { parsePayload } from './parse';
import { validate } from './validate';
import { renderScan, attachScanVideo, setScanDecoded, showScanError, type ScanHandles } from './ui/render';
import { showResult } from './ui/result';
import type { QRBillData } from './types';

export interface QRCaptureResult {
  pageImage: Blob;
  qrImage: Blob;
  validation: QRBillData;
}

export interface MountQROptions {
  pageImage: Blob;
  onComplete: (result: QRCaptureResult) => void;
  onCancel?: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError: 'Permissions caméra refusées.',
  NotFoundError: 'Aucune caméra détectée.',
  NotReadableError: 'Caméra utilisée par une autre application.',
  NotSupportedError: 'Caméra non disponible sur ce navigateur.',
};

function errorMessageFor(err: unknown): string {
  if (err instanceof DOMException && ERROR_MESSAGES[err.name]) return ERROR_MESSAGES[err.name]!;
  return 'Erreur caméra inattendue.';
}

export function mount(rootEl: HTMLElement, opts: MountQROptions): () => void {
  let handles: ScanHandles | null = null;
  let camera: CameraHandle | null = null;
  let stopLoop: (() => void) | null = null;
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    stopLoop?.();
    camera?.stop();
    rootEl.innerHTML = '';
    rootEl.classList.remove('qr-root');
  };

  const start = async (): Promise<void> => {
    handles = renderScan(rootEl);
    handles.cancelBtn.addEventListener('click', () => {
      cleanup();
      opts.onCancel?.();
    });

    try {
      camera = await startCamera();
    } catch (err) {
      showScanError(rootEl, errorMessageFor(err), () => {
        cleanup();
        cleaned = false;
        void start();
      });
      return;
    }

    attachScanVideo(handles, camera.video);

    stopLoop = runDecodeLoop({
      video: camera.video,
      onDecoded: (payload, location) => {
        if (!handles || !camera) return;
        setScanDecoded(handles);
        const parsed = parsePayload(payload);
        const data = validate(parsed);
        captureQRImage(camera.video, location)
          .then((qrImage) => {
            stopLoop?.();
            stopLoop = null;
            camera?.stop();
            camera = null;
            showResult(rootEl, data, {
              onRetry: () => {
                cleanup();
                cleaned = false;
                void start();
              },
              onAccept: () => {
                cleanup();
                opts.onComplete({ pageImage: opts.pageImage, qrImage, validation: data });
              },
            });
          })
          .catch((err: unknown) => {
            showScanError(rootEl, errorMessageFor(err), () => {
              cleanup();
              cleaned = false;
              void start();
            });
          });
      },
      onTimeout: () => {
        showScanError(rootEl, 'Aucun QR-bill détecté, réessayez.', () => {
          cleanup();
          cleaned = false;
          void start();
        });
      },
      onError: (err) => {
        showScanError(rootEl, errorMessageFor(err), () => {
          cleanup();
          cleaned = false;
          void start();
        });
      },
    });
  };

  void start();

  return cleanup;
}
