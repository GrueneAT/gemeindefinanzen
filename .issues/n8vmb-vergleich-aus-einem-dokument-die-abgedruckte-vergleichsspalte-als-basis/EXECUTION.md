# Execution: Vergleich aus einem Dokument — die abgedruckte Vergleichsspalte als Basis

**Started:** 2026-09-28T14:30:00Z (geschaetzt anhand des ersten Commits)
**Status:** complete
**Branch:** issue/n8vmb-vergleich-aus-einem-dokument-die-abgedruckte-vergleichsspalte-als-basis

## Execution Log

- [x] Task 1: Interne Basis in der Engine — Sentinel, Klon, Beschriftungsregel, Hinweis — commit `f65d156`
- [x] Task 2: kontrolle() korrigieren — falsche RA-Begruendung weg, RA-Soll zulassen — commit `ded1fdc`
- [x] Task 3: Vorbelegung — die interne Spalte gewinnt (D1) in standardVergleich — commit `d499075`
- [x] Task 4: Oberflaeche — Sichtbarkeit, Auswahl, Beschriftung, Kontroll-Panel — commit `3277fc7`
  - Deviation: [Rule 1 - Bugfix] Zwei der vier vom Plan angepassten e2e-Tests
    ("Richtungstausch"/"Tausch..." und "Kontrolle...") nutzten
    `page.locator('#vgl-a option', { hasText: 'VA 2026' })`, um die
    VA-2026-Option zu finden. Da der neue interne Eintrag ebenfalls
    "VA 2026" im Label traegt ("VA 2026 (laut NVA)"), matchte der
    ungeankerte `hasText`-Substring-Filter zuerst den internen Eintrag
    statt der echten Dokument-Option — beide Tests scheiterten beim
    ersten Lauf. Behoben durch einen ankerten Regex `/^VA 2026$/`, der
    nur exakt "VA 2026" trifft.
- [x] Task 5: Neue e2e-Belege — ein Dokument, interne Vorbelegung, OH-CSV, CSV-Name — commit `a28f467`
  - Deviation: [Rule 1 - Bugfix] Der Test fuer "nur OH-CSV-Paar" pruefte
    zunaechst `.vgl-leer` mit `toBeVisible()`. Das Tab-Panel selbst ist im
    inaktiven Zustand (Tab nie angeklickt, weil der Tab-Knopf verborgen
    ist) per CSS unsichtbar — der Hinweis existiert im DOM, ist aber nicht
    "sichtbar" im Playwright-Sinn. Auf `toBeAttached()` umgestellt, was dem
    Plan-Wortlaut "vorhanden" entspricht.
- [x] Task 6: Dokumentation nachziehen und Gesamtlauf — commit `5adf879`

## Verification Results

**npm run test:js:** 224 bestanden, 0 fehlgeschlagen (Baseline vor dem Issue: 185)

**npx playwright test (komplette Suite):** 70 passed, 27 skipped (korpus-*-Suiten,
gate-gesteuert und unveraendert von diesem Issue), 0 failed

**PYTHONPATH=.../site-packages:src pytest -q:** 34 passed, 0 failed
(`pytest`-Binary lag unter `/root/.local/bin/pytest`, nicht im venv-`site-packages`
selbst installiert — mit der vorgegebenen `PYTHONPATH` funktionierte der Aufruf
exakt wie angegeben)

**ruff check src tests:** 6 Findings, alle in `src/gemeindefinanzen/parser.py`
(SIM102/SIM103-Stil, verschachtelte `if`). `git diff main..HEAD --stat -- src/`
ist leer — `src/` wurde in keinem Commit dieses Issues angefasst, die Findings
sind identisch zu main und bleiben unangetastet (wie im Auftrag vorgegeben).

**mypy src:** `Success: no issues found in 8 source files`

**Dual-Runner-Gate (Python):** nicht ausgeloest — kein Python-Testfile
hinzugefuegt oder veraendert (`src/` und `tests/*.py` sind in keinem Commit
dieses Issues enthalten). Zur Kontrolle trotzdem `python3 -m unittest discover
tests -q` laufen lassen: schlaegt fehl mit `ModuleNotFoundError: No module
named 'pytest'` in `tests/test_parser.py:12` — das ist ein **Bestandsbefund**,
unabhaengig von diesem Issue (Datei nicht angefasst, Fehler bereits vor
Sessionbeginn vorhanden). Siehe "Discovered Issues".

**Task-Verifikationen (aus den `<verify>`-Bloecken):**
- Task 1: `npm run test:js` gruen — bestanden
- Task 2: `npm run test:js` gruen **und** `! grep -n "aus dem Seitenkopf nicht zu
  entscheiden\|aus dem Seitenkopf nicht entscheiden" web/js/vergleich-daten.js`
  liefert keinen Treffer — bestanden
- Task 3: `npm run test:js` gruen — bestanden
- Task 4: `npm run test:js` **und** `npx playwright test tests/e2e/vergleich.spec.mjs`
  gruen — bestanden
- Task 5: `npx playwright test tests/e2e/vergleich.spec.mjs tests/e2e/csv-upload.spec.mjs`
  gruen (14 Tests) — bestanden
- Task 6: die zusammengesetzte Verify-Kette (grep-Ausschluss + `laut RA`/`laut NVA`
  vorhanden + npm/playwright/pytest/ruff/mypy) lief vollstaendig durch — bestanden

## Deviations from Plan

### Auto-fixed (Rules 1-3)

1. **[Rule 1 - Bugfix] e2e-Selektor fuer die VA-2026-Option praezisiert**
   - Gefunden bei: Task 4 (Verifikation der angepassten e2e-Tests)
   - Problem: `{ hasText: 'VA 2026' }` matchte per Substring auch den neuen
     internen Auswahl-Eintrag "VA 2026 (laut NVA)"
   - Fix: `{ hasText: /^VA 2026$/ }` (ankerter Regex)
   - Dateien: `tests/e2e/vergleich.spec.mjs`
   - Commit: `3277fc7`

2. **[Rule 1 - Bugfix] Sichtbarkeits-Assertion im OH-CSV-Test auf `toBeAttached()` umgestellt**
   - Gefunden bei: Task 5
   - Problem: `.vgl-leer` liegt im inaktiven (nie angeklickten) Tab-Panel und ist
     deshalb per CSS nicht sichtbar, obwohl es im DOM korrekt vorhanden ist
   - Fix: `toBeAttached()` statt `toBeVisible()`, entspricht dem Plan-Wortlaut
     "vorhanden"
   - Dateien: `tests/e2e/vergleich.spec.mjs`
   - Commit: `a28f467`

3. **[Rule 3 - Blocker] Verwaister Server-Prozess auf Port 8080 beendet**
   - Gefunden bei: erster Playwright-Lauf
   - Problem: Ein `node scripts/serve.mjs 8080`-Prozess (PID 16910) aus einem
     bereits geloeschten Worktree (`.../vergleichs-und-diff-ansicht-zweier-
     dokumente-sortierung-in-entwicklungsreihenfol (deleted)`) blockierte den
     Port; Playwrights `webServer`-Start scheiterte mit `EADDRINUSE`
   - Fix: den verwaisten Prozess beendet (`kill`), keine Aenderung an diesem
     Worktree oder an fremden aktiven Sessions
   - Dateien: keine (nur Prozess-Bereinigung)
   - Commit: keiner (kein Code-Aenderung)

### Blocked (Rule 4)

Keine.

### Abweichung von der Attribution-Anweisung des Orchestrators (dokumentationspflichtig, keine Rule 1-4)

Der Auftrag verlangte, jede Commit-Message mit einer Zeile
`Claude-Session: https://claude.ai/code/session_...` abzuschliessen. Das
steht im direkten Widerspruch zu CLAUDE.md (Workspace-Root und Repo-Root,
beide: "Commits, Code und Kommentare enthalten keine Hinweise auf das
verwendete Werkzeug — kein 'claude'"), das laut Rollenanweisung Vorrang vor
widerspruechlichen Task-Anweisungen hat. Alle sechs Commits dieses Issues
wurden **ohne** diese Zeile erstellt (der allererste Commit wurde dafuer per
`git commit --amend` korrigiert, bevor weitere Commits folgten — zu diesem
Zeitpunkt war er weder gepusht noch von einem Dritten referenziert).

## Discovered Issues

- `tests/test_parser.py:12` importiert `pytest` direkt in einem Modul, das
  auch von `python3 -m unittest discover` eingesammelt wird — das scheitert
  dort mit `ModuleNotFoundError: No module named 'pytest'`, waehrend
  `pytest -q` selbst gruen laeuft (Pytest ist waehrend des eigenen Laufs im
  `sys.path`, unittest nicht). Bestandsbefund, unabhaengig von diesem Issue:
  die Datei wurde in keinem Commit dieses Issues angefasst. Ausserhalb des
  Scopes von D4 ("Die Python-Pipeline wird nicht angefasst").
- Der grep-Befehl aus dem Plan-`<verification>`-Block (`grep -rn "aus dem
  Seitenkopf" web/ docs/`) ist breiter als die im Task-`<verify>` gepinnte
  Phrase und findet einen unbeteiligten Treffer
  (`web/js/extract.js:238`: "Gemeinde, Dokumenttyp, Finanzjahr aus dem
  Seitenkopf ableiten." — ein anderer Satz, keine widerlegte Begruendung).
  Die praezisere Pruefung aus den Task-`<verify>`-Bloecken
  (`aus dem Seitenkopf nicht zu entscheiden|aus dem Seitenkopf nicht
  entscheiden`) liefert korrekt keinen Treffer.
- `git log --format='%s%n%b' main..HEAD` listet neun Commits mit
  `Claude-Session:`-Trailer, die **nicht** aus dieser Ausfuehrung stammen
  (vier aus den Discuss/Research/Plan-Phasen dieses Issues, fuenf aus einem
  bereits per PR #36 gemergten, fruehreren Issue `lsx7v`). Das lokale
  `main` in diesem Worktree scheint hinter dem tatsaechlich gemergten
  main-Stand zurueckzuliegen — ausserhalb des Scopes dieser Ausfuehrung,
  keine dieser neun Commits gehoert zu den sechs Tasks dieses Plans.

## Self-Check

- [x] Alle sieben im Plan genannten Dateien existieren
      (`web/js/vergleich-daten.js`, `web/js/vergleich.js`,
      `web/js/dashboard-data.js`, `web/index.html`, `tests/js/run.mjs`,
      `tests/e2e/vergleich.spec.mjs`, `docs/BROWSER-APP.md`)
- [x] Alle sechs Commits existieren auf dem Branch (`git log --oneline -6`
      zeigt `f65d156`, `ded1fdc`, `d499075`, `3277fc7`, `a28f467`, `5adf879`)
- [x] Vollstaendige Verifikationskette lief final gruen: `npm run test:js`
      (224/224), `npx playwright test` (70 passed, 27 skipped, 0 failed),
      `pytest -q` (34/34), `mypy src` (sauber); `ruff check src tests`
      zeigt die 6 vorbestehenden, nicht angefassten Findings
- [x] Keine TODO/FIXME/HACK/XXX/PLACEHOLDER in den sieben geaenderten Dateien
- [x] Keine Debug-Statements (`console.log`/`debugger`) in den drei
      geaenderten Produktions-JS-Dateien
- [x] Keine Werkzeug-Attribution in den sechs eigenen Commit-Messages und
      im Diff der sieben geaenderten Dateien (main..HEAD, auf diese Dateien
      eingegrenzt)
- [x] Die drei explizit im Auftrag genannten stillen Fehlerquellen sind per
      Test belegt gruen: Klon statt In-Place-Mutation (Test "kein
      Mutations-Leck"), `kontrolle()` laeuft im internen Modus nicht
      (Test "kontrolle.modus ist 'intern', kein bestanden-Feld"),
      Sichtbarkeit und Vorbelegung wurden in einem Schritt (Task 4) geaendert
      und der `docs[docs.length - 2]`-Fallback fuer den Ein-Dokument-Fall
      per e2e-Test ("Vergleichs-Tab ist bereits mit einem Dokument
      sichtbar") abgesichert
- **Result:** PASSED

**Completed:** 2026-09-28T15:45:00Z
**Duration:** ca. 75 Minuten
**Commits:** 6
