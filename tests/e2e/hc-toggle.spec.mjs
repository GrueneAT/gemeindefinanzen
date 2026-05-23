// e2e — Hochkontrast-Toggle in der Brandbar.
//
// Pruefen: Klick setzt body.gat-mode-hc und aria-pressed="true";
// localStorage haelt "1"; Reload behaelt den Modus dank
// <head>-Inline-Skript (FOWT-Prevention).

import { test, expect } from '@playwright/test'
import { oeffneApp } from './helpers.mjs'

test('HC-Toggle: Klick aktiviert Modus, persistiert, ueberlebt Reload',
  async ({ page }) => {
    await oeffneApp(page)

    // Frischer Zustand: localStorage leeren, Seite neu laden.
    await page.evaluate(() => localStorage.removeItem('gat-mode-hc'))
    await page.reload()
    await page.waitForFunction(() => window.__appBereit === true)

    const btn = page.locator('#hc-toggle')
    await expect(btn).toBeVisible()
    await expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(await page.evaluate(() =>
      document.body.classList.contains('gat-mode-hc'))).toBe(false)

    // Aktivieren.
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() =>
      document.body.classList.contains('gat-mode-hc'))).toBe(true)
    expect(await page.evaluate(() =>
      localStorage.getItem('gat-mode-hc'))).toBe('1')

    // Reload — Modus bleibt aktiv durch das <head>-Inline-Skript.
    await page.reload()
    await page.waitForFunction(() => window.__appBereit === true)
    await expect(page.locator('#hc-toggle')).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() =>
      document.body.classList.contains('gat-mode-hc'))).toBe(true)

    // Deaktivieren.
    await page.locator('#hc-toggle').click()
    await expect(page.locator('#hc-toggle'))
      .toHaveAttribute('aria-pressed', 'false')
    expect(await page.evaluate(() =>
      document.body.classList.contains('gat-mode-hc'))).toBe(false)
    expect(await page.evaluate(() =>
      localStorage.getItem('gat-mode-hc'))).toBe('')
  })
