# Execution: Lokale Browser-Test-Infrastruktur fuer die Web-App

**Started:** 2026-05-22
**Status:** complete
**Branch:** issue/oh4sz-lokale-browser-test-infrastruktur-fuer-die-web-app

## Execution Log

- [x] Task 1: Test-Seam in dashboard.js fuer den Sankey-Drill-down — commit 50f19b9
- [x] Task 2: ECharts nach web/vendor/echarts/ vendoren — commit 6911b58
- [x] Task 3: Versionsstempel — #build-stamp im Footer + version.json laden — commit 40818e5
- [x] Task 4: pages.yml schreibt version.json beim Deploy — commit 82bebd5
- [x] Task 5: Playwright-Harness — Abhaengigkeit, Config, npm-Skript, Makefile, Doku — commit d0bce7d
- [x] Task 6: e2e-Specs — Smoke, Upload, Dashboard, Sankey, Persistenz, Build-Stempel — commit 1c452db
- [x] Task 7: Separater GitHub-Actions-Workflow fuer die Browser-Tests — commit d090817

## Verification Results

**e2e (Playwright):** 7/7 bestanden — zweimal hintereinander stabil gruen
  (smoke, upload, dashboard, sankey-drill, sankey-reset, persistence, build-stamp)
**JS-Tests (`npm run test:js`):** 52 bestanden, 0 fehlgeschlagen
**Python-Tests (`pytest -q`):** 28 passed
**ruff (`ruff check src tests`):** All checks passed
**mypy (`mypy src`):** Success, no issues in 8 source files
**node --check:** playwright.config.mjs, web/js/app.js,
  web/vendor/dashboard/dashboard.js — kein Syntaxfehler
**YAML:** e2e.yml und pages.yml valides YAML

## Sankey-Anlassfall — Diagnose

Der gemeldete "Sankey-Drill-down funktioniert nicht" wurde mit dem neuen
Harness deterministisch reproduziert. Ergebnis: **kein echter Bug in
dashboard.js**. Die Drill-Verdrahtung (`setupSankeyDrill` →
`drillAufKnoten` → `renderSankey` → `buildSankeyOption`) arbeitet korrekt —
ein aufgeklappter Knoten wird durch seine Unterposten ersetzt (z.B.
"Gebuehren & Leistungen" 17 → 25 Knoten). Der Anlassfall war ein veraltetes
Deployment (wie in RESEARCH.md bereits vermutet). Der neue Versionsstempel
in der Fusszeile macht stale Deployments ab sofort sofort erkennbar.

Beim ersten Testlauf zeigte sich nur eine Test-Schwaeche: der Spec waehlte
anfangs den ersten aufklappbaren Knoten — eine Einzelposten-Quelle, die 1:1
aufklappt und die Knotenzahl nicht aendert. Der Spec waehlt jetzt gezielt
einen Knoten mit mehreren Unterposten, damit die Wachstums-Assertion greift.

## Deviations from Plan

### Auto-fixed (Rules 1-3)

1. **[Rule 3 - Blocker] devDependency-Installation unter NODE_ENV=production**
   - Gefunden in: Task 5/6
   - Problem: Die Container-Umgebung setzt `NODE_ENV=production` und npm
     `omit=dev`; `npm install -D` legte den devDependency-Eintrag an, liess
     aber `node_modules/@playwright` ungenutzt — `playwright test` schlug fehl.
   - Fix: lokale Installation mit `NODE_ENV=development npm install
     --include=dev`. Betrifft nur die lokale Ausfuehrung — `package.json` /
     `package-lock.json` sind korrekt; CI (`npm ci`) hat dieses Problem nicht.

2. **[Rule 1 - Bug] Stale serve.mjs-Server auf Port 8080**
   - Gefunden in: Task 6
   - Problem: Ein frueherer Server-Prozess lieferte web/ aus `/workspace`
     (main-Checkout, ohne die neuen Aenderungen); Playwrights
     `reuseExistingServer` nutzte ihn und liess die Specs gegen veralteten
     Code laufen.
   - Fix: stale Server-Prozesse beendet. Kein Code-Change noetig — eine
     Umgebungsbereinigung, kein Plan-Fehler.

### Abweichungen vom `<verify>`-Wortlaut (kosmetisch)

3. **Task 2 Verify — `head -c 200 | grep -qi echarts`**
   - Die ersten 200 Byte von `echarts.min.js` sind reiner Apache-Lizenzkopf
     ohne das Wort "echarts". Die Datei ist echtes ECharts 5.5.1 (~1 MB,
     enthaelt "echarts" und "5.5.1"). Verifiziert mit `head -c 4000` statt
     `head -c 200` — inhaltlich identische Pruefung, nur groesseres Fenster.

4. **Verification-Block — `ruff`/`mypy`-Pfad**
   - Im `/tmp/pdfvenv` sind ruff/mypy nicht installiert; verwendet wurden
     `/root/.local/bin/ruff` und `/root/.local/bin/mypy`. Beide sauber.

### Blocked (Rule 4)

Keine.

## Discovered Issues

- Die Spec-Helfer mussten explizit auf die Reload-Navigation nach dem Upload
  warten — `window.__appBereit` allein ist als Bereitschaftssignal nicht
  ausreichend, weil es bereits vor dem `location.reload()` true ist und
  `dashboard.js` zudem asynchron als `<script>` nachgeladen wird. Geloest
  ueber `waitForNavigation` + Warten auf `window.__sankeyDrill`. Kein
  Produktiv-Bug, aber ein wiederkehrender Stolperstein fuer kuenftige Specs.

## Self-Check

- [x] Alle Plan-Dateien existieren (echarts.min.js, version.json,
      playwright.config.mjs, e2e.yml, tests/e2e/*)
- [x] Alle 7 Task-Commits liegen auf dem Branch
- [x] Vollstaendige Verifikation gruen (e2e 7/7, JS 52, Python 28, ruff,
      mypy, YAML)
- [x] Keine Stubs/TODOs/Platzhalter in neuen Dateien
- [x] Kein Debug-Code (console.log/debugger) in neuen Dateien
- **Ergebnis:** PASSED

**Completed:** 2026-05-22
**Commits:** 7 (Tasks) + 1 (EXECUTION.md)
