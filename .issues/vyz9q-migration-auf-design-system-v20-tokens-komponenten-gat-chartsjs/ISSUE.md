---
id: vyz9q
title: Migration auf design-system v2.0 (Tokens, Komponenten, gat-charts.js)
status: open
priority: medium
labels:
- migration
- design-system
---

Folge-Issue aus `grueneat/design-system#11` (siehe https://github.com/GrueneAT/design-system/pull/12, gemerged 2026-05-23 als `v2.0.0`). Die App konsumiert die gehostete CSS jetzt automatisch in v2 — dieses Issue raeumt die Doppel-Pflege auf und schliesst die Konvergenz ab.

## Hintergrund

Das org-weite DS hat eine **`--gat-web-*`-Schicht** bekommen, die exakt das macht, was wir hier lokal als `--web-*` gepflegt haben (Iterationen 1–18 in `docs/web-design-system.md`). Es liefert zusaetzlich `.gat-panel`/`.gat-metric-card`/`.gat-callout`/`.gat-section-head`/`.gat-hero`/`.gat-tag`/`.gat-skiplink`/`.gat-tabbar`/`.gat-switcher`-Komponenten, einen `gat-mode-hc:` A11y-Variant, gemeinsame `:focus-visible`/`prefers-reduced-motion`/`@media print`-Patterns, und ein gehostetes `gat-charts.js` ES-Modul mit Chart-Konstanten und ECharts-Helfern.

Heute pflegt diese App alles parallel in `web/css/app.css` (1199 Zeilen, 29 `--web-*`-Tokens) und `web/js/dashboard-charts.js` (lokale `LABEL_SIZE`/`BAR_MAX_*`/Palette). Doppel-Pflege. Konvergenz ist ueberfaellig.

## Migrations-Aufgabe

**Volle Migration in einer Welle** (User-Entscheidung), nicht gestaffelt.

### Tokens
- Lokale `--web-*`-Schicht in `web/css/app.css` ausbauen — jeder lokale Token bekommt sein `--gat-web-*`-Pendant aus dem upstream DS.
- Wo Werte abweichen: pruefen, welcher Wert der bessere ist. Bei Drift: Wert ins DS pushen (separates kleines Folge-Issue im DS-Repo) oder lokalen Wert ans DS angleichen.
- Verbleibende lokale Tokens, die das DS nicht abdeckt, behalten — aber explizit als `--app-*` (nicht `--web-*`) markieren, damit der Namespace-Bruch klar ist.

### Komponenten
- `.web-panel` → `.gat-panel` (Markup + CSS-Klasse umstellen, lokale `.web-panel`-Regeln in `app.css` entfernen).
- `.metric-card` → `.gat-metric-card` (inkl. Akzent-Modifier `--ertrag`/`--aufwand`/`--netto`/`--hero`).
- `.web-callout` → `.gat-callout`.
- `.web-section-head` → `.gat-section-head`.
- `.web-hero` → `.gat-hero`.
- **Brandbar:** lokale `.web-brandbar*`-Overrides (`.web-brandbar`, `.web-brandbar__brand`, `.web-brandbar__logo`, `.web-brandbar__nav`, `.web-brandbar__nav-current`, `.web-brandbar__nav-list`, `.web-brandbar__wordmark`) entfernen — DS v2 liefert `.gat-header` jetzt als weisse Brandbar im gruene.at-Stil. Markup wechselt auf `<header class="gat-header">`.
- **Tabs/Switcher:** die heutigen `.tab-btn`/`.tabs`/`.switch-btn`/`.switcher` sind teils Funktionsklassen, teils visuell. Visuelle Ueberschreibungen in `web/vendor/dashboard/dashboard.css` koennen weg, wenn die DS-`.gat-tab*`/`.gat-switch*`-Defaults passen. **Funktionsklassen** (`is-active`, `tab-btn` als Event-Anker fuer `dashboard.js`) bleiben — `dashboard.js` wird **nicht** angefasst.
- `.web-skiplink` (heute nicht vorhanden) — neuen `.gat-skiplink` zu Beginn des Body einfuegen.

### A11y
- `.gat-mode-hc`-Toggle-Knopf in die Brandbar einbauen (DS liefert die Variant, der Knopf bleibt App-Sache). Klick toggelt `<body>`-Klasse `gat-mode-hc`. State im `localStorage` persistieren.
- Lokale `:focus-visible`-Regeln in `app.css` durch DS-Defaults ersetzen, wo deckungsgleich.
- Lokaler `prefers-reduced-motion`-Block: pruefen, was das DS abdeckt; dupliziertes raus.
- Lokales `@media print`-Stylesheet: pruefen, was das DS abdeckt; dupliziertes raus, app-spezifisches bleibt.

### Charts (`gat-charts.js`)
- Per CDN importieren: `import { PALETTE, INK, LABEL_SIZE, AXIS_SIZE, BAR_MAX_DICHT, BAR_MAX_WEIT, VA_DECAL, tip, legende, grid, planIstLegende } from "https://grueneat.github.io/design-system/gat-charts.js";` in `web/js/dashboard-charts.js`.
- Lokale Konstanten (Palette-Array, `LABEL_SIZE = 15`, `AXIS_SIZE = 14`, `BAR_MAX_DICHT = 56`, `BAR_MAX_WEIT = 130`, `VA_DECAL`, Helfer `tip()`/`legende()`/`grid()`/`planIstLegende()`) entfernen.
- `web/js/sankey-drill.js` analog migrieren.
- Smoke-Test: alle Diagramme rendern visuell gleich (Screenshot-Diff per Playwright).

### Doku
- `docs/web-design-system.md` bekommt eine Abschluss-Iteration 19, die festhaelt: "Lokale Schicht in DS v2.0 zurueckgeflossen, App migriert; das Dokument ist ab hier historisch — neue Konventionen leben im DS-Repo."
- `web/vendor/LIZENZEN.md`: ggf. `gat-charts.js` ergaenzen.

## Akzeptanzkriterien

- [ ] `grep -E "^\s*--web-" web/css/app.css` liefert 0 oder nur explizit verbleibende App-Tokens (umbenannt zu `--app-*`).
- [ ] `grep -rE "\.web-(brandbar|panel|callout|section-head|hero)" web/css web/index.html` liefert 0 (Komponenten umgestellt).
- [ ] `import.*gat-charts\.js` in `dashboard-charts.js` und `sankey-drill.js` vorhanden; lokale Chart-Konstanten entfernt.
- [ ] `.gat-mode-hc`-Toggle in der Brandbar funktioniert (Klick wechselt Body-Klasse + localStorage).
- [ ] **Tests gruen:** `npm run test:js` 61/61, `npm run test:e2e` 7/7.
- [ ] **Visuelle Regression:** Playwright-Screenshots fuer alle 7 Tabs + Landing bei 1440px gegen einen Pre-Migration-Snapshot. Erlaubt: <5% Pixel-Diff in echten DS-Stellen (Brandbar, Komponenten). NICHT erlaubt: Layout-Brueche, abgeschnittene Texte, gebrochene Charts.
- [ ] `web/index.html` und alle Verweise auf `grueneat.github.io/design-system/design-system.css` unveraendert (Konsumenten-URL stabil).
- [ ] `web/vendor/dashboard/dashboard.js` unangetastet (Vendor-Code).
- [ ] Keine Werkzeug-Attribution in Commits/Code/Doku (`grep -rE "claude|Generated with|Co-Authored-By"` liefert 0).
- [ ] Kein neues Vendoring — `gat-charts.js` per CDN, nicht ins Repo kopiert.
- [ ] `docs/web-design-system.md` hat Iteration-19-Abschnitt mit Migrationszusammenfassung.

## Constraints

- **`web/vendor/dashboard/dashboard.js` ist tabu.** Funktionsklassen (`.tab-btn`/`.tab-panel`/`is-active`/`.switch-btn`/`span.doc-status.ok`) bleiben am Element, damit das Dashboard-JS weiter funktioniert.
- **Kein Vendoring.** Alle Drittabhaengigkeiten weiter per CDN (DS-CSS, DS-Logo, `gat-charts.js`).
- **Keine Werkzeug-Attribution.**
- **Konsumenten-URL stabil:** `https://grueneat.github.io/design-system/design-system.css`.

## Hinweise

- Quelle der lokalen Tokens, die jetzt im DS sind: `docs/web-design-system.md` Iterationen 1–18 plus die `gruene.at`-Analyse aus dem DS-Issue. Die meisten lokalen Werte sind 1:1 ins DS uebergegangen, nur Token-Praefixe aendern sich (`--web-*` → `--gat-web-*`).
- DS v2.0 release notes: siehe `https://github.com/GrueneAT/design-system/blob/main/CHANGELOG.md` und `MIGRATION.md`.
- Hellgruen-Hinweis: Das DS hat `--gat-color-hellgruen` von `#56af31` auf `#3e8a25` gehaertet. Falls die App diese Farbe direkt nutzt: pruefen, ob die Aenderung wahrnehmbar wird.
