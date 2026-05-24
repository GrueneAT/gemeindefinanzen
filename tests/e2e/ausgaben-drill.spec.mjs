// E2E — Ausgaben-Drill: Treemap + Pie synchron zur Text-Drill.
// Klick auf einen Treemap- oder Pie-Slice triggert die passende
// `.drill-row` in der Text-Drill-Liste (Vendor pflegt den State); ein
// MutationObserver auf `.drill-crumbs` re-rendert beide Charts aus dem
// aktuellen Drill-Scope.

import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

test('Ausgaben-Drill: Treemap und Pie sind vorhanden und ECharts-bereit',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="ausgaben"]').click()
    await expect(page.locator('#c_treemap canvas')).toBeVisible()
    await expect(page.locator('#c_aufwandart canvas')).toBeVisible()
    // Drill-Liste ist initial auf Ebene 0 (Aufgabengruppen).
    const rows = page.locator('#drill-list .drill-row')
    await expect(rows.first()).toBeVisible()
  })

test('Ausgaben-Drill: __ausgabenDrillSync.baueChartDaten liefert Ebene 0',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="ausgaben"]').click()
    // Drill-Sync exposiert die Helfer fuer Tests.
    await page.waitForFunction(
      () => typeof window.__ausgabenDrillSync === 'object',
    )
    const ergebnis = await page.evaluate(() => {
      const s = window.__ausgabenDrillSync
      return { tiefe: s.leseDrillTiefe(), daten: s.baueChartDaten() }
    })
    expect(ergebnis.tiefe).toBe(0)
    expect(ergebnis.daten).not.toBeNull()
    expect(ergebnis.daten.items.length).toBeGreaterThan(0)
    // Die Treemap-Items sollten Aufgabengruppen-Labels sein.
    expect(ergebnis.daten.items[0].label).toBeTruthy()
  })

test('Ausgaben-Drill: Klick auf erste Drill-Row drillt eine Ebene tiefer',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="ausgaben"]').click()
    await page.waitForFunction(
      () => typeof window.__ausgabenDrillSync === 'object',
    )
    // Erste klickbare Drill-Row anklicken — Vendor pflegt drillPfad,
    // unser Observer re-rendert Treemap und Pie. Anschliessend zeigt
    // leseDrillTiefe() = 1.
    const ersteRow = page.locator('#drill-list li.drill-row.is-clickable').first()
    await ersteRow.click()
    await page.waitForFunction(
      () => window.__ausgabenDrillSync.leseDrillTiefe() === 1,
    )
    // Crumbs zeigen die zweite Ebene als disabled.
    const aktiverCrumb = page.locator(
      '#drill-crumbs button[data-level="1"][disabled]')
    await expect(aktiverCrumb).toHaveCount(1)
  })
