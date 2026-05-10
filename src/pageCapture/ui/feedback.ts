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
