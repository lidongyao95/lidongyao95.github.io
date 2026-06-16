import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 10000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:4321',
    headless: true,
  },
  webServer: {
    command: 'npx astro preview --port 4321',
    port: 4321,
    reuseExistingServer: true,
    timeout: 15000,
  },
});
