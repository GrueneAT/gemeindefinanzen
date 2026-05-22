# Codebase-Recherche — Lokale Browser-Test-Infrastruktur (oh4sz)

## TL;DR fuer den Planner

1. **`scripts/serve.mjs` ist direkt wiederverwendbar** als Test-Webserver, aber
   nur mit zwei Anpassungen: (a) es serviert relativ zu `process.cwd()`, also
   muss der Test ihn aus der Repo-Wurzel starten und die App unter
   `http://localhost:PORT/web/` ansprechen; (b) es hat **kein Stop-API** und
   **keinen "0 = freier Port"-Modus** — der Test muss den Prozess als Child
   spawnen und killen, oder `serve.mjs` um diese Faehigkeiten erweitern.
2. **Die App signalisiert ihren Boot-Zustand sauber testbar**: `window.__appBereit`
   (gesetzt in `web/js/app.js`), der Boot-Fehlerbanner `#boot-banner` (erzeugt
   von `web/js/boot-guard.js`), und der gesamte Upload-Flow loest am Ende einen
   **`location.reload()`** aus — das ist die wichtigste Eigenheit fuer den Test
   (siehe "Observable States").
3. **Es gibt noch keine Browser-Test-Infrastruktur** — `tests/js/run.mjs` ist ein
   reiner Node-Pipeline-Test ohne DOM/Browser. Playwright muss komplett neu
   als devDependency hinzu. `package.json` hat aktuell **kein `devDependencies`**.
4. **DOM-Hooks sind durchgehend vorhanden und stabil** (IDs, `data-*`,
   semantische Klassen) — ein Test kann ohne neue Test-IDs auskommen. Tabs/
   Sankey schalten ueber die Klasse `is-active` bzw. CSS `display`.
5. **Git-Commit-Stempel**: Footer in `web/index.html` (Zeile 332-335) ist die
   Einbaustelle. `pages.yml` hat **keinen Build-Schritt** (laedt `web/`
   unveraendert hoch) — es braucht einen neuen Step, der `github.sha` in eine
   statische Datei schreibt, die die Seite liest. `github.sha` ist im Workflow
   verfuegbar.

## Touchpoints

| Datei | Zeilen | Relevanz | Konfidenz |
|---|---|---|---|
| `scripts/serve.mjs` | 1-50 | Statischer Server, vom Harness wiederzuverwenden | HIGH |
| `tests/js/run.mjs` | 1-411 | Bestehender Node-Test; Fixture-Pinning-Muster | HIGH |
| `web/index.html` | 1-356 | DOM-Struktur; Footer (332-335) fuer Stempel | HIGH |
| `web/js/app.js` | 1-331 | Boot-Flow, Upload-Flow, `__appBereit`, `reload()` | HIGH |
| `web/js/boot-guard.js` | 1-58 | Erzeugt `#boot-banner`; klassisches Skript | HIGH |
| `web/js/dashboard-app.js` | 1-99 | Baut Dashboard; setzt `window.DATA/CFG` | HIGH |
| `web/js/sankey-drill.js` | 1-247 | Reine Sankey-Builder-Funktionen | HIGH |
| `web/vendor/dashboard/dashboard.js` | 84-93, 427-503, 719-755 | Tab-/Sankey-Klick-Logik | HIGH |
| `web/vendor/dashboard/dashboard.css` | 23, 32, 35-36 | `.is-active`-Sichtbarkeit Tabs/Panels | HIGH |
| `.github/workflows/pages.yml` | 1-42 | Deploy-Workflow; Einbaustelle Test-Job + Stempel | HIGH |
| `Makefile` | 44-81 | `web-*`-Ziele; neues `web-e2e`-Ziel hier ergaenzen | HIGH |
| `package.json` | 1-16 | Scripts; braucht `devDependencies` + neues Skript | HIGH |
| `web/js/db.js` | 1-40 | IndexedDB-Persistenz (Browser) / In-Memory (Node) | MEDIUM |
| `documents/` | — | 4 Herzogenburg-PDFs als gepinnte Fixtures | HIGH |

## 1. Bestehendes Test-Setup

### `tests/js/run.mjs` — Node-Pipeline-Test (KEIN Browser)
- Aufruf: `npm run test:js` -> `node tests/js/run.mjs` (package.json:8).
- Importiert die App-Module **direkt aus `web/js/`** (`extract.js`, `parser.js`,
  `validate.js`, `loader.js`, `db.js`, `pipeline.js`, `dashboard-data.js`,
  `dashboard-charts.js`, `sankey-drill.js`) und faehrt die volle Pipeline in
  Node — Extraktion, Parsing, Validierung, SQLite, Dashboard-DATA/CFG,
  Sankey-Builder, Persistenz-Round-Trip. **Kein DOM, kein `document`, kein
  Browser.** `dashboard.js` (das Vendor-Skript mit der Interaktionslogik) wird
  NICHT getestet — genau die Luecke, die das Issue schliesst.
- **Eigenes Mini-Test-Framework**: Funktion `pruefe(name, bedingung, detail)`
  (Zeile 37-45), zaehlt `bestanden`/`fehlgeschlagen`, `process.exit(code)`.
  Kein Jest/Mocha. Der Browser-Test kann dieselbe schlanke Linie halten oder
  Playwrights `@playwright/test`-Runner mitbringen.
- **Fixture-Pinning (wichtiges Muster, Zeile 49-63)**: `ERWARTET`-Map mit den
  vier Herzogenburg-PDFs; `FIXTURES = Object.keys(ERWARTET).sort()`. Kommentar
  Zeile 56-58: der Test **darf NICHT `documents/` globben**, sonst verschieben
  fremde PDFs die Erwartungswerte. Der Browser-Test sollte exakt EINE dieser
  vier PDFs als Upload-Fixture fest referenzieren (Vorschlag:
  `VA-2026-Auflage.pdf` — bereits der Referenzfall in run.mjs, Nettoergebnis
  474200, 5/5 Pruefungen).

### `tests/test_parser.py` — Python-Pipeline-Test
- Pytest gegen `src/gemeindefinanzen/`; integrative Tests gegen `documents/`,
  werden uebersprungen wenn PDFs fehlen. Ebenfalls Herzogenburg-Fixtures
  explizit gepinnt (gleicher Kommentar wie run.mjs). **Vom Browser-Test
  unberuehrt** — Akzeptanzkriterium "Python-Tests bleiben gruen" ist nur eine
  Nicht-Regressionsforderung; laeuft via `make test` / `pytest -q`.

### `package.json`-Scripts (Zeile 7-11)
- `test:js`, `poc`, `serve`. **Keine `devDependencies`.** Playwright kommt als
  erste devDependency; ein neues Skript `test:e2e` (o.ae.) ist zu ergaenzen.
- `"type": "module"` — der Harness ist als ESM (`.mjs`/`.js`) zu schreiben.

### `Makefile`-Ziele (Zeile 44-81)
- `web-sync` (44-53): kopiert `schema.sql` + `sql/*.sql` nach `web/`. **Muss vor
  jedem Test laufen** — `web/schema.sql` wird von `app.js:39` per `fetch` geholt.
- `web-deps` (55-56): `npm install`.
- `web-test` / `test-js` (58, 75): `npm run test:js` (Node-Test).
- `web-serve` (61-62): `web-sync` dann `node scripts/serve.mjs $(WEB_PORT)`.
- `web-docker` (69-73): Server im `node:slim`-Container.
- `WEB_PORT ?= 8080` (67). Alle `.PHONY` in Zeile 80-81.
- **Neues Ziel** (z.B. `web-e2e`): sollte `web-sync` als Voraussetzung haben und
  die Browser-Tests starten. Es in die `.PHONY`-Liste aufnehmen.

## 2. Der statische Server — `scripts/serve.mjs`

<interfaces>
// scripts/serve.mjs — Aufruf & Verhalten
// CLI:   node scripts/serve.mjs [port]      (Default-Port 8080)
// URL:   http://localhost:PORT/web/         (Slash -> /web/index.html)
// WURZEL = process.cwd()   <-- MUSS die Repo-Wurzel sein, sonst 404 fuer /web/
// Kein Stop-/Shutdown-API, kein Event "ready" nach aussen (nur console.log).
// Setzt KEINE COOP/COEP-Header (bewusst — wie GitHub Pages; IndexedDB reicht).
// MIME-Typen: .html .css .js .mjs .json .wasm .sql .pdf .svg (TYPEN, Z.16-26).
// Pfad-Guard: datei muss mit WURZEL beginnen, sonst 403.
// Bei Port-Belegung wirft server.listen EADDRINUSE (unbehandelt).
</interfaces>

**Wiederverwendbarkeit fuer den Harness — JA, mit Einschraenkungen:**
- Der Harness muss `serve.mjs` als **Child-Prozess** spawnen
  (`child_process.spawn`), `cwd` = Repo-Wurzel, und am Ende `kill()`. Der
  Server hat keine programmatische Stop-Funktion.
- Auf "ready" warten: entweder `console.log`-Zeile abfangen (`Statischer
  Server: ...`) oder per Poll-Loop auf `http://localhost:PORT/web/` warten.
- **Port-Handling**: fixer Port, kein "0 = OS waehlt frei". Optionen fuer den
  Plan: (a) festen Test-Port nehmen (z.B. 8123) und Kollisionen in Kauf
  nehmen; (b) `serve.mjs` minimal erweitern — Port 0 unterstuetzen und den
  tatsaechlichen Port (`server.address().port`) ausgeben; (c) Server
  programmatisch importierbar machen (Funktion `starteServer(port)` exportieren,
  die das `server`-Objekt zurueckgibt). Option (b)/(c) ist sauberer und
  beruehrt `web-serve`/`web-docker` nicht negativ. Empfehlung im Plan klaeren.
- Alternativ: Playwright kann via `webServer`-Config in `playwright.config`
  einen Befehl selbst starten/stoppen und auf eine URL warten — das deckt das
  Akzeptanzkriterium "Server wird automatisch gestartet und beendet" ohne
  eigenen Spawn-Code ab. `command: "node scripts/serve.mjs PORT"`,
  `url: "http://localhost:PORT/web/"`.

## 3. Web-App-Struktur — DOM-Hooks & Module

### `web/index.html` — die konkreten Hooks
- `#boot-banner` — existiert NICHT im statischen HTML; wird **dynamisch** von
  `boot-guard.js` erzeugt, wenn ein Boot-Problem auftritt. Test-Assertion:
  "kein Boot-Fehler" = `#boot-banner` ist nicht im DOM (bzw. `count === 0`).
  Inline-CSS `.boot-banner` in `index.html` Zeile 14-16.
- `<details id="doc-manager" open>` (Z.54) — Dokumentverwaltung. `app.js`
  steuert `.open`: bei 0 Dokumenten offen, sonst zugeklappt
  (`aktualisiereDokVerwaltung`, app.js:109-118). `#doc-manager-count` (Z.57)
  Textinhalt `— N geladen` / `— noch keine geladen`.
- `#dropzone` (Z.62) — Drag&Drop-Zone; CSS-Klasse `is-over` waehrend Drag.
- `#file-input` (Z.68) — `<input type="file" multiple accept=...pdf>`. **Der
  Test laedt hierueber hoch**: Playwright `setInputFiles('#file-input', pfad)`.
- `#pick-btn` (Z.66) — Button, der `input.click()` ausloest.
- `#progress-list` (Z.71) `<ul>` — je Datei ein `li.progress-item` mit
  `.progress-stage`, `.progress-fill`, `.progress-error`. Endzustaende:
  `li.is-done` (Erfolg) / `li.is-error` (Fehler) (app.js:282-297).
  ABER: nach Erfolg ruft die App `location.reload()` — die `progress-list` ist
  nach dem Reload weg (siehe Observable States).
- `#doc-tbody` (Z.89) — Tabellenkoerper der geladenen Dokumente. Je Zeile
  `<tr>` mit `td`-Zellen; Statuszelle enthaelt
  `<span class="doc-status ok|fehl">N/M Pruefungen</span>`
  (app.js:84-91, 161-165). **Gruener Status = `span.doc-status.ok`** (CSS
  `app.css:188`). `.doc-status.fehl` ist rot (`app.css:193`).
- `#doc-empty` (Z.100) `<p hidden>` — "Noch keine Dokumente geladen", `hidden`
  per JS umgeschaltet.
- `.doc-remove` (app.js:89) — Entfernen-Button je Zeile; `#doc-clear-all`
  (Z.92) — alle entfernen. Beide loesen nach Aktion `location.reload()` aus.
- `#dashboard-leer` (Z.100) `<div hidden>` — Empty-State, sichtbar solange kein
  Dokument geladen ist.
- `#dashboard-inhalt` (Z.106) `<div hidden>` — der gesamte Dashboard-Block;
  `hidden` wird von `dashboard-app.js:32` auf `false` gesetzt, sobald
  Dokumente da sind. **Test-Assertion "Dashboard erscheint" = `#dashboard-inhalt`
  ist sichtbar (`hidden` false).**
- `#switcher-buttons` (Z.109) — enthaelt dynamische `button.switch-btn`
  (`data-dok="<id>"`); aktives = `.switch-btn.is-active`.
- `.tabs` (Z.110) mit sieben `button.tab-btn` (`data-tab=` ueberblick |
  einnahmen | ausgaben | investitionen | transfers | sparpotenzial | suche).
- `.tab-panel` (`data-panel=` gleiche Namen) — Sichtbarkeit ueber CSS:
  `.tab-panel { display: none }`, `.tab-panel.is-active { display: block }`
  (dashboard.css:35-36). **Aktiver Tab = `.tab-btn.is-active` +
  `.tab-panel.is-active`** (dashboard.js:84-93).
- Sankey (im `ueberblick`-Panel, Z.142-146):
  - `#c_sankey` — `div.dash-chart`, Hoehe 420px, der ECharts-Sankey-Container.
  - `.sankey-bar` — Leiste oberhalb; enthaelt `#sankey-hinweis` (`p`, Klasse
    `is-visible` wenn aufgeklappt) und `#sankey-reset` (Button "Übersicht").
- Charts allgemein: `div.dash-chart` mit IDs `c_wasserfall`, `c_trend_eck`,
  `c_einnahmen`, `c_aufwandart`, `c_treemap`, `c_investitionen`,
  `c_korridor`, `c_treiber`, `c_wasserfall_sp`, `c_trend_komm`, `c_trend_auf`.
  ECharts rendert ein `<canvas>` hinein — Assertion "Diagramm rendert" =
  `#c_xxx canvas` existiert / hat Groesse > 0.
- **Footer** (Z.332-335): `<footer class="footer">` mit `#fuss-quelle` und
  einem zweiten `<span>`. **Hier kommt der Git-Commit-Stempel hin** (neues
  `<span>` o.ae.).
- Lade-Reihenfolge der Skripte: `boot-guard.js` (klassisch, Z.29, im `<body>`
  oben), dann `echarts` (CDN, `<head>`), dann `js/app.js`
  (`type="module"`, Z.354). `dashboard.js` wird **dynamisch** von
  `dashboard-app.js:94-98` als `<script>` nachgeladen.

### JS-Module — Boot-Flow
- `web/js/app.js` `init()` (Z.35-55): laedt `./schema.sql` per fetch, oeffnet
  DB, verdrahtet Upload, zeichnet Dokumentliste + Dashboard, **setzt am Ende
  `window.__appBereit = true`** (Z.54). Bei Fehler im `catch` (Z.323-331) wird
  `__appBereit` trotzdem true gesetzt und ein `toast fehl` gezeigt.
- `web/js/boot-guard.js` (klassisches Skript, KEIN ESM): erzeugt `#boot-banner`
  bei (1) `file://`-Protokoll, (2) `window.error`/`unhandledrejection`,
  (3) Timeout 8s ohne `__appBereit`. Der Test laeuft ueber http -> Fall 1
  entfaellt; relevant sind Fall 2/3.
- `web/js/dashboard-app.js` `baueDashboard(db)` (Z.20-43): baut DATA/CFG,
  setzt `window.DATA`, `window.CFG`, `window.buildSankeyOption`, macht
  `#dashboard-inhalt` sichtbar, laedt `dashboard.js` als `<script>` nach.
- `web/vendor/dashboard/dashboard.js` (755 Z., klassisches IIFE-Skript):
  - `activateTab(name)` (84-93): schaltet `is-active`-Klassen, ruft
    `resizeVisibleCharts` per rAF.
  - `setDok(id)` (~101-106): aktiver Switcher-Button.
  - **`setupSankeyDrill()` (465-503)** — die fuer das Issue zentrale Funktion:
    registriert einen ECharts-`click`-Handler auf `#c_sankey`. Bei Klick auf
    einen **Knoten** (`params.dataType === "node"`): mittlerer Knoten ->
    `sankeyExpand = null`; aufklappbarer Knoten (`drillExpandbar`) ->
    `sankeyExpand = { seite, key }`; Klick in bereits aufgeklappten Bereich ->
    `null`. Danach `renderSankey()` + `updateSankeyHinweis()`.
  - `renderSankey()` (445-448): `entry.inst.setOption(revive(sankeyOption()), true)`.
  - `sankeyOption()` (437-443): nutzt `window.buildSankeyOption(posten,
    aktivDok, sankeyExpand)`; **Fallback** auf `CFG.dok_charts[dok].sankey`,
    falls `buildSankeyOption` fehlt.
  - Verdrahtung Z.719-754: Klick-Listener auf `.tabs`/`.switcher`,
    `registerChart("c_sankey", "sankey", "sankey")` u.a., `setupSankeyDrill()`,
    Initial `setDok` + `activateTab("ueberblick")`.
- `web/js/sankey-drill.js`: reine Funktionen (kein DOM/ECharts) —
  `buildSankeyOption(posten, dokId, expand)`, `quelleVonPosten`, `kappen`,
  `TOP_N=8`, `einnahmePosten`, `ausgabePosten`. Jeder Knoten traegt
  `drillSeite` / `drillKey` / `drillExpandbar` — diese Felder steuern den
  Klick-Handler. Bereits via run.mjs unit-getestet (Z.229-366).
- `web/js/pipeline.js` `verarbeitePdf(mupdf, db, name, bytes, onStufe)` —
  Upload-Verarbeitungspfad; `web/js/db.js` — IndexedDB/In-Memory.

### `<interfaces>` — Observable States fuer den Browser-Test

<interfaces>
// === BOOT ===
window.__appBereit === true        // App-Init durch (Erfolg ODER Fehler)
document.querySelector("#boot-banner") === null   // kein Boot-Problem
// Bei Boot-Fehler: #boot-banner existiert, enthaelt <strong>Fehler.../<strong>

// === UPLOAD (web/js/app.js) ===
// 1. Datei in #file-input setzen -> input "change" -> verarbeiteDateien()
// 2. Pro PDF: progress-list li.progress-item, Stufen via .progress-stage:
//    "Text wird extrahiert" -> "...geparst" -> "Plausibilitaet..." ->
//    "Daten werden gespeichert" -> li.is-done
// 3. WICHTIG: bei >=1 Erfolg ruft die App  db.sichern()  dann
//    location.reload()  (app.js:225-231). Die Seite startet KOMPLETT NEU.
//    -> Der Test muss NACH dem Reload assertieren, nicht auf progress-list.
//    -> Persistenz traegt den Stand ueber den Reload (IndexedDB).
// Endzustand nach Reload (DB hat Dokumente):
//    #doc-tbody hat >=1 <tr>
//    <tr> ... <span class="doc-status ok">5/5 Pruefungen</span>   (gruen)
//    #doc-manager  ist NICHT [open]   (zugeklappt bei >0 Dok)
//    #dashboard-leer  hidden=true
//    #dashboard-inhalt  hidden=false  (sichtbar)

// === DASHBOARD ===
#dashboard-inhalt:not([hidden])           // Dashboard sichtbar
#switcher-buttons button.switch-btn       // >=1 Dokument-Button
.tab-btn.is-active                        // genau ein aktiver Tab
.tab-panel.is-active                      // sichtbares Panel (CSS display:block)
#c_sankey canvas                          // ECharts hat gerendert

// === TAB-WECHSEL ===
// Klick auf button.tab-btn[data-tab="einnahmen"]
//   -> .tab-btn[data-tab=einnahmen].is-active
//   -> .tab-panel[data-panel=einnahmen].is-active  (sichtbar)

// === SANKEY-DRILL (vendor/dashboard.js setupSankeyDrill) ===
// Sankey ist ein ECharts-Canvas in #c_sankey — KEINE klickbaren DOM-Knoten.
// Ein Klick muss ECharts-intern erfolgen (Pixel-Klick auf den Knoten ODER
// programmatisch via echarts dispatchAction). Aufgeklappter Zustand sichtbar:
//   #sankey-hinweis.is-visible  (Text "Aufgeklappt — ...")
//   #sankey-reset  klappt zurueck (-> #sankey-hinweis verliert .is-visible)
// Knoten-Daten tragen drillSeite/drillKey/drillExpandbar (sankey-drill.js).

// === PERSISTENZ ===
// Nach manuellem reload() bleiben Dokumente in #doc-tbody (IndexedDB).
// In Node ist persistent=false; im echten Browser true.
</interfaces>

**Heikle Stelle fuer den Sankey-Test:** Der Sankey ist ein ECharts-Canvas, es
gibt keine DOM-Knoten zum Anklicken. Ein Browser-Test muss entweder (a) per
Pixel-Koordinate in den Canvas klicken (sproede) oder (b) im Seitenkontext
`echarts.getInstanceByDom(document.getElementById('c_sankey'))` holen und
`.dispatchAction({ type: 'click', ... })` bzw. den `click`-Handler ueber die
ECharts-API ausloesen. Beobachtbarer Effekt des Drill-downs:
`#sankey-hinweis` bekommt `.is-visible`. Das ist die robusteste Assertion.
Der gemeldete "Sankey scheint nicht zu funktionieren"-Fehler ist genau hier zu
reproduzieren — die Builder-Funktionen in `sankey-drill.js` sind bereits
unit-getestet (run.mjs Z.229-366, alle gruen), der Verdacht liegt also auf der
**Verdrahtung in `dashboard.js`** (`setupSankeyDrill`) oder einem stale Deploy.

## 4. CI-Workflow — `.github/workflows/pages.yml`

- Aktuell: ein Job `deploy` (Z.22), `ubuntu-latest`. Steps: `checkout@v6`,
  `configure-pages@v6`, `upload-pages-artifact@v5` mit `path: web`,
  `deploy-pages@v5`. **Kein Build-Schritt** — `web/` wird unveraendert
  hochgeladen.
- `on: push branches:[main]` + `workflow_dispatch`. Concurrency-Group `pages`.
- **`github.sha`** ist im Workflow-Kontext immer verfuegbar (der Commit, der
  den Workflow ausloest) — Zugriff via `${{ github.sha }}` in Steps oder als
  `$GITHUB_SHA` Env-Var. Auch `github.ref_name` etc.
- **Einbau Browser-Test-Job**: ein separater Job `e2e` vor `deploy` (mit
  `needs:` ggf.), `runs-on: ubuntu-latest`. Schritte: `checkout`,
  `actions/setup-node`, `npm ci` (Achtung: aktuell existiert nur ein winziges
  `package-lock.json`), `npx playwright install --with-deps chromium`,
  `make web-sync` (schema/sql nach web/ kopieren — sonst 404), Test starten.
  Alternativ den Test nur dokumentieren und lokal lassen (Akzeptanzkriterium
  laesst beides zu: "in CI eingebunden ODER dokumentiert").
- **Einbau Stempel-Step**: ein Step im `deploy`-Job VOR `upload-pages-artifact`,
  der `github.sha` in eine statische Datei in `web/` schreibt — siehe Punkt 5.

## 5. Git-Commit-Stempel

**Einbaustelle Seite:** `web/index.html` Footer Z.332-335
(`<footer class="footer">`). Ein neues `<span id="build-stamp">` ergaenzen.

**Mechanik — Vorschlag fuer den Plan (zwei saubere Varianten):**
- **Variante A (statische JSON-Datei + fetch):** ein neuer Step in `pages.yml`
  schreibt `web/build-info.json` (`{"commit":"<sha>","datum":"..."}`) vor dem
  Upload, z.B.
  `echo "{\"commit\":\"$GITHUB_SHA\"}" > web/build-info.json`.
  Ein kleines Skript in der Seite (`fetch("./build-info.json")`) fuellt
  `#build-stamp`. Lokal ohne die Datei: Fallback-Text "lokal/dev".
- **Variante B (Platzhalter-Ersetzung in index.html):** der Workflow ersetzt
  einen Platzhalter (z.B. `__BUILD_COMMIT__`) im Footer per `sed` vor dem
  Upload. Einfacher, aber index.html traegt dann im Repo den Platzhalter.

Variante A passt besser, weil `web/` deklariert "ohne Build-Schritt deploybar"
ist und ein fehlendes `build-info.json` lokal sauber abfangbar bleibt.
`build-info.json` sollte in `.gitignore` (es ist ein Build-Artefakt) — aktuell
ignoriert `.gitignore` nur `/data/*`, `/build/`, `node_modules` etc.; ein
Eintrag `/web/build-info.json` waere konsequent.

**Browser-Test-Assertion:** Test liest `#build-stamp` und prueft ihn gegen den
erwarteten Commit (in CI: `$GITHUB_SHA`; lokal: `git rev-parse HEAD`).

## 6. Wiederverwendbar vs. neu

**Wiederverwendbar:**
- `scripts/serve.mjs` als Test-Webserver (mit dem Port-Vorbehalt aus Punkt 2).
- Das Fixture-Pinning-Muster aus `run.mjs` (eine feste Herzogenburg-PDF).
- `documents/VA-2026-Auflage.pdf` als Upload-Fixture (klein genug, im Repo,
  Referenzwerte bekannt: 5/5 Pruefungen, Nettoergebnis 474200).
- Die `pruefe()`-Mini-Test-Linie, falls man den Playwright-eigenen Runner
  nicht will (Empfehlung: Playwrights `@playwright/test` nehmen — Standard,
  bringt webServer-Lifecycle + Assertions mit).
- `make web-sync` als Vorbereitungsschritt (schema.sql/sql nach web/).
- Die durchgehend vorhandenen DOM-IDs/`data-*`/`is-active`-Hooks — **keine
  neuen Test-IDs noetig.**

**Neu zu bauen:**
- Playwright als devDependency (`package.json` `devDependencies` neu anlegen),
  `playwright.config.*`, ggf. `npx playwright install chromium`.
- Der Test-Harness selbst (`tests/e2e/` o.ae.) mit den Faellen: Boot ohne
  Banner, Upload -> gruener Status, Dashboard sichtbar, Tab-Wechsel, Charts
  rendern, Sankey-Drill (`#sankey-hinweis.is-visible`), Persistenz nach Reload,
  Build-Stempel-Check.
- npm-Skript `test:e2e` + Makefile-Ziel (z.B. `web-e2e`, in `.PHONY`).
- Git-Stempel: `#build-stamp` im Footer, `build-info.json`-Erzeugung in
  `pages.yml`, kleines Lese-Skript in der Seite.
- Optionaler CI-Job `e2e` in `pages.yml`.
- `.gitignore`-Eintrag fuer `web/build-info.json`.

**Stolpersteine fuer den Plan:**
- Der Upload-Flow macht `location.reload()` — Assertions NACH dem Reload, nicht
  auf die fluechtige `progress-list`. Playwright muss auf die Navigation warten.
- `web/schema.sql` + `web/sql/` sind generiert; ohne `make web-sync` lauft die
  App nicht (fetch 404 -> Boot-Fehler). Im Repo liegen sie aber bereits
  (commited), also nur in CI / nach `make clean` kritisch.
- Die Vendor-Module sqlite-wasm/mupdf liegen unter `web/vendor/` (committed) —
  `node_modules/` ist nur fuer den Node-Test (`run.mjs`); der Browser-Test
  braucht `node_modules` NICHT zum Servieren, nur fuer Playwright selbst.
- ECharts kommt per CDN (`cdn.jsdelivr.net`, index.html:10) — der Browser-Test
  braucht Netzzugang oder muss ECharts vendoren/mocken. In CI relevant.
- `package-lock.json` ist aktuell minimal (452 Bytes) — `npm ci` mit Playwright
  erfordert ein aktualisiertes Lockfile.
- Node v26.1.0 in der Umgebung; Playwright unterstuetzt das.

## Graphify Coverage

Graphify-MCP-Werkzeuge (`mcp__graphify__*`) standen in diesem Lauf NICHT zur
Verfuegung. Die Recherche stuetzt sich vollstaendig auf `Read`, `Grep`/`Bash`
und direktes Lesen. Call-Graph-Aussagen oben (z.B. "app.js ruft baueDashboard")
sind aus den `import`-Statements und Funktionsaufrufen im gelesenen Quelltext
abgeleitet, nicht aus einem Graphen.

## End-to-end gelesene Dateien (HIGH confidence)

- `/workspace/tests/js/run.mjs`
- `/workspace/scripts/serve.mjs`
- `/workspace/Makefile`
- `/workspace/package.json`
- `/workspace/.github/workflows/pages.yml`
- `/workspace/web/index.html`
- `/workspace/web/js/app.js`
- `/workspace/web/js/boot-guard.js`
- `/workspace/web/js/dashboard-app.js`
- `/workspace/web/js/sankey-drill.js`
- `/workspace/web/vendor/dashboard/dashboard.js` (Z. 1-95, 425-503, 700-755;
  Rest per Grep abgedeckt)
- `/workspace/web/js/db.js` (Z. 1-40)
- `/workspace/tests/test_parser.py` (Z. 1-20)
