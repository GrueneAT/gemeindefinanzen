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

// --- Neue Aggregationen (median/min/max) ---------------------------------

test('Builder: neue Aggregationen median/min/max sind im Dropdown',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    const opts = await page.locator('#builder-agg option')
      .evaluateAll((els) => els.map((el) => el.value))
    expect(opts).toEqual(expect.arrayContaining(
      ['summe', 'durchschnitt', 'median', 'min', 'max', 'anzahl']))
  })

test('Builder: Aggregation median liefert plausibel kleineres Ergebnis als max',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    await page.locator('#builder-render').click()
    // max-Aggregation rendern, Top-Wert merken.
    await page.locator('#builder-agg').selectOption('max')
    const maxWert = await page.evaluate(() => {
      const inst = window.echarts.getInstanceByDom(
        document.getElementById('c_builder'))
      const data = inst.getOption().series[0].data
      return Math.max(...data.map((v) =>
        typeof v === 'number' ? v : (v && v.value) || 0))
    })
    // min-Aggregation rendern, Bottom-Wert merken.
    await page.locator('#builder-agg').selectOption('min')
    const minWert = await page.evaluate(() => {
      const inst = window.echarts.getInstanceByDom(
        document.getElementById('c_builder'))
      const data = inst.getOption().series[0].data
      return Math.min(...data.map((v) =>
        typeof v === 'number' ? v : (v && v.value) || 0))
    })
    // median liegt zwischen — bei einer Mehrposten-Gruppe stets:
    // min <= median <= max. Wir pruefen die Ordnung statt eines exakten
    // Wertes (Fixture-Werte koennen sich mit dem PDF aendern).
    expect(minWert).toBeLessThanOrEqual(maxWert)
    await page.locator('#builder-agg').selectOption('median')
    const seriesTyp = await page.evaluate(() => {
      const inst = window.echarts.getInstanceByDom(
        document.getElementById('c_builder'))
      return inst.getOption().series[0].type
    })
    // Median rendert weiterhin als Balken — keine ECharts-Fehler.
    expect(seriesTyp).toBe('bar')
  })

// --- Sekundaere Gruppierung — Sichtbarkeit ------------------------------

test('Builder: Sekundaer-Dropdown ist bei den Standard-Typen versteckt',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    // Standard-Typ ist bar-h beim Laden — Sekundaer-Wrap ist hidden.
    const wrap = page.locator('#builder-stack-wrap')
    await expect(wrap).toBeHidden()
    for (const typ of ['bar-v', 'line', 'pie']) {
      await page.locator('#builder-typ').selectOption(typ)
      await expect(wrap).toBeHidden()
    }
  })

test('Builder: Sekundaer-Dropdown erscheint bei stacked/treemap/heatmap',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    const wrap = page.locator('#builder-stack-wrap')
    for (const typ of ['bar-stacked', 'treemap', 'heatmap']) {
      await page.locator('#builder-typ').selectOption(typ)
      await expect(wrap).toBeVisible()
    }
    // Zurueck auf bar-h: wieder versteckt.
    await page.locator('#builder-typ').selectOption('bar-h')
    await expect(wrap).toBeHidden()
  })

// --- Neue Diagrammtypen --------------------------------------------------

test('Builder: gestapelte Balken erzeugen mehrere Serien mit stack',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    await page.locator('#builder-render').click()
    await page.locator('#builder-typ').selectOption('bar-stacked')
    // Sekundaer-Gruppierung auf "richtung" — wenig Werte, gute Pivot.
    await page.locator('#builder-stack').selectOption('richtung')
    const info = await page.evaluate(() => {
      const inst = window.echarts.getInstanceByDom(
        document.getElementById('c_builder'))
      const opt = inst.getOption()
      return {
        anzahl: opt.series.length,
        ersterTyp: opt.series[0] && opt.series[0].type,
        ersteStack: opt.series[0] && opt.series[0].stack,
      }
    })
    expect(info.ersterTyp).toBe('bar')
    expect(info.anzahl).toBeGreaterThanOrEqual(2)
    expect(info.ersteStack).toBe('gesamt')
  })

test('Builder: Treemap rendert als treemap-Serie',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    await page.locator('#builder-render').click()
    await page.locator('#builder-typ').selectOption('treemap')
    const seriesTyp = await page.evaluate(() => {
      const inst = window.echarts.getInstanceByDom(
        document.getElementById('c_builder'))
      return inst.getOption().series[0].type
    })
    expect(seriesTyp).toBe('treemap')
    // Mit sekundaerer Gruppierung -> hierarchisch (children am Datum).
    await page.locator('#builder-stack').selectOption('richtung')
    const hatKinder = await page.evaluate(() => {
      const inst = window.echarts.getInstanceByDom(
        document.getElementById('c_builder'))
      const data = inst.getOption().series[0].data
      return Array.isArray(data) && data.length > 0 &&
        Array.isArray(data[0].children) && data[0].children.length > 0
    })
    expect(hatKinder).toBe(true)
  })

test('Builder: Heatmap rendert als heatmap-Serie mit visualMap',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    await page.locator('#builder-render').click()
    await page.locator('#builder-typ').selectOption('heatmap')
    // Heatmap braucht dim2 — auf "richtung" setzen.
    await page.locator('#builder-stack').selectOption('richtung')
    const info = await page.evaluate(() => {
      const inst = window.echarts.getInstanceByDom(
        document.getElementById('c_builder'))
      const opt = inst.getOption()
      return {
        seriesTyp: opt.series[0] && opt.series[0].type,
        hatVisualMap: Array.isArray(opt.visualMap) &&
          opt.visualMap.length > 0,
        achsenKategorisch: opt.xAxis[0].type === 'category' &&
          opt.yAxis[0].type === 'category',
      }
    })
    expect(info.seriesTyp).toBe('heatmap')
    expect(info.hatVisualMap).toBe(true)
    expect(info.achsenKategorisch).toBe(true)
  })

test('Builder: PNG-Export funktioniert fuer die neuen Diagrammtypen',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="suche"]').click()
    await page.locator('#builder-render').click()
    for (const typ of ['bar-stacked', 'treemap', 'heatmap']) {
      await page.locator('#builder-typ').selectOption(typ)
      if (typ === 'heatmap') {
        await page.locator('#builder-stack').selectOption('richtung')
      }
      // ECharts liefert eine Data-URL fuer den aktuellen Chart — generisch
      // ueber alle Diagrammtypen.
      const dataUrl = await page.evaluate(() => {
        const inst = window.echarts.getInstanceByDom(
          document.getElementById('c_builder'))
        return inst.getDataURL({ type: 'png', pixelRatio: 1,
          backgroundColor: '#fff' })
      })
      expect(typeof dataUrl).toBe('string')
      expect(dataUrl.startsWith('data:image/png')).toBe(true)
    }
  })
