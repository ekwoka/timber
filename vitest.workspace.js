import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  './vite.config.ts',
  './packages/walker/vite.config.ts',
  './packages/reactivity/vite.config.ts',
  './packages/timberts/vite.config.ts',
  './packages/core/vite.config.ts',
  './packages/evaluator/vite.config.ts',
]);
