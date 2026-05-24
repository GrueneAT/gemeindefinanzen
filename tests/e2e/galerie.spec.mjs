// E2E-Smoke-Tests fuer die Diagramm-Galerie (uwxdv).
// Tab "Diagramme" sammelt alle Dashboard-Diagramme, filtert per Volltext
// und Tag-Chips und oeffnet jedes Diagramm im bestehenden Modal-Vollbild.

import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

test('Galerie-Tab: Reiter "Diagramme" ist sichtbar', async ({ page }) => {
  await ladeFixturePdf(page)
  const tab = page.locator('.tab-btn[data-tab="galerie"]')
  await expect(tab).toBeVisible()
  await expect(tab).toHaveText('Diagramme')
})

test('Galerie: Klick auf Tab listet alle Diagramme als Karten',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="galerie"]').click()
    const grid = page.locator('#galerie-grid')
    await expect(grid).toBeVisible()
    // Jedes .dash-chart im Dashboard wird in eine Karte gemappt (das
    // Mehrjahres-Overlay-Chart ist ausgenommen — es liegt unter .mj-overlay).
    const karten = await grid.locator('.galerie-karte').count()
    expect(karten).toBeGreaterThan(10)
    // Meta-Zeile gibt die Anzahl an.
    await expect(page.locator('#galerie-meta'))
      .toContainText(String(karten))
  })

test('Galerie: Volltextfilter reduziert die Karten',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="galerie"]').click()
    const grid = page.locator('#galerie-grid')
    const vorher = await grid.locator('.galerie-karte').count()
    expect(vorher).toBeGreaterThan(1)
    await page.locator('#galerie-suche').fill('Wasserfall')
    // Entprellung mit ~120ms — kurz warten.
    await page.waitForTimeout(250)
    const nachher = await grid.locator('.galerie-karte').count()
    expect(nachher).toBeGreaterThan(0)
    expect(nachher).toBeLessThan(vorher)
    await expect(grid.locator('.galerie-karte').first()
      .locator('.galerie-karte__titel'))
      .toContainText(/Wasserfall/i)
  })

test('Galerie: Tag-Chip filtert nach Thema',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="galerie"]').click()
    const grid = page.locator('#galerie-grid')
    const alle = await grid.locator('.galerie-karte').count()
    // Tag "Einnahmen" anklicken — nur noch Charts aus dem Einnahmen-Tab.
    await page.locator('.galerie-tag[data-tag="einnahmen"]').click()
    const gefiltert = await grid.locator('.galerie-karte').count()
    expect(gefiltert).toBeGreaterThan(0)
    expect(gefiltert).toBeLessThan(alle)
    // Alle sichtbaren Karten tragen den Einnahmen-Tag.
    const tags = await grid.locator('.galerie-karte__tag').allTextContents()
    for (const t of tags) {
      expect(t).toBe('Einnahmen')
    }
  })

test('Galerie: "Im Vollbild oeffnen" laeuft ueber die Modal-Verdrahtung',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="galerie"]').click()
    const grid = page.locator('#galerie-grid')
    // Erste Karte oeffnen — Modal sichtbar, Diagramm-Knoten im Modal-Body.
    await grid.locator('.galerie-karte').first()
      .locator('.galerie-karte__oeffnen').click()
    const dialog = page.locator('#chart-modal')
    await expect(dialog).toBeVisible()
    await expect(page.locator('#chart-modal-body .dash-chart'))
      .toHaveCount(1)
    // Schliessen — Modal weg, Galerie weiter sichtbar.
    await page.locator('#chart-modal-close').click()
    await expect(dialog).toBeHidden()
    await expect(grid).toBeVisible()
  })
