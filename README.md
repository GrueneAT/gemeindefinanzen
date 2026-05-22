# Gemeindefinanzen

Österreichische Gemeindevoranschläge und Rechnungsabschlüsse (VRV 2015)
auswerten — im Browser, ohne Server.

Ein Voranschlag ist ein PDF mit hunderten Seiten und tausenden Zahlen:
korrekt, aber für Entscheidungen kaum nutzbar. Dieses Werkzeug wandelt
VRV-2015-Dokumente in eine strukturierte, durchsuchbare Datengrundlage um und
stellt sie als interaktives Dashboard dar — vergleichbar über Jahre, prüfbar,
visualisiert.

Funktioniert für jeden Voranschlag (VA), Nachtragsvoranschlag (NVA) und
Rechnungsabschluss (RA) im bundesweiten VRV-2015-Format.

## Die Browser-App

Unter `web/` liegt eine reine **statische Website** (eine Seite,
`web/index.html`). PDFs per Drag & Drop hochladen — **Textextraktion, Parsing,
Prüfung und Auswertung laufen vollständig im Browser**. Kein Server, kein
Upload ins Netz, keine Konten.

- PDF-Extraktion über [`mupdf.js`](https://github.com/ArtifexSoftware/mupdf.js)
  — dieselbe Engine wie PyMuPDF, deshalb identische Wort-Geometrie.
- VRV-Parser und Plausibilitätsprüfung laufen clientseitig (JavaScript).
- Speicherung über `sqlite-wasm` mit **IndexedDB-Persistenz**: der Stand bleibt
  über Reloads und Besuche erhalten, Dokumente lassen sich nach und nach
  ergänzen.
- Dokumentverwaltung und Dashboard auf **einer Seite** — die Verwaltung oben
  (einklappbar), darunter das Dashboard.

**Dashboard:** sieben Themen-Tabs (Überblick, Einnahmen, Ausgaben,
Investitionen, Transfers & Umlagen, Sparpotenzial, Suche & Daten), ein
Dokument-Umschalter für den Jahresvergleich, Volltextsuche und Filter über
alle Posten, Drill-down Aufgabengruppe → Ansatz → Posten sowie ein
Mehrjahres-Vergleich einzelner Posten oder Gruppen als Liniendiagramm.

### Lokal starten

```sh
make web-deps     # mupdf.js und sqlite-wasm installieren (einmalig)
make web-docker   # Server im Container → http://localhost:8080/web/
make web-test     # JS-Tests gegen die PDFs in documents/
```

Die Seite ist ohne Build-Schritt **GitHub-Pages-tauglich** — der Ordner `web/`
enthält alles, Bibliotheken vendorisiert unter `web/vendor/`. Details:
[`docs/BROWSER-APP.md`](docs/BROWSER-APP.md).

## Python-CLI — Datenpipeline und Referenz

Der `gemfin`-CLI parst dieselben PDFs serverseitig (PyMuPDF). Er ist die
**Referenzimplementierung**, gegen die der JavaScript-Parser geprüft wird, und
erlaubt SQL-Auswertungen und Exporte:

```sh
gemfin build documents/ --db data/gemeindefinanzen.db   # PDFs → SQLite
gemfin validate --db data/gemeindefinanzen.db           # Plausibilitätsprüfung
gemfin query    --db data/gemeindefinanzen.db           # Analyse-Abfragen
gemfin export   --db data/gemeindefinanzen.db           # CSV / Excel
```

Das Schema ist **mehrdokument-fähig**: VA, NVA und RA mehrerer Jahre liegen in
derselben Datei nebeneinander und werden direkt vergleichbar. Die drei
Betragsspalten bedeuten je Dokumenttyp etwas anderes (VA: Plan; RA: Ist gegen
Soll) — das Datenmodell trennt das sauber, siehe
[`docs/SCHEMA.md`](docs/SCHEMA.md).

## Belastbarkeit

Der Parser arbeitet rein deterministisch — kein LLM, keine Heuristik-Schätzung.
Die Plausibilitätsprüfung rechnet die Detailposten gegen die im PDF
abgedruckten Summenzeilen: Stimmen alle Ansatz-Summen, ist die Extraktion
nachweislich korrekt. Sie läuft auf beiden Seiten (Python und Browser) und im
Test gegen die echten PDFs.

Das Werkzeug bereitet Zahlen auf und macht sie sichtbar — es trifft **keine**
rechtlichen oder politischen Wertungen.

## Aufbau

| Pfad | Inhalt |
|------|--------|
| `web/` | statische Browser-App — clientseitiges PDF-Parsing und Dashboard |
| `src/gemeindefinanzen/` | Python-Paket (extract, parser, loader, validate) |
| `src/gemeindefinanzen/schema.sql` | SQLite-Schema mit Views |
| `sql/` | Analyse-Abfragen — eine Datei je Fragestellung |
| `tests/` | Python-Tests; `tests/js/` JS-Tests der Browser-App |
| `docs/` | Format-, Schema- und Analyse-Dokumentation |
| `documents/` | Beispiel-PDFs (VRV-2015-Dokumente) |
| `Dockerfile.claude` | Container mit allen Werkzeugen |

## Dokumentation

- [`docs/VRV-2015-FORMAT.md`](docs/VRV-2015-FORMAT.md) — Aufbau eines Voranschlags, Kontoschlüssel, Begriffe
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — Datenbankschema und Views
- [`docs/ANALYSE-LEITFADEN.md`](docs/ANALYSE-LEITFADEN.md) — die SQL-Abfragen und die Analyse-Methodik
- [`docs/BROWSER-APP.md`](docs/BROWSER-APP.md) — die Browser-App: Architektur und Deployment
