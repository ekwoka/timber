/// <reference types="vitest" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(__dirname, 'sandbox'),
  plugins: [],
  build: {
    target: 'esnext',
  },
  resolve: {
    conditions: ['typescript', 'import', 'module', 'browser', 'default'],
  },
  test: {
    globals: true,
    include: ['./**/*{.spec,.test}.{ts,tsx}'],
    includeSource: ['./**/*.{ts,tsx}'],
    reporters: ['dot'],
    deps: {},
    passWithNoTests: true,
  },
});
