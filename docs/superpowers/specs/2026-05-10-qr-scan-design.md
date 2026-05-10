# QR Scan — Step 2 (Decode + Validate) Design

**Date:** 2026-05-10
**Scope:** Roadmap section 2.2 ("Étape 2 — Capture, décodage et validation du QR-bill") and §3.3–3.4 (payload structure + validation rules).
**Out of scope:** Generating or printing QR-bills, multi-page bills, OCR fallback, perspective correction, output transport (server upload, deep links).

## 1. Goal

After the page-capture step's `onCapture(pageImage)` fires, mount a QR-scan screen that:

1. Opens the camera again (front-facing same as page step).
2. Continuously decodes camera frames with `jsQR` (~1 frame on 2).
3. On first successful decode: snapshots the QR area as a JPEG, parses the SPC payload, runs validation, and shows a structured result.
4. Emits the final `{ pageImage, qrImage, qrBillData }` via `onComplete`.

If nothing decodes within 30 s → show "Aucun QR-bill détecté, réessayez" + a Réessayer button.

## 2. Architectural choice

Mirrors pageCapture's functional-modules approach:
- Pure leaves: parser + validators, fully unit-tested with fixture payloads.
- I/O surface: camera, decode loop, snapshot, UI — manually tested in browser.
- Public `mount(rootEl, { pageImage, onComplete })` factory; main.ts orchestrates page → qr.

## 3. Dependencies

Add **two** runtime npm packages — both are tiny:

| Package | Why | Approx. size |
|---|---|---|
| `jsqr` | QR decoding from `ImageData`. JS-only, no WASM. | ~43 KB min, ~14 KB gzip |
| (none for validation) | We write our own parser + IBAN/QRR/SCOR validators (~10 KB minified). |  |

`swissqrbill` is **not** added — its bundle hit (80–120 KB) would push us close to the 250 KB roadmap budget once Step 1 + jsQR are in.

## 4. File structure

```
src/
├── main.ts                              # MODIFIED: orchestrate page → qr → final
├── lib/
│   └── camera.ts                        # MOVED from src/pageCapture/camera.ts
├── pageCapture/
│   └── camera.ts                        # DELETED (replaced by lib/camera re-import)
└── qrCapture/
    ├── index.ts                         # mount(rootEl, { pageImage, onComplete }) → cleanup
    ├── decodeLoop.ts                    # jsQR loop; emits 'decoded' string or 'timeout'
    ├── snapshot.ts                      # captureQRImage(video, location) → Blob
    ├── parse.ts                         # PURE: parsePayload(string) → ParsedFields
    ├── types.ts                         # QRBillData, ValidationResult, ParsedFields
    ├── validate.ts                      # PURE: validate(parsed) → { data, valid, warnings, errors }
    ├── validators/
    │   ├── iban.ts                      # PURE: validateIban, isQrIban
    │   ├── reference.ts                 # PURE: validateQRR, validateSCOR, computeMod10
    │   ├── coherence.ts                 # PURE: ibanReferenceCoherent
    │   ├── amount.ts                    # PURE: parseAmount
    │   └── address.ts                   # PURE: validateAddress
    └── ui/
        ├── render.ts                    # Layout, square QR overlay, status, timeout button
        └── result.ts                    # Result display + Recommencer/Continue
tests/
└── qrCapture/
    ├── parse.test.ts                    # CRLF parsing, line counts, EPD marker
    ├── validators/
    │   ├── iban.test.ts                 # mod-97; CH/LI; QR-IBAN detection
    │   ├── reference.test.ts            # QRR (mod-10 recursive), SCOR (ISO 11649)
    │   ├── coherence.test.ts            # QR-IBAN ⇒ QRR; normal IBAN ⇒ SCOR/NON
    │   ├── amount.test.ts               # parsing, bounds, decimals
    │   └── address.test.ts              # ISO-3166 country code, type S vs K
    ├── validate.test.ts                 # end-to-end with fixture payloads
    └── fixtures/
        ├── valid-qrr-chf.txt            # roadmap §2.4 sample
        ├── valid-scor-eur.txt           # hand-crafted, all checksums correct
        ├── valid-non.txt                # NON reference, no amount
        ├── invalid-iban.txt             # bad checksum
        └── invalid-qrr.txt              # bad check digit
```

## 5. QR-bill payload (per roadmap §3.3)

UTF-8, lines separated by `\r\n`. Mandatory marker `EPD` ends the payment block. Optional bill information follows. Layout:

```
Line  1   QRType         "SPC"                 required
     2   Version        "0200"                required
     3   Coding         "1"                   required (UTF-8)
     4   IBAN                                  required, CH or LI
     5   AddrType       "S" or "K"            required (creditor)
     6   Name                                  required
     7   Street/AddrLine1
     8   Number/AddrLine2
     9   PostalCode                            required if S
    10   City                                  required if S
    11   Country        ISO 3166 alpha-2      required
    12-18 Final creditor (7 lines, usually empty in v2.3)
    19   Amount         numeric or empty
    20   Currency       "CHF" or "EUR"        required
    21   AddrType debtor "S","K" or empty
    22-27 Debtor address (6 lines)
    28   ReferenceType  "QRR","SCOR","NON"    required
    29   Reference                             required if QRR/SCOR
    30   UnstructuredMessage
    31   EPD                                    required marker
    32   BillInformation                       optional (Swico)
    33-34 Alternative procedures               optional (rarely seen)
```

Total mandatory lines = 31.

## 6. Validation rules (per roadmap §3.4)

### 6.1 IBAN (line 4)

- Strip spaces, uppercase
- Must match `/^(CH|LI)\d{19}$/` → length 21, country CH or LI
- mod-97: move first 4 chars to end, convert letters (A=10..Z=35), result mod 97 must be 1
- **QR-IBAN detection:** IID (positions 5-9 = chars index 4-8) numeric value in [30000, 31999] → marks IBAN as a QR-IBAN

### 6.2 Reference type (line 28) + reference (line 29)

- `QRR`:
  - Reference must be 27 digits
  - Last digit is mod-10 recursive checksum of first 26 digits
  - Calculator: per ESR/BVR table (10×10 transition matrix)
- `SCOR`:
  - Reference must start with `RF`
  - Length 5..25
  - Strip first 4 chars, append, convert letters, mod-97 must equal 1
- `NON`:
  - Reference must be empty

### 6.3 Coherence (lines 4 + 28)

- IBAN is QR-IBAN ⇒ ReferenceType MUST be `QRR`
- IBAN is normal ⇒ ReferenceType MUST be `SCOR` or `NON`
- Mismatches are **errors**, not warnings.

### 6.4 Amount (line 19)

- May be empty (open amount)
- Must match `/^\d{1,9}(\.\d{1,2})?$/`
- Numeric value ≤ 999_999_999.99

### 6.5 Currency (line 20)

- `CHF` or `EUR` only

### 6.6 Address (lines 5–11 creditor; 21–27 debtor)

- AddrType: `S` (structured) or `K` (combined). Debtor type may also be empty.
- If `S`: PostalCode + City required.
- If `K`: AddrLine1 (street+no) + AddrLine2 (postal+city) used; PostalCode/City fields stay empty.
- Country: 2-letter ISO-3166 alpha-2 (not validated against full registry; just length+regex).

### 6.7 Severity model

```ts
ValidationResult = {
  valid: boolean;          // true ⇔ errors.length === 0
  errors: ValidationIssue[];   // breakages
  warnings: ValidationIssue[]; // non-blocking (e.g., SPC coding type ≠ 1 surfaced as warning if other fields look sane)
  data: QRBillData;        // parsed structured object even on errors
};
type ValidationIssue = { code: string; field: string; message: string };
```

## 7. Decode loop (`decodeLoop.ts`)

```ts
export interface DecodeLoopOpts {
  video: HTMLVideoElement;
  onDecoded: (payload: string) => void;
  onTimeout: () => void;
  onError?: (err: Error) => void;
}
```

- Driven by `setInterval` at ~15 FPS.
- Every other tick: downscale video frame to (e.g.) 640×480 grayscale-RGBA `ImageData`, call `jsQR(imageData.data, w, h)`.
- On non-null result with non-empty `data`: stop the loop, call `onDecoded(result.data)`.
- 30 s without decode: stop, call `onTimeout()`.

The QR overlay is **square**, not A4. Inset ~70 % of the shorter viewport dimension.

## 8. Snapshot (`snapshot.ts`)

`captureQRImage(video, location)` — `location` is the `Point[]` jsQR returns (corners of the QR). Compute axis-aligned bounding box, expand by ~10 % margin, crop the full-resolution video frame to that area. Output JPEG quality 0.9. Result is roughly `~800×800` per roadmap, depending on camera native resolution.

## 9. Parser (`parse.ts`)

```ts
export interface ParsedFields {
  raw: string[];                       // CRLF-split lines
  qrType: string;
  version: string;
  coding: string;
  iban: string;
  creditor: ParsedAddress;
  ultimateCreditor: ParsedAddress | null;  // empty in v2.3
  amount: string;
  currency: string;
  debtor: ParsedAddress | null;
  referenceType: string;
  reference: string;
  unstructuredMessage: string;
  epd: string;
  billInformation: string;
  alternativeProcedures: string[];
}
```

`parsePayload(input: string): ParsedFields` — splits on `\r\n` (lenient: also accepts `\n`), pads short payloads with `''`, returns the structured shape. Pure, no validation. Returns the same struct even for malformed input — validation happens in `validate.ts`.

## 10. Public API

```ts
// qrCapture/types.ts
export interface QRBillData { /* per roadmap §2.4 */ }
export interface ValidationResult { /* §6.7 above */ }

// qrCapture/index.ts
export interface QRCaptureResult {
  pageImage: Blob;        // forwarded from page step
  qrImage: Blob;          // captured QR area
  validation: ValidationResult;
}

export interface MountQROptions {
  pageImage: Blob;
  onComplete: (result: QRCaptureResult) => void;
  onCancel?: () => void;  // user wants to redo the page step
}

export function mount(rootEl: HTMLElement, opts: MountQROptions): () => void;
```

The `validation` field carries `valid`, `errors`, `warnings`, and `data`. The host (main.ts) decides what to do with the final payload.

## 11. UI

### 11.1 Scan screen

- Live video full-screen (background, like page step).
- **Square** SVG overlay (instead of A4) at ~70 % of `vmin`, dashed red while looking, solid green on decode.
- Status text bottom: "Cadrez le QR-bill" → "Décodage..." → "✓ QR détecté".
- Bottom button: "Annuler ↩︎" → triggers `onCancel?.()`.
- After 30 s timeout: show timeout overlay with "Aucun QR-bill détecté" + Réessayer (resets timer + loop).

### 11.2 Result screen

After decode + validation, replace the scan UI with the result:

**Valid (no errors):**
```
✅ QR-bill valide
─────────────────────────
Créancier  : Robert Schneider SA
             Rue du Lac 1268, 2501 Biel, CH
IBAN       : CH93 0076 2011 6238 5295 7
Montant    : CHF 3 949.75
Référence  : 21 00000 00003 13947 14300 09017 (QRR)
Débiteur   : Pia-Maria Rutschmann-Schnyder
Message    : Instructions de paiement
─────────────────────────
[Recommencer] [Continuer →]
```

**Invalid:**
```
❌ QR-bill invalide
─────────────────────────
Erreurs détectées :
  • IBAN invalide (checksum incorrect)
  • Référence QRR : check digit erroné
─────────────────────────
[Recommencer]
```

(Per roadmap §1.4: "Si le QR ne se décode pas, le scan échoue. L'utilisateur réessaie.")

The IBAN is **formatted** for display (4-digit groups), reference per its type (QRR: 5+5+5+5+5+2 spacing; SCOR: groups of 4). Amount shown with `Intl.NumberFormat` for thousands separators.

`Continuer →` on a valid result fires `onComplete({ pageImage, qrImage, validation })`. For now, main.ts logs the final payload.

## 12. Camera reuse

`src/pageCapture/camera.ts` becomes `src/lib/camera.ts` (one move + two import updates). Both `pageCapture` and `qrCapture` import from `lib/camera`. No behavioral change.

## 13. Testing

### Unit (Vitest, pure logic)

- `parse.test.ts` — sample payload from roadmap §2.4 → all fields present in expected positions. Lenient `\n` parsing. Empty payload returns empty struct.
- `validators/iban.test.ts` — known-good CH IBAN passes; bit-flipped IBAN fails; `isQrIban` true for IID 30425, false for 00762.
- `validators/reference.test.ts` — QRR sample from roadmap passes; off-by-one digit fails. SCOR `RF18539007547034`-style sample passes.
- `validators/coherence.test.ts` — QR-IBAN + SCOR combo flagged as error; QR-IBAN + QRR ok; normal IBAN + QRR flagged.
- `validators/amount.test.ts` — `'3949.75'` → 3949.75; `'-1'` → error; `'a'` → error; `''` → null (open amount).
- `validators/address.test.ts` — type S w/ empty city → error; type K w/ no AddrLine2 → error.
- `validate.test.ts` — full payload from each fixture file → expected `{ valid, errors, warnings }`.

### Manual / browser
- Print a QR-bill (or display one on another screen). Mount qrCapture, verify decode + structured output. Check timeout path with no QR in view for 30s.

### Fixtures

`tests/qrCapture/fixtures/*.txt` — committed as plain text (CRLF-encoded). Used by `validate.test.ts` to drive end-to-end checks. Five files per §4.

## 14. main.ts orchestration

```ts
import { mount as mountPage } from './pageCapture';
import { mount as mountQR } from './qrCapture';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app');

let unmount: (() => void) | null = null;

const startPage = () => {
  unmount?.();
  unmount = mountPage(root, {
    onCapture: (pageImage) => startQR(pageImage),
  });
};

const startQR = (pageImage: Blob) => {
  unmount?.();
  unmount = mountQR(root, {
    pageImage,
    onComplete: (result) => {
      console.log('[final]', result);
      // Future: post to server, copy as JSON, etc.
    },
    onCancel: () => startPage(),
  });
};

startPage();
```

## 15. Out of scope (later)

- Final result transport (server post, clipboard copy, `swissqrbill` PDF generation)
- Bill information (Swico) parsing — we surface the raw string only
- Alternative procedures lines
- OCR fallback for damaged QR
- Perspective correction
- Multi-language UI
