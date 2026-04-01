import { defineConfig } from 'vite';

// Production build for the renderer (React frontend).
// Outputs to dist/renderer/main_window/ to match the path
// expected by the main process loadFile() call.
// base: './' ensures asset paths are relative, which is required
// for Electron's loadFile() to resolve them inside the asar archive.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist/renderer/main_window',
    emptyOutDir: true,
  },
});
