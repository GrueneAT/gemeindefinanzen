# RESEARCH — Statisches Browser-Dashboard

## Bestehende Python-Pipeline (die Vorlage fuer den Port)

- `src/gemeindefinanzen/extract.py` — PyMuPDF: oeffnet PDF, `page_lines()`
  gruppiert Woerter zu Zeilen, `section_ranges()` liest die Lesezeichen,
  `document_meta()` erkennt Gemeinde/Typ/Jahr aus dem Seitenkopf.
- `src/gemeindefinanzen/parser.py` — der VRV-2015-Parser. Kernlogik:
  - Geometriekonstanten: `AMOUNT_X1 = (463.7, 526.1, 588.4, 662.1, 724.5,
    786.9)`, Toleranz 7.0; x-Grenzen fuer Code/Bezeichnung/MVAG/QU.
  - `DETAIL_RE = ^(\d)/(\d{6})([+-])(\d{6})$` — Detailzeilen-Schluessel.
  - Zeilenklassifikation: detail / summe (SU) / saldo (SA) / Ansatz-Kopf /
    Gebarungs-Label / Fortsetzungszeile.
  - Betragszuordnung ueber die rechte Wortkante (`_amount_column`).
  - Deutsche Betraege (`_num`), Gebarungs-Kontext, Ruecklagen-Sonderfall
    (MVAG 230/240 -> `gebarung='ruecklage'`).
- `src/gemeindefinanzen/loader.py` — `_spalten()` (Spaltenbedeutung je
  Dokumenttyp VA/NVA/RA), Aufbau der Posten-Zeilen, Referenztabellen.
- `src/gemeindefinanzen/validate.py` — Plausibilitaetspruefung: Detailsummen
  je Ansatz gegen die SU-21/22/33/34-Zeilen.
- `src/gemeindefinanzen/reference.py` — VRV-Referenzdaten (Gruppen, MVAG).
- `src/gemeindefinanzen/schema.sql` — SQLite-Schema mit Views.
- `sql/*.sql` — 15 Analyse-Abfragen.
- `src/gemeindefinanzen/report/` — Dashboard-Erzeugung (data, charts, assets,
  html); erzeugt die statische Seite mit eingebettetem JSON.

Diese Module sind der Bauplan fuer den JS-Port. Sie sind deterministisch,
kompakt und gut testbar.

## PoC-Ergebnis: mupdf.js (durchgefuehrt)

In Node verifiziert (Skript: `poc/mupdf-geometrie.mjs`):

- npm-Paket `mupdf` installiert sich problemlos. Es ist ein ESM-Modul mit
  Top-Level-await — **nur via `import`** nutzbar, nicht `require()`.
- API: `mupdf.Document.openDocument(Uint8Array, "application/pdf")`,
  `doc.countPages()`, `doc.loadPage(n)`, `page.toStructuredText()`.
- `toStructuredText().asJSON()` -> Bloecke -> Zeilen mit bbox (zu grob fuer
  Spalten).
- `toStructuredText().walk({ onChar(c, origin, font, size, quad) })` ->
  Zeichen mit `quad` (8 Werte: ul, ur, ll, lr). Daraus Woerter rekonstruieren.
- **Verifiziert:** Die so gewonnenen Wort-x1-Werte der sechs Betragsspalten
  sind exakt 463.7/526.1/588.4/662.1/724.5/786.9 — identisch zu PyMuPDF.
  Konto, MVAG, QU werden korrekt als Woerter getrennt.

Folge: Geometriekonstanten und Spaltenzuordnung des Parsers gelten unveraendert.

## Bibliotheken

- **mupdf.js** (`mupdf`, npm) — AGPL v3 / kommerziell. WASM gebuendelt, laeuft
  in Browser und Node. Node-Lauf ermoeglicht automatisierte Tests des Ports.
- **sqlite-wasm** (`@sqlite.org/sqlite-wasm`) — offizieller Build; OPFS-Pfad
  braucht einen Web Worker. `schema.sql` + `sql/`-Abfragen unveraendert nutzbar.
- **ECharts** — bereits im Dashboard im Einsatz, per CDN.
- Design System per CDN (`design-system.css`).

## Umgebung fuer den Executor

- `node` v26, `npm` 11 vorhanden. `npm install mupdf` funktioniert.
- Python-Referenz: `/tmp/pdfvenv/bin/python` mit `PYTHONPATH=src` — zum
  Vergleich des JS-Parser-Outputs mit dem Python-Parser.
- Vier echte PDFs liegen in `documents/` (VA, NVA, 2× RA).
- Die DB `data/gemeindefinanzen.db` ist vorhanden (Referenzwerte).

## Teststrategie

Der JS-Parser ist in Node vollstaendig testbar (mupdf.js laeuft dort):
1. JS-Parser ueber jede der vier PDFs laufen lassen.
2. Ergebnis Posten-fuer-Posten gegen den Python-Parser vergleichen
   (gleiche Anzahl Detailposten, gleiche Betraege je Kontoschluessel).
3. Die portierte Plausibilitaetspruefung muss je Dokument bestehen.
Browser-spezifisches (OPFS, Drag & Drop) wird mit dem node-JS-Check und,
soweit moeglich, leichten DOM-Tests abgesichert.

## Risiken

- OPFS + Web Worker erhoeht die Architekturkomplexitaet — Fallback sql.js.
- Wortgruppierung aus Zeichen: Luecken-/Zeilentoleranzen muessen sauber
  getuned werden (im PoC mit Luecke > 1.2 pt und y-Toleranz 3 pt bereits
  erfolgreich).
- mupdf.js-Performance bei ~280 Seiten: im Node-PoC unproblematisch; im
  Browser mit Fortschrittsanzeige abfedern.
