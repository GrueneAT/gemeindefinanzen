# Plan: Lokale Browser-Test-Infrastruktur fuer die Web-App

<objective>
Was dieser Plan erreicht: Eine lokal und in CI ausfuehrbare, headless
Playwright-e2e-Test-Infrastruktur fuer die statische Web-App (`web/`), die den
gesamten Nutzerpfad abdeckt (Seite laedt, PDF-Upload, Dashboard, Tabs,
Sankey-Drill-down, Persistenz) sowie ein Build-Zeit-Versionsstempel in der
Fusszeile zur Erkennung veralteter Deployments.

Warum es zaehlt: Die bestehenden JS-Tests (`tests/js/run.mjs`) decken nur die
Datenpipeline in Node ab, nie die DOM-/Interaktionsschicht. Der gemeldete
"Sankey-Drill-down funktioniert nicht" liess sich bislang nicht automatisiert
von einem veralteten Deployment unterscheiden. Diese Luecke schliesst der Plan.

Scope — im Plan: Playwright als devDependency, `playwright.config.mjs`,
`tests/e2e/`-Specs, ein npm-Skript + Makefile-Ziel, ein separater
GitHub-Actions-Workflow, ECharts-Vendoring nach `web/vendor/echarts/`, ein
minimaler Test-Seam in `dashboard.js`, das `version.json`-Versionsstempel-System.
Ausser Scope: Aenderung der Datenpipeline, neue Test-IDs im DOM (vorhandene
Hooks reichen), Multi-Browser-Tests (nur Chromium).

Kein CONTEXT.md vorhanden — Entscheidungen folgen den Empfehlungen aus
RESEARCH.md (allesamt vom Recherche-Schritt im Container real verifiziert).
</objective>

<strategy>
Richtung: Playwright Test (`@playwright/test@^1.60.0`, nur Chromium) als
e2e-Harness. Es ist die einzige Einzelabhaengigkeit, die Runner, Browser,
Server-Orchestrierung (`webServer`), Datei-Upload (`setInputFiles`) und
selbst-wiederholende Assertions abdeckt — fuer einen kleinen statischen
Vanilla-JS-Stack (ESM, WASM, IndexedDB, ECharts) die unstrittige Wahl.

Strategische Optionen und warum die gewaehlte gewinnt:
- Tool: Playwright vs. Puppeteer/Cypress/WebdriverIO — Playwright gewinnt, weil
  alle anderen einen separaten Runner und/oder eine eigene Server-Lifecycle-
  Loesung brauchen; Cypress' In-Page-Modell vertraegt sich schlecht mit
  WASM-Workern. Recherche hat Playwright 1.60 + Chromium im Container real
  gestartet.
- Server: `scripts/serve.mjs` via Playwright `webServer` wiederverwenden statt
  Server-Start/-Stop selbst zu bauen — `webServer` uebernimmt Start, Warten und
  Teardown (auch bei Fehlschlag).
- Sankey-Klick: Der schwierige Teil. Die ECharts-Instanzen liegen in einer
  Closure in `dashboard.js`, ECharts' `click` ist ein Maus-Event (kein
  `dispatchAction`). Gewaehlt: ein minimaler Produktiv-Seam — Handler-Rumpf in
  eine benannte Funktion `drillAufKnoten(d)` faktorisieren und
  `window.__sankeyDrill(name)` exponieren. Deterministisch, isoliert die
  Drill-Logik von Render-/Timing-Effekten, beantwortet die Anlassfall-Frage
  (echter Bug vs. stale Deploy) sauber. Alternative — Pixel-Klick auf den
  Canvas — bleibt als zusaetzlicher duenner Smoke-Test erhalten, deckt die
  reale `inst.on('click')`-Verdrahtung mit ab.
- ECharts vom CDN: nach `web/vendor/echarts/` vendoren (wie mupdf/sqlite-wasm)
  — hermetische, netzunabhaengige Tests und Offline-faehiges Deployment.
- Versionsstempel: `version.json` (von `pages.yml` mit `${GITHUB_SHA}`
  geschrieben) statt Platzhalter-`sed` in `index.html` — haelt `web/` im Git
  byte-identisch, ein committeter `dev`-Fallback haelt den lokalen Betrieb
  sauber.

Wichtige Entscheidungspunkte: Reihenfolge ist bewusst Seam/Vendoring/Stempel
zuerst (Produktivcode), dann Harness, dann Specs, dann CI — so testet jeder
Spec gegen einen bereits vollstaendigen Produktivstand. Der erste konkrete
Sankey-Lauf (Task 6) reproduziert den gemeldeten Fehler und fixt ihn ggf.
im selben Zug.
</strategy>

<context>
Issue: @.issues/oh4sz-lokale-browser-test-infrastruktur-fuer-die-web-app/ISSUE.md
Research: @.issues/oh4sz-lokale-browser-test-infrastruktur-fuer-die-web-app/RESEARCH.md

<interfaces>
<!-- Executor: diese Vertraege direkt verwenden. Codebase NICHT erkunden. -->

scripts/serve.mjs — statischer Server, wiederverwendbar.
  CLI:   node scripts/serve.mjs [port]      (Default-Port 8080)
  URL:   http://localhost:PORT/web/         (App-Wurzel ist /web/)
  WURZEL = process.cwd()  -> Server MUSS aus der Repo-Wurzel laufen.
  Kein Stop-API, kein Port-0-Modus, setzt KEINE COOP/COEP-Header (bewusst).
  -> Server nicht selbst start/kill basteln: Playwright webServer-Block nutzen
     (command "node scripts/serve.mjs 8080", url http://localhost:8080/web/,
      reuseExistingServer: !process.env.CI).

web/ — beobachtbare Zustaende fuer Assertions (DOM-Hooks stabil, KEINE neuen
        test-ids noetig):
  window.__appBereit === true                    -> App initialisiert (Erfolg
                                                    ODER Fehler — app.js:54)
  document.querySelector("#boot-banner") === null -> kein Startfehler
  #file-input (input type=file, hidden, display:none) -> setInputFiles direkt
  Upload endet mit location.reload()             -> NACH dem Reload assertieren,
                                                    NICHT auf #progress-list
  #doc-tbody tr                                  -> geladene Dokumentzeilen
  span.doc-status.ok                             -> Pruefstatus gruen (5/5)
  #dashboard-leer (div, hidden umgeschaltet)     -> Empty-State
  #dashboard-inhalt (div, hidden umgeschaltet)   -> Dashboard sichtbar/aus
  .tab-btn[data-tab="..."] / .tab-panel[data-panel="..."], Klasse .is-active
  #c_sankey                                      -> ECharts-Sankey-CANVAS
  #sankey-hinweis  Klasse .is-visible            -> robustes Drill-down-Signal
  #sankey-reset                                  -> Uebersicht-Button
  Footer web/index.html:332-335 <footer class="footer"> mit #fuss-quelle und
    einem zweiten <span> -> Einbaustelle fuer #build-stamp.
  Fixture-PDF: documents/VA-2026-Auflage.pdf (5,16 MB, bekannt 5/5 Pruefungen,
    Nettoergebnis 474200 — bereits Referenzfall in tests/js/run.mjs).

web/js/app.js init() (app.js:35-55):
  fetch("./schema.sql") -> oeffneDb -> schemaAnwenden -> verdrahteUpload()
  -> zeichneDokumentliste() -> zeichneDashboard() -> window.__appBereit = true
  Es gibt KEIN bestehendes version/build-stamp-Handling — komplett neu.

web/vendor/dashboard/dashboard.js — klassisches IIFE, ECharts-Instanzen in der
  Closure `var charts = {}` (charts["c_sankey"] = { inst, kind, src }).
  setupSankeyDrill() (dashboard.js:465-503) registriert
  entry.inst.on("click", function(params){ ... }) — der Handler prueft
  params.dataType === "node", liest params.data ({drillSeite, drillKey,
  drillExpandbar}), setzt sankeyExpand, ruft renderSankey() + updateSankeyHinweis().
  ECharts' "click" ist ein MAUS-Event — dispatchAction loest es NICHT aus.
  window.echarts ist global (CDN-<script>); echarts.getInstanceByDom(el) holt
  die Instanz.

.github/workflows/pages.yml — Job `deploy` auf ubuntu-latest, KEIN Build-Schritt
  (laedt web/ unveraendert via upload-pages-artifact@v5). ${{ github.sha }} bzw.
  $GITHUB_SHA im Workflow verfuegbar. Es existiert KEIN Test-Workflow.

package.json — "type":"module", KEINE devDependencies. Scripts: test:js, poc,
  serve. package-lock.json minimal (1007 Bytes).

Makefile — web-sync (kopiert schema.sql + sql/ nach web/), web-deps, web-test,
  web-serve, web-docker, test-js. .PHONY-Liste am Ende listet alle web-*-Ziele.
  WEB_PORT ?= 8080.
</interfaces>

<call_sites>
Searched: `serve.mjs`, `playwright`, `test:js`/`test:e2e`, `web-e2e`,
`echarts`, `version.json`, `__sankeyDrill`.
Surfaces grepped: .github/workflows/, Makefile, package.json scripts, README,
web/index.html, web/js/.

Found:
- .github/workflows/pages.yml — `deploy`-Job, kein Build-Schritt — IN SCOPE
  (Task 4: neuer Step schreibt web/version.json vor upload-pages-artifact).
- Makefile `web-serve`/`web-docker` — rufen `node scripts/serve.mjs $(WEB_PORT)`
  — OUT OF SCOPE (serve.mjs wird nicht geaendert; webServer ruft denselben
  unveraenderten Befehl).
- package.json scripts — `serve`, `test:js` — IN SCOPE (Task 5: neues Skript
  `test:e2e`; bestehende Skripte unveraendert).
- web/index.html:10 — `<script src="https://cdn.jsdelivr.net/...echarts...">`
  — IN SCOPE (Task 2: auf lokale vendorisierte Kopie umstellen).
- web/index.html:332-335 Footer — IN SCOPE (Task 3: neues #build-stamp-<span>).
- README.md — Build/Test-Doku — IN SCOPE (Task 5: lokale e2e-Ausfuehrung
  dokumentieren).
Kein neuer CLI-Flag fuer serve.mjs noetig — der bestehende Positional-Port
genuegt fuer `webServer`.
</call_sites>

Key files:
@web/vendor/dashboard/dashboard.js — Sankey-Klick-Verdrahtung (Test-Seam, Task 1)
@web/index.html — ECharts-<script> + Footer (Tasks 2, 3)
@web/js/app.js — Boot-Flow, version.json laden (Task 3)
@scripts/serve.mjs — Test-Webserver (von webServer wiederverwendet, Task 5)
@.github/workflows/pages.yml — Versionsstempel-Step (Task 4)
</context>

<commit_format>
Format: aus .issues/config.yaml — `{id}: {message}`, ohne Werkzeug-Attribution.
Issue-ID: `oh4sz`.
Beispiel: `oh4sz: Sankey-Test-Seam in dashboard.js ergaenzen`
Muster: `oh4sz: <kurze deutsche Beschreibung im Imperativ>`
Keine Conventional-Commit-Typen, keine "claude"/Tool-Erwaehnung in Commits,
Code, Kommentaren oder Dateinamen.
</commit_format>

<tasks>

<task type="auto">
  <name>Task 1: Test-Seam in dashboard.js fuer den Sankey-Drill-down</name>
  <files>web/vendor/dashboard/dashboard.js</files>
  <action>
  Den Rumpf des Sankey-Klick-Handlers in `setupSankeyDrill()`
  (dashboard.js:465-503) in eine benannte Funktion herausfaktorisieren, damit
  der Drill-down deterministisch testbar ist, OHNE das Bedienverhalten zu
  aendern.

  Konkret, innerhalb der IIFE:
  1. Eine benannte Funktion `function drillAufKnoten(d) { ... }` anlegen, die
     EXAKT die bestehende Logik aus dem `inst.on("click")`-Handler enthaelt:
     - `d.drillSeite === "mitte" || !d.drillSeite` -> `sankeyExpand = null`
     - `d.drillExpandbar` -> `sankeyExpand = { seite: d.drillSeite, key: d.drillKey }`
     - Klick in bereits aufgeklappten Bereich (sankeyExpand passt zu d) -> `null`
     - danach `renderSankey(); updateSankeyHinweis();`
  2. Den `inst.on("click", ...)`-Handler so kuerzen, dass er nur noch
     `if (!params || params.dataType !== "node") return;` prueft und dann
     `drillAufKnoten(params.data || {});` aufruft. Verhalten bleibt identisch.
  3. Einen Test-Seam exponieren — innerhalb von `setupSankeyDrill()`, nach der
     Handler-Registrierung:
     ```js
     window.__sankeyDrill = function (knotenName) {
       var entry = charts["c_sankey"];
       if (!entry) return false;
       var opt = entry.inst.getOption();
       var knoten = (opt.series[0].data || []).find(function (n) {
         return n.name === knotenName;
       });
       if (!knoten) return false;
       drillAufKnoten(knoten);
       return true;
     };
     ```
  Der Seam ist minimal (kein neues UI, keine Verhaltensaenderung), nur ein
  zusaetzlicher programmatischer Einstieg in den vorhandenen Code-Pfad.
  Deutsche Bezeichner beibehalten, klassischer IIFE-Skriptstil (kein ESM,
  `var`, keine Arrow-Functions ausser bereits vorhanden).
  </action>
  <verify>
  <automated>node --check web/vendor/dashboard/dashboard.js && grep -q "window.__sankeyDrill" web/vendor/dashboard/dashboard.js && grep -q "function drillAufKnoten" web/vendor/dashboard/dashboard.js && npm run test:js</automated>
  </verify>
  <done>
  - `dashboard.js` parst fehlerfrei (`node --check`)
  - `drillAufKnoten(d)` existiert und enthaelt die komplette frueher inline
    stehende Drill-Logik
  - `inst.on("click")` ruft `drillAufKnoten` auf — Bedienverhalten unveraendert
  - `window.__sankeyDrill(name)` ist exponiert, gibt `true`/`false` zurueck
  - Bestehende JS-Tests (`npm run test:js`) bleiben gruen
  </done>
</task>

<task type="auto">
  <name>Task 2: ECharts nach web/vendor/echarts/ vendoren</name>
  <files>web/vendor/echarts/echarts.min.js, web/index.html</files>
  <action>
  ECharts vom CDN loesen, damit Tests und das Deployment hermetisch/offline-
  faehig sind (analog zu den bereits vendorisierten mupdf/sqlite-wasm).
  1. `web/vendor/echarts/echarts.min.js` anlegen — exakt die Version, die
     `web/index.html:10` bisher per CDN laedt (`echarts@5.5.1`,
     `cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js`). Herunterladen
     mit `curl -fsSL <url> -o web/vendor/echarts/echarts.min.js` (Netz im
     Container verfuegbar). Datei wird committet — sie ist Vendor-Code, nicht
     `.gitignore`-pflichtig.
  2. In `web/index.html:10` das `<script src="https://cdn.jsdelivr.net/...">`
     auf die lokale relative Kopie umstellen:
     `<script src="./vendor/echarts/echarts.min.js"></script>`. Position im
     `<head>` (vor `js/app.js`) beibehalten — `window.echarts` muss global
     bleiben, bevor `dashboard.js` nachgeladen wird.
  Keine weitere CDN-Referenz fuer ECharts darf in `web/` zurueckbleiben.
  </action>
  <verify>
  <automated>test -s web/vendor/echarts/echarts.min.js && grep -q './vendor/echarts/echarts.min.js' web/index.html && ! grep -rn 'cdn.jsdelivr.net' web/index.html && head -c 200 web/vendor/echarts/echarts.min.js | grep -qi echarts</automated>
  </verify>
  <done>
  - `web/vendor/echarts/echarts.min.js` existiert, nicht leer, enthaelt ECharts
  - `web/index.html` laedt ECharts aus der lokalen Vendor-Kopie
  - Keine `cdn.jsdelivr.net`-Referenz mehr in `web/index.html`
  </done>
</task>

<task type="auto">
  <name>Task 3: Versionsstempel — #build-stamp im Footer + version.json laden</name>
  <files>web/index.html, web/js/app.js, web/version.json</files>
  <action>
  Den Git-Commit, mit dem die Seite gebaut wurde, in der Fusszeile sichtbar
  machen (Variante A aus der Recherche — `version.json` + `fetch`).
  1. `web/index.html` Footer (Z.332-335, `<footer class="footer">`): ein neues
     `<span id="build-stamp"></span>` ergaenzen (nach den vorhandenen zwei
     Spans). Leerer Initialtext.
  2. `web/version.json` als committeter Dev-Fallback anlegen:
     `{ "commit": "dev", "shortCommit": "dev", "builtAt": "" }`. Diese Datei
     bleibt im Repo (committet) und wird von CI im Runner ueberschrieben — sie
     ist fuer den lokalen Betrieb (`scripts/serve.mjs`) noetig, sonst 404.
  3. `.gitignore` NICHT aendern: `web/version.json` muss committet bleiben.
     `pages.yml` (Task 4) ueberschreibt die Datei nur transient im CI-Runner,
     committet sie nie zurueck — es entsteht also keine Stempel-Churn im Repo.
  4. `web/js/app.js`: am Ende von `init()` (nach `window.__appBereit = true`)
     den Stempel laden — entweder inline oder als eigene Funktion
     `zeigeBuildStempel()`:
     ```js
     fetch("./version.json")
       .then((r) => (r.ok ? r.json() : null))
       .then((v) => {
         const el = document.getElementById("build-stamp");
         if (!el) return;
         el.textContent = v && v.shortCommit
           ? "Build " + v.shortCommit
           : "Build dev";
       })
       .catch(() => {});
     ```
     Fehlt `version.json` oder schlaegt der Fetch fehl, faellt der Text sauber
     auf "Build dev" zurueck — kein Boot-Fehler, `#boot-banner` bleibt aus.
     Deutsche Texte beibehalten.
  </action>
  <verify>
  <automated>node --check web/js/app.js && grep -q 'id="build-stamp"' web/index.html && python3 -c "import json; json.load(open('web/version.json'))" && grep -q 'version.json' web/js/app.js</automated>
  </verify>
  <done>
  - `web/index.html` Footer enthaelt `<span id="build-stamp">`
  - `web/version.json` ist gueltiges JSON mit `commit`/`shortCommit` (Dev-Wert)
  - `web/js/app.js` laedt `version.json` und fuellt `#build-stamp`, mit
    sauberem Fallback auf "Build dev" bei Fehlschlag
  - `app.js` parst fehlerfrei
  </done>
</task>

<task type="auto">
  <name>Task 4: pages.yml schreibt version.json beim Deploy</name>
  <files>.github/workflows/pages.yml</files>
  <action>
  Im `deploy`-Job von `.github/workflows/pages.yml` einen neuen Step VOR
  `actions/upload-pages-artifact@v5` einfuegen, der den aktuellen Commit in
  `web/version.json` schreibt (ueberschreibt den committeten Dev-Fallback):
  ```yaml
      - name: Build-Stempel schreiben
        run: |
          cat > web/version.json <<EOF
          { "commit": "${GITHUB_SHA}", "shortCommit": "${GITHUB_SHA:0:7}", "builtAt": "$(date -u +%FT%TZ)" }
          EOF
  ```
  Reihenfolge im Job: `checkout` -> `configure-pages` -> `Build-Stempel
  schreiben` -> `upload-pages-artifact` -> `deploy-pages`. Die
  `${GITHUB_SHA:0:7}`-Substitution funktioniert nur in einem `run:`-Shell-Step
  (Bash) — daher die Slicing-Logik im `run:`-Block belassen, nicht in YAML-
  Ausdruecken. `pages.yml` bekommt KEINEN e2e-Job — die Browser-Tests laufen
  im separaten Workflow aus Task 7.
  </action>
  <verify>
  <automated>python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/pages.yml')); steps=d['jobs']['deploy']['steps']; names=[s.get('name','') for s in steps]; assert 'Build-Stempel schreiben' in names, names; ui=next(i for i,s in enumerate(steps) if 'upload-pages-artifact' in str(s.get('uses',''))); assert names.index('Build-Stempel schreiben') < ui, 'Stempel-Step muss vor upload-pages-artifact stehen'; print('ok')"</automated>
  </verify>
  <done>
  - `pages.yml` enthaelt einen `Build-Stempel schreiben`-Step
  - Der Step steht vor `upload-pages-artifact`
  - Der Step schreibt `web/version.json` mit `commit`, `shortCommit`, `builtAt`
    aus `$GITHUB_SHA`
  - YAML parst fehlerfrei
  </done>
</task>

<task type="auto">
  <name>Task 5: Playwright-Harness — Abhaengigkeit, Config, npm-Skript, Makefile, Doku</name>
  <files>package.json, package-lock.json, playwright.config.mjs, Makefile, README.md, .gitignore</files>
  <action>
  Das Playwright-Test-Geruest aufsetzen — noch ohne Specs (die folgen in
  Task 6).
  1. `@playwright/test@^1.60.0` als devDependency aufnehmen:
     `npm install -D @playwright/test@^1.60.0` (legt den `devDependencies`-Block
     in `package.json` neu an und aktualisiert `package-lock.json`).
     Anschliessend `npx playwright install --with-deps chromium` ausfuehren
     (nur Chromium, kein Firefox/WebKit) — das Browser-Binary ist nicht
     committet, nur die npm-Abhaengigkeit.
  2. `playwright.config.mjs` im Repo-Wurzelverzeichnis anlegen (Repo ist
     `"type":"module"`, daher `.mjs`):
     ```js
     import { defineConfig, devices } from '@playwright/test';
     export default defineConfig({
       testDir: 'tests/e2e',
       fullyParallel: true,
       retries: process.env.CI ? 1 : 0,
       reporter: process.env.CI ? 'github' : 'list',
       use: {
         baseURL: 'http://localhost:8080',
         trace: 'on-first-retry',
       },
       projects: [
         {
           name: 'chromium',
           use: {
             ...devices['Desktop Chrome'],
             launchOptions: { args: ['--disable-dev-shm-usage'] },
           },
         },
       ],
       webServer: {
         command: 'node scripts/serve.mjs 8080',
         url: 'http://localhost:8080/web/',
         reuseExistingServer: !process.env.CI,
         timeout: 30_000,
       },
     });
     ```
     `--disable-dev-shm-usage` ist Pflicht (`/dev/shm` ~63 MB). NIEMALS
     `channel:'chrome'` setzen — auf arm64 nur das gebuendelte `chromium`.
     `serve.mjs` serviert aus `process.cwd()`; Specs nutzen daher `/web/...`
     relativ zur `baseURL`.
  3. `package.json` scripts: `"test:e2e": "playwright test"` ergaenzen
     (bestehende Skripte `test:js`, `poc`, `serve` unveraendert lassen).
  4. `Makefile`: ein Ziel `web-e2e` mit `web-sync` als Voraussetzung ergaenzen
     (Stil wie `web-test`):
     ```make
     web-e2e: web-sync ## Browser-e2e-Tests der Web-App ausfuehren
     	npm run test:e2e
     ```
     `web-e2e` der `.PHONY`-Liste am Dateiende hinzufuegen.
  5. `.gitignore`: im "JavaScript / Browser-App"-Abschnitt
     `/test-results/` und `/playwright-report/` ergaenzen (Playwright-
     Artefakte). `node_modules` ist bereits ignoriert.
  6. `README.md`: einen kurzen Abschnitt ergaenzen, der die lokale Ausfuehrung
     dokumentiert: Erstmaliges `npx playwright install --with-deps chromium`,
     danach `make web-e2e` bzw. `npm run test:e2e`. Den Server-Hinweis
     erwaehnen (Playwright startet/stoppt `serve.mjs` selbst).
  Keine Werkzeug-/Tool-Attribution in Kommentaren oder Doku.
  </action>
  <verify>
  <automated>node -e "const p=require('./package.json'); if(!p.devDependencies||!p.devDependencies['@playwright/test']) throw new Error('devDependency fehlt'); if(p.scripts['test:e2e']!=='playwright test') throw new Error('test:e2e fehlt');" && node --check playwright.config.mjs && grep -q '^web-e2e:' Makefile && grep -q 'web-e2e' <(grep -A4 '.PHONY' Makefile) && npx playwright --version</automated>
  </verify>
  <done>
  - `@playwright/test@^1.60.0` steht in `package.json` `devDependencies`,
    `package-lock.json` aktualisiert
  - `playwright.config.mjs` parst, nutzt `webServer` (`scripts/serve.mjs`),
    nur das `chromium`-Projekt, `--disable-dev-shm-usage`
  - `npm run test:e2e` ist verdrahtet; `make web-e2e` existiert und steht in
    `.PHONY`
  - `.gitignore` ignoriert `test-results/` und `playwright-report/`
  - `README.md` dokumentiert die lokale e2e-Ausfuehrung
  </done>
</task>

<task type="auto">
  <name>Task 6: e2e-Specs — Smoke, Upload, Dashboard, Sankey, Persistenz, Build-Stempel</name>
  <files>tests/e2e/helpers.mjs, tests/e2e/smoke.spec.mjs, tests/e2e/upload.spec.mjs, tests/e2e/dashboard.spec.mjs, tests/e2e/sankey.spec.mjs, tests/e2e/persistence.spec.mjs, tests/e2e/build-stamp.spec.mjs</files>
  <action>
  Die e2e-Testfaelle schreiben. Alle Specs sind ESM (`.mjs`), importieren aus
  `@playwright/test`. KEINE festen `waitForTimeout`/`sleep` — auf
  `window.__appBereit` und web-first `expect(...)`-Assertions setzen. Jeder
  Test laeuft per Default in frischem `BrowserContext` (IndexedDB-Isolation) —
  AUSSER der Persistenz-Test, der eine Upload-Aktion und `page.reload()` in
  EINEM Page/Context haelt.

  `tests/e2e/helpers.mjs` — gemeinsame Helfer:
  - `oeffneApp(page)`: `await page.goto('/web/');
    await page.waitForFunction(() => window.__appBereit === true);`
  - `ladeFixturePdf(page)`: ruft `oeffneApp`, dann
    `await page.locator('#file-input').setInputFiles('documents/VA-2026-Auflage.pdf');`
    Die App macht nach erfolgreicher Verarbeitung `location.reload()`; danach
    erneut `await page.waitForFunction(() => window.__appBereit === true);`.
    Pfad relativ zum Repo-Wurzelverzeichnis (Playwright laeuft von dort).
  - Konstante `FIXTURE = 'documents/VA-2026-Auflage.pdf'` und der erwartete
    Pruefstatus (5/5) zentral halten — keine `documents/`-Globs (wie in
    `tests/js/run.mjs` gepinnt).

  `smoke.spec.mjs` — "Seite laedt ohne Boot-Fehler":
  - `oeffneApp(page)`, dann
    `await expect(page.locator('#boot-banner')).toHaveCount(0);`

  `upload.spec.mjs` — "PDF-Upload fuellt Dokumentliste mit gruenem Status":
  - `ladeFixturePdf(page)`, dann nach dem Reload:
    `await expect(page.locator('#doc-tbody tr')).toHaveCount(1, { timeout: 30000 });`
    `await expect(page.locator('span.doc-status.ok').first()).toBeVisible();`
    Grosszuegiges Timeout (mupdf-Parse dauert Sekunden).

  `dashboard.spec.mjs` — "Dashboard sichtbar, Tabs schalten, Charts rendern":
  - `ladeFixturePdf(page)`, dann
    `await expect(page.locator('#dashboard-inhalt')).toBeVisible();`
    `await expect(page.locator('#dashboard-leer')).toBeHidden();`
  - Tab-Wechsel: Klick auf `[data-tab="einnahmen"]`, dann
    `await expect(page.locator('.tab-btn[data-tab="einnahmen"]')).toHaveClass(/is-active/);`
    `await expect(page.locator('.tab-panel[data-panel="einnahmen"]')).toBeVisible();`
  - Charts rendern: auf dem `ueberblick`-Panel
    `await expect(page.locator('#c_sankey canvas')).toBeVisible();` und ein
    weiteres Chart (z.B. `#c_wasserfall canvas`).

  `sankey.spec.mjs` — "Sankey-Drill-down" (der Anlassfall):
  - `ladeFixturePdf(page)`, sicherstellen dass der `ueberblick`-Tab aktiv ist.
  - `await page.waitForFunction(() => { const c =
    window.echarts.getInstanceByDom(document.getElementById('c_sankey'));
    return c && (c.getOption().series[0].data||[]).length > 0; });`
  - Knotenzahl vorher messen, einen aufklappbaren Knoten ueber den Test-Seam
    ausloesen:
    ```js
    const vorher = await page.evaluate(() =>
      window.echarts.getInstanceByDom(document.getElementById('c_sankey'))
        .getOption().series[0].data.length);
    // Namen eines drillExpandbar-Knotens aus der Option lesen:
    const knoten = await page.evaluate(() => {
      const d = window.echarts.getInstanceByDom(
        document.getElementById('c_sankey')).getOption().series[0].data;
      const k = d.find(n => n.drillExpandbar);
      return k ? k.name : null;
    });
    expect(knoten).not.toBeNull();
    await page.evaluate(n => window.__sankeyDrill(n), knoten);
    ```
  - Assertions auf das Drill-Ergebnis:
    `await expect(page.locator('#sankey-hinweis')).toHaveClass(/is-visible/);`
    `await expect.poll(() => page.evaluate(() =>
      window.echarts.getInstanceByDom(document.getElementById('c_sankey'))
        .getOption().series[0].data.length)).toBeGreaterThan(vorher);`
  - Zusatz-Smoke (reale Maus-Plumbing): einen zweiten Test, der per
    `#sankey-reset`-Klick zurueck auf die Uebersicht klappt und prueft, dass
    `#sankey-hinweis` `.is-visible` verliert.
  - WICHTIG — Anlassfall-Diagnose: Schlaegt der Drill-Test fehl, ist das ein
    ECHTER Bug in der `setupSankeyDrill()`-Verdrahtung (Recherche hat bereits
    bestaetigt: Deployment ist NICHT stale). In dem Fall im selben Task die
    Ursache in `web/vendor/dashboard/dashboard.js` beheben (z.B. fehlende
    Handler-Registrierung, falsche `drillExpandbar`-Auswertung,
    `renderSankey()`/`buildSankeyOption`-Verdrahtung) — minimal, ohne andere
    Funktionalitaet zu beruehren — bis der Test gruen ist. Schlaegt der Test
    NICHT fehl, war es ein stale-Deployment-Effekt; das in der
    Abschluss-Meldung festhalten.

  `persistence.spec.mjs` — "Persistenz ueberlebt Reload":
  - In EINEM Test, EINEM Page/Context: `ladeFixturePdf(page)`,
    `await expect(page.locator('#doc-tbody tr')).toHaveCount(1)`, dann
    `await page.reload(); await page.waitForFunction(() => window.__appBereit);`
    danach erneut `await expect(page.locator('#doc-tbody tr')).toHaveCount(1);`.
    KEIN neuer `browser.newContext()` zwischen Upload und Reload.

  `build-stamp.spec.mjs` — "Footer zeigt den Build-Commit":
  - `oeffneApp(page)`, `const stamp = page.locator('#build-stamp');`
    `await expect(stamp).toBeVisible();`
  - `const expected = process.env.EXPECTED_COMMIT;`
    `if (expected) await expect(stamp).toContainText(expected.slice(0,7));`
    `else await expect(stamp).not.toBeEmpty();`
    Lokal (kein `EXPECTED_COMMIT`) prueft der Test nur, dass der Stempel
    nicht leer ist ("Build dev"); in CI vergleicht er gegen `github.sha`.

  Vor dem ersten Lauf `make web-sync` ausfuehren (kopiert `schema.sql`/`sql/`
  nach `web/` — sonst boot-404). Deutsche Testbeschreibungen verwenden.
  </action>
  <verify>
  <automated>make web-sync && npx playwright test --reporter=list</automated>
  </verify>
  <done>
  - Alle sechs Spec-Dateien und `helpers.mjs` existieren unter `tests/e2e/`
  - `npx playwright test` laeuft gruen durch (alle Specs bestehen)
  - Der Sankey-Drill-down-Test prueft `#sankey-hinweis.is-visible` UND
    Wachstum von `getOption().series[0].data.length`
  - Der Persistenz-Test haelt Upload + Reload in einem Context
  - Der gemeldete Sankey-Fehler ist reproduziert/diagnostiziert; falls echter
    Bug — in `dashboard.js` behoben und der Test gruen
  - Keine `waitForTimeout`/`sleep` in den Specs
  </done>
</task>

<task type="auto">
  <name>Task 7: Separater GitHub-Actions-Workflow fuer die Browser-Tests</name>
  <files>.github/workflows/e2e.yml</files>
  <action>
  Einen NEUEN, von `pages.yml` getrennten Workflow `.github/workflows/e2e.yml`
  anlegen, der die e2e-Tests in CI ausfuehrt:
  ```yaml
  name: Browser-Tests

  on:
    push:
      branches: [main]
    pull_request:

  jobs:
    e2e:
      runs-on: ubuntu-latest
      steps:
        - name: Repository auschecken
          uses: actions/checkout@v6

        - name: Node einrichten
          uses: actions/setup-node@v4
          with:
            node-version: 22
            cache: npm

        - name: Abhaengigkeiten installieren
          run: npm ci

        - name: Chromium installieren
          run: npx playwright install --with-deps chromium

        - name: schema.sql und sql/ synchronisieren
          run: make web-sync

        - name: Browser-Tests ausfuehren
          run: npx playwright test
          env:
            EXPECTED_COMMIT: ${{ github.sha }}

        - name: Playwright-Report sichern
          if: ${{ !cancelled() }}
          uses: actions/upload-artifact@v4
          with:
            name: playwright-report
            path: playwright-report/
            retention-days: 7
  ```
  Wichtig: `npm ci` braucht ein konsistentes `package-lock.json` (in Task 5
  durch `npm install -D` aktualisiert). `make web-sync` MUSS vor dem Testlauf
  laufen, sonst boot-404. `EXPECTED_COMMIT` aktiviert die strikte
  Build-Stempel-Pruefung im `build-stamp.spec.mjs`. Dieser Workflow ist
  bewusst getrennt von `pages.yml` — der e2e-Job darf NICHT in den
  `deploy`-Job. Browser-Tests NICHT in `Dockerfile.claude` laufen lassen (kein
  Browser-Deps-Layer); der `ubuntu-latest`-Runner mit `--with-deps` genuegt.
  </action>
  <verify>
  <automated>python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/e2e.yml')); j=d['jobs']['e2e']; steps=j['steps']; us=[str(s.get('uses',''))+str(s.get('run','')) for s in steps]; assert any('playwright install' in s for s in us), 'install fehlt'; assert any('web-sync' in s for s in us), 'web-sync fehlt'; assert any('playwright test' in s for s in us), 'test-run fehlt'; assert j['runs-on']=='ubuntu-latest'; print('ok')" && python3 -c "import yaml; assert 'e2e' not in yaml.safe_load(open('.github/workflows/pages.yml'))['jobs'], 'e2e darf nicht in pages.yml stehen'; print('getrennt ok')"</automated>
  </verify>
  <done>
  - `.github/workflows/e2e.yml` existiert, eigener Workflow (nicht in pages.yml)
  - Job auf `ubuntu-latest`: checkout, setup-node, `npm ci`,
    `npx playwright install --with-deps chromium`, `make web-sync`,
    `npx playwright test` mit `EXPECTED_COMMIT: ${{ github.sha }}`
  - Playwright-Report wird als Artefakt hochgeladen
  - YAML parst fehlerfrei; `pages.yml` enthaelt keinen e2e-Job
  </done>
</task>

</tasks>

<verification>
Nach allen Tasks die Gesamt-Checks ausfuehren:
- `make web-sync && npx playwright test` — alle e2e-Specs gruen
- `npm run test:js` — bestehende Node-JS-Tests bleiben gruen
- `/tmp/pdfvenv/bin/python -m pytest -q` — bestehende Python-Tests bleiben gruen
- `ruff check . && mypy src/` — Linting/Typing sauber
- `node --check playwright.config.mjs` und `node --check` fuer jede geaenderte
  `web/`-JS-Datei — kein Syntaxfehler
- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/e2e.yml')); yaml.safe_load(open('.github/workflows/pages.yml'))"` — beide Workflows valides YAML
</verification>

<success_criteria>
Messbare Kriterien (1:1 zu den Acceptance Criteria aus ISSUE.md):
- Browser-Tests laufen lokal mit einem Befehl (`make web-e2e` /
  `npm run test:e2e`); Playwright `webServer` startet und stoppt
  `scripts/serve.mjs` automatisch (Tasks 5, 6).
- Ein Headless-Browser laedt die Seite, laedt `documents/VA-2026-Auflage.pdf`
  hoch und prueft Dokumentliste samt gruenem Pruefstatus `span.doc-status.ok`
  (Task 6, `upload.spec.mjs`).
- Test prueft Dashboard sichtbar, Tab-Wechsel, Chart-Rendering (Task 6,
  `dashboard.spec.mjs`).
- Test prueft den Sankey-Drill-down ueber den Test-Seam — `#sankey-hinweis`
  bekommt `.is-visible`, Knotenzahl waechst (Tasks 1, 6, `sankey.spec.mjs`).
- Test prueft Persistenz: nach `page.reload()` sind die Dokumente noch da
  (Task 6, `persistence.spec.mjs`).
- Der gemeldete Sankey-Fehler ist mit dem Harness reproduziert/diagnostiziert
  und — falls echter Bug — in `dashboard.js` behoben (Task 6).
- In CI eingebunden: separater Workflow `.github/workflows/e2e.yml`; lokale
  Ausfuehrung in `README.md` dokumentiert (Tasks 5, 7).
- Die Seite zeigt den Git-Commit in der Fusszeile (`#build-stamp`); der
  Browser-Test prueft ihn (Tasks 3, 4, 6, `build-stamp.spec.mjs`).
- Bestehende Python- (`pytest -q`) und JS-Tests (`npm run test:js`) bleiben
  gruen (Verification-Block).
</success_criteria>
