import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

test('Dashboard ist sichtbar, Tabs schalten um, Charts rendern',
  async ({ page }) => {
    await ladeFixturePdf(page)

    await expect(page.locator('#dashboard-inhalt')).toBeVisible()
    await expect(page.locator('#dashboard-leer')).toBeHidden()

    // Charts auf dem Ueberblick-Panel (Standard-Tab) rendern Canvas.
    await expect(page.locator('#c_sankey canvas')).toBeVisible()
    await expect(page.locator('#c_wasserfall canvas')).toBeVisible()

    // Tab-Wechsel auf Einnahmen.
    await page.locator('.tab-btn[data-tab="einnahmen"]').click()
    await expect(page.locator('.tab-btn[data-tab="einnahmen"]'))
      .toHaveClass(/is-active/)
    await expect(page.locator('.tab-panel[data-panel="einnahmen"]'))
      .toBeVisible()
  })
