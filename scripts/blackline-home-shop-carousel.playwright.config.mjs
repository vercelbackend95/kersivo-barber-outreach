import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /blackline-home-shop-carousel\.spec\.ts/,
  timeout: 120000,
  retries: 0,
  use: {
    headless: true,
    trace: 'off',
    baseURL: 'http://127.0.0.1:4321',
  },
  webServer: {
    command: 'npx astro dev --host 127.0.0.1 --port 4321',
    url: 'http://127.0.0.1:4321/demo',
    reuseExistingServer: true,
    timeout: 120000,
  },
  reporter: [['list']],
});
