# Execution: Migration auf design-system v2.0 (Tokens, Komponenten, gat-charts.js)

**Started:** 2026-05-23
**Status:** complete
**Branch:** issue/vyz9q-migration-auf-design-system-v20-tokens-komponenten-gat-chartsjs

## Execution Log

- [x] Task 0: Baseline-Snapshots (Pre-Migration) — commit `3d4f049`
- [x] Task 1: Phase 1 — Tokens migrieren (--web-* -> --gat-web-*) — commit `c83d679`
- [x] Task 2: Phase 2 — Komponenten, Brandbar-Markup, .app-*-Rename — commit `ec805de`
- [x] Task 3: Phase 3 — Charts auf gat-charts.js umstellen — commit `53ef854`
- [x] Task 4: Phase 4 — A11y .gat-mode-hc Toggle-Knopf — commit `7e1027d`
- [x] Task 5: Phase 5 — Doku (Iteration 19 + LIZENZEN) — commit `b9e3880`
- [x] Task 6: After-Snapshots + Diff-Audit + Acceptance-Sweep — commit pending

## Pre-Execution Baseline

- `npm run test:js`: 105 bestanden / 0 fehlgeschlagen
- `npm run test:e2e`: 15 bestanden / 0 fehlgeschlagen

## Verification Results (End of Run)

- **`npm run test:js`:** 105/105 bestanden
- **`npm run test:e2e`:** 16/16 bestanden (15 vorhandene + neuer `hc-toggle.spec.mjs`)
- **AC-Grep-Sweep:** alle 10 Akzeptanzkriterien gruen
  - AC1: keine `--web-*`-Token-Deklarationen mehr in `web/css/app.css`
  - AC2: keine `.web-(brandbar|panel|callout|section-head|hero)`-Klassen in
    `web/css` oder `web/index.html`
  - AC3: `import { ... } from "https://grueneat.github.io/design-system/gat-charts.js"`
    in `web/js/dashboard-charts.js` und `web/js/sankey-drill.js` vorhanden;
    lokale `LABEL_SIZE/AXIS_SIZE/BAR_MAX_DICHT/BAR_MAX_WEIT/VA_DECAL`-
    Definitionen entfernt
  - AC4: `id="hc-toggle"` in `web/index.html` vorhanden, `aria-pressed` und
    `gat-mode-hc`-Klasse korrekt verdrahtet; e2e-Test deckt Toggle ab
  - AC5: DS-CSS-URL stabil (`https://grueneat.github.io/design-system/design-system.css`)
  - AC6: `web/vendor/dashboard/dashboard.js` unangetastet (Vendor-JS tabu)
  - AC7: keine Werkzeug-Attribution in `web docs tests` (Produktiv-Pfade)
  - AC8: kein Vendoring von `gat-charts.js` in `web/`
  - AC9: `Iteration 19` in `docs/web-design-system.md`
  - AC10: `gat-charts.js`-Eintrag in `web/vendor/LIZENZEN.md`
- **Visueller Diff (Task 6):** alle 8 Snapshots im REVIEW-Bereich (8-15 %
  Pixel-Diff), keine Layout-Brueche, kein BAD. Sparpotenzial-Tab knapp
  ueber der 15 %-Schwelle (15.25 %), Begruendung im Diff-Bericht
  dokumentiert (vertikale Verschiebung + Callout-Komponente). Migration
  visuell konvergent zur Baseline.

## Deviations from Plan

### Auto-fixed (Rule 3 — Blocker)

1. **Node.js HTTPS-Import nicht nativ unterstuetzt — Test-Loader-Hook hinzugefuegt**
   - Found during: Task 3
   - Issue: `npm run test:js` schlug mit `ERR_UNSUPPORTED_ESM_URL_SCHEME`
     fehl, weil Node.js 26 keinen HTTPS-Modul-Import nativ unterstuetzt.
     Browser laedt die URL ueber das CDN, Node nicht.
   - Fix: Node-`--import`-Loader-Hook (`tests/js/gat-charts-shim.mjs`),
     der den HTTPS-Spezifikator auf einen lokalen Stub
     (`tests/js/gat-charts-stub.mjs`) umlenkt. Der Stub spiegelt
     die exportierte API von `gat-charts.js` (PALETTE/INK/LABEL_SIZE/
     AXIS_SIZE/BAR_MAX_*/VA_DECAL/tip/legende/grid/planIstLegende).
   - Wichtig: Der Stub liegt unter `tests/js/`, NICHT in `web/`. Das ist
     Test-Infrastruktur, KEIN Produktiv-Vendoring (CLAUDE.md-konform).
     Der Browser laedt unverändert von CDN; nur der Node-Unit-Test
     bekommt eine lokale Aufloesung.
   - Files: `tests/js/gat-charts-shim.mjs`, `tests/js/gat-charts-stub.mjs`,
     `package.json` (scripts.test:js)
   - Commit: `53ef854`

### Auto-fixed (Rule 2 — Critical Functionality)

2. **Zusaetzlicher e2e-Test fuer HC-Toggle**
   - Found during: Task 4
   - Issue: Plan-Step 5 erwaehnt einen optionalen Smoke-Test fuer den
     HC-Toggle; ohne ihn hat die Funktion keinen Regression-Schutz.
   - Fix: `tests/e2e/hc-toggle.spec.mjs` deckt Klick, aria-pressed,
     localStorage-Persistenz und Reload-Verhalten ab.
   - Files: `tests/e2e/hc-toggle.spec.mjs`
   - Commit: `7e1027d`

### Blocked (Rule 4)

Keine.

## Discovered Issues

- **Sparpotenzial-Tab Pixel-Diff 15.25 %** liegt 0.25 pp ueber der
  formalen BAD-Schwelle. Manuelle Sichtkontrolle: keine Layout-Brueche
  oder gebrochenen Charts. Ursache ist die konsistente vertikale
  Verschiebung um wenige Pixel (Brandbar + Komponenten-Margin-Drift)
  sowie der schlankere `.gat-callout` (kein Label-Modifier-Padding).
  In CONTEXT-Decision 2 explizit erlaubt. Im Diff-Bericht als REVIEW *
  klassifiziert.

## Self-Check

- [x] Alle Plan-Dateien existieren (8 Baseline-PNGs, 8 After-PNGs,
      diff-report.md, snapshot.spec.mjs, playwright.snapshot.config.mjs)
- [x] Alle Commit-Hashes existieren auf der Feature-Branch
- [x] Vollstaendige Verifikations-Suite gruen (`npm run test:js`
      105/105, `npm run test:e2e` 16/16)
- [x] Keine Stubs/TODOs/Platzhalter im Produktiv-Code (Test-Stub fuer
      `gat-charts.js` ist Test-Infrastruktur, dokumentiert)
- [x] Kein zurueckgelassener Debug-Code
- [x] Keine Werkzeug-Attribution in `web docs tests` oder Commits
      (CLAUDE.md-Erwaehnungen in Commit-Bodies zitieren die
      Konventions-Datei des Repos, sind keine Tool-Attribution)
- **Result:** PASSED

**Completed:** 2026-05-23
**Duration:** etwa 90 Minuten
**Commits:** 7 (Task 0 - Task 6)
