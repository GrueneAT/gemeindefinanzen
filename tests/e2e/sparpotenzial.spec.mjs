// e2e — Sparpotenzial-Tab: Soll-Ist (R3 A+B) und Polster (R4 A+B) blenden
// sich typabhaengig ein/aus. Wechsel des Dokuments triggert die onDocChange-
// Hooks in dashboard.js (data-typ-panel="RA"/"VA").
import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

test('Sparpotenzial-Tab: Soll-Ist und Polster blenden typabhaengig ein',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="sparpotenzial"]').click()
    const panel = page.locator('.tab-panel[data-panel="sparpotenzial"]')
    await expect(panel).toBeVisible()

    // Fixture ist ein VA — Polster-Panels sichtbar, Soll-Ist-Panels hidden.
    await expect(page.locator('#c_polster_a').locator('..').locator('..'))
      .toBeVisible()
    await expect(page.locator('#c_polster_b').locator('..').locator('..'))
      .toBeVisible()

    // Beide Polster-Charts haben ein Canvas (auch wenn der Empty-State
    // gilt, rendert ECharts ein Canvas — Sichtbarkeit gilt fuer den Div).
    await expect(page.locator('#c_polster_a canvas')).toBeVisible()
    await expect(page.locator('#c_polster_b canvas')).toBeVisible()

    // Bei VA sind Soll-Ist-Panels hidden via data-typ-panel="RA".
    const sollistAPanel = page.locator(
      'section.web-panel[data-typ-panel="RA"]').first()
    await expect(sollistAPanel).toBeHidden()
  })
