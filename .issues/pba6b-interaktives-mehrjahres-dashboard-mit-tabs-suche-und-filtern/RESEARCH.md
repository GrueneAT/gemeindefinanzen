# RESEARCH — Interaktives Mehrjahres-Dashboard

Ist-Zustand der Codebasis als Grundlage fuer den Plan.

## Aktuelle Report-Erzeugung

`src/gemeindefinanzen/report.py` (~430 Zeilen) erzeugt eine statische Seite:

- Einstieg: `build_report(db_path: str, out_path: str) -> str` — Signatur muss
  erhalten bleiben (CLI und kuenftige Tests haengen daran).
- `gather(conn) -> dict` — sammelt Kennzahlen/Diagrammdaten **nur fuer das
  juengste VA-Dokument** plus drei Zeitreihen.
- `chart_*(d) -> dict` — je Diagramm ein ECharts-Options-Dict.
- Zusammenbau: ein f-String-HTML mit eingebettetem `CFG`-JSON und einer
  `revive()`-JS-Funktion, die Strings der Form `(...)=>...` clientseitig per
  `eval` in echte Funktionen zurueckverwandelt (ECharts-Formatter).
- Eingebunden: Design-System-CSS und ECharts 5.5.1 per CDN.

Diese Datei wird gemaess CONTEXT-Entscheidung D7 in ein `report/`-Paket
aufgeteilt.

## Datenbank

`data/gemeindefinanzen.db` — SQLite, 4 Dokumente (RA 2024, NVA 2025, RA 2025,
VA 2026), ~5.400 Detailposten. Schema in `src/gemeindefinanzen/schema.sql`.

Wichtigste View **`v_detail`** (nur `zeilentyp='detail'`), Spalten:
`posten_id, dokument_id, typ, finanzjahr, dokument, spalte_wert,
spalte_vergleich, spalte_dritte, seite, richtung, gebarung, vrk, ansatz,
ansatz_text, konto, konto_text, gruppe, gruppe_text, bezeichnung, mvag_eh,
mvag_fh, qu, eh_wert, eh_vergleich, eh_dritte, fh_wert, fh_vergleich,
fh_dritte, eh_delta, fh_delta`.

Weitere Views: `v_eckwerte` (Ertraege/Aufwand/Nettoergebnis je Dokument),
`v_zeitreihe` (Detailposten dokumentuebergreifend), `v_ansatz_summe`,
`v_gruppe_summe`. Tabelle `dokument` haelt `typ`, `finanzjahr`, `spalte_*`.

Betragsspalten sind typabhaengig — siehe `docs/SCHEMA.md`:
VA = Plan/Vorjahr/Vorvorjahr-Ist; RA = Ist/Soll/Abweichung;
NVA = VA-inkl-NVA/VA/Aenderung. `dokument.spalte_*` liefert die Klartexte.

**Fuer das Dashboard:** Alle `v_detail`-Zeilen aller Dokumente als ein
JSON-Array einbetten — das deckt Suche, Filter, Drill-down und die meisten
Diagramme ab. Aggregate koennen clientseitig berechnet oder serverseitig
vorberechnet werden.

## Design System

Per CDN: `https://flomotlik.github.io/claude-code/design-system.css`.
Genutzte Klassen heute: `page, row, margin, body, kicker, masthead-title,
masthead-sub, lead, stats, stat, stat-num (is-green/is-orange/is-red),
callout (is-note/is-risk/is-question/is-affirmed), mark (mark-*), points,
point, detail, summary-hint, footer, rule`. Geschlossenes Set — Tab-Leiste
und Umschalter neu, aber im selben Stil (Haarlinien `--rule-hair`, Papier
`--paper-raised`, vier Tinten).

## CLI, Make, Tests

- `cmd_report` in `cli.py` ruft `report.build_report`. Bleibt kompatibel.
- Makefile-Ziel `report` -> `reports/dashboard.html`.
- `tests/test_parser.py` — 20 Tests, kein Report-Test bisher.
- Qualitaetsschranke: `ruff check src tests` und `mypy src` muessen sauber
  bleiben; `pyproject.toml` definiert Regeln (line-length 100).

## Umgebung fuer den Executor

- Fertiges venv mit allen Abhaengigkeiten: **`/tmp/pdfvenv/bin/python`**
  (pymupdf, pdfplumber, duckdb, pandas, openpyxl, pytest).
- `data/gemeindefinanzen.db` ist im Arbeitsverzeichnis vorhanden (gitignored).
  Falls sie fehlt: `PYTHONPATH=src /tmp/pdfvenv/bin/python -m
  gemeindefinanzen.cli build documents/ --db data/gemeindefinanzen.db`.
- `node` ist verfuegbar — eingebettetes Dashboard-JS damit pruefen.

## Risiken / Hinweise

- JSON-Groesse: ~5.400 Zeilen × ~15 Felder. Feldnamen kurz halten; reicht fuer
  eine GitHub-Pages-Seite im einstelligen MB-Bereich.
- Die `revive()`-eval-Technik ist gesetzt — fuer Tab-/Such-Logik aber besser
  echtes, lesbares JS schreiben statt alles ueber Options-Dicts.
- `build_report`-Signatur und das CLI-Verhalten nicht brechen.
