import { defineConfig, devices } from '@playwright/test';

// Locally, point CHROME_PATH at an installed Chrome and set PW_CHROMIUM_ONLY=1 if WebKit is not installed.
const chromePath = process.env['CHROME_PATH'];
const chromiumOnly = process.env['PW_CHROMIUM_ONLY'] === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          ...(chromePath ? { executablePath: chromePath } : {}),
          args: [
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
          ],
        },
      },
    },
    ...(chromiumOnly ? [] : [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }]),
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
