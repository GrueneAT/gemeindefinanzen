// e2e — Vergleichs-Tab: Diff zweier Dokumente.
//
// Geladen werden Voranschlag und Nachtragsvoranschlag 2026 derselben
// Gemeinde. Geprueft wird, dass die Auswahl das VA/NVA-Paar vorbelegt, die
// Kennzahlen und die drei Diagramme stehen, die Tabelle standardmaessig nur
// Veraenderungen zeigt, und dass Haushalts-Umschalter, Richtungstausch und
// Filter wirken.
import { test, expect } from '@playwright/test'
import { oeffneApp, wartebisDashboardBereit } from './helpers.mjs'

const VA = 'documents/VA-2026-Auflage.pdf'
const NVA = 'documents/NVA-2026-Auflage.pdf'

// Beide PDFs laden. Die App verarbeitet eine Auswahl in einem Durchgang und
// laedt danach neu.
async function ladePaar(page) {
  await oeffneApp(page)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load' }),
    page.locator('#file-input').setInputFiles([VA, NVA]),
  ])
  await page.waitForFunction(() => window.__appBereit === true)
  await wartebisDashboardBereit(page)
  await expect(page.locator('#doc-tbody tr')).toHaveCount(2, { timeout: 60000 })
}

async function oeffneVergleich(page) {
  await page.locator('.tab-btn[data-tab="vergleich"]').click()
  await expect(page.locator('.tab-panel[data-panel="vergleich"]')).toBeVisible()
}

test.describe('Vergleichs-Tab', () => {
  test.slow()

  test('Dokumente stehen in Entwicklungsreihenfolge, NVA ist Default',
    async ({ page }) => {
      await ladePaar(page)
      // Umschalter: VA vor NVA — der Voranschlag entsteht zuerst.
      const knoepfe = page.locator('#switcher-buttons .switch-btn')
      await expect(knoepfe).toHaveCount(2)
      await expect(knoepfe.nth(0)).toHaveText('VA 2026')
      await expect(knoepfe.nth(1)).toHaveText('NVA 2026')
      // Aktiv ist das gueltige Planungsdokument, nicht der ueberholte VA.
      await expect(knoepfe.nth(1)).toHaveClass(/is-active/)
      // Dokumentliste ebenfalls in Entwicklungsreihenfolge.
      await page.locator('#doc-manager').evaluate((el) => { el.open = true })
      const zeilen = page.locator('#doc-tbody tr td:first-child')
      await expect(zeilen.nth(0)).toContainText('VA 2026')
      await expect(zeilen.nth(1)).toContainText('NVA 2026')
    })

  test('Vorbelegung ist VA 2026 -> NVA 2026 mit Kennzahlen und Diagrammen',
    async ({ page }) => {
      await ladePaar(page)
      await oeffneVergleich(page)

      await expect(page.locator('#vgl-a')).toHaveValue(
        await page.locator('#vgl-a option', { hasText: 'VA 2026' })
          .first().getAttribute('value'),
      )
      await expect(page.locator('#vgl-kopf')).toContainText('VA 2026')
      await expect(page.locator('#vgl-kopf')).toContainText('NVA 2026')
      await expect(page.locator('#vgl-kopf')).toContainText('Ergebnishaushalt')

      // Ergebnishaushalt: drei Kennzahlen-Karten.
      await expect(page.locator('#vgl-stats .vgl-karte')).toHaveCount(3)
      await expect(page.locator('#vgl-stats .vgl-karte').first())
        .toContainText('Ertraege')

      // Alle drei Diagramme gerendert.
      await expect(page.locator('#c_vgl_wasserfall canvas')).toBeVisible()
      await expect(page.locator('#c_vgl_treemap canvas')).toBeVisible()
      await expect(page.locator('#c_vgl_gruppen canvas')).toBeVisible()

      // Statuszeile nennt die Zahl der veraenderten Haushaltsstellen.
      await expect(page.locator('#vgl-statuszeile')).toContainText('veraendert')
    })

  test('Tabelle zeigt voreingestellt nur Veraenderungen', async ({ page }) => {
    await ladePaar(page)
    await oeffneVergleich(page)

    await expect(page.locator('#vgl-f-status')).toHaveValue('veraendert')
    const zeilen = page.locator('#vgl-tbody tr')
    await expect(zeilen.first()).toBeVisible()
    const anzahlVeraendert = await zeilen.count()
    // Keine unveraenderte Zeile in der Voreinstellung.
    await expect(page.locator('#vgl-tbody .vgl-status-unveraendert'))
      .toHaveCount(0)

    // "alle" zeigt mehr Zeilen — die unveraenderten kommen hinzu.
    await page.locator('#vgl-f-status').selectOption('')
    await expect(zeilen.first()).toBeVisible()
    expect(await zeilen.count()).toBeGreaterThan(anzahlVeraendert)

    // Spaltenkoepfe tragen die Dokumentlabels.
    await expect(page.locator('#vgl-th-a')).toContainText('VA 2026')
    await expect(page.locator('#vgl-th-b')).toContainText('NVA 2026')
  })

  test('Schwellwert-Filter und Volltextsuche wirken', async ({ page }) => {
    await ladePaar(page)
    await oeffneVergleich(page)
    const zeilen = page.locator('#vgl-tbody tr')
    await expect(zeilen.first()).toBeVisible()
    const vorher = await zeilen.count()

    await page.locator('#vgl-f-schwelle').fill('100000')
    // Die Summenzeile rechnet Ertraege und Aufwendungen getrennt und weist
    // den Saldoeffekt aus — zusammenaddieren waere fachlich falsch.
    await expect(page.locator('#vgl-meta')).toContainText('Saldoeffekt')
    expect(await zeilen.count()).toBeLessThan(vorher)

    await page.locator('#vgl-f-schwelle').fill('')
    await page.locator('#vgl-f-such').fill('kommunalsteuer')
    await expect(zeilen.first()).toContainText('Kommunalsteuer')
  })

  test('Haushalts-Umschalter zeigt vier Kennzahlen im Finanzierungshaushalt',
    async ({ page }) => {
      await ladePaar(page)
      await oeffneVergleich(page)
      await page.locator('#vgl-hh').selectOption('FHH')
      await expect(page.locator('#vgl-kopf'))
        .toContainText('Finanzierungshaushalt')
      await expect(page.locator('#vgl-stats .vgl-karte')).toHaveCount(4)
      await expect(page.locator('#vgl-stats .vgl-karte').nth(3))
        .toContainText('investive')
    })

  test('Richtungstausch dreht Basis und Vergleich', async ({ page }) => {
    await ladePaar(page)
    await oeffneVergleich(page)
    const a = await page.locator('#vgl-a').inputValue()
    const b = await page.locator('#vgl-b').inputValue()
    await page.locator('#vgl-tausch').click()
    await expect(page.locator('#vgl-a')).toHaveValue(b)
    await expect(page.locator('#vgl-b')).toHaveValue(a)
    await expect(page.locator('#vgl-th-a')).toContainText('NVA 2026')
  })

  test('Kontrolle gegen die abgedruckte Vergleichsspalte laeuft',
    async ({ page }) => {
      await ladePaar(page)
      await oeffneVergleich(page)
      // Das Paar VA/NVA desselben Jahres erlaubt die Kontrolle — das Panel
      // ist sichtbar und traegt ein Ergebnis.
      await expect(page.locator('#vgl-kontrolle-panel')).toBeVisible()
      await expect(page.locator('#vgl-kontrolle .vgl-pruef')).toBeVisible()
      // Die aufgelegte VA-Fassung kennt die Community Nurse noch nicht —
      // genau diese Fassungsdifferenz weist die Kontrolle aus.
      await expect(page.locator('#vgl-kontrolle .vgl-pruef'))
        .toContainText('Abweichung')
      await expect(page.locator('#vgl-kontrolle tbody tr')).toHaveCount(2)
    })
})

test('Vergleichs-Tab bleibt verborgen, solange nur ein Dokument geladen ist',
  async ({ page }) => {
    await oeffneApp(page)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.locator('#file-input').setInputFiles([VA]),
    ])
    await page.waitForFunction(() => window.__appBereit === true)
    await wartebisDashboardBereit(page)
    await expect(page.locator('.tab-btn[data-tab="vergleich"]')).toBeHidden()
  })
