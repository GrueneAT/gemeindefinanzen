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
    // Erweiterte Validierung: 52 Pruefungen je Dokument (10 SU x 3 Spalten +
    // 7 SA-Identitaeten x 3 Spalten + 1 Strukturpruefung). Herzogenburg-VA
    // ist Referenz mit 52/52 OK.
    await expect(status).toHaveText('52/52 Pruefungen')
  })
