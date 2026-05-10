import { mountStepHeader } from '../../lib/stepHeader';
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
.pc-preview { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000; gap: 16px; padding: 16px; box-sizing: border-box; }
.pc-preview img { max-width: 90vw; max-height: 60vh; object-fit: contain; }
.pc-preview-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.pc-button--primary { background: #2c8; border-color: #2c8; color: #000; font-weight: 600; }
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

  mountStepHeader(rootEl, { step: 1 });

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

export interface PreviewActions {
  onRetry: () => void;
  onAccept: () => void;
}

export function showPreview(
  handles: RenderHandles,
  blob: Blob,
  actions: PreviewActions,
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

  const buttons = document.createElement('div');
  buttons.className = 'pc-preview-actions';

  const retryBtn = document.createElement('button');
  retryBtn.className = 'pc-button';
  retryBtn.style.position = 'static';
  retryBtn.style.transform = 'none';
  retryBtn.type = 'button';
  retryBtn.textContent = 'Recommencer';
  retryBtn.addEventListener('click', actions.onRetry);
  buttons.appendChild(retryBtn);

  const acceptBtn = document.createElement('button');
  acceptBtn.className = 'pc-button pc-button--primary';
  acceptBtn.style.position = 'static';
  acceptBtn.style.transform = 'none';
  acceptBtn.type = 'button';
  acceptBtn.textContent = 'Continuer →';
  acceptBtn.addEventListener('click', actions.onAccept);
  buttons.appendChild(acceptBtn);

  preview.appendChild(buttons);
  handles.root.appendChild(preview);
}
