# Browser-App — VRV-PDFs clientseitig auswerten

Unter `web/` liegt eine reine statische Website mit einer einzigen Seite
(`web/index.html`). Der Nutzer laedt VRV-2015-PDFs per Drag & Drop hoch;
Textextraktion, Parsing, Validierung und Auswertung laufen vollstaendig im
Browser. Es gibt keinen Server, kein Backend, keine Konten — die PDFs
verlassen den Rechner nicht.

Dokumentverwaltung (Upload, geladene Dokumente) und Finanz-Dashboard liegen
auf derselben Seite: die Verwaltung oben, darunter das Dashboard. Beide
teilen sich dieselbe geoeffnete In-Memory-Datenbank — es gibt keinen
Seitenwechsel.

Die bestehende Python-Pipeline (`src/`, `report/`, `sql/`, `tests/`) bleibt
unveraendert die Referenz. Die Browser-App ist additiv.

## Architektur

```
PDF (Drag & Drop)
   │  extract.js   mupdf.js (WASM) — Text + Wort-Koordinaten
   │  parser.js    VRV-2015-Detailnachweis -> strukturierte Posten
   │  validate.js  Detailposten gegen die PDF-Summen geprueft
   │  db.js        sqlite-wasm — schema.sql + sql/-Abfragen unveraendert
   ▼
IndexedDB (lokale Persistenz im Browser)
   │  dashboard-data.js / dashboard-charts.js  -> DATA + CFG
   ▼
index.html   Dokumentverwaltung + Dashboard (Tabs, Umschalter, Suche,
             Drill-down, Charts) auf einer Seite
```

### Module unter `web/js/`

| Datei | Port von | Aufgabe |
|-------|----------|---------|
| `extract.js` | `extract.py` | PDF oeffnen, Woerter und Zeilen, Metadaten |
| `parser.js` | `parser.py` | VRV-2015-Detailnachweis parsen |
| `reference.js` | `reference.py` | VRV-Gruppen, MVAG, Querschnitt |
| `loader.js` | `loader.py` (rein) | Spaltenbedeutung, Datensaetze aufbereiten |
| `validate.js` | `validate.py` | Plausibilitaetspruefung (SU-21/22/33/34) |
| `db.js` | `loader.py` (DB) | sqlite-wasm, Persistenz, Schreib-/Leselogik |
| `pipeline.js` | — | bindet die Schritte zu einem Durchlauf zusammen |
| `dashboard-data.js` | `report/data.py` | DATA-Objekt aus der DB sammeln |
| `dashboard-charts.js` | `report/charts.py` | ECharts-Optionen (CFG) bauen |
| `app.js` | — | Seiten-Controller: Dokumentverwaltung + Dashboard |
| `dashboard-app.js` | `report/html.py` | `baueDashboard(db)` — Dashboard aufbauen |

`web/vendor/dashboard/dashboard.css` und `dashboard.js` sind die **verbatim**
aus dem Python-Report (`report/assets.py`) uebernommenen Darstellungs-Assets.
Die Browser-App liefert ihnen dieselben `DATA`/`CFG`-Objekte wie die
Python-Pipeline — das Dashboard verhaelt sich damit identisch.

## Korrektheitsnachweis

mupdf.js ist dieselbe Engine wie PyMuPDF und laeuft auch in Node. Der JS-Port
wird deshalb in Node gegen den Python-Parser geprueft:

- `npm run test:js` (bzw. `make web-test`) parst alle vier PDFs in
  `documents/` und vergleicht Posten, Betraege und Pruefstatus gegen die
  Python-Referenzwerte.
- Die portierte Plausibilitaetspruefung besteht je Dokument 5/5 (20/20
  gesamt) — identisch zur Python-Seite.
- Die Dashboard-Objekte `DATA` und `CFG` sind byte-gleich zu denen, die
  `report/data.py` und `report/charts.py` erzeugen.

## Datenhaltung

`@sqlite.org/sqlite-wasm` als In-Memory-Datenbank mit **IndexedDB-Persistenz**:
der Datenbank-Inhalt wird als Byte-Array (`sqlite3_js_db_export`) nach
IndexedDB gesichert und beim naechsten Oeffnen ueber `sqlite3_deserialize`
wiederhergestellt. `db.sichern()` schreibt den Stand nach jedem Upload und
nach jedem Entfernen eines Dokuments.

IndexedDB ist in jedem Kontext verfuegbar — es braucht weder OPFS noch
Cross-Origin-Isolation (COOP/COEP) noch einen besonderen sicheren Kontext.
Damit funktioniert die Persistenz zuverlaessig ueber `http://localhost` und
auf GitHub Pages. In Node (Testumgebung) ist `indexedDB` undefiniert — dann
arbeitet die App ohne Fehler als reine In-Memory-DB.

## Bibliotheken

Alle Bibliotheken sind vendorisiert (`web/vendor/`), damit die Seite ohne
Build-Schritt deploybar ist:

- `mupdf.js` — PDF-Extraktion. **GNU AGPL v3** (alternativ kommerziell).
  Das Projekt ist Open Source; die AGPL-Pflicht ist erfuellt. Siehe
  `web/vendor/LIZENZEN.md`.
- `sqlite-wasm` — SQLite als WebAssembly, Public Domain.
- ECharts und das flomotlik Design System kommen per CDN.

## Lokal ausfuehren

```sh
make web-deps    # mupdf.js und sqlite-wasm installieren (einmalig)
make web-test    # JS-Tests gegen die vier PDFs in documents/
make web-serve   # statischer Server: http://localhost:8080/web/
```

`make web-serve` ruft zuerst `make web-sync` auf — das kopiert
`src/gemeindefinanzen/schema.sql` nach `web/schema.sql` und die `sql/`-Dateien
nach `web/sql/`. Diese Kopien machen `web/` eigenstaendig deploybar; die
Python-Dateien bleiben die Quelle.

## GitHub Pages

`web/` ist ohne Build-Schritt eine fertige statische Seite. Im Repository
unter **Settings -> Pages** einen Branch und den Ordner waehlen, der `web/`
enthaelt — oder den Inhalt von `web/` in den Pages-Branch publizieren.

Wichtig: Vor dem Deployment `make web-sync` ausfuehren, damit
`web/schema.sql` und `web/sql/` aktuell sind.
