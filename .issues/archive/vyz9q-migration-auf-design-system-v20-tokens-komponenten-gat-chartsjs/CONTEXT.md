# Design Decisions — vyz9q

Captured before research/plan. Researcher and planner must follow.

## Decisions (locked)

### 1. Migrations-Reihenfolge: 5 Phasen

Jede Phase ist ein eigener Commit auf der Feature-Branch, jeweils mit gruener
Test-Suite und visueller Stichprobe am Ende der Phase. Snapshots erst zu
Beginn (Baseline) und ganz am Schluss (Compare) — nicht zwischendurch.

1. **Phase 1 — Tokens.** `web/css/app.css`: lokale `--web-*`-Schicht
   ausbauen. Jeder Token, dessen Wert im DS unter `--gat-web-*` exakt vorhanden
   ist, wird ausgetauscht. Werte, die im DS nicht 1:1 vorkommen, werden in
   `--app-*`-Namespace verschoben (kein `--web-*` mehr). Reine CSS-Aenderung,
   minimaler visueller Impact.

2. **Phase 2 — Komponenten.** Markup und CSS umstellen:
   `.web-panel` → `.gat-panel`, `.metric-card` → `.gat-metric-card`,
   `.web-callout` → `.gat-callout`, `.web-section-head` → `.gat-section-head`,
   `.web-hero` → `.gat-hero`. `.web-brandbar*`-Overrides entfernen — DS v2.0
   `.gat-header` ist jetzt selbst weisse Brandbar. Verbleibende
   lokal-spezifische `.web-*`-Klassen (z. B. App-spezifische Layouts, die das
   DS nicht abdeckt) zu `.app-*` umbenennen.

3. **Phase 3 — Charts.** `gat-charts.js` per CDN-Import in
   `web/js/dashboard-charts.js` und `web/js/sankey-drill.js` einziehen.
   Lokale Konstanten (`PALETTE`, `INK`, `LABEL_SIZE`, `AXIS_SIZE`,
   `BAR_MAX_DICHT`, `BAR_MAX_WEIT`, `VA_DECAL`, Helfer `tip`/`legende`/
   `grid`/`planIstLegende`) ausbauen. `dashboard.js` (vendor) bleibt tabu.

4. **Phase 4 — A11y `.gat-mode-hc`-Toggle.** UI-Knopf in der Brandbar, rechts
   neben der Nav-Liste. **Icon + Label „Kontrast"**, `<button class=
   "gat-header__a11y-toggle">`. ARIA `aria-pressed="true|false"`.
   `localStorage`-Key `gat-mode-hc` (`"1"` / `""`). Initial-State aus
   localStorage; Klick toggelt `<body>`-Klasse `gat-mode-hc` und
   `localStorage`. **Keine** JS-Abhaengigkeit aus dem DS — App implementiert
   den Knopf, DS liefert nur Variant + Komponenten-Overrides.

5. **Phase 5 — Doku.** `docs/web-design-system.md` bekommt **Iteration 19**:
   Abschluss-Eintrag mit Migrations-Zusammenfassung, Hinweis dass das
   Dokument ab hier historisch ist, neue Konventionen leben im DS-Repo.

### 2. Visuelle Regression: Pre-Baseline + Final-Compare

- **Vor Phase 1:** Playwright/Chromium-Screenshots aller 7 Tabs + Landing
  bei 1440px (Fixture-PDF `VA-2026-Auflage.pdf`) — abgelegt in
  `.issues/vyz9q-…/screenshots/baseline/`.
- **Nach Phase 5:** dieselben Screenshots — abgelegt in
  `.issues/vyz9q-…/screenshots/after/`.
- Pixel-Diff via Playwright-`expect.toHaveScreenshot()` oder manuelles
  Diff-Tool. **Erlaubt:** kleine Pixel-Drift in DS-bewussten Stellen
  (Brandbar, Komponenten — bis ~5 %). **Nicht erlaubt:** Layout-Brueche,
  abgeschnittene Texte, gebrochene Charts.
- Zwischen-Phasen-Snapshots **nicht** ziehen — zu viel Pflege fuer den
  Marginalwert.

### 3. `.gat-mode-hc`-Toggle UX

- Position: in `<nav class="gat-nav">` der Brandbar, **rechts** in der Liste
  als letzter Eintrag (oder als eigenes `<button>` neben der `<ul>`).
- Form: **Icon + Label „Kontrast"** (deutsch).
- Icon: schlichtes SVG (Halbmond/Sonne oder Kontrast-Symbol — Researcher
  entscheidet, kein Logo-Vendoring noetig, Icon ist trivial inline).
- ARIA: `aria-pressed="true|false"`, dynamisch aktualisiert.
- localStorage-Key: **`gat-mode-hc`** (`"1"` aktiv, leer/`null` inaktiv).
- Initialisierung: `<head>`-Inline-Skript liest localStorage und setzt
  `<body class="gat-mode-hc">` **vor** dem ersten Render — verhindert
  Flash-Of-Wrong-Theme.

### 4. Verbleibende `.web-*`-Klassen → `.app-*`

App-spezifische Layout-Klassen, die das DS nicht abdeckt, werden umbenannt.
Klare Namespace-Trennung: `.gat-*` = DS, `.app-*` = lokal.

Liste der vermuteten Kandidaten (Researcher prueft):
- `.web-shell` → ? (DS hat `.gat-container`/`.gat-section` — pruefen, ob
  ersetzbar; sonst `.app-shell`)
- `.web-callout`-Inhalt-Variant-Klassen, falls App welche definiert
- `.web-section-head`-Spezifika, falls vorhanden

Wenn ein Klassennamen-Wechsel viele Markup-Stellen anfasst, in Phase 2
mitziehen.

## Claude's Discretion (research/planner may decide)

- **Wert-Drift zwischen lokalen `--web-*` und upstream `--gat-web-*`**:
  Researcher vergleicht exakte Hex-Werte. Falls die App z. B.
  `--web-bg: #f3f5f0` hat und das DS `--gat-web-bg: #f4f6f1` oder
  aehnliches, **App-Wert ans DS angleichen** — der DS-Wert ist die neue
  Quelle. Wenn ein bevorzugter App-Wert sinnvoll ware, **Folge-Issue im
  DS-Repo** und vorerst App-Wert mit Kommentar belassen.
- **CSS-Cleanup-Tiefe.** `web/css/app.css` ist 1199 Zeilen. Wie viel kann
  weg, wenn die DS-Komponenten alles abdecken? Researcher schaetzt, Planner
  schneidet Tasks.
- **Vendor-CSS-Touch.** `web/vendor/dashboard/dashboard.css` enthaelt
  visuelle Ueberschreibungen fuer Tabs/Tabellen/Drill. Falls die
  DS-Defaults reichen, koennen viele Regeln dort weg. **Aber:** das ist
  vendorisiertes CSS — pruefen, ob das Repo ein Update-Pattern hat (z. B.
  Patch-File) oder die Datei wie eigener Code behandelt wird.
- **Folder-Tab-Optik im DS?** DS v2 liefert `.gat-tab`/`.gat-tabbar`. Ob
  die heute angepasste Folder-Tab-Optik (gruene Unterkante, Inset-Schatten
  beim aktiven Reiter) Default ist oder lokal erhalten bleiben muss —
  Researcher prueft im DS-CSS.

## Deferred (out of scope)

- **Iter-19-Naming-Sweep.** Klassen-Refactor ueber den unbedingt noetigen
  Umfang hinaus (z. B. `.is-active` → `.gat-is-active`). Funktionsklassen
  bleiben wie sie sind.
- **Komplettes Vendor-CSS-Refactor.** Nur Stellen anfassen, die durch die
  Migration zwingend beruehrt werden.
- **Visueller Redesign-Sweep.** Wenn DS v2 etwas anders aussieht als die
  App heute (z. B. anderer Hellgruen-Ton), wird das **uebernommen**, nicht
  diskutiert. Brand-Diskussionen kommen im DS-Repo, nicht hier.

## Constraints (recap)

- **`web/vendor/dashboard/dashboard.js` ist tabu.** Wird nicht editiert.
- **Kein Vendoring.** Alle Drittabhaengigkeiten weiter per CDN (DS-CSS,
  DS-Logo, `gat-charts.js`).
- **Keine Werkzeug-Attribution** in Commits/Code/Doku.
- **Konsumenten-URL stabil:** `https://grueneat.github.io/design-system/
  design-system.css` bleibt im `<link>`. Kein Cache-Buster — Last-Modified
  reicht.
- **Tests muessen gruen bleiben:** `npm run test:js` 61/61, `npm run
  test:e2e` 7/7. Falls ein Test eine alte `.web-*`-Klasse oder einen
  alten `--web-*`-Token erwartet, **Test aktualisieren** — nicht
  Migration aushebeln.
- **Funktionsklassen am Markup behalten:** `tab-btn`, `is-active`,
  `switch-btn`, `doc-status.ok`, `tab-panel` — `dashboard.js` haengt
  daran.
