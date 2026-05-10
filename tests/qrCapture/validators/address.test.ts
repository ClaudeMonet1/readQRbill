import { describe, it, expect } from 'vitest';
import { validateAddress } from '../../../src/qrCapture/validators/address';
import type { Address } from '../../../src/qrCapture/types';

const goodS: Address = {
  type: 'S',
  name: 'Robert Schneider AG',
  street: 'Rue du Lac',
  buildingNumber: '1268',
  postalCode: '2501',
  city: 'Biel',
  country: 'CH',
};

const goodK: Address = {
  type: 'K',
  name: 'Acme SA',
  street: 'Rue du Lac 1268',
  buildingNumber: '2501 Biel',
  postalCode: '',
  city: '',
  country: 'CH',
};

describe('validateAddress (creditor: required=true)', () => {
  it('accepts valid type S', () => {
    expect(validateAddress(goodS, true)).toEqual([]);
  });

  it('accepts valid type K', () => {
    expect(validateAddress(goodK, true)).toEqual([]);
  });

  it('flags missing name', () => {
    const r = validateAddress({ ...goodS, name: '' }, true);
    expect(r.map((i) => i.code)).toContain('ADDRESS_NAME_MISSING');
  });

  it('flags type S without postalCode', () => {
    const r = validateAddress({ ...goodS, postalCode: '' }, true);
    expect(r.map((i) => i.code)).toContain('ADDRESS_POSTAL_MISSING');
  });

  it('flags type S without city', () => {
    const r = validateAddress({ ...goodS, city: '' }, true);
    expect(r.map((i) => i.code)).toContain('ADDRESS_CITY_MISSING');
  });

  it('flags type K without addrLine2', () => {
    const r = validateAddress({ ...goodK, buildingNumber: '' }, true);
    expect(r.map((i) => i.code)).toContain('ADDRESS_LINE2_MISSING');
  });

  it('flags missing/invalid country', () => {
    const r = validateAddress({ ...goodS, country: 'XX1' }, true);
    expect(r.map((i) => i.code)).toContain('ADDRESS_COUNTRY_INVALID');
  });

  it('flags missing type', () => {
    const r = validateAddress({ ...goodS, type: '' }, true);
    expect(r.map((i) => i.code)).toContain('ADDRESS_TYPE_MISSING');
  });
});

describe('validateAddress (debtor: required=false)', () => {
  it('accepts entirely empty debtor (type "")', () => {
    expect(
      validateAddress(
        { type: '', name: '', street: '', buildingNumber: '', postalCode: '', city: '', country: '' },
        false,
      ),
    ).toEqual([]);
  });

  it('flags debtor with type S but missing name', () => {
    const r = validateAddress({ ...goodS, name: '' }, false);
    expect(r.length).toBeGreaterThan(0);
  });
});
