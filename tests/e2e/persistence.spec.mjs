import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

test('Persistenz ueberlebt einen Reload', async ({ page }) => {
  // Upload und Reload bleiben in EINEM Page/Context — sonst geht die
  // IndexedDB-Persistenz zwischen den Kontexten verloren.
  await ladeFixturePdf(page)
  await expect(page.locator('#doc-tbody tr')).toHaveCount(1, {
    timeout: 30000,
  })

  await page.reload()
  await page.waitForFunction(() => window.__appBereit === true)

  await expect(page.locator('#doc-tbody tr')).toHaveCount(1)
})
