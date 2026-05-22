import { test, expect } from '@playwright/test'
import { oeffneApp } from './helpers.mjs'

test('Footer zeigt den Build-Commit', async ({ page }) => {
  await oeffneApp(page)
  const stamp = page.locator('#build-stamp')
  // zeigeBuildStempel() laedt version.json asynchron — auf den gefuellten
  // Text warten, nicht allein auf __appBereit.
  await expect(stamp).not.toBeEmpty()
  await expect(stamp).toBeVisible()

  const expected = process.env.EXPECTED_COMMIT
  if (expected) {
    // In CI: der Stempel muss den erwarteten Commit enthalten.
    await expect(stamp).toContainText(expected.slice(0, 7))
  } else {
    // Lokal: ohne CI-Stempel steht hier "Build dev".
    await expect(stamp).toContainText('Build')
  }
})
