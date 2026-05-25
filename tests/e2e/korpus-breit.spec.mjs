// Breit-Test: 12 PDFs aus 2025/2026 quer durch alle Bundeslaender.
// Pro PDF wird gemessen wie viele Posten die UI extrahiert und ob
// Pruefstatus angezeigt wird.

import { test, expect } from '@playwright/test'
import { oeffneApp } from './helpers.mjs'
import { existsSync } from 'node:fs'

test.skip(!existsSync('documents/korpus'),
  'documents/korpus/ nicht vorhanden — Korpus-Test uebersprungen.')

const PROBEN = [
  'documents/korpus/burgenland/pinkafeld-va-2026.pdf',
  'documents/korpus/burgenland/oberwart-ra-2025.pdf',
  'documents/korpus/kaernten/villach-va-2026.pdf',
  'documents/korpus/niederoesterreich/klosterneuburg-va-2026.pdf',
  'documents/korpus/niederoesterreich/wiener-neustadt-va-2026.pdf',
  'documents/korpus/oberoesterreich/braunau-am-inn-va-2026.pdf',
  'documents/korpus/oberoesterreich/traun-va-2026.pdf',
  'documents/korpus/salzburg/salzburg-ra-2025.pdf',
  'documents/korpus/steiermark/feldbach-nva-2025.pdf',
  'documents/korpus/tirol/lienz-va-2025.pdf',
  'documents/korpus/tirol/telfs-ra-2025.pdf',
  'documents/korpus/vorarlberg/dornbirn-va-2026.pdf',
  'documents/korpus/vorarlberg/feldkirch-va-2026.pdf',
  'documents/korpus/vorarlberg/hohenems-va-2026.pdf',
]

test.describe('Breite Probe 2025/2026', () => {
  for (const pdf of PROBEN) {
    test(`extrahiert Daten: ${pdf.split('/').slice(-2).join('/')}`,
      async ({ page }) => {
        await oeffneApp(page)
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'load' }),
          page.locator('#file-input').setInputFiles(pdf),
        ])
        await page.waitForFunction(() => window.__appBereit === true)

        await page.locator('#doc-manager').evaluate((el) => { el.open = true })
        const statusText = await page.locator('span.doc-status').first().textContent()
        // Mindestbedingung: Pruefstatus angezeigt UND OK > 0
        expect(statusText).toMatch(/\d+\/\d+ Pruefungen/)
        const [, ok] = statusText.match(/(\d+)\/(\d+) Pruefungen/)
        expect(parseInt(ok), `${pdf}: nur ${ok} OK`).toBeGreaterThan(0)
      })
  }
})
