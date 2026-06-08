import { test, expect } from '@playwright/test'
import { oeffneApp } from './helpers.mjs'

// OH-Finder: Gemeindesuche -> korrekte Deep-Links auf offenerhaushalt.at.
// Kein Netzabruf der CSVs (OH ist nicht CORS-faehig) — geprueft wird die Suche
// gegen den statischen Index und der korrekte Bau der Download-URLs.
test('OH-Finder: Suche und korrekte Deep-Links', async ({ page }) => {
  await oeffneApp(page)

  const input = page.locator('#oh-search')
  await input.fill('Herzogenburg')

  const treffer = page.locator('#oh-results .oh-finder__result').first()
  await expect(treffer).toContainText('Herzogenburg')
  await treffer.click()

  await page.locator('#oh-typ').selectOption('ra')
  await page.locator('#oh-year').selectOption('2023')

  await expect(page.locator('#oh-out')).toBeVisible()
  await expect(page.locator('#oh-chosen')).toContainText('Herzogenburg')
  await expect(page.locator('#oh-chosen')).toContainText('Rechnungsabschluss 2023')

  const ehh = await page.locator('#oh-link-ehh').getAttribute('href')
  const fhh = await page.locator('#oh-link-fhh').getAttribute('href')
  expect(ehh).toBe(
    'https://www.offenerhaushalt.at/gemeinde/herzogenburg/download' +
      '?haushalt=ehh&rechnungsabschluss=ra&year=2023',
  )
  expect(fhh).toBe(
    'https://www.offenerhaushalt.at/gemeinde/herzogenburg/download' +
      '?haushalt=fhh&rechnungsabschluss=ra&year=2023',
  )
})

// GKZ-Suche (rein numerisch) findet die Gemeinde ueber die Kennziffer.
test('OH-Finder: Suche per Gemeindekennziffer', async ({ page }) => {
  await oeffneApp(page)
  await page.locator('#oh-search').fill('31912')
  await expect(
    page.locator('#oh-results .oh-finder__result').first(),
  ).toContainText('Herzogenburg')
})
