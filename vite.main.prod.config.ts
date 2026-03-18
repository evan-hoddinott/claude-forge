import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';

// Production build for the Electron main process.
// Outputs a single CJS bundle to dist/build/main.js.
export default defineConfig({
  build: {
    outDir: 'dist/build',
    emptyOutDir: false,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: 'src/main.ts',
      output: {
        format: 'cjs',
        entryFileNames: 'main.js',
        inlineDynamicImports: true,
      },
      external: [
        'electron',
        'electron-squirrel-startup',
        'electron-store',
        'electron-updater',
        'electron-log',
        'uuid',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
  },
  define: {
    // These globals are normally injected by electron-forge's Vite plugin.
    // In production builds we define them directly.
    MAIN_WINDOW_VITE_DEV_SERVER_URL: JSON.stringify(''),
    MAIN_WINDOW_VITE_NAME: JSON.stringify('main_window'),
  },
});
