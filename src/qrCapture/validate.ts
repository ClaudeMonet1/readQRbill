import type { ParsedFields, QRBillData, ValidationIssue, Address } from './types';
import { validateIban } from './validators/iban';
import { validateQRR, validateSCOR } from './validators/reference';
import { ibanReferenceCoherent } from './validators/coherence';
import { parseAmount } from './validators/amount';
import { validateAddress } from './validators/address';

const issue = (code: string, field: string, message: string): ValidationIssue => ({ code, field, message });

function buildData(
  parsed: ParsedFields,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  amount: number | null,
): QRBillData {
  const debtorEmpty =
    parsed.debtor.type === '' && !parsed.debtor.name && !parsed.debtor.street && !parsed.debtor.country;
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    creditor: {
      iban: parsed.iban,
      name: parsed.creditor.name,
      address: parsed.creditor.street,
      buildingNumber: parsed.creditor.buildingNumber,
      postalCode: parsed.creditor.postalCode,
      city: parsed.creditor.city,
      country: parsed.creditor.country,
    },
    amount,
    currency: parsed.currency,
    reference: { type: parsed.referenceType, value: parsed.reference },
    debtor: debtorEmpty
      ? null
      : {
          name: parsed.debtor.name,
          address: parsed.debtor.street,
          buildingNumber: parsed.debtor.buildingNumber,
          postalCode: parsed.debtor.postalCode,
          city: parsed.debtor.city,
          country: parsed.debtor.country,
        },
    unstructuredMessage: parsed.unstructuredMessage,
    billInformation: parsed.billInformation,
  };
}

export function validate(parsed: ParsedFields): QRBillData {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (parsed.qrType !== 'SPC') errors.push(issue('HEADER_QRTYPE', 'qrType', 'En-tête QRType invalide (attendu "SPC")'));
  if (parsed.version !== '0200') errors.push(issue('HEADER_VERSION', 'version', 'Version non supportée (attendu "0200")'));
  if (parsed.coding !== '1') warnings.push(issue('HEADER_CODING', 'coding', 'Coding type différent de "1" (UTF-8)'));
  if (parsed.epd !== 'EPD') errors.push(issue('EPD_MARKER', 'epd', 'Marqueur EPD manquant ou incorrect'));

  if (!validateIban(parsed.iban)) {
    errors.push(issue('IBAN_CHECKSUM', 'iban', 'IBAN invalide (checksum incorrect ou format inattendu)'));
  }

  const refType = parsed.referenceType;
  if (refType !== 'QRR' && refType !== 'SCOR' && refType !== 'NON') {
    errors.push(issue('REFERENCE_TYPE', 'referenceType', 'Type de référence invalide (QRR, SCOR ou NON attendu)'));
  } else if (refType === 'QRR' && !validateQRR(parsed.reference)) {
    errors.push(issue('REFERENCE_CHECKSUM', 'reference', 'Référence QRR : check digit erroné'));
  } else if (refType === 'SCOR' && !validateSCOR(parsed.reference)) {
    errors.push(issue('REFERENCE_CHECKSUM', 'reference', 'Référence SCOR (ISO 11649) invalide'));
  } else if (refType === 'NON' && parsed.reference.trim() !== '') {
    errors.push(issue('REFERENCE_NON_NONEMPTY', 'reference', "Type 'NON' mais une référence est présente"));
  }

  if (validateIban(parsed.iban) && (refType === 'QRR' || refType === 'SCOR' || refType === 'NON')) {
    if (!ibanReferenceCoherent(parsed.iban, refType)) {
      errors.push(issue('IBAN_REFERENCE_INCOHERENT', 'reference', 'IBAN et type de référence incohérents'));
    }
  }

  let amountValue: number | null = null;
  const amountResult = parseAmount(parsed.amount);
  if (!amountResult.ok) {
    errors.push(issue('AMOUNT_INVALID', 'amount', 'Montant invalide'));
  } else {
    amountValue = amountResult.value;
  }

  if (parsed.currency !== 'CHF' && parsed.currency !== 'EUR') {
    errors.push(issue('CURRENCY_INVALID', 'currency', 'Devise invalide (CHF ou EUR attendu)'));
  }

  const creditorAddrAsRaw: Address = {
    type: parsed.creditor.type,
    name: parsed.creditor.name,
    street: parsed.creditor.street,
    buildingNumber: parsed.creditor.buildingNumber,
    postalCode: parsed.creditor.postalCode,
    city: parsed.creditor.city,
    country: parsed.creditor.country,
  };
  errors.push(...validateAddress(creditorAddrAsRaw, true));
  errors.push(...validateAddress(parsed.debtor, false));

  return buildData(parsed, errors, warnings, amountValue);
}
