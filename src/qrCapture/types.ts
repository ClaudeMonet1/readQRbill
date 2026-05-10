// Address as parsed from the QR payload (lines 5–11 creditor, 21–27 debtor).
// For type 'S' (structured): street + buildingNumber + postalCode + city.
// For type 'K' (combined):  addrLine1 (street+#) + addrLine2 (postal+city).
// Empty type means "not present" (debtor only).
export interface Address {
  type: 'S' | 'K' | '';
  name: string;
  street: string;          // S: street name; K: AddrLine1
  buildingNumber: string;  // S: building number; K: AddrLine2
  postalCode: string;      // S only
  city: string;            // S only
  country: string;
}

export interface ParsedFields {
  raw: string[];                       // CRLF-split lines (trailing empties dropped)
  qrType: string;                      // line 1
  version: string;                     // line 2
  coding: string;                      // line 3
  iban: string;                        // line 4
  creditor: Address;                   // lines 5–11
  ultimateCreditor: Address;           // lines 12–18 (usually empty in v2.3)
  amount: string;                      // line 19 (raw string, not yet parsed)
  currency: string;                    // line 20
  debtor: Address;                     // lines 21–27 (type may be '')
  referenceType: string;               // line 28
  reference: string;                   // line 29
  unstructuredMessage: string;         // line 30
  epd: string;                         // line 31
  billInformation: string;             // line 32 (optional)
  alternativeProcedures: string[];     // lines 33+ (optional)
}

export interface ValidationIssue {
  code: string;     // machine-readable, e.g. 'IBAN_CHECKSUM'
  field: string;    // human-friendly field name, e.g. 'iban'
  message: string;  // French message for UI
}

export interface QRLocation {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

export interface QRBillData {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  creditor: {
    iban: string;
    name: string;
    address: string;
    buildingNumber: string;
    postalCode: string;
    city: string;
    country: string;
  };
  amount: number | null;
  currency: string;
  reference: { type: string; value: string };
  debtor: {
    name: string;
    address: string;
    buildingNumber: string;
    postalCode: string;
    city: string;
    country: string;
  } | null;
  unstructuredMessage: string;
  billInformation: string;
}
