const STYLE_ID = 'qr-styles';

const STYLES = `
.qr-root { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: #000; overflow: hidden; }
.qr-video-slot { position: absolute; inset: 0; }
.qr-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.qr-overlay { position: absolute; width: 70vmin; height: 70vmin; max-width: 70vw; max-height: 70vh; pointer-events: none; }
.qr-overlay__rect { fill: none; stroke: #d33; stroke-width: 1; stroke-dasharray: 3 2; }
.qr-overlay--decoded .qr-overlay__rect { stroke: #2c8; stroke-dasharray: none; }
.qr-status { position: absolute; bottom: 96px; left: 0; right: 0; text-align: center; font-size: 16px; color: #eee; padding: 8px 16px; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
.qr-button { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 14px 32px; min-width: 160px; min-height: 48px; font-size: 16px; border: 1px solid #888; border-radius: 24px; background: rgba(0,0,0,0.6); color: #fff; cursor: pointer; }
.qr-error { position: absolute; left: 24px; right: 24px; top: 50%; transform: translateY(-50%); text-align: center; font-size: 18px; color: #eee; }
.qr-error .qr-button { position: static; transform: none; margin-top: 16px; }
`;

const SVG_NS = 'http://www.w3.org/2000/svg';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

export interface ScanHandles {
  root: HTMLElement;
  videoSlot: HTMLDivElement;
  overlay: SVGSVGElement;
  statusEl: HTMLDivElement;
  cancelBtn: HTMLButtonElement;
}

export function renderScan(rootEl: HTMLElement): ScanHandles {
  ensureStyles();
  rootEl.innerHTML = '';
  rootEl.classList.add('qr-root');

  const videoSlot = document.createElement('div');
  videoSlot.className = 'qr-video-slot';
  rootEl.appendChild(videoSlot);

  const overlay = document.createElementNS(SVG_NS, 'svg');
  overlay.setAttribute('class', 'qr-overlay');
  overlay.setAttribute('viewBox', '0 0 100 100');
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', '2');
  rect.setAttribute('y', '2');
  rect.setAttribute('width', '96');
  rect.setAttribute('height', '96');
  rect.setAttribute('rx', '4');
  rect.setAttribute('class', 'qr-overlay__rect');
  overlay.appendChild(rect);
  rootEl.appendChild(overlay);

  const statusEl = document.createElement('div');
  statusEl.className = 'qr-status';
  statusEl.textContent = 'Cadrez le QR-bill';
  rootEl.appendChild(statusEl);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'qr-button';
  cancelBtn.type = 'button';
  cancelBtn.textContent = '↩︎ Reprendre la photo';
  rootEl.appendChild(cancelBtn);

  return { root: rootEl, videoSlot, overlay, statusEl, cancelBtn };
}

export function attachScanVideo(handles: ScanHandles, video: HTMLVideoElement): void {
  video.classList.add('qr-video');
  handles.videoSlot.appendChild(video);
}

export function setScanDecoded(handles: ScanHandles): void {
  handles.overlay.setAttribute('class', 'qr-overlay qr-overlay--decoded');
  handles.statusEl.textContent = '✓ QR détecté';
}

export function showScanError(rootEl: HTMLElement, message: string, onRetry: () => void): void {
  ensureStyles();
  rootEl.innerHTML = '';
  rootEl.classList.add('qr-root');
  const wrap = document.createElement('div');
  wrap.className = 'qr-error';
  const text = document.createElement('div');
  text.textContent = message;
  wrap.appendChild(text);
  const btn = document.createElement('button');
  btn.className = 'qr-button';
  btn.type = 'button';
  btn.textContent = 'Réessayer';
  btn.addEventListener('click', onRetry);
  wrap.appendChild(btn);
  rootEl.appendChild(wrap);
}
