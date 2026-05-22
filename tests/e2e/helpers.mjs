// Gemeinsame Helfer fuer die Browser-e2e-Tests.
// Pfade sind relativ zum Repo-Wurzelverzeichnis (Playwright laeuft von dort).

// Referenz-PDF — bekannt mit 5/5 bestandenen Pruefungen, wie in tests/js/run.mjs.
export const FIXTURE = 'documents/VA-2026-Auflage.pdf'

// App oeffnen und warten, bis init() durchgelaufen ist.
export async function oeffneApp(page) {
  await page.goto('/web/')
  await page.waitForFunction(() => window.__appBereit === true)
}

// App oeffnen, das Referenz-PDF hochladen und nach dem automatischen
// location.reload() erneut auf die App-Bereitschaft warten.
export async function ladeFixturePdf(page) {
  await oeffneApp(page)
  // Die App ruft nach erfolgreicher Verarbeitung location.reload() auf.
  // Auf genau diese Navigation warten, sonst greift die folgende
  // Bereitschaftspruefung noch auf der alten Seite.
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load' }),
    page.locator('#file-input').setInputFiles(FIXTURE),
  ])
  await page.waitForFunction(() => window.__appBereit === true)
  // Mit geladenem Dokument baut app.js das Dashboard auf; dashboard.js wird
  // dabei asynchron als <script> nachgeladen — auf das fertige Dashboard
  // warten, statt allein auf __appBereit zu vertrauen.
  await wartebisDashboardBereit(page)
}

// Wartet, bis dashboard.js durchgelaufen ist. setupSankeyDrill() exponiert
// window.__sankeyDrill ganz am Ende der Verdrahtung — sobald die Funktion
// existiert, steht das Dashboard vollstaendig.
export async function wartebisDashboardBereit(page) {
  await page.waitForFunction(
    () => typeof window.__sankeyDrill === 'function',
    { timeout: 30000 },
  )
}
