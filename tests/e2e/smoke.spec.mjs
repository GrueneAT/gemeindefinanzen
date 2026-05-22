import { test, expect } from '@playwright/test'
import { oeffneApp } from './helpers.mjs'

test('Seite laedt ohne Boot-Fehlerbanner', async ({ page }) => {
  await oeffneApp(page)
  await expect(page.locator('#boot-banner')).toHaveCount(0)
})
