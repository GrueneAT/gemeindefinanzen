# Plan: Auswertungen erweitern — Gemeindebudget verstaendlicher machen

<objective>
**Was:** Die Browser-App (`web/`) um die Konsens-Erweiterungen aus zwei
externen Topic-Reviews ergaenzen — neue Diagramme, neuer "Schulden &
Finanzierung"-Tab, Pro-Kopf-Sichten, Soll-Ist-Vergleich,
Budgetierungspolster, Bindungs-Analyse. Sieben Designentscheidungen werden
als "Variante A / Variante B" nebeneinander gerendert, damit der User online
auswaehlen kann; eine Nach-Iteration entfernt die nicht gewaehlten Varianten.

**Warum:** Die Diagramme sind handwerklich sauber, surfacen aber das
vorhandene Datenpotenzial nicht. Felder wie `eh_vergleich`, `eh_dritte`,
`gebarung='finanzierung'` und fertige SQL-Sichten (`08-budgetierungspolster`,
`14-soll-ist-abweichung`, `02-gruppen-uebersicht`) liegen ungenutzt. Pro-Kopf
fehlt komplett. Schulden haben heute kein einziges Diagramm. Das Issue
schliesst diese Luecken konsensual.

**Scope:**
- In: R1-R12 aus RESEARCH.md (Tier 1+2 — beide Reviewer-Konsens und
  inhaltlich starke Solo-Items); R13-R15 als billige Tier-3-Beigabe
  (Korridor zweite Achse, Wertformate einheitlich, Achsen-Ellipse).
- Out: R16 (Wasserfall 6-stufig) und R17 (Tab-Umordnung) — Tier-3 ohne
  Konsens, Tab-Umordnung kollidiert mit e2e-Selektoren. Folge-Issue.
- Out: Sankey-Komplett-Umbau auf `fh_wert` (per CONTEXT.md ausgeschlossen);
  Sankey-Abschlussknoten (R11) bleibt drin, ist die bilanzielle Ehrlichkeit.

**Akzeptanzkriterien (1:1 aus ISSUE.md):**
- Kennzahlen tragen sichtbaren Vergleich (R1, Task 3).
- Pro-Kopf-Werte verfuegbar, sobald Einwohnerzahl erfasst (R5, Task 2+3).
- Schulden/Finanzierung grafisch dargestellt (R2, R12, Task 4).
- Soll-Ist und Budgetierungspolster je ein Diagramm (R3, R4, Task 5).
- Aufgabenbereiche als sortierte Balken (R6, R7, Task 6).
- Tests gruen (`npm run test:js`, `npm run test:e2e`, `pytest`, `ruff`,
  `mypy`).
</objective>

<strategy>
**Richtung:** Datenlayer zuerst (eine Aggregation pro Thema in
`dashboard-data.js`), dann Chart-Builder in `dashboard-charts.js`, dann
Markup in `index.html`, dann Verdrahtung in `dashboard.js`. Tests laufen
nach jedem Schritt. Sieben Variant-Paare werden BEIDE gerendert (nicht
Toggle) — der User entscheidet visuell.

**Warum diese Reihenfolge:**
- *Foundation zuerst (Task 1):* Schema-Migration `dokument.einwohner` plus
  `migrationenAnwenden()` in `db.js`. Davon haengen R1 (braucht
  Vergleichssummen — moderate Aenderung an `aggregateDok`) und R5
  (braucht den Einwohner-Wert) ab. Wird die Migration spaeter eingezogen,
  rendern Pro-Kopf-Zeilen bei wiederkehrenden Nutzer:innen leer.
- *Vertikale Slices statt horizontaler Layer:* Jede Task ist ein
  R-Themenblock (Schulden, Soll-Ist/Polster, Aufgabenbereiche, ...) und
  bringt Aggregation + Builder + Markup + Registrierung MIT — ein sauberer
  Commit je Funktionsbereich. Anti-Pattern "Task 1 alle Daten, Task 6 alle
  Wiring" wird vermieden, weil jede Task alleine deploybar ist.
- *Variant-Paare in derselben Task:* Wenn ein Thema zwei Varianten hat (R3
  Soll-Ist, R8 1-Euro, ...), entstehen beide im selben Commit. So bleibt
  die "Pick later"-Iteration ein einziger `git revert`-aehnlicher Schritt.

**Strategische Optionen verworfen:**
- *Alles in einer Riesen-Task:* zu gross (>5 Dateien, >60 min), kein
  bisektierbarer Commit-Stream.
- *Horizontale Layer (Schema -> alle Aggregationen -> alle Builder -> ...):*
  bricht den App-Stand zwischendurch (Aggregationen ohne Builder lassen
  Charts leer), schwer review-bar.
- *R17 Tab-Umordnung gleich miterledigen:* RESEARCH.md warnt explizit vor
  e2e-Selektor-Kollision; verschoben als Folge-Issue.
- *Pro-Kopf-Umschalter (absolut/je Einwohner:in) als globaler Toggle:* Die
  Pro-Kopf-Zeile auf der Karte ist Pflicht (Tier 1), der Toggle fuer Charts
  ist Discretion — er kommt mit R5 als minimaler Schalter im
  `.dash-controls`-Bereich, beeinflusst nur die Top-Posten-Charts
  (Einnahmen, Investitionen).

**Schluessel-Entscheidungspunkte:**
1. **Migration in `db.js` statt im SQL-Schema.** SQLite akzeptiert kein
   wiederholtes `ALTER TABLE ADD COLUMN` — der separate
   `migrationenAnwenden(db)`-Aufruf mit try/catch ist der saubere Weg
   (RESEARCH "Common Pitfalls").
2. **Schema-Aenderung in `src/gemeindefinanzen/schema.sql`, dann
   `make web-sync`.** Direktes Editieren von `web/schema.sql` wird vom
   naechsten `web-sync` ueberschrieben.
3. **`registerChart`-Eintrag fuer jedes neue Chart-Div ist Pflicht** —
   sonst bleibt das Div leer (Pitfall in RESEARCH.md).
4. **Defensive Builder bei dok-typ-spezifischen Charts** (R3 nur RA, R4 nur
   VA): `agg.sollIst ?? []` UND `onDocChange`-Hook zum Panel-Hiden.
5. **Pflichtumlagen-Heuristik (R9):** in `dashboard-data.js` zentralisieren
   (`istPflichtumlage()`), Tooltip-Hinweis "automatisch erkannt", eigenes
   Segment "unklar". Nicht als harte Wahrheit verkaufen.
</strategy>

<skills>
Keine Workspace-Skills (kein `.claude/skills/`-Verzeichnis im Repo).
Stattdessen sind die projektspezifischen Regeln in `/workspace/CLAUDE.md`
(kein Vendoring, CDN-only, kein Build-Schritt, ASCII-Deutsch) verbindlich
und gelten implizit fuer alle Tasks.
</skills>

<context>
Issue: @.issues/auswertungen-erweitern-gemeindebudget/ISSUE.md
Research: @.issues/auswertungen-erweitern-gemeindebudget/RESEARCH.md
Context: @.issues/auswertungen-erweitern-gemeindebudget/CONTEXT.md
Design-System: @docs/web-design-system.md

<interfaces>
<!-- Executor: diese Vertraege direkt nutzen. NICHT im Codebase nach diesen
     Definitionen suchen — sie stehen hier vollstaendig. -->

// =========================================================================
// From web/js/dashboard-data.js — Datenaggregation
// =========================================================================

// Top-Level-Sammler — heutiger Vertrag, der ERWEITERT wird:
export function collect(db): {
  meta: { gemeinde, dok_anzahl, posten_anzahl, default_dok },
  dokumente: Array<{
    id: number, typ: 'VA'|'NVA'|'RA', jahr: number,
    label, spalte_wert, spalte_vergleich, spalte_dritte: string,
    // NEU (R5): einwohner?: number | null
  }>,
  posten: Array<{ dok, typ, jahr, richtung, gebarung, gruppe, gruppe_text,
                   ansatz, ansatz_text, konto, konto_text, bezeichnung,
                   mvag, qu, ew, ev, ed, fw, fv, fd }>,
  aggregate: Record<dokId_str, AggregateDok>,
  trend: {
    eckwerte: Array<[label, ertraege, aufwand, netto, typ]>,
    komm:     Array<[label, betrag, typ]>,
    aufwand:  Array<[label, personal, sach, transfer, finanz, typ]>,
    // NEU (R2): schuldenstand: Array<[label, aufnahme, tilgung, kumStand, typ]>
  },
}

// Heutiges `aggregateDok`-Resultat — wird ERWEITERT:
type AggregateDok = {
  eckwerte: {
    ertraege: number, aufwand: number, netto: number, komm: number,
    komm_anteil: number,
    // NEU (R1): ertraege_vgl, aufwand_vgl, netto_vgl: number
    // NEU (R1): delta_ertraege_proz, delta_aufwand_proz, delta_netto_proz: number
    // NEU (R5): ertraege_pk, aufwand_pk, netto_pk, komm_pk: number | null
    // NEU (R2): schuldendienst: number  (Tilgung + Zinsen)
  },
  einnahmen: Array<[bezeichnung, betrag, anteil_prozent]>,  // R10: 3. Spalte
  aufwand_art: Array<[kategorie, betrag]>,
  treemap:     Array<[gruppe_text, ansatz_text, betrag]>,
  treiber:     Array<[bezeichnung, delta]>,
  korridor:    Array<[bezeichnung, einzeln, kumuliert]>,
  transfers:   Array<[bezeichnung, betrag, vergleich]>,
  investitionen: Array<[bezeichnung, ansatz_text, betrag]>,
  gruppen:     Array<[gruppe, gruppe_text, betrag]>,
  sankey: { quellen: Array<[quelle, betrag]>, gruppen: Array<[gr_text, betrag]> },
  // NEU (R3): sollIst?: Array<[bezeichnung, gruppe_text, richtung, soll, ist, abweichung]>
  //          (nur bei typ==='RA', sonst nicht gesetzt — Builder mit `?? []`)
  // NEU (R4): polster?: Array<[bezeichnung, gruppe_text, ist_ra, voranschlag, polster, polster_proz]>
  //          (nur bei typ==='VA')
  // NEU (R2): finanzierung: { aufnahme, tilgung, schuldendienst: number }
  //          (alle Dok — 0, wenn keine Posten mit gebarung='finanzierung')
  // NEU (R7): gruppenSaldo: Array<[gruppe, gruppe_text, einnahmen, ausgaben, saldo]>
  // NEU (R8): einEuroAuf:    Array<[kategorie, cent_pro_euro]>  (auf 100 normiert)
  // NEU (R8): einEuroEin:    Array<[quelle,   cent_pro_euro]>
  // NEU (R9): bindung: { personal, pflichtumlagen, finanz,
  //                       freiwilligeTransfers, freieSachaus, unklar: number }
  // NEU (R12): investFinanzierung: { foerderung, darlehen, eigen: number }
}

// Helper, NEU in dashboard-data.js, in `posten` und in `aggregateDok` genutzt:
export function istPflichtumlage(bezeichnung: string): boolean
// Regex aus dashboard.js:160-161 hochgezogen:
// /umlage|nökas|nokas|sozialhilfe|krankenanstalt/i

// =========================================================================
// From web/js/dashboard-charts.js — ECharts-Builder
// =========================================================================
// Konstanten (vorhanden, wiederverwenden):
const INK = { green: "#3f7d4f", blue: "#4f93a0", orange: "#c9a24b",
              red: "#b9744f", soft: "#8a8f7d", paper: "#ffffff" }
const CHART_FONT = "Barlow Semi Condensed, sans-serif"
const LABEL_SIZE = 15, AXIS_SIZE = 14
const BAR_MAX_DICHT = 56, BAR_MAX_WEIT = 130

// Hilfen (vorhanden):
function bar(categories, values, color, colors?, barMax?): ECOption
function grid(extra?): object
function tip(extra?): object
function legende(extra?): object
function catAxis(data, fontsize?, rotate?): object
function valAxis(formatter?): object

// Heutige Builder (vorhanden):
export function chartSankey(agg):       ECOption  // R11 modifiziert
export function chartEinnahmen(agg):    ECOption  // R10 erweitert
export function chartTreiber(agg):      ECOption  // Pattern fuer R3-A/R7
export function chartInvestitionen(agg): ECOption
export function chartAufwandart(agg):   ECOption
export function chartTreemap(agg):      ECOption
export function chartWasserfall(agg, jahr): ECOption
export function chartKorridor(agg):     ECOption  // R13 modifiziert
export function chartTrendEckwerte(trend), chartTrendKomm(trend),
                chartTrendAufwand(trend): ECOption

// NEUE Builder, die der Plan einfuehrt:
export function chartFinanzierung(agg):     ECOption  // R2.1 Aufnahme/Tilgung Saeulen
export function chartSchuldenstand(trend):  ECOption  // R2.2 Linie kum. Stand
export function chartSchuldenCombo(agg, trend): ECOption // R2 Variante B
export function chartSollIstDiverging(agg): ECOption  // R3 Variante A
export function chartSollIstDumbbell(agg):  ECOption  // R3 Variante B
export function chartPolsterDoppel(agg):    ECOption  // R4 Variante A
export function chartPolsterDiverging(agg): ECOption  // R4 Variante B
export function chartGruppenBalken(agg):    ECOption  // R6
export function chartGruppenSaldo(agg):     ECOption  // R7
export function chartEinEuroStapel(agg, seite): ECOption  // R8 Variante A
export function chartEinEuroPikto(agg, seite):  ECOption  // R8 Variante B
export function chartBindungStapel(agg):    ECOption  // R9 Variante A
export function chartBindungSaeulen(agg):   ECOption  // R9 Variante B
export function chartInvestFinanzierungStapel(agg): ECOption  // R12 Variante A
export function chartInvestFinanzierungSankey(agg): ECOption  // R12 Variante B

// Top-Level: alleCharts(daten) — wird um die neuen Keys in dok_charts und
// trend_charts ERWEITERT. Eintraege je dokId erhalten neue Felder:
// fin_saeulen, fin_combo (R2), sollist_a, sollist_b (R3), polster_a,
// polster_b (R4), gruppen_balken (R6), gruppen_saldo (R7),
// eineuro_aus_a, eineuro_aus_b, eineuro_ein_a, eineuro_ein_b (R8),
// bindung_a, bindung_b (R9), investfin_a, investfin_b (R12).
// trend_charts erhaelt: schuldenstand (R2.2).

// =========================================================================
// From web/vendor/dashboard/dashboard.js — Dashboard-Controller (editierbar!)
// =========================================================================

// Wichtige State-Variablen und APIs (bereits vorhanden):
var docs, posten, aggs, meta           // = DATA
var dokChart, trendChart, mehrjahrCfg  // = CFG
var charts = {}                         // [divId]: { inst, kind, src }
var rerenderHooks = []

function registerChart(divId, kind, src)
// kind: "dok" | "trend" | "sankey"
// src:  Key in dokChart[aktivDok], in trendChart, oder "sankey"

function setDok(id)        // ruft renderAllCharts + alle rerenderHooks
function onDocChange(fn)   // registriert einen rerenderHook
function activateTab(name)
function rerenderStats(dokId)   // R1 + R5 ERWEITERT
function rerenderTables(dokId)

// Heutige Registrierungen (dashboard.js:749-761) — der Plan ENTFERNT
// "c_wasserfall_sp" und FUEGT die neuen Charts hinzu:
registerChart("c_sankey", "sankey", "sankey");
registerChart("c_einnahmen", "dok", "einnahmen");
registerChart("c_aufwandart", "dok", "aufwandart");
registerChart("c_treemap", "dok", "treemap");
registerChart("c_wasserfall", "dok", "wasserfall");
registerChart("c_wasserfall_sp", "dok", "wasserfall");  // <-- entfaellt (Task 5)
registerChart("c_korridor", "dok", "korridor");
registerChart("c_treiber", "dok", "treiber");
registerChart("c_investitionen", "dok", "investitionen");
registerChart("c_trend_eck", "trend", "trend_eck");
registerChart("c_trend_komm", "trend", "trend_komm");
registerChart("c_trend_auf", "trend", "trend_auf");

// =========================================================================
// From src/gemeindefinanzen/schema.sql — dokument-Tabelle
// =========================================================================
CREATE TABLE IF NOT EXISTS dokument (
    dokument_id      INTEGER PRIMARY KEY,
    gemeinde         TEXT,
    typ              TEXT,      -- 'VA' | 'NVA' | 'RA'
    finanzjahr       INTEGER,
    spalte_wert      TEXT,
    spalte_vergleich TEXT,
    spalte_dritte    TEXT,
    fassung          TEXT,
    quelldatei       TEXT,
    seiten           INTEGER,
    eingelesen_am    TEXT DEFAULT (datetime('now'))
    // NEU (R5, Task 1): einwohner INTEGER  -- nullable, optional
);

// =========================================================================
// From web/js/db.js — Persistenz
// =========================================================================
export class Datenbank {
  schemaAnwenden(schemaSql)  // existing — CREATE IF NOT EXISTS only
  abfrage(sql, bind?): Array<{...}>
  wert(sql, bind?): any
  ausfuehren(sql, bind?)     // INSERT/UPDATE/DELETE
  transaktion(fn)
  async sichern(): boolean   // -> IndexedDB
}
export function oeffneDb(initModul): Promise<Datenbank>
export function dokumente(db): Array<{
  dokument_id, gemeinde, typ, finanzjahr, quelldatei, seiten, detailposten,
  // NEU (R5): einwohner: number | null
}>
// NEU (R5, Task 1): export function migrationenAnwenden(db)
//   - try { db.ausfuehren("ALTER TABLE dokument ADD COLUMN einwohner INTEGER") }
//   - catch (e) { /* schon vorhanden — ignorieren */ }
//   - Aufruf in web/js/app.js:41 NACH db.schemaAnwenden(schema).

// =========================================================================
// From web/js/dashboard-app.js — baut DATA + CFG zusammen
// =========================================================================
export function baueDashboard(db) // ruft collect() + alleCharts(),
                                  // setzt window.DATA und window.CFG,
                                  // laedt dann dashboard.js per <script>.

// =========================================================================
// From web/sql/14-soll-ist-abweichung.sql — Vorlage fuer R3-Aggregation
// =========================================================================
SELECT bezeichnung, gruppe_text, richtung,
       ROUND(eh_vergleich,0) soll_va,
       ROUND(eh_wert,0)      ist_ra,
       ROUND(eh_delta,0)     abweichung
FROM v_detail
WHERE typ='RA' AND finanzjahr=(SELECT MAX(finanzjahr) FROM v_detail WHERE typ='RA')
  AND ABS(eh_delta) > 20000
ORDER BY ABS(eh_delta) DESC LIMIT 30;
-- WICHTIG: in der Aggregation `WHERE dokument_id=${did}` STATT der
-- juengsten-RA-Bedingung; sonst zeigt jedes RA-Dok dasselbe Ergebnis.

// =========================================================================
// From web/sql/08-budgetierungspolster.sql — Vorlage fuer R4-Aggregation
// =========================================================================
SELECT bezeichnung, gruppe_text,
       ROUND(eh_dritte,0)               ist_rechnungsabschluss,
       ROUND(eh_wert,0)                 voranschlag,
       ROUND(eh_wert - eh_dritte,0)     polster,
       CASE WHEN eh_dritte > 0
            THEN ROUND(100.0*(eh_wert-eh_dritte)/eh_dritte,0) END polster_prozent
FROM v_detail
WHERE richtung='ausgabe' AND eh_dritte > 2000 AND eh_wert - eh_dritte > 5000
  AND dokument_id = (...)
ORDER BY (eh_wert - eh_dritte) DESC LIMIT 25;
-- WICHTIG: in der Aggregation `WHERE dokument_id=${did}`; nur bei typ='VA'.

// =========================================================================
// e2e-Test-Selektoren (UNVERAENDERT lassen!)
// =========================================================================
// tests/e2e/dashboard.spec.mjs prueft:
//   .tab-btn[data-tab="..."], .tab-panel[data-panel="..."], is-active
//   #c_sankey canvas, #c_wasserfall canvas
// => Die existierenden data-tab/data-panel Werte und die Chart-#ids
//    DUERFEN NICHT umbenannt werden. Neue Tabs (z.B. data-tab="schulden")
//    sind erlaubt; bestehende Tab-Reihenfolge in der `.tabs`-Leiste darf
//    sich aendern, aber kein bestehender Button entfernt werden.
</interfaces>

Key files:
@web/index.html — Tab-Markup, Chart-Container, Doc-Tabelle (R5-Eingabe)
@web/js/dashboard-data.js — Aggregations-Pipeline, alle neuen Daten hier
@web/js/dashboard-charts.js — ECharts-Optionsbausteine, alle neuen Builder
@web/vendor/dashboard/dashboard.js — registerChart, rerenderStats,
  onDocChange (editierbar laut CONTEXT.md)
@web/js/db.js — Persistenz, migrationenAnwenden() einfuegen
@web/js/app.js — init() ruft schemaAnwenden() + migrationenAnwenden()
@src/gemeindefinanzen/schema.sql — Quelle der Schema-Definition,
  `make web-sync` synchronisiert nach web/schema.sql
@web/js/dashboard-app.js — baueDashboard() bindet DATA + CFG zusammen
@web/sql/08-budgetierungspolster.sql, @web/sql/14-soll-ist-abweichung.sql,
  @web/sql/02-gruppen-uebersicht.sql, @web/sql/09-investitionen.sql —
  SQL-Vorlagen, in dashboard-data.js portieren
@tests/e2e/dashboard.spec.mjs — Beispiel-Selektoren, hier neue Asserts
  ergaenzen (Schulden-Tab, Karten-Delta, neue Charts vorhanden)

<call_sites>
Diese Issue beruehrt KEINE CLI-Flags/-Kommandos/-Skripte. Sie aendert
ausschliesslich Browser-Code (`web/`), das SQL-Schema (`src/gemeindefinanzen/
schema.sql`, ueber `make web-sync` nach `web/schema.sql` synchronisiert)
und Tests (`tests/e2e/`, `tests/js/`). Der `gemfin` CLI-Entry
(`Makefile:14`) bleibt unangetastet — keine neuen Flags, keine geaenderten
Subkommandos. Folglich keine Adjazenzflaechen wie CI-YAML/README zu
aktualisieren ueber das uebliche `make web-sync` hinaus.

Geprueft:
- `Makefile` — `web-sync`-Ziel kopiert das Schema; das ist in Task 1 explizit
  Teil der Aktion (in scope).
- `.github/workflows/pages.yml` — deployt `web/` statisch; keine
  CLI-Invokation, kein Eingriff noetig.
- `README*` — keine CLI-Beispiele, die durch die Aenderung stale wuerden.
- `tools/`, `scripts/` — `scripts/serve.mjs`, `scripts/mupdf-geometrie.mjs`
  rufen die App nicht ueber Flags, sondern als Browser auf. Out of scope.
</call_sites>
</context>

<commit_format>
Format: `{id}: {message}` per `.issues/config.yaml` (`commit_format: "{id}: {message}"`).
Example: `a7x2n: feat(dashboard): Schulden-Tab mit Aufnahme/Tilgung-Saeulen`
Pattern: `a7x2n: <deutsche Beschreibung im Imperativ>`
- Keine Werkzeug-Attribution (kein "claude", "Generated with", "Co-Authored-By").
- ASCII-Deutsch (ae/oe/ue).
- Typischer Prefix: feat | fix | test | refactor | docs | chore.
</commit_format>

<tasks>

<task type="auto">
  <name>Task 1: R5 — Schema-Migration einwohner + Persistenz + Tier-3-Feinschliff (R13/R14/R15)</name>
  <files>src/gemeindefinanzen/schema.sql, web/schema.sql, web/js/db.js, web/js/app.js, web/js/dashboard-data.js, web/js/dashboard-charts.js, tests/js/run.mjs</files>
  <action>
  **R5 — Schema-Vorbereitung (Foundation fuer Task 2/3):**
  1. In `src/gemeindefinanzen/schema.sql` die `dokument`-Tabelle (Zeilen
     18-30) um `einwohner INTEGER` ergaenzen (nullable, hinter `seiten`).
     Kommentar: `-- optionale Einwohnerzahl fuer Pro-Kopf-Sichten (R5)`.
  2. `make web-sync` ausfuehren (oder manuell `cp src/gemeindefinanzen/
     schema.sql web/schema.sql`). NICHT direkt `web/schema.sql` editieren —
     wuerde beim naechsten web-sync ueberschrieben.
  3. In `web/js/db.js` NEUE exportierte Funktion `migrationenAnwenden(db)`
     einfuegen (nach `oeffneDb`):
     ```js
     export function migrationenAnwenden(db) {
       try {
         db.ausfuehren("ALTER TABLE dokument ADD COLUMN einwohner INTEGER")
       } catch (e) { /* Spalte existiert bereits — ok */ }
     }
     ```
     Begruendung: `schemaAnwenden` nutzt nur `CREATE IF NOT EXISTS`; eine
     spaeter hinzukommende Spalte braucht ALTER. SQLite wirft bei doppelter
     Spalte einen Fehler — daher try/catch.
  4. In `web/js/db.js` die `dokumente(db)`-Funktion (Zeilen 330-338) so
     erweitern, dass `einwohner` mit gelesen wird:
     ```js
     SELECT dokument_id, gemeinde, typ, finanzjahr, quelldatei, seiten,
            einwohner,
            (SELECT COUNT(*) FROM posten ... ) AS detailposten
     ```
  5. In `web/js/app.js` (nach `db.schemaAnwenden(schema)`, Zeile 41) den
     Import erweitern (`migrationenAnwenden` aus `./db.js`) und aufrufen:
     `migrationenAnwenden(db)`.
  6. In `web/js/dashboard-data.js` die `dokumente(db)`-Funktion (Zeilen
     49-65) so anpassen, dass das SELECT `einwohner` mitliest und das
     Objekt es als `einwohner` (number | null) ausgibt.

  **R10 — Einnahmen-Balken um Anteil ergaenzen (billig, hier mitnehmen):**
  In `web/js/dashboard-data.js` die `einnahmen`-Aggregation (Zeilen
  171-176) so erweitern, dass nach dem Mapping zusaetzlich eine
  Gesamtsumme `total = einnahmen.reduce((s,[,v])=>s+v,0)` berechnet wird
  und die Rueckgabe `einnahmen.map(([b,v]) => [b, round(v),
  Math.round(100*v/total)])` ist — also 3-Tuple `[bezeichnung, betrag,
  anteil_prozent]`. In `web/js/dashboard-charts.js` in `chartEinnahmen`
  (Zeilen 210-218) das Datenlabel ueber `series[0].label` setzen:
  ```js
  label: { show: true, position: "right", fontFamily: CHART_FONT,
           fontSize: AXIS_SIZE, color: ACHSE_TEXT,
           formatter: "(p)=>p.data && p.data.value!=null ? "
             + "(p.data.value/1e3).toLocaleString('de-AT',{maximumFractionDigits:0})"
             + " + ' k EUR  ' + p.dataIndex /*Platzhalter*/ : ''" }
  ```
  Sauberer: `bar()` als Helper bekommt einen optionalen `extraSerie`-
  Parameter, mit dem `chartEinnahmen` die Anteilszahl als zweiten
  Daten-Spalte uebergibt. Konkret: `chartEinnahmen` baut `vals =
  e.map(([,v]) => v)` und `pcts = e.map(([,,p]) => p)`, packt beides in
  `data[i] = { value: vals[i], anteil: pcts[i], itemStyle: { color:
  cols[i] } }` und schreibt `formatter: "(p)=>(p.value/1e3)
  .toLocaleString('de-AT')+' k EUR · '+p.data.anteil+' %'"`.

  **R13 — Korridor zweite Achse:**
  In `web/js/dashboard-charts.js` `chartKorridor` (Zeilen 407-439):
  zweite `yAxis` mit `position: 'right'`, `min: 0, max: 100`,
  `axisLabel.formatter: '(v)=>v + " %"'` ergaenzen. Die Summenlinien-Serie
  bekommt `yAxisIndex: 1` und der Wert wird in Prozent der Gesamtsumme
  umgerechnet: `data: korridor.map(([,, k]) => round(100*k/total))`.

  **R14 — Wertformate vereinheitlichen:**
  In `web/js/dashboard-charts.js` einen gemeinsamen Helfer ergaenzen:
  ```js
  function fmtMio(v) {
    return "(v)=>(v/1e6).toLocaleString('de-AT',"
      + "{minimumFractionDigits:1,maximumFractionDigits:1})+' Mio'"
  }
  ```
  In ALLEN `valAxis(...)`-Aufrufen die "k"/"Mio"-Inkonsistenz beseitigen —
  konsequent "Mio EUR" auf den Wertachsen, "k EUR" nur fuer Datenlabels
  auf einzelnen Posten (Einnahmen/Treiber/Investitionen). Das betrifft
  `chartWasserfall`, `chartTrendEckwerte`, `chartTrendKomm`,
  `chartTrendAufwand`, `chartKorridor`. Vor-Ist-Vergleich: dieselbe
  Skala-Konvention in Datenlabel UND Tooltip eines Diagramms.

  **R15 — Achsenlabels Ellipse + voller Name im Tooltip:**
  In den vier Buildern `chartEinnahmen` (Zeile 212), `chartTreiber` (230),
  `chartInvestitionen` (237), `chartKorridor` (409) die manuelle
  `b.slice(0, 34)`-Kuerzung ENTFERNEN. Stattdessen den vollen Text in der
  Kategorie behalten und `catAxis(cats, fontsize, rotate)` um ein
  optionales `axisLabel.formatter` erweitern:
  ```js
  formatter: "(v)=>v.length>34 ? v.slice(0,33)+'…' : v"
  ```
  Tooltip-Trigger 'axis' nutzt automatisch den vollen Kategorienamen.

  **Tests (R5 + R13/R14/R15):**
  - In `tests/js/run.mjs` einen neuen Test ergaenzen: nach `collect(db)`
    pruefen, dass `daten.dokumente[0]` ein `einwohner`-Feld besitzt
    (Wert `null` bei frisch importierten Fixtures — das ist OK; der Test
    pruft die Existenz des Feldes, nicht den Wert).
  - Einen weiteren Test, der `daten.aggregate[did].einnahmen[0]` als
    3-Tuple (Laenge 3, drittes Element vom Typ `number`) prueft.
  - `npm run test:js` muss gruen sein.

  **Commit:** `a7x2n: feat(daten): einwohner-Schema, Einnahmen-Anteil und
  Korridor-Lesbarkeit vorbereiten`
  </action>
  <verify>
  <automated>npm run test:js && PYTHONPATH=src python3 -m pytest tests/test_parser.py -q && ruff check src tests && mypy src && diff -q src/gemeindefinanzen/schema.sql web/schema.sql</automated>
  </verify>
  <done>
  - `src/gemeindefinanzen/schema.sql` und `web/schema.sql` sind identisch,
    beide enthalten `einwohner INTEGER`.
  - `migrationenAnwenden(db)` in `web/js/db.js` exportiert, in `app.js`
    nach `schemaAnwenden(schema)` aufgerufen.
  - `dokumente(db)` (in `db.js` UND in `dashboard-data.js`) liefert
    `einwohner` mit; bei Fixtures = `null`, bricht nichts.
  - `agg.einnahmen[i]` hat 3 Elemente `[bezeichnung, betrag, anteil_prozent]`.
  - `chartEinnahmen`-Datenlabel zeigt Betrag in k EUR plus Prozentanteil.
  - `chartKorridor` hat zwei y-Achsen; Summenlinie skaliert 0-100 %.
  - Achsenlabel-Ellipse aktiv, Tooltip zeigt vollen Text.
  - Wertachsen-Formatierung einheitlich "Mio EUR".
  - `npm run test:js` 62+/62+ gruen (Anzahl darf wachsen).
  - `mypy src` und `ruff check src tests` gruen.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: R5 — Einwohner-Eingabe in der Dokumentverwaltung (Variante A + B nebeneinander)</name>
  <files>web/index.html, web/css/app.css, web/js/app.js, web/js/dashboard-data.js, tests/e2e/dashboard.spec.mjs</files>
  <action>
  Beide Varianten der UI-Eingabe gleichzeitig anbieten. Variante A
  (Inline-Input je Zeile) und Variante B (Edit-Modal je Zeile) werden
  beide in `.doc-table` gerendert — Variante A als zusaetzliche Spalte
  "Einwohner:innen (A)", Variante B als zusaetzlicher Button "Bearbeiten
  (B)" in der Aktions-Spalte. Beide schreiben in dieselbe Spalte
  `dokument.einwohner` — der User vergleicht die UX, nicht die Daten.

  **Markup:**
  In `web/index.html` in der `.doc-table` (Doc-Tabelle innerhalb
  `#doc-manager`, vermutlich ~Zeile 79-96 plus `app.js`-gerendert) eine
  neue Spalte "Einwohner:innen (Variante A)" zwischen "Detailposten" und
  der Status-Spalte einfuegen. Die `<th>`-Zellen ergaenzen, die `<td>`
  rendert `app.js` (siehe unten). Den Edit-Button (Variante B) in die
  bestehende Aktions-Spalte neben `.doc-remove` einfuegen.

  **Edit-Modal (Variante B) — globales `<dialog>`-Element:**
  Am Ende von `<body>` (vor dem ECharts-`<script>`) ein
  `<dialog id="doc-einwohner-dialog">` mit knapper `<form method="dialog">`
  einfuegen: Label "Einwohner:innen (Stichtag heute)", `<input
  type="number" id="dlg-einwohner" min="0" step="1">`, Buttons
  "Speichern" + "Abbrechen". Style: bestehende `.gat-btn`-Klassen,
  Dialog selbst minimal mit `padding: 1.25rem; border: 0;
  border-radius: var(--web-radius-card); box-shadow: var(--web-shadow);`.

  **CSS:**
  `.doc-einwohner-input { width: 7em; }`,
  `.doc-edit-btn { ...gleiches Pattern wie .doc-remove, aber ohne
  destruktive Farbe }`. Beide nutzen `--web-*`-Tokens. In `app.css`
  Abschnitt 5 (Bedienelemente).

  **JS — `web/js/app.js`:**
  1. In `zeichneDokumentliste()` (Zeilen 222-256) je Zeile zusaetzlich
     rendern: `<td><input type="number" class="doc-einwohner-input"
     data-id="${d.dokument_id}" value="${d.einwohner ?? ''}" min="0"
     step="1" aria-label="Einwohnerzahl (Variante A)"></td>` und in der
     Aktionsspalte `<button class="doc-edit-btn" data-id="${...}"
     aria-label="Einwohnerzahl bearbeiten (Variante B)">bearbeiten</button>`.
  2. Im selben Block einen Eventhandler binden:
     - Auf `.doc-einwohner-input` auf `change`/`blur`:
       `db.ausfuehren("UPDATE dokument SET einwohner=? WHERE
       dokument_id=?", [val === '' ? null : Number(val), Number(id)])`,
       dann `await db.sichern()`, dann `zeichneDashboard()` (damit
       Pro-Kopf-Zeilen unmittelbar erscheinen). Keine `location.reload()`
       — die Eingabe darf den Fokus nicht verlieren.
     - Auf `.doc-edit-btn` auf `click`: `<dialog>` mit dem aktuellen Wert
       fuellen und via `.showModal()` oeffnen; `form` `submit`-Handler:
       Wert lesen, UPDATE+sichern+zeichneDashboard wie oben, dann
       `dialog.close()`.
  3. Wenn `db.persistent === false`, beide Eingabewege bleiben aktiv —
     der Wert lebt dann nur in der In-Memory-DB.

  **Tests (e2e):**
  - In `tests/e2e/dashboard.spec.mjs` einen neuen Test ergaenzen:
    "Einwohnerzahl wird gespeichert und triggert Pro-Kopf-Anzeige".
    Fixture-PDF laden, Dokumentverwaltung oeffnen, in
    `.doc-einwohner-input` z.B. `9000` eintippen, Tab raus (`blur()`),
    waehlen, dass die Tab-Panel-`#st-ertraege-pk` (NEU in Task 3)
    oder zumindest ein `[data-testid="pk-row"]` sichtbar wird.
    HINWEIS: Diese Assert kann an Task 3 gekoppelt werden — fuer Task 2
    reicht: nach `blur` ist `inputElement.value === "9000"` und ein
    `db.abfrage("SELECT einwohner FROM dokument")` (ueber
    `page.evaluate`) liefert 9000.
  - Variante B: Edit-Button klicken, Dialog ist `open`,
    `#dlg-einwohner` editieren, Speichern, Dialog ist `closed`, Wert
    persistiert.

  **Commit:** `a7x2n: feat(verwaltung): Einwohnerzahl je Dokument
  erfassen (Variante A Inline, Variante B Dialog)`
  </action>
  <verify>
  <automated>npm run test:js && npm run test:e2e && ruff check src tests</automated>
  </verify>
  <done>
  - Doc-Tabelle hat eine zusaetzliche Spalte "Einwohner:innen
    (Variante A)" mit Inline-Input.
  - Doc-Tabelle hat einen zusaetzlichen Edit-Knopf "Bearbeiten
    (Variante B)", der `<dialog id="doc-einwohner-dialog">` oeffnet.
  - Beide Wege schreiben `dokument.einwohner` und triggern
    `zeichneDashboard()`.
  - Persistenz: nach Reload bleibt der Wert in IndexedDB.
  - `npm run test:e2e` enthaelt mindestens einen neuen Test fuer die
    Einwohner-Eingabe (Variante A); alle e2e-Tests gruen.
  - Kein bestehender Selektor (`.tab-btn[data-tab]`, `.tab-panel[
    data-panel]`, `.switch-btn`, `.doc-status.ok`, alle `c_*`-Chart-Ids)
    geaendert.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: R1 + R5 — Kennzahlen-Karten: Vorjahresdelta + Pro-Kopf-Zeile</name>
  <files>web/index.html, web/css/app.css, web/js/dashboard-data.js, web/vendor/dashboard/dashboard.js, tests/js/run.mjs, tests/e2e/dashboard.spec.mjs</files>
  <action>
  **R1 — Vergleichssummen in `aggregateDok`:**
  In `web/js/dashboard-data.js` in `aggregateDok` (Zeilen 153-251) drei
  zusaetzliche Skalare berechnen — `ertraege_vgl`, `aufwand_vgl`,
  `netto_vgl` — analog den bestehenden `ertraege`/`aufwand`-Summen, aber
  mit `SUM(eh_vergleich)` statt `SUM(eh_wert)`. Daraus `delta_*_proz`
  ableiten:
  ```js
  const ertraege_vgl = scalar(db, `SELECT SUM(eh_vergleich) FROM v_detail
    WHERE richtung='einnahme' AND dokument_id=${did}`)
  // analog aufwand_vgl, dann netto_vgl = ertraege_vgl - aufwand_vgl
  const deltaProz = (jetzt, vgl) => vgl !== 0
    ? roundHalfEven(100*(jetzt-vgl)/Math.abs(vgl), 1) : null
  ```
  Im `eckwerte`-Block ergaenzen: `ertraege_vgl, aufwand_vgl, netto_vgl,
  delta_ertraege_proz, delta_aufwand_proz, delta_netto_proz`.

  **R5 — Pro-Kopf-Felder in `eckwerte`:**
  Im selben `aggregateDok` den `einwohner`-Wert des Dokuments lesen
  (`db.wert("SELECT einwohner FROM dokument WHERE dokument_id=?", [did])`)
  und vier Pro-Kopf-Felder berechnen — `null`, falls `einwohner` nicht
  gesetzt oder ≤ 0:
  ```js
  const ew = (n) => einwohner > 0 ? round(n/einwohner) : null
  // eckwerte.ertraege_pk = ew(ertraege); ...
  ```
  In `eckwerte`: `ertraege_pk, aufwand_pk, netto_pk, komm_pk`.

  **Markup — zweite Zeile auf jeder Kennzahlen-Karte:**
  In `web/index.html` Zeilen 132-145 (`.stats > .metric-card`) jede der
  vier Karten um zwei Sub-Zeilen erweitern:
  ```html
  <div class="stat metric-card metric-card--ertrag">
    <div class="stat-label">Ertraege</div>
    <div class="stat-num" id="st-ertraege"></div>
    <div class="stat-delta" id="st-ertraege-delta" hidden></div>
    <div class="stat-pk"    id="st-ertraege-pk"    hidden></div>
  </div>
  ```
  Analog `st-aufwand-delta`/`-pk`, `st-netto-delta`/`-pk`,
  `st-komm-anteil-delta` (Delta nur fuer absolute Posten, der
  Kommunalsteuer-Anteil kriegt einen Delta-Hinweis in Prozentpunkten)
  und `st-komm-pk` (Kommunalsteuer pro Kopf — interessant fuer
  Buergerhaushalt).

  **CSS:** Neue Klassen `.stat-delta` und `.stat-pk` in `web/css/app.css`
  Abschnitt 4 (Komponenten) als kleinere Sekundaerzeilen — Schrift
  `--web-text-soft`, Groesse ~0.9rem, `tabular-nums`. `.stat-delta.is-up`
  bekommt `color: var(--web-chart-green)`, `.stat-delta.is-down`
  bekommt `color: var(--web-clay-text)`. Optional kleines Unicode-Pfeil-
  Glyph (`↑`/`↓`) als Praefix.

  **Verdrahtung — `dashboard.js`:**
  Datei ist editierbar (CONTEXT). In `rerenderStats(dokId)` (Zeilen
  116-129) nach den vier `fillText`-Aufrufen ergaenzen:
  ```js
  function deltaText(d, vglLabel) {
    if (d == null) return ""
    var s = (d >= 0 ? "↑ +" : "↓ ") + d.toLocaleString("de-AT",
      { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %"
    return s + " ggü. " + vglLabel
  }
  function setDelta(id, d, vglLabel) {
    var el = document.getElementById(id)
    if (!el) return
    if (d == null) { el.hidden = true; return }
    el.textContent = deltaText(d, vglLabel)
    el.classList.toggle("is-up",   d >= 0)
    el.classList.toggle("is-down", d <  0)
    el.hidden = false
  }
  function setPk(id, val) {
    var el = document.getElementById(id)
    if (!el) return
    if (val == null) { el.hidden = true; return }
    el.textContent = "je Einwohner:in: " + euro(val)
    el.hidden = false
  }
  // Vergleichslabel aus dem Dokument lesen:
  var dokEntry = docs.find(d => String(d.id) === String(dokId))
  var vglLabel = dokEntry ? dokEntry.spalte_vergleich : "Vergleich"
  setDelta("st-ertraege-delta", e.delta_ertraege_proz, vglLabel)
  setDelta("st-aufwand-delta",  e.delta_aufwand_proz,  vglLabel)
  setDelta("st-netto-delta",    e.delta_netto_proz,    vglLabel)
  // Pro-Kopf:
  setPk("st-ertraege-pk",     e.ertraege_pk)
  setPk("st-aufwand-pk",      e.aufwand_pk)
  setPk("st-netto-pk",        e.netto_pk)
  setPk("st-komm-pk",         e.komm_pk)
  ```
  Tipp: `euro()` ist als `function euro(v, mio)` schon in dashboard.js.

  **Tests (TDD-Pattern):**
  - RED: In `tests/js/run.mjs` einen neuen Test ergaenzen, der gegen das
    Fixture-PDF `aggregateDok` aufruft und prueft:
    `agg.eckwerte.ertraege_vgl`, `delta_ertraege_proz` existieren und
    sind vom Typ `number`; `ertraege_pk == null` bei `einwohner == null`,
    aber Pflicht-Wert nach `UPDATE dokument SET einwohner=9000`.
  - GREEN: Die obige Implementierung erfuellt die Assertions.
  - REFACTOR: Doppelte SQL-Zeilen in eine kleine Helper-Funktion
    (`scalarFor(richtung, spalte, did)`) ziehen.
  - In `tests/e2e/dashboard.spec.mjs` neuer Test: "Kennzahlen-Karten
    zeigen Delta zum Vorjahr". Assert: `#st-ertraege-delta` ist
    sichtbar, enthaelt entweder "↑ +" oder "↓ ".

  **Commit:** `a7x2n: feat(kennzahlen): Vorjahresdelta und Pro-Kopf-Zeile
  auf den Kennzahlen-Karten`
  </action>
  <verify>
  <automated>npm run test:js && npm run test:e2e && ruff check src tests && mypy src</automated>
  </verify>
  <done>
  - `agg.eckwerte` enthaelt `ertraege_vgl`, `aufwand_vgl`, `netto_vgl`,
    `delta_*_proz` und `*_pk`-Felder.
  - Jede der vier Kennzahlen-Karten zeigt unter der Hauptzahl eine
    Delta-Zeile (Pfeil + Prozent + "ggü. {spalte_vergleich}").
  - Bei gesetzter `einwohner` erscheint zusaetzlich "je Einwohner:in:
    X EUR"; ohne `einwohner` ist die Zeile `hidden`.
  - Klassen `is-up`/`is-down` toggeln korrekt (gruen/clay).
  - Neue Tests in `tests/js/run.mjs` und `tests/e2e/dashboard.spec.mjs`
    sind gruen.
  - Bestehende e2e-Asserts auf `.tab-btn[data-tab="einnahmen"]` etc.
    weiterhin gruen — keine Selektor-Regression.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: R2 — Schulden &amp; Finanzierung als neuer Tab (Variante A + Variante B + R12 Variante A + B)</name>
  <files>web/index.html, web/js/dashboard-data.js, web/js/dashboard-charts.js, web/vendor/dashboard/dashboard.js, tests/js/run.mjs, tests/e2e/dashboard.spec.mjs</files>
  <action>
  **Tab-Markup:**
  In `web/index.html` Zeile 113-120 einen achten Tab-Button ergaenzen:
  `<button class="tab-btn" data-tab="schulden">Schulden &amp;
  Finanzierung</button>` — am Ende der Reihe vor "Suche &amp; Daten".

  Nach `<section class="tab-panel" data-panel="transfers">` ein neues
  Panel einfuegen:
  ```html
  <section class="tab-panel" data-panel="schulden">
    <div class="web-section-head">
      <h2>Schulden &amp; Finanzierung</h2>
      <p>Wie viel Kredit nimmt die Gemeinde auf, wie viel tilgt sie? Wie
        teuer ist der Schuldendienst (Tilgung + Zinsen)? Diese Sicht
        nutzt erstmals die Daten zur <strong>Finanzierungstaetigkeit</strong>
        (gebarung = "finanzierung") und kumuliert ueber alle Dokumente.</p>
    </div>

    <!-- Schuldendienst-Kennzahl als Karte -->
    <div class="stats stats--einspalt">
      <div class="stat metric-card metric-card--aufwand">
        <div class="stat-label">Schuldendienst (Tilgung + Zinsen)</div>
        <div class="stat-num" id="st-schuldendienst"></div>
        <div class="stat-pk" id="st-schuldendienst-pk" hidden></div>
      </div>
    </div>

    <!-- R2 Variante A: drei separate Panels -->
    <section class="web-panel">
      <div class="web-panel__head">
        <h3>Variante A · Aufnahme vs. Tilgung (Saeulen)</h3>
        <p class="web-panel__note">Saeulen je Dokument: Darlehensaufnahme
          (Einnahme) und Tilgung (Ausgabe) aus `gebarung='finanzierung'`.</p>
      </div>
      <div class="web-panel__body">
        <div id="c_fin_saeulen" class="dash-chart" style="height:440px"></div>
      </div>
    </section>

    <section class="web-panel">
      <div class="web-panel__head">
        <h3>Variante A · Schuldenstand kumuliert (Linie)</h3>
        <p class="web-panel__note">Kumulierte Netto-Veraenderung
          (Aufnahme − Tilgung) ueber alle Dokumente. <strong>Kein
          Bilanzstichtags-Stand</strong> — nur die kumulative Bewegung
          aus den eingelesenen Dokumenten. Falls ein echter
          Anfangs-Schuldenstand bekannt ist, kann er als Offset im
          Tooltip ergaenzt werden (heute nicht modelliert).</p>
      </div>
      <div class="web-panel__body">
        <div id="c_schuldenstand" class="dash-chart" style="height:440px"></div>
      </div>
    </section>

    <!-- R2 Variante B: Combo-Chart -->
    <section class="web-panel">
      <div class="web-panel__head">
        <h3>Variante B · Aufnahme/Tilgung + Stand (Combo)</h3>
        <p class="web-panel__note">Saeulen Aufnahme/Tilgung pro Jahr,
          Linie kumulierter Stand auf zweiter y-Achse — alles in einem
          Chart.</p>
      </div>
      <div class="web-panel__body">
        <div id="c_fin_combo" class="dash-chart" style="height:460px"></div>
      </div>
    </section>

    <!-- R12: Investitions-Finanzierung — Variante A + B -->
    <div class="dash-grid">
      <section class="web-panel">
        <div class="web-panel__head">
          <h3>Variante A · Investitions-Finanzierung (Stapel)</h3>
          <p class="web-panel__note">Gestapelte Saeule: Foerderungen,
            Darlehen, Eigenmittel (Rest). Eigenmittel sind als
            Restgroesse abgeleitet — mit Disclaimer.</p>
        </div>
        <div class="web-panel__body">
          <div id="c_investfin_a" class="dash-chart" style="height:380px"></div>
        </div>
      </section>
      <section class="web-panel">
        <div class="web-panel__head">
          <h3>Variante B · Investitions-Finanzierung (Mini-Sankey)</h3>
          <p class="web-panel__note">Quellen links, Investitionen rechts
            — eine vereinfachte Sankey-Darstellung.</p>
        </div>
        <div class="web-panel__body">
          <div id="c_investfin_b" class="dash-chart" style="height:380px"></div>
        </div>
      </section>
    </div>
  </section>
  ```

  **Aggregation — `web/js/dashboard-data.js`:**
  1. In `aggregateDok` neuen Block `finanzierung`:
     ```js
     const finAufnahme = scalar(db, `SELECT SUM(fh_wert) FROM v_detail
       WHERE gebarung='finanzierung' AND richtung='einnahme'
         AND dokument_id=${did}`)
     const finTilgung = scalar(db, `SELECT SUM(fh_wert) FROM v_detail
       WHERE gebarung='finanzierung' AND richtung='ausgabe'
         AND dokument_id=${did}`)
     // Schuldendienst = Tilgung + Zinsen (MVAG-224 ausgabe operativ):
     const zinsen = scalar(db, `SELECT SUM(eh_wert) FROM v_detail
       WHERE richtung='ausgabe' AND gebarung='operativ'
         AND substr(mvag_eh,1,3)='224' AND dokument_id=${did}`)
     // -> eckwerte.schuldendienst = round(finTilgung + zinsen)
     // -> finanzierung: { aufnahme, tilgung, schuldendienst }
     ```
     Pro-Kopf-Wert `schuldendienst_pk` analog Task 3.
  2. In `trend(db)` neuen Block `schuldenstand` ergaenzen, der ueber alle
     Dokumente die Bewegung kumuliert:
     ```js
     const fin = rows(db, `SELECT spalte_wert,
       SUM(CASE WHEN richtung='einnahme' THEN fh_wert ELSE 0 END),
       SUM(CASE WHEN richtung='ausgabe'  THEN fh_wert ELSE 0 END),
       typ FROM v_detail WHERE gebarung='finanzierung'
       GROUP BY dokument_id ORDER BY finanzjahr, ${ORDER}`)
     let kum = 0
     const schuldenstand = fin.map(([label, auf, til, typ]) => {
       kum += (auf || 0) - (til || 0)
       return [label, round(auf||0), round(til||0), round(kum), typ]
     })
     ```
  3. NEUE Aggregation `investFinanzierung` in `aggregateDok`:
     ```js
     const foerderung = scalar(db, `SELECT SUM(fh_wert) FROM v_detail
       WHERE gebarung='investiv' AND richtung='einnahme'
         AND dokument_id=${did}`)
     const investAus = scalar(db, `SELECT SUM(fh_wert) FROM v_detail
       WHERE gebarung='investiv' AND richtung='ausgabe'
         AND dokument_id=${did}`)
     const darlehen = Math.max(0, finAufnahme - finTilgung)
     // Wenn aufnahme > tilgung, Differenz als Investitionsdarlehen
     // klassifizieren (vereinfachte Heuristik mit Disclaimer im Panel).
     const eigen = Math.max(0, investAus - foerderung - darlehen)
     // -> investFinanzierung: { foerderung, darlehen, eigen }
     ```

  **Builder — `web/js/dashboard-charts.js`:**
  - `chartFinanzierung(agg)` (Variante A.1): zweispaltige Saeulen
    "Aufnahme" gruen, "Tilgung" clay. Achse zeigt nur den AKTUELLEN Wert
    — nicht ueber alle Dokumente (das ist der Combo-Chart). Falls beide
    Werte 0: ein dezenter Hinweistext im `graphic`-Block "Keine
    Finanzierungs-Posten in diesem Dokument".
  - `chartSchuldenstand(trend)` (Variante A.2): Liniendiagramm der
    `trend.schuldenstand`, x = labels, y = kumulierter Stand. Plan/Ist-
    Decal wie in bestehenden Trend-Charts (`trendBalken`-Pattern, aber
    Linie statt Saeule — keine Decal-Schraffur noetig, stattdessen
    Plan-Punkte hohl, Ist-Punkte voll).
  - `chartSchuldenCombo(agg, trend)` (Variante B): kombiniertes Diagramm
    mit zwei y-Achsen — links Saeulen Aufnahme/Tilgung je Dok, rechts
    Linie kumulierter Stand. Quelle = `trend.schuldenstand`.
  - `chartInvestFinanzierungStapel(agg)` (R12 Variante A): einzelne
    gestapelte Saeule mit drei Segmenten: Foerderung (INK.green), Darlehen
    (INK.blue), Eigenmittel (INK.soft). Label im Tooltip mit Disclaimer
    "Eigenmittel als Restgroesse abgeleitet".
  - `chartInvestFinanzierungSankey(agg)` (R12 Variante B): Mini-Sankey
    mit drei Quell-Knoten (Foerderung, Darlehen, Eigenmittel) und einem
    Ziel-Knoten "Investitionsvolumen". Selbe Daten wie Variante A,
    andere Form.

  In `alleCharts(daten)` die neuen Keys ergaenzen — pro dokId:
  `fin_saeulen, fin_combo, investfin_a, investfin_b`; in trendCharts:
  `schuldenstand`.

  **Verdrahtung — `dashboard.js`:**
  In den `registerChart`-Block (Zeilen 749-761) NEU:
  ```js
  registerChart("c_fin_saeulen",    "dok",   "fin_saeulen");
  registerChart("c_schuldenstand",  "trend", "schuldenstand");
  registerChart("c_fin_combo",      "dok",   "fin_combo");
  registerChart("c_investfin_a",    "dok",   "investfin_a");
  registerChart("c_investfin_b",    "dok",   "investfin_b");
  ```
  In `rerenderStats(dokId)` zusaetzlich:
  ```js
  fillText("st-schuldendienst", euro(e.schuldendienst, true))
  setPk("st-schuldendienst-pk", e.schuldendienst_pk)
  ```

  **Tests (TDD):**
  - RED: `tests/js/run.mjs` neuer Test: `agg.finanzierung` und
    `agg.investFinanzierung` existieren, sind `{ aufnahme, tilgung,
    schuldendienst: number }` bzw. `{ foerderung, darlehen, eigen:
    number }`; `daten.trend.schuldenstand` ist Array, monoton in der
    kumulativen Spalte sinnvoll (jeder neue Punkt = vorheriger +
    aufnahme - tilgung).
  - GREEN: Implementierung wie oben.
  - `tests/e2e/dashboard.spec.mjs`: neuer Test "Schulden-Tab oeffnen und
    Charts sichtbar" — `.tab-btn[data-tab="schulden"]` klicken,
    `.tab-panel[data-panel="schulden"].is-active`, `#c_fin_saeulen
    canvas`, `#c_schuldenstand canvas`, `#c_fin_combo canvas`,
    `#c_investfin_a canvas`, `#c_investfin_b canvas` alle sichtbar.

  **Commit:** `a7x2n: feat(dashboard): Schulden- und Finanzierungs-Tab
  mit Aufnahme/Tilgung/Stand (Variante A+B) und
  Investitions-Finanzierung (Variante A+B)`
  </action>
  <verify>
  <automated>npm run test:js && npm run test:e2e && PYTHONPATH=src python3 -m pytest tests/test_parser.py -q && ruff check src tests && mypy src</automated>
  </verify>
  <done>
  - Neuer Tab "Schulden &amp; Finanzierung" mit `data-tab="schulden"`/
    `data-panel="schulden"`.
  - Schuldendienst-Kennzahl-Karte sichtbar (`#st-schuldendienst`).
  - Drei Schulden-Charts (`#c_fin_saeulen`, `#c_schuldenstand`,
    `#c_fin_combo`) plus zwei Invest-Finanzierungs-Charts
    (`#c_investfin_a`, `#c_investfin_b`) sind im Tab vorhanden.
  - `agg.finanzierung`, `agg.investFinanzierung`, `agg.eckwerte
    .schuldendienst`, `trend.schuldenstand` sind im Datenobjekt.
  - Die beiden Varianten R2 (A: drei Panels, B: Combo) sind beide
    sichtbar mit Sub-Title "Variante A" / "Variante B".
  - Die beiden Varianten R12 (A: Stapel, B: Mini-Sankey) sind beide
    sichtbar.
  - Neue Tests in `tests/js/run.mjs` und `tests/e2e/dashboard.spec.mjs`
    gruen; bestehende Tests unveraendert gruen.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: R3 + R4 — Soll-Ist und Budgetierungspolster (je Variante A + B); R11 Sankey-Abschlussknoten</name>
  <files>web/index.html, web/js/dashboard-data.js, web/js/dashboard-charts.js, web/js/sankey-drill.js, web/vendor/dashboard/dashboard.js, tests/js/run.mjs, tests/e2e/dashboard.spec.mjs</files>
  <action>
  **R3 — Soll-Ist-Aggregation:**
  In `aggregateDok`, NUR wenn `dok.typ === 'RA'`:
  ```js
  // Dok-Typ aus separater Abfrage:
  const typ = db.wert(`SELECT typ FROM dokument WHERE dokument_id=${did}`)
  let sollIst
  if (typ === 'RA') {
    sollIst = rows(db, `SELECT bezeichnung, gruppe_text, richtung,
        ROUND(eh_vergleich,0), ROUND(eh_wert,0),
        ROUND(eh_wert - eh_vergleich, 0) AS abweichung
      FROM v_detail
      WHERE dokument_id=${did} AND ABS(eh_wert - eh_vergleich) > 20000
      ORDER BY ABS(eh_wert - eh_vergleich) DESC LIMIT 20`)
      .map(([b,g,r,s,i,a]) => [b, g||'', r, s, i, a])
  }
  // -> Result: sollIst (oder undefined)
  ```

  **R4 — Polster-Aggregation:**
  Analog, NUR wenn `typ === 'VA'`:
  ```js
  let polster
  if (typ === 'VA') {
    polster = rows(db, `SELECT bezeichnung, gruppe_text,
        ROUND(eh_dritte,0)                AS ist_ra,
        ROUND(eh_wert,0)                  AS voranschlag,
        ROUND(eh_wert - eh_dritte,0)      AS polster,
        CASE WHEN eh_dritte > 0
          THEN ROUND(100.0*(eh_wert-eh_dritte)/eh_dritte,0) END AS pp
      FROM v_detail
      WHERE richtung='ausgabe' AND eh_dritte > 2000
        AND eh_wert - eh_dritte > 5000 AND dokument_id=${did}
      ORDER BY (eh_wert - eh_dritte) DESC LIMIT 20`)
      .map(r => r.slice(0, 6))
  }
  ```

  **Builder:**
  - `chartSollIstDiverging(agg)` (R3 Variante A): zweiseitiges Balken-
    diagramm aus `agg.sollIst ?? []`, Form analog `chartTreiber`. Wert
    = `abweichung`. Mehrertrag/Minderaufwand gruen, Mehraufwand/
    Mindereinnahme clay. Posten oben = groesste positive Abweichung.
  - `chartSollIstDumbbell(agg)` (R3 Variante B): ECharts `scatter` +
    `lines`. Pro Posten zwei Punkte (Soll, Ist) auf gemeinsamer x-Achse
    (Wertachse), y = Kategorie. Linie dazwischen. Soll-Punkt blau,
    Ist-Punkt clay/gruen je Vorzeichen der Abweichung. Tipp: ECharts-
    `series` Array mit zwei `type: 'scatter'`-Serien fuer Soll/Ist plus
    einer `type: 'lines'`-Serie als Verbinder.
  - `chartPolsterDoppel(agg)` (R4 Variante A): horizontale Doppelbalken
    "Voranschlag" (Hauptbalken, gold) vs. "Ist-RA-Vorvorjahr" (heller
    Geistersbalken dahinter). Pattern aus dem `chartWasserfall`-Fix der
    Iteration 17.
  - `chartPolsterDiverging(agg)` (R4 Variante B): zweiseitige Balken-
    liste nach Polster-Hoehe in EUR — groesste Luft nach rechts (clay),
    wer unter dem Vorjahres-Ist liegt nach links (gruen).

  Alle Builder defensiv: `const liste = agg.sollIst ?? []` und bei
  leerer Liste eine ECharts-`graphic` mit Text "Nur fuer
  Rechnungsabschluesse / Voranschlaege verfuegbar" rendern.

  **Markup — Sparpotenzial-Tab umbauen:**
  In `web/index.html` Zeilen 313-358 (`data-panel="sparpotenzial"`):
  - Das doppelte Wasserfall-Panel `#c_wasserfall_sp` (Zeilen 320-325)
    ENTFERNEN.
  - Stattdessen vier neue Panels einfuegen (Soll-Ist A, Soll-Ist B,
    Polster A, Polster B):
    ```html
    <section class="web-panel">
      <div class="web-panel__head">
        <h3>Variante A · Soll-Ist-Abweichung (Diverging-Balken)</h3>
        <p class="web-panel__note">Posten mit den groessten Abweichungen
          zwischen Soll laut Voranschlag und Ist laut
          Rechnungsabschluss. <strong>Nur fuer Rechnungsabschluesse
          aussagekraeftig.</strong></p>
      </div>
      <div class="web-panel__body">
        <div id="c_sollist_a" class="dash-chart" style="height:480px"></div>
      </div>
    </section>
    <section class="web-panel">
      <div class="web-panel__head">
        <h3>Variante B · Soll-Ist (Dumbbell)</h3>
        ...
      </div>
      <div class="web-panel__body">
        <div id="c_sollist_b" class="dash-chart" style="height:480px"></div>
      </div>
    </section>
    <section class="web-panel">
      <div class="web-panel__head">
        <h3>Variante A · Budgetierungspolster (VA vs. letztes Ist)</h3>
        <p class="web-panel__note">Wo liegt der Voranschlag spuerbar
          ueber dem letzten Rechnungsabschluss? <strong>Nur fuer
          Voranschlaege aussagekraeftig.</strong></p>
      </div>
      <div class="web-panel__body">
        <div id="c_polster_a" class="dash-chart" style="height:480px"></div>
      </div>
    </section>
    <section class="web-panel">
      <div class="web-panel__head">
        <h3>Variante B · Budgetierungspolster (Diverging nach Polsterhoehe)</h3>
        ...
      </div>
      <div class="web-panel__body">
        <div id="c_polster_b" class="dash-chart" style="height:480px"></div>
      </div>
    </section>
    ```
  - Der `#c_korridor` und `#c_treiber` bleiben unveraendert; der callout
    "Wichtige Einordnung" bleibt am Ende.

  **R11 — Sankey-Abschlussknoten:**
  In `web/js/dashboard-charts.js` `chartSankey(agg)` (Zeilen 161-208):
  vor dem `return` einen zusaetzlichen Knoten/Link einfuegen:
  ```js
  const netto = agg.eckwerte.netto
  if (netto > 0) {
    node("Ueberschuss / Ruecklagenzufuhr", INK.green)
    links.push({ source: "Gemeindehaushalt",
                 target: "Ueberschuss / Ruecklagenzufuhr",
                 value: netto })
  } else if (netto < 0) {
    node("Abgangsdeckung", INK.red)
    links.push({ source: "Abgangsdeckung",
                 target: "Gemeindehaushalt",
                 value: -netto })
  }
  ```
  In `web/js/sankey-drill.js` in `buildSankeyOption` (Zeile ~181)
  DASSELBE Pattern einfuegen — der Drill-down baut sein eigenes
  Options-Objekt.

  **Verdrahtung — `dashboard.js`:**
  - In `registerChart` (Zeilen 749-761) den Eintrag
    `registerChart("c_wasserfall_sp", "dok", "wasserfall")` ENTFERNEN.
  - Neue Eintraege:
    ```js
    registerChart("c_sollist_a", "dok", "sollist_a");
    registerChart("c_sollist_b", "dok", "sollist_b");
    registerChart("c_polster_a", "dok", "polster_a");
    registerChart("c_polster_b", "dok", "polster_b");
    ```
  - Neuer `onDocChange`-Hook, der die typabhaengigen Panels
    zeigt/versteckt:
    ```js
    onDocChange(function (dokId) {
      var dok = docs.find(d => String(d.id) === String(dokId))
      if (!dok) return
      var istRA = dok.typ === "RA"
      var istVA = dok.typ === "VA"
      document.querySelector("#c_sollist_a")?.closest(".web-panel")
        ?.toggleAttribute("hidden", !istRA)
      document.querySelector("#c_sollist_b")?.closest(".web-panel")
        ?.toggleAttribute("hidden", !istRA)
      document.querySelector("#c_polster_a")?.closest(".web-panel")
        ?.toggleAttribute("hidden", !istVA)
      document.querySelector("#c_polster_b")?.closest(".web-panel")
        ?.toggleAttribute("hidden", !istVA)
    })
    ```
    (`?.toggleAttribute` ist nicht universell — eindeutig schreiben:
    `if (panel) panel.hidden = !istRA`.)

  In `alleCharts(daten)` die neuen Keys ergaenzen: `sollist_a, sollist_b,
  polster_a, polster_b`.

  **Tests (TDD):**
  - RED: `tests/js/run.mjs`: pruefen, dass fuer ein RA-Dokument
    `agg.sollIst` ein Array ist; fuer ein VA-Dokument
    `agg.polster` ein Array; jeweils im falschen Typ `undefined`.
    Pruefen, dass `chartSankey({eckwerte: {ertraege: 1000, aufwand: 600,
    netto: 400, ...}, sankey: {quellen: [], gruppen: []}})` einen Knoten
    "Ueberschuss / Ruecklagenzufuhr" enthaelt.
  - GREEN: Implementierung wie oben.
  - `tests/e2e/dashboard.spec.mjs`: Im Sparpotenzial-Tab beim Wechsel
    zwischen RA- und VA-Dokument-Switch toggelt die Sichtbarkeit der
    vier Panels.

  **Commit:** `a7x2n: feat(sparpotenzial): Soll-Ist und Polster (je
  Variante A+B), Sankey-Abschlussknoten`
  </action>
  <verify>
  <automated>npm run test:js && npm run test:e2e && ruff check src tests && mypy src</automated>
  </verify>
  <done>
  - `agg.sollIst` befuellt bei `typ='RA'`, sonst undefined; analog
    `agg.polster` bei `typ='VA'`.
  - Im Sparpotenzial-Tab sind die vier neuen Panels vorhanden
    (`#c_sollist_a`, `#c_sollist_b`, `#c_polster_a`, `#c_polster_b`).
  - `#c_wasserfall_sp` ENTFERNT (Markup, Chart-Builder-Wiring,
    `registerChart`-Eintrag).
  - `onDocChange`-Hook versteckt die typfremden Panels.
  - Sankey enthaelt einen Abschlussknoten (Ueberschuss oder
    Abgangsdeckung) abhaengig von `netto`.
  - Drill-down-Sankey (`sankey-drill.js::buildSankeyOption`) enthaelt
    denselben Abschlussknoten.
  - Alle Tests gruen; neue Asserts decken die typabhaengige Sichtbarkeit
    ab.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: R6 + R7 + R8 (A+B, Aus+Ein) — Aufgabenbereiche und "Wofuer geht 1 Euro?"</name>
  <files>web/index.html, web/js/dashboard-data.js, web/js/dashboard-charts.js, web/vendor/dashboard/dashboard.js, tests/js/run.mjs, tests/e2e/dashboard.spec.mjs</files>
  <action>
  **R6 — Aufgabenbereiche als sortierte Balken (Ausgaben-Tab umbauen):**
  In `web/index.html` Zeilen 219-232 (`data-panel="ausgaben"`):
  - Neues Panel `#c_gruppen_balken` als ERSTES Diagramm im Ausgaben-Tab:
    ```html
    <section class="web-panel">
      <div class="web-panel__head">
        <h3>Aufwand nach Aufgabenbereich (sortierte Balken)</h3>
        <p class="web-panel__note">Horizontales Ranking — Laengen sind
          leichter vergleichbar als Flaechen. Treemap unten als
          Detailsicht.</p>
      </div>
      <div class="web-panel__body">
        <div id="c_gruppen_balken" class="dash-chart" style="height:460px"></div>
      </div>
    </section>
    ```
    Den bestehenden `.dash-grid` mit "Aufwand nach Art (Ring)" + Treemap
    DARUNTER lassen. Die Treemap bekommt im Kopf den Zusatz
    "(Detailsicht)".

  **R7 — Saldo je Aufgabenbereich (neues Panel im Ausgaben-Tab):**
  Direkt nach `c_gruppen_balken`:
  ```html
  <section class="web-panel">
    <div class="web-panel__head">
      <h3>Saldo je Aufgabenbereich (Einnahmen − Ausgaben)</h3>
      <p class="web-panel__note">Welcher Bereich traegt sich selbst,
        welcher ist ein Zuschussbereich? Gruen = Ueberschuss, Clay =
        Zuschussbereich.</p>
    </div>
    <div class="web-panel__body">
      <div id="c_gruppen_saldo" class="dash-chart" style="height:460px"></div>
    </div>
  </section>
  ```

  **R8 — "Wofuer geht 1 Euro?" / "Wofuer kommen 100 Euro herein?"
  oberhalb der Stats-Karten im Ueberblick-Tab:**
  In `web/index.html` direkt nach `<section class="tab-panel"
  data-panel="ueberblick">` und VOR `.web-section-head` (oder zwischen
  `web-section-head` und `.stats`) eine `.dash-grid` mit vier Panels
  einfuegen:
  ```html
  <div class="dash-grid">
    <section class="web-panel">
      <div class="web-panel__head">
        <h3>Variante A · Wofuer geht 1 Euro? (100-%-Stapelbalken)</h3>
      </div>
      <div class="web-panel__body">
        <div id="c_eineuro_aus_a" class="dash-chart" style="height:200px"></div>
      </div>
    </section>
    <section class="web-panel">
      <div class="web-panel__head">
        <h3>Variante B · Wofuer geht 1 Euro? (10×10 Piktogramm)</h3>
      </div>
      <div class="web-panel__body">
        <div id="c_eineuro_aus_b" class="dash-chart" style="height:320px"></div>
      </div>
    </section>
    <section class="web-panel">
      <div class="web-panel__head">
        <h3>Variante A · Wofuer kommen 100 Euro herein? (100-%-Stapel)</h3>
      </div>
      <div class="web-panel__body">
        <div id="c_eineuro_ein_a" class="dash-chart" style="height:200px"></div>
      </div>
    </section>
    <section class="web-panel">
      <div class="web-panel__head">
        <h3>Variante B · Wofuer kommen 100 Euro herein? (10×10 Piktogramm)</h3>
      </div>
      <div class="web-panel__body">
        <div id="c_eineuro_ein_b" class="dash-chart" style="height:320px"></div>
      </div>
    </section>
  </div>
  ```

  **Aggregation — `dashboard-data.js`:**
  1. `gruppenSaldo` in `aggregateDok` (R7) — Portierung von
     `web/sql/02-gruppen-uebersicht.sql`, parametriert auf `dokument_id`:
     ```js
     const gruppenSaldoRows = rows(db,
       `SELECT gruppe, gruppe_text,
          ROUND(SUM(CASE WHEN richtung='einnahme' THEN eh_wert END), 0),
          ROUND(SUM(CASE WHEN richtung='ausgabe'  THEN eh_wert END), 0),
          ROUND(SUM(CASE WHEN richtung='einnahme' THEN eh_wert
                         ELSE -eh_wert END), 0)
        FROM v_detail WHERE dokument_id=${did}
        GROUP BY gruppe, gruppe_text ORDER BY gruppe`)
     // -> Array<[gruppe, gruppe_text, einnahmen, ausgaben, saldo]>
     ```
  2. `einEuroAuf` (R8 Ausgabenseite) — auf 100 normalisiert:
     ```js
     const ausTotal = aufwandArt.reduce((s,[,v]) => s + v, 0) || 1
     const einEuroAuf = aufwandArt.map(([cat, v]) =>
       [cat, Math.round(100 * v / ausTotal)])
     ```
     `einEuroEin` analog aus `agg.sankey.quellen` (auf 100 normalisiert).

  **Builder — `dashboard-charts.js`:**
  - `chartGruppenBalken(agg)` (R6): horizontale Balkenliste aus
    `agg.gruppen` sortiert nach Betrag desc, via `bar(cats, vals,
    INK.orange)`. Wiederverwendet die bestehende `bar()`-Hilfsfunktion.
    Kategorienamen aus `gruppe_text` (Fallback "Gruppe X" wenn leer).
  - `chartGruppenSaldo(agg)` (R7): zweiseitiges Balkendiagramm wie
    `chartTreiber`. `vals = gruppenSaldo.map(r => r[4])`, Farben:
    `v >= 0 ? INK.green : INK.red`. Sortierung nach Saldo (groesster
    Ueberschuss oben, groesster Zuschussbedarf unten).
  - `chartEinEuroStapel(agg, seite)` (R8 Variante A): einzelner
    horizontaler 100-%-Stapelbalken (genau eine Kategorie auf der
    y-Achse, Segmente in fester Farbreihenfolge). Quelle = `seite ===
    'aus' ? agg.einEuroAuf : agg.einEuroEin`. `series` ist
    n-elementig, jede Serie ein Segment. Datenlabel: Cent-Wert plus
    Kategorie ("18 Cent Personal").
  - `chartEinEuroPikto(agg, seite)` (R8 Variante B): ECharts
    `pictorialBar` mit 100 Symbolen (`symbol: 'rect'`, `data: 100`),
    eingefaerbt nach Kategorie-Anteil. Implementierung:
    `series` ist eine Liste von gestapelten `bar`-Serien mit
    `barCategoryGap: '0%'` und `symbolRepeat: true`, oder bewusst
    schlichter ueber `series.type = 'pie'` mit `roseType: false` plus
    100 gleichgrosse Slices — pragmatisch akzeptabel.

  In `alleCharts(daten)` neue Keys: `gruppen_balken`, `gruppen_saldo`,
  `eineuro_aus_a`, `eineuro_aus_b`, `eineuro_ein_a`, `eineuro_ein_b`.

  **Verdrahtung — `dashboard.js`:**
  In `registerChart`-Block:
  ```js
  registerChart("c_gruppen_balken", "dok", "gruppen_balken");
  registerChart("c_gruppen_saldo",  "dok", "gruppen_saldo");
  registerChart("c_eineuro_aus_a",  "dok", "eineuro_aus_a");
  registerChart("c_eineuro_aus_b",  "dok", "eineuro_aus_b");
  registerChart("c_eineuro_ein_a",  "dok", "eineuro_ein_a");
  registerChart("c_eineuro_ein_b",  "dok", "eineuro_ein_b");
  ```

  **Tests (TDD):**
  - RED: `tests/js/run.mjs`: pruefen, dass `agg.gruppenSaldo`,
    `agg.einEuroAuf`, `agg.einEuroEin` existieren. `einEuroAuf`-Summe
    der Anteile = 100 ± 1 (Rundung).
  - GREEN: Implementierung wie oben.
  - `tests/e2e/dashboard.spec.mjs`: im Ausgaben-Tab `#c_gruppen_balken
    canvas` sichtbar; im Ueberblick `#c_eineuro_aus_a canvas` sichtbar.

  **Commit:** `a7x2n: feat(ausgaben+ueberblick): sortierte Aufgabenbereich-
  Balken, Saldo je Bereich, 1-Euro/100-Euro-Komposition (je Variante A+B)`
  </action>
  <verify>
  <automated>npm run test:js && npm run test:e2e && ruff check src tests && mypy src</automated>
  </verify>
  <done>
  - Ausgaben-Tab beginnt mit `#c_gruppen_balken` (sortierte Balken),
    Treemap weiter unten als Detailsicht.
  - Neues Panel `#c_gruppen_saldo` (zweiseitig).
  - Ueberblick-Tab oeffnet mit vier neuen Panels (je 2x Variante A/B fuer
    Ausgabenseite und Einnahmenseite).
  - `agg.gruppenSaldo` und `agg.einEuroAuf`/`einEuroEin` sind in
    `aggregateDok` befuellt; Anteilssumme = 100 ± 1.
  - Alle neuen Chart-Divs sind in `registerChart` verdrahtet.
  - Tests gruen.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 7: R9 — "Gebunden vs. gestaltbar" (Variante A + B) plus Pflichtumlagen-Helper-Zentralisierung; final-Lauf</name>
  <files>web/index.html, web/js/dashboard-data.js, web/js/dashboard-charts.js, web/vendor/dashboard/dashboard.js, tests/js/run.mjs, tests/e2e/dashboard.spec.mjs</files>
  <action>
  **Pflichtumlagen-Helper hochziehen (Pitfall RESEARCH.md):**
  In `web/js/dashboard-data.js` neuen exportierten Helper:
  ```js
  export function istPflichtumlage(bezeichnung) {
    return /umlage|nökas|nokas|sozialhilfe|krankenanstalt/i
      .test(String(bezeichnung || ""))
  }
  ```
  In `dashboard.js` (Zeilen 160-161) den Regex DURCH den Helper ersetzen
  — aber: dashboard.js ist ein klassisches Skript, kein ESM-Modul; der
  Helper muss ueber DATA oder ein globales Window-Symbol verfuegbar
  sein. Loesung: in `dashboard-app.js` `window.istPflichtumlage =
  istPflichtumlage` setzen (zusaetzlicher Import); in `dashboard.js`
  `var pflicht = (window.istPflichtumlage || function(){return false})(r[0])`
  statt der Inline-Regex. Saubere Heuristik-Quelle, keine
  Verdoppelung.

  **R9 — Bindungs-Aggregation in `aggregateDok`:**
  ```js
  // Bindungs-Aggregation: pro Posten klassifizieren und summieren.
  // Quelle: alle ausgaben-operativen Posten dieses Dokuments.
  const bindungsZeilen = rows(db, `SELECT bezeichnung, mvag_eh,
       konto, eh_wert FROM v_detail
     WHERE richtung='ausgabe' AND gebarung='operativ'
       AND eh_wert > 0 AND dokument_id=${did}`)
  const bindung = { personal: 0, pflichtumlagen: 0, finanz: 0,
                    freiwilligeTransfers: 0, freieSachaus: 0, unklar: 0 }
  for (const [bez, mvag, konto, wert] of bindungsZeilen) {
    const m3 = String(mvag||"").slice(0,3)
    if (m3 === "221") bindung.personal += wert
    else if (m3 === "224") bindung.finanz += wert
    else if (m3 === "223") {
      if (istPflichtumlage(bez)) bindung.pflichtumlagen += wert
      else bindung.freiwilligeTransfers += wert
    } else if (m3 === "222") {
      // Korridor-Filter aus dashboard-data.js:213-215 wiederverwenden:
      const nichtZahlung = String(konto||"").startsWith("68") ||
        /errechnungsr/i.test(bez)
      if (!nichtZahlung) bindung.freieSachaus += wert
      else bindung.unklar += wert
    } else bindung.unklar += wert
  }
  // Runden:
  for (const k of Object.keys(bindung)) bindung[k] = round(bindung[k])
  ```

  **Builder:**
  - `chartBindungStapel(agg)` (Variante A): einzelner horizontaler
    100-%-Stapelbalken mit den sechs Segmenten Personal (INK.blue,
    "gebunden"), Pflichtumlagen (INK.red, "gebunden"), Finanz (INK.soft,
    "gebunden"), freiwillige Transfers (INK.orange, "teilweise gebunden"),
    freie Sachausgaben (INK.green, "gestaltbar"), unklar (INK.soft,
    "automatisch erkannt"). Tooltip-Hinweis "Pflichtumlagen werden per
    Bezeichnungs-Regex erkannt — Fehlklassifikation moeglich".
  - `chartBindungSaeulen(agg)` (Variante B): vertikale gestapelte Saeulen
    pro Aufwandsart-Gruppe (Personal, Sachaufwand, Transfer, Finanz),
    jeweils intern in "gebunden / gestaltbar" geteilt — Personal komplett
    gebunden, Sach komplett gestaltbar, Transfer geteilt nach
    pflichtumlagen vs. freiwillig, Finanz komplett gebunden.

  **Markup:**
  In Sparpotenzial-Tab (`data-panel="sparpotenzial"`), vor dem `callout`
  am Ende:
  ```html
  <div class="dash-grid">
    <section class="web-panel">
      <div class="web-panel__head">
        <h3>Variante A · Gebunden vs. gestaltbar (100 %-Stapel)</h3>
        <p class="web-panel__note">Welcher Anteil der operativen Ausgaben
          ist kurzfristig kaum beweglich? Personal, Pflichtumlagen,
          Finanzaufwand gelten als gebunden; freie Sachausgaben als
          gestaltbar. <strong>Pflichtumlagen sind heuristisch erkannt
          (per Bezeichnungs-Regex).</strong></p>
      </div>
      <div class="web-panel__body">
        <div id="c_bindung_a" class="dash-chart" style="height:220px"></div>
      </div>
    </section>
    <section class="web-panel">
      <div class="web-panel__head">
        <h3>Variante B · Bindung je Aufwandsart (gestapelte Saeulen)</h3>
        <p class="web-panel__note">Pro Aufwandsart-Gruppe der gebundene
          und gestaltbare Anteil.</p>
      </div>
      <div class="web-panel__body">
        <div id="c_bindung_b" class="dash-chart" style="height:360px"></div>
      </div>
    </section>
  </div>
  ```

  **Verdrahtung:**
  In `alleCharts(daten)` und `registerChart`-Block:
  ```js
  registerChart("c_bindung_a", "dok", "bindung_a");
  registerChart("c_bindung_b", "dok", "bindung_b");
  ```

  **Tests (TDD):**
  - RED: `tests/js/run.mjs`: `agg.bindung` ist Objekt mit allen sechs
    Schluesseln, Summe ≥ 0, jede Komponente >= 0. `istPflichtumlage(
    "Sozialhilfeumlage")` → true; `istPflichtumlage("Sachaufwand")` →
    false.
  - GREEN: Implementierung wie oben.
  - `tests/e2e/dashboard.spec.mjs`: `#c_bindung_a canvas`,
    `#c_bindung_b canvas` im Sparpotenzial-Tab sichtbar.

  **Abschluss-Sweep (Tier-3-Reste, falls noch offen):**
  - Sicherstellen, dass alle Builder die in Task 1 eingefuehrten
    Wertformat-/Ellipse-Konventionen tatsaechlich nutzen — `grep` in
    `dashboard-charts.js` nach `.slice(0,` zeigt keine Treffer ausserhalb
    von `axisLabel.formatter`.
  - `make web-sync` erneut ausfuehren und pruefen, dass
    `web/schema.sql` mit der Quelle identisch ist.

  **Commit:** `a7x2n: feat(sparpotenzial): Bindung vs. Gestaltbarkeit
  (Variante A+B), Pflichtumlagen-Helper zentralisiert`
  </action>
  <verify>
  <automated>npm run test:js && npm run test:e2e && PYTHONPATH=src python3 -m pytest tests/test_parser.py -q && ruff check src tests && mypy src && diff -q src/gemeindefinanzen/schema.sql web/schema.sql</automated>
  </verify>
  <done>
  - `istPflichtumlage(bezeichnung)` ist in `dashboard-data.js`
    exportiert; `dashboard.js` und `aggregateDok` nutzen DENSELBEN
    Helper (keine duplizierte Regex).
  - `agg.bindung = { personal, pflichtumlagen, finanz,
    freiwilligeTransfers, freieSachaus, unklar }` befuellt.
  - Sparpotenzial-Tab enthaelt `#c_bindung_a` und `#c_bindung_b` als
    Twin-Panel, beide mit Disclaimer im Note-Text.
  - Tooltip auf `chartBindungStapel` warnt vor Heuristik-Charakter.
  - `make web-sync` lief; Schema-Dateien identisch.
  - Alle Tests gruen, `mypy` und `ruff` gruen.
  </done>
</task>

</tasks>

<verification>
Nach Abschluss aller Tasks die volle Testbatterie laufen lassen — beide
Runner-Pfade explizit:

```
npm run test:js                          # Browser-App JS-Tests (Node)
npm run test:e2e                         # Playwright e2e
PYTHONPATH=src python3 -m pytest -q      # Python-Pipeline-Tests
ruff check src tests                      # Linter
mypy src                                  # Statische Typprueefung
diff -q src/gemeindefinanzen/schema.sql web/schema.sql  # Sync-Check
```

Zusaetzlich manuell-visuelle Pruefung (laut Issue-Akzeptanzkriterien):
1. App in localhost oeffnen (`npm run serve`), Fixture-PDF laden.
2. Auf jedem Tab die Variante-A/B-Paare als Screenshots dokumentieren
   (Schulden-Tab, Sparpotenzial-Tab, Ueberblick-Tab) — Grundlage fuer
   die spaetere "Pick-A-or-B"-Iteration.
3. Einwohnerzahl auf der Doc-Tabelle setzen (z. B. 9000 fuer das
   Hauptdokument), pruefen, dass Pro-Kopf-Zeilen auf jeder
   Kennzahlen-Karte und auf der Schuldendienst-Karte erscheinen, und
   dass nach Reload (`location.reload()` via Browser) der Wert
   persistent ist.
4. Doc-Switch zwischen VA und RA: das Soll-Ist-Panel sichtbar nur bei RA,
   das Polster-Panel sichtbar nur bei VA. Mit Konsolen-Logs pruefen,
   dass `onDocChange`-Hook tatsaechlich greift.
</verification>

<success_criteria>
Diese Kriterien sind 1:1 die Akzeptanzkriterien aus
`.issues/auswertungen-erweitern-gemeindebudget/ISSUE.md` plus die in
diesem Plan zusaetzlich beschlossenen Lieferungen (R7, R8, R9, R10, R11,
R12 ueber den Konsens-Kern hinaus):

- [ ] **Kennzahlen tragen sichtbaren Vergleich (Vorjahr/Ist).** Auf jeder
  der vier `.metric-card` ist eine Delta-Zeile sichtbar. Color-Coded
  (gruen/clay) und mit dynamischem Vergleichs-Label aus
  `dokument.spalte_vergleich`. → Task 3.
- [ ] **Pro-Kopf-Werte verfuegbar, sobald die Einwohnerzahl erfasst ist.**
  Eingabe per Inline-Input (Variante A) ODER Edit-Dialog (Variante B) in
  der Doc-Tabelle; persistiert in `dokument.einwohner`; Pro-Kopf-Zeile
  erscheint sofort auf den Kennzahlen-Karten und auf der
  Schuldendienst-Karte; verschwindet, wenn der Wert geloescht wird.
  → Task 1, Task 2, Task 3, Task 4.
- [ ] **Schulden/Finanzierung sind grafisch dargestellt.** Neuer Tab
  `data-tab="schulden"` enthaelt Aufnahme/Tilgung-Saeulen,
  Schuldenstand-Linie (kumuliert), Combo-Variante,
  Investitions-Finanzierungs-Stapel und -Sankey, sowie
  Schuldendienst-Karte. → Task 4.
- [ ] **Soll-Ist-Abweichung und Budgetierungspolster haben je ein
  Diagramm.** Im Sparpotenzial-Tab je Variante A + B; typabhaengig
  ein-/ausgeblendet ueber `onDocChange`-Hook. → Task 5.
- [ ] **Aufgabenbereiche sind als sortierte Balken vergleichbar.**
  Ausgaben-Tab beginnt mit `#c_gruppen_balken` (sortierte horizontale
  Balken). Treemap bleibt als sekundaere Detailsicht weiter unten.
  → Task 6.
- [ ] **Tests bleiben gruen:** `npm run test:js`, `npm run test:e2e`,
  `PYTHONPATH=src python3 -m pytest -q`, `ruff check src tests`,
  `mypy src` jeweils erfolgreich. → in JEDER Task verifiziert; finaler
  Sweep in Task 7.

Zusatz-Kriterien aus dem Plan (Konsens-erweiternd, Pflichtlieferung):
- [ ] **Saldo je Aufgabenbereich** als zweiseitiges Balkendiagramm
  vorhanden. → Task 6.
- [ ] **"Wofuer geht 1 Euro?" und "Wofuer kommen 100 Euro herein?"**
  je Variante A + B im Ueberblick. → Task 6.
- [ ] **"Gebunden vs. gestaltbar"** je Variante A + B im
  Sparpotenzial-Tab, mit transparentem Heuristik-Disclaimer. → Task 7.
- [ ] **Sankey-Abschlussknoten** (Ueberschuss/Abgangsdeckung) — in
  beiden Sankey-Buildern (`chartSankey` + `buildSankeyOption`). → Task 5.
- [ ] **Korridor zweite Achse, Wertformate vereinheitlicht,
  Achsenlabel-Ellipse** umgesetzt. → Task 1.
</success_criteria>
