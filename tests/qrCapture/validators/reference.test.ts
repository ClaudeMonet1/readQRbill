import { describe, it, expect } from 'vitest';
import {
  validateQRR,
  validateSCOR,
  computeMod10CheckDigit,
} from '../../../src/qrCapture/validators/reference';

describe('computeMod10CheckDigit (ESR/BVR table)', () => {
  it('returns 7 for the known sample 21000000000313947143000901', () => {
    expect(computeMod10CheckDigit('21000000000313947143000901')).toBe(7);
  });

  it('returns 0 for an all-zero body', () => {
    expect(computeMod10CheckDigit('00000000000000000000000000')).toBe(0);
  });
});

describe('validateQRR', () => {
  it('accepts valid 27-digit reference from roadmap', () => {
    expect(validateQRR('210000000003139471430009017')).toBe(true);
  });

  it('rejects same reference with wrong check digit', () => {
    expect(validateQRR('210000000003139471430009018')).toBe(false);
  });

  it('rejects non-27-digit length', () => {
    expect(validateQRR('21000000000313947143000901')).toBe(false);
    expect(validateQRR('2100000000031394714300090170')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(validateQRR('21000000000313947143000901A')).toBe(false);
  });
});

describe('validateSCOR (ISO 11649)', () => {
  it('accepts valid creditor reference', () => {
    expect(validateSCOR('RF18539007547034')).toBe(true);
  });

  it('rejects when check digits are wrong', () => {
    expect(validateSCOR('RF19539007547034')).toBe(false);
  });

  it('rejects when not starting with RF', () => {
    expect(validateSCOR('XX18539007547034')).toBe(false);
  });

  it('rejects too long (>25 chars)', () => {
    expect(validateSCOR('RF18' + 'A'.repeat(22))).toBe(false);
  });

  it('strips spaces', () => {
    expect(validateSCOR('RF18 5390 0754 7034')).toBe(true);
  });
});
