import { describe, it, expect } from 'vitest';
import { parsePayload } from '../../src/qrCapture/parse';

const SAMPLE = [
  'SPC',
  '0200',
  '1',
  'CH9300762011623852957',
  'S',
  'Robert Schneider AG',
  'Rue du Lac',
  '1268',
  '2501',
  'Biel',
  'CH',
  '', '', '', '', '', '', '',                    // ultimate creditor (12-18)
  '3949.75',
  'CHF',
  'S',
  'Pia-Maria Rutschmann-Schnyder',
  'Grosse Marktgasse',
  '28',
  '9400',
  'Rorschach',
  'CH',
  'QRR',
  '210000000003139471430009017',
  'Instructions de paiement',
  'EPD',
  '//S1/10/10201409/11/200712',
].join('\r\n');

describe('parsePayload', () => {
  it('extracts header fields', () => {
    const p = parsePayload(SAMPLE);
    expect(p.qrType).toBe('SPC');
    expect(p.version).toBe('0200');
    expect(p.coding).toBe('1');
    expect(p.iban).toBe('CH9300762011623852957');
  });

  it('extracts creditor address', () => {
    const p = parsePayload(SAMPLE);
    expect(p.creditor).toEqual({
      type: 'S',
      name: 'Robert Schneider AG',
      street: 'Rue du Lac',
      buildingNumber: '1268',
      postalCode: '2501',
      city: 'Biel',
      country: 'CH',
    });
  });

  it('extracts amount, currency, debtor', () => {
    const p = parsePayload(SAMPLE);
    expect(p.amount).toBe('3949.75');
    expect(p.currency).toBe('CHF');
    expect(p.debtor.type).toBe('S');
    expect(p.debtor.name).toBe('Pia-Maria Rutschmann-Schnyder');
    expect(p.debtor.city).toBe('Rorschach');
  });

  it('extracts reference + EPD + bill info', () => {
    const p = parsePayload(SAMPLE);
    expect(p.referenceType).toBe('QRR');
    expect(p.reference).toBe('210000000003139471430009017');
    expect(p.unstructuredMessage).toBe('Instructions de paiement');
    expect(p.epd).toBe('EPD');
    expect(p.billInformation).toBe('//S1/10/10201409/11/200712');
  });

  it('accepts LF-only line endings (lenient)', () => {
    const lf = SAMPLE.replace(/\r\n/g, '\n');
    const p = parsePayload(lf);
    expect(p.qrType).toBe('SPC');
    expect(p.iban).toBe('CH9300762011623852957');
  });

  it('handles short payload by padding empty fields', () => {
    const p = parsePayload('SPC\r\n0200');
    expect(p.qrType).toBe('SPC');
    expect(p.version).toBe('0200');
    expect(p.coding).toBe('');
    expect(p.iban).toBe('');
    expect(p.creditor.name).toBe('');
  });

  it('captures alternative procedures lines after billInformation', () => {
    const withAlt = SAMPLE + '\r\nName AV1: ABC\r\nName AV2: XYZ';
    const p = parsePayload(withAlt);
    expect(p.alternativeProcedures).toEqual(['Name AV1: ABC', 'Name AV2: XYZ']);
  });
});
