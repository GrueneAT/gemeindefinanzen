// Korpus-Daten-Smoke: prueft dass die UI fuer typische Layout-Varianten
// tatsaechlich Posten extrahiert (nicht nur ohne Crash laedt).

import { test, expect } from '@playwright/test'
import { oeffneApp } from './helpers.mjs'
import { existsSync } from 'node:fs'

test.skip(!existsSync('documents/korpus'),
  'documents/korpus/ nicht vorhanden — Korpus-Test uebersprungen.')

// Erwartete Mindest-Posten je Layout-Familie (großzügig nach unten gewählt —
// echte Werte sind 1000-5000+). Liefert die UI 0 Posten, ist der Test fail.
const PROBEN = [
  // Bundesland-Familie | PDF | min-Pruefungen erwartet
  ['Standard (NÖ)',      'documents/VA-2026-Auflage.pdf',                 5],
  ['2-Wort BGL',         'documents/korpus/burgenland/steinbrunn-va-2023.pdf', 4],
  ['4-stellig VBG',      'documents/korpus/vorarlberg/bregenz-va-2026.pdf',    4],
  ['Salzburg-Header',    'documents/korpus/salzburg/salzburg-va-2026.pdf',     4],
  ['Steyr-Slash OÖ',     'documents/korpus/oberoesterreich/steyr-va-2026.pdf', 4],
  ['Verstreut Stmk',     'documents/korpus/steiermark/murau-va-2026.pdf',      3],
]

test.describe('Korpus-Daten', () => {
  for (const [familie, pdf, minOK] of PROBEN) {
    test(`${familie}: liefert Posten + Pruefstatus`, async ({ page }) => {
      await oeffneApp(page)
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load' }),
        page.locator('#file-input').setInputFiles(pdf),
      ])
      await page.waitForFunction(() => window.__appBereit === true)

      // Dokumentverwaltung aufklappen
      await page.locator('#doc-manager').evaluate((el) => { el.open = true })
      // Pruefstatus lesen — "X/Y Pruefungen"
      const statusText = await page.locator('span.doc-status').first().textContent()
      expect(statusText, `${familie}: Status fehlt`).toMatch(/\d+\/\d+ Pruefungen/)
      const m = statusText.match(/(\d+)\/(\d+) Pruefungen/)
      const ok = parseInt(m[1])
      const total = parseInt(m[2])
      expect(ok, `${familie}: nur ${ok}/${total} OK`).toBeGreaterThanOrEqual(minOK)
    })
  }
})
