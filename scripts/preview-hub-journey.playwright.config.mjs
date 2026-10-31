import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: '.',
  testMatch: /preview-hub-journey\.playwright\.spec\.ts/,
  timeout: 180000,
  retries: 0,
  use: {
    headless: true,
    trace: 'off',
    baseURL: 'http://127.0.0.1:4396',
  },
  webServer: {
    command: `node "${join(here, 'preview-hub/journey-server.mjs')}"`,
    cwd: here,
    url: 'http://127.0.0.1:4396/health',
    reuseExistingServer: true,
    timeout: 30000,
    env: {
      ...process.env,
      PREVIEW_HUB_ENABLED: 'true',
      FREE_PREVIEW_FLOW_ENABLED: 'true',
      PREVIEW_HUB_JOURNEY_PORT: '4396',
    },
  },
  reporter: [['list']],
});
