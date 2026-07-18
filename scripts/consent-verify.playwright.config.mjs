import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /consent-verify\.spec\.ts/,
  timeout: 120000,
  retries: 0,
  use: {
    headless: true,
    trace: 'off',
  },
  reporter: [['list']],
});
