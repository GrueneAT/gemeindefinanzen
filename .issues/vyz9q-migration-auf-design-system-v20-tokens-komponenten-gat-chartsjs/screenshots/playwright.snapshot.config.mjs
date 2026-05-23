// Mini-Playwright-Config nur fuer die Snapshot-Spec dieses Issues.
// Erbt die Server-/Browser-Konfiguration von der Haupt-Config, ueberschreibt
// aber testDir auf das Issue-Verzeichnis, damit der Snapshot-Spec ausserhalb
// von tests/e2e laeuft, ohne von `npm run test:e2e` erfasst zu werden.

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--disable-dev-shm-usage'] },
      },
    },
  ],
  webServer: {
    command: 'node scripts/serve.mjs 8080',
    url: 'http://localhost:8080/web/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    cwd: process.cwd(),
  },
})
