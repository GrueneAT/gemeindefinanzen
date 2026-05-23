// Snapshot-Spec fuer die DS-v2-Migration (Issue vyz9q).
//
// Liegt BEWUSST ausserhalb von `tests/e2e/`, damit Playwright sie nicht als
// regulaeren e2e-Test entdeckt und die Suite `npm run test:e2e` davon
// unberuehrt bleibt. Aufruf explizit:
//
//   SNAPSHOT_DIR=.issues/vyz9q-.../screenshots/baseline \
//     npx playwright test .issues/vyz9q-.../screenshots/snapshot.spec.mjs \
//     --config=playwright.config.mjs
//
// Erzeugt 8 PNGs: Landing (vor Upload) + 7 Tab-Panels.

import { test } from '@playwright/test'
import { ladeFixturePdf, oeffneApp } from '../../../tests/e2e/helpers.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const ZIEL_DIR = process.env.SNAPSHOT_DIR
  ? resolve(process.env.SNAPSHOT_DIR)
  : resolve(
      '.issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/screenshots/baseline',
    )

const VIEWPORT = { width: 1440, height: 900 }

const TABS = [
  'ueberblick',
  'einnahmen',
  'ausgaben',
  'investitionen',
  'transfers',
  'schulden',
  'sparpotenzial',
]

test.use({ viewport: VIEWPORT })

async function speichere(page, name) {
  await mkdir(ZIEL_DIR, { recursive: true })
  const buf = await page.screenshot({
    fullPage: true,
    omitBackground: false,
    animations: 'disabled',
  })
  await writeFile(join(ZIEL_DIR, `${name}.png`), buf)
}

test('Snapshot: Landing (vor Upload)', async ({ page }) => {
  await oeffneApp(page)
  // Kurze Beruhigung — Fonts laden, etwaige Layout-Verschiebungen.
  await page.waitForLoadState('networkidle').catch(() => {})
  await speichere(page, '00-landing')
})

for (const tab of TABS) {
  test(`Snapshot: Tab ${tab}`, async ({ page }) => {
    await ladeFixturePdf(page)
    await page.locator(`.tab-btn[data-tab="${tab}"]`).click()
    // Kurze Pause, damit ECharts seine Animationen abschliesst.
    await page.waitForTimeout(400)
    const idx = String(TABS.indexOf(tab) + 1).padStart(2, '0')
    await speichere(page, `${idx}-${tab}`)
  })
}
