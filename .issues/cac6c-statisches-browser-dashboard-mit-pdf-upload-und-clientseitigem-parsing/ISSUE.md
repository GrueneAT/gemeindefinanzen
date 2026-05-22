---
id: cac6c
title: Statisches Browser-Dashboard mit PDF-Upload und clientseitigem Parsing
status: done
priority: high
labels:
- dashboard
- browser
- wasm
- frontend
---

## Kontext

Das interaktive Dashboard (Issue pba6b) hat die Daten zur Build-Zeit fest
eingebettet: `report.py` liest die SQLite-DB und backt das JSON in die
HTML-Seite. Wer eigene Voranschlaege auswerten will, braucht heute die
Python-Pipeline (PyMuPDF, Parser, SQLite).

Ziel: eine **reine statische Website**, auf der jeder seine eigenen
VRV-2015-Dokumente (Voranschlag, Nachtragsvoranschlag, Rechnungsabschluss)
**per Drag & Drop hochlaedt** — Textextraktion, Parsing und Auswertung laufen
vollstaendig **im Browser**, ohne Server. Die geparsten Daten werden lokal
gespeichert und beim naechsten Besuch wiederverwendet. So kann jede Gemeinde
das Werkzeug ohne Installation nutzen.

## Entschiedener Stack (recherchiert)

- **PDF-Extraktion: `mupdf.js`** (npm `mupdf`, Artifex). WASM-Build derselben
  Engine wie das bestehende Python-Werkzeug (PyMuPDF = MuPDF). `toStructuredText`
  liefert Bloecke/Zeilen/Woerter mit Bounding-Boxes — dasselbe Datenmodell wie
  PyMuPDFs `get_text("words")`. Lizenz: AGPL v3 (frei fuer Open-Source) oder
  kommerziell — die AGPL-Eignung ist im PoC zu bestaetigen.
- **Parser: nach JavaScript portiert.** Die VRV-2015-Parser-Logik (Spalten-
  geometrie ueber rechte Kanten, Zeilenklassifikation, Gebarungs-Kontext) wird
  von `src/gemeindefinanzen/parser.py` nach JS uebersetzt. Weil mupdf.js
  engine-gleich ist, uebertragen sich Logik und gemessene Spaltenkonstanten
  weitgehend 1:1.
- **Speicher/DB: offizielles `sqlite-wasm` + OPFS.** `schema.sql` und die
  Abfragen aus `sql/` laufen unveraendert im Browser; OPFS persistiert die DB.
  Fallback: `sql.js` (In-Memory, Serialisierung nach IndexedDB), falls die
  Web-Worker-Architektur von OPFS unverhaeltnismaessig wird.
- Reine statische Seite, GitHub-Pages-tauglich; Bibliotheken vendorisiert oder
  per CDN.

## Architektur

```
PDF-Upload  -> mupdf.js (WASM)   -> Woerter + Koordinaten   [wie PyMuPDF]
            -> VRV-Parser (JS)   -> strukturierte Posten     [Logik aus parser.py]
            -> sqlite-wasm + OPFS -> schema.sql + sql/*.sql   [unveraendert]
            -> Dashboard (Tabs/Suche/Charts)                  [aus pba6b]
```

## Abhaengigkeit

Baut auf dem Dashboard aus Issue **pba6b** auf (Tabs, Suche, Drill-down,
Mehrjahres-Vergleich). pba6b sollte zuerst abgeschlossen/gemergt sein.

## Aufgaben

### Task 1 — Proof of Concept (zuerst, blockierend)
mupdf.js an einem echten Voranschlags-PDF im Browser erproben:
- mupdf.js laedt und extrahiert strukturierten Text mit Koordinaten.
- Die Spaltengeometrie des Detailnachweises (rechte Kanten der sechs
  Betragsspalten) wird in mupdf.js-Koordinaten vermessen und mit den
  Python-Werten verglichen.
- Wortgruppierung (mupdf.js-Items -> Woerter wie PyMuPDFs `words`) verifizieren.
- AGPL-v3-Eignung fuer eine oeffentliche Open-Source-Seite bestaetigen.
Ergebnis: ein kurzer Befund + Mini-Demo. Erst wenn der PoC die Geometrie
sauber trifft, werden die weiteren Tasks gebaut.

### Weitere Tasks (nach erfolgreichem PoC zu detaillieren)
- VRV-2015-Parser nach JavaScript portieren (inkl. der Plausibilitaetspruefung
  als clientseitige Selbstkontrolle je Dokument).
- sqlite-wasm + OPFS einbinden; `schema.sql` und `sql/`-Abfragen laden.
- Upload-UI: Drag & Drop, Mehrfach-Upload, Fortschrittsanzeige, Fehlerbilder.
- Dokumentverwaltung: geladene Dokumente auflisten, entfernen, persistent
  halten; erneuter Besuch laedt den Stand aus OPFS.
- Dashboard aus pba6b an die Browser-Datenquelle anbinden.
- Build/Deployment als statische Seite (GitHub Pages); Bibliotheken einbinden.
- Tests und Dokumentation.

## Akzeptanzkriterien

- [ ] Task-1-PoC zeigt: mupdf.js extrahiert den Detailnachweis im Browser, die
      Spaltengeometrie ist verlaesslich; AGPL-Eignung bestaetigt
- [ ] Nutzer kann ein oder mehrere VRV-2015-PDFs per Drag & Drop hochladen
- [ ] Textextraktion und VRV-Parsing laufen vollstaendig clientseitig (kein Server)
- [ ] Die clientseitige Plausibilitaetspruefung bestaetigt je Dokument die
      korrekte Extraktion (Detailsummen == PDF-Summenzeilen)
- [ ] Geparste Daten werden lokal persistiert und beim naechsten Besuch geladen
- [ ] Das Dashboard (Tabs, Suche, Drill-down, Mehrjahres-Vergleich) arbeitet auf
      den hochgeladenen Daten
- [ ] Reine statische Seite, auf GitHub Pages deploybar, kein Server
- [ ] Tests gruen, Linter/Typcheck sauber

## Nicht-Ziele

- Kein Server, kein Backend, keine Benutzerkonten.
- Die bestehende Python-Pipeline bleibt erhalten (sie bleibt die Referenz mit
  der Validierungs-Suite); die Browser-App ist eine zusaetzliche Variante.
