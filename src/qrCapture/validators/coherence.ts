import { isQrIban, validateIban } from './iban';

export function ibanReferenceCoherent(iban: string, refType: string): boolean {
  if (!validateIban(iban)) return false;
  if (isQrIban(iban)) return refType === 'QRR';
  return refType === 'SCOR' || refType === 'NON';
}
