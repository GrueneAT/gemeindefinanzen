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
      │  report    HTML-Dashboard (Zeitreihe, Sankey, Treemap, Wasserfall)
      ▼
reports/dashboard.html
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

## Aufbau

| Pfad | Inhalt |
|------|--------|
| `src/gemeindefinanzen/` | Python-Paket (extract, parser, loader, validate, report) |
| `src/gemeindefinanzen/schema.sql` | SQLite-Schema mit Views |
| `sql/` | Analyse-Abfragen — eine Datei je Fragestellung |
| `docs/` | Format-, Schema- und Analyse-Dokumentation |
| `tests/` | Parser-Tests |
| `Dockerfile.claude` | Container mit allen Werkzeugen |

## Dokumentation

- [`docs/VRV-2015-FORMAT.md`](docs/VRV-2015-FORMAT.md) — Aufbau eines Voranschlags, Kontoschlüssel, Begriffe
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — Datenbankschema und Views
- [`docs/ANALYSE-LEITFADEN.md`](docs/ANALYSE-LEITFADEN.md) — die Abfragen und die 800.000-Euro-Methodik

## Belastbarkeit

Der Parser arbeitet rein deterministisch — kein LLM, keine Heuristik-Schätzung.
`gemfin validate` rechnet die Detailposten gegen die im PDF abgedruckten
Summenzeilen: Stimmen alle Ansatz-Summen, ist die Extraktion nachweislich
korrekt. Diese Prüfung läuft bei jedem `make all` mit.

Das Werkzeug bereitet Zahlen auf und macht sie sichtbar — es trifft **keine**
rechtlichen oder politischen Wertungen. Die 800.000-Euro-Auswertung ist eine
Suchhilfe, keine Empfehlung.
