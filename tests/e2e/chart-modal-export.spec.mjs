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

test('PNG-Export: Branding-Footer ist groesser als das nackte Diagramm',
  async ({ page }) => {
    await ladeFixturePdf(page)
    // Die brandePngMitFooter-Funktion wird ueber window.__brandFooter
    // exponiert. Test: ein synthetisches 200x200-Bild durchlaufen lassen und
    // pruefen, dass die Hoehe um den Footer waechst.
    const dims = await page.evaluate(async () => {
      const canvas = document.createElement("canvas")
      canvas.width = 200
      canvas.height = 200
      const ctx = canvas.getContext("2d")
      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, 200, 200)
      const ohne = canvas.toDataURL("image/png")
      const panel = document.querySelector('.gat-panel:has(.dash-chart)')
      const mit = await window.__brandFooter.brandePngMitFooter(ohne, panel)
      async function dim(d) {
        return new Promise((r) => {
          const img = new Image()
          img.onload = () => r({ w: img.width, h: img.height })
          img.src = d
        })
      }
      return { ohne: await dim(ohne), mit: await dim(mit) }
    })
    expect(dims.mit.w).toBe(dims.ohne.w)
    expect(dims.mit.h).toBeGreaterThan(dims.ohne.h)
    // Footer ist 96 px hoch (Pixel-Ratio 2 ist bereits im Diagramm-PNG drin).
    expect(dims.mit.h - dims.ohne.h).toBe(96)
  })
