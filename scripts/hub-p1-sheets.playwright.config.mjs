import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: '.',
  testMatch: /hub-p1-sheets\.spec\.ts/,
  timeout: 60000,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
    trace: 'off',
  },
  reporter: [['list']],
});
