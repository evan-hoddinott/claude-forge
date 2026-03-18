import { defineConfig } from 'vite';

// Production build for the renderer (React frontend).
// Outputs to dist/renderer/main_window/ to match the path
// expected by the main process loadFile() call.
export default defineConfig({
  build: {
    outDir: 'dist/renderer/main_window',
    emptyOutDir: true,
  },
});
