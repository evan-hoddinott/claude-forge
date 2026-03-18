import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';

// Production build for the Electron preload script.
// Outputs CJS bundle to dist/build/preload.js.
export default defineConfig({
  build: {
    outDir: 'dist/build',
    emptyOutDir: false,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: 'src/preload.ts',
      output: {
        format: 'cjs',
        entryFileNames: 'preload.js',
      },
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
  },
});
