// Smoke-Tests fuer das Diagramm-Vollbild-Modal und den PNG-Export.
// Beide Features sitzen im Kopf jedes Diagramm-Panels und sind unabhaengig
// von der Native-Fullscreen-API (iPhone-tauglich). Diese Tests verifizieren
// das DOM-Verhalten in Chromium — fuer den eigentlichen iPhone-Pfad genuegt
// die Tatsache, dass die Knoepfe immer eingehaengt werden.

import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

test('Modal-Vollbild: Knopf je Diagramm-Panel, oeffnen und schliessen',
  async ({ page }) => {
    await ladeFixturePdf(page)

    // Jedes Diagramm-Panel auf dem Ueberblick-Tab hat einen
    // "Im Vollbild oeffnen"-Knopf (zusaetzlich zum Native-Fullscreen-Knopf).
    const wasserfall = page.locator('.gat-panel:has(#c_wasserfall)')
    const modalBtn = wasserfall.locator('.app-panel-modal-btn')
    await expect(modalBtn).toBeVisible()

    // Klick oeffnet das Modal; Diagramm-Container wandert in den Modal-Body.
    await modalBtn.click()
    const dialog = page.locator('#chart-modal')
    await expect(dialog).toBeVisible()
    await expect(page.locator('#chart-modal-body #c_wasserfall')).toHaveCount(1)
    // Titel uebernimmt die Panel-Beschriftung.
    await expect(page.locator('#chart-modal-titel'))
      .toContainText('Wasserfall')

    // Schliessen via Schliessen-Knopf — Container wandert zurueck ins Panel.
    await page.locator('#chart-modal-close').click()
    await expect(dialog).toBeHidden()
    await expect(wasserfall.locator('#c_wasserfall canvas')).toBeVisible()
  })

test('Modal-Vollbild: Esc-Taste schliesst das Modal',
  async ({ page }) => {
    await ladeFixturePdf(page)
    const wasserfall = page.locator('.gat-panel:has(#c_wasserfall)')
    await wasserfall.locator('.app-panel-modal-btn').click()
    await expect(page.locator('#chart-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#chart-modal')).toBeHidden()
    // Chart-Knoten ist wieder im Panel — Resize lief ohne Fehler.
    await expect(wasserfall.locator('#c_wasserfall canvas')).toBeVisible()
  })

test('Modal-Vollbild: Header enthaelt PNG-Export und Verkleinern-Knopf',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.gat-panel:has(#c_wasserfall) .app-panel-modal-btn')
      .click()
    const aktionen = page.locator('#chart-modal-actions')
    await expect(aktionen.locator('.app-panel-export-btn')).toBeVisible()
    await expect(aktionen.locator('.app-modal-close-btn')).toBeVisible()
    // Verkleinern-Knopf schliesst das Modal.
    await aktionen.locator('.app-modal-close-btn').click()
    await expect(page.locator('#chart-modal')).toBeHidden()
  })

test('PNG-Export: Knopf je Diagramm-Panel, Download mit erwartetem Dateinamen',
  async ({ page }) => {
    await ladeFixturePdf(page)

    const wasserfall = page.locator('.gat-panel:has(#c_wasserfall)')
    const exportBtn = wasserfall.locator('.app-panel-export-btn')
    await expect(exportBtn).toBeVisible()

    // Playwright faengt den Download — Dateiname enthaelt die Panel-ID,
    // das aktive Dokument und ein YYYY-MM-DD-Datum.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportBtn.click(),
    ])
    expect(download.suggestedFilename())
      .toMatch(/^c_wasserfall-.+-\d{4}-\d{2}-\d{2}\.png$/)
  })

test('PNG-Export: alle Diagramm-Panels haben einen Export-Knopf',
  async ({ page }) => {
    await ladeFixturePdf(page)
    // Jedes `.gat-panel` mit einem `.dash-chart` traegt mindestens einen
    // PNG-Export-Knopf in seiner Aktionsleiste.
    const panels = await page.locator('.gat-panel:has(.dash-chart)').count()
    const exportBtns = await page.locator(
      '.gat-panel:has(.dash-chart) .app-panel-export-btn',
    ).count()
    expect(exportBtns).toBe(panels)
  })
