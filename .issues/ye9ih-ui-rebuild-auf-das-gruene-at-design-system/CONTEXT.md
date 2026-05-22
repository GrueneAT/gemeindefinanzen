# CONTEXT — ye9ih UI-Rebuild auf das Gruene-AT-Design-System

## Ausgangslage

Die Browser-App (`web/`) nutzt heute das persoenliche flomotlik-Design-System
(redaktionelle Papier-Optik, Randspalten mit Kicker-Nummern, Margin-Notes,
Masthead). Sie soll auf das org-weite Gruene-AT-Design-System umgebaut werden:

- Design-System: https://grueneat.github.io/design-system/
- Stylesheet (per Link, **kein Vendoring**):
  https://grueneat.github.io/design-system/design-system.css

## Befunde aus der Codebasis

### Python-Seite ist gegenstandslos

Das Issue nennt eine „Python-Paritaet" ueber `html.py`/`report.py`. Diese
Dateien **existieren nicht (mehr)**. `src/gemeindefinanzen/` enthaelt nur noch
`cli.py, exporter.py, extract.py, loader.py, parser.py, reference.py,
validate.py` — Parsing, Extraktion, Validierung, CSV/Excel-Export. Es gibt
keine HTML-/ECharts-/INK-Erzeugung in Python. **Das Issue ist damit ein reines
`web/`-Vorhaben.** Die Akzeptanzkriterien `pytest -q`, `ruff`, `mypy` bleiben
gruen, weil Python unberuehrt bleibt — sie sind reine Regressionsschranken.

### Betroffener Web-Umfang

- `web/index.html` (355 Z.) — DS-Stylesheet statt flomotlik; Inline-`<style>`
  mit hartkodierten Farben (`#8E2F2A`, Fallbacks `--rule-hair`,
  `--paper-raised`); Markup-Klassen.
- `web/css/app.css` (291 Z.) — „Erweitert das flomotlik Design System"; auf
  DS-Tokens umstellen.
- `web/vendor/dashboard/dashboard.css` (130 Z.) — Dashboard-Styling.
- `web/js/dashboard-charts.js`, `web/js/sankey-drill.js` — die `INK`-Paletten
  der Diagramme.
- flomotlik-Referenzen heute: `index.html:9` (Stylesheet-Link),
  `app.css:2` (Kommentar), `vendor/LIZENZEN.md:29`.

## Geklaerte Entscheidung

### Layout-Tiefe: voll auf DS-Komponenten

Die redaktionelle Randspalten-Struktur (`.kicker`, `.kicker-num`,
`.margin-note`, `.masthead-*`, das `.row`/`.margin`/`.body`-Geruest) **entfaellt**.
Header/Navigation, Buttons, Cards, Container und Grid kommen durchgaengig aus
dem Gruene-AT-DS (`.gat-header`/`.gat-nav`, `.gat-btn`, `.gat-card`,
`.gat-container`, `.gat-grid`). Das bedeutet den groesseren Markup-Umbau in
`index.html`, dafuer klare DS-Konformitaet. Die Abschnittsaufteilung/Spaltenzahl
bleibt frei auf das VRV-Analysetool zugeschnitten.

## Offene Punkte fuer die Recherche

- **Erweiterte kategoriale Diagramm-Palette:** Das DS definiert 5 Markenfarben
  (Dunkelgruen `#257639`, Hellgruen `#56af31`, Gelb `#ffed00`, Magenta
  `#e6007e`, Anthrazit `#1d1d1b`). Sankey/Treemap/Mehrserien-Diagramme brauchen
  mehr unterscheidbare Kategorien. Recherche klaeren: Bietet das DS-CSS eine
  fertige Data-Viz-/Chart-Palette? Wenn nein, eine Palette aus Toenen/Tints der
  Markenfarben ableiten (Serien muessen unterscheidbar bleiben).
- **Schrift-Einbindung:** Klaeren, ob das DS-CSS die Fonts (Barlow Semi
  Condensed, Vollkorn) selbst per `@font-face`/Import laedt oder ob die App
  Font-Links setzen muss. Heutige `fonts.googleapis.com`-Preconnects pruefen.
- **Kontrastregel:** „Weisse Schrift nur auf Dunkelgruen; Anthrazit auf
  Hellgruen/Gelb" — bei jeder farbigen Flaeche pruefen.

## Rahmenbedingungen (CLAUDE.md)

- Kein Vendoring: DS-CSS per Link einbinden, nicht ins Repo kopieren.
- Vanilla JS/ESM, kein Build-Schritt.
- Deutsch in UI-Texten und Code-Bezeichnern.
- Keine Werkzeug-Attribution in Commits/Code/Kommentaren.

## Nicht im Scope

- Keine Aenderung an `src/gemeindefinanzen/` (kein Python-UI vorhanden).
- Kein Funktionsverlust: Upload, Parsing, Dashboard-Tabs, Dokument-Umschalter,
  Suche/Filter, Sankey- und Ausgaben-Drill-down, Mehrjahresvergleich bleiben
  vollstaendig erhalten.
- Keine WASM-Vendor-Bibliotheken (`mupdf`, `sqlite-wasm`) anfassen.

## Akzeptanzkriterien (aus ISSUE.md)

- DS-CSS per Link eingebunden, flomotlik-Stylesheet entfernt.
- Farben, Typografie (Barlow Semi Condensed / Vollkorn), Ueberschriften-Skala
  folgen dem Gruene-AT-DS.
- Buttons, Cards, Header/Navigation, Inline-Elemente nutzen DS-Komponenten/-Tokens.
- Diagramme nutzen eine aus den Markenfarben abgeleitete kategoriale Palette;
  Serien bleiben unterscheidbar.
- DS-Kontrastregeln eingehalten.
- Alle Funktionen unveraendert lauffaehig.
- Responsives Verhalten erhalten (DS-Breakpoints 36rem / 48rem).
- Tests gruen: `npm run test:js`, e2e (Playwright), `pytest -q`, `ruff`, `mypy`.
