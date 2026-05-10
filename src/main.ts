import { mount as mountPage } from './pageCapture';
import { mount as mountQR } from './qrCapture';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Missing #app root element');
}

let unmount: (() => void) | null = null;

const startPage = (): void => {
  unmount?.();
  unmount = mountPage(root, {
    onCapture: (pageImage) => startQR(pageImage),
  });
};

const startQR = (pageImage: Blob): void => {
  unmount?.();
  unmount = mountQR(root, {
    pageImage,
    onComplete: (result) => {
      console.log('[final result]', {
        pageBytes: result.pageImage.size,
        qrBytes: result.qrImage.size,
        valid: result.validation.valid,
        creditor: result.validation.creditor.name,
        amount: result.validation.amount,
        currency: result.validation.currency,
        reference: result.validation.reference,
      });
      startPage();
    },
    onCancel: () => startPage(),
  });
};

startPage();
