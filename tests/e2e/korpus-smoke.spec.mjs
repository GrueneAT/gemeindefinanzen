// Ad-hoc-Smoke: laed mehrere Korpus-PDFs in die UI und prueft auf
// JS-Konsolen-Errors. Kein erfolgreicher Assert auf Validierungs-Quote —
// nur dass die App ohne Crash rendert.

import { test, expect } from '@playwright/test'
import { oeffneApp } from './helpers.mjs'
import { existsSync } from 'node:fs'

// Korpus-Tests laufen nur lokal — documents/korpus/ ist nicht commited.
test.skip(!existsSync('documents/korpus'),
  'documents/korpus/ nicht vorhanden — Korpus-Test uebersprungen.')

const PROBEN = [
  'documents/korpus/burgenland/steinbrunn-va-2023.pdf',       // 2-Wort-Modus
  'documents/korpus/vorarlberg/bregenz-va-2026.pdf',         // 4-stellig
  'documents/korpus/salzburg/salzburg-va-2026.pdf',          // Header-Ansatz
  'documents/korpus/tirol/innsbruck-va-2026.pdf',            // großer Detail
  'documents/korpus/oberoesterreich/steyr-va-2026.pdf',      // Steyr-Slash
  'documents/korpus/steiermark/murau-va-2026.pdf',           // verstreuter Detail-Block
]

test.describe('Korpus-PDF-Smoke', () => {
  for (const pdf of PROBEN) {
    test(`ladbar ohne JS-Errors: ${pdf.split('/').slice(-2).join('/')}`,
      async ({ page }) => {
        // Wir akzeptieren mupdf-Strukturwarnungen ("structure tree broken" etc.) —
        // sind generierte Notes, kein echter Crash. Echte JS-Errors (pageerror,
        // TypeError, ReferenceError) sollen aber das Limit nicht ueberschreiten.
        const errors = []
        const MUPDF_NOISE = /structure tree|No common ancestor|format error/i
        page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
        page.on('console', m => {
          if (m.type() === 'error' && !MUPDF_NOISE.test(m.text())) {
            errors.push(`console.error: ${m.text()}`)
          }
        })

        await oeffneApp(page)
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'load' }),
          page.locator('#file-input').setInputFiles(pdf),
        ])
        await page.waitForFunction(() => window.__appBereit === true)
        await expect(page.locator('#doc-tbody tr')).toHaveCount(1, { timeout: 30000 })
        expect(errors, `JS-Errors:\n${errors.join('\n')}`).toEqual([])
      })
  }
})
