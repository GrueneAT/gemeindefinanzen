---
id: pba6b
title: Interaktives Mehrjahres-Dashboard mit Tabs, Suche und Filtern
status: done
priority: high
labels:
- dashboard
- visualisierung
- frontend
---

## Kontext

Aktuell erzeugt `src/gemeindefinanzen/report.py` eine **einzelne Berichtsseite**
(`reports/dashboard.html`) mit fixen Abschnitten (Sankey, Treemap, Wasserfall,
Trend-Charts). Die Datenbank enthaelt bereits 4 Dokumente (RA 2024, NVA 2025,
RA 2025, VA 2026) mit ~5.400 Detailposten.

Das soll von einer reinen Berichtsseite zu einem **echten, interaktiven
Dashboard fuer die Gemeindefinanzen** ausgebaut werden — meetingtauglich,
durchsuchbar, mit Moeglichkeit, in einzelne Bereiche einzutauchen.

## Mit dem Auftraggeber geklaerte Entscheidungen

- **Auslieferung:** eine einzelne HTML-Seite, **Deployment auf GitHub Pages**.
  CDN-Links fuer CSS, Fonts und ECharts sind erlaubt (kein Offline-Zwang).
  Alle Daten werden als JSON in die Seite eingebettet, Suche/Filter/Tabs
  laufen clientseitig.
- **Gliederung:** Themen-Tabs plus ein **globaler Jahr-/Dokument-Umschalter**,
  der alle Tabs auf das gewaehlte Dokument umstellt.
- **Designstil:** das flomotlik Design System bleibt erhalten und wird nur
  erweitert (der Stil gefaellt) — Notebook-Aesthetik, vier Tinten.

## Funktionsumfang

- Tab-Navigation, mind. 6 Themen-Tabs (z. B. Ueberblick, Einnahmen, Ausgaben,
  Investitionen, Transfers/Umlagen, Suche; ggf. Personal, 800k-Analyse).
- Globaler Jahr-/Dokument-Umschalter (RA 2024 / NVA 2025 / RA 2025 / VA 2026),
  der Kennzahlen und Diagramme aller Tabs umstellt.
- **Volltextsuche und Filter ueber alle Detailposten aller Dokumente**: nach
  Bezeichnung, Ansatz, Konto, Aufgabengruppe, Richtung (Einnahme/Ausgabe),
  Gebarung und Betragsbereich.
- Sortierbare, durchsuchbare Datentabelle, in der alle Werte je Posten
  sichtbar sind (EH/FH, alle drei Spalten, MVAG, QU).
- **Drill-down**: von Aufgabengruppe -> Ansatz -> Einzelposten.
- Je Jahr/Dokument mehrere Auswertungen abrufbar.
- Mehrjahresvergleich / Zeitreihen bleiben erhalten und werden ausgebaut.
- Meeting-Tauglichkeit: klar lesbar, einzelne Bereiche fokussierbar.
- `report.py` so erweitern, dass alle benoetigten Daten (Posten + Aggregate
  aller Dokumente) als JSON eingebettet werden; bestehende Diagrammtypen
  bleiben erhalten.
- Datengrundlage bleibt `data/gemeindefinanzen.db` ueber `gemfin report`.

## Akzeptanzkriterien

- [ ] `gemfin report` erzeugt eine einzelne, auf GitHub Pages deploybare HTML-Datei mit Tab-Navigation
- [ ] Globaler Jahr-/Dokument-Umschalter stellt Kennzahlen und Diagramme aller Tabs um
- [ ] Mindestens 6 Themen-Tabs vorhanden
- [ ] Such-/Filter-Ansicht durchsucht alle Detailposten aller Dokumente; Filter nach Gruppe, Richtung, Gebarung, Dokument und Betragsbereich; Volltext ueber die Bezeichnung
- [ ] Sortierbare Tabelle zeigt alle Werte je Posten
- [ ] Drill-down Gruppe -> Ansatz -> Einzelposten funktioniert
- [ ] flomotlik Design System weiterverwendet, visuell konsistent zur bisherigen Seite
- [ ] Auf GitHub Pages deploybar (CDN- oder relative Pfade, keine Server-Abhaengigkeit)
- [ ] Bestehende Tests bleiben gruen; `report.py` ohne ruff-/mypy-Fehler
