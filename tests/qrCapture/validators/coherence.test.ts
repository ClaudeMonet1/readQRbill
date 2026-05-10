import { describe, it, expect } from 'vitest';
import { ibanReferenceCoherent } from '../../../src/qrCapture/validators/coherence';

describe('ibanReferenceCoherent', () => {
  const QR_IBAN = 'CH4431999123000889012';
  const NORMAL_IBAN = 'CH9300762011623852957';

  it('QR-IBAN + QRR → ok', () => {
    expect(ibanReferenceCoherent(QR_IBAN, 'QRR')).toBe(true);
  });

  it('QR-IBAN + SCOR → not coherent', () => {
    expect(ibanReferenceCoherent(QR_IBAN, 'SCOR')).toBe(false);
  });

  it('QR-IBAN + NON → not coherent', () => {
    expect(ibanReferenceCoherent(QR_IBAN, 'NON')).toBe(false);
  });

  it('Normal IBAN + SCOR → ok', () => {
    expect(ibanReferenceCoherent(NORMAL_IBAN, 'SCOR')).toBe(true);
  });

  it('Normal IBAN + NON → ok', () => {
    expect(ibanReferenceCoherent(NORMAL_IBAN, 'NON')).toBe(true);
  });

  it('Normal IBAN + QRR → not coherent', () => {
    expect(ibanReferenceCoherent(NORMAL_IBAN, 'QRR')).toBe(false);
  });

  it('Invalid IBAN → false (not coherent)', () => {
    expect(ibanReferenceCoherent('garbage', 'QRR')).toBe(false);
  });
});
