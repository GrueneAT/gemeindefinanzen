import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

test('PDF-Upload fuellt die Dokumentliste mit gruenem Pruefstatus',
  async ({ page }) => {
    await ladeFixturePdf(page)
    // mupdf-Parsing dauert Sekunden — grosszuegiges Timeout.
    await expect(page.locator('#doc-tbody tr')).toHaveCount(1, {
      timeout: 30000,
    })
    // Mit geladenem Dokument klappt die Dokumentverwaltung zu — fuer die
    // Sichtbarkeitspruefung des Pruefstatus wieder aufklappen.
    await page.locator('#doc-manager').evaluate((el) => { el.open = true })
    const status = page.locator('span.doc-status.ok').first()
    await expect(status).toBeVisible()
    await expect(status).toHaveText('5/5 Pruefungen')
  })
