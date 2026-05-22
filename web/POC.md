# Browser-App — Machbarkeit (PoC) und Architektur

Dieses Verzeichnis enthaelt eine reine statische Website: Der Nutzer laedt
VRV-2015-PDFs per Drag & Drop hoch; Textextraktion, Parsing und Auswertung
laufen vollstaendig im Browser, die Daten werden lokal persistiert. Kein
Server, kein Backend, kein Build-Schritt fuer die ausgelieferte Seite.

## PoC-Ergebnis: mupdf.js liefert PyMuPDF-gleiche Wort-Geometrie

Der Parser der Python-Pipeline (`src/gemeindefinanzen/parser.py`) ordnet
Betraege ueber die rechte Wortkante exakt rechtsbuendiger Spalten zu. Dafuer
muss die JavaScript-Extraktion dieselben Koordinaten liefern wie PyMuPDF.

`scripts/mupdf-geometrie.mjs` belegt das in Node:

- `mupdf.Document.openDocument(uint8array, "application/pdf")` oeffnet das PDF
  (283 Seiten in `documents/VA-2026-Auflage.pdf` korrekt erkannt).
- `page.toStructuredText().walk({ onChar })` liefert pro Zeichen `origin` und
  `quad` (vier Eckpunkte). Aus den Zeichen werden Woerter rekonstruiert
  (Gruppierung nach y mit Toleranz 3 pt, Trennung bei Leerzeichen oder
  x-Luecke > 1.2 pt).
- Die rechten Kanten der sechs Betragsspalten kommen exakt als
  `463.7 / 526.1 / 588.4 / 662.1 / 724.5 / 786.9` heraus — identisch zu den
  in `parser.py` vermessenen Konstanten.

Damit uebertragen sich Geometriekonstanten und Spaltenzuordnung des Parsers
ohne Neuvermessung. Das groesste Risiko des Vorhabens ist abgeraeumt.

`mupdf.js` ist ein ESM-Modul mit Top-Level-await — es laeuft sowohl im Browser
als auch in Node. Das ermoeglicht automatisierte Tests des JS-Ports gegen die
Python-Referenz (siehe `tests/js/`).

## Datenhaltung

`@sqlite.org/sqlite-wasm` mit OPFS-Persistenz (Web Worker). Das Schema
(`src/gemeindefinanzen/schema.sql`) und die Analyse-Abfragen (`sql/*.sql`)
laufen unveraendert. Faellt OPFS aus (Browser ohne Unterstuetzung, fehlende
Cross-Origin-Isolation), nutzt die App automatisch eine In-Memory-Datenbank
und serialisiert sie nach IndexedDB — die Daten bleiben damit ebenfalls
ueber einen Reload erhalten.

## Lizenz

`mupdf.js` steht unter der GNU AGPL v3 (alternativ kommerziell). Dieses
Projekt ist Open Source; die AGPL-Pflicht zur Quelloffenlegung ist erfuellt.
Der vendorisierte Code unter `web/vendor/` traegt seine Original-Lizenz; ein
Hinweis steht in `web/vendor/LIZENZEN.md`.
