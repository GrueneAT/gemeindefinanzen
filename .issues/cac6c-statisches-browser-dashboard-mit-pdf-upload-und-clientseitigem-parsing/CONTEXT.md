# CONTEXT — Statisches Browser-Dashboard mit PDF-Upload

Designentscheidungen. Autonomer Lauf — offene Punkte eigenstaendig entschieden.

## Ziel

Eine reine statische Website: Nutzer laedt VRV-2015-PDFs per Drag & Drop hoch,
Textextraktion + Parsing + Auswertung laufen vollstaendig im Browser, Daten
werden lokal persistiert. Kein Server.

## Vorab geklaert (Stack, recherchiert und teils erprobt)

- **mupdf.js** fuer die PDF-Extraktion — engine-gleich mit PyMuPDF.
- **VRV-Parser nach JavaScript portiert.**
- **sqlite-wasm + OPFS** fuer Speicherung; `schema.sql` und `sql/`-Abfragen
  laufen unveraendert.
- Reine statische Seite, GitHub-Pages-tauglich.

## PoC-Ergebnis (bereits durchgefuehrt — Task 1 im Kern erledigt)

`mupdf.js` wurde in Node an `documents/VA-2026-Auflage.pdf` getestet:

- `mupdf.Document.openDocument(buffer, "application/pdf")` oeffnet das PDF
  (283 Seiten korrekt erkannt).
- `page.toStructuredText().walk({ onChar })` liefert pro Zeichen `origin` und
  `quad` (4 Eckpunkte) — exakte Koordinaten, Ursprung oben links, Punkte.
- Aus den Zeichen lassen sich Woerter rekonstruieren (gruppieren nach y,
  trennen bei Leerzeichen/Luecke). Ergebnis: **wortweise Koordinaten identisch
  zu PyMuPDF**. Die rechten Kanten der sechs Betragsspalten kamen exakt als
  463.7 / 526.1 / 588.4 / 662.1 / 724.5 / 786.9 heraus — dieselben Werte wie
  die in `parser.py` vermessenen Konstanten.
- Das funktionierende PoC-Skript liegt unter `poc/mupdf-geometrie.mjs`.

Folge: Die Parser-Geometrie und -Logik uebertragen sich ohne Neuvermessung.
Das groesste Risiko ist abgeraeumt.

## Entscheidungen

### D1 — Wortrekonstruktion via `walk()`
`asJSON()` liefert nur Zeilen-/Block-bboxes (zu grob). Die Wort-Extraktion
nutzt `StructuredText.walk()` mit `onChar` und gruppiert Zeichen zu Woertern —
das liefert exakt das `words`-Modell, auf dem der Parser aufbaut. Diese
Gruppierung wird ein eigenes, getestetes JS-Modul.

### D2 — Parser-Port als eigenstaendiges JS-Modul, gegen Python getestet
`parser.py` (Geometriekonstanten, Spaltenzuordnung, Zeilenklassifikation,
Gebarungs-Kontext, Ruecklagen-Sonderfall) wird nach JS portiert. Die
Plausibilitaetspruefung aus `validate.py` wird mitportiert und laeuft im
Browser nach jedem Upload — sie beweist die korrekte Extraktion je Dokument.
Korrektheitsnachweis: Der JS-Parser wird in Node gegen dieselben vier PDFs
laufen gelassen und Posten-fuer-Posten mit dem Python-Parser verglichen.

### D3 — Datenhaltung: sqlite-wasm + OPFS, Fallback sql.js
Offizielles `@sqlite.org/sqlite-wasm`. `schema.sql` und die `sql/`-Abfragen
werden unveraendert geladen. Persistenz ueber OPFS (Web Worker). Wenn die
Worker-/OPFS-Architektur unverhaeltnismaessig wird, Fallback auf `sql.js`
(In-Memory, Serialisierung nach IndexedDB) — der Executor entscheidet nach
Aufwand, dokumentiert die Wahl.

### D4 — Eigenes `web/`-Verzeichnis, Python-Pipeline bleibt unangetastet
Die Browser-App entsteht unter `web/` als statische Seite. Die bestehende
Python-Pipeline (`src/`, `report/`) bleibt vollstaendig erhalten und ist
weiter die Referenz mit der Test-Suite. Kein Rueckbau.

### D5 — Dashboard-Wiederverwendung
Die Dashboard-Oberflaeche (Tabs, Umschalter, Suche, Charts aus `report/`)
wird fuer die Browser-App wiederverwendet. Wo sinnvoll, wird die Darstellungs-
schicht geteilt; Datenquelle ist statt eingebettetem JSON die Browser-DB.
Der Executor waehlt den pragmatischsten Weg (gemeinsame Assets vs. Portierung)
und haelt den visuellen Stil (flomotlik Design System) konsistent.

### D6 — Bibliotheken vendorisiert
mupdf.js, sqlite-wasm und ECharts werden ins Repo vendorisiert (oder per CDN,
wo stabil), damit die statische Seite ohne Build-Schritt deploybar ist.

### D7 — Lizenz
mupdf.js ist AGPL v3. Das Projekt ist Open Source — die AGPL-Pflichten
(Quelloffenlegung) sind erfuellt. Ein `LICENSE`/Hinweis dokumentiert das.

## Nicht-Ziele

- Kein Server, kein Backend, keine Konten.
- Keine Aenderung an Parser/Schema/Validierung der Python-Seite.
- Kein npm-Build-Schritt fuer die ausgelieferte Seite.
