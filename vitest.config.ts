import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/{unit,sim,input,net,golden}/**/*.test.ts'],
  },
});
