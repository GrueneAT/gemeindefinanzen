import { test, expect } from '@playwright/test'
import { oeffneApp, wartebisDashboardBereit } from './helpers.mjs'

const CSV_EHH = 'documents/offenerhaushalt_30201_2026_va_ehh.csv'
const CSV_FHH = 'documents/offenerhaushalt_30201_2026_va_fhh.csv'

test('CSV-Paar EHH+FHH gemeinsam hochgeladen erzeugt ein Dokument',
  async ({ page }) => {
    await oeffneApp(page)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.locator('#file-input').setInputFiles([CSV_EHH, CSV_FHH]),
    ])
    await page.waitForFunction(() => window.__appBereit === true)
    await wartebisDashboardBereit(page)

    // Genau eine Zeile in der Dokumentliste — beide CSVs gehoeren fachlich
    // zusammen und werden zu einem Dokument zusammengefuehrt.
    await expect(page.locator('#doc-tbody tr')).toHaveCount(1, {
      timeout: 30000,
    })
    await page.locator('#doc-manager').evaluate((el) => { el.open = true })
    const status = page.locator('span.doc-status.ok').first()
    await expect(status).toBeVisible()
    // 52 Pruefungen — synthetische SU/SA aus den Detail-Posten lassen
    // dieselbe Plausibilitaetspruefung wie beim PDF-Pfad durchlaufen.
    await expect(status).toHaveText('52/52 Pruefungen')

    // Quelldatei-Spalte listet beide CSV-Dateien.
    const quelle = page.locator('#doc-tbody tr td').nth(1)
    await expect(quelle).toContainText('ehh.csv')
    await expect(quelle).toContainText('fhh.csv')
  })

test('CSV-Nachreichung: EHH zuerst, dann FHH zu einem Dokument',
  async ({ page }) => {
    await oeffneApp(page)
    // Erst nur EHH hochladen.
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.locator('#file-input').setInputFiles([CSV_EHH]),
    ])
    await page.waitForFunction(() => window.__appBereit === true)
    await wartebisDashboardBereit(page)
    await page.locator('#doc-manager').evaluate((el) => { el.open = true })
    await expect(page.locator('#doc-tbody tr')).toHaveCount(1)

    // FHH nachreichen — soll an dasselbe Dokument anbauen, nicht ein zweites
    // anlegen.
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.locator('#file-input').setInputFiles([CSV_FHH]),
    ])
    await page.waitForFunction(() => window.__appBereit === true)
    await wartebisDashboardBereit(page)
    await page.locator('#doc-manager').evaluate((el) => { el.open = true })
    await expect(page.locator('#doc-tbody tr')).toHaveCount(1)
    const status = page.locator('span.doc-status.ok').first()
    await expect(status).toHaveText('52/52 Pruefungen')
  })
