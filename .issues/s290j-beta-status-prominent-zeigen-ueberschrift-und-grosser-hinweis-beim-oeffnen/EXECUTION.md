# Execution: Beta-Status prominent zeigen — Ueberschrift und grosser Hinweis beim Oeffnen

**Started:** 2026-08-26T09:XX:XXZ
**Status:** complete
**Branch:** issue/s290j-beta-status-prominent-zeigen-ueberschrift-und-grosser-hinweis-beim-oeffnen

## Execution Log

- [x] Task 1: H1 traegt Beta, grosser DS-Callout ersetzt den kleinen Absatz — commit 37d2388
  - `web/index.html`: H1 liest jetzt "Gemeindebudget auswerten — Beta"; alter
    `<p class="app-beta-hinweis">` entfernt; neuer
    `<aside id="beta-hinweis" class="gat-callout gat-callout--warn">` als
    Seiten-Geschwister zwischen `</header>` (Ende `.gat-hero`) und `#toast-box`,
    also ausserhalb sowohl von `.gat-hero` als auch von `#doc-manager`.
  - `web/css/app.css`: `.app-beta-hinweis` / `.app-beta-hinweis strong` samt
    zugehoerigem Kommentarblock entfernt. `.app-beta-marker` (Logo-Stoerer) und
    die `@media print`-Hide-Liste byte-identisch belassen.
  - Kein Deviation — Plan wurde woertlich umgesetzt.
- [x] Task 2: Playwright-Spec fuer H1, Sichtbarkeit, Zuklapp-Fall und Druck — commit 0c9c159
  - `tests/e2e/beta-hinweis.spec.mjs` neu angelegt mit genau den vier Tests aus
    dem Plan (H1-Text, Sichtbarkeit + Kontakt beim Oeffnen, Sichtbarkeit nach
    Auto-Zuklappen der Dokumentverwaltung mit echtem Fixture-PDF, Sichtbarkeit
    im Druck-Modus mit `#doc-manager` als Kontrollprobe).
  - Deviation [Rule 3 - Blocker]: Playwright-Chromium war im Container nicht
    installiert (`browserType.launch: Executable doesn't exist`). Mit
    `npx playwright install chromium` nachinstalliert (reiner
    Umgebungs-Fix, keine Code-/Konfigurationsaenderung im Repo).
  - Alle 4 Tests gruen.
- [x] Task 3: Regressionsnetz — vollstaendige Suite gruen — kein Commit (reiner
  Verifikationslauf, wie im Plan vorgesehen)
  - `npm run test:e2e`: 57 passed, 27 skipped (Korpus-Tests sind umgebungsabhaengig
    per `test.skip`, unveraendert durch diese Aenderung), 0 failed.
  - `npm run test:js`: 143 bestanden, 0 fehlgeschlagen.

## Verification Results

**Playwright (`npm run test:e2e`):** 57 passed, 27 skipped, 0 failed — inkl. der
4 neuen `beta-hinweis`-Tests.
**Node-Unit-Tests (`npm run test:js`):** 143 bestanden, 0 fehlgeschlagen.
**Python-Pipeline (`PYTHONPATH=src pytest -q`):** 34 passed (siehe Hinweis unten
zur Testumgebung).
**mypy (`mypy src`):** Success: no issues found in 8 source files.
**ruff (`ruff check src tests`):** 6 vorbestehende Findings in
`src/gemeindefinanzen/parser.py` — siehe "Discovered Issues", ausserhalb des
Scopes dieses Issues (nur `web/` und `tests/e2e/` sind Scope; `src/` unveraendert).
**Task-1-Check (Python-Inline-Skript aus dem Plan):** `MARKUP-CHECK OK`,
`web/js unveraendert — ok`.
**Scope-Check:** `git diff --stat 4131488..HEAD` zeigt ausschliesslich
`web/index.html`, `web/css/app.css`, `tests/e2e/beta-hinweis.spec.mjs`.
**Attributions-Check:** `grep -rn "app-beta-hinweis" web/` und
`grep -in "claude|Generated with|Co-Authored-By" web/index.html web/css/app.css
tests/e2e/beta-hinweis.spec.mjs` — beide ohne Treffer.

## Deviations from Plan

### Auto-fixed (Rules 1-3)

1. **[Rule 3 - Blocker] Playwright-Chromium im Container nachinstalliert**
   - Gefunden bei: Task 2 (erster `npx playwright test`-Lauf)
   - Problem: `browserType.launch: Executable doesn't exist at
     /opt/playwright-browsers/chromium_headless_shell-1223/...` — der Browser
     war im Container-Image nicht vorhanden.
   - Fix: `npx playwright install chromium` ausgefuehrt. Reine
     Umgebungs-/Cache-Aktion (Browser-Binary unter `/opt/playwright-browsers/`),
     keine Aenderung an Repo-Dateien, `package.json` oder
     `playwright.config.mjs`.
   - Danach: alle 4 neuen Tests und die volle Suite (84 Tests, 57 nicht
     uebersprungen) liefen durch.

2. **[Rule 3 - Blocker] Python-Testlauf: isolierte `pytest`-Toolchain ohne
   PyMuPDF**
   - Gefunden bei: finale Verifikation (`PYTHONPATH=src pytest -q`)
   - Problem: Das global via `uv tool install` bereitgestellte `pytest`-Binary
     laeuft in einer eigenen, isolierten venv ohne `pymupdf` — Import von
     `fitz` in `src/gemeindefinanzen/extract.py` schlug fehl
     (`ModuleNotFoundError: No module named 'fitz'`). System-`python3` hat
     `pymupdf` zwar installiert, aber kein `pytest`-Modul. Dieses Problem ist
     unabhaengig von den Aenderungen dieses Issues (kein `src/`-File
     angefasst) — reines Container-Setup-Detail.
   - Fix: `uv run --with pymupdf --with pytest pytest -q` als Ersatzaufruf
     verwendet, der eine projektlokale `.venv/` mit den in `pyproject.toml`
     deklarierten Abhaengigkeiten aufbaut. `.venv/` ist bereits in
     `.gitignore` erfasst; das dabei erzeugte `uv.lock` wurde wieder entfernt
     (kein bestehendes Lockfile-Management in diesem Repo, kein Teil des
     Scopes). Ergebnis: 34 passed.
   - Nicht am Repo veraendert: `pyproject.toml`, `Makefile`, `requirements`
     bleiben unangetastet — dies ist ein reiner Verifikations-Workaround fuer
     die Container-Umgebung, keine Code-Aenderung.

### Blocked (Rule 4)

None.

## Discovered Issues

- `ruff check src tests` meldet 6 vorbestehende Findings in
  `src/gemeindefinanzen/parser.py` (u. a. `SIM102` nested-if). Bestaetigt
  vorbestehend: `src/` wurde in dieser Session nicht angefasst, die Findings
  existierten bereits vor diesem Issue. Ausserhalb des Scopes (Scope ist
  `web/` + `tests/e2e/`) — nicht gefixt, hier nur dokumentiert fuer ein
  separates Aufraeum-Issue.
- Der Container hat weder ein vorinstalliertes Playwright-Chromium noch ein
  `pytest` mit Zugriff auf die Projekt-Abhaengigkeiten (`pymupdf`) — beides mit
  lokalen Workarounds geloest (siehe Deviations oben), aber ein dauerhafter
  Fix (z. B. Playwright-Browser und passendes Python-Environment im
  Container-Image vorinstallieren) waere ein separates Infrastruktur-Thema,
  nicht Teil dieses Issues.

## Self-Check

- [x] Alle Dateien aus dem Plan existieren: `web/index.html`, `web/css/app.css`,
      `tests/e2e/beta-hinweis.spec.mjs`
- [x] Alle Commits existieren auf dem Branch (`git log --oneline` zeigt 37d2388,
      0c9c159 nach 4131488)
- [x] Volle Verifikations-Suite laeuft durch (Playwright, Node-Unit-Tests,
      Python-Pipeline, mypy gruen; ruff-Findings vorbestehend und ausserhalb
      Scope)
- [x] Keine Stubs/TODOs/Platzhalter in den geaenderten Dateien
      (`grep -n "TODO\|FIXME\|HACK\|XXX\|PLACEHOLDER"` ohne Treffer)
- [x] Kein Debug-Code (`console.log`, `debugger`) in den geaenderten Dateien
- **Ergebnis:** PASSED

**Completed:** 2026-08-26T10:10:00Z
**Duration:** ~40 min
**Commits:** 2 (Task 3 war reiner Verifikationslauf ohne eigenen Commit, wie im Plan vorgesehen)
