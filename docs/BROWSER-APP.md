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
| `vergleich-daten.js` | — | Diff zweier Dokumente (rein rechnend) |
| `vergleich.js` | — | Oberflaeche des Vergleichs-Tabs |

`web/css/dashboard.css` und `web/js/dashboard.js` sind die **verbatim**
aus dem Python-Report (`report/assets.py`) uebernommenen Darstellungs-Assets.
Die Browser-App liefert ihnen dieselben `DATA`/`CFG`-Objekte wie die
Python-Pipeline — das Dashboard verhaelt sich damit identisch.

## Korrektheitsnachweis

mupdf.js ist dieselbe Engine wie PyMuPDF und laeuft auch in Node. Der JS-Port
wird deshalb in Node gegen den Python-Parser geprueft:

- `npm run test:js` (bzw. `make web-test`) parst alle fuenf Herzogenburg-PDFs
  in `documents/` und vergleicht Posten, Betraege und Pruefstatus gegen die
  Python-Referenzwerte.
- Die portierte Plausibilitaetspruefung besteht je Dokument 5/5 (20/20
  gesamt) — identisch zur Python-Seite.
- Die Dashboard-Objekte `DATA` und `CFG` sind byte-gleich zu denen, die
  `report/data.py` und `report/charts.py` erzeugen.

## Dokumenttypen: Reihenfolge und Vergleich

Ein Finanzjahr durchlaeuft immer dieselben Stufen, und in dieser Reihenfolge
sortiert die App ueberall — Umschalter, Achsen, Dokumentliste, Vorbelegung:

| Stufe | wann | Spalte 1 | Spalte 2 | Spalte 3 |
|-------|------|----------|----------|----------|
| **VA** Voranschlag | im Vorjahr beschlossen | VA Jahr | VA Vorjahr | RA Vorvorjahr |
| **NVA** Nachtragsvoranschlag | im laufenden Jahr | VA Jahr inkl. NVA | VA Jahr | 1. NVA |
| **RA** Rechnungsabschluss | nach Jahresende | RA Jahr (Ist) | VA Jahr | Abweichung RA-VA |

Der Rang steht einmal in `reference.js` (`TYP_RANG`, `TYP_ORDER_SQL`,
`typRang`, `vergleicheDokumente`) und wird von `dashboard-data.js` und `db.js`
von dort bezogen. Alphabetisch nach Typ zu sortieren waere NVA, RA, VA — also
genau verkehrt. Die Vorbelegung des Dashboards ist das juengste **gueltige**
Planungsdokument: liegt zu einem Voranschlag ein Nachtrag vor, gewinnt der
Nachtrag.

### Der Vergleich zweier Dokumente

Der Vergleichs-Tab stellt zwei Dokumente gegeneinander — Haushaltsstelle fuer
Haushaltsstelle. Der Schluessel ist das VRV-Tripel **(Ansatz, Konto,
Richtung)**; im Detailnachweis eines PDF kommt jede Kombination genau einmal
vor, der Vergleich ist damit exakt und braucht kein Namens-Matching.

Aggregiert wird trotzdem, aus einem Formatgrund: ein OH-CSV-Dokument fuehrt
Ergebnis- und Finanzierungshaushalt in **getrennten** Zeilen, ein PDF-Dokument
beide Haelften in **einer**. Die Summe je Schluessel und Haushaltshaelfte ist
in beiden Faellen dieselbe Zahl.

Ergebnis- und Finanzierungshaushalt werden getrennt gerechnet und nie addiert;
der Tab hat dafuer einen eigenen Umschalter.

**Selbstkontrolle.** Jedes Dokument druckt seine Vergleichszahl mit ab (Spalte
2 der Tabelle oben). Ist das Basisdokument des Vergleichs genau dieses
Dokument — ein Nachtrag gegen den Voranschlag desselben Jahres, ein
Voranschlag gegen den des Vorjahres —, rechnet `kontrolle()` die geladene
Basis gegen die abgedruckte Spalte nach. Der Diff ist dann belegt und nicht
nur plausibel.

Weicht es ab, ist das in der Praxis eine **Fassungsfrage**: die zur Auflage
aufgelegte Version eines Voranschlags ist nicht die beschlossene, und der
Nachtrag rechnet gegen die beschlossene. Die Herzogenburg-Fixtures zeigen
genau das — `VA-2026-Auflage.pdf` kennt die Community Nurse noch nicht
(Aufwand 100.600, Ertrag 100.000), die Vergleichsspalte des
`NVA-2026-Auflage.pdf` schon. Die beschlossene Fassung liegt als OH-CSV-Paar
(`offenerhaushalt_31912_2026_va_*.csv`) daneben und stimmt mit der
Vergleichsspalte des Nachtrags auf allen Haushaltsstellen ueberein.

Der Rechnungsabschluss bleibt von der Kontrolle bewusst ausgenommen: seine
Spalte 2 ist das Soll, und das kann den Nachtrag schon enthalten — welches
Dokument gemeint ist, laesst sich aus dem Seitenkopf nicht entscheiden.

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
