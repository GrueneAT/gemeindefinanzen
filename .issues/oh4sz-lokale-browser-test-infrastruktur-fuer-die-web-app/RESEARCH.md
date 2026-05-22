# RESEARCH — Lokale Browser-Test-Infrastruktur

Synthese aus drei Recherchen: `research/codebase.md`, `research/ecosystem.md`,
`research/pitfalls.md`. (graphify nicht ausgefuehrt — fuer eine JS-Test-
Infrastruktur ohne Belang.)

## Zusammenfassung

**Empfehlung: Playwright Test (`@playwright/test@1.60.0`)** als headless
Browser-Test-Harness. Es bündelt Testrunner, Browser, Server-Orchestrierung
(`webServer`), Datei-Upload (`setInputFiles`) und selbst-wiederholende
Assertions in einer Abhängigkeit — kein anderes Werkzeug deckt den Stack
(static, ESM, WASM, IndexedDB, ECharts) so vollständig ab. Die bestehenden
JS-Tests (`tests/js/run.mjs`) prüfen nur die Datenpipeline in Node und nie
die DOM-/Interaktionsschicht — genau diese Lücke schließt das Harness.

**Wichtigster Umgebungsbefund:** Playwright 1.60 + Chromium wurden im
Recherche-Schritt in genau diesem Container real installiert und gestartet —
DOM, `WebAssembly.instantiate`, `indexedDB.open` liefen headless. Die
Browser-Tests laufen also **lokal hier und in CI**, nicht nur in CI.

**Der schwierige Teil — der Sankey-Klick-Test.** Die ECharts-Instanzen liegen
in einer Closure in `web/vendor/dashboard/dashboard.js` (`var charts = {}` in
einer IIFE), nicht auf `window`. ECharts' `'click'` ist ein Maus-Event —
`dispatchAction` löst es nicht aus. Empfohlene Lösung: ein kleiner
**Test-Seam** im Produktivcode — den Klick-Handler-Rumpf in eine benannte
Funktion ziehen und als `window.__sankeyDrill(name)` exponieren; der Test
ruft das und prüft das Ergebnis (`getOption()`-Seriendaten + `#sankey-hinweis`
bekommt `.is-visible`). Damit ist der gemeldete Sankey-Fehler deterministisch
reproduzierbar.

## Codebase-Analyse

`tests/js/run.mjs` — Node-Pipeline-Tests (eigene `pruefe()`-Mini-Framework),
importiert `web/js/*`-Module direkt, prüft Parser/Validate/DB/Sankey-Builder,
**aber nie das DOM oder `dashboard.js`**. `package.json` hat **keine
devDependencies** — Playwright ist komplett neu.

<interfaces>
scripts/serve.mjs — statischer Server, wiederverwendbar.
  - serviert relativ zu process.cwd(); App-Wurzel ist /web/
  - fester Port (Arg 2, Default 8080); KEIN port-0, KEINE Stop-API
  - -> nicht selbst start/kill basteln: Playwright `webServer`-Block nutzen
    (url http://localhost:8080/web/, reuseExistingServer: !CI)

web/ — beobachtbare Zustaende fuer Assertions (DOM-Hooks sind stabil,
        keine neuen test-ids noetig):
  - window.__appBereit === true        -> App initialisiert
  - #boot-banner (dynamisch)           -> Startfehler sichtbar
  - #file-input (type=file, hidden)    -> setInputFiles direkt darauf
  - Upload endet mit location.reload() -> nach Reload pruefen, nicht auf
                                          das transiente #progress-list
  - span.doc-status.ok                 -> Pruefstatus gruen
  - #dashboard-inhalt[hidden]          -> Dashboard sichtbar/aus
  - .tab-btn.is-active / .tab-panel.is-active -> Tab-Zustand
  - #c_sankey                          -> ECharts-CANVAS, keine DOM-Knoten
  - #sankey-hinweis.is-visible         -> robustes Drill-down-Signal
  - #sankey-reset                      -> Uebersicht-Button
  - Fixture: documents/VA-2026-Auflage.pdf (bekannt 5/5)

.github/workflows/pages.yml — kein Build-Schritt, laedt web/ unveraendert
  hoch. ${{ github.sha }} verfuegbar -> Einstiegspunkt fuer den Versionsstempel.
</interfaces>

Die Sankey-Builder (`sankey-drill.js`) sind unit-getestet und grün — der
gemeldete Fehler liegt also in der `setupSankeyDrill()`-Verdrahtung in
`dashboard.js` oder ist ein veraltetes Deployment. (Live-Check während der
Issue-Erstellung: `sankey-drill.js` ist deployed — Deployment nicht stale.)

## Standard-Stack (verifizierte Versionen, 2026-05-22)

- `@playwright/test@1.60.0` (`latest`) — `npm install -D @playwright/test@^1.60.0`
- Browser: `npx playwright install --with-deps chromium` — **nur Chromium**,
  kein Firefox/WebKit.
- CI: eigener Workflow auf `ubuntu-latest` mit `npx playwright install
  --with-deps chromium` — getrennt von `pages.yml`.

## Nicht selbst bauen

- Keine eigene Browser-Steuerung / kein `&`+`kill`-Server-Tanz — Playwright
  `webServer` übernimmt Start/Stop.
- Keine festen `waitForTimeout`-Sleeps — auf `window.__appBereit` warten plus
  web-first `expect(...).toBeVisible()` (Auto-Retry).
- Keine Canvas-Pixel-Assertions für die Charts.
- Den Klick-Handler nicht im Test nachbauen — den Produktiv-Seam exponieren.

## Architektur-Muster

- **Server:** Playwright-`webServer` startet `scripts/serve.mjs` und stoppt
  es wieder; `reuseExistingServer: !CI`.
- **Bereitschaft:** `page.waitForFunction(() => window.__appBereit)` + web-first
  Assertions. mupdf-Parsing dauert Sekunden — nie raten.
- **Upload:** `setInputFiles('#file-input', 'documents/VA-2026-Auflage.pdf')`
  direkt auf das versteckte Input; danach (nach `location.reload()`) auf
  `span.doc-status.ok` und `#dashboard-inhalt` prüfen.
- **Sankey-Klick:** Test-Seam `window.__sankeyDrill(name)` im Produktivcode
  (Klick-Handler-Rumpf herausfaktorisieren); Assertion auf
  `getOption().series[0].data.length` und `#sankey-hinweis.is-visible`.
  Optional ein Smoke-Test mit echtem Pixel-Klick via `getItemLayout`.
- **Persistenz:** `page.reload()` behält denselben Context → IndexedDB
  überlebt. Zwischen Schreiben und Reload **keinen** neuen `browser.newContext()`.
- **Versionsstempel:** `pages.yml` schreibt vor dem Upload `web/version.json`
  mit `${GITHUB_SHA}`; `app.js` liest es per `fetch` in einen neuen
  Fußzeilen-Span `#build-stamp`; ein committeter `dev`-Fallback für den
  lokalen Betrieb. Test prüft mit `toContainText` gegen den erwarteten Commit.

## Häufige Fallstricke

- **`/dev/shm` ist hier nur ~63 MB** → Launch-Arg `--disable-dev-shm-usage`
  ist Pflicht, sonst stürzt Chromium ab.
- **arm64** → Playwrights gebündeltes `chromium` nutzen, nie `channel:'chrome'`
  (Chrome-Channel ist auf Linux nur x86-64).
- **ECharts kommt per CDN** (`cdn.jsdelivr.net/npm/echarts@5.5.1`) →
  für hermetische, netzunabhängige Tests ECharts nach `web/vendor/echarts/`
  vendorisieren (eigene kleine Teilaufgabe, auch gut fürs Offline-Deployment).
- **IndexedDB braucht einen echten Origin** → immer über den Server
  navigieren, nie `page.setContent`/`about:blank`.
- **`#file-input` ist `display:none`** → `setInputFiles` wirkt direkt;
  nicht `#pick-btn` klicken.
- **ECharts-Instanzen in Closure**, nicht auf `window` → der Test-Seam ist
  notwendig (s. o.).
- **CI:** `Dockerfile.claude` hat keine Browser-Abhängigkeiten — die
  Browser-Tests laufen über einen eigenen Actions-Workflow, nicht in dem Image.

## Umgebungsverfügbarkeit

- Playwright 1.60 + Chromium 148 **im Container real getestet** — headless
  läuft (DOM, WASM, IndexedDB, Canvas). Lokale Ausführung hier möglich.
- `node` v26, `npm` 11. Kein devDependency-Stand bisher; `package-lock.json`
  minimal.
- `web/schema.sql` und `web/sql/` müssen vorhanden sein (`make web-sync`),
  damit die App im Test lädt.

## Projekt-Rahmen

- Vanilla JS, ESM, kein Build-Schritt für die ausgelieferte Seite. Deutsch in
  UI und Bezeichnern. Keine Werkzeug-Attribution.
- Bestehende Python- und JS-Tests müssen grün bleiben.
- Der Test-Seam im Produktivcode muss minimal und unauffällig sein (3–5
  Zeilen), nichts an der Bedienung ändern.

## Quellen

- Playwright Doku — webServer / CI / Assertions / Release Notes — **HIGH**
- `npm view @playwright/test` (2026-05-22): 1.60.0 latest — **HIGH**
- Reale Installation + Headless-Start im Container — **HIGH**
- Apache ECharts — Event/Action, `getItemLayout`-Stabilität in 5.5.x — **MEDIUM**
- `mcr.microsoft.com/playwright`-Containertag für 1.60.0 — **LOW** (nicht auf
  dem empfohlenen Pfad)

## Offener Punkt für den Plan

Erste konkrete Aufgabe nach dem Aufsetzen: den Sankey-Drill-down mit dem neuen
Harness reproduzieren. Da `sankey-drill.js` deployed ist (kein stale Deploy),
ist die wahrscheinliche Ursache die `setupSankeyDrill()`-Verdrahtung — der
Test-Seam macht das deterministisch prüfbar; falls Bug, im selben Zug fixen.
