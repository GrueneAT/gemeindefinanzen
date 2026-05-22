// Konfiguration der Browser-e2e-Tests fuer die Web-App (web/).
// Der statische Server scripts/serve.mjs wird ueber webServer automatisch
// gestartet und nach dem Lauf wieder beendet.

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // /dev/shm ist in der Container-Umgebung klein — sonst stuerzt
        // Chromium ab. Nur das gebuendelte chromium nutzen (kein Chrome-Kanal).
        launchOptions: { args: ['--disable-dev-shm-usage'] },
      },
    },
  ],
  webServer: {
    command: 'node scripts/serve.mjs 8080',
    url: 'http://localhost:8080/web/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
