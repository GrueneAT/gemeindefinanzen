# PLAN — Statisches Browser-Dashboard

Umsetzung in atomaren Tasks. Jeder Task endet mit einem Commit (`cac6c: ...`),
jeder Commit ist ein lauffaehiger Stand. Entscheidungen: CONTEXT.md.
Ist-Zustand und PoC-Ergebnis: RESEARCH.md.

## Umgebung

- `node` v26, `npm` 11. mupdf.js ist ein ESM-Modul (Top-Level-await) — nur per
  `import`, nie `require()`.
- Python-Referenz: `PYTHONPATH=src /tmp/pdfvenv/bin/python` — zum Vergleich des
  JS-Parsers mit dem Python-Parser.
- Vier echte PDFs in `documents/`, Referenz-DB in `data/gemeindefinanzen.db`.
- Qualitaetsschranke je Task: bestehende Python-Tests bleiben gruen
  (`PYTHONPATH=src /tmp/pdfvenv/bin/python -m pytest -q`), `ruff check src
  tests` und `mypy src` sauber. Neues JS mit `node --check` bzw. Node-Lauf
  pruefen.

## Globale Vorgaben

- Browser-App entsteht unter `web/`. Die Python-Pipeline (`src/`, `report/`,
  `sql/`, `tests/`) bleibt unveraendert die Referenz.
- ECMAScript-Module, kein Build-Schritt fuer die ausgelieferte Seite.
- Deutsch in UI und Code-Bezeichnern; keine Werkzeug-Attribution.
- Bibliotheken vendorisiert unter `web/vendor/` (oder stabiles CDN).

<task id="T1" title="PoC formalisieren und Projektgeruest">
Den bereits erfolgreichen mupdf.js-PoC im Repo verankern:
- `web/`-Grundgeruest anlegen: `web/index.html` (Platzhalter), `web/js/`,
  `web/css/`, `web/vendor/`.
- `package.json` im Repo-Wurzelverzeichnis fuer die JS-Abhaengigkeiten
  (`mupdf`, `@sqlite.org/sqlite-wasm`) und ein Skript `test:js`.
- Das PoC-Skript `.issues/cac6c-.../poc/mupdf-geometrie.mjs` als lauffaehiges
  Referenzskript nach `scripts/` uebernehmen.
- Kurze Datei `web/POC.md`: Ergebnis (mupdf.js liefert PyMuPDF-gleiche
  Wort-Geometrie), AGPL-v3-Hinweis.
Akzeptanz: `npm install` laeuft; das PoC-Skript extrahiert in Node die
Spalten-x1 463.7/526.1/588.4/662.1/724.5/786.9 aus `documents/VA-2026-Auflage.pdf`.
</task>

<task id="T2" title="Wort-Extraktion (mupdf.js) als JS-Modul">
`web/js/extract.js` — Portierung von `extract.py`:
- PDF aus einem `Uint8Array`/`ArrayBuffer` oeffnen.
- `toStructuredText().walk()` -> Zeichen -> Woerter (Gruppierung nach y mit
  Toleranz, Trennung bei Leerzeichen/x-Luecke; PoC-Werte als Ausgangspunkt:
  y-Toleranz 3 pt, Luecke 1.2 pt).
- Zeilen bilden (`page_lines`-Aequivalent), Abschnittsgrenzen aus den
  Lesezeichen (`section_ranges`), Gemeinde/Typ/Jahr aus dem Seitenkopf
  (`document_meta`).
Akzeptanz: In Node liefert das Modul fuer `VA-2026-Auflage.pdf` dieselbe
Wortmenge/-geometrie wie PyMuPDF (stichprobenartig gegen den Python-`extract`
verglichen).
</task>

<task id="T3" title="VRV-2015-Parser nach JavaScript portieren">
`web/js/parser.js` — Portierung von `parser.py`:
- Geometriekonstanten, `DETAIL_RE`, Spaltenzuordnung, Zeilenklassifikation
  (detail/summe/saldo/Ansatz-Kopf/Gebarung/Fortsetzung), deutsche Betraege,
  Gebarungs-Kontext, Ruecklagen-Sonderfall (MVAG 230/240).
- Liefert dieselbe Posten-Struktur wie der Python-Parser.
Akzeptanz: Ein Node-Testskript parst alle vier PDFs in `documents/` und
vergleicht das Ergebnis Posten-fuer-Posten mit dem Python-Parser — gleiche
Anzahl Detailposten, gleiche Betraege je Kontoschluessel. Abweichung = Fehler.
</task>

<task id="T4" title="Loader-Logik, Referenzdaten und Validierung portieren">
- `web/js/reference.js` — VRV-Gruppen und MVAG aus `reference.py`.
- `web/js/loader.js` — Spaltenbedeutung je Dokumenttyp (`_spalten`), Aufbau
  der Posten-Datensaetze, Ableitung von Ansatz-/Kontobezeichnungen.
- `web/js/validate.js` — Plausibilitaetspruefung aus `validate.py`: Detail-
  summen je Ansatz gegen die SU-21/22/33/34-Zeilen.
Akzeptanz: In Node bestehen alle vier Dokumente die portierte Pruefung
(20/20 wie auf der Python-Seite).
</task>

<task id="T5" title="sqlite-wasm + Persistenz">
`web/js/db.js` — Datenhaltung:
- `@sqlite.org/sqlite-wasm` laden, `schema.sql` (aus dem Repo, unveraendert)
  ausfuehren, geparste Posten einfuegen.
- Die `sql/`-Abfragen unveraendert ausfuehrbar machen.
- Persistenz ueber OPFS (Web Worker). Falls die Worker-/OPFS-Architektur den
  Rahmen sprengt: Fallback `sql.js` + Serialisierung nach IndexedDB — die
  getroffene Wahl in `web/POC.md` bzw. einem Kommentar begruenden.
Akzeptanz: Nach Upload liegen die Posten in der Browser-DB; eine `sql/`-Abfrage
liefert dieselben Werte wie auf der Python-Seite; nach Reload sind die Daten
noch da.
</task>

<task id="T6" title="Upload-Oberflaeche und Dokumentverwaltung">
`web/index.html` + `web/js/app.js`:
- Drag-&-Drop-Zone plus Datei-Auswahl, Mehrfach-Upload.
- Fortschrittsanzeige je PDF (Extraktion/Parsing/Validierung), klare
  Fehlerbilder bei untauglichen Dateien.
- Liste der geladenen Dokumente (Typ, Jahr, Postenzahl, Pruefstatus) mit
  Entfernen-Funktion; Stand bleibt persistent.
Akzeptanz: Mehrere PDFs nacheinander ladbar; Liste und Pruefstatus stimmen;
nach Reload ist der Stand wieder da.
</task>

<task id="T7" title="Dashboard an die Browser-Datenquelle anbinden">
Das Dashboard aus `report/` (Tabs, Jahr-Umschalter, Suche/Filter, Drill-down,
Mehrjahres-Vergleich, Charts) in der Browser-App nutzen:
- Datenquelle ist die Browser-DB statt eingebettetem JSON.
- Darstellungsschicht moeglichst teilen (gemeinsame CSS/JS-Assets) statt
  duplizieren; pragmatisch entscheiden und begruenden.
- flomotlik Design System konsistent.
Akzeptanz: Nach dem Laden echter PDFs zeigt das Dashboard im Browser dieselben
Auswertungen wie die Python-erzeugte Seite; alle Tabs funktionieren.
</task>

<task id="T8" title="Statisches Deployment, Tests, Dokumentation">
- Bibliotheken nach `web/vendor/` vendorisieren; `web/` ist ohne Build-Schritt
  als statische Seite lauffaehig.
- Make-Ziel `web` bzw. Doku, wie man `web/` lokal testet und auf GitHub Pages
  bringt.
- JS-Tests (Node) fuer Extraktion/Parser/Validierung in `tests/js/` bzw. ueber
  `npm run test:js`; in die bestehende Pruefroutine einbinden.
- `README.md` und `docs/` um die Browser-App erweitern.
Akzeptanz: `web/` laeuft als statische Seite (lokal per einfachem Static-Server
geprueft); JS-Tests und Python-Tests gruen; ruff/mypy sauber.
</task>

## Definition of Done

- Nutzer laedt VRV-2015-PDFs im Browser hoch; Extraktion, Parsing und
  Auswertung laufen vollstaendig clientseitig.
- Der JS-Parser liefert nachweislich dasselbe Ergebnis wie der Python-Parser;
  die clientseitige Plausibilitaetspruefung bestaetigt jedes Dokument.
- Geparste Daten sind persistent; erneuter Besuch laedt den Stand.
- Das Dashboard arbeitet auf den hochgeladenen Daten.
- Reine statische Seite, GitHub-Pages-tauglich, kein Server.
- Python-Pipeline unveraendert; alle Tests gruen, ruff/mypy sauber.
