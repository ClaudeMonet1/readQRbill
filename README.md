# readQRbill

Web app to scan a Swiss **QR-bill** with a phone or laptop camera. Captures a photo of the full page, then decodes and validates the QR-bill against the official Swiss Payment Standards v2.3.

**Live demo:** <https://claudemonet1.github.io/readQRbill/>

Everything runs client-side. No backend, no upload.

## Features

- Two-step flow: **page capture** → **QR scan** → structured result.
- Auto-capture for the page photo when the image is stable + sharp for ~500 ms (manual button as fallback).
- Highest-resolution camera frame (asks for ideal 4096 px), cropped to the on-screen A4 guide so the saved JPEG is just the page.
- QR decode via [`jsqr`](https://github.com/cozmo/jsQR), then a custom parser + validators for:
  - **IBAN** (mod-97, CH/LI only, length 21)
  - **QR-IBAN** detection (IID 30000–31999)
  - **QRR** reference (27 digits + ESR/BVR mod-10 recursive checksum)
  - **SCOR** reference (ISO 11649, mod-97)
  - IBAN ↔ reference-type **coherence** (QR-IBAN ⇒ QRR; normal IBAN ⇒ SCOR/NON)
  - **Amount** (numeric, ≤ 999 999 999.99, ≤ 2 decimals)
  - **Currency** (CHF / EUR)
  - **Address** (type S structured / K combined, ISO-3166 country)
- Result screen shows both photos (full page + QR area) and the structured payment data, formatted for humans (IBAN groups, QRR groups, `Intl.NumberFormat`).
- 30 s scan timeout with a "Réessayer" button. "Reprendre la photo" goes back to the page step.

## Tech stack

- TypeScript 6, Vite 8, Vitest 4
- One runtime dependency: `jsqr` (~14 KB gzip)
- Custom parser/validators (no `swissqrbill` package — kept the bundle small)
- `@vitejs/plugin-basic-ssl` for HTTPS dev (required by `getUserMedia`)

**Bundle size:** ~158 KB minified, ~57 KB gzip — comfortably under the 250 KB roadmap budget.

## Project layout

```
src/
├── main.ts                       # orchestrates page → qr → final
├── lib/camera.ts                 # shared getUserMedia bootstrap
├── pageCapture/                  # Step 1: full-page photo
│   ├── index.ts                  # mount(rootEl, { onCapture })
│   ├── camera.ts                 # (moved to lib/camera.ts)
│   ├── stability.ts              # PURE: frame difference detector
│   ├── sharpness.ts              # PURE: Laplacian variance
│   ├── stateMachine.ts           # PURE: 4-state FSM (idle/looking/arming/captured)
│   ├── frameSampler.ts           # downscale to grayscale ImageData
│   ├── captureLoop.ts            # 15 FPS loop wiring detectors → FSM → snapshot
│   ├── snapshot.ts               # full-frame JPEG with optional crop
│   ├── cropRegion.ts             # PURE: map on-screen guide → camera-pixel rect
│   └── ui/                       # render, overlay, feedback (flash + vibrate)
└── qrCapture/                    # Step 2: QR decode + validate
    ├── index.ts                  # mount(rootEl, { pageImage, onComplete, onCancel })
    ├── decodeLoop.ts             # jsQR loop with 30 s timeout
    ├── snapshot.ts               # crop QR area with 10% margin
    ├── parse.ts                  # PURE: SPC payload → fields
    ├── validate.ts               # PURE: parsed → QRBillData
    ├── types.ts
    ├── validators/{iban,reference,coherence,amount,address}.ts   # all PURE
    └── ui/{render,result}.ts
```

Pure modules (the ones marked PURE) are unit-tested with Vitest (~91 tests, including 5 fixture-based end-to-end validation tests). The DOM/I/O surface is tested manually in a real browser.

## Local development

```bash
npm install
npm run dev          # https://localhost:5173/  (self-signed cert)
```

Camera APIs require HTTPS, which is why the dev server runs over TLS via `@vitejs/plugin-basic-ssl`. Accept the certificate warning once. To test from a phone on the same LAN, use the `Network` URL Vite prints; the cert needs to be accepted again per device.

```bash
npm test             # all tests, single run
npm run test:watch   # vitest watch mode
npm run typecheck    # tsc --noEmit
npm run build        # tsc --noEmit + vite build into dist/
npm run preview      # serve the production build (HTTPS)
```

## Deployment

Pushes to `main` deploy automatically to GitHub Pages via `.github/workflows/deploy.yml`. The workflow runs `npm ci`, `typecheck`, `test`, `build`, then publishes `dist/` via `actions/deploy-pages`. Pages source must be set to **GitHub Actions** in repo settings (the workflow auto-enables this on first run via `enablement: true`).

The Vite `base` is set to `/readQRbill/` for production builds so asset URLs work under the project-page subpath.

## Browser support

Chrome 90+, Firefox 88+, Safari 14+, Edge 90+, iOS Safari 14+. iOS 14 is the bottom of the supported range — note that `OffscreenCanvas` isn't available there, so the frame sampler uses regular hidden `<canvas>` elements.

## Status vs roadmap

`roadmap.md` is the original spec. Implemented:

- §2.1 — page capture with stability + sharpness auto-capture, manual fallback, A4 overlay, image cropped to guide rectangle
- §2.2 — QR decode + parser + all v2.3 validations (IBAN, QRR/SCOR/NON, coherence, amount, currency, address)
- §3.5 — detection algorithms (mean abs diff, Laplacian variance, mod-10 recursive, mod-97)
- §6.1, 6.4 — Vitest tests on pure logic; manual browser QA on Pages

Out of scope for v1 (per the roadmap): server upload of results, deep-links to banking apps, OCR fallback, perspective correction, torch (low-light), Swico bill-info parsing (passed through as raw string), audio capture-confirmation sound, multi-language UI.

## Design + plan docs

- Camera-access spec: [`docs/superpowers/specs/2026-05-10-camera-access-design.md`](docs/superpowers/specs/2026-05-10-camera-access-design.md)
- QR-scan spec: [`docs/superpowers/specs/2026-05-10-qr-scan-design.md`](docs/superpowers/specs/2026-05-10-qr-scan-design.md)
- Implementation plans: [`docs/superpowers/plans/`](docs/superpowers/plans/)

## License

Not specified yet.
