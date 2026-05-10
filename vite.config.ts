import { defineConfig } from 'vitest/config';
import basicSsl from '@vitejs/plugin-basic-ssl';

// On GitHub Pages the app is served at https://<user>.github.io/readQRbill/, so
// production builds need to prefix asset URLs with the repo name. Dev/preview
// stays at root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/readQRbill/' : '/',
  plugins: [basicSsl()],
  server: {
    https: {},
    host: true,
    port: 5173,
  },
  preview: {
    https: {},
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
}));
