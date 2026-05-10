import { describe, it, expect } from 'vitest';
import { parseAmount } from '../../../src/qrCapture/validators/amount';

describe('parseAmount', () => {
  it('parses an integer amount', () => {
    expect(parseAmount('100')).toEqual({ ok: true, value: 100 });
  });

  it('parses two-decimal amount', () => {
    expect(parseAmount('3949.75')).toEqual({ ok: true, value: 3949.75 });
  });

  it('parses one-decimal amount', () => {
    expect(parseAmount('100.5')).toEqual({ ok: true, value: 100.5 });
  });

  it('returns null for empty (open amount)', () => {
    expect(parseAmount('')).toEqual({ ok: true, value: null });
  });

  it('rejects three decimals', () => {
    expect(parseAmount('1.234').ok).toBe(false);
  });

  it('rejects negative', () => {
    expect(parseAmount('-1').ok).toBe(false);
  });

  it('rejects non-numeric', () => {
    expect(parseAmount('abc').ok).toBe(false);
  });

  it('rejects amount > 999999999.99', () => {
    expect(parseAmount('1000000000').ok).toBe(false);
  });

  it('accepts max amount 999999999.99', () => {
    expect(parseAmount('999999999.99')).toEqual({ ok: true, value: 999999999.99 });
  });
});
