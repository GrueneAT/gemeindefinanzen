# CONTEXT — Interaktives Mehrjahres-Dashboard

Designentscheidungen vor Recherche und Planung. Da der Auftraggeber die
Pipeline autonom laufen laesst, sind die offenen Punkte hier eigenstaendig
entschieden und begruendet.

## Ausgangslage

`src/gemeindefinanzen/report.py` erzeugt heute eine **statische Berichtsseite**
mit fester Abschnittsfolge. Ziel ist ein **interaktives Dashboard**:
Tab-Navigation, globaler Jahr-Umschalter, Volltextsuche und Filter ueber alle
Posten, Drill-down in einzelne Bereiche — meetingtauglich.

## Geklaerte Vorgaben (vom Auftraggeber)

- Auslieferung: **eine HTML-Seite**, Deployment auf **GitHub Pages**.
- CDN-Links fuer CSS, Fonts, ECharts sind erlaubt — **kein Offline-Zwang**.
- Gliederung: **Themen-Tabs + globaler Jahr-/Dokument-Umschalter**.
- flomotlik Design System bleibt, wird nur erweitert.

## Entschiedene Punkte

### D1 — Kein JS-Framework, reines Vanilla-JavaScript
Tabs, Umschalter, Suche, Filter und Sortierung werden in schlankem Vanilla-JS
umgesetzt; Diagramme weiter mit ECharts (bereits im Einsatz). Begruendung:
kein Build-Schritt, kein npm, direkt GitHub-Pages-tauglich, langfristig vom
Team wartbar. Passt zur Projektlinie „funktionierend und einfach“.

### D2 — Alle Daten als ein eingebetteter JSON-Block
`report.py` bettet die Detailposten **aller Dokumente** plus vorberechnete
Aggregate als ein JSON-Objekt in die Seite ein. Suche/Filter/Tabwechsel laufen
rein clientseitig auf diesen Daten — keine Server-Abfragen. Groessenordnung
~5.400 Detailzeilen; die Seite bleibt damit im einstelligen MB-Bereich.

### D3 — Tab-Struktur (7 Tabs)
1. **Ueberblick** — Eckwerte, Wasserfall, Geldfluss (Sankey)
2. **Einnahmen** — Struktur, groesste Quellen, Kommunalsteuer
3. **Ausgaben** — Aufwand nach Art, Treemap, Top-Posten
4. **Investitionen** — investive Vorhaben
5. **Transfers & Umlagen** — Pflicht- vs. freiwillige Transfers
6. **800k-Analyse** — Wasserfall-Szenario, Korridor, Kostentreiber
7. **Suche & Daten** — durchsuchbare Volltabelle aller Posten

### D4 — Globaler Jahr-/Dokument-Umschalter
Eine Schaltflaechenleiste (RA 2024 / NVA 2025 / RA 2025 / VA 2026) oberhalb der
Tabs. Sie stellt alle dokumentbezogenen Tabs (1–6) auf das gewaehlte Dokument
um. Tab 7 (Suche) zeigt dokumentuebergreifend, mit dem Dokument als Filter.

### D5 — Suche & Filter
Tab 7 zeigt eine Tabelle aller Detailposten aller Dokumente mit:
- Volltextsuche ueber Bezeichnung, Konto, Ansatz
- Filtern: Dokument, Aufgabengruppe, Richtung (Einnahme/Ausgabe), Gebarung,
  Betragsbereich (min/max)
- sortierbaren Spalten, allen Werten je Posten (EH/FH × 3 Spalten, MVAG, QU)
- Ergebniszahl und Summe der gefilterten Menge

### D6 — Drill-down
Im Ausgaben-Tab eine navigierbare Hierarchie Aufgabengruppe → Ansatz →
Einzelposten (Klick blendet die naechste Ebene auf). Die ECharts-Treemap
bleibt als visuelle Alternative erhalten.

### D7 — `report.py` wird zu einem `report/`-Paket
Die Generierung waechst deutlich. `report.py` wird in ein Paket aufgeteilt:
Datensammlung, ECharts-Konfiguration, statische JS/CSS-Bausteine und der
HTML-Zusammenbau getrennt. Oeffentliche Funktion `build_report(db, out)`
bleibt unveraendert, damit CLI und Tests gleich bleiben.

### D8 — Design System erweitern, nicht ersetzen
Tab-Leiste und Umschalter werden im Stil des Design Systems gestaltet
(Haarlinien, vier Tinten, Papier-Optik). Die Diagramm- und Textbausteine der
bisherigen Seite bleiben erhalten.

### D9 — GitHub-Pages-Deployment
Ausgabe nach `docs/` oder `site/` ist GitHub-Pages-Konvention; der Build legt
die fertige `index.html` an einen dafuer geeigneten Ort. Ein `make`-Ziel
buendelt den Deploy-Build.

## Nicht-Ziele

- Kein Server, keine Live-Datenbankabfragen im Browser.
- Keine Benutzerkonten, kein Schreibzugriff — reines Lesewerkzeug.
- Keine Aenderung an Parser, Schema oder Plausibilitaetspruefung.
