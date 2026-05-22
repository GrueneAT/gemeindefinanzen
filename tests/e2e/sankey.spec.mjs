import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

// Liest die aktuelle Knotenzahl der Sankey-Serie.
function knotenzahl(page) {
  return page.evaluate(() =>
    window.echarts
      .getInstanceByDom(document.getElementById('c_sankey'))
      .getOption().series[0].data.length)
}

// Sucht einen aufklappbaren Knoten, dessen Drill-down die Knotenzahl
// tatsaechlich erhoeht (eine Quelle/Gruppe mit mehreren Unterposten).
// Einzelposten-Quellen klappen 1:1 auf und aendern die Zahl nicht — die
// taugen nicht fuer eine Wachstums-Assertion.
function knotenMitWachstum(page) {
  return page.evaluate(() => {
    const posten = window.DATA.posten
    const dok = String(window.DATA.meta.default_dok)
    const basis = window.buildSankeyOption(posten, dok, null)
      .series[0].data
    for (const n of basis) {
      if (!n.drillExpandbar) continue
      const erweitert = window.buildSankeyOption(posten, dok, {
        seite: n.drillSeite,
        key: n.drillKey,
      }).series[0].data
      if (erweitert.length > basis.length) return n.name
    }
    return null
  })
}

test('Sankey-Drill-down klappt eine Ebene auf', async ({ page }) => {
  await ladeFixturePdf(page)
  // Ueberblick ist der Standard-Tab — der Sankey liegt dort.
  await expect(page.locator('.tab-btn[data-tab="ueberblick"]'))
    .toHaveClass(/is-active/)
  // Sankey-Serie hat Daten.
  await page.waitForFunction(() => {
    const c = window.echarts.getInstanceByDom(
      document.getElementById('c_sankey'))
    return c && (c.getOption().series[0].data || []).length > 0
  })

  const vorher = await knotenzahl(page)

  const knoten = await knotenMitWachstum(page)
  expect(knoten).not.toBeNull()

  // Drill ueber den Produktiv-Test-Seam ausloesen.
  const ok = await page.evaluate((n) => window.__sankeyDrill(n), knoten)
  expect(ok).toBe(true)

  // Drill-Ergebnis: Hinweis sichtbar und mehr Knoten als vorher.
  await expect(page.locator('#sankey-hinweis')).toHaveClass(/is-visible/)
  await expect.poll(() => knotenzahl(page)).toBeGreaterThan(vorher)
})

test('Sankey-Reset klappt zurueck auf die Uebersicht', async ({ page }) => {
  await ladeFixturePdf(page)
  await page.waitForFunction(() => {
    const c = window.echarts.getInstanceByDom(
      document.getElementById('c_sankey'))
    return c && (c.getOption().series[0].data || []).length > 0
  })

  // Erst aufklappen ...
  const knoten = await knotenMitWachstum(page)
  expect(knoten).not.toBeNull()
  await page.evaluate((n) => window.__sankeyDrill(n), knoten)
  await expect(page.locator('#sankey-hinweis')).toHaveClass(/is-visible/)

  // ... dann ueber den Uebersicht-Button zuruecksetzen.
  await page.locator('#sankey-reset').click()
  await expect(page.locator('#sankey-hinweis')).not.toHaveClass(/is-visible/)
})
