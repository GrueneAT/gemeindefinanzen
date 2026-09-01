import { test, expect } from '@playwright/test'
import { oeffneApp } from './helpers.mjs'

test('Footer verlinkt Impressum und Datenschutzerklaerung auf gruene.at',
  async ({ page }) => {
    await oeffneApp(page)
    const footer = page.locator('footer.footer')

    const impressum = footer.locator('a[href="https://gruene.at/impressum/"]')
    await expect(impressum).toBeVisible()
    await expect(impressum).toHaveText('Impressum')
    await expect(impressum).toHaveAttribute('target', '_blank')
    await expect(impressum).toHaveAttribute('rel', 'noopener')

    // Genau "datenschutzerklarung" — kein "ae", kein "ss".
    const datenschutz = footer.locator(
      'a[href="https://gruene.at/datenschutzerklarung/"]',
    )
    await expect(datenschutz).toBeVisible()
    await expect(datenschutz).toHaveText('Datenschutzerklaerung')
    await expect(datenschutz).toHaveAttribute('target', '_blank')
    await expect(datenschutz).toHaveAttribute('rel', 'noopener')
  })
