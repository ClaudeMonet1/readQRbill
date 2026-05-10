import type { Address, ParsedFields } from './types';

function pickAddress(lines: string[], offset: number): Address {
  const t = (lines[offset] ?? '').trim();
  return {
    type: t === 'S' || t === 'K' ? t : '',
    name: lines[offset + 1] ?? '',
    street: lines[offset + 2] ?? '',
    buildingNumber: lines[offset + 3] ?? '',
    postalCode: lines[offset + 4] ?? '',
    city: lines[offset + 5] ?? '',
    country: (lines[offset + 6] ?? '').toUpperCase(),
  };
}

export function parsePayload(input: string): ParsedFields {
  const normalized = input.replace(/\r\n|\r|\n/g, '\n').split('\n');
  // Drop trailing empty lines so alternative-procedures detection is reliable.
  while (normalized.length > 0 && normalized[normalized.length - 1] === '') {
    normalized.pop();
  }
  const lines = normalized;

  const creditor = pickAddress(lines, 4);     // lines 5–11 → 0-indexed 4–10
  const ultimateCreditor = pickAddress(lines, 11); // lines 12–18 → 11–17
  const debtor = pickAddress(lines, 20);       // lines 21–27 → 20–26

  return {
    raw: lines,
    qrType: lines[0] ?? '',
    version: lines[1] ?? '',
    coding: lines[2] ?? '',
    iban: lines[3] ?? '',
    creditor,
    ultimateCreditor,
    amount: lines[18] ?? '',
    currency: lines[19] ?? '',
    debtor,
    referenceType: lines[27] ?? '',
    reference: lines[28] ?? '',
    unstructuredMessage: lines[29] ?? '',
    epd: lines[30] ?? '',
    billInformation: lines[31] ?? '',
    alternativeProcedures: lines.slice(32),
  };
}
