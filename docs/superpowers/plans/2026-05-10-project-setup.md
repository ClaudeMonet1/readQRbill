# Project Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a Vite + TypeScript + Vitest project skeleton that serves over HTTPS (required for `getUserMedia`) and runs a passing smoke test, ready for QR-bill scanner implementation.

**Architecture:** Vanilla TS web app, no framework. Vite handles dev server (with self-signed HTTPS via `@vitejs/plugin-basic-ssl`), bundling, and Vitest test running. Runtime dependencies (`jsQR`, `swissqrbill`) are deferred to the implementation plan — this plan only stands up tooling and a working `index.html` shell.

**Tech Stack:** Node.js, npm, Vite 5+, TypeScript 5+, Vitest 1+, `@vitejs/plugin-basic-ssl`.

---

## File Structure

```
readQRbill/
├── .gitignore                # Node/Vite/IDE ignores
├── package.json              # Scripts + devDependencies
├── tsconfig.json             # Strict TS, ES2022 target, DOM lib
├── vite.config.ts            # Vite + Vitest + HTTPS plugin
├── index.html                # Vite entry point, loads /src/main.ts
├── src/
│   ├── main.ts               # App entry, mounts a hello banner
│   └── version.ts            # Exported VERSION constant (smoke target)
└── tests/
    └── version.test.ts       # Smoke test for Vitest wiring
```

Each file has one responsibility:
- `tsconfig.json` — compiler config only
- `vite.config.ts` — dev server, build, AND vitest config (single source of truth)
- `index.html` — HTML shell only, no inline JS beyond the module script tag
- `src/main.ts` — entry point that asserts the toolchain works end-to-end in the browser
- `src/version.ts` — trivial pure module used to verify imports compile and tests pick it up
- `tests/version.test.ts` — single smoke test

Runtime dependencies (`jsQR`, `swissqrbill`) and feature source files are intentionally **out of scope** for this plan. They land in the next plan.

---

## Task 1: Initialize npm project and git

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Verify working directory is empty (except roadmap.md and docs/)**

Run: `ls -A /home/llm/readQRbill`
Expected: only `roadmap.md` and `docs` are present. No `package.json`, no `.git`.

- [ ] **Step 2: Initialize git repository**

Run: `git -C /home/llm/readQRbill init -b main`
Expected: `Initialized empty Git repository in /home/llm/readQRbill/.git/`

- [ ] **Step 3: Create `.gitignore`**

Path: `/home/llm/readQRbill/.gitignore`

```
node_modules/
dist/
.vite/
coverage/
*.log
.DS_Store
.env
.env.local
.idea/
.vscode/
```

- [ ] **Step 4: Initialize `package.json`**

Run: `cd /home/llm/readQRbill && npm init -y`
Then edit the generated `package.json` to this exact content:

```json
{
  "name": "read-qr-bill",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Web-based Swiss QR-bill scanner (camera + jsQR + swissqrbill validation)",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {}
}
```

- [ ] **Step 5: Verify package.json is valid**

Run: `cd /home/llm/readQRbill && node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))" && echo OK`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
cd /home/llm/readQRbill
git add .gitignore package.json
git commit -m "chore: initialize npm project and gitignore"
```

---

## Task 2: Install dev dependencies

**Files:**
- Modify: `package.json` (devDependencies populated by npm)
- Create: `package-lock.json` (auto)

- [ ] **Step 1: Install Vite, TypeScript, Vitest, and the SSL plugin**

Run:
```bash
cd /home/llm/readQRbill
npm install --save-dev vite typescript vitest @vitejs/plugin-basic-ssl @types/node
```

Expected: dependencies install without errors. `package.json` now has a populated `devDependencies` section. `node_modules/` and `package-lock.json` exist.

- [ ] **Step 2: Verify versions are recent (>= the major versions assumed by this plan)**

Run:
```bash
cd /home/llm/readQRbill
node -e "const p=require('./package.json'); for (const [k,v] of Object.entries(p.devDependencies)) console.log(k, v)"
```

Expected output includes (versions may be newer):
- `vite ^5.x` or higher
- `typescript ^5.x` or higher
- `vitest ^1.x` or higher
- `@vitejs/plugin-basic-ssl ^1.x` or higher
- `@types/node ^20.x` or higher

If any package resolved below these majors, re-run `npm install --save-dev <pkg>@latest`.

- [ ] **Step 3: Commit**

```bash
cd /home/llm/readQRbill
git add package.json package-lock.json
git commit -m "chore: add Vite, TypeScript, Vitest dev dependencies"
```

(Do **not** commit `node_modules/` — it's already in `.gitignore`.)

---

## Task 3: Configure TypeScript

**Files:**
- Create: `tsconfig.json`

- [ ] **Step 1: Create `tsconfig.json`**

Path: `/home/llm/readQRbill/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "vitest/globals", "node"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": false,
    "noEmit": true,
    "useDefineForClassFields": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*", "tests/**/*", "vite.config.ts"]
}
```

- [ ] **Step 2: Verify tsc is happy with the empty config (no source files yet)**

Run: `cd /home/llm/readQRbill && npx tsc --noEmit`
Expected: command exits 0 with no output. (If it complains "no inputs found" that's OK — the include glob matches nothing yet. If you get that error specifically, proceed; it'll be resolved in Task 5 when source files are created.)

- [ ] **Step 3: Commit**

```bash
cd /home/llm/readQRbill
git add tsconfig.json
git commit -m "chore: configure strict TypeScript"
```

---

## Task 4: Configure Vite + Vitest

**Files:**
- Create: `vite.config.ts`

- [ ] **Step 1: Create `vite.config.ts`**

Path: `/home/llm/readQRbill/vite.config.ts`

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    https: true,
    host: true,
    port: 5173,
  },
  preview: {
    https: true,
    host: true,
    port: 4173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    reportCompressedSize: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
});
```

Notes for the implementer:
- `server.host: true` exposes the dev server on the LAN so you can test from a phone. iOS Safari refuses self-signed certs on `localhost` but will work on a LAN IP after accepting the warning once.
- `test.globals: false` keeps Vitest globals off — tests must `import` from `vitest`.

- [ ] **Step 2: Typecheck the config**

Run: `cd /home/llm/readQRbill && npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
cd /home/llm/readQRbill
git add vite.config.ts
git commit -m "chore: configure Vite dev server with HTTPS and Vitest"
```

---

## Task 5: Create minimal app shell (index.html + main.ts + version.ts)

**Files:**
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/version.ts`

- [ ] **Step 1: Create `src/version.ts`**

Path: `/home/llm/readQRbill/src/version.ts`

```ts
export const VERSION = '0.1.0';
```

- [ ] **Step 2: Create `src/main.ts`**

Path: `/home/llm/readQRbill/src/main.ts`

```ts
import { VERSION } from './version';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Missing #app root element');
}

root.textContent = `readQRbill v${VERSION} — toolchain OK`;
```

- [ ] **Step 3: Create `index.html`**

Path: `/home/llm/readQRbill/index.html`

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>readQRbill</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: Typecheck**

Run: `cd /home/llm/readQRbill && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
cd /home/llm/readQRbill
git add index.html src/main.ts src/version.ts
git commit -m "feat: add minimal HTML shell and TS entry point"
```

---

## Task 6: Smoke test for Vitest

**Files:**
- Create: `tests/version.test.ts`

- [ ] **Step 1: Write the failing test**

Path: `/home/llm/readQRbill/tests/version.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/version';

describe('VERSION constant', () => {
  it('matches semantic version pattern', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is the expected initial version', () => {
    expect(VERSION).toBe('0.1.0');
  });
});
```

- [ ] **Step 2: Run the test — it should pass on the first try because version.ts already exists**

Run: `cd /home/llm/readQRbill && npm test`
Expected: Vitest reports `2 passed` and exits 0. (We're not strictly TDD-ing the smoke test because it exists only to verify the runner is wired up.)

If the runner reports `0 tests found`: check `vite.config.ts` `test.include` and the file path under `tests/`.
If the runner can't find `vitest`: re-run `npm install`.

- [ ] **Step 3: Commit**

```bash
cd /home/llm/readQRbill
git add tests/version.test.ts
git commit -m "test: add smoke test verifying Vitest is wired up"
```

---

## Task 7: Verify build output and capture baseline bundle size

**Files:**
- (No new files — just running and recording)

- [ ] **Step 1: Run the production build**

Run: `cd /home/llm/readQRbill && npm run build`
Expected: build succeeds; output goes to `dist/`. Vite prints a size table like:
```
dist/index.html                 0.x kB
dist/assets/index-XXXX.js       1–3 kB │ gzip: <1 kB
```

- [ ] **Step 2: Confirm dist contents**

Run: `cd /home/llm/readQRbill && ls -la dist/ dist/assets/`
Expected: `index.html` plus a small JS bundle in `assets/`. No errors.

- [ ] **Step 3: Record baseline size**

Run: `cd /home/llm/readQRbill && du -b dist/assets/*.js | awk '{print $1}'`
Expected: a number in bytes well under 10 KB. This is the empty-app baseline; the roadmap's <250 KB total budget will be re-checked as runtime deps are added.

Write the number down in the commit message of the next step for future reference.

- [ ] **Step 4: Commit (no file changes — use `--allow-empty` to record the baseline as a marker)**

```bash
cd /home/llm/readQRbill
git commit --allow-empty -m "chore: baseline production build verified

Empty-shell bundle size: <RECORDED_BYTES> bytes.
Budget per roadmap: <250 KB total once jsQR + swissqrbill are added."
```

Replace `<RECORDED_BYTES>` with the number from step 3.

---

## Task 8: Verify dev server starts over HTTPS

**Files:**
- (No new files — manual smoke check of the dev server)

- [ ] **Step 1: Start the dev server in the background**

Run: `cd /home/llm/readQRbill && npm run dev &`
Wait ~2 seconds for Vite to print its ready message.

Expected output contains: `Local: https://localhost:5173/` (note the **https**, not http — confirms `@vitejs/plugin-basic-ssl` activated).

- [ ] **Step 2: Probe the dev server with curl**

Run: `curl -k -sS -o /dev/null -w "%{http_code}\n" https://localhost:5173/`
Expected: `200`

(`-k` accepts the self-signed cert. This proves the server is up *and* serving over TLS.)

- [ ] **Step 3: Confirm `index.html` is served**

Run: `curl -k -sS https://localhost:5173/ | grep -c 'id="app"'`
Expected: `1`

- [ ] **Step 4: Stop the dev server**

Run: `pkill -f "vite" || true`
Expected: returns 0 whether or not anything was killed.

- [ ] **Step 5: Commit (empty marker — confirms manual verification done)**

```bash
cd /home/llm/readQRbill
git commit --allow-empty -m "chore: verified Vite HTTPS dev server serves index.html"
```

---

## Verification Checklist

After all tasks complete, run these in order from `/home/llm/readQRbill`. All must succeed:

- [ ] `npm run typecheck` → exits 0
- [ ] `npm test` → 2 passed
- [ ] `npm run build` → builds successfully, dist/ created
- [ ] `git log --oneline` → shows ~8 commits, one per task
- [ ] `git status` → working tree clean

If any fails, that task's verification step missed something — go back and fix before declaring setup complete.

---

## Out of Scope (intentionally deferred)

These are part of the **next** plan, not this one:
- Installing `jsQR`, `swissqrbill`
- Camera access (`getUserMedia`)
- Stability/sharpness detection
- QR-bill parser/validators
- UI components and overlays
- ESLint / Prettier (add when team conventions are decided)
- CI configuration
- Bundle size enforcement in CI
