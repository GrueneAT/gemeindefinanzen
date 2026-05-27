// E2E — Chart-Color-Themes. Picker im Header, drei Themes, localStorage.

import { test, expect } from '@playwright/test'
import { ladeFixturePdf, oeffneApp } from './helpers.mjs'

test('Theme-Picker: drei Optionen + Default Standard', async ({ page }) => {
  await oeffneApp(page)
  const sel = page.locator('#theme-picker')
  await expect(sel).toBeVisible()
  const optionen = await sel.locator('option').allTextContents()
  expect(optionen).toEqual([
    'Standard', 'Druckfreundlich', 'Barrierefrei',
  ])
  await expect(sel).toHaveValue('standard')
})

test('Theme-Picker: wechselt das aktive Theme + persistiert in localStorage',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.selectOption('#theme-picker', 'barrierefrei')
    // localStorage geschrieben?
    const wert = await page.evaluate(
      () => localStorage.getItem('app-chart-theme'))
    expect(wert).toBe('barrierefrei')
    // window.__chartTheme spiegelt das Theme.
    const palette = await page.evaluate(
      () => window.__chartTheme && window.__chartTheme.palette)
    expect(palette).toEqual([
      '#009E73', '#F0E442', '#0072B2', '#D55E00',
      '#56B4E9', '#CC79A7', '#E69F00', '#999999',
    ])
    // data-chart-theme auf <html> ist aktualisiert.
    const attr = await page.evaluate(
      () => document.documentElement.getAttribute('data-chart-theme'))
    expect(attr).toBe('barrierefrei')
  })

test('Theme-API: alle drei Themes definiert und mit Palette + Ink',
  async ({ page }) => {
    await oeffneApp(page)
    const themes = await page.evaluate(() => {
      const t = window.__themePicker.CHART_THEMES
      return Object.fromEntries(Object.entries(t).map(([k, v]) =>
        [k, { name: v.name, paletteSize: v.palette.length,
              inkKeys: Object.keys(v.ink) }]))
    })
    expect(Object.keys(themes).sort()).toEqual(
      ['barrierefrei', 'druck', 'standard'])
    for (const k of Object.keys(themes)) {
      expect(themes[k].paletteSize).toBe(8)
      expect(themes[k].inkKeys.sort()).toEqual(
        ['blue', 'green', 'orange', 'red', 'soft'])
    }
  })
