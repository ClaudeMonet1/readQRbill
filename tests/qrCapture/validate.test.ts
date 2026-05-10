import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parsePayload } from '../../src/qrCapture/parse';
import { validate } from '../../src/qrCapture/validate';

const __dirname = dirname(fileURLToPath(import.meta.url));

const loadFixture = (name: string): string => {
  const raw = readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
  return raw.replace(/\r\n|\r|\n/g, '\r\n');
};

describe('validate (end-to-end with fixtures)', () => {
  it('valid-qrr-chf.txt → valid, no errors', () => {
    const data = validate(parsePayload(loadFixture('valid-qrr-chf.txt')));
    expect(data.errors).toEqual([]);
    expect(data.valid).toBe(true);
    expect(data.creditor.iban).toBe('CH4431999123000889012');
    expect(data.amount).toBe(3949.75);
    expect(data.currency).toBe('CHF');
    expect(data.reference).toEqual({ type: 'QRR', value: '210000000003139471430009017' });
    expect(data.debtor?.name).toBe('Pia-Maria Rutschmann-Schnyder');
  });

  it('valid-scor-eur.txt → valid, EUR + SCOR', () => {
    const data = validate(parsePayload(loadFixture('valid-scor-eur.txt')));
    expect(data.errors).toEqual([]);
    expect(data.currency).toBe('EUR');
    expect(data.reference.type).toBe('SCOR');
    expect(data.amount).toBe(100.5);
  });

  it('valid-non.txt → valid, NON + open amount + no debtor', () => {
    const data = validate(parsePayload(loadFixture('valid-non.txt')));
    expect(data.errors).toEqual([]);
    expect(data.amount).toBeNull();
    expect(data.reference.type).toBe('NON');
    expect(data.debtor).toBeNull();
  });

  it('invalid-iban.txt → IBAN_CHECKSUM error', () => {
    const data = validate(parsePayload(loadFixture('invalid-iban.txt')));
    expect(data.valid).toBe(false);
    expect(data.errors.map((e) => e.code)).toContain('IBAN_CHECKSUM');
  });

  it('invalid-qrr.txt → REFERENCE_CHECKSUM error', () => {
    const data = validate(parsePayload(loadFixture('invalid-qrr.txt')));
    expect(data.valid).toBe(false);
    expect(data.errors.map((e) => e.code)).toContain('REFERENCE_CHECKSUM');
  });

  it('rejects non-SPC header', () => {
    const data = validate(parsePayload('XXX\r\n0200\r\n1\r\nCH9300762011623852957'));
    expect(data.errors.map((e) => e.code)).toContain('HEADER_QRTYPE');
  });

  it('rejects unsupported version', () => {
    const data = validate(parsePayload('SPC\r\n0100\r\n1\r\nCH9300762011623852957'));
    expect(data.errors.map((e) => e.code)).toContain('HEADER_VERSION');
  });

  it('rejects missing EPD marker', () => {
    const raw = loadFixture('valid-qrr-chf.txt').replace('EPD', 'XXX');
    const data = validate(parsePayload(raw));
    expect(data.errors.map((e) => e.code)).toContain('EPD_MARKER');
  });
});
