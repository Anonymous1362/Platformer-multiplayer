import { readFileSync } from 'node:fs';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  // Relative paths so the same build works in the Android app and under a sub-path on a web host.
  base: './',
  plugins: [preact()],
  // Build ID for diagnostics (spec 19.2).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: 'es2022',
    // Built code goes to dist/app so dist/assets holds only game assets and the manifest.
    assetsDir: 'app',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: { host: true },
});
