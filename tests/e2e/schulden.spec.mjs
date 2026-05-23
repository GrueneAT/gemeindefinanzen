// e2e — Schulden & Finanzierung als neuer Tab (Variante A + B fuer R2,
// Variante A + B fuer R12). Pro Variante muss ein Canvas sichtbar sein.
import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

test('Schulden-Tab oeffnet und alle Variante-Charts sind sichtbar',
  async ({ page }) => {
    await ladeFixturePdf(page)

    // Tab-Button vorhanden und klickbar.
    const tabBtn = page.locator('.tab-btn[data-tab="schulden"]')
    await expect(tabBtn).toBeVisible()
    await tabBtn.click()
    await expect(tabBtn).toHaveClass(/is-active/)

    const panel = page.locator('.tab-panel[data-panel="schulden"]')
    await expect(panel).toBeVisible()

    // R2 Variante A: drei Panels (Saeulen, Stand-Linie, ...)
    await expect(page.locator('#c_fin_saeulen canvas')).toBeVisible()
    await expect(page.locator('#c_schuldenstand canvas')).toBeVisible()
    // R2 Variante B: Combo-Chart
    await expect(page.locator('#c_fin_combo canvas')).toBeVisible()

    // R12 Variante A + B
    await expect(page.locator('#c_investfin_a canvas')).toBeVisible()
    await expect(page.locator('#c_investfin_b canvas')).toBeVisible()

    // Schuldendienst-Karte ist sichtbar.
    await expect(page.locator('#st-schuldendienst')).toBeVisible()
    await expect(page.locator('#st-schuldendienst')).not.toHaveText('')
  })
