// E2E — Builder-PNG-Export-UX-Korrekturen (fix-builder-png-drill-back).
// Zwei Verbesserungen ueber den bestehenden Builder-Test hinaus:
// 1. Klares Toast-Feedback, wenn der User „Als PNG speichern" klickt,
//    ohne vorher „Diagramm erstellen" gedrueckt zu haben.
// 2. Der Branding-Footer-Titel reflektiert die aktuelle Builder-
//    Konfiguration (Gruppierung, Wertspalte, Aggregation) — nicht nur
//    den statischen Panel-Titel „Diagramm-Builder".

import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

test('Builder: PNG-Klick vor Render zeigt eindeutigen Hinweis-Toast',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    // Builder ist gerade gerendert — Host noch hidden, ECharts hat keine
    // Instanz. Der „Als PNG speichern"-Knopf wurde aber bereits beim init()
    // im Panel-Kopf eingehaengt.
    await expect(page.locator('#builder-chart-host')).toBeHidden()
    const exportBtn = page.locator(
      '#builder-panel .app-panel-export-btn',
    )
    await expect(exportBtn).toBeVisible()
    await exportBtn.click()
    // Toast verweist auf den noch fehlenden Render-Klick, nicht auf eine
    // generische „noch nicht bereit"-Meldung.
    const toast = page.locator('.gat-toast').first()
    await expect(toast).toContainText('Diagramm erstellen')
  })

test('Builder: PNG-Export funktioniert nach Klick auf „Diagramm erstellen"',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    await page.locator('#builder-render').click()
    // ECharts-Instanz ist jetzt da; PNG-Export liefert einen Download.
    const exportBtn = page.locator(
      '#builder-panel .app-panel-export-btn',
    )
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportBtn.click(),
    ])
    expect(download.suggestedFilename())
      .toMatch(/^c_builder-.+-\d{4}-\d{2}-\d{2}\.png$/)
  })

test('Builder: Branding-Footer-Titel reflektiert Builder-Konfiguration',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    await page.locator('#builder-render').click()
    // Initial: dim=gruppe, wert=ew, agg=summe.
    const titel1 = await page.evaluate(() => {
      const panel = document.getElementById('builder-panel')
      return window.__brandFooter.leseTitelAusPanel(panel)
    })
    expect(titel1).toContain('Diagramm-Builder')
    expect(titel1).toContain('Aufgabengruppe')
    expect(titel1).toContain('EH wert')
    expect(titel1.toLowerCase()).toContain('summe')
    // Konfiguration wechseln und pruefen, dass der Titel mitwandert.
    await page.locator('#builder-dim').selectOption('ansatz')
    await page.locator('#builder-agg').selectOption('durchschnitt')
    const titel2 = await page.evaluate(() => {
      const panel = document.getElementById('builder-panel')
      return window.__brandFooter.leseTitelAusPanel(panel)
    })
    expect(titel2).toContain('Ansatz')
    expect(titel2.toLowerCase()).toContain('durchschnitt')
  })

test('Builder: leseBuilderKonfigBezeichnung beruecksichtigt Sekundaer-Gruppierung',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    await page.locator('#builder-render').click()
    // Auf gestapelte Balken: Sekundaer-Feld wird sichtbar.
    await page.locator('#builder-typ').selectOption('bar-stacked')
    await page.locator('#builder-stack').selectOption('richtung')
    const bez = await page.evaluate(
      () => window.__brandFooter.leseBuilderKonfigBezeichnung(),
    )
    expect(bez).toContain('Aufgabengruppe')
    expect(bez).toContain('Richtung')
    // Format-Hinweis: Primaer × Sekundaer.
    expect(bez).toMatch(/Aufgabengruppe\s*×\s*Richtung/)
  })
