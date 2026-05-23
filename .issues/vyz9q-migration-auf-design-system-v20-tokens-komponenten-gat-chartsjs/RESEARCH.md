# Research: Migration auf design-system v2.0 (Tokens, Komponenten, gat-charts.js)

**Researched:** 2026-05-23
**Issue:** vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs
**Confidence:** HIGH (Codebase + DS-Source + MIGRATION.md alle direkt gelesen)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**1. Migrations-Reihenfolge: 5 Phasen.** Jede Phase ein eigener Commit auf
der Feature-Branch, jeweils mit grüner Test-Suite und visueller Stichprobe
am Ende der Phase. Snapshots nur Baseline (vor Phase 1) und Compare (nach
Phase 5) — nicht zwischendurch.

- **Phase 1 — Tokens.** `web/css/app.css`: lokale `--web-*`-Schicht ausbauen.
  Jeder Token, dessen Wert im DS unter `--gat-web-*` exakt vorhanden ist,
  wird ausgetauscht. Werte, die im DS nicht 1:1 vorkommen, in `--app-*`-
  Namespace verschoben (kein `--web-*` mehr).
- **Phase 2 — Komponenten.** Markup und CSS umstellen: `.web-panel` → `.gat-
  panel`, `.metric-card` → `.gat-metric-card`, `.web-callout` →
  `.gat-callout`, `.web-section-head` → `.gat-section-head`, `.web-hero` →
  `.gat-hero`. `.web-brandbar*`-Overrides entfernen — DS v2.0 `.gat-header`
  ist jetzt selbst weiße Brandbar. Verbleibende lokal-spezifische `.web-*`-
  Klassen (z. B. App-spezifische Layouts) zu `.app-*` umbenennen.
- **Phase 3 — Charts.** `gat-charts.js` per CDN-Import in
  `web/js/dashboard-charts.js` und `web/js/sankey-drill.js` einziehen.
  Lokale Konstanten (`PALETTE`, `INK`, `LABEL_SIZE`, `AXIS_SIZE`,
  `BAR_MAX_DICHT`, `BAR_MAX_WEIT`, `VA_DECAL`, Helfer `tip`/`legende`/
  `grid`/`planIstLegende`) ausbauen. `dashboard.js` (vendor) bleibt tabu.
- **Phase 4 — A11y `.gat-mode-hc`-Toggle.** UI-Knopf in der Brandbar,
  rechts neben der Nav-Liste. Icon + Label „Kontrast",
  `<button class="gat-header__a11y-toggle">`. ARIA
  `aria-pressed="true|false"`. localStorage-Key `gat-mode-hc` (`"1"` /`""`).
  Initial-State aus localStorage; Klick toggelt `<body>`-Klasse `gat-mode-hc`
  und `localStorage`. Keine JS-Abhängigkeit aus dem DS — App implementiert
  den Knopf, DS liefert nur Variant + Komponenten-Overrides.
- **Phase 5 — Doku.** `docs/web-design-system.md` bekommt Iteration 19:
  Abschluss-Eintrag mit Migrations-Zusammenfassung, Hinweis dass das
  Dokument ab hier historisch ist, neue Konventionen leben im DS-Repo.

**2. Visuelle Regression: Pre-Baseline + Final-Compare.**
Playwright/Chromium-Screenshots aller 7 Tabs + Landing bei 1440px
(Fixture-PDF `VA-2026-Auflage.pdf`), Baseline vor Phase 1, Compare nach
Phase 5. Pixel-Diff via Playwright. Erlaubt: kleine Pixel-Drift in
DS-bewussten Stellen (Brandbar, Komponenten — bis ~5 %). Nicht erlaubt:
Layout-Brüche, abgeschnittene Texte, gebrochene Charts. Keine
Zwischen-Phasen-Snapshots.

**3. `.gat-mode-hc`-Toggle UX.**
- Position: in `<nav class="gat-nav">` der Brandbar, rechts in der Liste
  als letzter Eintrag (oder eigenes `<button>` neben der `<ul>`).
- Form: Icon + Label „Kontrast" (deutsch).
- Icon: schlichtes SVG (Halbmond/Sonne oder Kontrast-Symbol — Researcher
  entscheidet, kein Logo-Vendoring nötig, Icon ist trivial inline).
- ARIA: `aria-pressed="true|false"`, dynamisch.
- localStorage-Key: `gat-mode-hc` (`"1"` aktiv, leer/`null` inaktiv).
- Initialisierung: `<head>`-Inline-Skript liest localStorage und setzt
  `<body class="gat-mode-hc">` **vor** dem ersten Render — verhindert FOWT.

**4. Verbleibende `.web-*`-Klassen → `.app-*`.** Klare
Namespace-Trennung: `.gat-*` = DS, `.app-*` = lokal. Wenn ein
Klassennamen-Wechsel viele Markup-Stellen anfasst, in Phase 2 mitziehen.

### Claude's Discretion

- **Wert-Drift zwischen lokalen `--web-*` und upstream `--gat-web-*`:**
  Researcher vergleicht Hex-Werte. Bei Drift: **App-Wert ans DS angleichen**
  — der DS-Wert ist die neue Quelle. Wenn ein bevorzugter App-Wert
  sinnvoll wäre, Folge-Issue im DS-Repo und vorerst App-Wert mit Kommentar
  belassen.
- **CSS-Cleanup-Tiefe.** `web/css/app.css` ist 1199 Zeilen. Wie viel kann
  weg, wenn die DS-Komponenten alles abdecken? Researcher schätzt, Planner
  schneidet Tasks.
- **Vendor-CSS-Touch.** `web/vendor/dashboard/dashboard.css` enthält
  visuelle Überschreibungen für Tabs/Tabellen/Drill. Wenn DS-Defaults
  reichen, können viele Regeln dort weg. Aber: vendorisiertes CSS —
  prüfen, ob das Repo ein Update-Pattern hat.
- **Folder-Tab-Optik im DS?** DS v2 liefert `.gat-tab`/`.gat-tabbar`. Ob
  die heute angepasste Folder-Tab-Optik (grüne Unterkante, Inset-Schatten
  beim aktiven Reiter) Default ist oder lokal erhalten bleiben muss —
  Researcher prüft im DS-CSS.

### Deferred Ideas (OUT OF SCOPE)

- **Iter-19-Naming-Sweep.** Klassen-Refactor über den unbedingt nötigen
  Umfang hinaus (z. B. `.is-active` → `.gat-is-active`). Funktionsklassen
  bleiben.
- **Komplettes Vendor-CSS-Refactor.** Nur durch Migration zwingend
  berührte Stellen.
- **Visueller Redesign-Sweep.** Wenn DS v2 etwas anders aussieht als die
  App heute, wird das übernommen, nicht diskutiert.
</user_constraints>

## Summary

Die Migration ist eine **enge 1:1-Konvergenz**: 25 von 26 lokalen `--web-*`-
Tokens haben exakt den gleichen Hex-Wert im neuen `--gat-web-*`-Layer des
DS — die App und das DS sind faktisch synchron, weil DS v2 die lokale
Web-Schicht der App als Vorlage genommen hat. Nur **ein** Token weicht ab
(`--web-text-mute` AA-Wert ist identisch — kein Drift), und alle Komponenten-
Klassen (`.web-panel`, `.metric-card`, `.web-callout`, `.web-section-head`,
`.web-hero`) sind 1:1 als `.gat-panel`/`.gat-metric-card`/`.gat-callout`/
`.gat-section-head`/`.gat-hero` mit denselben Sub-Elementen, Akzent-Modifiern
und CSS-Werten reproduziert. Ähnlich für `.gat-tab`/`.gat-tabbar` und
`.gat-switcher`/`.gat-switch-btn` — DS-Default sieht **identisch** zur
heutigen `dashboard.css`-Tableiste aus (Inset-Schatten, grüne Unterkante,
gleiche Border-Radius, gleiche Hover-Logik). Lokal-spezifisch bleiben nur
App-Domain-Klassen (Dropzone, Dokumentliste, Sankey-Drill-Leiste, Stats-
Grid, Toast, MJ-Overlay, Suchtabelle, Footer) → `.app-*`-Namespace.

`gat-charts.js` exportiert exakt die Namen, die `dashboard-charts.js`
heute lokal trägt (`PALETTE`/`INK`/`LABEL_SIZE`/`AXIS_SIZE`/`BAR_MAX_*`/
`VA_DECAL` + `tip`/`legende`/`grid`/`planIstLegende`). **Achtung:** die
Form von `INK` weicht ab — DS-`INK` ist neutral-typisiert
(`text`/`soft`/`mute`/`hairline`/`gridline`/`axis`/`green`/`clay`/`slate`),
lokal ist `INK` semantisch
(`green`/`blue`/`orange`/`red`/`soft`/`paper`). Die App benutzt
`INK.green/.blue/.orange/.red/.soft/.paper` quer durch die ganze Datei →
**ein dünner App-Adapter** mappt DS-`INK` + `PALETTE` auf die lokalen
Rollennamen, lokale Konstanten gehen weg. Auch `VA_DECAL` weicht in den
`dashArrayX`/`dashArrayY`/`color`-Werten ab (DS hat eigene Werte) — die
App muss entscheiden, ob sie den DS-Wert übernimmt (Empfehlung: ja, kein
sichtbares Visualisierungs-Regression-Risiko bei diesem Schraffur-Muster).

Der `.gat-header` (weiße Brandbar) ist **nicht** sofort markup-kompatibel:
die App liegt heute auf `.web-brandbar*`-Klassen, das DS-v2-Markup heißt
`.gat-header__brand`/`__logo`/`__wordmark`/`__nav-list`/`__nav-current`.
Phase 2 muss das HTML in `index.html` umstellen — die DS-Klassen liefern
optisch das, was die App heute mit lokalen Overrides nachbaut (gleiche
Logo-Höhe 56px, gleiche Wordmark-Typografie, gleiche `gruene-logo.svg`-
CDN-URL).

**Primary recommendation:** **Volles 1:1-Angleichen ohne Wert-Folge-Issue
im DS** — Drift ist faktisch null (alle Hex-Werte identisch, nur `INK`-
Mapping und `VA_DECAL`-Werte abweichend, beides keine Hex-Token-Brüche).
Phase 1+2 sind reine Such-Ersetz-Operationen. Phase 3 ist ein
ES-Modul-Import plus dünner App-Adapter. Phase 4 ist 15 Zeilen JS in
`app.js` + 12 Zeilen HTML in `index.html` + 5 Zeilen Inline-Boot in
`<head>`. Phase 5 ist ein Doku-Eintrag.

## Codebase Analysis

### Relevant Code

| File | Purpose | LOC | Relevance |
|------|---------|-----|-----------|
| `web/css/app.css` | Lokale Web-Schicht (Tokens), Brandbar-Overrides, Komponenten (`.metric-card`, `.web-panel`, `.web-callout`, `.web-section-head`, `.web-hero`), App-Bedienelemente (Dropzone/Doc-Manager/Toast/MJ) | 1199 | **Kern der Migration** |
| `web/index.html` | HTML-Struktur, DS-CSS-`<link>`, Brandbar-Markup, alle Tab-Panels mit `.web-panel`/`.metric-card`-Verwendungen, `.web-section-head`-Blöcke, `.callout` | 756 | **Markup-Umstellung Phase 2** |
| `web/css/` | (nur `app.css`) | — | komplett |
| `web/vendor/dashboard/dashboard.css` | Visuelle Regeln für `.tabs`/`.tab-btn`/`.switcher`/`.switch-btn`/`.dtable`/`.crumbs`/`.drill-row`/`.mj-overlay` — alles liest direkt `--web-*` mit Fallback-Hex | 267 | Vendor, aber liest `--web-*` → muss in Phase 1 mitziehen (oder Fallback-Hex bleiben) |
| `web/vendor/dashboard/dashboard.js` | **TABU**. Event-Listener auf `.tab-btn`/`.tab-panel`/`.switch-btn`/`.tabs`/`.switcher` + `.is-active`-Toggle | 866 | Funktionsklassen-Vertrag |
| `web/js/app.js` | Init, Upload-Verdrahtung, **Vollbild-Logik via `.web-panel:has(.dash-chart)` + `.web-panel__head` + `.web-panel__fs-btn` + `.web-panel__head-row`** | 604 | Phase 2: ContainerSelektor-Umbenennung von `.web-panel*` zu `.gat-panel*`; Phase 4: HC-Toggle-Wiring |
| `web/js/dashboard-app.js` | Baut Dashboard, generiert Doc-Switcher mit `btn.className = "switch-btn"` | 101 | Phase 2: keine Änderung; Phase 4: kein Bezug |
| `web/js/dashboard-charts.js` | Lokale Chart-Konstanten + 35+ Chart-Builder | 1511 | **Phase 3 Hauptziel** |
| `web/js/sankey-drill.js` | Sankey-Drill-Builder, lokal `INK`/`TOOLTIP`/`LABEL_SIZE`/`ACHSE_*` | 314 | **Phase 3 zweites Ziel** |
| `tests/e2e/dashboard.spec.mjs` | `.tab-btn[data-tab=…]`, `.tab-panel[data-panel=…]`, `is-active` — unverändert | 70 | Kein Touch nötig |
| `tests/e2e/sparpotenzial.spec.mjs` | Selector `'section.web-panel[data-typ-panel="RA"]'` | — | **Phase 2: Test-Update auf `section.gat-panel`** |
| `tests/e2e/helpers.mjs` | Fixture `documents/VA-2026-Auflage.pdf` | 40 | Snapshot-Tooling baut darauf auf |
| `tests/js/run.mjs` | Node-Unit-Tests | — | Kein DS/CSS-Bezug |
| `docs/web-design-system.md` | 18-Iterationen-Log | 894 | **Phase 5: Iteration 19 anhängen** |
| `web/vendor/LIZENZEN.md` | DS bereits eingetragen | 31 | **Phase 5: `gat-charts.js` ergänzen** |
| `documents/VA-2026-Auflage.pdf` | Test-Fixture-PDF | — | Für Baseline-/After-Snapshots |

### Interfaces

<interfaces>
// ============================================================
// === DS v2.0 — was zur Verfügung steht =====================
// ============================================================

// From upstream design-system.css (Tailwind-v4-Build, Konsumenten-Aliases):
// Web-Token-Schicht (26 Tokens):
--gat-web-bg: #f3f5f0;
--gat-web-surface: #ffffff;
--gat-web-surface-sunk: #f7f9f4;
--gat-web-hairline: #e1e4db;
--gat-web-text: #23271f;
--gat-web-text-soft: #5e6358;
--gat-web-text-mute: #6b6f63;
--gat-web-clay-text: #9c5a38;
--gat-web-green-deep: #2c6e40;
--gat-web-green: #4a8a52;
--gat-web-green-tint: #e7efe3;
--gat-web-yellow: #ecd64a;
--gat-web-chart-1: #3f7d4f;   // green
--gat-web-chart-2: #6ba368;   // leaf
--gat-web-chart-3: #4f93a0;   // teal
--gat-web-chart-4: #c9a24b;   // gold
--gat-web-chart-5: #b9744f;   // clay
--gat-web-chart-6: #9c5b7d;   // plum
--gat-web-chart-7: #5d6b8a;   // slate
--gat-web-chart-8: #8a8f7d;   // sage
--gat-web-shadow: 0 1px 2px rgba(31,38,28,.05), 0 4px 14px rgba(31,38,28,.05);
--gat-web-page-max: min(2040px, 94vw);
--gat-web-radius-control: 6px;
--gat-web-radius-card: 10px;
--gat-web-focus-ring: 0 0 0 3px color-mix(in srgb, var(--gat-web-green) 38%, transparent);
--gat-web-focus-offset: 2px;
// Plus Marken-Tokens (--gat-color-*, --gat-text-*, --gat-space-*, --gat-radius-*, --gat-font-*, --gat-leading-*)

// DS v2.0 Komponenten-Klassen (alle relevant für diese Migration):
.gat-header { background:var(--gat-web-surface); border-bottom:3px solid var(--gat-web-green); box-shadow:0 1px 3px rgba(31,38,28,.06); }
.gat-header__inner { /* flex space-between, max-width:var(--gat-web-page-max), padding-inline:clamp(1rem,4vw,2.5rem), padding-block:0.85rem */ }
.gat-header__brand { display:inline-flex; align-items:center; gap:0.85rem; text-decoration:none; }
.gat-header__logo { height:56px; width:auto; display:block; }
.gat-header__wordmark { font-family:var(--gat-font-headline); font-weight:700; font-size:1.5rem; line-height:1; color:var(--gat-web-text); letter-spacing:.01em; }
.gat-header__nav-list { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; align-items:center; gap:1.25rem; }
.gat-header__nav-list a { font-family:var(--gat-font-headline); font-weight:600; font-size:1.05rem; color:var(--gat-web-green-deep); text-decoration:none; }
.gat-header__nav-current { border-bottom:2px solid var(--gat-web-green); padding-bottom:2px; }
// (@media max-width:30rem: logo height 46px, wordmark 1.25rem)
.gat-header--dunkel { /* opt-in, NICHT genutzt von dieser App */ }

.gat-panel { display:block; background:var(--gat-web-surface); border:1px solid var(--gat-web-hairline); border-radius:var(--gat-web-radius-card); box-shadow:var(--gat-web-shadow); margin:var(--gat-space-4) 0; overflow:hidden; }
.gat-panel__head { padding:var(--gat-space-3) var(--gat-space-3) var(--gat-space-2); border-bottom:1px solid var(--gat-web-hairline); }
.gat-panel__head h3 { margin:0; }
.gat-panel__note { margin:var(--gat-space-1) 0 0; font-size:var(--gat-text-small); color:var(--gat-web-text-soft); max-width:70rem; }
.gat-panel__head-row { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--gat-space-3); }
.gat-panel__head-row > h3 { flex:1 1 auto; }
.gat-panel__body { padding:var(--gat-space-3); }
.gat-panel__body--table { padding:0; }
.gat-panel__body > :first-child { margin-top:0; }
.gat-panel__body > :last-child  { margin-bottom:0; }
.gat-panel:fullscreen { /* margin:0, border:none, border-radius:0, box-shadow:none, background:var(--gat-web-surface), display:flex, flex-direction:column, overflow:auto */ }

.gat-metric-card { position:relative; background:var(--gat-web-surface); border:1px solid var(--gat-web-hairline); border-radius:var(--gat-web-radius-card); box-shadow:var(--gat-web-shadow); padding:var(--gat-space-3); overflow:hidden; }
.gat-metric-card::before { content:""; position:absolute; inset:0 0 auto 0; height:3px; background:var(--gat-metric-accent, var(--gat-web-green)); }
.gat-metric-card--ertrag  { --gat-metric-accent: var(--gat-web-chart-1); }   // == #3f7d4f
.gat-metric-card--aufwand { --gat-metric-accent: var(--gat-web-chart-5); }   // == #b9744f
.gat-metric-card--netto   { --gat-metric-accent: var(--gat-web-chart-7); }   // == #5d6b8a
.gat-metric-card--hero    { background:var(--gat-web-green-tint); --gat-metric-accent:var(--gat-web-green-deep); }
.gat-metric-card__num { font-size:var(--gat-text-h2); font-weight:900; font-variant-numeric:tabular-nums; color:var(--gat-web-text); }
.gat-metric-card__label { font-size:var(--gat-text-small); letter-spacing:.07em; text-transform:uppercase; color:var(--gat-web-text-soft); }

.gat-callout { background:var(--gat-web-green-tint); border-left:4px solid var(--gat-web-green-deep); border-radius:0 var(--gat-web-radius-card) var(--gat-web-radius-card) 0; padding:var(--gat-space-3) var(--gat-space-4); margin:var(--gat-space-3) 0; max-width:70rem; color:var(--gat-web-text); }
.gat-section-head { margin-bottom:var(--gat-space-4); }
.gat-section-head h2 { margin-bottom:var(--gat-space-2); }
.gat-section-head p { margin:0; max-width:70rem; color:var(--gat-web-text-soft); }
.gat-hero { margin:var(--gat-space-5) 0; }
.gat-hero__title { margin:0; }
.gat-hero__intro { margin:var(--gat-space-2) 0 0; font-size:var(--gat-text-subline); line-height:var(--gat-leading-copy); max-width:70rem; color:var(--gat-web-text-soft); }

.gat-tag { display:inline-flex; align-items:center; gap:.35em; padding:.15em .6em; border-radius:999px; font-family:var(--gat-font-copy); font-weight:600; font-size:.85rem; line-height:1.4; letter-spacing:.02em; }
.gat-tag--neutral { background:var(--gat-web-surface-sunk); color:var(--gat-web-text-soft); }
.gat-tag--info    { background:var(--gat-web-green-tint); color:var(--gat-web-green-deep); }
.gat-tag--pflicht { background:color-mix(in srgb,var(--gat-web-green-deep) 14%,white); color:var(--gat-web-green-deep); }
.gat-tag--risiko  { background:color-mix(in srgb,var(--gat-web-clay-text) 14%,white); color:var(--gat-web-clay-text); }

.gat-skiplink { position:fixed; top:-200%; left:0; z-index:999; background:var(--gat-web-green-deep); color:var(--gat-color-weiss); padding:var(--gat-space-2) var(--gat-space-3); text-decoration:none; font-family:var(--gat-font-copy); font-weight:700; border-radius:0 0 var(--gat-web-radius-control) 0; transition:top .12s ease-out; }
.gat-skiplink:focus { top:0; }

.gat-tabbar { display:flex; flex-wrap:wrap; gap:.15rem; border-bottom:1px solid var(--gat-web-hairline); }
.gat-tab { font:inherit; font-size:1.08rem; cursor:pointer; padding:.62rem 1.2rem; border:1px solid transparent; border-bottom:none; background:transparent; color:var(--gat-web-text-soft); border-radius:var(--gat-web-radius-control) var(--gat-web-radius-control) 0 0; margin-bottom:-1px; transition:background .15s, color .15s, box-shadow .15s; }
.gat-tab:hover { color:var(--gat-web-text); background:color-mix(in srgb,var(--gat-web-green) 9%,transparent); }
.gat-tab.is-active { background:var(--gat-web-surface); border-color:var(--gat-web-hairline); color:var(--gat-web-green-deep); font-weight:700; box-shadow:inset 0 -3px 0 var(--gat-web-green-deep); }
.gat-tab { --gat-web-focus-offset: -2px; }
.gat-tab-panel { display:none; }
.gat-tab-panel.is-active { display:block; animation:gat-tab-panel-ein .18s ease-out; }
@keyframes gat-tab-panel-ein { from {opacity:0;transform:translateY(4px)} to {opacity:1;transform:translateY(0)} }

.gat-switcher { display:flex; flex-wrap:wrap; gap:.3rem; margin-bottom:.55rem; align-items:baseline; }
.gat-switcher__label { font-size:.82rem; letter-spacing:.09em; text-transform:uppercase; color:var(--gat-web-text-soft); margin-right:.35rem; }
.gat-switch-btn { font:inherit; font-size:.98rem; cursor:pointer; padding:.42rem 1rem; border:1px solid var(--gat-web-hairline); background:var(--gat-web-surface); color:var(--gat-web-text); border-radius:var(--gat-web-radius-control); line-height:1.2; transition:background .15s,border-color .15s,color .15s,transform .1s; }
.gat-switch-btn:hover { border-color:var(--gat-web-green); background:var(--gat-web-green-tint); }
.gat-switch-btn:not(.is-active):active { background:color-mix(in srgb,var(--gat-web-green) 22%,white); transform:translateY(1px); }
.gat-switch-btn.is-active { background:var(--gat-web-green-deep); border-color:var(--gat-web-green-deep); color:var(--gat-color-weiss); font-weight:600; }

// DS v2 globaler Block (greift automatisch):
.gat-btn:focus-visible, .gat-skiplink:focus-visible, .gat-tag:focus-visible,
.gat-tab:focus-visible, .gat-switch-btn:focus-visible, .gat-header__brand:focus-visible {
  outline:2px solid var(--gat-web-green-deep);
  outline-offset:var(--gat-web-focus-offset,2px);
  box-shadow:var(--gat-web-focus-ring);
}
@media (prefers-reduced-motion: reduce) { /* alle transitions/animations auf 0.01ms */ }
@media print { /* body schwarz auf weiß, .gat-no-print:none, .gat-header weiß mit schwarzem 1px border, .gat-header__nav hidden, .gat-panel/.gat-metric-card ohne schatten, break-inside:avoid */ }

// .gat-mode-hc — Tailwind-v4 Custom-Variant, aktiv über body.gat-mode-hc:
//   body bg=anthrazit, color=gelb
//   .gat-header bg=anthrazit, border-bottom=gelb
//   .gat-header__wordmark + .gat-header__nav-list a → color gelb
//   .gat-callout bg=anthrazit, color=gelb, border-left=gelb
//   .gat-panel / .gat-metric-card bg=anthrazit, color=gelb, border=gelb
//   .gat-tab.is-active bg=anthrazit, color=gelb, box-shadow inset=magenta
//   .gat-switch-btn.is-active bg=gelb, color=anthrazit, border=anthrazit
//   .gat-skiplink bg=gelb, color=anthrazit


// From upstream gat-charts.js (ES-Modul, exportiert exakt diese Namen):
export const PALETTE = [
  "#3f7d4f", // 1 green
  "#6ba368", // 2 leaf
  "#4f93a0", // 3 teal
  "#c9a24b", // 4 gold
  "#b9744f", // 5 clay
  "#9c5b7d", // 6 plum
  "#5d6b8a", // 7 slate
  "#8a8f7d", // 8 sage
];
export const INK = {
  text: "#23271f", soft: "#5e6358", mute: "#6b6f63",
  hairline: "#e1e4db", gridline: "#e7eae2", axis: "#cdd2c8",
  green: "#3f7d4f", clay: "#9c5a38", slate: "#5d6b8a",
};
export const LABEL_SIZE    = 15;
export const AXIS_SIZE     = 14;
export const BAR_MAX_DICHT = 56;
export const BAR_MAX_WEIT  = 130;
export const VA_DECAL = {
  symbol:"rect", symbolSize:1,
  dashArrayX:[3,0], dashArrayY:[1,6],
  color:"rgba(255,255,255,0.45)",
  rotation:-Math.PI/4,
};
export function tip(extra={}) { /* trigger:"axis", backgroundColor:"#ffffff", borderColor:INK.hairline, borderWidth:1, extraCssText, textStyle{color,fontFamily:Barlow,fontSize:LABEL_SIZE}, ...extra */ }
export function legende(extra={}) { /* textStyle{color:INK.soft, fontSize:LABEL_SIZE}, itemGap:14, ...extra */ }
export function grid(extra={}) { /* left:10, right:18, top:14, bottom:10, containLabel:true, ...extra */ }
export function planIstLegende() { /* returns 2 series: "Ist (RA)"/"Plan (VA/NVA)" with VA_DECAL */ }


// ============================================================
// === Was die App heute hat (was umzustellen ist) ============
// ============================================================

// From web/css/app.css :root — 26 Tokens (29 Deklarationen, 3 davon
// --web-focus-offset / --web-page-max in eigenen Blöcken):
--web-bg: #f3f5f0;
--web-surface: #ffffff;
--web-surface-sunk: #f7f9f4;
--web-hairline: #e1e4db;
--web-shadow: 0 1px 2px rgba(31,38,28,.05), 0 4px 14px rgba(31,38,28,.05);
--web-text: #23271f;
--web-text-soft: #5e6358;
--web-text-mute: #6b6f63;
--web-green-deep: #2c6e40;
--web-green: #4a8a52;
--web-green-tint: #e7efe3;
--web-yellow: #ecd64a;
--web-clay-text: #9c5a38;
--web-chart-green: #3f7d4f;
--web-chart-leaf: #6ba368;
--web-chart-teal: #4f93a0;
--web-chart-gold: #c9a24b;
--web-chart-clay: #b9744f;
--web-chart-plum: #9c5b7d;
--web-chart-slate: #5d6b8a;
--web-chart-sage: #8a8f7d;
--web-radius-control: 6px;
--web-radius-card: 10px;
--web-focus-ring: 0 0 0 3px color-mix(in srgb, var(--web-green) 38%, transparent);
--web-page-max: min(2040px, 94vw);
--web-focus-offset: -2px;  // nur lokal in einzelnen Selektoren (.tab-btn, .sortable, .doc-manager-summary)
// Plus Adapter-Aliase:
--app-hair:           var(--web-hairline);
--app-soft:           var(--web-text-soft);
--app-akzent-primaer: var(--web-green-deep);
--app-risiko:         var(--web-chart-clay);

// From web/css/app.css — App-Komponenten heute (in Migration umzustellen):
.web-brandbar { background:var(--web-surface); border-bottom:3px solid var(--web-green); box-shadow:0 1px 3px rgba(31,38,28,.06); }
.web-brandbar__brand { display:inline-flex; align-items:center; gap:0.85rem; padding:0; text-decoration:none; }
.web-brandbar__logo { height:56px; width:auto; display:block; }
.web-brandbar__wordmark { font-family:var(--gat-font-headline); font-weight:700; font-size:1.5rem; line-height:1; color:var(--web-text); letter-spacing:0.01em; }
.web-brandbar__nav-list { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; align-items:center; gap:1.25rem; }
.web-brandbar__nav-list a, .web-brandbar__nav-current { font-family:var(--gat-font-headline); font-weight:600; font-size:1.05rem; color:var(--web-green-deep); text-decoration:none; }
.web-brandbar__nav-current { border-bottom:2px solid var(--web-green); padding-bottom:2px; }
// (@media max-width:30rem)

.web-panel { display:block; background:var(--web-surface); border:1px solid var(--web-hairline); border-radius:var(--web-radius-card); box-shadow:var(--web-shadow); margin:var(--gat-space-4) 0; overflow:hidden; }
.web-panel__head { padding:var(--gat-space-3) var(--gat-space-3) var(--gat-space-2); border-bottom:1px solid var(--web-hairline); }
.web-panel__head h3 { margin:0; }
.web-panel__note { margin:var(--gat-space-1) 0 0; font-size:var(--gat-text-small); color:var(--web-text-soft); max-width:70rem; }
.web-panel__body { padding:var(--gat-space-3); }
.web-panel__body--table { padding:0; }
.web-panel__head-row { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--gat-space-3); }
.web-panel__head-row > h3 { flex:1 1 auto; }
.web-panel:fullscreen { /* identisch zu .gat-panel:fullscreen */ }
.web-panel__fs-btn { /* App-spezifisch — Vollbild-Knopf — DS hat keinen */ }

.metric-card { position:relative; background:var(--web-surface); border:1px solid var(--web-hairline); border-radius:var(--web-radius-card); box-shadow:var(--web-shadow); padding:var(--gat-space-3); overflow:hidden; }
.metric-card::before { content:""; position:absolute; inset:0 0 auto 0; height:3px; background:var(--metric-accent, var(--web-green)); }
.metric-card--ertrag  { --metric-accent: var(--web-chart-green); }   // == --gat-web-chart-1
.metric-card--aufwand { --metric-accent: var(--web-chart-clay); }    // ⚠ App nutzt clay (#b9744f) statt slate; DS-Default ist chart-5 (#b9744f) — gleich
.metric-card--netto   { --metric-accent: var(--web-chart-slate); }   // == --gat-web-chart-7
.metric-card--hero    { background:var(--web-green-tint); --metric-accent:var(--web-green-deep); }
// HINWEIS: .stat-num und .stat-label sind eigene App-Klassen (analog zu .gat-metric-card__num/__label), App-Markup
// nutzt .stat-num/.stat-label statt .gat-metric-card__num/__label → entscheiden: Markup auf DS-Schema oder lokal lassen.

.web-callout { /* App nutzt CLASS .callout (max-width:70rem; margin-top:var(--gat-space-3);) + .gat-card--primary für Optik */ }
// (Die App hat KEINE eigene .web-callout-Regel! Sie nutzt nur .callout
//  als reine Layout-Klasse und stapelt darauf .gat-card.gat-card--primary
//  für die Optik. Migration: Markup auf .gat-callout umstellen.)

.web-section-head { margin-bottom:var(--gat-space-4); }
.web-section-head h2 { margin-bottom:var(--gat-space-2); }
.web-section-head p { margin:0; max-width:70rem; color:var(--web-text-soft); }

.web-hero { margin:var(--gat-space-5) 0 var(--gat-space-5); }
.web-hero__title { margin:0; }
.web-hero__intro { margin:var(--gat-space-2) 0 0; }

// App-eigene Klassen (bleiben, ggf. → .app-*):
.page (max-width:var(--web-page-max), padding-inline:clamp(1rem,4vw,2.5rem); margin-inline:auto)
.stats (grid 4col, --einspalt-Variante), .stat (Wrapper), .stat-num/.stat-label/.stat-delta/.stat-pk
.dash-grid (grid 1fr 1fr)
.dash-chart (margin:0 — Diagramm-Container)
.mark-positiv/.mark-neutral/.mark-risiko (Inline-Highlights)
.boot-banner, .dashboard-leer
.doc-manager + .doc-manager-summary/__title/__count/__body
.dropzone + .dropzone-title/.dropzone-hint/.dropzone-btn
.progress-list/.progress-item/.progress-head/.progress-name/.progress-stage/.progress-bar/.progress-fill/.progress-error
.doc-table/.doc-table-scroll, .doc-status (.ok/.fehl), .doc-einwohner-input/.doc-edit-btn/.doc-einwohner-dialog/.doc-einwohner-form/.doc-einwohner-sub/.doc-einwohner-label/.doc-einwohner-hint/.doc-einwohner-actions, .doc-remove, .doc-empty, .doc-clear-zeile/.doc-clear-btn
.persist-note, .toast (.ok/.fehl)
.sankey-bar/.sankey-hint/.sankey-reset
.footer, .app-intro, .lead, .callout, .callout-label
.dash-controls/.tabs/.tab-btn/.tab-panel/.switcher/.switcher-label  // function classes — bleiben

// From web/index.html — heutiges Brandbar-Markup (Phase 2 umstellen):
<header class="gat-header web-brandbar">
  <div class="gat-header__inner">
    <a class="gat-header__logo web-brandbar__brand" href=".">
      <img class="web-brandbar__logo" src="https://grueneat.github.io/design-system/assets/gruene-logo.svg"
        alt="Die Gruenen" width="150" height="132">
      <span class="web-brandbar__wordmark">Gemeindefinanzen</span>
    </a>
    <nav class="gat-nav web-brandbar__nav" aria-label="Werkzeuge">
      <ul class="web-brandbar__nav-list">
        <li><span class="web-brandbar__nav-current">VRV-2015-Analyse</span></li>
      </ul>
    </nav>
  </div>
</header>

// Ziel-Markup für Phase 2 (an DS-v2 angeglichen + HC-Toggle aus Phase 4):
<header class="gat-header">
  <div class="gat-header__inner">
    <a class="gat-header__brand" href=".">
      <img class="gat-header__logo" src="https://grueneat.github.io/design-system/assets/gruene-logo.svg"
        alt="Die Gruenen" width="150" height="132">
      <span class="gat-header__wordmark">Gemeindefinanzen</span>
    </a>
    <nav class="gat-header__nav" aria-label="Werkzeuge">
      <ul class="gat-header__nav-list">
        <li><a class="gat-header__nav-current" aria-current="page" href=".">VRV-2015-Analyse</a></li>
      </ul>
      <button type="button" class="gat-header__a11y-toggle" id="hc-toggle"
              aria-pressed="false" aria-label="Hoher Kontrast einschalten">
        <svg class="gat-header__a11y-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20V2z"/></svg>
        <span>Kontrast</span>
      </button>
    </nav>
  </div>
</header>

// From web/js/app.js — Vollbild-Wiring (verdrahteVollbild()):
// Sucht ".web-panel:has(.dash-chart)", legt ".web-panel__head-row" + ".web-panel__fs-btn" an,
// queried beim fullscreenchange auf ".web-panel__fs-btn" und ".web-panel".
// → Phase 2 Such-Ersetz innerhalb app.js:
//   .web-panel             → .gat-panel
//   .web-panel__head       → .gat-panel__head
//   .web-panel__head-row   → .gat-panel__head-row
//   .web-panel__fs-btn     → .app-panel-fs-btn (App-spezifisch, kein DS-Pendant)

// From web/js/dashboard-charts.js (Phase 3 Ziel):
const INK = { green:"#3f7d4f", blue:"#4f93a0", orange:"#c9a24b", red:"#b9744f", soft:"#8a8f7d", paper:"#ffffff" }
const CHART_FONT     = "Barlow Semi Condensed, sans-serif"
const ACHSE_TEXT     = "#23271f"
const ACHSE_TEXT_SOFT= "#5e6358"
const ACHSE_LINIE    = "#cdd2c8"
const ACHSE_SPLIT    = "#e7eae2"
const LABEL_SIZE     = 15
const AXIS_SIZE      = 14
const BAR_MAX_DICHT  = 56
const BAR_MAX_WEIT   = 130
const VA_DECAL = { symbol:"rect", color:"rgba(255,255,255,0.55)", dashArrayX:[1,0], dashArrayY:[3,4], rotation:-Math.PI/4 }
function baseText() { return { fontFamily: CHART_FONT, color: ACHSE_TEXT } }
function grid(extra={}) { ... }
function tip(extra={}) { ... }
function legende(extra={}) { ... }
function catAxis(data,fontsize=LABEL_SIZE,rotate=0) { ... }    // bleibt LOKAL (App-spezifisch, axisLabel ellipse-Formatter)
function valAxis(formatter=FMT_MIO_AXIS) { ... }                // bleibt LOKAL (App-spezifischer EUR-Formatter)
const ELLIPSE_FORMATTER = "(v)=>v && v.length>34 ? v.slice(0,33)+'…' : v"   // LOKAL
const FMT_MIO_AXIS, FMT_K_LABEL                                  // LOKAL
function round(x) { /* Python-banker-rounding */ }              // LOKAL
function bar(...)                                                // LOKAL
function trendBalken(wert,typ,farbe) { /* nutzt VA_DECAL */ }   // LOKAL
function planIstLegende() { ... }                                // EXISTIERT IM DS — App-Variante leicht abweichend (App nutzt ACHSE_TEXT_SOFT für Swatch, DS hat keinen Swatch-color; beide funktionieren)

// From web/js/sankey-drill.js (Phase 3 Ziel):
const INK = { green:"#3f7d4f", blue:"#4f93a0", orange:"#c9a24b", red:"#b9744f", soft:"#8a8f7d", paper:"#ffffff" }
const CHART_FONT  = "Barlow Semi Condensed, sans-serif"
const ACHSE_TEXT  = "#23271f"
const ACHSE_LINIE = "#cdd2c8"
const LABEL_SIZE  = 15
const TOOLTIP = { /* eigene Tooltip-Definition, nicht via tip() */ }
// Nutzt INK.green/.blue/.orange/.red/.soft + ACHSE_TEXT + ACHSE_LINIE + CHART_FONT + LABEL_SIZE
// VA_DECAL/BAR_MAX/AXIS_SIZE/tip()/legende()/grid()/planIstLegende() — KEINE Verwendung
// → Sankey-Drill nutzt minimal: PALETTE-ähnliche Rollen + INK.*-typografie

// From web/vendor/dashboard/dashboard.js (TABU — nur lesen):
// Sucht/setzt: ".tab-btn" + ".is-active" auf data-tab=name; ".tab-panel" + ".is-active" auf data-panel=name;
// ".switch-btn" + ".is-active" auf data-dok=aktivDok; Klick-Listener auf ".tabs" und ".switcher".
// → Diese Klassen bleiben am Element. Visuelle Stile aus dashboard.css können
// auf .gat-tab/.gat-switch-btn umgestellt werden, indem das Element BEIDE Klassen
// trägt: class="tab-btn gat-tab", class="switch-btn gat-switch-btn".

// From tests/e2e/dashboard.spec.mjs — bleibt unverändert:
// page.locator('.tab-btn[data-tab="einnahmen"]')
// page.locator('.tab-panel[data-panel="einnahmen"]')
// toHaveClass(/is-active/)

// From tests/e2e/sparpotenzial.spec.mjs Z. 27 — Phase 2 UPDATEN:
// 'section.web-panel[data-typ-panel="RA"]'   →   'section.gat-panel[data-typ-panel="RA"]'
</interfaces>

### Reusable Components

DS v2 deckt bereits ab — die App muss diese Sachen nicht neu bauen, nur das
Markup umstellen:

| Bedürfnis der App | DS v2 liefert | App-Aktion |
|---|---|---|
| Diagramm-Panel mit Kopf/Body/Note/Head-Row/Fullscreen | `.gat-panel` + `__head`/`__head-row`/`__body`/`__body--table`/`__note` + `:fullscreen` | Markup umbenennen, lokale `.web-panel`-Regeln raus |
| Kennzahl-Karte mit Akzentbalken (4 Modifier) | `.gat-metric-card` + `--ertrag`/`--aufwand`/`--netto`/`--hero` + `__num`/`__label` | Markup umbenennen, lokale `.metric-card`-Regeln raus |
| Callout-Box (grüner Linksrand, Tint) | `.gat-callout` | Markup `.callout`+`.gat-card--primary` → `.gat-callout` |
| Section-Head (h2 + lead) | `.gat-section-head` | Markup-Klassen-Rename |
| Hero-Streifen (h1 + intro) | `.gat-hero` + `__title`/`__intro` | Markup-Klassen-Rename |
| Tabs (Folder-Optik, grüne Unterkante, Inset-Schatten) | `.gat-tabbar` + `.gat-tab` + `.gat-tab-panel` | **Doppel-Klassen** (`.tab-btn gat-tab`), `.tabs`/`.tab-panel` als Funktionsklassen bleiben, visuelle Regeln aus `dashboard.css` raus |
| Switcher (Segment-Toggle, grüner Active-Hintergrund) | `.gat-switcher` + `.gat-switch-btn` | Wie Tabs — Doppel-Klassen |
| Brandbar weiß (Logo, Wordmark, Nav, current) | `.gat-header` + `__brand`/`__logo`/`__wordmark`/`__nav-list`/`__nav-current` | Markup vollständig umstellen, `.web-brandbar*` aus CSS+HTML raus |
| Skip-Link (a11y) | `.gat-skiplink` | App fügt `<a class="gat-skiplink" href="#dashboard-inhalt">` ganz oben in `<body>` ein |
| `:focus-visible`-Block auf DS-Bedienelementen | DS-globaler Block | App-`:focus-visible`-Block kann für DS-Elemente entfallen; bleibt für App-Elemente (`.dropzone-btn`, `.doc-remove`, `.mj-btn`, `.crumbs button`, `.sortable`, `.filterbar input/select`) |
| `prefers-reduced-motion` | DS-globaler Block | App-Block ist redundant — kann **ersatzlos weg** (identische Regeln) |
| `@media print` (Header + Panel + Metric-Card) | DS-globaler Block | App-print-Block kann auf reine App-Domain-Regeln (Doc-Manager raus, Dropzone raus, MJ-Overlay raus, Sankey-Bar raus, Footer raus, Page max-width:none, #c_sankey höhe) gekürzt werden |
| Chart-Palette + ECharts-Helfer | `gat-charts.js` (`PALETTE`/`INK`/`LABEL_SIZE`/`AXIS_SIZE`/`BAR_MAX_*`/`VA_DECAL`/`tip`/`legende`/`grid`/`planIstLegende`) | ES-Import + App-Adapter für INK-Rollen-Mapping |
| HC-Modus | `.gat-mode-hc`-Variant + Overrides | App baut den Toggle-Knopf, DS liefert Look |

### Potential Conflicts

| Stelle | Problem | Lösung |
|---|---|---|
| `web/js/app.js verdrahteVollbild()` (Z. 138, 141, 147, 163, 172, 173) | Sucht `.web-panel:has(.dash-chart)`, `.web-panel__head`, setzt `className="web-panel__fs-btn"`, `className="web-panel__head-row"` | Phase 2: Such-Ersetz im JS — `.web-panel*` → `.gat-panel*`. Den App-spezifischen Vollbild-Knopf-Klassennamen umbenennen auf `.app-panel-fs-btn` (DS hat keinen Vollbild-Knopf). |
| `tests/e2e/sparpotenzial.spec.mjs:27` | `'section.web-panel[data-typ-panel="RA"]'` | Phase 2: Selector-Update auf `'section.gat-panel[data-typ-panel="RA"]'` |
| `web/vendor/dashboard/dashboard.css` | Eigene Tab-/Switcher-Regeln + Tabellen-Regeln, alle direkt `--web-*` mit Hex-Fallback | Phase 1: Token-Namen aktualisieren (oder Fallback-Hex erhalten); Phase 2: Tab-/Switcher-Regeln können raus, wenn Doppel-Klassen `.tab-btn gat-tab` greifen — Tabellen-/Drill-/MJ-Regeln bleiben (App-Domain). Empfehlung: minimaler Touch, nur Token-Refs umstellen — Tabs/Switcher kann später ein separates Cleanup-Issue machen. |
| `dashboard.css` läuft VOR `app.css` und vor DS-CSS-Regeln | Spezifitäts-Krieg mit DS-Defaults möglich (gleiche Klasse → letzter gewinnt) | DS-CSS und app.css sind beide via `<link>`-Reihenfolge: DS, dashboard.css, app.css. Doppel-Klassen `.tab-btn gat-tab` und `.gat-tab` haben gleiche Spezifität (1 Klasse); im Konflikt gewinnt die später geladene Regel — App-Regeln in `dashboard.css` würden überschreiben. **Wichtig:** Wenn `dashboard.css`-Tab-Regeln nicht entfernt werden, neutralisieren sie den DS-Default — Doppel-Klassen bringen optisch nichts. Empfehlung: in Phase 2 `dashboard.css`-Tab+Switcher-Block **entfernen** (~50 LOC) und auf DS-Defaults vertrauen, weil sie 1:1 identisch sind. |
| Brandbar-Markup-Strukturänderung | Heute trägt das App-Markup `<header class="gat-header web-brandbar">` mit gemischten DS+App-Klassen UND `<a class="gat-header__logo web-brandbar__brand">` (falsch: `__logo` ist im DS jetzt das `<img>`, nicht der `<a>`) | Phase 2: Klare Trennung — `<a class="gat-header__brand">` als Wrapper, `<img class="gat-header__logo">` als Logo-Element. Markup an DS-v2-Schema anpassen. |
| `web/index.html` hat `<header class="web-hero">` und `<h1 class="gat-headline web-hero__title">` | Lokale `.gat-headline`-Override in `app.css:207-212` (font-weight:800, color:--web-text). DS v2 `.gat-headline` ist jetzt selbst `font-weight:800` und color `var(--gat-color-text)` (`#1d1d1b`) | Phase 2: Lokale `.gat-headline`-Override prüfen — DS-Default reicht jetzt; Override kann ersatzlos weg. Color-Diff `#1d1d1b` (DS, anthrazit) vs `#23271f` (App, web-text) ist optisch identisch (beide tiefes Anthrazit). |
| `index.html:9` `theme-color #2c6e40` (dunkelgrün-deep) | Hartkodiert, kein DS-Token im `<meta>` möglich | Belassen — passt zum DS-`--gat-web-green-deep` |
| Adapter-Aliase `--app-hair`, `--app-soft`, `--app-akzent-primaer`, `--app-risiko` | Heute mappen sie auf `--web-*` | Phase 1: Auf `--gat-web-*` ummappen. **Können bleiben** als App-Namespace-Bridges (oder ersatzlos auf direkten DS-Token umstellen — Researcher-Empfehlung: lassen, dünne Adapter-Schicht ist OK). |
| `--web-page-max` ist sowohl in DS (`--gat-web-page-max`) als auch lokal definiert | Identischer Wert `min(2040px, 94vw)` | Phase 1: lokale Deklaration raus, `.page`-Selektor liest `var(--gat-web-page-max)`. |

### Code Patterns in Use

- **Funktionsklassen vs. visuelle Klassen am gleichen Element** ist im Repo
  schon etabliert — `<button class="gat-btn gat-btn--secondary doc-clear-btn">`
  trägt DS-Klassen für Optik und App-Klasse für Hookpoints. Wir machen
  dasselbe für Tabs/Switcher: `class="tab-btn gat-tab"` und
  `class="switch-btn gat-switch-btn"`.
- **`--web-*`-Token werden in `dashboard.css` mit Hex-Fallback gelesen**
  (`var(--web-bg, #f3f5f0)`). Das ist eine bewusste Robustheit, weil
  `dashboard.css` vor `app.css` geladen wird. Nach Phase 1 muss Strategie
  wählen: Token-Namen aktualisieren auf `var(--gat-web-bg, #f3f5f0)`, oder
  Hex-Fallback ganz entfernen (DS-CSS lädt vor dashboard.css — Hex-Fallback
  ist nicht mehr nötig).
- **Doppelte Token-Pflege** (App-`--web-chart-green` parallel zu Hex
  `#3f7d4f` in `dashboard-charts.js`) ist explizit dokumentiert (Z. 9-15).
  Phase 3 löst das auf, weil das JS direkt aus DS importiert.

## Token-Migrations-Mapping (vollstaendig)

Alle 26 lokalen `--web-*`-Tokens, 1:1 mit `--gat-web-*` verglichen.
**Befund: Null Wert-Drift.** Alle Hex-Werte sind exakt identisch — die
App-Schicht ist faktisch die Vorlage gewesen, aus der DS v2 die Web-Schicht
gebaut hat (siehe DS-Issue `cjpfs-rueckflusskandidaten-aus-gemeindefinanzen-
web-adaption-iter-1-18`).

| Lokaler Token | Hex | Upstream | Hex | Aktion |
|---|---|---|---|---|
| `--web-bg` | `#f3f5f0` | `--gat-web-bg` | `#f3f5f0` | **Exakt -> ersetzen** |
| `--web-surface` | `#ffffff` | `--gat-web-surface` | `#ffffff` | **Exakt -> ersetzen** |
| `--web-surface-sunk` | `#f7f9f4` | `--gat-web-surface-sunk` | `#f7f9f4` | **Exakt -> ersetzen** |
| `--web-hairline` | `#e1e4db` | `--gat-web-hairline` | `#e1e4db` | **Exakt -> ersetzen** |
| `--web-text` | `#23271f` | `--gat-web-text` | `#23271f` | **Exakt -> ersetzen** |
| `--web-text-soft` | `#5e6358` | `--gat-web-text-soft` | `#5e6358` | **Exakt -> ersetzen** |
| `--web-text-mute` | `#6b6f63` | `--gat-web-text-mute` | `#6b6f63` | **Exakt -> ersetzen** |
| `--web-clay-text` | `#9c5a38` | `--gat-web-clay-text` | `#9c5a38` | **Exakt -> ersetzen** |
| `--web-green-deep` | `#2c6e40` | `--gat-web-green-deep` | `#2c6e40` | **Exakt -> ersetzen** |
| `--web-green` | `#4a8a52` | `--gat-web-green` | `#4a8a52` | **Exakt -> ersetzen** |
| `--web-green-tint` | `#e7efe3` | `--gat-web-green-tint` | `#e7efe3` | **Exakt -> ersetzen** |
| `--web-yellow` | `#ecd64a` | `--gat-web-yellow` | `#ecd64a` | **Exakt -> ersetzen** |
| `--web-chart-green` | `#3f7d4f` | `--gat-web-chart-1` | `#3f7d4f` | **Exakt -> ersetzen** (Name-Wechsel: `green` -> `1`) |
| `--web-chart-leaf` | `#6ba368` | `--gat-web-chart-2` | `#6ba368` | **Exakt -> ersetzen** |
| `--web-chart-teal` | `#4f93a0` | `--gat-web-chart-3` | `#4f93a0` | **Exakt -> ersetzen** |
| `--web-chart-gold` | `#c9a24b` | `--gat-web-chart-4` | `#c9a24b` | **Exakt -> ersetzen** |
| `--web-chart-clay` | `#b9744f` | `--gat-web-chart-5` | `#b9744f` | **Exakt -> ersetzen** |
| `--web-chart-plum` | `#9c5b7d` | `--gat-web-chart-6` | `#9c5b7d` | **Exakt -> ersetzen** |
| `--web-chart-slate` | `#5d6b8a` | `--gat-web-chart-7` | `#5d6b8a` | **Exakt -> ersetzen** |
| `--web-chart-sage` | `#8a8f7d` | `--gat-web-chart-8` | `#8a8f7d` | **Exakt -> ersetzen** |
| `--web-radius-control` | `6px` | `--gat-web-radius-control` | `6px` | **Exakt -> ersetzen** |
| `--web-radius-card` | `10px` | `--gat-web-radius-card` | `10px` | **Exakt -> ersetzen** |
| `--web-shadow` | `0 1px 2px rgba(31,38,28,.05), 0 4px 14px rgba(31,38,28,.05)` | `--gat-web-shadow` | identisch | **Exakt -> ersetzen** |
| `--web-focus-ring` | `0 0 0 3px color-mix(in srgb, var(--web-green) 38%, transparent)` | `--gat-web-focus-ring` | identisch (referenziert dann `--gat-web-green`) | **Exakt -> ersetzen** |
| `--web-page-max` | `min(2040px, 94vw)` | `--gat-web-page-max` | `min(2040px, 94vw)` | **Exakt -> ersetzen** |
| `--web-focus-offset` | (Selector-scoped, `-2px` lokal) | `--gat-web-focus-offset` | DS-Default `2px`, Selector-scoped Override moeglich | **Selector-Scope behalten, Name aktualisieren** |

**App-eigene Tokens (keine DS-Entsprechung) -> bleiben als `--app-*`:**

| Lokaler Adapter-Alias | Heutiger Wert | Phase-1-Ziel |
|---|---|---|
| `--app-hair` | `var(--web-hairline)` | -> `var(--gat-web-hairline)` |
| `--app-soft` | `var(--web-text-soft)` | -> `var(--gat-web-text-soft)` |
| `--app-akzent-primaer` | `var(--web-green-deep)` | -> `var(--gat-web-green-deep)` |
| `--app-risiko` | `var(--web-chart-clay)` | -> `var(--gat-web-chart-5)` |

**Zwischenfazit:** Keine Wert-Drift, kein Folge-Issue im DS-Repo noetig.

## Komponenten- und Klassen-Migrations-Mapping (vollstaendig)

| Heutige App-Klasse | DS v2 | Aktion | Markup-Stellen (Anzahl) |
|---|---|---|---|
| `.web-brandbar` | `.gat-header` | **Ersetzen** + Markup-Block-Replace (siehe Phase 2) | `index.html:19`, `app.css:1142` (print) |
| `.web-brandbar__brand` | `.gat-header__brand` | **Ersetzen** | `index.html:21`, `app.css:254` |
| `.web-brandbar__logo` | `.gat-header__logo` (jetzt auf `<img>`!) | **Markup-Block-Replace** | `index.html:22`, `app.css:263` |
| `.web-brandbar__wordmark` | `.gat-header__wordmark` | **Ersetzen** | `index.html:24`, `app.css:268, 1147` (print) |
| `.web-brandbar__nav` | `.gat-header__nav` | **Ersetzen** | `index.html:29`, `app.css:1150` (print) |
| `.web-brandbar__nav-list` | `.gat-header__nav-list` | **Ersetzen** | `index.html:30`, `app.css:278` |
| `.web-brandbar__nav-current` | `.gat-header__nav-current` | **Ersetzen** | `index.html:31`, `app.css:287, 299` |
| `.web-panel` | `.gat-panel` | **Ersetzen** | `index.html`: 24 Stellen; `app.css`: Block Z. 397-557 raus; `app.js`: 5 Stellen; Test: 1 Stelle |
| `.web-panel__head` | `.gat-panel__head` | **Ersetzen** | `index.html`: 24 Stellen; `app.js:141, 173` |
| `.web-panel__head h3` | `.gat-panel__head h3` | greift via DS automatisch | -- |
| `.web-panel__note` | `.gat-panel__note` | **Ersetzen** | `index.html`: ~12 Stellen |
| `.web-panel__head-row` | `.gat-panel__head-row` | **Ersetzen** | `app.js:163` |
| `.web-panel__body` | `.gat-panel__body` | **Ersetzen** | `index.html`: 24 Stellen |
| `.web-panel__body--table` | `.gat-panel__body--table` | **Ersetzen** | `index.html`: 5 Stellen |
| `.web-panel:fullscreen` | `.gat-panel:fullscreen` | **Ersetzen** (CSS-Regeln in `app.css` raus -- DS deckt) | `app.css:522-552` |
| `.web-panel__fs-btn` | (kein DS-Pendant) | **Umbenennen** auf `.app-panel-fs-btn` | `app.css:491-514`, `app.js:147, 172` |
| `.metric-card` | `.gat-metric-card` | **Ersetzen** | `index.html`: 8 Stellen |
| `.metric-card--ertrag` | `.gat-metric-card--ertrag` | **Ersetzen** | `index.html:185` |
| `.metric-card--aufwand` | `.gat-metric-card--aufwand` | **Ersetzen** | `index.html:191, 418` |
| `.metric-card--netto` | `.gat-metric-card--netto` | **Ersetzen** | `index.html:197` |
| `.metric-card--hero` | `.gat-metric-card--hero` | **Ersetzen** | `index.html:203` |
| `.stat-num` | `.gat-metric-card__num` | **Markup-Ersetzen** (mit uebersetztem Markup) | `index.html`: 5 Stellen |
| `.stat-label` | `.gat-metric-card__label` | **Markup-Ersetzen** | `index.html`: 5 Stellen |
| `.stat-delta` (App-spezifisch) | (kein DS-Pendant) | **Umbenennen** auf `.app-stat-delta` (oder belassen -- Researcher: belassen, einfacher) | `app.css:380-387` |
| `.stat-pk` (App-spezifisch) | (kein DS-Pendant) | **Belassen** (oder `.app-stat-pk`) | `app.css:390-394` |
| `.stats` (Grid, 4 Spalten responsive) | (kein DS-Pendant -- DS hat nur 1-col/2-col/3-col) | **Belassen** als `.stats` oder umbenennen `.app-stats` | `app.css:312-329` |
| `.stat` (Wrapper im `.stats`-Grid) | (kein DS-Pendant) | **Belassen**: ist optionaler Wrapper, `.gat-metric-card` reicht | `index.html`: 5 Stellen -- kann `.stat`-Klasse entfallen |
| `.callout` + `.gat-card.gat-card--primary` | `.gat-callout` | **Markup-Block-Replace** | `index.html:605` |
| `.callout-label` + `.gat-card__title` | (DS hat kein `__label` fuer Callout) | **Eigenes `<strong>`** + ggf. App-Klasse | `index.html:606` |
| `.web-section-head` | `.gat-section-head` | **Ersetzen** | `index.html`: 7 Stellen (Z. 126, 246, 277, 357, 380, 409, 491, 616) |
| `.web-hero` | `.gat-hero` | **Ersetzen** | `index.html:39`, `app.css:190` |
| `.web-hero__title` | `.gat-hero__title` | **Ersetzen** | `index.html:40` |
| `.web-hero__intro` | `.gat-hero__intro` | **Ersetzen** | `index.html:41` |
| `.tabs` | `.tabs` + zusaetzlich `.gat-tabbar` | **Doppel-Klasse** (Funktionsklasse bleibt) | `index.html:113` |
| `.tab-btn` | `.tab-btn` + zusaetzlich `.gat-tab` | **Doppel-Klasse** | `index.html`: 8 Tab-Buttons |
| `.tab-panel` | `.tab-panel` (DS hat `.gat-tab-panel`, identische Animation) | **Doppel-Klasse optional** (kein Mehrwert, DS-Animation ist 1:1) | `index.html`: 8 Tab-Panels |
| `.switcher` | `.switcher` + zusaetzlich `.gat-switcher` | **Doppel-Klasse** | `index.html:111` |
| `.switcher-label` | `.gat-switcher__label` | **Markup-Klasse aktualisieren** | `index.html:111` |
| `.switch-btn` | `.switch-btn` + zusaetzlich `.gat-switch-btn` | **Doppel-Klasse** | `dashboard-app.js` setzt `btn.className = "switch-btn gat-switch-btn"` |
| `.gat-headline` Override (Z. 207-212) | DS-Default reicht (DS v2: weight 800, anthrazit) | **Override entfernen** | `app.css:207-212` |
| `.web-skiplink` (heute nicht vorhanden) | `.gat-skiplink` | **Neu einfuegen** als erstes `<body>`-Element | `index.html` |
| `:focus-visible`-Block in `app.css:692-727` | DS-Block deckt DS-Klassen automatisch | **App-Klassen behalten, DS-Klassen aus Selector-Liste entfernen** | `app.css:692-727` |
| `@media (prefers-reduced-motion)` (Z. 1099-1110) | DS-Block ist identisch | **Ersatzlos entfernen** | `app.css:1099-1110` |
| `@media print` (Z. 1121-1199) | DS-Block deckt Header+Panel+Metric-Card | **Kuerzen** auf App-Domain-Regeln | `app.css:1121-1199` |
| `.dropzone`/`.doc-manager`/`.doc-*`/`.progress-*`/`.toast`/`.sankey-bar`/`.mj-*`/`.footer`/`.app-intro`/`.lead`/`.dashboard-leer`/`.boot-banner`/`.mark-*`/`.dash-chart`/`.dash-grid`/`.dash-controls`/`.page` | App-Domain | **Belassen** (optional `.app-*`-Prefix -- researcher empfiehlt: nicht umbenennen, Markup-Stellen-Aufwand zu hoch fuer marginalen Gewinn; Namespace-Bruch durch CSS-Kommentar dokumentieren) | unveraendert |

**Anti-Klassen-Hygiene am Brandbar-Element:** Heute steht
`<header class="gat-header web-brandbar">` und `<a class="gat-header__logo
web-brandbar__brand">`. Letzteres ist semantisch falsch (`.gat-header__logo`
ist in DS v2 fuer `<img>`, nicht fuer `<a>`). Phase 2 macht das sauber.

## Standard Stack

| Library | Version | Purpose | Why Standard | Confidence |
|---------|---------|---------|--------------|------------|
| `design-system.css` (Grüne AT DS) | v2.0.0 (Rolling über `<link>`) | Tokens, Komponenten, A11y-Variant, `@media print`/`prefers-reduced-motion` | Org-Standard, CDN, kein Build | HIGH (direkt aus DS-Source-CSS gelesen) |
| `gat-charts.js` (Grüne AT DS) | v2.0.0 (Rolling) | ECharts-Palette + Helfer | Org-Standard, CDN, kein Build | HIGH (ES-Modul direkt gelesen) |
| ECharts | 5.5.1 (jsDelivr CDN, bleibt unverändert) | Diagramme | Bereits eingebunden | HIGH |
| Barlow Semi Condensed + Vollkorn | via DS-CSS-`@import` Google Fonts | Schriften | Bereits über DS geladen | HIGH |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Volle 1:1-Token-Angleichung | Nur Komponenten umstellen, `--web-*` behalten | Wird Doppel-Pflege fortsetzen, widerspricht Konvergenz-Ziel. **Verworfen.** |
| DS-Klassen nur als zweite Klasse (`web-panel gat-panel`) | Beide Klassen am Element, lokale `.web-panel`-Regeln zuerst entfernen | Behält Migrationsrisiko klein, aber Doppel-Pflege bleibt. **Verworfen** — Issue verlangt komplettes Ausräumen. |
| `gat-charts.js` ins Repo vendoren | CDN-Import | Widerspricht CLAUDE.md „Kein Vendoring". **Verworfen.** |
| Tabs/Switcher in `index.html` zusätzlich `.gat-tab`/`.gat-switch-btn` taggen | Funktionsklassen-only behalten + `dashboard.css` lokale Tab-Regeln behalten | Doppel-Pflege, kein Konvergenz-Gewinn. **Empfohlen:** Doppel-Klassen + `dashboard.css`-Tab-Block raus (lokale Regeln waren visuell exakt das, was DS-Default jetzt liefert). |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart-Palette spiegeln | Lokale `INK = { green, blue, orange, ... }` weiter pflegen | `PALETTE` + `INK` aus `gat-charts.js` importieren, dünner Adapter im App-Code für die App-Rollennamen | DS hat die Werte; doppelte Hex-Pflege ist genau das, was Phase 3 auflöst |
| Tooltip-/Legenden-/Grid-Defaults für ECharts | `tip()`/`legende()`/`grid()` lokal | `tip()`/`legende()`/`grid()` aus `gat-charts.js` importieren | DS-Helfer haben identische Logik (Vorlage aus dieser App) |
| Plan-Ist-Schraffur (`VA_DECAL`) | Eigene Schraffur-Konstante | `VA_DECAL` aus DS importieren | Sichtbar identisch (Diagonal-Raster auf VA/NVA-Balken) |
| Brandbar-CSS | `.web-brandbar*`-Schicht | `.gat-header*` (DS v2 ist exakt diese weiße Brandbar) | DS v2 wurde explizit als „weiße Brandbar im gruene.at-Stil" konzipiert |
| Panel-Karte mit Kopf/Body/Note | `.web-panel` lokal | `.gat-panel` aus DS | 1:1-Werte |
| Metric-Card mit 4 Akzent-Modifiern | `.metric-card` lokal | `.gat-metric-card --ertrag/--aufwand/--netto/--hero` | 1:1-Werte |
| `prefers-reduced-motion`-Block | Eigener `@media` in `app.css` | DS-globaler Block | Identische Regel — App-Block ersatzlos raus |
| `@media print` Header+Panel+Metric-Card | Eigener Block in `app.css` | DS-globaler Block | DS deckt das ab; App-Block braucht nur App-spezifische Regeln (Doc-Manager raus, MJ-Overlay raus, Sankey-Bar raus, ...) |
| Skip-Link | Eigene Klasse | `.gat-skiplink` | DS liefert |
| Folder-Tab-Optik (grüne Unterkante, Inset-Schatten beim Active-Tab) | `.tab-btn`-Regeln in `dashboard.css` | `.gat-tab.is-active` | **Optisch 1:1 identisch** — DS-Selektoren-Werte stimmen mit `dashboard.css:53-64` überein |
| Segment-Switcher | `.switch-btn`-Regeln in `dashboard.css` | `.gat-switch-btn` | Optisch 1:1 identisch |

## Architecture Patterns

### Recommended Approach

**Pro Phase ein Commit, geringes Risiko durch Doppelschicht-Migration.**

#### Phase 1 — Tokens (reiner CSS-Diff)
1. In `web/css/app.css :root` jeden `--web-*`-Token, der ein 1:1-`--gat-web-*`-
   Pendant hat, **ersetzen** durch DS-Token-Referenzen oder durch direkte
   Verwendung von `--gat-web-*` (Empfehlung: lokale Aliase als `--app-*`-Bridge
   behalten, die auf `--gat-web-*` zeigen, für Lesbarkeit der App-Regeln).
2. App-spezifische Tokens umbenennen auf `--app-*`-Namespace.
3. `dashboard.css`: Token-Referenzen aktualisieren von `var(--web-bg, ...)`
   auf `var(--gat-web-bg, ...)` (oder Hex-Fallback entfernen, da DS-CSS
   immer vorher lädt).
4. `--web-focus-offset` bleibt als lokaler Selector-scoped Token (z. B.
   `.tab-btn { --gat-web-focus-offset: -2px; }`) — DS-Block respektiert ihn
   automatisch via `outline-offset: var(--gat-web-focus-offset, 2px)`.

#### Phase 2 — Komponenten (Markup + CSS-Cleanup)
1. **Brandbar:** `index.html` Header-Markup auf DS-v2-Schema umstellen
   (`<a class="gat-header__brand">`, `<img class="gat-header__logo">`,
   `<span class="gat-header__wordmark">`, `<nav class="gat-header__nav">`,
   `<ul class="gat-header__nav-list">`, `<li><a class="gat-header__nav-current">…`). `app.css`:
   `.web-brandbar*`-Block (Z. 232-306) ersatzlos entfernen — DS liefert.
2. **Panels:** `index.html` und `app.js` Such-Ersetz
   `.web-panel` → `.gat-panel` (24 Stellen in HTML + 5 Stellen in `app.js`).
   `app.css`: `.web-panel`-Block (Z. 397-557) ersatzlos entfernen.
   `web-panel__fs-btn` umbenennen auf `app-panel-fs-btn` (App-spezifisch).
3. **Metric-Cards:** `index.html` Such-Ersetz `.metric-card`
   → `.gat-metric-card` (8 Stellen). App-Markup `<div class="stat-num">`
   etc. → `<div class="gat-metric-card__num">` (entscheidet auch: ja, weil
   sonst lokale `.stat-num`/`.stat-label`-Regeln nicht ablösen kann). Oder:
   `.stat-num`/`.stat-label` als `.app-*` belassen — Researcher-Empfehlung:
   **umbenennen auf `__num`/`__label`**, weil das Markup ohnehin angefasst
   wird und so die `.metric-card`-Regel ganz wegfällt. `app.css`:
   `.metric-card*`-Block + `.stat`/`.stat-num`/`.stat-label`-Block
   (Z. 308-395) bis auf `.stat`/`.stats`/`.stats--einspalt` (Grid-Layout —
   App-spezifisch, bleibt als `.app-stats`) sowie `.stat-delta`/`.stat-pk`
   (App-spezifische Zusatzzeilen — bleibt als `.app-stat-delta`/`.app-stat-pk`).
4. **Callouts:** `index.html` `<div class="callout gat-card gat-card--primary">`
   → `<div class="gat-callout">`; `<div class="callout-label gat-card__title">`
   → `<strong class="gat-callout__label">` o. ä. (DS hat keinen `__label` für
   Callout — App kann eigenes `<strong>` reinmachen). `app.css`: `.callout`-
   Block (Z. 574-582) ersatzlos raus.
5. **Section-Head + Hero:** `index.html` Such-Ersetz `web-section-head` →
   `gat-section-head` (7 Stellen), `web-hero` → `gat-hero` (3 Stellen).
   `app.css`: lokale Blöcke (Z. 188-202, 559-572) ersatzlos raus.
6. **Lokale `.gat-headline`-Override** (`app.css:207-212`) prüfen — DS-Default
   ist jetzt `font-weight:800`, identisch zur Override. Ersatzlos raus.
7. **`prefers-reduced-motion`-Block** (Z. 1099-1110) ersatzlos raus — DS deckt.
8. **`@media print`-Block** (Z. 1121-1199): App-spezifische Regeln behalten
   (`.doc-manager`/`.dashboard-leer`/`.dash-controls`/`#toast-box`/
   `.mj-overlay`/`.sankey-bar`/`.mj-actions`/`.footer` display:none; `.page`
   max-width:none; `#c_sankey` height); DS-überdeckte Regeln (`.web-brandbar`/
   `.web-panel`/`.metric-card`) raus.
9. **Tabs/Switcher:** `index.html` HTML-Elemente bekommen Doppel-Klasse:
   `<button class="tab-btn gat-tab" …>` (8 Tabs), `<div class="tabs gat-tabbar">`,
   `<div class="switcher gat-switcher">`, `<span class="switcher-label gat-switcher__label">`,
   `<button class="switch-btn gat-switch-btn">` (in `dashboard-app.js`!).
   `dashboard.css`: Tab-Block (Z. 51-79) und Switcher-Block (Z. 82-108)
   ersatzlos entfernen — DS-Defaults sind 1:1 identisch.
10. **`.tab-panel`** trägt nur Funktionsklasse — kein DS-Pendant nötig
    (DS hat `.gat-tab-panel` mit `.is-active`-Animation, die exakt der
    aktuellen `dashboard.css:75-79` entspricht). Optional zusätzliche
    `.gat-tab-panel`-Klasse setzen und lokale Tab-Panel-Regel raus — oder
    lokale Regel belassen (geringer Mehrwert).
11. **`.app-*`-Umbenennungen** (`app.css` + Markup):
    - `.web-shell` existiert nicht. `.page` bleibt App-spezifisch (`.app-page`
      wäre konsistenter, aber `.page` ist nur in `index.html:37` einmal —
      Researcher-Empfehlung: **`.page` lassen, ein-Stelle-Ausnahme**).
    - `.app-hair`/`.app-soft`/`.app-akzent-primaer`/`.app-risiko` bleiben
      (Adapter-Aliase auf DS-Tokens).
    - `--web-page-max` → entfernen (DS hat `--gat-web-page-max`).
12. **Tests:** `tests/e2e/sparpotenzial.spec.mjs:27` Selector
    `section.web-panel` → `section.gat-panel`.
13. **Skip-Link:** `<a class="gat-skiplink" href="#dashboard-inhalt">Zum Inhalt</a>`
    als erstes Element nach `<body>`, vor dem `boot-guard.js`-Script.

#### Phase 3 — Charts
1. `web/js/dashboard-charts.js` ganz oben:
   ```js
   import {
     PALETTE, INK as DS_INK, LABEL_SIZE, AXIS_SIZE,
     BAR_MAX_DICHT, BAR_MAX_WEIT, VA_DECAL,
     tip, legende, grid, planIstLegende,
   } from "https://grueneat.github.io/design-system/gat-charts.js"

   // App-Adapter: DS-INK liefert neutrale Rollen, die App nutzt
   // semantische Rollen. Mapping über die Chart-Palette:
   const INK = {
     green:  PALETTE[0], // chart-1
     blue:   PALETTE[2], // chart-3 (teal)
     orange: PALETTE[3], // chart-4 (gold)
     red:    PALETTE[4], // chart-5 (clay)
     soft:   PALETTE[7], // chart-8 (sage)
     paper:  "#ffffff",
   }
   const ACHSE_TEXT      = DS_INK.text
   const ACHSE_TEXT_SOFT = DS_INK.soft
   const ACHSE_LINIE     = DS_INK.axis
   const ACHSE_SPLIT     = DS_INK.gridline
   const CHART_FONT      = "Barlow Semi Condensed, sans-serif"
   ```
2. Lokale Konstanten ausbauen:
   - `const INK = {...}` (Z. 16-23) → ersetzt durch obigen Adapter.
   - `const LABEL_SIZE = 15`, `const AXIS_SIZE = 14` (Z. 39-40) → entfernt
     (kommen aus Import).
   - `const BAR_MAX_DICHT = 56`, `const BAR_MAX_WEIT = 130` (Z. 53-54) →
     entfernt.
   - `const VA_DECAL = {...}` (Z. 543-549) → entfernt (kommt aus Import).
     **Hinweis:** Lokales `VA_DECAL` hat `dashArrayX:[1,0]`, `dashArrayY:[3,4]`,
     `color:"rgba(255,255,255,0.55)"`. DS-`VA_DECAL` hat `dashArrayX:[3,0]`,
     `dashArrayY:[1,6]`, `color:"rgba(255,255,255,0.45)"`, plus `symbolSize:1`.
     Visualisierungs-Effekt ist sehr ähnlich (diagonale Raster auf Plan-
     Balken). **Empfehlung:** DS-Wert übernehmen (deferred Decision 3:
     „Übernehmen, nicht diskutieren").
   - Funktionen `tip()` (Z. 68-82), `legende()` (Z. 85-96), `grid()`
     (Z. 60-62), `planIstLegende()` (Z. 561-576) → entfernt; Import-Versionen
     übernehmen.
     **Hinweis:** Lokales `legende()` hat `bottom:0` (App-Default), DS hat
     keinen `bottom`. App muss explizit `bottom: 0` an Call-Sites mitgeben
     oder via Wrapper:
     ```js
     const legende_app = (extra={}) => legende({ bottom: 0, ...extra })
     ```
     Lokales `tip()` hat `padding:[7,11]` und `box-shadow:rgba(31,38,28,.12)`
     (App: leicht dunklerer Schatten als DS). Akzeptable Drift, DS-Default
     übernehmen.
   - Lokales `grid()` ist 1:1 identisch zur DS-Version (`left:10, right:18,
     top:14, bottom:10, containLabel:true`).
3. `CHART_FONT`, `baseText()`, `catAxis()`, `valAxis()`,
   `ELLIPSE_FORMATTER`, `FMT_MIO_AXIS`, `FMT_K_LABEL`, `round()`, `bar()`,
   `trendBalken()`, `MEHRJAHR_PALETTE` **bleiben lokal** (App-spezifische
   Achsen-Helfer, Formatter, Rundungslogik, Bar-Builder, Mehrjahres-Palette).
4. `MEHRJAHR_PALETTE` (Z. 1438-1449) entspricht PALETTE + zwei zusätzliche
   weiche Tints. Kann optional refactored werden:
   ```js
   const MEHRJAHR_PALETTE = [
     PALETTE[0], PALETTE[3], PALETTE[2], PALETTE[4], PALETTE[1],
     PALETTE[5], PALETTE[6], PALETTE[7],
     "#a7c4a3", "#c9a98c",  // weiche Tints — App-eigen
   ]
   ```
   So bleibt die Sortierung erhalten, der Wert wird aber aus DS bezogen.
5. `web/js/sankey-drill.js` analog:
   ```js
   import { INK as DS_INK, PALETTE, LABEL_SIZE } from
     "https://grueneat.github.io/design-system/gat-charts.js"
   const INK = { green: PALETTE[0], blue: PALETTE[2], orange: PALETTE[3],
                 red: PALETTE[4], soft: PALETTE[7], paper: "#ffffff" }
   const CHART_FONT  = "Barlow Semi Condensed, sans-serif"
   const ACHSE_TEXT  = DS_INK.text
   const ACHSE_LINIE = DS_INK.axis
   // LABEL_SIZE kommt aus Import
   // TOOLTIP (Z. 46-55) bleibt lokal — App-spezifische Tooltip-Konfig
   ```
6. **Smoke-Test:** alle Charts rendern visuell gleich. Pixel-Drift
   tolerieren (decal-Schraffur leicht anders → Plan-Balken sehen minimal
   anders aus, akzeptabel).

#### Phase 4 — A11y `.gat-mode-hc`-Toggle
1. **HTML in `index.html`** — vor dem ersten `<script>`, im `<head>`:
   ```html
   <script>
     // FOWT-Prevention: Body-Klasse setzen, bevor irgendetwas rendert.
     try {
       if (localStorage.getItem("gat-mode-hc") === "1") {
         document.documentElement.classList.add("gat-mode-hc");
       }
     } catch (e) { /* localStorage gesperrt — egal */ }
   </script>
   ```
   **Wichtig:** Hier wird `<html>` (`documentElement`) klassiert statt
   `<body>`, weil `<body>` zum Zeitpunkt des `<head>`-Skripts noch nicht
   existiert. Der DS-Selector `:where(.gat-mode-hc, .gat-mode-hc *)`
   funktioniert auf `<html>` genauso wie auf `<body>`. **Konvention der DS-
   MIGRATION.md** ist allerdings „body.gat-mode-hc"; um beides zu erlauben,
   wird der JS-Toggle in Phase-4 `<body>` UND `<html>` togglen (oder
   ausschließlich `<body>` — dann muss der Inline-`<head>`-Block die
   Klasse merken und beim `DOMContentLoaded` auf `<body>` setzen). **Empfehlung:**
   Inline-Block setzt Klasse auf `<html>`, JS-Toggle auf `<body>` UND
   `<html>`. So greift FOWT-Prevention auch auf `<body>`-bezogene DS-Regeln
   (z. B. `.gat-mode-hc body, .gat-mode-hc { background:...; }` greift bei
   `<html class="gat-mode-hc">` ebenfalls, da `.gat-mode-hc` als
   Ancestor-Selector wirkt).

2. **HTML-Markup für den Knopf** im Brandbar-Nav (Phase 2 hatte schon das
   Ziel-Markup gezeigt):
   ```html
   <nav class="gat-header__nav" aria-label="Werkzeuge">
     <ul class="gat-header__nav-list">
       <li><a class="gat-header__nav-current" aria-current="page" href=".">VRV-2015-Analyse</a></li>
     </ul>
     <button type="button" class="gat-header__a11y-toggle" id="hc-toggle"
             aria-pressed="false">
       <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"
            fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20V2z"/></svg>
       <span>Kontrast</span>
     </button>
   </nav>
   ```
   Der `<button>` sitzt rechts neben der `<ul>`, weil `gat-header__nav` ein
   `flex`-Container ist (CONTEXT-Decision 3).

3. **CSS in `app.css`** (App-spezifisch, weil DS keinen Toggle-Knopf liefert):
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
   /* HC-Modus: Knopf hervorhebung im Anthrazit/Gelb-Stil */
   .gat-mode-hc .gat-header__a11y-toggle {
     border-color: var(--gat-color-gelb);
     color: var(--gat-color-gelb);
   }
   .gat-mode-hc .gat-header__a11y-toggle[aria-pressed="true"] {
     background: var(--gat-color-gelb);
     color: var(--gat-color-anthrazit);
   }
   ```

4. **JS in `app.js`** — neue Funktion `verdrahteHcToggle()`, aufgerufen
   in `init()` neben den anderen `verdrahte*`-Funktionen:
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
     // Initial-State aus dem <head>-Inline-Block übernehmen
     let aktiv = false
     try { aktiv = localStorage.getItem("gat-mode-hc") === "1" }
     catch (e) { /* egal */ }
     set(aktiv)
     btn.addEventListener("click", () => set(!document.body.classList.contains("gat-mode-hc")))
   }
   ```

5. **Smoke-Tests:**
   - Klick auf `#hc-toggle` setzt `<body class="gat-mode-hc">`,
     `aria-pressed="true"`, `localStorage["gat-mode-hc"] === "1"`.
   - Reload → Body-Klasse ist immer noch aktiv (Inline-Block hat sie auf
     `<html>` gesetzt, JS spiegelt sie auf `<body>`).
   - `localStorage.clear()` + Reload → Knopf zeigt `aria-pressed="false"`,
     keine HC-Klasse.

#### Phase 5 — Doku
1. **`docs/web-design-system.md`** Iteration 19 anhängen — Format wie
   Iteration 17/18 (Aufzählung mit fett-markierten Haupt-Punkten). Inhalt:
   - Lokale `--web-*`-Schicht ausgebaut, durch `--gat-web-*` ersetzt.
   - Komponenten 1:1 auf `.gat-*` umgestellt.
   - `gat-charts.js` per CDN-Import; lokale Chart-Konstanten ausgebaut.
   - `.gat-mode-hc`-Toggle in der Brandbar (Knopf App-eigen).
   - Hinweis: Das Dokument ist ab hier historisch. Neue Konventionen leben
     im DS-Repo (`grueneat/design-system`).
2. **`web/vendor/LIZENZEN.md`** Abschnitt „Design System" um `gat-charts.js`
   ergänzen — gleicher Eintrag, CC BY 4.0.

### Anti-Patterns to Avoid

- **`design-system.css`-URL ändern oder pinnen.** Issue verlangt explizit
  Rolling-URL. Kein `?v=2.0.0`, kein Tag-Pinning. Last-Modified reicht.
- **`gat-charts.js` ins Repo kopieren.** Auch wenn der Import sich
  „ungewohnt" anfühlt — CDN. Keine Ausnahme.
- **`dashboard.js` (Vendor) anfassen.** Selbst wenn eine `.is-active`-
  Regel „nur ein Buchstabe" ist — tabu. Funktionsklassen am Markup behalten.
- **Tests umarbeiten, statt Selectors anzupassen.** Wenn ein Test eine alte
  Klasse erwartet, **den Selector** updaten (1 Stelle in
  `sparpotenzial.spec.mjs`). Niemals den Test ausschalten oder umstricken.
- **Werkzeug-Attribution.** Kein „claude", kein „Generated with", kein
  Co-Authored-By — nirgends.
- **Hellgrün als Textfarbe.** DS v2 hat `--gat-color-hellgruen` auf `#3e8a25`
  gehärtet, **die App nutzt diese Farbe heute nicht direkt** (`grep
  hellgruen web/css/app.css web/index.html` liefert 0; nur Token-Verweise).
  Sollte die Hellgrün-Wert-Änderung in Phase-Snapshots auftauchen, ist es
  ein Bug. Voraussichtlich kein Issue für diese App.
- **`--gat-color-on-secondary` als Textfarbe auf Hellgrün-Fläche annehmen.**
  Die App nutzt diese Paarung nicht direkt — Doppelt-Check beim Snapshot.

## Common Pitfalls

### FOWT (Flash Of Wrong Theme) beim Reload mit aktiver HC-Klasse
**What goes wrong:** Body bekommt `gat-mode-hc` erst nach `DOMContentLoaded`
gesetzt — kurzer hell-grünstichiger Flash, dann Anthrazit/Gelb.
**Why it happens:** ES-Modul `app.js` lädt mit `type="module"`, also
defer-by-default. Das ist nach dem ersten Paint.
**How to avoid:** Inline-`<script>` im `<head>` setzt die Klasse auf
`<html>` (nicht `<body>` — existiert noch nicht!) **vor** dem ersten
Render. Wrap in try/catch wegen `localStorage`-Block in Privatmodus.
**Warning signs:** Reload in Privatfenster bzw. mit aktivem HC im
DevTools-Performance-Trace: ein Frame mit hellem Body.

### `dashboard.css`-Tab-Regeln überdecken DS-Defaults
**What goes wrong:** Doppel-Klassen `.tab-btn gat-tab` sehen aus wie
vorher, **nicht** wie DS-Default — weil die `dashboard.css`-Regeln später
geladen werden und gleiche Spezifität (1 Klasse) haben.
**Why it happens:** `<link>`-Reihenfolge in `index.html` ist:
DS-CSS → `dashboard.css` → `app.css`. Die App-Regel `.tab-btn { ... }`
und `.tab-btn.is-active { ... }` überdecken `.gat-tab` und
`.gat-tab.is-active`.
**How to avoid:** In Phase 2 die `.tabs`/`.tab-btn`/`.tab-panel`-Blöcke
in `dashboard.css` (Z. 51-79) und `.switcher`/`.switcher-label`/
`.switch-btn`-Blöcke (Z. 82-108) **ersatzlos entfernen**, weil die
DS-Defaults 1:1 dasselbe leisten. Zwingt sauberen Test-Lauf, sonst
treten Stil-Regressionen zwischen den Phasen auf.
**Warning signs:** Nach Phase 2 sehen Tabs identisch zu Phase-0-Baseline
aus → Doppelpflege; falls die `dashboard.css`-Regeln nicht entfernt werden.

### `INK`-Shape-Mismatch in `dashboard-charts.js`
**What goes wrong:** Naïves `import { INK }` ersetzt lokales `INK` — Code
greift auf `INK.green/.blue/.orange/.red/.soft/.paper` zu, aber DS-`INK`
hat `text/soft/mute/hairline/gridline/axis/green/clay/slate`. App-`INK.blue`
ist undefined → ECharts-Farbe `undefined` → Diagramm-Serien grau-default.
**Why it happens:** Beide Module nutzen denselben Namen `INK`, aber unter-
schiedliche Form (App=Rollen, DS=Tonklassen).
**How to avoid:** Import als `INK as DS_INK`, eigenes lokales `INK`-Objekt
aufbauen, das aus `PALETTE[*]` die App-Rollen mappt (siehe Phase-3-Adapter
oben). Klare Trennung im Code: `INK.green` (App-Rolle) vs. `DS_INK.text`
(DS-Tonklasse).
**Warning signs:** Diagramme rendern, aber Serien sind grau/schwarz statt
farbig. Console-Warnung über `undefined` color.

### Inline-`<head>`-Skript klassiert `<html>` statt `<body>` — DS-Regeln greifen trotzdem
**What goes wrong:** Manuell Markup-Tests erwarten `<body class="gat-mode-hc">`
und finden es nicht.
**Why it happens:** Im `<head>` existiert `<body>` noch nicht — `documentElement`
ist das einzig erreichbare Element. CSS-Selector `.gat-mode-hc body`
greift trotzdem (Ancestor-Match).
**How to avoid:** JS-Toggle setzt sowohl `body` als auch `documentElement` —
oder schreibt Tests gegen `documentElement.classList`.
**Warning signs:** Test `await expect(page.locator('body.gat-mode-hc')).toBeVisible()`
schlägt fehl, obwohl die Optik korrekt ist.

### `--web-page-max` als zweite Quelle der Wahrheit
**What goes wrong:** `dashboard.css` und `app.css` lesen unterschiedliche
Page-Max-Werte; Layout zerfließt.
**Why it happens:** Heute steht `--web-page-max` im `app.css :root` (Z. 163)
**außerhalb** des Token-Blocks. Es wird nur einmal in `app.css:166` benutzt
(`.page`). DS-Token ist `--gat-web-page-max` mit identischem Wert.
**How to avoid:** In Phase 1 die lokale Deklaration **löschen** und `.page`
auf `var(--gat-web-page-max)` umstellen.
**Warning signs:** `.page` und `.gat-header__inner` haben unterschiedliche
Innenbreite → linke Kante stimmt nicht überein.

### Stats-Grid umbenennen verfälscht die DS-Konvergenz
**What goes wrong:** Das `.stats`-Grid in `app.css:312-330` ist App-eigen
(4 Spalten responsive). Wird es zu `.gat-stats` falsch zugeordnet, bricht
das Layout, weil DS kein `.gat-stats` hat.
**Why it happens:** DS v2 hat `.gat-grid`/`.gat-grid--2`/`.gat-grid--3`,
aber kein 4-Spalten-Layout. App-`.stats` ist ein **App-spezifisches
Lagebild-Raster** — kein DS-Pendant.
**How to avoid:** `.stats`/`.stat`/`.stat-num`/`.stat-label`/`.stat-delta`/
`.stat-pk` bleiben **App-Klassen** (entweder mit altem Namen oder
umbenannt auf `.app-stats` etc.). Researcher-Empfehlung: Markup-Innenstruktur
auf `.gat-metric-card__num`/`.gat-metric-card__label` umstellen (das
liefert DS), aber das umschließende Grid `.stats` als App-Klasse belassen.
**Warning signs:** Lagebild-Karten in 1 Spalte oder ohne Akzent-Balken
oben.

### `index.html` `class="gat-header__logo web-brandbar__brand"` auf `<a>`-Element
**What goes wrong:** Falsche Verwendung der DS-Klasse `gat-header__logo` —
ist im DS v2 für das `<img>`-Element, nicht für das `<a>`. Migrations-
Such-Ersetz erkennt diese Asymmetrie nicht sicher.
**Why it happens:** In `index.html:21` steht heute `<a class="gat-header__logo
web-brandbar__brand">`. Beide Klassen aufs `<a>` ist falsch — `.gat-header__logo`
gehört im DS aufs `<img>`-Element.
**How to avoid:** Phase 2 stellt das Markup gemäß DS-MIGRATION.md auf
`<a class="gat-header__brand"> > <img class="gat-header__logo">` um —
**nicht** per Such-Ersetz, sondern Block-Replacement.
**Warning signs:** Logo-Höhe ändert sich nach Migration nicht (weil DS
`.gat-header__logo` auf `<img>` nicht greift, sondern auf den Wrapper-
Link). Schon im aktuellen Stand vorhandene Inkonsistenz — fällt erst
auf, wenn die lokale `.web-brandbar__logo`-Regel wegfällt.

### `app.css` lädt nach `dashboard.css`, aber DS-CSS lädt **vor** beiden
**What goes wrong:** Annahmen über CSS-Reihenfolge sind oft falsch.
**Why it happens:** `index.html:12-15` zeigt:
1. DS-CSS (CDN)
2. `dashboard.css` (vendor)
3. `app.css` (App)
Bei gleicher Spezifität gewinnt die spätere Regel → App-Regeln in `app.css`
und `dashboard.css` überdecken DS. Das ist die heutige Konstellation.
**How to avoid:** Nach jeder Phase visuell prüfen. Vermutung „DS-Default
greift" nur dann zutreffend, wenn lokale Regel **entfernt** ist.

### Tests asserten auf `data-typ-panel` mit `web-panel` Vorfix
**What goes wrong:** Phase-2-Commit lässt Tests rot werden, weil
`sparpotenzial.spec.mjs:27` `'section.web-panel[data-typ-panel="RA"]'`
sucht.
**Why it happens:** Selector verkettet Klasse mit Attribut.
**How to avoid:** Selector im selben Commit auf `'section.gat-panel[…]'`
ändern.
**Warning signs:** `npm run test:e2e` Sparpotenzial-Test schlägt fehl
mit „No elements".

### `data-typ-panel`-Attribute am `<section class="web-panel"…>` werden vergessen
**What goes wrong:** Markup wird auf `.gat-panel` umbenannt, aber die
`data-typ-panel="RA"` / `="VA"`-Attribute bleiben am Element (das ist
erwartet — App-spezifische Sichtbarkeitslogik). `dashboard.js` hookt
auf `data-typ-panel` per Querystring, nicht über die Klasse.
**Why it happens:** Mischen von Funktions-Attribut (`data-typ-panel`) und
Visualklasse (`gat-panel`).
**How to avoid:** Keine Aktion nötig — Attribute bleiben, Klasse ändert
sich. Test-Selector zieht nach.
**Warning signs:** Soll-Ist-Panels erscheinen bei VA-Dokumenten oder
verschwinden bei RA-Dokumenten.

### `ECharts`-Tooltip-Schatten: lokal vs. DS leicht unterschiedlich
**What goes wrong:** Tooltips sehen nach Phase 3 minimal anders aus.
**Why it happens:** Lokales `tip()` hat `box-shadow:rgba(31,38,28,.12)`
und `padding:[7,11]`; DS-`tip()` hat `rgba(31,38,28,.08)` und keinen
expliziten `padding`.
**How to avoid:** Akzeptieren (kleine Drift, unterhalb der 5 %-Snapshot-
Schwelle); oder lokal überschreiben durch Wrapper:
`const tip_app = (extra={}) => tip({ padding:[7,11], extraCssText:"box-shadow:0 4px 14px rgba(31,38,28,.12); border-radius:8px;", ...extra })`.
Researcher-Empfehlung: **DS akzeptieren** — Konvergenz vor App-Optik.
**Warning signs:** Visueller Snapshot-Diff in Tooltip-Bereichen.

### Inline-`<head>`-Block bricht beim `localStorage`-Zugriff (Privatmodus, manche Mobile-Browser)
**What goes wrong:** Boot-Fehler vor dem ersten Paint, weil
`localStorage.getItem` `SecurityError` wirft (Firefox-Privatmodus mit
strenger Cookie-Policy).
**Why it happens:** `localStorage` ist in manchen Kontexten gesperrt.
**How to avoid:** Try/catch um den `<head>`-Block. Fallback: HC-Mode
bleibt aus.
**Warning signs:** App lädt nicht, Console zeigt SecurityError.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm run test:js`, `npm run test:e2e`, `scripts/serve.mjs` | YES (Devshell vorhanden) | (siehe `package.json`) | — |
| Playwright | `npm run test:e2e`, Baseline-Snapshots | YES (`@playwright/test` als devDep deklariert) | `^1.60.0` | — |
| Chromium (Playwright-gebündelt) | e2e + Snapshots | YES (über `npx playwright install` oder Docker-Image) | passend zur Playwright-Version | — |
| Internet (DS-CSS + `gat-charts.js` + Logo + ECharts + Fonts CDN) | Migration und Run-Time | YES (lt. CLAUDE.md „Es gibt kein Offline-Ziel") | rolling | — |
| `documents/VA-2026-Auflage.pdf` | Snapshot-Fixture | YES (im Repo) | — | NVA-2025, RA 2024, RA-2025 vorhanden |
| `issue-cli check research` | RESEARCH.md-Validierung | YES (lt. Issue-Instruktion: läuft im Container) | — | — |

## Project Constraints (from CLAUDE.md)

Aus `/workspace/gemeindefinanzen/CLAUDE.md` (workspace) und Worktree-
CLAUDE.md (identisch):

- **Kein Vendoring, kein Offline.** Drittabhängigkeiten **per CDN** — gilt
  für ECharts, DS-CSS, `gat-charts.js`, Schriften. Begründung: geteiltes
  Browser-Caching, schlanke Deploys. **App und Seiten dürfen
  Internetverbindung voraussetzen.**
- **Vanilla JavaScript, ESM, kein Build-Schritt** für die ausgelieferte
  Seite.
- **Sprache: Deutsch** in UI-Texten und Code-Bezeichnern.
- **Keine Werkzeug-Attribution** in Commits/Code/Doku/Tests (kein
  „claude", kein „Generated with", kein Co-Authored-By).
- **Tests müssen grün bleiben:** `npm run test:js`, `PYTHONPATH=src pytest
  -q`, `ruff check src tests`, `mypy src`.
- **Deployment via GitHub Pages** (`.github/workflows/pages.yml`); jeder
  Push auf `main` deployt neu — Konsequenz: keine Build-Schritte für die
  Web-App, alles statisch.

Aus dem ISSUE.md / CONTEXT.md zusätzlich:

- **`web/vendor/dashboard/dashboard.js` ist tabu.**
- **Konsumenten-URL stabil:** `https://grueneat.github.io/design-system/
  design-system.css` bleibt im `<link>`. Kein Cache-Buster.
- **Funktionsklassen am Markup behalten:** `tab-btn`, `is-active`,
  `switch-btn`, `doc-status.ok`, `tab-panel`.

## Sources

### HIGH confidence

- `/workspace/design-system/design-system/.worktrees/cjpfs-rueckflusskandidaten-aus-gemeindefinanzen-web-adaption-iter-1-18/src/design-system.css` (Tailwind-v4-Source, 996 LOC, direkt gelesen) — alle DS-Tokens, Komponenten, A11y-Variant, Print/Reduce-Motion.
- `/workspace/design-system/design-system/.worktrees/cjpfs-rueckflusskandidaten-aus-gemeindefinanzen-web-adaption-iter-1-18/design-system.css` (gerendertes Output, 1 Zeile minifiziert) — bestätigt, dass alle DS-Selektoren auch im gehosteten Output enthalten sind.
- `/workspace/design-system/design-system/.worktrees/cjpfs-rueckflusskandidaten-aus-gemeindefinanzen-web-adaption-iter-1-18/gat-charts.js` (99 LOC, direkt gelesen) — alle Exports, Shape von INK, VA_DECAL-Werte.
- `/workspace/design-system/design-system/.worktrees/cjpfs-rueckflusskandidaten-aus-gemeindefinanzen-web-adaption-iter-1-18/MIGRATION.md` (240 LOC) — offizielles v1→v2-Migrations-Dokument, inkl. Brandbar-Vorher/Nachher und HC-Knopf-Beispiel.
- `/workspace/design-system/design-system/.worktrees/cjpfs-rueckflusskandidaten-aus-gemeindefinanzen-web-adaption-iter-1-18/CHANGELOG.md` — v2.0.0 Breaking Changes (Header, Hellgrün-Wert, Headline-Gewichte).
- `web/css/app.css` (1199 LOC, gelesen) — 26 lokale Tokens, alle App-Komponenten.
- `web/index.html` (756 LOC, gelesen) — Brandbar-Markup, alle Tab-Panels, Komponenten-Verwendungen.
- `web/js/app.js` (Z. 1-180 + grep) — Vollbild-Wiring auf `.web-panel*`.
- `web/js/dashboard-charts.js` (Z. 1-200 + 540-622 + 1420-1510 + grep) — alle lokalen Chart-Konstanten und ihre Verwendung.
- `web/js/sankey-drill.js` (grep + Z. 16-55) — lokale Konstanten.
- `web/vendor/dashboard/dashboard.css` (267 LOC, vollständig gelesen) — alle Tab-/Switch-/Tabellen-/Drill-/MJ-Regeln und ihre Token-Refs.
- `web/vendor/dashboard/dashboard.js` (grep) — Funktionsklassen-Vertrag.
- `tests/e2e/*.mjs` (grep + dashboard.spec gelesen) — Test-Selectors.

### MEDIUM confidence

- DS v2 ist **gemerged auf `main` der GitHub-Org** lt. ISSUE.md — der lokale
  Filesystem-Snapshot hat den Merge-Commit allerdings noch nicht auf `main`
  (das v2-Code ist im Worktree-Branch `issue/cjpfs-…`). Annahme: das ist
  ein Sync-Delay, kein blocker — die `<link>`-URL liefert v2 bereits live.
  **Verifikations-Schritt:** vor Phase 1 prüfen, ob
  `https://grueneat.github.io/design-system/design-system.css` v2-Inhalt
  liefert (curl + grep nach `--gat-web-bg` oder `gat-mode-hc`).

### LOW confidence (needs validation)

- Keine — die Migration ist eine reine Codebase-Operation; alle relevanten
  Werte sind direkt verifizierbar.

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Token-Inventur | HIGH | 26 Tokens beider Seiten direkt gelesen; alle Hex-Werte identisch |
| Komponenten-Mapping | HIGH | DS-Source-CSS und app.css-Regeln verglichen, 1:1-Kongruenz |
| `gat-charts.js`-Import-Surface | HIGH | ES-Modul-Exports gelesen, App-Verwendung gegrept |
| HC-Toggle-Wiring | HIGH | DS-MIGRATION.md-Beispiel + CONTEXT-Decision-3 + App-`app.js`-Stil — Lösung kanonisch |
| Test-Impact | HIGH | Alle Spec-Dateien gegrept, eine Stelle identifiziert |
| `dashboard.css`-Cleanup-Tiefe | MEDIUM | Empfehlung Tab-/Switch-Block raus; visuelle Verifizierung erst nach Phase 2-Commit möglich |
| `VA_DECAL`-Wert-Drift | MEDIUM | Lokal vs. DS-Werte abweichend; sichtbarer Effekt minimal — Empfehlung „akzeptieren", aber Snapshot zeigt es |
| `tip()`-Schatten-Drift | MEDIUM | Sichtbar minimal; Snapshot-Diff in Tooltip-Bereichen erwartbar |

**Research date:** 2026-05-23
**Sub-agents used:** Inline (Codebase + Ecosystem + Pitfalls in einer Sitzung — Migration ist klein genug, dass parallele Spawns Overhead wären; alle drei Bereiche direkt aus konkreten Dateien lesbar)
**Research files:** `.issues/vyz9q-…/RESEARCH.md` (kein separater `research/`-Subordner — Forschung war single-pass über konkrete Dateien)
