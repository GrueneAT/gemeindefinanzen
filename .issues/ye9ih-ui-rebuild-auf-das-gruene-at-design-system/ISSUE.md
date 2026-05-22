---
id: ye9ih
title: UI-Rebuild auf das Gruene-AT-Design-System
status: open
priority: high
labels:
- ui
- design-system
- rebranding
---

## Ziel

Die gesamte Benutzeroberflaeche der Browser-App (`web/`) wird neu aufgebaut,
damit sie dem neuen Gruene-AT-Design-System folgt. Bisher nutzt die App das
persoenliche flomotlik-Design-System; kuenftig das org-weite Gruene-AT-System.

- Design-System: https://grueneat.github.io/design-system/
- Stylesheet (per Link einbinden, **kein Vendoring**):
  https://grueneat.github.io/design-system/design-system.css

## Was sich aendert

**Farben, Formen, Typografie und Komponenten folgen dem Gruene-AT-Design-System:**

- Farben: Dunkelgruen `#257639`, Hellgruen `#56af31`, Gelb `#ffed00`,
  Magenta `#e6007e`, Anthrazit `#1d1d1b`, Weiss — CSS-Variablen `--gat-color-*`.
- Schrift: Barlow Semi Condensed (Headline + Copy), Vollkorn (Betonung/Serif).
- Ueberschriften-Skala: `--gat-text-h1..h3`, modular (Ratio 1.25).
- Komponenten/Layout: `.gat-header`/`.gat-nav`, `.gat-btn`, `.gat-card`,
  Inline-Elemente (`.gat-underline`, `.gat-highlight`), `.gat-container`,
  `.gat-grid`.
- Kontrastregel: weisse Schrift nur auf Dunkelgruen; Anthrazit auf
  Hellgruen/Gelb. "Typografie steht immer auf einer gruenen Flaeche."

**Diagramme (ECharts):** Wasserfall, Sankey, Treemap, Ringe, Balken und Linien
bekommen eine erweiterte kategoriale Palette, abgeleitet aus den
Gruene-Markenfarben — die einzelnen Serien muessen unterscheidbar bleiben.
Betrifft die INK-Palette in `dashboard-charts.js` und `sankey-drill.js` sowie
ggf. die Python-Seite (`html.py`) zur Paritaet.

## Freiheiten und Grenzen

- **Struktur ist frei anpassbar:** Spaltenzahl, Abschnittsaufteilung und
  Seitenaufbau muessen NICHT 1:1 dem Design-System entsprechen — sie duerfen
  auf dieses Produkt (VRV-Analysetool) zugeschnitten werden.
- **Farben, Formen, Ueberschriften, Typografie:** folgen dem Design-System.
- **Kein Funktionsverlust:** Upload, Parsing, Dashboard-Tabs, Dokument-
  Umschalter, Suche/Filter, Sankey- und Ausgaben-Drill-down sowie der
  Mehrjahresvergleich bleiben vollstaendig erhalten.
- CLAUDE.md-Regeln gelten: kein Vendoring (DS-CSS per Link), Vanilla JS/ESM,
  kein Build-Schritt, Deutsch in UI-Texten und Code-Bezeichnern.

## Betroffene Bereiche (Orientierung, nicht abschliessend)

- `web/index.html` — DS-Stylesheet-Link, Markup-Klassen
- `web/css/app.css` — App-spezifisches CSS auf DS-Tokens umstellen
- `web/vendor/dashboard/dashboard.css` — Dashboard-Styling
- `web/js/dashboard-charts.js`, `web/js/sankey-drill.js` — Diagramm-Farben
- Python-Seite (`src/gemeindefinanzen/`) — Paritaet, falls Diagrammfarben dort
  gespiegelt werden

## Akzeptanzkriterien

- [ ] Die App bindet `https://grueneat.github.io/design-system/design-system.css`
      per Link ein; das flomotlik-Stylesheet ist entfernt.
- [ ] Farben, Typografie (Barlow Semi Condensed / Vollkorn) und die
      Ueberschriften-Skala der gesamten Seite folgen dem Gruene-AT-Design-System.
- [ ] Buttons, Cards, Header/Navigation und Inline-Elemente nutzen die
      DS-Komponenten bzw. -Tokens.
- [ ] Die Diagramme nutzen eine aus den Gruene-Markenfarben abgeleitete
      kategoriale Palette; Serien bleiben unterscheidbar.
- [ ] Die DS-Kontrastregeln sind eingehalten (weisse Schrift nur auf Dunkelgruen,
      Anthrazit auf Hellgruen/Gelb).
- [ ] Alle Funktionen unveraendert lauffaehig: Upload, Parsing, Dashboard-Tabs,
      Suche, Drill-downs, Mehrjahresvergleich.
- [ ] Responsives Verhalten erhalten (DS-Breakpoints 36rem / 48rem).
- [ ] Tests bleiben gruen: `npm run test:js`, e2e (Playwright), `pytest -q`,
      `ruff check src tests`, `mypy src`.
