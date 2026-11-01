import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: '.',
  testMatch: /admin-hub-qa\.spec\.ts/,
  timeout: 180000,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
    trace: 'off',
    actionTimeout: 20000,
    navigationTimeout: 60000,
    baseURL: 'http://127.0.0.1:4397',
  },
  webServer: {
    command: `node "${join(here, 'preview-hub/start-real-qa.mjs')}" --serve --admin-hub`,
    cwd: join(here, '..'),
    url: 'http://127.0.0.1:4397/preview-hub-qa/health',
    reuseExistingServer: true,
    timeout: 240000,
  },
  reporter: [['list']],
});
