// e2e — Schulden & Finanzierung Tab.
// Layout: Aufnahme/Tilgung-Saeulen + kumulierter Schuldenstand
// nebeneinander in einem .dash-grid. Combo-Chart-Variante entfernt.
import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

test('Schulden-Tab oeffnet und beide Diagramme sind nebeneinander sichtbar',
  async ({ page }) => {
    await ladeFixturePdf(page)

    const tabBtn = page.locator('.tab-btn[data-tab="schulden"]')
    await expect(tabBtn).toBeVisible()
    await tabBtn.click()
    await expect(tabBtn).toHaveClass(/is-active/)

    const panel = page.locator('.tab-panel[data-panel="schulden"]')
    await expect(panel).toBeVisible()

    // Beide Diagramme sind sichtbar — Saeulen-Chart + Schuldenstand-Linie.
    await expect(page.locator('#c_fin_saeulen canvas')).toBeVisible()
    await expect(page.locator('#c_schuldenstand canvas')).toBeVisible()

    // Combo-Chart wurde entfernt: kein #c_fin_combo mehr im Markup.
    await expect(page.locator('#c_fin_combo')).toHaveCount(0)

    // Beide Panels liegen in einem .dash-grid (zweispaltiges Layout).
    const grid = panel.locator('.dash-grid:has(#c_fin_saeulen)')
    await expect(grid.locator('#c_schuldenstand')).toHaveCount(1)

    // Schuldendienst-Karte ist sichtbar.
    await expect(page.locator('#st-schuldendienst')).toBeVisible()
    await expect(page.locator('#st-schuldendienst')).not.toHaveText('')
  })
