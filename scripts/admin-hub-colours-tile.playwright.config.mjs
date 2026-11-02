import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /admin-hub-colours-tile\.spec\.ts/,
  timeout: 60000,
  retries: 0,
  use: {
    headless: true,
    trace: 'off',
  },
  reporter: [['list']],
});
