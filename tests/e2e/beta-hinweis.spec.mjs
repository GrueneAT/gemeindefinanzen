import { test, expect } from '@playwright/test'
import { oeffneApp, ladeFixturePdf } from './helpers.mjs'

test('H1 traegt den Beta-Stand sichtbar mit', async ({ page }) => {
  await oeffneApp(page)
  await expect(page.locator('h1.gat-hero__title')).toContainText('Beta')
})

test('Beta-Hinweis ist beim Oeffnen sichtbar und nennt den Kontakt',
  async ({ page }) => {
    await oeffneApp(page)
    const hinweis = page.locator('#beta-hinweis')
    await expect(hinweis).toBeVisible()
    await expect(hinweis).toHaveClass(/gat-callout--warn/)
    await expect(hinweis.locator('.gat-callout__lead')).toBeVisible()
    await expect(
      hinweis.locator('a[href="mailto:florian.motlik@gruene.at"]'),
    ).toHaveCount(1)
    // Der Hinweis steht ausserhalb der Dokumentverwaltung ...
    await expect(page.locator('#doc-manager #beta-hinweis')).toHaveCount(0)
    // ... und der alte kleine Absatz existiert nicht mehr daneben.
    await expect(page.locator('.app-beta-hinweis')).toHaveCount(0)
  })

test('Beta-Hinweis bleibt sichtbar, wenn die Dokumentverwaltung zuklappt',
  async ({ page }) => {
    await ladeFixturePdf(page)
    // app.js setzt manager.open = (anzahl === 0) — mit einem Dokument zu.
    await expect
      .poll(() => page.locator('#doc-manager').evaluate((el) => el.open),
        { timeout: 30000 })
      .toBe(false)
    await expect(page.locator('#beta-hinweis')).toBeVisible()
  })

test('Beta-Hinweis verschwindet im Druck nicht', async ({ page }) => {
  await oeffneApp(page)
  await page.emulateMedia({ media: 'print' })
  // Kontrollprobe: die Druck-Regeln greifen wirklich (.doc-manager ist
  // in @media print ausgeblendet) — sonst waere der Test unten wertlos.
  await expect(page.locator('#doc-manager')).toBeHidden()
  await expect(page.locator('#beta-hinweis')).toBeVisible()
})
