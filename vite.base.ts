/// <reference types="vitest" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import ExternalDeps from 'vite-plugin-external-deps';

export const makeConfig = (dirname: string) =>
  defineConfig({
    root: resolve(dirname),
    plugins: [
      dts({
        entryRoot: resolve(dirname, 'src'),
        tsconfigPath: resolve(dirname, 'tsconfig.json'),
      }),
      ExternalDeps(),
    ],
    define: {
      'import.meta.vitest': 'undefined',
    },
    build: {
      target: 'esnext',
      outDir: resolve(dirname, 'dist'),
      lib: {
        entry: resolve(dirname, 'src', 'index.ts'),
        formats: ['es'],
      },
      minify: false,
      sourcemap: true,
      rollupOptions: {
        output: {
          preserveModules: true,
          preserveModulesRoot: 'src',
          entryFileNames: ({ name: fileName }) => {
            return `${fileName}.js`;
          },
        },
        external: [/node_modules/],
      },
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
