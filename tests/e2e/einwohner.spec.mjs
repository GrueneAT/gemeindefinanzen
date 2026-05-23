// e2e — Einwohnerzahl pro Dokument erfassen (Variante A Inline / Variante B
// Dialog). Beide Wege schreiben in dieselbe Spalte dokument.einwohner und
// loesen ein Neuzeichnen des Dashboards aus.
import { test, expect } from '@playwright/test'
import { ladeFixturePdf } from './helpers.mjs'

test('Einwohnerzahl (Variante A — Inline) wird gespeichert',
  async ({ page }) => {
    await ladeFixturePdf(page)
    // Dokumentverwaltung sichtbar machen (sie klappt nach Upload zu).
    await page.locator('#doc-manager').evaluate((el) => { el.open = true })

    // Inline-Input ist da und leer.
    const input = page.locator('.doc-einwohner-input[data-id]').first()
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('')

    // Wert eintippen und durch Tab raus (change-Event ausloesen).
    await input.fill('9000')
    await input.press('Tab')

    // change-Event ist asynchron — kurze Wartezeit fuer das UPDATE +
    // dashboard-Render.
    await expect(input).toHaveValue('9000')

    // Der Wert soll auch in der DB stehen — auf window.DATA warten, das
    // erst nach speichereEinwohner() + zeichneDashboard() neu gesetzt wird.
    await page.waitForFunction(() => {
      const docs = window.DATA && window.DATA.dokumente
      return docs && docs[0] && docs[0].einwohner === 9000
    }, { timeout: 5000 })
  })

test('Einwohnerzahl (Variante B — Dialog) wird gespeichert',
  async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator('#doc-manager').evaluate((el) => { el.open = true })

    // Erst die Inline-Eingabe leeren, damit der Dialog mit leerem Feld oeffnet.
    const input = page.locator('.doc-einwohner-input[data-id]').first()
    await input.fill('')
    await input.press('Tab')

    // Edit-Button klicken — Dialog oeffnet sich.
    const editBtn = page.locator('.doc-edit-btn[data-id]').first()
    await editBtn.click()
    const dialog = page.locator('#doc-einwohner-dialog')
    await expect(dialog).toBeVisible()

    // Wert eintragen und Speichern.
    const dialogInput = page.locator('#dlg-einwohner')
    await dialogInput.fill('7500')
    await page.locator('#doc-einwohner-save').click()

    // Dialog schliesst.
    await expect(dialog).toBeHidden()

    // Wert ist nun in der DB; das Inline-Feld traegt ihn ebenfalls nach
    // dem zeichneDashboard()-Aufruf, weil die Tabelle neu gerendert wurde.
    await expect(page.locator('.doc-einwohner-input[data-id]').first())
      .toHaveValue('7500')
    await page.waitForFunction(() => {
      const docs = window.DATA && window.DATA.dokumente
      return docs && docs[0] && docs[0].einwohner === 7500
    }, { timeout: 5000 })
  })
