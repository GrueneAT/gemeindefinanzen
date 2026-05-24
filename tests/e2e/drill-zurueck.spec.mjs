// E2E — Drill-Zurueck-Knopf im Treemap- und Pie-Panel des Ausgaben-Tabs.
// Der Text-Crumb-Pfad sitzt raeumlich weit von den drillbaren Charts; ein
// „Zurueck"-Knopf direkt im Panel-Kopf gibt dem User einen sichtbaren
// Rueckweg. Sichtbar nur bei Drill-Tiefe > 0; Klick fuehrt eine Ebene hoeher.

import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

test('Drill-Zurueck: Knopf ist bei Tiefe 0 versteckt',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="ausgaben"]').click()
    await page.waitForFunction(
      () => typeof window.__ausgabenDrillSync === 'object',
    )
    // Treemap- und Pie-Panel haben jeweils einen Knopf, aber `hidden`.
    const treemapBtn = page.locator(
      '.gat-panel:has(#c_treemap) .app-drill-back-btn',
    )
    const pieBtn = page.locator(
      '.gat-panel:has(#c_aufwandart) .app-drill-back-btn',
    )
    await expect(treemapBtn).toHaveCount(1)
    await expect(pieBtn).toHaveCount(1)
    await expect(treemapBtn).toBeHidden()
    await expect(pieBtn).toBeHidden()
  })

test('Drill-Zurueck: Knopf erscheint nach Drill auf Ebene 1',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="ausgaben"]').click()
    await page.waitForFunction(
      () => typeof window.__ausgabenDrillSync === 'object',
    )
    await page.locator('#drill-list li.drill-row.is-clickable').first().click()
    await page.waitForFunction(
      () => window.__ausgabenDrillSync.leseDrillTiefe() === 1,
    )
    const treemapBtn = page.locator(
      '.gat-panel:has(#c_treemap) .app-drill-back-btn',
    )
    const pieBtn = page.locator(
      '.gat-panel:has(#c_aufwandart) .app-drill-back-btn',
    )
    await expect(treemapBtn).toBeVisible()
    await expect(pieBtn).toBeVisible()
  })

test('Drill-Zurueck: Klick auf Knopf fuehrt eine Ebene hoeher',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="ausgaben"]').click()
    await page.waitForFunction(
      () => typeof window.__ausgabenDrillSync === 'object',
    )
    // Auf Ebene 1 drillen.
    await page.locator('#drill-list li.drill-row.is-clickable').first().click()
    await page.waitForFunction(
      () => window.__ausgabenDrillSync.leseDrillTiefe() === 1,
    )
    // Klick auf den Zurueck-Knopf im Treemap-Panel.
    await page.locator(
      '.gat-panel:has(#c_treemap) .app-drill-back-btn',
    ).click()
    // Wieder auf Ebene 0.
    await page.waitForFunction(
      () => window.__ausgabenDrillSync.leseDrillTiefe() === 0,
    )
    // Knopf ist wieder versteckt.
    await expect(page.locator(
      '.gat-panel:has(#c_treemap) .app-drill-back-btn',
    )).toBeHidden()
  })

test('Drill-Zurueck: aus Ebene 2 nur eine Ebene zurueck',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="ausgaben"]').click()
    await page.waitForFunction(
      () => typeof window.__ausgabenDrillSync === 'object',
    )
    // Zweimal in eine klickbare Drill-Row klicken — fuer Tiefe 2.
    await page.locator('#drill-list li.drill-row.is-clickable').first().click()
    await page.waitForFunction(
      () => window.__ausgabenDrillSync.leseDrillTiefe() === 1,
    )
    await page.locator('#drill-list li.drill-row.is-clickable').first().click()
    await page.waitForFunction(
      () => window.__ausgabenDrillSync.leseDrillTiefe() === 2,
    )
    // Eine Ebene zurueck via Pie-Panel-Knopf.
    await page.locator(
      '.gat-panel:has(#c_aufwandart) .app-drill-back-btn',
    ).click()
    await page.waitForFunction(
      () => window.__ausgabenDrillSync.leseDrillTiefe() === 1,
    )
    // Knopf bleibt sichtbar — wir sind noch auf Tiefe 1.
    await expect(page.locator(
      '.gat-panel:has(#c_treemap) .app-drill-back-btn',
    )).toBeVisible()
  })

test('Drill-Zurueck: synchronisiert mit Text-Crumbs (Beide Wege fuehren zum gleichen Stand)',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="ausgaben"]').click()
    await page.waitForFunction(
      () => typeof window.__ausgabenDrillSync === 'object',
    )
    await page.locator('#drill-list li.drill-row.is-clickable').first().click()
    await page.waitForFunction(
      () => window.__ausgabenDrillSync.leseDrillTiefe() === 1,
    )
    // Variante A: Crumb-Klick auf data-level="0".
    await page.locator(
      '#drill-crumbs button[data-level="0"]:not([disabled])',
    ).click()
    await page.waitForFunction(
      () => window.__ausgabenDrillSync.leseDrillTiefe() === 0,
    )
    // Erneut drillen und diesmal ueber den Panel-Knopf zurueck.
    await page.locator('#drill-list li.drill-row.is-clickable').first().click()
    await page.waitForFunction(
      () => window.__ausgabenDrillSync.leseDrillTiefe() === 1,
    )
    await page.locator(
      '.gat-panel:has(#c_treemap) .app-drill-back-btn',
    ).click()
    await page.waitForFunction(
      () => window.__ausgabenDrillSync.leseDrillTiefe() === 0,
    )
    // Crumbs entsprechen wieder dem Ausgangszustand (nur data-level=0
    // disabled, kein zweiter Crumb).
    const sichtbareCrumbs = await page.locator(
      '#drill-crumbs button[data-level]',
    ).count()
    expect(sichtbareCrumbs).toBe(1)
  })
