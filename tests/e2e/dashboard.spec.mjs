import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

test('Dashboard ist sichtbar, Tabs schalten um, Charts rendern',
  async ({ page }) => {
    await ladeFixturePdf(page)

    await expect(page.locator('#dashboard-inhalt')).toBeVisible()
    await expect(page.locator('#dashboard-leer')).toBeHidden()

    // Charts auf dem Ueberblick-Panel (Standard-Tab) rendern Canvas.
    await expect(page.locator('#c_sankey canvas')).toBeVisible()
    await expect(page.locator('#c_wasserfall canvas')).toBeVisible()

    // Tab-Wechsel auf Einnahmen.
    await page.locator('.tab-btn[data-tab="einnahmen"]').click()
    await expect(page.locator('.tab-btn[data-tab="einnahmen"]'))
      .toHaveClass(/is-active/)
    await expect(page.locator('.tab-panel[data-panel="einnahmen"]'))
      .toBeVisible()
  })

test('Kennzahlen-Karten zeigen Vorjahresdelta', async ({ page }) => {
  await ladeFixturePdf(page)
  // Mindestens eine Delta-Zeile ist sichtbar; sie enthaelt einen Pfeil.
  const ertraegeDelta = page.locator('#st-ertraege-delta')
  await expect(ertraegeDelta).toBeVisible()
  await expect(ertraegeDelta).toHaveText(/[↑↓]\s*[+-]?\d/)
  // is-up / is-down ist gesetzt (eine der beiden Klassen).
  await expect(ertraegeDelta).toHaveClass(/is-(up|down)/)
})

test('Pro-Kopf-Zeile erscheint, sobald Einwohnerzahl gesetzt wird',
  async ({ page }) => {
    await ladeFixturePdf(page)
    // Ohne Einwohner: Pro-Kopf-Zeile versteckt.
    await expect(page.locator('#st-ertraege-pk')).toBeHidden()

    // Einwohnerzahl ueber Inline-Feld setzen.
    await page.locator('#doc-manager').evaluate((el) => { el.open = true })
    const input = page.locator('.doc-einwohner-input[data-id]').first()
    await input.fill('9000')
    await input.press('Tab')

    // Pro-Kopf-Zeile wird sichtbar mit dem "je Einwohner:in:"-Prefix.
    await expect(page.locator('#st-ertraege-pk')).toBeVisible()
    await expect(page.locator('#st-ertraege-pk'))
      .toContainText('je Einwohner:in:')
  })

test('Ueberblick-Tab oeffnet mit 1-Euro/100-Euro-Panels (Variante A+B)',
  async ({ page }) => {
    await ladeFixturePdf(page)
    // Standard-Tab ist Ueberblick — die vier Panels sind direkt sichtbar.
    await expect(page.locator('#c_eineuro_aus_a canvas')).toBeVisible()
    await expect(page.locator('#c_eineuro_aus_b canvas')).toBeVisible()
    await expect(page.locator('#c_eineuro_ein_a canvas')).toBeVisible()
    await expect(page.locator('#c_eineuro_ein_b canvas')).toBeVisible()
  })

test('Ausgaben-Tab oeffnet mit sortierten Balken und Saldo',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('.tab-btn[data-tab="ausgaben"]').click()
    await expect(page.locator('#c_gruppen_balken canvas')).toBeVisible()
    await expect(page.locator('#c_gruppen_saldo canvas')).toBeVisible()
    // Treemap bleibt sichtbar (unten als Detailsicht).
    await expect(page.locator('#c_treemap canvas')).toBeVisible()
  })
