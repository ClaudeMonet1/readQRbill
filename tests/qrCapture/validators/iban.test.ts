import { describe, it, expect } from 'vitest';
import { validateIban, isQrIban } from '../../../src/qrCapture/validators/iban';

describe('validateIban', () => {
  it('accepts valid CH IBAN', () => {
    expect(validateIban('CH9300762011623852957')).toBe(true);
  });

  it('accepts valid LI IBAN', () => {
    expect(validateIban('LI7508810100000232401')).toBe(true);
  });

  it('rejects bad checksum', () => {
    expect(validateIban('CH9300762011623852958')).toBe(false);
  });

  it('rejects wrong country', () => {
    expect(validateIban('DE89370400440532013000')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(validateIban('CH93007620116238529')).toBe(false);
  });

  it('strips spaces and accepts mixed case', () => {
    expect(validateIban('ch93 0076 2011 6238 5295 7')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateIban('')).toBe(false);
  });
});

describe('isQrIban', () => {
  it('returns true for QR-IBAN (IID 30000-31999)', () => {
    expect(isQrIban('CH4431999123000889012')).toBe(true);
  });

  it('returns false for normal IBAN (IID 00762)', () => {
    expect(isQrIban('CH9300762011623852957')).toBe(false);
  });

  it('returns false for invalid IBAN format', () => {
    expect(isQrIban('not-an-iban')).toBe(false);
  });
});
