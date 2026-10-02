import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4321';

export default defineConfig({
  testDir: '.',
  testMatch: /marketing-scroll-nav\.spec\.ts/,
  timeout: 180000,
  retries: 0,
  use: { headless: true, trace: 'off', baseURL },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npx astro dev --host 127.0.0.1 --port 4321',
        url: 'http://127.0.0.1:4321/',
        reuseExistingServer: true,
        timeout: 120000,
      },
  reporter: [['list']],
});
