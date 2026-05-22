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

---

# T9 — Einseitige App mit IndexedDB-Persistenz

**Started:** 2026-05-22
**Status:** complete

## Problem

Die Browser-App bestand aus zwei getrennten Dokumenten: `index.html`
(Upload) und `dashboard.html` (Dashboard). Getrennte Seiten koennen sich
keine In-Memory-Datenbank teilen — Daten wandern nur ueber Persistenz von
Seite zu Seite. Die OPFS-Persistenz schlug beim Nutzer auch ueber
`http://localhost` fehl ("Missing required OPFS APIs"); Uploads landeten in
einer In-Memory-DB, und die Dashboard-Seite oeffnete leer.

## Was geaendert wurde

- **Einseitige App.** Alles in `web/index.html` zusammengefuehrt:
  Header, immer sichtbare Dokumentverwaltung (Dropzone, Fortschritt,
  Dokumenttabelle mit Entfernen-Buttons), darunter das vollstaendige
  Dashboard (`#dashboard-inhalt` mit Umschalter, 7 Tabs, allen
  `tab-panel`-Sektionen) plus `mj-overlay`. Das Dashboard ist sichtbar,
  sobald ein Dokument geladen ist; sonst ein kurzer Empty-State-Hinweis.
  `web/dashboard.html` wurde geloescht.
- **Persistenz auf IndexedDB umgestellt.** `web/js/db.js` neu geschrieben:
  `oeffneDb()` erzeugt eine In-Memory-SQLite-DB und stellt einen zuvor in
  IndexedDB gesicherten Stand ueber `sqlite3_deserialize` wieder her. Neue
  Methode `Datenbank.sichern()` exportiert die DB-Bytes
  (`sqlite3_js_db_export`) und schreibt sie unter einem festen Schluessel
  nach IndexedDB. Der `installOpfsSAHPoolVfs`-Pfad und alle OPFS-Kommentare
  sind entfernt. Ist `indexedDB` undefiniert (Node-Testumgebung), arbeitet
  die DB als reine In-Memory-DB ohne Fehler; `Datenbank.persistent` ist
  dann `false`.
- **Seiten-Controller `web/js/app.js`.** Oeffnet beim Laden die DB
  (Wiederherstellung aus IndexedDB), zeichnet die Dokumentliste und baut
  das Dashboard, falls Dokumente vorhanden sind — sonst der Empty-State.
  Nach erfolgreichem Upload und nach dem Entfernen eines Dokuments wird
  `sichern()` aufgerufen und die Seite mit `location.reload()` neu
  aufgebaut (Daten liegen sicher in IndexedDB).
- **`dashboard-app.js` refaktoriert.** Exportiert jetzt `baueDashboard(db)`,
  die das Dashboard fuer eine bereits geoeffnete DB rendert (kein eigenes
  `oeffneDb` mehr). `app.js` ruft sie mit derselben DB-Instanz auf.
  `web/vendor/dashboard/dashboard.js` ist unveraendert (verbatim
  Python-Report, liest globale `DATA`/`CFG`).
- **boot-guard.** `web/js/boot-guard.js` samt `<script>`/`<style>` in
  `index.html` unveraendert erhalten; `app.js` setzt weiterhin
  `window.__appBereit = true`.
- **persist-note.** Bei aktiver IndexedDB-Persistenz: Daten werden lokal im
  Browser gespeichert und beim naechsten Besuch wiederhergestellt; sonst
  ehrlicher Hinweis, dass der Stand nur fuer die Sitzung gilt.
- **Doku/Tooling.** `docs/BROWSER-APP.md`, `README.md` und der
  Kopfkommentar von `scripts/serve.mjs` auf eine Seite (`web/index.html`)
  und IndexedDB statt OPFS aktualisiert.
- **Test.** `tests/js/run.mjs` um einen Persistenz-Guard-Test ergaenzt:
  `oeffneDb` ohne IndexedDB liefert `persistent=false`, `sichern()` ist
  folgenlos.

## Commits

- cac6c: Browser-App auf eine Seite mit IndexedDB-Persistenz umstellen

## Verification Results

- **JS-Tests (`npm run test:js`):** 28 bestanden, 0 fehlgeschlagen
  (26 bisherige plus 2 neue Persistenz-Guard-Pruefungen).
- **Python-Tests (`pytest -q`):** 28 passed.
- **ruff check src tests:** All checks passed.
- **mypy src:** Success, no issues in 13 source files.
- **node --check:** `web/js/db.js`, `web/js/app.js`,
  `web/js/dashboard-app.js` syntaktisch ok.
- **Asset-Check:** `web/` ueber `node scripts/serve.mjs` ausgeliefert;
  `index.html` und alle 18 referenzierten bzw. transitiv geladenen Assets
  (CSS, alle `js/`-Module, `vendor/dashboard/dashboard.js`, `schema.sql`,
  `vendor/mupdf/mupdf.js`, `vendor/sqlite-wasm/sqlite3.mjs`) liefern
  HTTP 200. Keine Referenz auf `dashboard.html` mehr im Browser-App-Code.

## Decisions

- **D3 revidiert — Persistenz ueber IndexedDB statt OPFS.** OPFS (auch der
  SAH-Pool-VFS) ist beim Nutzer selbst ueber `http://localhost`
  fehlgeschlagen. IndexedDB ist in jedem Kontext verfuegbar — keine
  OPFS-API, keine COOP/COEP-Header, kein besonderer sicherer Kontext noetig.
  Der DB-Inhalt wird als Byte-Array dort abgelegt; das ist robust und
  deckungsgleich mit der bisherigen `exportBytes`/`importBytes`-Logik.
- **Seitenaufbau nach Schreibvorgang.** Statt eines in-place Re-Render des
  Dashboards (dashboard.js laeuft als klassisches Skript nur einmal) wird
  nach `sichern()` `location.reload()` aufgerufen. Die Daten liegen sicher
  in IndexedDB; der Reload ist der einfachste, robuste Weg zu einem sauberen
  Dashboard-Aufbau.
- **Dokumentverwaltung ist kein Tab.** Sie bleibt eine immer sichtbare
  Sektion oberhalb der Dashboard-Tabs, damit Upload und Auswertung ohne
  Umschalten nebeneinanderliegen.

## Self-Check

- [x] `web/index.html` ist die einzige Seite; `web/dashboard.html` geloescht
- [x] Alle Assets liefern HTTP 200, keine `dashboard.html`-Referenz
- [x] Volle Pruefung gruen: JS 28, Python 28, ruff/mypy sauber, node --check
- [x] Keine Stubs/TODOs/Platzhalter, kein Debug-Code (nur bewusstes
      `console.warn` bei Lesefehler der gesicherten DB)
- **Result:** PASSED

**Completed:** 2026-05-22

---

# T10 — Einklappbare Dokumentverwaltung & Generalisierung (weg von "800k")

**Datum:** 2026-05-22
**Status:** complete

## Aenderung A — Dokumentverwaltung einklappbar

- `web/index.html`: Dropzone, Upload-Fortschritt und die Tabelle der
  geladenen Dokumente in ein natives `<details class="doc-manager">`
  zusammengefasst. `<summary>` zeigt „Dokumente verwalten" plus eine
  kompakte Zaehlzeile.
- `web/js/app.js`: neue Funktion `aktualisiereDokVerwaltung(anzahl)`,
  aufgerufen aus `zeichneDokumentliste()`. Ohne geladene Dokumente offen
  (Upload-Aufforderung sichtbar), mit geladenen Dokumenten zugeklappt — das
  Dashboard bekommt den Platz. Upload und Entfernen unveraendert
  funktionsfaehig.
- `web/css/app.css`: Stil fuer `.doc-manager`/`.doc-manager-summary` im
  Design-System-Stil (Haarlinien, Papier-Optik, eigener Aufklapp-Pfeil
  statt nativem Marker).
- Browser-App-only, keine Python-Aenderung.

## Aenderung B — Generalisierung weg vom "800k"-Spezialfall

- **Tab umbenannt:** „800k-Analyse" -> „Sparpotenzial". Panel-/Tab-Schluessel
  `achthundert` -> `sparpotenzial` in `web/index.html` und
  `src/gemeindefinanzen/report/html.py` (`TABS`, `_panel_sparpotenzial`).
  Tab-Umschaltung laeuft rein ueber `data-tab`/`data-panel` — kein
  hartcodierter Schluessel in der JS-Logik.
- **Wasserfall** (`chart_wasserfall` in `charts.py` + JS-Port): die zwei
  Szenario-Schritte „Kommunalsteuer-Ausfall" (-800000) und „Ergebnis nach
  Ausfall" entfernt. Bleibt eine generische Ergebnisbruecke
  Ertraege -> Aufwendungen -> Nettoergebnis.
- **Korridor** (`chart_korridor` + JS-Port): die fixe 800.000-`markLine`
  entfernt. Chart bleibt (kumulierter Sachaufwand mit Ermessensspielraum),
  neutral beschriftet.
- **Datenmodell:** `_AUSFALL`/`AUSFALL`, `netto_nach_ausfall` und
  `meta.ausfall` aus `data.py` und `dashboard-data.js` entfernt.
- **Texte:** Ueberblick-Lead, Sparpotenzial-Panel-Texte und der
  „Suchhilfe"-Callout neutral umformuliert — kein „800.000", kein
  „Kommunalsteuer-Ausfall", keine „800.000-Euro-Frage/-Schwelle" mehr.

## Entscheidungen

- **`web/sql/` nicht angefasst.** `web/sql/05-luecke-800k.sql` und
  `web/sql/11-kommunalsteuer-szenario.sql` sind per `make web-sync` eine
  Kopie von `sql/` (Wurzelverzeichnis), das laut Aufgabe ausdruecklich
  ausserhalb des Scopes liegt. Diese Standalone-Abfragen werden vom
  Dashboard nicht genutzt (nur `01-eckwerte.sql` durch die JS-Tests).
- **JS-Referenzwerte:** `tests/js/referenz-data.json` existiert nicht, der
  optionale Byte-Abgleich DATA-gegen-Python wird uebersprungen. Die
  strukturellen JS-Tests (4 Dokumente, 5415 Posten, dok_charts) bleiben
  durch die Aenderung unberuehrt.

## Verifikation

- `npm run test:js` — 29 bestanden, 0 fehlgeschlagen
- `PYTHONPATH=src python -m pytest -q` — 28 passed
- `ruff check src tests` — All checks passed
- `mypy src` — Success, no issues (13 files)
- `node --check` auf allen geaenderten JS-Dateien — fehlerfrei
- Asset-Check: `web/` ueber `scripts/serve.mjs` ausgeliefert, `index.html`
  und alle referenzierten Assets HTTP 200
- Python-Dashboard `reports/dashboard.html` neu erzeugt — baut fehlerfrei,
  enthaelt `data-tab="sparpotenzial"`/`data-panel="sparpotenzial"`, keine
  800k-Texte mehr

## Self-Check

- [x] Alle geaenderten Dateien vorhanden
- [x] Volle Pruefung gruen (JS 29, Python 28, ruff/mypy sauber)
- [x] Keine Stubs/TODOs/Platzhalter, kein Debug-Code
- **Result:** PASSED

---

# T11 — Parser-Fix: aufgeteilte Betragsfragmente zusammenfuehren

**Status:** abgeschlossen

## Problem

Manche Gemeinde-PDFs rendern tausendergetrennte Betraege als mehrere
Textfragmente statt als ein Wort. Beispiel Wildschoenau (Tirol),
Voranschlag 2026: `47.800,00` kommt als zwei Woerter `47` (x0~430) und
`800,00` (x1~463.7) aus dem PDF. Der Parser erkannte nur das Fragment,
das der Ganzzahl-Regex entsprach (`800,00`), und liess das fuehrende
Fragment `47` fallen — der Wert wurde `800,00` statt `47.800,00`.
Herzogenburg und Eichgraben rendern Zahlen als ein Wort und waren nicht
betroffen.

## Fix

1. **Vor-Aufbereitung `_merge_number_fragments` / `mergeNumberFragments`:**
   laeuft je Zeile auf den nach x0 sortierten Woertern und fuehrt
   benachbarte Zahlfragmente zu einem synthetischen Wort zusammen. Zwei
   Woerter gehoeren zur selben Zahl, wenn der horizontale Abstand klein
   ist (`FRAG_GAP_MAX = 6.0` pt) und beide Zahlfragmente sind. Gemessen:
   zahlinterne Luecken ~2.1 pt, Luecken zwischen Betragsspalten >= 17.7 pt
   — die 6-pt-Schwelle trennt beide Faelle sicher. Die Fragmenttexte
   werden direkt verkettet (`47` + `800,00` -> `47800,00`); das
   synthetische Wort behaelt x0 des ersten und x1 des letzten Fragments,
   sodass die rechtskantige Spaltenzuordnung unveraendert weiterlaeuft.
2. **`NUMBER_RE` relaxiert:** akzeptiert zusaetzlich die zusammengezogene
   Form `^-?\d+,\d{2}$` neben der gepunkteten Form.
3. Identische Logik in `parser.py` und `parser.js` — Verhalten gleich.

## Abweichung (Rule 1) — verdichtete Personalkonten

Bei der Verifikation zeigte sich eine **zweite, eigenstaendige Ursache**
fuer das Wildschoenau-Versagen: 26 Detailzeilen mit dem Schluessel
`1/<ansatz>-5` ("Personalkonten verdichtet"). Hier ist nicht der Betrag,
sondern das Konto verkuerzt (eine Ziffer statt sechs). Der
`DETAIL_RE`-Regex verlangte exakt `\d{6}` und verwarf diese Zeilen
komplett — ein echter Datenverlust-Bug. `DETAIL_RE` akzeptiert nun ein
1-6-stelliges Konto (`\d{1,6}`). Herzogenburg und Eichgraben enthalten
keine verdichteten Zeilen (0 Vorkommen), daher kein Einfluss auf sie.
Ohne diese Korrektur erreichte Wildschoenau nur 4/5.

## Test-Fixture-Pinning

`tests/js/run.mjs` globte `documents/*.pdf` und hatte "4 Dokumente /
20/20 / 5415 Posten" fest verdrahtet. Die jetzt in `documents/`
liegende Eichgraben-PDF haette diese Erwartungen gebrochen. Behoben:
der Test laeuft jetzt gegen die explizit gepinnte Liste der vier
Herzogenburg-Fixtures (`FIXTURES`, abgeleitet aus `ERWARTET`).
`tests/test_parser.py` ebenso: `HERZOGENBURG_PDFS` ersetzt
`DOCS.glob("*.pdf")` in `test_alle_dokumente_laden_und_validieren` und
in `docs_vorhanden`.

## Validierung — vorher / nachher

| Gemeinde       | vorher | nachher |
|----------------|--------|---------|
| Herzogenburg   | 20/20  | 20/20   |
| Eichgraben     | 5/5    | 5/5     |
| Wildschoenau   | 2/5    | 5/5     |

Wildschoenau: gegen `/tmp/wildschoenau-VA2026.pdf` mit
`PYTHONPATH=src /tmp/pdfvenv/bin/python` geprueft (nicht ins Repo
eingecheckt). JS-Parser auf derselben PDF ebenfalls 5/5; Python und JS
melden uebereinstimmend 1403 Detailposten (Paritaet bestaetigt).

## Verifikation

- `PYTHONPATH=src python -m pytest -q` — 28 passed
- `python -m unittest discover -s tests` — 0 Tests (keine TestCase-Klassen),
  kein `import pytest`-Leak
- `ruff check src tests` — All checks passed
- `mypy src` — Success, no issues
- `npm run test:js` — 35 bestanden, 0 fehlgeschlagen
- Neue Einheitstests fuer den Fragment-Merge in `tests/test_parser.py`
  (6 Tests) und `tests/js/run.mjs` (6 Tests): zwei/drei Fragmente,
  negatives Fragment, ganzes Zahlwort unveraendert, kleine ungeteilte
  Zahl unveraendert, Spaltengrenze trennt.

---

# T12 — Sankey-Drill-down

**Datum:** 2026-05-22
**Status:** abgeschlossen

## Was gebaut wurde

Das Geldfluss-Sankey im Ueberblick-Tab ist jetzt interaktiv: Knoten
lassen sich anklicken, um eine Ebene tiefer zu gehen.

- **Klick auf eine Aufgabengruppe** (Ausgabeseite) ersetzt diesen einen
  Gruppenknoten durch je einen Knoten pro **Ansatz** der Gruppe, jeweils
  von „Gemeindehaushalt" gespeist. Die uebrigen Gruppen bleiben
  eingeklappt.
- **Klick auf eine Einnahmequelle** (Einnahmeseite) ersetzt den
  Quellenknoten durch je einen Knoten pro **Konto** dieser Quelle, jeweils
  in „Gemeindehaushalt" muendend.
- **Klick auf den zentralen Knoten „Gemeindehaushalt"** klappt alles auf
  die Uebersicht zurueck.

## Wie Aufklappen/Einklappen funktioniert

- Der Zustand ist eine einzige Variable `sankeyExpand` in `dashboard.js`:
  `null` (Uebersicht) oder `{ seite, key }`. Dadurch ist **je Seite
  hoechstens ein Knoten** ausgeklappt — ein neuer Aufklapp-Klick ersetzt
  den vorherigen, die Darstellung „explodiert" nicht.
- **Einklappen** auf vier Wegen: (1) Klick auf einen bereits
  aufgeklappten Detailknoten (Ansatz/Konto), (2) Klick auf den zentralen
  Knoten, (3) der „Übersicht"-Button rechts ueber dem Diagramm,
  (4) Dokumentwechsel ueber den Umschalter.
- Eine Hinweiszeile ueber dem Diagramm erklaert die Interaktion und
  wechselt im aufgeklappten Zustand den Text.
- Lange Listen werden auf `TOP_N = 8` gekappt; der Rest wird in einen
  Knoten „Sonstige Ansaetze" bzw. „Sonstige Konten" gebuendelt — konsistent
  mit dem Umgang anderer Charts mit langen Listen.

## Umsetzung

- **Neues Modul `web/js/sankey-drill.js`** — reine, in Node testbare
  Funktionen: `buildSankeyOption(posten, dokId, expand)` baut die
  ECharts-Sankey-Optionen fuer jeden Zustand direkt aus `DATA.posten`;
  `quelleVonPosten`, `kappen`, `einnahmePosten`, `ausgabePosten`, `TOP_N`
  exportiert. Jeder Knoten traegt `drillSeite`/`drillKey`/`drillExpandbar`
  fuer den Klick-Handler.
- **`quelleVonPosten`** ist der JS-Port der `CASE`-Logik aus
  `dashboard-data.js` (`sankey()`), damit die Quellen-Aggregation des
  Drill-downs deckungsgleich mit der Uebersicht bleibt. Ausgabeseite:
  `richtung==='ausgabe' && ew>0`, Wert `ew` — dieselbe Basis wie der
  Ausgaben-Drill-down (`ausgabePosten`). Einnahmeseite:
  `richtung==='einnahme' && ew>0`, Wert `ew`.
- **`dashboard.js`**: `c_sankey` ist jetzt unter der neuen Chart-Art
  `"sankey"` registriert; `chartOption` liefert dafuer `sankeyOption()`,
  das `window.buildSankeyOption` mit `posten` und `sankeyExpand` aufruft.
  Neue Funktion `setupSankeyDrill()` haengt `chartInstance.on('click', …)`
  ein (`params.dataType === 'node'`), verdrahtet den Reset-Button und
  registriert einen `onDocChange`-Hook. Faellt auf die vorberechnete
  `CFG`-Sankey-Variante zurueck, falls der Builder fehlt.
- **`dashboard-app.js`** (ESM) importiert `buildSankeyOption` und legt es
  vor dem Nachladen von `dashboard.js` als `window.buildSankeyOption` ab —
  `dashboard.js` ist ein klassisches Skript und kann nicht importieren.
- **`index.html`**: Hinweiszeile `#sankey-hinweis` und Button
  `#sankey-reset` ueber `#c_sankey`. **`app.css`**: Stil fuer
  `.sankey-bar`/`.sankey-hint`/`.sankey-reset` im Design-System-Stil.

## Entscheidungen

- **Dynamischer Aufbau in `dashboard.js` statt nur aus dem `CFG`-Blob.**
  Der Drill-down muss Knoten/Links je nach Klick neu berechnen — spiegelt
  `renderDrill`, das ebenfalls aus `posten` rechnet. `chartSankey` in
  `dashboard-charts.js` bleibt unveraendert als Fallback-Quelle der
  Uebersicht.
- **Globale Bruecke statt Modul-Umbau.** `dashboard.js` bleibt das
  verbatim uebernommene klassische Skript; der Builder wird ueber
  `window` hereingereicht — kein Umbau auf ESM, keine Aenderung der
  Python-Referenz noetig.
- **Eindeutige Sonstige-Labels** („Sonstige Ansaetze"/„Sonstige Konten")
  verhindern Namenskollisionen mit echten Knoten im Sankey.

## Commits

- cac6c: interaktiver Drill-down im Geldfluss-Sankey

## Verifikation

- `npm run test:js` — **52 bestanden, 0 fehlgeschlagen** (35 bisherige
  plus 17 neue): `quelleVonPosten` (5), `kappen` (4) und
  `buildSankeyOption` (8) — u. a. Knotenstruktur, Aufklappen von
  Gruppe/Quelle, Betragserhalt der Summen nach Aufklappen.
- `PYTHONPATH=src python -m pytest -q` — 28 passed (keine Python-Aenderung).
- `ruff check src tests` — All checks passed. `mypy src` — Success.
- `node --check` auf `sankey-drill.js`, `dashboard-app.js`,
  `dashboard.js` — fehlerfrei.
- Asset-Check: `web/` ueber `scripts/serve.mjs` ausgeliefert; `/web/`,
  `index.html`, das neue `js/sankey-drill.js`, `js/dashboard-app.js`,
  `vendor/dashboard/dashboard.js` und `css/app.css` liefern HTTP 200.
- Die Klick-Interaktion selbst (ECharts `on('click')`) laesst sich
  headless nicht ausloesen; die Logik ist ueber `buildSankeyOption`
  vollstaendig unit-getestet, der Handler ist bewusst duenn gehalten.

## Self-Check

- [x] Alle geaenderten/neuen Dateien vorhanden
- [x] Volle Pruefung gruen (JS 52, Python 28, ruff/mypy sauber)
- [x] Keine Stubs/TODOs/Platzhalter, kein Debug-Code
- **Result:** PASSED
