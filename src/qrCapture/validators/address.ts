import type { Address, ValidationIssue } from '../types';

export function validateAddress(addr: Address, required: boolean): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Empty debtor (type === '') is allowed when not required.
  if (!required && addr.type === '' && !addr.name && !addr.street && !addr.country) {
    return [];
  }

  if (addr.type !== 'S' && addr.type !== 'K') {
    issues.push({ code: 'ADDRESS_TYPE_MISSING', field: 'address.type', message: "Type d'adresse manquant ou invalide" });
  }
  if (!addr.name) {
    issues.push({ code: 'ADDRESS_NAME_MISSING', field: 'address.name', message: 'Nom manquant' });
  }
  if (!/^[A-Z]{2}$/.test(addr.country)) {
    issues.push({ code: 'ADDRESS_COUNTRY_INVALID', field: 'address.country', message: 'Code pays invalide (ISO-3166 alpha-2 attendu)' });
  }

  if (addr.type === 'S') {
    if (!addr.postalCode) {
      issues.push({ code: 'ADDRESS_POSTAL_MISSING', field: 'address.postalCode', message: 'Code postal manquant' });
    }
    if (!addr.city) {
      issues.push({ code: 'ADDRESS_CITY_MISSING', field: 'address.city', message: 'Ville manquante' });
    }
  } else if (addr.type === 'K') {
    if (!addr.street) {
      issues.push({ code: 'ADDRESS_LINE1_MISSING', field: 'address.street', message: 'Ligne 1 manquante' });
    }
    if (!addr.buildingNumber) {
      issues.push({ code: 'ADDRESS_LINE2_MISSING', field: 'address.buildingNumber', message: 'Ligne 2 manquante' });
    }
  }

  return issues;
}
