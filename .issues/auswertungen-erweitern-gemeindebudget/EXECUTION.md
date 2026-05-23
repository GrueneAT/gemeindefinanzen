# Execution: Auswertungen erweitern — Gemeindebudget verstaendlicher machen

**Started:** 2026-05-23
**Status:** complete
**Branch:** issue/auswertungen-erweitern-gemeindebudget

## Execution Log

- [x] Task 1: R5 Schema-Migration einwohner + Tier-3-Feinschliff
  (R13/R14/R15) + R10 — commit **742c649**
- [x] Task 2: R5 Einwohner-Eingabe in Dokumentverwaltung (Variante A + B)
  — commit **2f3013d**
- [x] Task 3: R1 + R5 Kennzahlen-Karten Vorjahresdelta + Pro-Kopf-Zeile
  — commit **b7ff11a**
- [x] Task 4: R2 Schulden &amp; Finanzierung Tab (R2 A+B, R12 A+B)
  — commit **1760d8d**
- [x] Task 5: R3 + R4 Soll-Ist/Polster (je A+B) + R11 Sankey-Abschluss
  — commit **18a03a6**
- [x] Task 6: R6 + R7 + R8 (A+B Aus+Ein) Aufgabenbereiche und 1-Euro
  — commit **db8b66a**
- [x] Task 7: R9 Gebunden vs. gestaltbar (A+B), Pflichtumlagen-Helper
  zentralisiert — commit **342888d**

## Verification Results

**Baseline (vor Beginn):** 61 JS-Tests, 7 e2e-Tests, 34 pytest-Tests,
ruff/mypy clean.

**Final:**

- **JS-Tests** (`npm run test:js`): **105 bestanden, 0 fehlgeschlagen**
  (44 neue Tests fuer alle neuen DATA-Felder, Builder-Registrierungen,
  Helper-Funktionen)
- **Playwright e2e** (`npm run test:e2e`): **15 bestanden** (8 neue
  Tests: einwohner Variante A+B, Vorjahresdelta-Anzeige, Pro-Kopf-Zeile,
  Schulden-Tab, Sparpotenzial-Typsichtbarkeit + R9, Ausgaben-Tab,
  Ueberblick-1-Euro-Panels)
- **pytest** (`PYTHONPATH=src python3 -m pytest -q`): **34 passed**
  (unveraendert)
- **unittest discover** (Pflicht-Doppellauf laut Principle 4 wenn
  Python-Tests beruehrt — hier keine, leerer Lauf 0 tests ran, kein
  Drift)
- **ruff check src tests**: clean
- **mypy src**: clean (8 source files)
- **diff src/gemeindefinanzen/schema.sql web/schema.sql**: identisch

## Variante-Paare bereit fuer User-Auswahl

Sieben Variante-Paare wurden side-by-side gerendert (nicht Toggle).
Der User waehlt online; eine Folge-Iteration entfernt jeweils den
nicht gewaehlten Partner.

| Variant-Paar | Variante A (Panel-Id) | Variante B (Panel-Id) |
|---|---|---|
| R2 Schulden-Tab-Layout | `#c_fin_saeulen` + `#c_schuldenstand` (drei Panels) | `#c_fin_combo` (Combo, 2 y-Achsen) |
| R3 Soll-Ist (RA-Doks) | `#c_sollist_a` (Diverging-Bar) | `#c_sollist_b` (Dumbbell) |
| R4 Polster (VA-Doks) | `#c_polster_a` (Doppelbalken VA vs. Ist-RA) | `#c_polster_b` (Diverging nach Polster-Hoehe) |
| R5 Einwohner-Eingabe | Inline-Input je Tabellenzeile (`.doc-einwohner-input`) | Edit-Button + `<dialog id="doc-einwohner-dialog">` |
| R8 Wofuer geht 1 Euro? | `#c_eineuro_aus_a` + `#c_eineuro_ein_a` (100-%-Stapelbalken) | `#c_eineuro_aus_b` + `#c_eineuro_ein_b` (10x10-Piktogramm via Pie) |
| R9 Gebunden vs. gestaltbar | `#c_bindung_a` (100-%-Stapel) | `#c_bindung_b` (Saeulen je Aufwandsart) |
| R12 Invest-Finanzierung | `#c_investfin_a` (gestapelter Saeulenbalken) | `#c_investfin_b` (Mini-Sankey) |

Visuelle Selbstpruefung (Playwright Screenshots vom Fixture
`documents/VA-2026-Auflage.pdf` gegen `node scripts/serve.mjs 8099`):

- Ueberblick: Vier R8-Panels nebeneinander oben, Kennzahlen-Karten mit
  Pro-Kopf-Zeile sichtbar.
- Schulden &amp; Finanzierung: Schuldendienst-Karte, Saeulen
  (Aufnahme/Tilgung), Linie (Schuldenstand kumuliert), Combo, beide
  Investitions-Finanzierungs-Varianten.
- Ausgaben: sortierte Gruppen-Balken, Saldo-Diverging, Ring + Treemap als
  Detailsicht.
- Sparpotenzial: Polster A + B, Korridor (zweite Achse), Treiber,
  Bindung A + B.

Soll-Ist-Panels (A/B) sind bei VA-Doks per `onDocChange`-Hook
ausgeblendet (`data-typ-panel="RA"`). Beim Dokument-Switch zu einem
RA werden sie wieder sichtbar; Polster-Panels werden im Gegenzug
ausgeblendet (`data-typ-panel="VA"`).

## Deviations from Plan

### Auto-fixed (Rules 1-3)

1. **[Rule 1 — Bug-Vermeidung] R10-Anteil basiert auf Gesamtertraegen,
   nicht nur Top-12.**
   - Found during: Task 1
   - Issue: PLAN-Vorschlag berechnete den Anteil aus `total =
     einnahmen.reduce(...)` — das ist nur die Top-12-Summe und faerbt
     den Anteil systematisch zu hoch. Die SQL-Referenz
     `web/sql/03-einnahmestruktur.sql` nutzt die Gesamtsumme aller
     operativen Einnahmen.
   - Fix: `total = ertraege || 1` (bereits berechnete Gesamtsumme).
   - Files: `web/js/dashboard-data.js`
   - Commit: 742c649

2. **[Rule 1 — Bug-Vermeidung] Sankey-Test-Helfer summierte den neuen
   Abschluss-Knoten falsch.**
   - Found during: Task 5
   - Issue: Nach Einfuegen des R11 Ueberschuss-Knotens summierte
     `gruppenSumme()` im bestehenden Test auch den Ueberschuss-Link von
     Gemeindehaushalt mit — die Drill-Treue-Assertion brach.
   - Fix: ABSCHLUSS_NAMEN-Set in `gruppenSumme`/`quellenSumme`
     ausgeschlossen.
   - Files: `tests/js/run.mjs`
   - Commit: 18a03a6

3. **[Rule 1 — Bug-Vermeidung] Dialog-Save aktualisierte das
   Inline-Feld nicht.**
   - Found during: Task 2
   - Issue: Beim Dialog-Save (Variante B) blieb das Inline-Feld
     (Variante A) auf dem alten Wert stehen, weil die Tabelle nicht
     neu gerendert wurde. Inline-Eingabe haette nach dem Dialog ein
     Stale-Display gezeigt.
   - Fix: In `speichereEinwohner` gezielte DOM-Updates fuer das
     Inline-Feld (nur wenn nicht fokussiert) und den Edit-Button.
   - Files: `web/js/app.js`
   - Commit: 2f3013d

4. **[Rule 2 — Sicherheits-/Korrektheits-Vorsorge] Defensive
   Empty-Hinweisgrafiken bei dok-typ-spezifischen Charts.**
   - Found during: Task 5
   - Issue: Bei VA-Doks fehlt `agg.sollIst` (und umgekehrt). Ohne
     defensive Builder rendert ECharts dann eine leere Achse oder
     wirft.
   - Fix: `emptyOption(text)`-Helper, der bei leerer Liste eine
     ECharts-`graphic`-Karte mit ruhigem Hinweistext rendert
     (zusaetzlich zum `onDocChange`-Hook, der das ganze Panel
     versteckt — doppelter Schutz).
   - Files: `web/js/dashboard-charts.js`
   - Commit: 18a03a6

5. **[Rule 3 — Blocker-Fix] devDependencies wurden bei `npm install`
   uebersprungen.**
   - Found during: Setup
   - Issue: `npm install` in der Sandbox installierte nur
     `dependencies` (`@sqlite.org/sqlite-wasm`, `mupdf`), nicht
     `@playwright/test` aus `devDependencies` — Playwright e2e-Suite
     waere ohne Hinweis nicht lauffaehig gewesen.
   - Fix: `npm install --include=dev` plus `npx playwright install
     chromium` explizit ausgefuehrt.
   - Files: keine — nur Container-Setup.

### Blocked (Rule 4)

Keine. Alle Tasks vollstaendig durchgelaufen.

## Discovered Issues

- **Schuldenstand-Linie mit nur einem Dokument**: bei nur einem
  geladenen Dokument zeigt `#c_schuldenstand` nur einen Datenpunkt,
  die Linie ist optisch leer. Der Panel-Note dokumentiert das bereits
  ("kumulative Bewegung aus den eingelesenen Dokumenten"). Erst mit
  mehreren Dokumenten ueber Jahre wird der Mehrwert sichtbar. Kein
  Bug — User-erwartete Verhaltensweise.
- **Pflichtumlagen-Heuristik bleibt bezeichnungs-basiert**: Wie in
  RESEARCH.md beschrieben — Disclaimer in beiden R9-Panels und im
  Tooltip von `chartBindungStapel`. Eine code-listen-basierte
  Klassifikation waere genauer, ist aber out of scope.

## Self-Check

- [x] Alle Plan-Tasks (1-7) committet (7 Commits — siehe oben)
- [x] Schema-Sync identisch (`diff -q src/gemeindefinanzen/schema.sql
  web/schema.sql` → leer)
- [x] Volle Verifikationssuite gruen (JS 105/105, e2e 15/15, pytest
  34/34, ruff clean, mypy clean)
- [x] Keine TODO/FIXME/HACK in den geaenderten Dateien
- [x] Keine `console.log`/`debugger`/`breakpoint()`-Reste
- [x] Bestehende Selektoren (`.tab-btn[data-tab=...]`, alle `c_*`-Ids,
  `.switch-btn`, `.doc-status.ok`) unveraendert
- [x] Visuelle Pruefung der vier wichtigsten Tabs ueber Playwright-
  Screenshots dokumentiert
- **Result:** PASSED

**Completed:** 2026-05-23
**Duration:** ca. 4 Stunden
**Commits:** 7 (742c649, 2f3013d, b7ff11a, 1760d8d, 18a03a6, db8b66a,
342888d)
