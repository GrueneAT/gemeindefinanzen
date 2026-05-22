# PLAN — Interaktives Mehrjahres-Dashboard

Umsetzung in atomaren Tasks. Jeder Task endet mit einem Commit
(`pba6b: <message>`). Reihenfolge einhalten — spaetere Tasks bauen auf
fruehere. Entscheidungen stehen in CONTEXT.md, Ist-Zustand in RESEARCH.md.

## Umgebung

- Python: `/tmp/pdfvenv/bin/python` (alle Abhaengigkeiten vorhanden).
- Kommandos mit `PYTHONPATH=src` ausfuehren.
- DB `data/gemeindefinanzen.db` ist vorhanden; falls nicht:
  `PYTHONPATH=src /tmp/pdfvenv/bin/python -m gemeindefinanzen.cli build documents/ --db data/gemeindefinanzen.db`.
- Dashboard-JS nach jeder Aenderung mit `node` auf Syntaxfehler pruefen.
- Qualitaetsschranke pro Task: `ruff check src tests` und `mypy src` sauber.

## Globale Vorgaben

- Oeffentliche Funktion `build_report(db_path: str, out_path: str) -> str`
  bleibt erhalten (CLI-Kompatibilitaet).
- flomotlik Design System weiter per CDN einbinden; neue Bedienelemente im
  selben Stil (Haarlinien, Papier-Optik, vier Tinten).
- Vanilla-JavaScript, kein Framework, kein Build-Schritt.
- Alle Texte/Bezeichner deutsch; keine Werkzeug-Attribution in Commits/Code.

<task id="T1" title="report/-Paket-Geruest und Datenschicht">
Aus `src/gemeindefinanzen/report.py` ein Paket `src/gemeindefinanzen/report/`
machen:
- `__init__.py` — exportiert `build_report`.
- `data.py` — `collect(db_path) -> dict`: sammelt **alle Dokumente**. Enthaelt
  (a) `dokumente`: Liste {id, typ, jahr, label, spalten-Bezeichnungen},
  (b) `posten`: kompaktes Array ALLER `v_detail`-Zeilen aller Dokumente mit
  kurzen Feldnamen (dok, typ, jahr, richtung, gebarung, gruppe, gruppe_text,
  ansatz, ansatz_text, konto, bezeichnung, mvag_eh, qu, eh_wert, eh_vergleich,
  eh_dritte, fh_wert, fh_vergleich, fh_dritte),
  (c) `aggregate`: je Dokument vorberechnete Werte fuer die Tabs (Eckwerte,
  Einnahmen-Top, Aufwand-nach-Art, Gruppen-Summen, Treiber, Transfers,
  800k-Korridor, Sankey-Knoten/Kanten),
  (d) `trend`: Zeitreihen ueber alle Dokumente (Eckwerte, Kommunalsteuer,
  Aufwand-nach-Art).
- `charts.py` — die bisherigen `chart_*`-Funktionen, an die neue Datenstruktur
  angepasst; eine Chart-Funktion bekommt Aggregatdaten als Argument.
- `html.py` — `build_report(db_path, out_path)`: ruft `collect`, baut die
  Seite, schreibt die Datei.
- `assets.py` — die statischen CSS- und JS-Bausteine als Strings.
Alte `report.py` loeschen. `pyproject.toml` pruefen (Sub-Paket wird von
`packages.find` automatisch erfasst; `schema.sql` bleibt package-data).
Akzeptanz: `PYTHONPATH=src /tmp/pdfvenv/bin/python -m gemeindefinanzen.cli
report --db data/gemeindefinanzen.db --out reports/dashboard.html` laeuft
fehlerfrei; die Datei entsteht; ruff/mypy sauber.
</task>

<task id="T2" title="HTML-Grundgeruest: Tab-Navigation und Jahr-Umschalter">
In `html.py`/`assets.py` das Dashboard-Geruest bauen:
- `<head>`: Design-System-CSS + ECharts 5.5.1 per CDN.
- Masthead (Gemeinde, Titel, kurze Einordnung).
- **Jahr-/Dokument-Umschalter**: Schaltflaechenleiste mit allen Dokumenten in
  chronologischer Reihenfolge (RA 2024, NVA 2025, RA 2025, VA 2026); ein
  aktiver Zustand. Standard: juengster Voranschlag.
- **Tab-Leiste** mit 7 Tabs (Ueberblick, Einnahmen, Ausgaben, Investitionen,
  Transfers & Umlagen, 800k-Analyse, Suche & Daten) und 7 Panels (zunaechst
  leer).
- Alle Daten aus `collect()` als ein JSON-`<script>` einbetten.
- JS in `assets.py`: Tabwechsel (Panel ein-/ausblenden, aktiver Tab),
  Dokumentwechsel (aktives Dokument merken, ein `rerender(dok)`-Hook je Tab
  aufrufen), beides ueber `data-`Attribute und Event-Delegation.
- CSS: Tab-Leiste und Umschalter im Design-System-Stil (Haarlinien,
  `--paper-raised`, Tinten fuer den aktiven Zustand). Responsiv genug fuer
  Projektor/Beamer.
Akzeptanz: Seite oeffnet, Tabs schalten um, Umschalter markiert das aktive
Dokument; `node` meldet keinen JS-Fehler im eingebetteten Skript.
</task>

<task id="T3" title="Dokumentbezogene Tabs 1-6 mit Auswertungen">
Die sechs dokumentbezogenen Tabs mit Inhalt fuellen; alle reagieren auf den
Jahr-Umschalter (`rerender(dok)`):
- **Ueberblick**: Stat-Karten (Ertraege, Aufwand, Nettoergebnis,
  Kommunalsteuer-Anteil), Wasserfall, Sankey-Geldfluss; zusaetzlich der
  Zeitreihen-Chart Eckwerte (dokumentuebergreifend, unveraendert je Umschalter).
- **Einnahmen**: Einnahmestruktur (Balken, Kommunalsteuer hervorgehoben),
  Kommunalsteuer-Zeitreihe, Tabelle der groessten Ertragsposten.
- **Ausgaben**: Aufwand-nach-Art (Ring), Treemap, Tabelle Top-Ausgaben.
- **Investitionen**: Balken/Tabelle der groessten investiven Auszahlungen.
- **Transfers & Umlagen**: Tabelle Transferaufwand mit Kennzeichnung
  Pflichtumlage/freiwillig; Aufwand-Zeitreihe.
- **800k-Analyse**: Wasserfall mit -800k-Szenario, Korridor-Chart,
  Kostentreiber-Balken, die bestehende Einordnungs-Callout.
ECharts-Instanzen je Tab verwalten (bei Tabwechsel `resize`, bei
Dokumentwechsel `setOption`). Bestehende Diagrammtypen wiederverwenden.
Akzeptanz: jeder der 6 Tabs zeigt fuer jedes Dokument plausible Inhalte;
Umschalten aktualisiert Kennzahlen und Diagramme; kein JS-Fehler.
</task>

<task id="T4" title="Tab 7: Suche und Daten">
Durchsuchbare Volltabelle aller Detailposten aller Dokumente:
- Tabelle mit allen Werten je Posten (Dokument, Richtung, Gruppe, Ansatz,
  Konto, Bezeichnung, EH wert/vergleich/dritte, FH wert/vergleich/dritte,
  MVAG, QU).
- Volltextsuche ueber Bezeichnung, Konto, Ansatz (live, entprellt).
- Filter: Dokument, Aufgabengruppe, Richtung, Gebarung (Dropdowns),
  Betragsbereich (min/max-Eingabe auf `eh_wert`).
- Spalten per Klick sortierbar (auf-/absteigend).
- Kopfzeile zeigt Trefferzahl und Summe der gefilterten Menge.
- Tabelle bei vielen Treffern begrenzen (z. B. erste 500 anzeigen, Hinweis
  auf Gesamtzahl) — Performance auf ~5.400 Zeilen muss fluessig bleiben.
Akzeptanz: Suche/Filter/Sortierung funktionieren rein clientseitig; Treffer-
und Summenanzeige stimmen; fluessig bei voller Datenmenge.
</task>

<task id="T5" title="Drill-down Gruppe -> Ansatz -> Posten">
Im Ausgaben-Tab eine navigierbare Hierarchie ergaenzen:
- Ebene 1: Aufgabengruppen (0-9) mit Summe; Klick oeffnet Ebene 2.
- Ebene 2: Ansaetze der gewaehlten Gruppe mit Summe; Klick oeffnet Ebene 3.
- Ebene 3: Einzelposten des gewaehlten Ansatzes.
- Brotkrumen-Navigation zum Zuruecksteigen.
- Reagiert auf den Jahr-Umschalter.
Die bestehende ECharts-Treemap bleibt als visuelle Alternative erhalten.
Akzeptanz: Drill-down auf- und absteigend bedienbar; Summen je Ebene
stimmen mit den Aggregaten ueberein.
</task>

<task id="T6" title="CLI, Makefile und GitHub-Pages-Ausgabe">
- `build_report` schreibt weiter an den uebergebenen Pfad; CLI-Default
  bleibt `reports/dashboard.html`.
- Make-Ziel `pages` ergaenzen: baut das Dashboard nach `site/index.html`
  (GitHub-Pages-tauglich). `site/` in `.gitignore` aufnehmen.
- Kurzer Abschnitt in `README.md`: Deployment auf GitHub Pages (Branch/Ordner
  `site/` bzw. Hinweis, `site/index.html` als Pages-Quelle zu verwenden).
Akzeptanz: `make pages` erzeugt `site/index.html`; README erklaert das
Deployment.
</task>

<task id="T7" title="Tests, Dokumentation, Qualitaetslauf">
- Test `tests/test_report.py`: `build_report` erzeugt eine Datei; das HTML
  enthaelt die 7 Tab-Kennungen und den eingebetteten JSON-Block; der
  eingebettete `<script>`-Inhalt ist mit `node --check` bzw. Ausfuehrung
  syntaktisch fehlerfrei (analog zur bestehenden Pruefpraxis).
- `docs/` aktualisieren: kurzer Abschnitt zum Dashboard (Tabs, Suche,
  Bedienung) in `README.md` oder `docs/ANALYSE-LEITFADEN.md`.
- Abschlusslauf: `make all` (bzw. die CLI-Schritte) erfolgreich; alle Tests
  gruen; `ruff check src tests` und `mypy src` sauber.
Akzeptanz: neue Tests gruen, Gesamttestlauf gruen, Linter/Typcheck sauber,
`reports/dashboard.html` und `site/index.html` werden erzeugt.
</task>

## Definition of Done

- `gemfin report` erzeugt ein interaktives Einzelseiten-Dashboard mit 7 Tabs.
- Jahr-/Dokument-Umschalter stellt die Tabs 1-6 um.
- Tab „Suche & Daten“ durchsucht/filtert/sortiert alle Posten aller Dokumente.
- Drill-down Gruppe -> Ansatz -> Posten funktioniert.
- Auf GitHub Pages deploybar (`make pages` -> `site/index.html`).
- Design System konsistent weiterverwendet.
- Tests gruen, ruff/mypy sauber, `build_report`-Signatur unveraendert.
