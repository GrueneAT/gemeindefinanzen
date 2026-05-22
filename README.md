# Gemeindefinanzen

Analyse österreichischer Gemeindevoranschläge und Rechnungsabschlüsse.

Wandelt das PDF eines Voranschlags (VRV 2015) in eine abfragbare Datenbank um,
prüft die Daten gegen die im PDF abgedruckten Summen, beantwortet konkrete
Finanzfragen per SQL und erzeugt ein lesbares HTML-Dashboard.

> Gebaut am Voranschlag 2026 der Stadtgemeinde Herzogenburg, funktioniert aber
> für jeden VA / NVA / Rechnungsabschluss im bundesweiten VRV-2015-Format.

## Warum

Ein Voranschlag ist ein 250-Seiten-PDF mit tausenden Zahlen — korrekt, aber
für Entscheidungen kaum nutzbar. Dieses Projekt macht daraus eine strukturierte
Datengrundlage: vergleichbar über Jahre, prüfbar, abfragbar, visualisierbar.
Leitfrage des ersten Ausbaus: **Wo im Budget lässt sich ein dauerhafter
Kommunalsteuer-Ausfall von 800.000 Euro auffangen?**

## Pipeline

```
documents/*.pdf   VA / NVA / RA — beliebig viele
      │  extract   PyMuPDF — Text + Koordinaten
      │  parser    VRV-2015-Detailnachweis → strukturierte Posten
      ▼
data/gemeindefinanzen.db   SQLite — ein Datenmodell, alle Dokumente nebeneinander
      │  validate  Detailposten gegen die PDF-Summen geprüft (je Dokument)
      │  query     Analyse-Bibliothek in sql/
      │  report    interaktives Dashboard (Tabs, Umschalter, Suche, Drill-down)
      ▼
reports/dashboard.html   bzw. site/index.html (GitHub Pages)
```

## Schnellstart

Im Container (`Dockerfile.claude`) sind alle Werkzeuge vorhanden. Sonst:

```sh
make setup          # Abhängigkeiten installieren
```

Dann die ganze Pipeline:

```sh
make all            # db + validate + report
```

Oder einzeln:

```sh
make db             # alle PDFs in documents/ → data/gemeindefinanzen.db
make validate       # Plausibilitätsprüfung (je Dokument)
make queries        # alle Analyse-Abfragen ausgeben
make report         # reports/dashboard.html erzeugen
make pages          # site/index.html für GitHub Pages erzeugen
make export         # CSV + Excel nach data/
```

Direkt über die CLI:

```sh
gemfin build documents/ --db data/gemeindefinanzen.db        # alle PDFs
gemfin build documents/VA-2026-Auflage.pdf --db data/...     # einzelne Datei(en)
gemfin validate --db data/gemeindefinanzen.db
gemfin query    --db data/gemeindefinanzen.db --name 05   # nur die 800k-Abfrage
gemfin report   --db data/gemeindefinanzen.db --out reports/dashboard.html
```

## Weitere Dokumente

Das Schema ist mehrdokument-fähig: VA, NVA und RA mehrerer Jahre liegen in
derselben Datei nebeneinander und werden direkt vergleichbar. Neue PDFs
einfach nach `documents/` legen und `make db` erneut ausführen — `build`
verarbeitet ein ganzes Verzeichnis und ist idempotent (erneutes Einlesen
derselben Datei ersetzt sie, statt zu duplizieren).

Die drei Betragsspalten bedeuten je Dokumenttyp etwas anderes (VA: Plan;
RA: Ist gegen Soll) — das Datenmodell trennt das sauber, siehe
[`docs/SCHEMA.md`](docs/SCHEMA.md).

## Das Dashboard

`make report` erzeugt eine einzelne, interaktive HTML-Seite — kein Server,
keine Live-Datenbankabfragen im Browser. Alle Posten aller Dokumente sind als
JSON eingebettet, die gesamte Bedienung läuft clientseitig in Vanilla-JavaScript.

- **Sieben Themen-Tabs:** Überblick, Einnahmen, Ausgaben, Investitionen,
  Transfers & Umlagen, 800k-Analyse, Suche & Daten.
- **Jahr-/Dokument-Umschalter:** stellt die sechs dokumentbezogenen Tabs auf
  RA 2024, RA 2025, VA 2025 inkl. NVA oder VA 2026 um.
- **Suche & Daten:** Volltextsuche über Bezeichnung, Konto und Ansatz, Filter
  nach Dokument, Aufgabengruppe, Richtung, Gebarung und Betragsbereich,
  sortierbare Spalten, Treffer- und Summenanzeige.
- **Drill-down** im Ausgaben-Tab: Aufgabengruppe → Ansatz → Einzelposten mit
  Brotkrumen-Navigation.
- **Mehrjahres-Vergleich:** einzelne Posten in der Suchtabelle ankreuzen und
  als Liniendiagramm über alle Dokumente betrachten (eine Linie je Posten,
  gematcht über Ansatz + Konto); die gesamte gefilterte Menge als eine
  aggregierte Gruppen-Linie; je Gruppe und Ansatz im Drill-down eine
  „über die Jahre“-Aktion.

### Deployment auf GitHub Pages

`make pages` baut das Dashboard nach `site/index.html` — fertig für GitHub
Pages. Die Seite ist eigenständig (CSS, Schrift und ECharts kommen per CDN).

Im Repository-Setup unter **Settings → Pages** als Quelle einen Branch und den
Ordner `/site` wählen, oder `site/index.html` per Workflow in den
Pages-Branch publizieren. Der Ordner `site/` ist `.gitignore`-t und wird bei
jedem `make pages` neu erzeugt.

## Browser-App — VRV-PDFs ohne Server auswerten

Unter `web/` liegt eine reine statische Website: Sie laden VRV-2015-PDFs per
Drag & Drop hoch, **Textextraktion, Parsing und Auswertung laufen vollständig
im Browser**. Kein Server, kein Upload ins Netz, keine Konten.

- PDF-Extraktion über [`mupdf.js`](https://github.com/ArtifexSoftware/mupdf.js)
  — dieselbe Engine wie PyMuPDF, deshalb identische Wort-Geometrie.
- Der VRV-Parser und die Plausibilitätsprüfung sind nach JavaScript portiert
  und liefern nachweislich dasselbe Ergebnis wie die Python-Pipeline.
- Speicherung über `sqlite-wasm` (OPFS) — der Stand bleibt über einen Reload
  erhalten. `schema.sql` und die `sql/`-Abfragen laufen unverändert.
- Das Dashboard arbeitet auf den hochgeladenen Daten.

Lokal testen:

```sh
make web-deps       # mupdf.js und sqlite-wasm installieren (einmalig)
make web-test       # JS-Tests gegen die vier PDFs in documents/
make web-serve      # http://localhost:8080/web/ — Upload-Oberflaeche
```

Die Seite ist ohne Build-Schritt GitHub-Pages-tauglich — der Ordner `web/`
enthält alles (Bibliotheken vendorisiert unter `web/vendor/`). `make web-sync`
hält `web/schema.sql` und `web/sql/` mit der Python-Quelle synchron. Details:
[`docs/BROWSER-APP.md`](docs/BROWSER-APP.md).

## Aufbau

| Pfad | Inhalt |
|------|--------|
| `src/gemeindefinanzen/` | Python-Paket (extract, parser, loader, validate) |
| `src/gemeindefinanzen/report/` | Dashboard-Erzeugung (data, charts, assets, html) |
| `src/gemeindefinanzen/schema.sql` | SQLite-Schema mit Views |
| `scripts/check_dashboard_js.py` | prüft das eingebettete Dashboard-JS mit node |
| `web/` | statische Browser-App (clientseitiges PDF-Parsing) |
| `tests/js/` | JS-Tests der Browser-App |
| `sql/` | Analyse-Abfragen — eine Datei je Fragestellung |
| `docs/` | Format-, Schema- und Analyse-Dokumentation |
| `tests/` | Parser-Tests |
| `Dockerfile.claude` | Container mit allen Werkzeugen |

## Dokumentation

- [`docs/VRV-2015-FORMAT.md`](docs/VRV-2015-FORMAT.md) — Aufbau eines Voranschlags, Kontoschlüssel, Begriffe
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — Datenbankschema und Views
- [`docs/ANALYSE-LEITFADEN.md`](docs/ANALYSE-LEITFADEN.md) — die Abfragen und die 800.000-Euro-Methodik
- [`docs/BROWSER-APP.md`](docs/BROWSER-APP.md) — die statische Browser-App, Architektur und Deployment

## Belastbarkeit

Der Parser arbeitet rein deterministisch — kein LLM, keine Heuristik-Schätzung.
`gemfin validate` rechnet die Detailposten gegen die im PDF abgedruckten
Summenzeilen: Stimmen alle Ansatz-Summen, ist die Extraktion nachweislich
korrekt. Diese Prüfung läuft bei jedem `make all` mit.

Das Werkzeug bereitet Zahlen auf und macht sie sichtbar — es trifft **keine**
rechtlichen oder politischen Wertungen. Die 800.000-Euro-Auswertung ist eine
Suchhilfe, keine Empfehlung.
