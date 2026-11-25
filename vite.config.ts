import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the same build works in the Android app and under a sub-path on a web host.
  base: './',
  plugins: [preact()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: { host: true },
});
