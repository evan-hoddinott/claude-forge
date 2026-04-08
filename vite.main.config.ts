import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';

// Dev + electron-forge production build config for the Electron main process.
// Externalise ESM/native packages so Vite doesn't try to bundle them as CJS —
// electron-store, electron-updater, and electron-log are all pure ESM and will
// throw "X is not a constructor" if bundled.
export default defineConfig({
  build: {
    rollupOptions: {
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
});
