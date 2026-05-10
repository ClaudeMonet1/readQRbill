import { mount } from './pageCapture';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Missing #app root element');
}

mount(root, {
  onCapture: (blob) => {
    // Step 2 (QR scan) will pick this up in a later plan.
    console.log('[pageCapture] captured', blob.size, 'bytes,', blob.type);
  },
});
