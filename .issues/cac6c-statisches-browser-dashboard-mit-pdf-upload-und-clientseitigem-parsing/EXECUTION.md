# Execution: Statisches Browser-Dashboard mit PDF-Upload und clientseitigem Parsing

**Started:** 2026-05-22
**Status:** complete
**Branch:** issue/cac6c-statisches-browser-dashboard-mit-pdf-upload-und-clientseitigem-parsing

## Execution Log

- [x] T1: PoC formalisieren und Projektgeruest — commit dd1f821
- [x] T2: Wort-Extraktion (mupdf.js) als JS-Modul — commit c30bced
- [x] T3: VRV-2015-Parser nach JavaScript portieren — commit ea167b2
- [x] T4: Loader-Logik, Referenzdaten und Validierung portieren — commit 3ac4522
- [x] T5: sqlite-wasm + Persistenz — commit 7dfdd06
- [x] T6: Upload-Oberflaeche und Dokumentverwaltung — commit e7ca907
- [x] T7: Dashboard an die Browser-Datenquelle anbinden — commit 58d22a0
- [x] T8: Statisches Deployment, Tests, Dokumentation — commit c4f8c68

## Verification Results

**Python-Tests:** 28 passed (unveraendert gruen nach jedem Task)
**ruff / mypy:** sauber nach jedem Task
**JS-Tests (`npm run test:js`):** 26 bestanden, 0 fehlgeschlagen
**node --check:** alle JS-Dateien syntaktisch ok

### Korrektheitsgate — JS-Parser gegen Python-Parser

JS-Parser ueber alle vier PDFs in `documents/`, Posten-fuer-Posten gegen den
Python-Parser verglichen:

| PDF | detail | summe | saldo | Ergebnis |
|-----|-------|-------|-------|----------|
| NVA-2025-Auflage.pdf | 1254 | 702 | 819 | identisch |
| RA 2024-Auflage.pdf | 1395 | 798 | 684 | identisch |
| RA-2025-Auflage.pdf | 1358 | 777 | 666 | identisch |
| VA-2026-Auflage.pdf | 1408 | 690 | 805 | identisch |

Gleiche Anzahl Detail-/Summe-/Saldoposten, gleiche Anzahl Ansaetze/Konten,
gleiche Betraege je vollem Kontoschluessel (alle sechs Betragsspalten).

### Plausibilitaetspruefung

Portierte Pruefung in Node: **20/20** (5/5 je Dokument) — identisch zur
Python-Seite (`validate.run` ueber dieselben vier PDFs ergibt ebenfalls 20/20).

### Dashboard-Datenabgleich

`DATA` (collect) und `CFG` (alleCharts) der JS-Ports sind **byte-identisch**
zu denen der Python-Pipeline (`report/data.py` + `report/charts.py`), tiefer
Strukturvergleich ueber alle vier Dokumente bestanden.

### sql/-Abfrage

`sql/01-eckwerte.sql` in der Browser-DB liefert dieselben Werte wie die
Python-Pipeline (z. B. VA 2026 Nettoergebnis 474.200, RA 2024 719.006).
Export/Import-Roundtrip der DB erhaelt die Daten.

## Deviations from Plan

### Auto-fixed (Rules 1-3)

1. **[Rule 1 - Bug] Wort-Rekonstruktion verschmolz Spalten mit Grundlinien-Jitter**
   - Gefunden in: T3 (Korrektheitsgate)
   - Problem: Der PoC sortierte alle Zeichen einer Seite global nach
     `(y0, x0)`. Die Detailschluessel-Spalte und die Bezeichnungsspalte
     liegen ~0,15 pt versetzt; nach globalem Sortieren wanderten
     Schluesselzeichen ans Zeilenende und verschmolzen mit Nachbarworten.
     Folge: ~13 % der Detailposten fehlten.
   - Fix: `extract.js` respektiert jetzt die Zeilengrenzen aus
     `StructuredText.walk()` (`beginLine`/`endLine`) statt global zu
     sortieren. Danach: alle vier PDFs identisch zum Python-Parser.
   - Dateien: web/js/extract.js — Commit ea167b2

2. **[Rule 1 - Bug] Rundungsdifferenz JS vs. Python**
   - Gefunden in: T7 (DATA/CFG-Abgleich)
   - Problem: `Math.round` rundet `.5` immer auf, Pythons `round()` rundet
     zur naechsten geraden Zahl ("banker's rounding"). DATA/CFG wichen in
     ~12 Werten um 1 ab.
   - Fix: `roundHalfEven()` in dashboard-data.js und dashboard-charts.js
     bildet Pythons Verhalten nach; `komm_anteil` auf 1 statt 2
     Nachkommastellen korrigiert. Danach DATA/CFG byte-gleich.
   - Dateien: web/js/dashboard-data.js, web/js/dashboard-charts.js — 58d22a0

3. **[Rule 3 - Blocker] sqlite-wasm-API: leere bind-Liste**
   - Gefunden in: T5
   - Problem: `selectValue(sql, [])` wirft, wenn die SQL keine Parameter
     hat.
   - Fix: `db.js` reicht `bind` nur weiter, wenn die Liste nicht leer ist.
   - Dateien: web/js/db.js — Commit 7dfdd06

### Blocked (Rule 4)

Keine.

## Decisions

- **D3 — Persistenz:** OPFS-**SAH-Pool-VFS** statt der Worker-/Promiser-
  Architektur. Begruendung: Der SAH-Pool laeuft im Haupt-Thread und braucht
  keine Cross-Origin-Isolation (COOP/COEP) — entscheidend, weil GitHub Pages
  solche Header nicht setzen kann. Fallback auf In-Memory plus
  `exportBytes`/`importBytes`. Kein Wechsel auf sql.js noetig.
- **D5 — Dashboard-Wiederverwendung:** Die Darstellungsschicht
  (`dashboard.css`, `dashboard.js`) wird **verbatim** aus dem Python-Report
  (`report/assets.py`) uebernommen (`web/vendor/dashboard/`). `data.py` und
  `charts.py` sind nach JS portiert und liefern byte-gleiche `DATA`/`CFG`;
  ein Bootstrap (`dashboard-app.js`) baut die dokumentabhaengigen
  Bedienelemente. So zeigt das Browser-Dashboard dieselben Auswertungen wie
  die Python-erzeugte Seite, ohne die Logik zu duplizieren.
- **web/-Eigenstaendigkeit:** `schema.sql` und die `sql/`-Abfragen werden per
  `make web-sync` nach `web/` kopiert (Python bleibt die Quelle), damit die
  statische Seite ohne das Repo-Wurzelverzeichnis deploybar ist.

## Discovered Issues

- `dashboard.html` hat — wie `report/html.py` — die ID `c_wasserfall`
  doppelt (Panels "Ueberblick" und "800k-Analyse"). `getElementById` findet
  nur das erste; im 800k-Tab bleibt der zweite Wasserfall-Container leer.
  Das ist ein bestehender Quirk der Python-Referenz; bewusst nicht geaendert,
  um die Paritaet mit der Python-Seite zu wahren. Kandidat fuer ein eigenes
  Issue (eindeutige IDs in beiden Pipelines).

## Self-Check

- [x] Alle Dateien aus dem Plan existieren (24 geprueft)
- [x] Alle Commits existieren auf dem Branch (8 Task-Commits)
- [x] Volle Pruefung gruen: Python 28, JS 26, ruff/mypy sauber, node --check
- [x] Keine Stubs/TODOs/Platzhalter im App-Code (`web/js/`)
- [x] Kein Debug-Code (console.log nur in CLI-Skripten/Testrunner)
- **Result:** PASSED

**Completed:** 2026-05-22
**Commits:** 8 Task-Commits (dd1f821 .. c4f8c68) plus dieser Doku-Commit
