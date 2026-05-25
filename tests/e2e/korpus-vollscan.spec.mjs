// Vollkorpus-UI-Smoke: lädt jede PDF aus documents/korpus/ in EINER
// Browser-Session in die UI und protokolliert Posten-Anzahl + Pruefstatus.
// Schreibt Bericht nach documents/_ui_vollscan.json.
//
// Ein einziger Playwright-Test damit der eingebettete Server nicht zwischen
// Tests neu startet (Connection-Refused-Problem bei massivem Parallel-Lauf).

import { test } from '@playwright/test'
import { oeffneApp } from './helpers.mjs'
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const KORPUS = 'documents/korpus'
const BERICHT = 'documents/_ui_vollscan.json'

test.skip(!existsSync(KORPUS),
  'documents/korpus/ nicht vorhanden — Vollscan uebersprungen.')

function sammlePdfs(wurzel) {
  const pdfs = []
  for (const bl of readdirSync(wurzel)) {
    const blPath = join(wurzel, bl)
    if (!statSync(blPath).isDirectory()) continue
    for (const f of readdirSync(blPath)) {
      if (f.endsWith('.pdf')) pdfs.push(join(blPath, f))
    }
  }
  return pdfs.sort()
}

test('UI-Vollscan über alle Korpus-PDFs', async ({ page }) => {
  test.setTimeout(60 * 60 * 1000) // 60 Min Gesamttimeout

  const PDFS = sammlePdfs(KORPUS)
  const ergebnisse = []
  const MUPDF_NOISE = /structure tree|No common ancestor|format error/i

  for (let i = 0; i < PDFS.length; i++) {
    const pdf = PDFS[i]
    const start = Date.now()
    const errors = []
    const handlers = {
      pe: e => errors.push(`pe: ${e.message.slice(0, 80)}`),
      ce: m => {
        if (m.type() === 'error' && !MUPDF_NOISE.test(m.text())) {
          errors.push(`err: ${m.text().slice(0, 80)}`)
        }
      },
    }
    page.on('pageerror', handlers.pe)
    page.on('console', handlers.ce)

    let ok = 0, total = 0, detail = 0
    try {
      await oeffneApp(page)
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }),
        page.locator('#file-input').setInputFiles(pdf),
      ])
      await page.waitForFunction(() => window.__appBereit === true, { timeout: 90000 })
      await page.locator('#doc-manager').evaluate((el) => { el.open = true })

      const statusText = await page.locator('span.doc-status').first()
        .textContent({ timeout: 30000 })
      const m = (statusText || '').match(/(\d+)\/(\d+) Pruefungen/)
      if (m) { ok = parseInt(m[1]); total = parseInt(m[2]) }
      const detailZelle = await page.locator('#doc-tbody tr td:nth-child(3)')
        .first().textContent()
      detail = parseInt((detailZelle || '0').replace(/\D/g, '')) || 0

      // IndexedDB leeren fuer den naechsten Durchlauf
      await page.evaluate(() => new Promise((res) => {
        indexedDB.deleteDatabase('gemeindefinanzen').onsuccess = () => res()
      }))
    } catch (e) {
      errors.push(`exception: ${e.message.slice(0, 200)}`)
    } finally {
      page.off('pageerror', handlers.pe)
      page.off('console', handlers.ce)
    }

    const eintrag = {
      pdf, ok, total, detail,
      dauer_s: Math.round((Date.now() - start) / 100) / 10,
      fehler: errors.slice(0, 3),
    }
    ergebnisse.push(eintrag)
    if ((i + 1) % 10 === 0 || i === PDFS.length - 1) {
      writeFileSync(BERICHT, JSON.stringify(ergebnisse, null, 2))
      console.log(`[${i + 1}/${PDFS.length}] ${pdf.split('/').slice(-2).join('/')}: ` +
        `${detail} Posten, ${ok}/${total} OK, ${errors.length} errors`)
    }
  }

  writeFileSync(BERICHT, JSON.stringify(ergebnisse, null, 2))
  const ok100 = ergebnisse.filter(e => e.total > 0 && e.ok === e.total).length
  const teil = ergebnisse.filter(e => e.detail > 0 && e.ok < e.total).length
  const leer = ergebnisse.filter(e => e.detail === 0 && !e.fehler.length).length
  const fail = ergebnisse.filter(e => e.fehler.length > 0).length
  console.log(`\n=== Vollscan: ${ergebnisse.length} PDFs ===`)
  console.log(`  100% OK:     ${ok100}`)
  console.log(`  Mit Daten:   ${teil}`)
  console.log(`  Leer:        ${leer}`)
  console.log(`  Errors:      ${fail}`)
})
