import { VERSION } from './version';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Missing #app root element');
}

root.textContent = `readQRbill v${VERSION} — toolchain OK`;
