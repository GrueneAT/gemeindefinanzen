# Plan: Migration auf design-system v2.0 (Tokens, Komponenten, gat-charts.js)

<objective>
Was dieser Plan erreicht: Die App raeumt ihre lokale `--web-*`-Token-Schicht
und ihre lokalen Komponenten-Klassen (`.web-panel`, `.metric-card`,
`.web-callout`, `.web-section-head`, `.web-hero`, `.web-brandbar*`) komplett
aus und konsumiert ab sofort die org-weite `--gat-web-*`-Schicht plus die
`.gat-*`-Komponenten aus DS v2.0. `web/js/dashboard-charts.js` und
`web/js/sankey-drill.js` importieren die Chart-Konstanten und ECharts-Helfer
aus dem gehosteten `gat-charts.js`-ES-Modul. Ein App-eigener
`.gat-mode-hc`-Toggle-Knopf in der Brandbar aktiviert den
High-Contrast-Modus (FOWT-Prevention via `<head>`-Inline-Skript,
Persistenz in `localStorage`).

Warum es wichtig ist: Die lokale Schicht war historisch die Vorlage, aus
der DS v2 die `--gat-web-*`-Schicht gebaut hat. Solange beide Schichten
parallel leben, gibt es doppelte Pflege (Hex-Werte, Komponenten-Regeln,
Chart-Konstanten) und semantische Drift-Risiko. Nach diesem Issue ist die
App-Schicht nur noch ein duenner App-spezifischer Aufsatz (`.app-*`-Klassen
fuer Dropzone/Toast/Doc-Manager/Sankey-Bar/Stats-Grid/Footer) auf einer
geteilten DS-Basis. Aenderungen an Tokens, Brandbar, Panel oder
Chart-Defaults laufen ab dann zentral im DS-Repo.

Scope:
- IN: 26 Token-Renames `--web-*` -> `--gat-web-*`; lokale Komponenten-CSS
  raus; Markup-Klassen-Renames in `index.html`; Doppel-Klassen fuer Tabs
  und Switcher (`.tab-btn gat-tab`, `.switch-btn gat-switch-btn`);
  Vendor-Tab-/Switcher-Block in `dashboard.css` entfernen; HC-Toggle
  (Markup + CSS + JS + `<head>`-Inline-Skript); `gat-charts.js`-Import in
  beiden Chart-Modulen; Iteration-19-Abschluss-Doku; Pre-/Post-Snapshots
  und Diff-Bericht.
- OUT: `web/vendor/dashboard/dashboard.js` (TABU); Vendoring von
  `gat-charts.js`; Iter-19-Naming-Sweep ueber funktionale Klassen
  (`is-active`, `tab-btn`, `switch-btn` bleiben); kompletter
  Vendor-CSS-Refactor; visueller Redesign-Sweep ueber die DS-Konvergenz
  hinaus.
</objective>

<strategy>
Konvergenz statt Refactor. Die lokale `--web-*`-Schicht ist faktisch
hex-identisch zur upstream `--gat-web-*`-Schicht (Researcher: 26 von 26
Tokens drift-frei), und die lokalen Komponenten-Regeln sind 1:1 die
Vorlage gewesen, aus der `.gat-panel`/`.gat-metric-card`/`.gat-callout`/
`.gat-section-head`/`.gat-hero` im DS gebaut wurden. Migration ist
deshalb in 95 % der Faelle Such-Ersetz, nicht Design-Entscheidung.

Reihenfolge ist durch CONTEXT.md Decision 1 fixiert: **5 Phasen, je ein
atomarer Commit**, jeweils mit gruener Test-Suite. Davor (Task 0) ein
Baseline-Snapshot-Commit, danach (Task 6) Snapshot-Diff + Audit. Sieben
Tasks gesamt, klare lineare Abhaengigkeit.

Drei strategische Optionen wurden im Researcher-Doc erwogen:
1. **Volle 1:1-Angleichung (gewaehlt).** Lokale Schicht raus, DS uebernimmt.
   Risiko: Doppelpflege bleibt nicht; Stil-Drift minimal, weil 1:1.
2. **Komponenten umstellen, `--web-*` behalten** — verworfen: widerspricht
   dem expliziten Konvergenz-Ziel des Issues; doppelte Pflege bliebe.
3. **DS-Klassen nur als zweite Klasse, lokale Regeln zuerst behalten** —
   verworfen: gleicher Doppel-Pflege-Defekt, kein Konvergenz-Gewinn.

Drei load-bearing Entscheidungen aus dem Research-Doc:
- **Tab-/Switcher-Block in `dashboard.css` muss entfernt werden** (nicht
  nur ueberschreibend doppelt-klassen), weil sonst die spaeter geladene
  Vendor-CSS-Regel die DS-Defaults ueberdeckt (gleiche Spezifitaet,
  spaetere Regel gewinnt) und die Doppel-Klassen optisch nichts bewirken.
- **`INK`-Shape-Mismatch in den Chart-Modulen.** App nutzt semantische
  Rollen (`green/blue/orange/red/soft/paper`), DS nutzt tonale Klassen
  (`text/soft/mute/hairline/gridline/axis/green/clay/slate`). Loesung:
  Import als `INK as DS_INK`, lokaler App-Adapter mappt `PALETTE[*]` auf
  die App-Rollen.
- **HC-Toggle FOWT-Prevention.** `<head>`-Inline-Skript setzt die Klasse
  auf `<html>` (nicht `<body>`, das existiert da noch nicht) **vor**
  dem ersten Paint, mit try/catch wegen `localStorage`-Sperre im
  Privatmodus. Der JS-Toggle in `app.js` spiegelt die Klasse danach auch
  auf `<body>`.

Risiko-Profil: niedrig. Keine Algorithmus-Aenderung, keine Datenmodelle,
keine `dashboard.js`-Vendor-Aenderung. Visuelle Regression kontrolliert
durch Pre-/Post-Playwright-Snapshots bei 1440px gegen die
Fixture-PDF `VA-2026-Auflage.pdf` (CONTEXT.md Decision 2). Erlaubte
Pixel-Drift bis ~5 % in DS-bewussten Stellen, keine Layout-Brueche.
</strategy>

<skills>
Keine Workspace-Skills vorhanden (`.claude/skills/` existiert nicht in
diesem Repo). CLAUDE.md-Regeln (kein Vendoring, kein Offline, Deutsch in
UI, keine Werkzeug-Attribution) gelten direkt.
</skills>

<context>
Issue: @.issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/ISSUE.md
Context: @.issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/CONTEXT.md
Research: @.issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/RESEARCH.md

<interfaces>
<!-- Executor: nutze diese Vertraege direkt. Nicht den Codebase durchsuchen. -->

DS v2.0 Tokens (alle hex-identisch zu den lokalen `--web-*`):
--gat-web-bg #f3f5f0, --gat-web-surface #ffffff, --gat-web-surface-sunk #f7f9f4,
--gat-web-hairline #e1e4db, --gat-web-text #23271f, --gat-web-text-soft #5e6358,
--gat-web-text-mute #6b6f63, --gat-web-clay-text #9c5a38,
--gat-web-green-deep #2c6e40, --gat-web-green #4a8a52,
--gat-web-green-tint #e7efe3, --gat-web-yellow #ecd64a,
--gat-web-chart-1 #3f7d4f, --gat-web-chart-2 #6ba368, --gat-web-chart-3 #4f93a0,
--gat-web-chart-4 #c9a24b, --gat-web-chart-5 #b9744f, --gat-web-chart-6 #9c5b7d,
--gat-web-chart-7 #5d6b8a, --gat-web-chart-8 #8a8f7d,
--gat-web-radius-control 6px, --gat-web-radius-card 10px,
--gat-web-shadow (identisch zur App), --gat-web-focus-ring (identisch),
--gat-web-page-max min(2040px, 94vw), --gat-web-focus-offset 2px

DS v2.0 Komponenten (greifen ueber das gehostete design-system.css):
.gat-header / .gat-header__inner / .gat-header__brand / .gat-header__logo /
  .gat-header__wordmark / .gat-header__nav / .gat-header__nav-list /
  .gat-header__nav-current
.gat-panel / .gat-panel__head / .gat-panel__head-row / .gat-panel__body /
  .gat-panel__body--table / .gat-panel__note / .gat-panel:fullscreen
.gat-metric-card (Modifier: --ertrag / --aufwand / --netto / --hero) +
  .gat-metric-card__num / .gat-metric-card__label
.gat-callout
.gat-section-head
.gat-hero / .gat-hero__title / .gat-hero__intro
.gat-tabbar / .gat-tab / .gat-tab.is-active
.gat-switcher / .gat-switcher__label / .gat-switch-btn / .gat-switch-btn.is-active
.gat-skiplink
.gat-mode-hc (Variant, durch <body class="gat-mode-hc"> aktiviert)

Globale DS-Bloecke (greifen automatisch):
:focus-visible auf .gat-btn/.gat-skiplink/.gat-tag/.gat-tab/.gat-switch-btn/.gat-header__brand
@media (prefers-reduced-motion: reduce) — Transitions auf 0.01ms
@media print — Header/Panel/Metric-Card Print-Defaults

From gat-charts.js (https://grueneat.github.io/design-system/gat-charts.js):
export const PALETTE: string[8]  // ["#3f7d4f","#6ba368","#4f93a0","#c9a24b","#b9744f","#9c5b7d","#5d6b8a","#8a8f7d"]
export const INK: { text:"#23271f", soft:"#5e6358", mute:"#6b6f63",
                    hairline:"#e1e4db", gridline:"#e7eae2", axis:"#cdd2c8",
                    green:"#3f7d4f", clay:"#9c5a38", slate:"#5d6b8a" }
export const LABEL_SIZE:    15
export const AXIS_SIZE:     14
export const BAR_MAX_DICHT: 56
export const BAR_MAX_WEIT:  130
export const VA_DECAL: { symbol:"rect", symbolSize:1, dashArrayX:[3,0],
                         dashArrayY:[1,6], color:"rgba(255,255,255,0.45)",
                         rotation:-Math.PI/4 }
export function tip(extra={}): EChartsTooltipOption
export function legende(extra={}): EChartsLegendOption
export function grid(extra={}): EChartsGridOption
export function planIstLegende(): EChartsLegendOption  // 2 Serien "Ist (RA)"/"Plan (VA/NVA)"

App-Adapter-Schicht (Phase 3, in dashboard-charts.js neu anzulegen):
import { PALETTE, INK as DS_INK, LABEL_SIZE, AXIS_SIZE,
         BAR_MAX_DICHT, BAR_MAX_WEIT, VA_DECAL,
         tip, legende, grid, planIstLegende }
  from "https://grueneat.github.io/design-system/gat-charts.js"
const INK = { green:PALETTE[0], blue:PALETTE[2], orange:PALETTE[3],
              red:PALETTE[4], soft:PALETTE[7], paper:"#ffffff" }
const ACHSE_TEXT       = DS_INK.text       // "#23271f"
const ACHSE_TEXT_SOFT  = DS_INK.soft       // "#5e6358"
const ACHSE_LINIE      = DS_INK.axis       // "#cdd2c8"
const ACHSE_SPLIT      = DS_INK.gridline   // "#e7eae2"
const CHART_FONT       = "Barlow Semi Condensed, sans-serif"

Heutige App-Tokens und Markup-Stellen (zu ersetzen):
web/css/app.css :root — 26 lokale `--web-*`-Token-Deklarationen + 4
Adapter-Aliase (--app-hair/--app-soft/--app-akzent-primaer/--app-risiko)
+ 1 separate --web-page-max-Deklaration ausserhalb des Token-Blocks +
selector-scoped `--web-focus-offset: -2px` (auf .tab-btn, .sortable,
.doc-manager-summary).

Heutiges Brandbar-Markup (web/index.html Z. 19-33), zu ersetzen:
  <header class="gat-header web-brandbar">
    <div class="gat-header__inner">
      <a class="gat-header__logo web-brandbar__brand" href=".">
        <img class="web-brandbar__logo" src="https://grueneat.github.io/design-system/assets/gruene-logo.svg" alt="Die Gruenen" width="150" height="132">
        <span class="web-brandbar__wordmark">Gemeindefinanzen</span>
      </a>
      <nav class="gat-nav web-brandbar__nav" aria-label="Werkzeuge">
        <ul class="web-brandbar__nav-list">
          <li><span class="web-brandbar__nav-current">VRV-2015-Analyse</span></li>
        </ul>
      </nav>
    </div>
  </header>

Ziel-Brandbar-Markup (Phase 2 + Phase 4 fertig):
  <header class="gat-header">
    <div class="gat-header__inner">
      <a class="gat-header__brand" href=".">
        <img class="gat-header__logo" src="https://grueneat.github.io/design-system/assets/gruene-logo.svg" alt="Die Gruenen" width="150" height="132">
        <span class="gat-header__wordmark">Gemeindefinanzen</span>
      </a>
      <nav class="gat-header__nav" aria-label="Werkzeuge">
        <ul class="gat-header__nav-list">
          <li><a class="gat-header__nav-current" aria-current="page" href=".">VRV-2015-Analyse</a></li>
        </ul>
        <button type="button" class="gat-header__a11y-toggle" id="hc-toggle"
                aria-pressed="false" aria-label="Hohen Kontrast einschalten">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20V2z"/></svg>
          <span>Kontrast</span>
        </button>
      </nav>
    </div>
  </header>

Heutige Vollbild-Wiring in web/js/app.js (verdrahteVollbild(), ~Z. 138-180):
- querySelectorAll(".web-panel:has(.dash-chart)") → ".gat-panel:has(.dash-chart)"
- panel.querySelector(".web-panel__head") → ".gat-panel__head"
- btn.className = "web-panel__fs-btn" → "app-panel-fs-btn"  (App-eigen, kein DS-Pendant)
- wrap.className = "web-panel__head-row" → "gat-panel__head-row"
- document.querySelector(".web-panel__fs-btn") → ".app-panel-fs-btn"
- e.target.closest(".web-panel") → ".gat-panel"

Heutige Test-Selectors (tests/e2e/sparpotenzial.spec.mjs:27):
'section.web-panel[data-typ-panel="RA"]' → 'section.gat-panel[data-typ-panel="RA"]'

Heutige Chart-Konstanten in web/js/dashboard-charts.js (zu entfernen):
const INK = { green:"#3f7d4f", blue:"#4f93a0", orange:"#c9a24b",
              red:"#b9744f", soft:"#8a8f7d", paper:"#ffffff" }    // Z. 16-23
const LABEL_SIZE = 15, AXIS_SIZE = 14                              // Z. 39-40
const BAR_MAX_DICHT = 56, BAR_MAX_WEIT = 130                       // Z. 53-54
const VA_DECAL = { ... dashArrayX:[1,0], dashArrayY:[3,4],
                   color:"rgba(255,255,255,0.55)" }                // Z. 543-549
function tip(extra={}) { ... bottom-padding+box-shadow leicht abweichend }   // Z. 68-82
function legende(extra={}) { ... bottom:0 als App-Default }        // Z. 85-96
function grid(extra={}) { ... identisch zu DS }                    // Z. 60-62
function planIstLegende() { ... }                                  // Z. 561-576

Bleibend lokal (App-spezifisch, NICHT ersetzen):
CHART_FONT, baseText(), catAxis(), valAxis(), ELLIPSE_FORMATTER,
FMT_MIO_AXIS, FMT_K_LABEL, round(), bar(), trendBalken(),
MEHRJAHR_PALETTE.

Heutige Chart-Konstanten in web/js/sankey-drill.js (zu entfernen):
const INK = { green, blue, orange, red, soft, paper }              // ~Z. 16-23
const ACHSE_TEXT, ACHSE_LINIE, LABEL_SIZE
const CHART_FONT (bleibt; nur Whitespace)

Bleibend lokal in sankey-drill.js:
const TOOLTIP = { ... }   // App-spezifische Tooltip-Konfig, NICHT durch tip() ersetzen
</interfaces>

<call_sites>
Searched: CLI-Surface dieses Plans (App ist eine Browser-App ohne CLI-Flag-
Aenderungen). Grep nach Konsumenten der `--web-*`-Tokens, der `.web-*`-
Klassen, der `gat-charts.js`-URL und der HC-Toggle-Hooks ueber alle relevanten
Verzeichnisse.

Surfaces grepped: web/, tests/, docs/, scripts/, .github/workflows/, README*,
Makefile, package.json scripts.

Found:
- web/css/app.css — IN SCOPE (Task 1, Task 2): Token-Definitionen + lokale
  Komponenten-Regeln.
- web/index.html — IN SCOPE (Task 2, Task 4): Brandbar-Markup, Komponenten-
  Klassen, HC-Toggle-Markup, `<head>`-Inline-Skript.
- web/js/app.js — IN SCOPE (Task 2, Task 4): Vollbild-Selektoren (`.web-panel*`
  -> `.gat-panel*` / `.app-panel-fs-btn`) und neue verdrahteHcToggle().
- web/js/dashboard-app.js — IN SCOPE (Task 2): `btn.className = "switch-btn"`
  wird `"switch-btn gat-switch-btn"`.
- web/js/dashboard-charts.js — IN SCOPE (Task 3): Import + Konstanten-Removal.
- web/js/sankey-drill.js — IN SCOPE (Task 3): Import + Konstanten-Removal.
- web/vendor/dashboard/dashboard.css — IN SCOPE (Task 1 fuer Token-Refs;
  Task 2 fuer Tab-/Switcher-Block-Entfernung).
- web/vendor/dashboard/dashboard.js — OUT OF SCOPE (TABU per ISSUE.md +
  CONTEXT.md).
- tests/e2e/sparpotenzial.spec.mjs:27 — IN SCOPE (Task 2): Selector-Update.
- tests/e2e/dashboard.spec.mjs — OUT OF SCOPE: nutzt nur Funktionsklassen
  (`.tab-btn`, `.tab-panel`, `.is-active`) die unveraendert bleiben.
- tests/e2e/helpers.mjs — OUT OF SCOPE: Fixture-Loader, wird von den neuen
  Baseline-/After-Snapshot-Skripten in Task 0/Task 6 mitgenutzt.
- docs/web-design-system.md — IN SCOPE (Task 5): Iteration-19-Eintrag.
- web/vendor/LIZENZEN.md — IN SCOPE (Task 5): gat-charts.js-Eintrag.
- .github/workflows/pages.yml — OUT OF SCOPE: deployt statisches `web/` —
  keine CSS/JS-Buildschritte, keine Klassen-/Token-Refs.
- README.md, package.json scripts, scripts/serve.mjs — OUT OF SCOPE: keine
  Klassen-/Token-Refs.

Keine weiteren Aufrufer der entfernten Tokens, Klassen oder Chart-Konstanten
gefunden. Tests `npm run test:js` (`tests/js/run.mjs`) und Python-Tests
(`PYTHONPATH=src pytest -q`) haengen nicht an Browser-CSS-Klassen.
</call_sites>

Key files:
@web/css/app.css — Lokale Token-Schicht (Z. 1-180) + lokale Komponenten-CSS (Z. ~190-580) + Print/Reduce-Motion (Z. ~1099-1199)
@web/index.html — HTML-Struktur, Brandbar, alle Tabs/Panels (756 LOC)
@web/js/app.js — Init, Upload-Wiring, Vollbild-Logik (604 LOC)
@web/js/dashboard-app.js — Doc-Switcher mit `btn.className = "switch-btn"`
@web/js/dashboard-charts.js — Lokale Chart-Konstanten + Builder (1511 LOC)
@web/js/sankey-drill.js — Sankey-Drill-Builder mit lokalem INK/TOOLTIP
@web/vendor/dashboard/dashboard.css — Vendor-CSS mit Token-Refs + Tab-/Switcher-Regeln (267 LOC)
@docs/web-design-system.md — Iter-1-18-Log
@web/vendor/LIZENZEN.md — Lizenzen
@tests/e2e/sparpotenzial.spec.mjs — Selector-Update Z. 27
@documents/VA-2026-Auflage.pdf — Snapshot-Fixture-PDF
</context>

<commit_format>
Format: conventional mit Issue-ID-Prefix (per `.issues/config.yaml`:
`commit_format: "{id}: {message}"`).
Example: `vyz9q: refactor(tokens): migrate --web-* to upstream --gat-web-*`
Pattern: `{issue-id}: {type}({scope}): {description}`
Keine Werkzeug-Attribution. Kein Co-Authored-By.
</commit_format>

<tasks>

<task type="auto">
  <name>Task 0: Baseline-Snapshots (Pre-Migration)</name>
  <files>
  .issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/screenshots/snapshot.spec.mjs,
  .issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/screenshots/baseline/ (Bilder)
  </files>
  <action>
  Vor jeder Code-Aenderung Baseline-Screenshots aller 7 Tabs + Landing
  erstellen, damit Task 6 einen festen Vergleichsanker hat.

  Schritt 1: Snapshot-Spec schreiben in
  `.issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/screenshots/snapshot.spec.mjs`.
  Das Spec liegt **bewusst ausserhalb von `tests/e2e/`**, damit Playwright
  es nicht als regulaeren E2E-Test laeuft. Inhalt:
  - Importiert helpers von `tests/e2e/helpers.mjs` (Pfad relativ
    aufloesen) oder dupliziert die minimal noetigen Helfer inline.
  - Nutzt `documents/VA-2026-Auflage.pdf` als Fixture, Viewport 1440x900.
  - 8 Screenshots: Landing (vor Upload) + 7 Tab-Panels (`uebersicht`,
    `einnahmen`, `ausgaben`, `vermoegen`, `schulden`, `sparpotenzial`,
    `dokumente`).
  - Ziel-Ordner ueber env-Variable `SNAPSHOT_DIR` einstellbar (default
    `screenshots/baseline`).
  - Bilder als `.png` (full page, `omitBackground: false`, `animations:
    'disabled'`).

  Schritt 2: Spec gegen die *unveraenderte* App ausfuehren:
  ```
  SNAPSHOT_DIR=.issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/screenshots/baseline \
    npx playwright test .issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/screenshots/snapshot.spec.mjs \
    --config=playwright.config.mjs
  ```
  Erwartet: 8 `.png`-Dateien in `screenshots/baseline/`.

  Schritt 3: Vor dem Commit verifizieren, dass `npm run test:js` und
  `npm run test:e2e` (ohne den Snapshot-Spec) weiterhin gruen sind —
  die Spec liegt nicht im Test-Verzeichnis, sie soll die Suite nicht
  beeinflussen.

  Schritt 4: Atomarer Commit (Artefakt-only):
  `vyz9q: chore(snapshots): baseline screenshots pre-migration`.
  Commit enthaelt ausschliesslich Dateien unter
  `.issues/vyz9q-…/screenshots/` (Spec + Bilder). Keine
  Werkzeug-Attribution im Commit-Body.
  </action>
  <verify>
  <automated>ls -1 .issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/screenshots/baseline/*.png | wc -l | grep -q "^8$" && npm run test:js && npm run test:e2e</automated>
  </verify>
  <done>
  - 8 Baseline-Screenshots existieren unter
    `.issues/vyz9q-.../screenshots/baseline/` (Landing + 7 Tabs).
  - `screenshots/snapshot.spec.mjs` ist reproduzierbar (kann mit
    anderem `SNAPSHOT_DIR` erneut laufen).
  - `npm run test:js` und `npm run test:e2e` bleiben gruen.
  - Ein Commit mit Prefix `vyz9q: chore(snapshots): …` auf der
    Feature-Branch.
  </done>
</task>

<task type="auto">
  <name>Task 1: Phase 1 — Tokens migrieren (--web-* -> --gat-web-*)</name>
  <files>web/css/app.css, web/vendor/dashboard/dashboard.css</files>
  <action>
  Reiner CSS-Such-Ersetz-Schritt. Keine Markup-Aenderungen. Alle
  26 lokalen `--web-*`-Tokens und ihre Konsumenten konvergieren auf die
  upstream `--gat-web-*`-Schicht. Wert-Drift: keine (RESEARCH.md Sektion
  "Token-Migrations-Mapping"). Daher reine Namens-Substitution.

  Schritt 1 — `web/css/app.css :root`-Block:
  - Alle 26 lokalen `--web-*`-Deklarationen (`--web-bg`, `--web-surface`,
    `--web-surface-sunk`, `--web-hairline`, `--web-shadow`, `--web-text`,
    `--web-text-soft`, `--web-text-mute`, `--web-green-deep`,
    `--web-green`, `--web-green-tint`, `--web-yellow`, `--web-clay-text`,
    `--web-chart-green`, `--web-chart-leaf`, `--web-chart-teal`,
    `--web-chart-gold`, `--web-chart-clay`, `--web-chart-plum`,
    `--web-chart-slate`, `--web-chart-sage`, `--web-radius-control`,
    `--web-radius-card`, `--web-focus-ring`, `--web-page-max`,
    `--web-focus-offset`) **ersatzlos entfernen** — das DS liefert sie
    via `--gat-web-*`.
  - Chart-Namen sind im DS numerisch: `--web-chart-green` -> verwende
    `--gat-web-chart-1`; `--web-chart-leaf` -> `--gat-web-chart-2`;
    `--web-chart-teal` -> `--gat-web-chart-3`;
    `--web-chart-gold` -> `--gat-web-chart-4`;
    `--web-chart-clay` -> `--gat-web-chart-5`;
    `--web-chart-plum` -> `--gat-web-chart-6`;
    `--web-chart-slate` -> `--gat-web-chart-7`;
    `--web-chart-sage` -> `--gat-web-chart-8`.
  - Die 4 App-Adapter-Aliase **behalten**, aber auf DS-Tokens
    ummappen:
    `--app-hair: var(--gat-web-hairline)`,
    `--app-soft: var(--gat-web-text-soft)`,
    `--app-akzent-primaer: var(--gat-web-green-deep)`,
    `--app-risiko: var(--gat-web-chart-5)`.
  - Die separate `--web-page-max`-Deklaration ausserhalb des Token-Blocks
    (Researcher: `app.css:163`) entfernen.
  - Selector-scoped `--web-focus-offset: -2px` (auf `.tab-btn`,
    `.sortable`, `.doc-manager-summary`) **umbenennen** zu
    `--gat-web-focus-offset: -2px` (DS-Block respektiert es via
    `outline-offset: var(--gat-web-focus-offset, 2px)`).

  Schritt 2 — `web/css/app.css` Konsumenten:
  - Alle `var(--web-…)` -> `var(--gat-web-…)` per Such-Ersetz.
  - Verifizieren: `grep -nE 'var\(--web-' web/css/app.css` muss 0
    liefern. `grep -nE '^\s*--web-' web/css/app.css` muss 0 liefern.

  Schritt 3 — `web/vendor/dashboard/dashboard.css`:
  - Alle `var(--web-xxx, #hex)` -> `var(--gat-web-xxx, #hex)`. Den
    Hex-Fallback **behalten** (defensive Robustheit, ist heute schon so).
  - Verifizieren: `grep -nE 'var\(--web-' web/vendor/dashboard/dashboard.css`
    muss 0 liefern.

  Schritt 4 — Adapter-Aliase verbleiben als duenne App-Bridge auf
  DS-Tokens (CONTEXT-Decision 4: `.gat-*` = DS, `.app-*` = lokal — App-
  Code darf weiter `var(--app-hair)` lesen, die Bruecke bleibt).

  Schritt 5 — Tests + Commit:
  - `npm run test:js` muss gruen sein (61/61).
  - `npm run test:e2e` muss gruen sein (7/7).
  - Atomarer Commit: `vyz9q: refactor(tokens): migrate --web-* to upstream --gat-web-*`.
  </action>
  <verify>
  <automated>! grep -rE "var\(--web-" web/css web/vendor/dashboard/dashboard.css && ! grep -nE "^\s*--web-" web/css/app.css && npm run test:js && npm run test:e2e</automated>
  </verify>
  <done>
  - Keine `--web-*`-Token-Deklarationen mehr in `web/css/app.css`.
  - Keine `var(--web-*)`-Aufrufe mehr in `web/css/` oder
    `web/vendor/dashboard/dashboard.css`.
  - Adapter-Aliase `--app-hair`/`--app-soft`/`--app-akzent-primaer`/
    `--app-risiko` zeigen jetzt auf `--gat-web-*`.
  - `--gat-web-focus-offset: -2px` als selector-scoped Override an
    `.tab-btn`/`.sortable`/`.doc-manager-summary` erhalten.
  - `npm run test:js` 61/61, `npm run test:e2e` 7/7.
  - Atomarer Commit `vyz9q: refactor(tokens): …` auf Feature-Branch.
  </done>
</task>

<task type="auto">
  <name>Task 2: Phase 2 — Komponenten, Brandbar-Markup, .app-*-Rename</name>
  <files>
  web/index.html, web/css/app.css, web/js/app.js,
  web/js/dashboard-app.js, web/vendor/dashboard/dashboard.css,
  tests/e2e/sparpotenzial.spec.mjs
  </files>
  <action>
  Groesster Single-Commit der Migration. Markup und CSS auf DS-Komponenten
  umstellen, App-spezifische Reste zu `.app-*` umbenennen, lokale Bloecke
  entfernen, die DS jetzt liefert.

  Schritt 1 — Brandbar in `web/index.html` (block-replace, nicht
  zeilenweises Such-Ersetz, weil die Struktur sich aendert — `.gat-header__logo`
  wandert vom `<a>` aufs `<img>`):
  - `<header>`-Block durch das Ziel-Markup aus `<interfaces>` ersetzen
    (Brandbar-Ziel-Markup, **ohne** den HC-Toggle-Button — der kommt in
    Task 4).
  - `class="gat-header web-brandbar"` -> `class="gat-header"`.
  - `<a class="gat-header__logo web-brandbar__brand">` -> `<a class="gat-header__brand">`.
  - `<img class="web-brandbar__logo">` -> `<img class="gat-header__logo">`.
  - `<span class="web-brandbar__wordmark">` -> `<span class="gat-header__wordmark">`.
  - `<nav class="gat-nav web-brandbar__nav">` -> `<nav class="gat-header__nav">`.
  - `<ul class="web-brandbar__nav-list">` -> `<ul class="gat-header__nav-list">`.
  - `<li><span class="web-brandbar__nav-current">VRV-2015-Analyse</span></li>`
    -> `<li><a class="gat-header__nav-current" aria-current="page" href=".">VRV-2015-Analyse</a></li>`.

  Schritt 2 — `web/index.html` Komponenten-Klassen-Renames (24+ Stellen
  Panels, 8 Metric-Cards, 7 Section-Heads, 3 Hero-Stellen, 1 Callout,
  Tabs/Switcher):
  - `class="web-panel"` (auch in `class="web-panel <weitere>"`-Kombinationen,
    z. B. `web-panel dash-chart`) -> `class="gat-panel"`.
  - `web-panel__head` -> `gat-panel__head`.
  - `web-panel__note` -> `gat-panel__note`.
  - `web-panel__body` -> `gat-panel__body`.
  - `web-panel__body--table` -> `gat-panel__body--table`.
  - `metric-card` -> `gat-metric-card` (alle Modifier mitziehen:
    `--ertrag`/`--aufwand`/`--netto`/`--hero`).
  - `stat-num` -> `gat-metric-card__num` (Markup-Stellen innerhalb
    `gat-metric-card`-Wrappern). `stat-label` -> `gat-metric-card__label`.
  - `stat-delta` und `stat-pk` behalten ihren Namen (App-spezifisch,
    bleiben in `app.css`, siehe Schritt 5).
  - `web-section-head` -> `gat-section-head` (7 Stellen).
  - `web-hero`/`web-hero__title`/`web-hero__intro` -> `gat-hero`/`gat-hero__title`/`gat-hero__intro`.
  - Callout: `<div class="callout gat-card gat-card--primary">` (Z. ~605)
    -> `<div class="gat-callout">`. `<strong class="callout-label gat-card__title">`
    -> `<strong>` (DS hat keinen Callout-Label-Modifier; einfaches
    `<strong>` reicht).
  - Tabs: `<div class="tabs ...">` -> `<div class="tabs gat-tabbar ...">`.
    Jede `<button class="tab-btn" data-tab="…">` -> `class="tab-btn gat-tab"`.
    `<div class="tab-panel" data-panel="…">` bleibt unveraendert
    (Funktionsklasse, DS-Animation greift ohnehin).
  - Switcher: `<div class="switcher">` -> `<div class="switcher gat-switcher">`.
    `<span class="switcher-label">` -> `<span class="switcher-label gat-switcher__label">`.

  Schritt 3 — `web/js/dashboard-app.js`:
  - `btn.className = "switch-btn"` (oder aequivalentes Setzen) -> `btn.className = "switch-btn gat-switch-btn"`.
    Funktionsklasse `switch-btn` bleibt, damit `dashboard.js`-Vendor-Code
    weiter den Klick-Handler findet.

  Schritt 4 — `web/js/app.js` Vollbild-Wiring (`verdrahteVollbild()`,
  ~Z. 138-180):
  - `.web-panel:has(.dash-chart)` -> `.gat-panel:has(.dash-chart)`.
  - `.web-panel__head` -> `.gat-panel__head`.
  - `.web-panel__head-row` -> `.gat-panel__head-row`.
  - `.web-panel__fs-btn` -> `.app-panel-fs-btn` (App-eigen, kein
    DS-Pendant fuer den Vollbild-Knopf).
  - `.web-panel`-Closest-Selektor -> `.gat-panel`.

  Schritt 5 — `web/css/app.css` Komponenten-Bloecke entfernen
  (Researcher: ~600 LOC raus, DS uebernimmt):
  - `.web-brandbar*`-Block (Researcher: Z. ~232-306) **ersatzlos
    entfernen** — DS-`gat-header*` liefert.
  - `.web-panel*`-Block (Z. ~397-557) **ersatzlos entfernen** — DS-
    `gat-panel*` liefert.
  - `.web-panel__fs-btn`-Block (Z. ~491-514) **umbenennen** auf
    `.app-panel-fs-btn` (App-spezifischer Vollbild-Knopf, kein DS-Pendant).
  - `.web-panel:fullscreen`-Block (Z. ~522-552) **ersatzlos entfernen**
    — DS-`gat-panel:fullscreen` deckt.
  - `.metric-card*`-Bloecke (Z. ~308-395) **ersatzlos entfernen** — DS-
    `gat-metric-card*` liefert. `.stat-num`/`.stat-label`-Regeln raus
    (Markup nutzt jetzt `.gat-metric-card__num`/`__label`).
  - `.stats`/`.stat`/`.stat-delta`/`.stat-pk`-Regeln **behalten** als
    App-Klassen (App-spezifisches Lagebild-Grid, kein DS-Pendant
    — RESEARCH "Stats-Grid umbenennen verfaelscht die DS-Konvergenz").
    Optional kommentieren mit `/* App-spezifisches Lagebild-Raster,
    kein DS-Pendant — bleibt lokal */`.
  - `.web-callout`/`.callout`-Block (Z. ~574-582) **ersatzlos entfernen**
    — DS-`gat-callout` liefert.
  - `.web-section-head`-Block (Z. ~188-202 Hero ist in einem Block-Cluster)
    und `.web-hero`-Block (Z. ~559-572) **ersatzlos entfernen** — DS deckt.
  - `.gat-headline`-Override (Z. ~207-212): pruefen, ob DS-Default
    `font-weight:800` + Anthrazit-Color identisch zur Override ist
    (Researcher: ja). Override **ersatzlos entfernen**.
  - `.web-panel__head-row` -> `.gat-panel__head-row` umbenennen, falls
    es eigene Regeln gibt (RESEARCH: gibt es, ersatzlos raus, weil DS
    deckt).
  - `@media (prefers-reduced-motion: reduce)`-App-Block (Researcher:
    Z. ~1099-1110) **ersatzlos entfernen** — DS-Block ist identisch.
  - `@media print`-App-Block (Researcher: Z. ~1121-1199): App-spezifische
    Regeln behalten (`.doc-manager`, `.dashboard-leer`, `.dash-controls`,
    `#toast-box`, `.mj-overlay`, `.sankey-bar`, `.mj-actions`, `.footer`
    `display:none`; `.page` `max-width:none`; `#c_sankey` Hoehe);
    DS-ueberdeckte Regeln (`.web-brandbar`, `.web-panel`, `.metric-card`)
    raus.

  Schritt 6 — `.app-*`-Umbenennungen in `web/css/app.css`:
  - `.web-panel__fs-btn` -> `.app-panel-fs-btn` (vollstaendige Regel,
    Selektor + JS-Setter konsistent in Schritt 4).
  - `--web-page-max` (falls noch im File) bereits in Task 1 entfernt;
    `.page`-Selektor liest `var(--gat-web-page-max)`.
  - Adapter-Aliase `.app-hair`/`.app-soft`/`.app-akzent-primaer`/
    `.app-risiko` (sind eigentlich `--app-*`-Tokens, nicht Klassen)
    aus Task 1 bereits korrekt.

  Schritt 7 — `web/vendor/dashboard/dashboard.css` Tab-/Switcher-Block
  entfernen (RESEARCH-Pitfall "dashboard.css-Tab-Regeln ueberdecken
  DS-Defaults"):
  - `.tabs`/`.tab-btn`/`.tab-panel`-Block (Researcher: Z. ~51-79)
    **ersatzlos entfernen** — DS-Default ist 1:1 identisch.
  - `.switcher`/`.switcher-label`/`.switch-btn`-Block (Z. ~82-108)
    **ersatzlos entfernen** — DS-Default 1:1 identisch.
  - Tabellen-/Drill-/MJ-Regeln in `dashboard.css` (Researcher: Rest des
    Files) **behalten** — App-Domain.

  Schritt 8 — Skip-Link:
  - `<a class="gat-skiplink" href="#dashboard-inhalt">Zum Inhalt</a>`
    als erstes Element nach `<body>` einfuegen (vor allen anderen
    Scripts/Markup).
  - Sicherstellen, dass das Sprungziel `#dashboard-inhalt` existiert —
    falls nicht, ein passendes Top-of-content-Element mit dieser ID
    versehen (typischerweise das Tabs-Container-Div).

  Schritt 9 — Test-Selector Update:
  - `tests/e2e/sparpotenzial.spec.mjs:27`:
    `'section.web-panel[data-typ-panel="RA"]'`
    -> `'section.gat-panel[data-typ-panel="RA"]'`.

  Schritt 10 — Tests + Commit:
  - `npm run test:js` muss gruen sein.
  - `npm run test:e2e` muss gruen sein.
  - Grep-Verifikation:
    `grep -rE "\.web-(brandbar|panel|callout|section-head|hero)" web/css web/index.html`
    muss 0 liefern.
    `grep -nE "web-panel" web/js/app.js` muss 0 liefern.
  - Atomarer Commit:
    `vyz9q: refactor(components): switch markup and CSS to upstream .gat-* components`.
  </action>
  <verify>
  <automated>! grep -rE "\.web-(brandbar|panel|callout|section-head|hero)" web/css web/index.html && ! grep -nE "web-panel|web-brandbar|web-callout|web-section-head|web-hero" web/js/app.js web/js/dashboard-app.js && grep -q "section.gat-panel" tests/e2e/sparpotenzial.spec.mjs && npm run test:js && npm run test:e2e</automated>
  </verify>
  <done>
  - Brandbar-Markup in `web/index.html` entspricht dem DS-v2-Schema
    (`.gat-header__brand`, `.gat-header__logo` aufs `<img>`,
    `.gat-header__wordmark`, `.gat-header__nav-list`, `.gat-header__nav-current`).
  - Alle `.web-panel`/`.web-brandbar*`/`.metric-card`/`.web-callout`/
    `.web-section-head`/`.web-hero` in HTML, CSS und JS auf `.gat-*`
    umgestellt; `.web-panel__fs-btn` -> `.app-panel-fs-btn`.
  - Tabs und Switcher tragen Doppel-Klassen (`tab-btn gat-tab`,
    `switch-btn gat-switch-btn`); `dashboard.css`-Tab-/Switcher-Bloecke
    entfernt.
  - Lokale `prefers-reduced-motion`- und ueberlappende `@media print`-
    Regeln in `app.css` entfernt; App-spezifische Print-Regeln behalten.
  - `<a class="gat-skiplink">` als erstes Body-Element vorhanden;
    Sprungziel-ID existiert.
  - `tests/e2e/sparpotenzial.spec.mjs:27` selector aktualisiert.
  - `npm run test:js` und `npm run test:e2e` gruen.
  - Atomarer Commit `vyz9q: refactor(components): …` auf Feature-Branch.
  </done>
</task>

<task type="auto">
  <name>Task 3: Phase 3 — Charts auf gat-charts.js umstellen</name>
  <files>web/js/dashboard-charts.js, web/js/sankey-drill.js</files>
  <action>
  ES-Modul-Import statt lokaler Konstanten. Aus dem `<interfaces>`-Block:
  Import-Surface ist `{ PALETTE, INK as DS_INK, LABEL_SIZE, AXIS_SIZE,
  BAR_MAX_DICHT, BAR_MAX_WEIT, VA_DECAL, tip, legende, grid, planIstLegende }`.
  Wichtigster Gotcha: `INK`-Shape-Mismatch (RESEARCH-Pitfall) — App nutzt
  semantische Rollen, DS nutzt tonale Klassen. Import als `INK as DS_INK`
  und App-Adapter daraus aufbauen.

  Schritt 1 — `web/js/dashboard-charts.js` Top of file:
  - Import-Block hinzufuegen (ganz oben, vor anderen Imports/Konstanten):
    ```
    import {
      PALETTE, INK as DS_INK, LABEL_SIZE, AXIS_SIZE,
      BAR_MAX_DICHT, BAR_MAX_WEIT, VA_DECAL,
      tip, legende, grid, planIstLegende,
    } from "https://grueneat.github.io/design-system/gat-charts.js"
    ```
  - App-Adapter-Schicht direkt unter dem Import:
    ```
    // App-Adapter: DS-INK ist tonal, App nutzt semantische Rollen.
    // Mapping ueber die Chart-Palette.
    const INK = {
      green:  PALETTE[0],
      blue:   PALETTE[2],
      orange: PALETTE[3],
      red:    PALETTE[4],
      soft:   PALETTE[7],
      paper:  "#ffffff",
    }
    const ACHSE_TEXT      = DS_INK.text
    const ACHSE_TEXT_SOFT = DS_INK.soft
    const ACHSE_LINIE     = DS_INK.axis
    const ACHSE_SPLIT     = DS_INK.gridline
    const CHART_FONT      = "Barlow Semi Condensed, sans-serif"
    ```
  - Wichtig: keine `INK`-Doppeldefinition; die App-`INK`-Konstante
    ueberschreibt nichts, weil DS-`INK` jetzt `DS_INK` heisst.

  Schritt 2 — `web/js/dashboard-charts.js` lokale Konstanten ENTFERNEN
  (Researcher-Zeilen sind Richtwerte, aktueller Stand mit `grep -n`
  bestaetigen):
  - `const INK = { green, blue, orange, red, soft, paper }` (~Z. 16-23)
    — durch Adapter ersetzt.
  - `const LABEL_SIZE = 15` (~Z. 39) — kommt aus Import.
  - `const AXIS_SIZE = 14` (~Z. 40) — kommt aus Import.
  - `const BAR_MAX_DICHT = 56` (~Z. 53) — kommt aus Import.
  - `const BAR_MAX_WEIT = 130` (~Z. 54) — kommt aus Import.
  - `const VA_DECAL = { ... }` (~Z. 543-549) — kommt aus Import. Hinweis:
    DS-Wert weicht von App-Wert ab (`dashArrayX:[3,0]`, `dashArrayY:[1,6]`,
    `color:"rgba(255,255,255,0.45)"`); DS-Wert uebernehmen (CONTEXT
    Deferred 3: "Uebernehmen, nicht diskutieren").
  - Lokale `function tip(extra={})` (~Z. 68-82) — kommt aus Import.
    DS-`tip()`-Defaults haben kein `padding:[7,11]` und kein eigenes
    `box-shadow:rgba(31,38,28,.12)`; akzeptierte Drift (RESEARCH:
    "Tooltip-Schatten-Drift", unter 5 %-Snapshot-Schwelle).
  - Lokale `function legende(extra={})` (~Z. 85-96): DS-`legende()` hat
    kein `bottom: 0` als Default — entweder Call-Sites aktualisieren
    (`legende({ bottom: 0 })`) ODER duennen App-Wrapper anlegen:
    ```
    const legende_app = (extra = {}) => legende({ bottom: 0, ...extra })
    ```
    Empfehlung: App-Wrapper direkt unter dem Import-Block anlegen und
    interne Aufrufe auf `legende_app(…)` umstellen — vermeidet, dass alle
    Call-Sites angefasst werden muessen. Verifizieren:
    `grep -n "legende(" web/js/dashboard-charts.js` zeigt alle Stellen.
  - Lokale `function grid(extra={})` (~Z. 60-62): 1:1 identisch zur
    DS-Version — Lokal entfernen, Import nutzen.
  - Lokale `function planIstLegende()` (~Z. 561-576): durch Import-
    Version ersetzt. Aufruferseite pruefen, dass keine App-spezifischen
    Swatch-Anpassungen verloren gehen — Researcher: leichte
    Swatch-Color-Drift, vernachlaessigbar.

  Schritt 3 — `web/js/dashboard-charts.js` BLEIBEND lokal:
  - `CHART_FONT`, `baseText()`, `catAxis()` (mit Ellipse-Formatter),
    `valAxis()` (EUR-Formatter `FMT_MIO_AXIS`), `ELLIPSE_FORMATTER`,
    `FMT_MIO_AXIS`, `FMT_K_LABEL`, `round()` (banker-rounding), `bar()`,
    `trendBalken()`, `MEHRJAHR_PALETTE`.
  - `MEHRJAHR_PALETTE` (~Z. 1438-1449) kann optional als
    `[PALETTE[0], PALETTE[3], ..., "#a7c4a3", "#c9a98c"]` refactored
    werden (weiche Tints bleiben App-eigen). Optional, nicht required —
    falls die App-Tests nicht stoeren, refactoren; sonst belassen.

  Schritt 4 — `web/js/sankey-drill.js`:
  - Import-Block ganz oben:
    ```
    import { PALETTE, INK as DS_INK, LABEL_SIZE }
      from "https://grueneat.github.io/design-system/gat-charts.js"
    ```
  - App-Adapter direkt darunter:
    ```
    const INK = {
      green:  PALETTE[0], blue: PALETTE[2], orange: PALETTE[3],
      red:    PALETTE[4], soft: PALETTE[7], paper: "#ffffff",
    }
    const ACHSE_TEXT  = DS_INK.text
    const ACHSE_LINIE = DS_INK.axis
    const CHART_FONT  = "Barlow Semi Condensed, sans-serif"
    ```
  - Lokale Konstanten entfernen: `INK`, `ACHSE_TEXT`, `ACHSE_LINIE`,
    `LABEL_SIZE`, `CHART_FONT` (alle ueber Import bzw. Adapter).
  - `TOOLTIP`-Konstante in `sankey-drill.js` **behalten** —
    App-spezifische Tooltip-Konfig, nicht durch `tip()` ersetzen
    (RESEARCH: Sankey-Drill nutzt eigene Tooltip-Struktur).

  Schritt 5 — Tests:
  - `npm run test:js`: muss gruen bleiben.
  - `npm run test:e2e`: muss gruen bleiben. ECharts-Diagramme rendern
    visuell aequivalent (Tooltip-Schatten + Decal-Schraffur leicht anders,
    aber unter Snapshot-Schwelle).

  Schritt 6 — Grep-Verifikation:
  - `grep -nE "import.*gat-charts\.js" web/js/dashboard-charts.js
    web/js/sankey-drill.js` muss in BEIDEN Dateien fundig werden.
  - `grep -nE "(LABEL_SIZE|AXIS_SIZE|BAR_MAX_DICHT|BAR_MAX_WEIT|VA_DECAL)\s*=\s*" web/js/dashboard-charts.js web/js/sankey-drill.js`
    muss 0 liefern (Konstanten werden nicht mehr lokal **definiert**).

  Schritt 7 — Commit:
  `vyz9q: refactor(charts): import gat-charts.js, remove local constants`.
  </action>
  <verify>
  <automated>grep -q "from \"https://grueneat.github.io/design-system/gat-charts.js\"" web/js/dashboard-charts.js && grep -q "from \"https://grueneat.github.io/design-system/gat-charts.js\"" web/js/sankey-drill.js && ! grep -nE "^\s*(const|let|var)\s+(LABEL_SIZE|AXIS_SIZE|BAR_MAX_DICHT|BAR_MAX_WEIT|VA_DECAL)\s*=" web/js/dashboard-charts.js web/js/sankey-drill.js && npm run test:js && npm run test:e2e</automated>
  </verify>
  <done>
  - `web/js/dashboard-charts.js` importiert `PALETTE, INK as DS_INK,
    LABEL_SIZE, AXIS_SIZE, BAR_MAX_DICHT, BAR_MAX_WEIT, VA_DECAL, tip,
    legende, grid, planIstLegende` aus
    `https://grueneat.github.io/design-system/gat-charts.js`.
  - App-Adapter-`INK` mappt PALETTE auf semantische Rollen (green/blue/
    orange/red/soft/paper).
  - Lokale Definitionen von `LABEL_SIZE`, `AXIS_SIZE`, `BAR_MAX_DICHT`,
    `BAR_MAX_WEIT`, `VA_DECAL`, `tip()`, `grid()`, `planIstLegende()`
    entfernt.
  - `legende()` aus DS bezogen, ggf. ueber duennen App-Wrapper (`bottom:0`).
  - `web/js/sankey-drill.js` importiert `PALETTE, INK as DS_INK, LABEL_SIZE`
    + App-Adapter; lokale Definitionen entfernt; `TOOLTIP` bleibt App-eigen.
  - App-spezifische Helfer (`CHART_FONT`, `catAxis()`, `valAxis()`,
    Formatter, `round()`, `bar()`, `trendBalken()`, `MEHRJAHR_PALETTE`)
    bleiben lokal.
  - `npm run test:js` und `npm run test:e2e` gruen.
  - Atomarer Commit `vyz9q: refactor(charts): …` auf Feature-Branch.
  </done>
</task>

<task type="auto">
  <name>Task 4: Phase 4 — A11y .gat-mode-hc Toggle-Knopf</name>
  <files>web/index.html, web/css/app.css, web/js/app.js</files>
  <action>
  HC-Toggle in der Brandbar. CONTEXT-Decision 3 fixiert UX:
  Icon + Label "Kontrast", `aria-pressed`, `localStorage`-Key `gat-mode-hc`,
  FOWT-Prevention via `<head>`-Inline-Skript.

  Schritt 1 — FOWT-Prevention in `web/index.html` `<head>`:
  - Inline-`<script>` einfuegen — **vor** allen anderen Scripts und CSS-
    `<link>`-Tags ist OK (greift trotzdem), bevorzugt jedoch direkt nach
    den `<meta>`-Tags und vor dem CSS-`<link>`:
    ```html
    <script>
      // FOWT-Prevention: Body-Klasse vor erstem Paint setzen.
      try {
        if (localStorage.getItem("gat-mode-hc") === "1") {
          document.documentElement.classList.add("gat-mode-hc");
        }
      } catch (e) { /* localStorage gesperrt (Privatmodus) — egal */ }
    </script>
    ```
  - Wichtig: `documentElement.classList.add` statt `document.body`, weil
    `<body>` zum Zeitpunkt des `<head>`-Skripts noch nicht existiert.
    DS-Selektor `.gat-mode-hc body` greift trotzdem (Ancestor-Match).
  - **try/catch ist Pflicht** (RESEARCH-Pitfall: Privatmodus-SecurityError
    bricht sonst den Boot).

  Schritt 2 — HC-Toggle-Knopf in der Brandbar (`web/index.html`):
  - Im `<nav class="gat-header__nav">` aus Task 2 nach der `<ul>` einfuegen:
    ```html
    <button type="button" class="gat-header__a11y-toggle" id="hc-toggle"
            aria-pressed="false" aria-label="Hohen Kontrast einschalten">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"
           fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20V2z"/></svg>
      <span>Kontrast</span>
    </button>
    ```
  - Label-Text immer `Kontrast` (Deutsch — CLAUDE.md UI-Sprache).
  - SVG ist inline (kein Asset-Vendoring, CLAUDE.md "Kein Vendoring").

  Schritt 3 — CSS in `web/css/app.css` (App-spezifisch — DS liefert keinen
  Toggle-Knopf):
  - Einen neuen Block direkt unter den Brandbar-relevanten Regeln einfuegen
    (oder am Ende des Files vor `@media print`):
    ```css
    .gat-header__a11y-toggle {
      display: inline-flex; align-items: center; gap: 0.4rem;
      font: inherit; font-family: var(--gat-font-headline);
      font-size: 1.05rem; font-weight: 600;
      padding: 0.2rem 0.6rem;
      background: transparent;
      border: 1px solid var(--gat-web-hairline);
      border-radius: var(--gat-web-radius-control);
      color: var(--gat-web-green-deep);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    .gat-header__a11y-toggle:hover {
      border-color: var(--gat-web-green);
      background: var(--gat-web-green-tint);
    }
    .gat-header__a11y-toggle[aria-pressed="true"] {
      background: var(--gat-web-green-deep);
      border-color: var(--gat-web-green-deep);
      color: var(--gat-color-weiss);
    }
    .gat-header__a11y-toggle svg { flex: none; }
    /* HC-Modus: Knopf hervorgehoben im Anthrazit/Gelb-Stil */
    .gat-mode-hc .gat-header__a11y-toggle {
      border-color: var(--gat-color-gelb);
      color: var(--gat-color-gelb);
    }
    .gat-mode-hc .gat-header__a11y-toggle[aria-pressed="true"] {
      background: var(--gat-color-gelb);
      color: var(--gat-color-anthrazit);
    }
    ```

  Schritt 4 — JS in `web/js/app.js`:
  - Neue Funktion `verdrahteHcToggle()` definieren:
    ```js
    function verdrahteHcToggle() {
      const btn = document.getElementById("hc-toggle")
      if (!btn) return
      const set = (an) => {
        document.body.classList.toggle("gat-mode-hc", an)
        document.documentElement.classList.toggle("gat-mode-hc", an)
        btn.setAttribute("aria-pressed", an ? "true" : "false")
        btn.setAttribute("aria-label",
          an ? "Hohen Kontrast ausschalten" : "Hohen Kontrast einschalten")
        try {
          localStorage.setItem("gat-mode-hc", an ? "1" : "")
        } catch (e) { /* gesperrt — egal */ }
      }
      let aktiv = false
      try { aktiv = localStorage.getItem("gat-mode-hc") === "1" }
      catch (e) { /* egal */ }
      set(aktiv)
      btn.addEventListener("click", () =>
        set(!document.body.classList.contains("gat-mode-hc")))
    }
    ```
  - Funktion in `init()` neben den anderen `verdrahte*`-Aufrufen aufrufen.
  - Wichtig: try/catch um JEDEN `localStorage`-Zugriff (Privatmodus).

  Schritt 5 — Manueller Smoke-Test (Playwright):
  Einen einmaligen Verifikations-Lauf per `node`-Inline-Skript ODER per
  `npx playwright test --reporter=list` mit einem temporaeren Spec, das:
  - Auf `http://localhost:8080/web/` navigiert.
  - `localStorage.clear()` ausfuehrt.
  - `#hc-toggle` klickt -> erwartet `document.body.classList.contains("gat-mode-hc") === true`.
  - `aria-pressed === "true"`, `localStorage["gat-mode-hc"] === "1"`.
  - Page-Reload -> Body-Klasse bleibt aktiv (`<html>` greift via
    `<head>`-Inline-Skript).
  - Klick erneut -> Klasse weg, `localStorage["gat-mode-hc"] === ""`.

  Dieser Smoke-Test kann in `tests/e2e/` als neuer `hc-toggle.spec.mjs`
  abgelegt werden, damit `npm run test:e2e` ihn auch in Zukunft prueft
  (Aufwand minimal, Mehrwert: HC-Toggle ist getestet).

  Schritt 6 — Tests + Commit:
  - `npm run test:js` muss gruen bleiben.
  - `npm run test:e2e` muss gruen bleiben (inkl. neuer
    `hc-toggle.spec.mjs`, falls angelegt).
  - Atomarer Commit:
    `vyz9q: feat(a11y): add gat-mode-hc toggle button to brandbar`.
  </action>
  <verify>
  <automated>grep -q 'id="hc-toggle"' web/index.html && grep -q 'aria-pressed' web/index.html && grep -q 'gat-mode-hc' web/index.html && grep -q 'verdrahteHcToggle' web/js/app.js && grep -q 'gat-header__a11y-toggle' web/css/app.css && npm run test:js && npm run test:e2e</automated>
  </verify>
  <done>
  - `<head>`-Inline-Skript setzt `<html class="gat-mode-hc">` bei
    `localStorage["gat-mode-hc"] === "1"` mit try/catch.
  - `<button id="hc-toggle" class="gat-header__a11y-toggle"
    aria-pressed="false">` in der Brandbar-Nav (Icon + Label "Kontrast").
  - `.gat-header__a11y-toggle`-Regeln + HC-Mode-Overrides in `app.css`.
  - `verdrahteHcToggle()` in `app.js` togglet `<body>` UND `<html>`-Klasse,
    aktualisiert `aria-pressed` + `aria-label`, persistiert in
    `localStorage` mit try/catch, wird aus `init()` aufgerufen.
  - Optional: `tests/e2e/hc-toggle.spec.mjs` testet
    Toggle/Persistenz/Reload.
  - `npm run test:js` und `npm run test:e2e` gruen.
  - Atomarer Commit `vyz9q: feat(a11y): …` auf Feature-Branch.
  </done>
</task>

<task type="auto">
  <name>Task 5: Phase 5 — Doku (Iteration 19 + LIZENZEN)</name>
  <files>docs/web-design-system.md, web/vendor/LIZENZEN.md</files>
  <action>
  Abschluss-Doku. CONTEXT-Decision 1 (Phase 5): Iteration 19 als
  historisches Closure.

  Schritt 1 — `docs/web-design-system.md`:
  - Ans Ende des Files **Iteration 19** anhaengen. Format wie
    Iteration 17/18 (vorhandene Iterationen kurz anschauen, Stil
    matchen — typischerweise Ueberschrift `## Iteration 19 — <Titel>`,
    Datum, Aufzaehlung mit fett-markierten Haupt-Punkten).
  - Inhalt (Deutsch, kurz):
    - **Tokens.** Lokale `--web-*`-Schicht ausgebaut. Alle 26 Tokens
      sind jetzt `--gat-web-*` aus dem org-weiten DS v2.0. App-eigene
      Adapter-Aliase `--app-hair`, `--app-soft`, `--app-akzent-primaer`,
      `--app-risiko` zeigen auf DS-Tokens.
    - **Komponenten.** `.web-panel`/`.metric-card`/`.web-callout`/
      `.web-section-head`/`.web-hero`/`.web-brandbar*` durch
      `.gat-panel`/`.gat-metric-card`/`.gat-callout`/`.gat-section-head`/
      `.gat-hero`/`.gat-header*` ersetzt. `dashboard.css`-Tab- und
      Switcher-Bloecke entfernt; DS-Defaults greifen ueber
      Doppel-Klassen (`.tab-btn gat-tab`, `.switch-btn gat-switch-btn`).
    - **Charts.** `web/js/dashboard-charts.js` und
      `web/js/sankey-drill.js` importieren Konstanten und Helfer aus
      `https://grueneat.github.io/design-system/gat-charts.js`.
      Lokale `PALETTE`/`INK`/`LABEL_SIZE`/`AXIS_SIZE`/`BAR_MAX_*`/
      `VA_DECAL`/`tip`/`legende`/`grid`/`planIstLegende` entfernt.
      App-Adapter mappt DS-`INK` (tonal) auf App-Rollen (semantisch).
    - **A11y.** `.gat-mode-hc`-Toggle-Knopf in der Brandbar
      ("Kontrast"); FOWT-Prevention im `<head>`; Persistenz in
      `localStorage` (`gat-mode-hc=1`).
    - **Status: Doku historisch.** Dieses Dokument
      (`docs/web-design-system.md`) hat seinen Zweck erfuellt — es war
      die App-interne Begleitung der Iterationen 1-18, in deren Verlauf
      die DS-`--gat-web-*`-Schicht entstand. Ab Iteration 19 leben
      neue Konventionen im DS-Repo (`grueneat/design-system`,
      [v2.0.0](https://github.com/GrueneAT/design-system/releases/tag/v2.0.0)),
      nicht hier.
  - Keine Werkzeug-Attribution in der Doku.

  Schritt 2 — `web/vendor/LIZENZEN.md`:
  - Bestehenden Abschnitt "Design System" suchen (er existiert bereits
    fuer `design-system.css`). Einen kurzen Eintrag fuer `gat-charts.js`
    ergaenzen — gleicher Anbieter, gleiche Lizenz (CC BY 4.0 ist die
    Lizenz des DS-Repos).
  - Beispiel-Eintrag (Stil der bestehenden Eintraege matchen):
    ```
    - **gat-charts.js** (ECharts-Hilfsfunktionen + Chart-Konstanten,
      CDN: https://grueneat.github.io/design-system/gat-charts.js)
      — kein Vendoring; per CDN-Import in `web/js/dashboard-charts.js`
      und `web/js/sankey-drill.js`. Lizenz: identisch zum DS
      (siehe https://github.com/GrueneAT/design-system).
    ```
  - Keine Werkzeug-Attribution.

  Schritt 3 — Verifikationen:
  - `grep -F "Iteration 19" docs/web-design-system.md` muss treffen.
  - `grep -F "gat-charts.js" web/vendor/LIZENZEN.md` muss treffen.
  - `grep -rE "claude|Generated with|Co-Authored-By" docs web/vendor/LIZENZEN.md`
    muss 0 liefern (Werkzeug-Attribution-Sanity-Check).

  Schritt 4 — Tests + Commit:
  - `npm run test:js` und `npm run test:e2e` muessen gruen bleiben (Doku
    sollte sie nicht beeinflussen — Sanity-Check).
  - Atomarer Commit:
    `vyz9q: docs: iteration 19 — migration closure + LIZENZEN note for gat-charts.js`.
  </action>
  <verify>
  <automated>grep -F "Iteration 19" docs/web-design-system.md && grep -F "gat-charts.js" web/vendor/LIZENZEN.md && ! grep -rE "claude|Generated with|Co-Authored-By" docs web/vendor/LIZENZEN.md && npm run test:js && npm run test:e2e</automated>
  </verify>
  <done>
  - `docs/web-design-system.md` enthaelt einen Iteration-19-Abschnitt
    mit Migrations-Zusammenfassung und Hinweis "Dokument ab hier
    historisch".
  - `web/vendor/LIZENZEN.md` listet `gat-charts.js` als CDN-Konsumat.
  - Keine Werkzeug-Attribution in den geaenderten Dateien.
  - `npm run test:js` und `npm run test:e2e` gruen.
  - Atomarer Commit `vyz9q: docs: iteration 19 …` auf Feature-Branch.
  </done>
</task>

<task type="auto">
  <name>Task 6: After-Snapshots + Diff-Audit + Acceptance-Sweep</name>
  <files>
  .issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/screenshots/after/ (Bilder),
  .issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/screenshots/diff-report.md
  </files>
  <action>
  After-Snapshots ziehen, pixelweise mit Baseline vergleichen, einen
  one-page Bericht schreiben, finalen Acceptance-Sweep durchfuehren.

  Schritt 1 — After-Snapshots erzeugen:
  - Dieselbe Spec wie in Task 0 nutzen — sie liegt in
    `.issues/vyz9q-…/screenshots/snapshot.spec.mjs`.
  - Ausfuehren mit `SNAPSHOT_DIR=after`:
    ```
    SNAPSHOT_DIR=.issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/screenshots/after \
      npx playwright test .issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/screenshots/snapshot.spec.mjs \
      --config=playwright.config.mjs
    ```
  - Erwartet: 8 `.png` in `screenshots/after/`, exakt gleiche Namen wie
    in `baseline/`.

  Schritt 2 — Pixel-Diff:
  - Python-Skript inline (PIL aus stdlib-image oder Pillow):
    Fuer jede Datei in `baseline/` die gleichnamige Datei in `after/`
    pixelweise vergleichen, Diff-% (Anteil unterschiedlicher Pixel)
    berechnen.
  - Beispiel-Skript (Pillow benoetigt — falls nicht verfuegbar, alternativ
    `pixelmatch-js` oder `compare` aus ImageMagick):
    ```python
    from pathlib import Path
    from PIL import Image, ImageChops
    base = Path(".issues/vyz9q-.../screenshots/baseline")
    after = Path(".issues/vyz9q-.../screenshots/after")
    for b in sorted(base.glob("*.png")):
        a = after / b.name
        if not a.exists():
            print(f"MISSING in after/: {b.name}"); continue
        im_b = Image.open(b).convert("RGB")
        im_a = Image.open(a).convert("RGB")
        if im_b.size != im_a.size:
            print(f"{b.name}: SIZE MISMATCH {im_b.size} vs {im_a.size}"); continue
        diff = ImageChops.difference(im_b, im_a)
        total = im_b.size[0] * im_b.size[1]
        nonzero = sum(1 for px in diff.getdata() if any(px))
        pct = 100 * nonzero / total
        print(f"{b.name}: {pct:.2f}% diff")
    ```
  - Output in `screenshots/diff-report.md` festhalten.

  Schritt 3 — `screenshots/diff-report.md` schreiben:
  - Tabelle: Datei | Diff-% | Bewertung (OK / REVIEW / BAD).
  - Schwellen (CONTEXT-Decision 2):
    - Erlaubt: <5 % in DS-bewussten Stellen (Brandbar, Komponenten).
    - REVIEW: 5-15 % — manuell sichten, Begruendung notieren.
    - BAD: >15 % oder erkennbarer Layout-Bruch / abgeschnittener Text /
      gebrochener Chart — muss vor Issue-Close behoben werden
      (Fix-Commit + Re-run).
  - Falls ein BAD-Befund auftritt: zusaetzliche Fix-Tasks anlegen,
    in einem weiteren Commit beheben, after-Snapshots erneut ziehen,
    Diff-Bericht aktualisieren. Erst dann zum naechsten Schritt.
  - Wenn alles OK/REVIEW-akzeptabel: kurze Schlussbemerkung im
    Diff-Bericht ("Migration visuell konvergent zur Baseline, keine
    Layout-Brueche").

  Schritt 4 — Acceptance-Sweep (jede Grep-Assertion aus ISSUE.md
  Akzeptanzkriterien):
  - `! grep -nE "^\s*--web-" web/css/app.css`  (oder nur explizit
    verbleibende App-Tokens — die App-Tokens heissen `--app-*`).
  - `! grep -rE "\.web-(brandbar|panel|callout|section-head|hero)" web/css web/index.html`.
  - `grep -nE "import.*gat-charts\.js" web/js/dashboard-charts.js
    web/js/sankey-drill.js` muss BEIDE Treffer haben.
  - `grep -nE "id=\"hc-toggle\"" web/index.html` muss treffen.
  - `npm run test:js` muss 61/61 sein.
  - `npm run test:e2e` muss 7/7 sein (ggf. 8/8 wenn `hc-toggle.spec.mjs`
    angelegt wurde).
  - `grep -nE "design-system\.css" web/index.html` muss die unveraenderte
    Konsumenten-URL zeigen
    (`https://grueneat.github.io/design-system/design-system.css`).
  - `git diff HEAD~6 -- web/vendor/dashboard/dashboard.js` muss leer
    sein (Vendor-JS tabu).
  - `! grep -rE "claude|Generated with|Co-Authored-By" web docs tests
    .issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs`.
  - `grep -F "Iteration 19" docs/web-design-system.md` muss treffen.
  - Vendoring-Check: `gat-charts.js` darf NICHT als Datei in `web/`
    existieren. `find web -name "gat-charts.js"` muss leer sein.

  Schritt 5 — Issue-Status:
  - `issue-cli check plan` einmal ausfuehren, Output pruefen.
  - Nach Pass die Issue-Status-Updates ausfuehren (sofern noch nicht
    erfolgt): `issue-cli store update-status vyz9q-… in_progress`
    (falls noch open), dann am Ende `issue-cli store update-status
    vyz9q-… done`.

  Schritt 6 — Atomarer Commit:
  `vyz9q: chore(release): after-snapshots and migration audit`.
  Enthaelt `.issues/vyz9q-…/screenshots/after/*.png` und
  `.issues/vyz9q-…/screenshots/diff-report.md`. Keine Werkzeug-Attribution.
  </action>
  <verify>
  <automated>ls -1 .issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/screenshots/after/*.png | wc -l | grep -q "^8$" && test -f .issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs/screenshots/diff-report.md && ! grep -nE "^\s*--web-" web/css/app.css && ! grep -rE "\.web-(brandbar|panel|callout|section-head|hero)" web/css web/index.html && grep -nE "import.*gat-charts\.js" web/js/dashboard-charts.js && grep -nE "import.*gat-charts\.js" web/js/sankey-drill.js && grep -q 'id="hc-toggle"' web/index.html && ! find web -name "gat-charts.js" | grep -q . && ! grep -rE "claude|Generated with|Co-Authored-By" web docs && npm run test:js && npm run test:e2e</automated>
  </verify>
  <done>
  - 8 After-Screenshots in `.issues/vyz9q-…/screenshots/after/`.
  - `screenshots/diff-report.md` enthaelt eine Tabelle (Datei | Diff-% |
    Bewertung) und eine Schlussbemerkung.
  - Kein Diff-Eintrag mit Bewertung BAD; alle Stellen in den Schwellen
    von CONTEXT-Decision 2 (oder vorab behoben).
  - Alle Acceptance-Greps aus ISSUE.md pass.
  - `issue-cli check plan` reportet ohne Fehler.
  - Atomarer Commit `vyz9q: chore(release): …` auf Feature-Branch.
  </done>
</task>

</tasks>

<verification>
Nach allen Tasks final laufen:
- `npm run test:js` — 61/61 muss gruen sein.
- `npm run test:e2e` — 7/7 (oder 8/8 mit `hc-toggle.spec.mjs`) gruen.
- `! grep -nE "^\s*--web-" web/css/app.css` — keine lokalen `--web-*`-
  Tokens mehr.
- `! grep -rE "var\(--web-" web/css web/vendor/dashboard/dashboard.css`.
- `! grep -rE "\.web-(brandbar|panel|callout|section-head|hero)" web/css web/index.html`.
- `grep -nE "import.*gat-charts\.js" web/js/dashboard-charts.js web/js/sankey-drill.js`
  muss beide treffen.
- `grep -q 'id="hc-toggle"' web/index.html` und
  `grep -q "verdrahteHcToggle" web/js/app.js`.
- `grep -F "Iteration 19" docs/web-design-system.md`.
- `grep -F "gat-charts.js" web/vendor/LIZENZEN.md`.
- `! find web -name "gat-charts.js"` (kein Vendoring).
- `! grep -rE "claude|Generated with|Co-Authored-By" web docs tests
   .issues/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs`.
- `git log issue/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs
   --oneline | head -20` zeigt sechs `vyz9q:`-Commits (Task 0-5) + den
   Audit-Commit (Task 6), insgesamt 7 atomare Commits in genau dieser
   Reihenfolge.
- `git diff HEAD~7 -- web/vendor/dashboard/dashboard.js` muss leer sein
  (Vendor-JS unangetastet).
- `screenshots/diff-report.md` ohne BAD-Eintrag.
- `issue-cli check plan` pass.
</verification>

<success_criteria>
Mapping 1:1 zu ISSUE.md "Akzeptanzkriterien":

- [x] `grep -E "^\s*--web-" web/css/app.css` liefert 0 — Task 1.
- [x] `grep -rE "\.web-(brandbar|panel|callout|section-head|hero)" web/css web/index.html`
      liefert 0 — Task 2.
- [x] `import.*gat-charts\.js` in `dashboard-charts.js` und
      `sankey-drill.js` vorhanden; lokale Chart-Konstanten entfernt
      — Task 3.
- [x] `.gat-mode-hc`-Toggle in der Brandbar funktioniert (Klick wechselt
      Body-Klasse + localStorage) — Task 4.
- [x] Tests gruen: `npm run test:js` 61/61, `npm run test:e2e` 7/7
      — verifiziert nach jeder Task.
- [x] Visuelle Regression: Playwright-Screenshots vor/nach, <5 %
      Pixel-Diff in DS-bewussten Stellen, keine Layout-Brueche
      — Task 0 + Task 6.
- [x] `web/index.html`-Verweis auf
      `grueneat.github.io/design-system/design-system.css` unveraendert
      (Konsumenten-URL stabil) — durchgehend nicht angefasst.
- [x] `web/vendor/dashboard/dashboard.js` unangetastet (Vendor-Code) —
      durch CONTEXT/ISSUE-Constraints jeder Task.
- [x] Keine Werkzeug-Attribution in Commits/Code/Doku — Final-Sweep
      Task 6 + Pruefung in Task 5.
- [x] Kein neues Vendoring — `gat-charts.js` per CDN, nicht ins Repo
      kopiert — Task 3 + Verifikations-Grep Task 6.
- [x] `docs/web-design-system.md` hat Iteration-19-Abschnitt — Task 5.
</success_criteria>
