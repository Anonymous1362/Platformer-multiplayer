import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      exclude: ['tests/e2e/**'],
      clearMocks: true,
      restoreMocks: true,
    },
  }),
);
