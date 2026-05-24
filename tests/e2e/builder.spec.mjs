// E2E-Smoke-Tests fuer den Diagramm-Builder (uwxdv).
// Builder sitzt im Suche-Tab; renderbar nach Klick auf "Diagramm erstellen".

import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

test('Builder: Panel ist im Suche-Tab sichtbar', async ({ page }) => {
  await ladeFixturePdf(page)
  await page.locator('.tab-btn[data-tab="suche"]').click()
  const panel = page.locator('#builder-panel')
  await expect(panel).toBeVisible()
  // Vier Dropdowns plus Render-Knopf vorhanden.
  await expect(panel.locator('#builder-typ')).toBeVisible()
  await expect(panel.locator('#builder-dim')).toBeVisible()
  await expect(panel.locator('#builder-wert')).toBeVisible()
  await expect(panel.locator('#builder-agg')).toBeVisible()
  await expect(panel.locator('#builder-render')).toBeVisible()
})

test('Builder: Render erzeugt eine ECharts-Instanz im Builder-Host',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    // Initial ist der Host versteckt.
    await expect(page.locator('#builder-chart-host')).toBeHidden()
    await page.locator('#builder-render').click()
    // Nach dem Klick erscheint der Host und ECharts hat eine Instanz.
    await expect(page.locator('#builder-chart-host')).toBeVisible()
    const hatInstanz = await page.evaluate(() => {
      const el = document.getElementById('c_builder')
      return !!(window.echarts && el && window.echarts.getInstanceByDom(el))
    })
    expect(hatInstanz).toBe(true)
    // Meta-Zeile zeigt Posten- und Kategorien-Zaehlung.
    await expect(page.locator('#builder-meta')).toContainText(/Posten/)
  })

test('Builder: Diagrammtyp aendern setzt die ECharts-Option neu',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    await page.locator('#builder-render').click()
    // Auf Kreis/Ring umstellen — die Option-Series wird zu type 'pie'.
    await page.locator('#builder-typ').selectOption('pie')
    const seriesTyp = await page.evaluate(() => {
      const el = document.getElementById('c_builder')
      const inst = window.echarts.getInstanceByDom(el)
      const opt = inst.getOption()
      return opt.series && opt.series[0] && opt.series[0].type
    })
    expect(seriesTyp).toBe('pie')
    // Zurueck auf vertikale Balken.
    await page.locator('#builder-typ').selectOption('bar-v')
    const seriesTyp2 = await page.evaluate(() => {
      const el = document.getElementById('c_builder')
      const inst = window.echarts.getInstanceByDom(el)
      return inst.getOption().series[0].type
    })
    expect(seriesTyp2).toBe('bar')
  })

test('Builder: Filter aus dem Suche-Tab schraenkt die Builder-Menge ein',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    // Gesamtmenge ohne Filter merken (vor dem Setzen des Filters).
    const gesamt = await page.evaluate(() => window.DATA.posten.length)
    // Filter setzen: Richtung "ausgabe" — change-Event triggert sofort.
    await page.locator('#f-richtung').selectOption('ausgabe')
    await expect(page.locator('#such-meta')).toContainText('Treffer')
    await page.locator('#builder-render').click()
    const meta = await page.locator('#builder-meta').textContent()
    expect(meta).toMatch(/Posten/)
    // Builder-Menge ist kleiner als die Gesamtmenge — Filter wirkt.
    // Plausibilitaets- statt Identitaetscheck, da die Suche-Meta mit
    // U+202F als Tausender-Trennzeichen formatiert, die Builder-Meta
    // aber ohne Locale-Format auskommt.
    const builderZahl = meta.match(/^\s*(\d+)/)
    expect(builderZahl).toBeTruthy()
    const builderN = parseInt(builderZahl[1], 10)
    expect(builderN).toBeGreaterThan(0)
    expect(builderN).toBeLessThan(gesamt)
  })

test('Builder: PNG-Export-Knopf ist auf dem Builder-Panel vorhanden',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    // Der PNG-Export-Knopf wird beim init() fuer ALLE .gat-panel-Panels
    // mit einem .dash-chart-Element eingehaengt — also auch fuer den
    // Builder.
    const builderExp = page.locator(
      '#builder-panel .app-panel-export-btn',
    )
    await expect(builderExp).toBeVisible()
  })
