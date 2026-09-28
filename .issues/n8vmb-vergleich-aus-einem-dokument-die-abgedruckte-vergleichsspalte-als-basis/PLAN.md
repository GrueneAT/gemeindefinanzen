# Plan: Vergleich aus einem Dokument — die abgedruckte Vergleichsspalte als Basis

<objective>
**Was dieser Plan erreicht:** Der Vergleichs-Tab der Browser-App bekommt eine
**zweite Herkunft fuer die Basis-Seite** — die im Vergleichsdokument selbst
abgedruckte Spalte 2. Damit zeigt ein allein geladener Nachtragsvoranschlag
seinen vollstaendigen Diff (Ertraege +790.300, Aufwendungen +502.200,
Nettoergebnis +288.100 im EHH des NVA 2026), ohne dass ein zweites Dokument
geladen sein muss. Der Tab erscheint ab **einem** Dokument mit gefuellter
Vergleichsspalte, die interne Spalte ist die Vorbelegung (D1), und Kopfzeile,
Tabellenkopf, Wasserfall-Achse und CSV-Name benennen die Herkunft der Basis
(D3).

**Warum das zaehlt:** Die dokumentinterne Spalte ist per Definition die Fassung,
gegen die das Dokument rechnet — verlaesslicher als ein daneben gelegtes,
moeglicherweise aelteres Dokument (Herzogenburger `VA-2026-Auflage.pdf`:
Community Nurse fehlt, 200.600 EUR). Und der haeufigste Fall — nur den Nachtrag
laden — zeigt heute gar keinen Vergleich.

**Kein neuer Rechenweg.** `aggregiereDokument()` sammelt `wert` (Spalte 1) und
`vergleich` (Spalte 2) bereits in einem Durchlauf
(`web/js/vergleich-daten.js:79-80`). Der interne Modus ist eine **Projektion**:
dieselbe Map, auf dem anderen Feld gelesen. Alle fuenf Sichten, Filter,
Sortierung, Tabelle und CSV-Export bleiben unveraendert.

**In Scope:** interne Basis in `baueDiff`, Sentinel `BASIS_INTERN`,
Auswahl-Eintrag, D1-Vorbelegung, datenbasierte Sichtbarkeit, Beschriftung an
allen sechs Stellen, `kontrolle()`-Korrektur samt RA-Fall (D2), js- und
e2e-Tests, Nachzug in `web/index.html` und `docs/BROWSER-APP.md`.

**Out of Scope (CONTEXT.md D4, „Nicht in diesem Schritt"):**
- Das Kontroll-Panel um **aktives Umschalten** auf das ausloesende Dokument
  erweitern. Das Panel **nennt** das Dokument, es schaltet nicht darauf um.
- D2 ueber mehrere Jahre breiter absichern (weitere Herzogenburger RA holen).
- Die Python-Pipeline (`src/`) — sie enthaelt keine Diff-Engine und wird nicht
  angefasst, muss aber gruen bleiben.
</objective>

<strategy>
**Richtung:** Eine Projektion statt eines zweiten Rechenwegs. `baueDiff`
akzeptiert in `a` einen exportierten Sentinel `BASIS_INTERN`; trifft er zu, wird
`aggB` zuerst gebaut und `aggA` als **Klon** daraus abgeleitet
(`{ ...e, wert: e.vergleich, vergleich: 0 }`). Ab `vergleich-daten.js:123` liest
die Engine nur zwei Maps derselben Form, ab Zeile 162 nur die fertigen `zeilen`
— alles dahinter bleibt unangetastet. Die einzige Funktion, die die Aggregate
liest, ist `kontrolle()`, und die wird im internen Modus **nicht** aufgerufen.

**Strategische Optionen und warum die gewaehlte gewinnt:**

1. **Sentinel in `a`** gegen ein zusaetzliches Feld `modus: "intern"`.
   `{ a: 5, modus: "intern" }` ist ein Widerspruch — zwei Zustaende fuer eine
   Sache, ueberall mitzupruefen. `dokument_id` ist `INTEGER PRIMARY KEY`
   (`web/schema.sql:19`) und wird durchgehend per `String(...)` verglichen; ein
   nicht-numerischer String kann nicht kollidieren. `zustand.a` und der `value`
   des `#vgl-a`-Select bleiben **ein** Feld. `a: null` waere keine Alternative —
   `null` heisst dort schon „noch nichts gewaehlt".
2. **Datenbasierte Sichtbarkeit** (`hatVergleichsspalte` ueber `ev`/`fv`) gegen
   ein Typ- oder Namens-Gate. Empirisch entschieden, nicht abgewogen: ein
   OH-CSV-Dokument traegt den Spaltennamen („VA 2025", `loader.js:31`), aber
   **keine** Werte (`csv-parser.js:305,307` setzt nur `eh_wert`/`fh_wert`;
   3149 Posten geprueft, `ev`/`fv` durchgehend 0). Ein Typ-Gate erzeugte dort
   still 1016 Zeilen „neu" gegen Basis 0.
3. **D1-Vorbelegung in `standardVergleich(dok, posten)`** gegen
   `fuelleAuswahl()`. Der Ort in `dashboard-data.js` haelt die Vorbelegung an
   **einer** Stelle (`meta.default_vergleich`) und ist in Node testbar; Preis
   sind drei anzupassende js-Tests. In `fuelleAuswahl` braeche kein Test, aber
   die Regel existierte zweimal und waere nur per e2e pruefbar.
4. **`kontrolle()` liefert im internen Modus `{ modus: "intern", ausloeser }`**
   aus der Engine, statt in `vergleich.js` zu entscheiden, welches Dokument die
   Pruefung ausloest. Sonst traegt das DOM-Modul Fachlogik.
5. **Tausch-Knopf im internen Modus `disabled`** statt „Tausch wechselt auf das
   geladene Basisdokument". Ein Knopf mit zwei Bedeutungen ist genau das Muster,
   das `vergleich.js:12-15` fuer den Dokument-Umschalter ausdruecklich ablehnt.

**Entscheidungspunkte, die still schiefgehen koennen** — jeder ist unten eine
eigene `<verify>`-Bedingung:

- **Ohne Klon wird jedes `delta` 0**, `wasserfall.von === wasserfall.nach`, und
  **kein bestehender Test faellt zwingend**.
- **`kontrolle()` im internen Modus** prueft die Basis gegen genau die Spalte,
  aus der sie stammt — eine Tautologie, die „Geprueft. Alle 1048 stimmen
  ueberein" meldet.
- **Sichtbarkeit und Vorbelegung gehoeren in EINEN Schritt**:
  `standardVergleich` liefert bei einem Dokument heute `null`, und
  `vergleich.js:136-137` greift dann `docs[docs.length - 2].id` → `undefined`
  → TypeError im nun sichtbaren Tab.

**Reihenfolge:** Engine zuerst (Tasks 1-3, vollstaendig in Node testbar), danach
Verdrahtung gegen eine bereits belegte Engine (Task 4), dann Browser-Belege
(Task 5) und Doku (Task 6).
</strategy>

<skills>
Lies und befolge diese Skills waehrend der Ausfuehrung:
- @/root/.claude/skills/design-system/SKILL.md — nur fuer die Textaenderungen in
  `web/index.html`: **Level 1 der Praezedenz greift**, die App hat ihre eigene
  Optik (`gat-*`-Klassen, `web/css/dashboard.css`, Design-System per CDN).
  Bestehende Klassen und Markup-Struktur uebernehmen, **kein** neues
  Stylesheet, **kein** flomotlik-Link, keine neue CSS-Datei.
</skills>

<context>
Issue: @.issues/n8vmb-vergleich-aus-einem-dokument-die-abgedruckte-vergleichsspalte-als-basis/ISSUE.md
Entscheidungen: @.issues/n8vmb-vergleich-aus-einem-dokument-die-abgedruckte-vergleichsspalte-als-basis/CONTEXT.md
Recherche: @.issues/n8vmb-vergleich-aus-einem-dokument-die-abgedruckte-vergleichsspalte-als-basis/RESEARCH.md

**Arbeitsverzeichnis:** ausschliesslich der Worktree
`/Users/florianmotlik/Code/GrueneAT/web-apps/gemeindefinanzen/.worktrees/n8vmb-vergleich-aus-einem-dokument-die-abgedruckte-vergleichsspalte-als-basis`.
Niemals am `main`-Checkout arbeiten, keinen Worktree von Hand anlegen.

**`node_modules` liegt nicht im Worktree** — Node loest nach oben auf
`<repo>/node_modules` auf. Scheitert `npm run test:js` an der Modulaufloesung,
einmal `npm install` im Worktree laufen lassen.

<interfaces>
<!-- Executor: benutze diese Vertraege direkt. Den Code dafuer nicht suchen. -->

// ---- web/js/vergleich-daten.js — Diff-Engine, rein rechnend, kein DOM ----
export const HAUSHALTE = ["EHH", "FHH"]                        // 31
export const STATUS = ["neu","entfallen","geaendert","unveraendert"]  // 35
export const WASSERFALL_N = 10                                 // 272
export function schluessel(p): string                          // 38  `${ansatz}|${konto}|${richtung}`

export function aggregiereDokument(posten, dokId, haushalt): Map<string, {
  key, gruppe, gruppe_text, ansatz, ansatz_text, konto, konto_text,
  bezeichnung, richtung, gebarung,
  wert: number,       // Spalte 1 — ew/fw   (Zeile 79)
  vergleich: number,  // Spalte 2 — ev/fv   (Zeile 80)  <-- die interne Basis
}>                                                             // 55-87

export function baueDiff(posten, dokumente, { a, b, haushalt = "EHH" }): {
  haushalt, a, b,
  zeilen: Array<{ key, gruppe, gruppe_text, ansatz, ansatz_text, konto,
                  konto_text, bezeichnung, richtung, gebarung,
                  a: number, b: number, delta: number,
                  prozent: number|null,
                  status: "neu"|"entfallen"|"geaendert"|"unveraendert" }>,
  status: { neu, entfallen, geaendert, unveraendert, gesamt, veraendert },
  eckwerte: Array<{ titel, a, b, delta, prozent, gut: "auf"|"ab"|"neutral" }>,
  gruppen: Array<{ gruppe, gruppe_text, einnahme, ausgabe }>,
  treemap: Array<{ gruppe, gruppe_text, ansatz, ansatz_text,
                   einnahme, ausgabe, delta }>,
  wasserfall: { von: number, nach: number,
                schritte: Array<{ ansatz, name, beitrag }> },
  kontrolle: null | { spalte, dokument, fassung_a, fassung_b, geprueft,
                      ohne_beleg, abweichungen: Array<{ key, gruppe, ansatz,
                      ansatz_text, konto, bezeichnung, richtung, basis,
                      abgedruckt, abweichung }>,
                      summeAbweichung, bestanden: boolean },
}                                                              // 118-174

export function filtereZeilen(zeilen, f = {}): Array<Zeile>     // 406
  // f: { richtung, gruppe, gebarung, status, schwelle, suche }
export function alsCsv(zeilen, labelA, labelB): string          // 431
  // Kopfzeile: 14 Spalten, labelA an Position 10, labelB an 11

// modulintern (NICHT exportiert):
function wertVon(p, hh)          // 42  -> hh === "FHH" ? p.fw : p.ew
function vergleichVon(p, hh)     // 49  -> hh === "FHH" ? p.fv : p.ev
function statusVon(a, b)         // 90
function euroRund(x)             // 99
function saldoBeitrag(zeile)     // 105
function statusZaehlung(zeilen)  // 176   liest NUR zeilen
function eckwerte(zeilen, hh)    // 186   liest NUR zeilen
function gruppenDelta(zeilen)    // 227   liest NUR zeilen
function treemapDelta(zeilen)    // 245   liest NUR zeilen
function wasserfall(zeilen)      // 277   liest NUR zeilen
function kontrolle(aggA, aggB, dokumente, a, b)  // 337  liest die AGGREGATE
  // 342-344:  const nva = dB.typ==="NVA" && dA.typ==="VA" && dA.jahr===dB.jahr
  //           const vaFolge = dB.typ==="VA" && dA.typ==="VA" && dA.jahr===dB.jahr-1
  //           if (!nva && !vaFolge) return null
  // 346-382:  Rechnung: aggA.wert gegen aggB.vergleich
  // 384:      spalte: dB.spalte_vergleich || "Vergleichsspalte"
// `vergleich-daten.js` importiert NICHTS — der neue Import in
// dashboard-data.js erzeugt also keinen Zyklus.

// ---- web/js/vergleich.js — Oberflaeche des Tabs ----
export function baueVergleich(datenNeu): void                   // 92
import { baueDiff, filtereZeilen, alsCsv } from "./vergleich-daten.js"  // 17
const LIMIT = 500                                               // 25
const zustand = { a: null, b: null, haushalt: "EHH",
                  sortKey: "delta", sortAbsteigend: true,
                  verdrahtet: false }                           // 28-35
let daten = null; let diff = null; const charts = {}            // 37-41
function euro(v) / euroVz(v) / prozentVz(p)                     // 51 / 55 / 60
function el(id) / text(id, wert)                                // 69 / 73
function dokument(id)                                           // 78  DATA.dokumente-Lookup
function dokLang(d)                                             // 86  label (+ fassung)
function fuelleAuswahl()                                        // 131
function fuelleGruppenFilter()                                  // 157
function verdrahte()                                            // 175
function rechneUndZeichne()                                     // 252
function zeichneKopf()                                          // 274
function zeichneKennzahlen()                                    // 308
function zeichneKontrolle()                                     // 336
function zeichneCharts()                                        // 401
function aktuelleFilter() / sortiere(zeilen)                    // 459 / 470
function zeichneTabelle()                                       // 486  KEINE Aenderung
function escapeHtml(s)                                          // 558
function ladeCsv()                                              // 566

// ---- web/js/dashboard-data.js ----
export function standardVergleich(dok): { a, b } | null         // 659-668
  // 660: if (!dok || dok.length < 2) return null
  // 661-665: juengstes NVA mit passendem VA desselben Jahres
  // 666: sonst { a: dok[len-2].id, b: dok[len-1].id }
export function collect(db): { meta, dokumente, posten, aggregate, trend }
  // 699: default_vergleich: standardVergleich(dok)
  // `post` (alle Posten) liegt in collect() ab Zeile 673 bereit
import { TYP_ORDER_SQL } from "./reference.js"                   // 9 — einziger Import

// Dokument-Datensatz (dashboard-data.js:80-94)
{ id: number, typ: "VA"|"NVA"|"RA", jahr: number|null,
  label: string,             // `${typ} ${jahr}`
  spalte_wert: string,       // z. B. "VA 2026 inkl. NVA"
  spalte_vergleich: string,  // z. B. "VA 2026"   <-- Grundlage von D3
  spalte_dritte: string,     // z. B. "1. NVA"
  einwohner: number|null }
// `fassung` ist in DATA.dokumente NICHT enthalten, obwohl vergleich.js:88
// und :383 darauf zugreifen — dort immer undefined. Bestandsbefund, nicht
// in diesem Issue zu reparieren.

// Posten-Datensatz (dashboard-data.js:140-152)
{ dok, typ, jahr, richtung, gebarung, gruppe, gruppe_text, ansatz, ansatz_text,
  konto, konto_text, bezeichnung, mvag, qu,
  ew, ev, ed,    // Ergebnishaushalt:      Spalte 1 / 2 / 3
  fw, fv, fd }   // Finanzierungshaushalt: Spalte 1 / 2 / 3

// ---- web/js/loader.js ----
export function spalten(typ, jahr): [string, string, string]    // 13-24
  // jahr null  -> ["Spalte 1","Spalte 2","Spalte 3"]
  // RA         -> [`RA ${jahr}`,            `VA ${jahr}`,   "Abweichung RA-VA"]
  // NVA        -> [`VA ${jahr} inkl. NVA`,  `VA ${jahr}`,   "1. NVA"]
  // sonst (VA) -> [`VA ${jahr}`,            `VA ${jahr-1}`, `RA ${jahr-2}`]
export function dokumentDatensatz(dateiname, meta)              // 27-43
  // Zeile 31 schreibt spalte_wert/_vergleich/_dritte IMMER — auch fuer
  // OH-CSV, wo es keine Spalte-2-Daten gibt.

// ---- web/js/dashboard-charts.js ----
export function chartDiffWasserfall(diff, labelA = "Basis",
                                    labelB = "Vergleich"): EChartsOption  // 1443
  // 1446: const namen = [labelA, ...w.schritte.map(s => s.name), labelB]
  //       -> option.xAxis.data
export function chartDiffGruppen(diff): EChartsOption           // 1537  (ohne Labels)
export function chartDiffTreemap(diff): EChartsOption           // 1592  (ohne Labels)

// ---- DOM-Vertrag (web/index.html) ----
#vgl-a  #vgl-b  #vgl-hh  #vgl-tausch          // Auswahl, 375-390
#vgl-kopf                                      // 391
#vgl-stats  #vgl-statuszeile                   // 393-394
#vgl-kontrolle-panel[hidden]  #vgl-kontrolle   // 396-411
#c_vgl_wasserfall  #c_vgl_treemap  #c_vgl_gruppen
#vgl-f-such #vgl-f-gruppe #vgl-f-richtung #vgl-f-gebarung
#vgl-f-status #vgl-f-schwelle
#vgl-csv  #vgl-meta  #vgl-hint
#vgl-th-a (506)  #vgl-th-b (508)  #vgl-tbody
.tab-btn[data-tab="vergleich"] (229)   [data-panel="vergleich"] (363)

// ---- CSS, die schon existiert (web/css/dashboard.css:258-263) ----
.vgl-pruef          { border-left: 3px solid var(--hair); ... }  // neutral
.vgl-pruef.is-ok    { gruen }
.vgl-pruef.is-warn  { clay }
// -> Der Hinweis im internen Modus nimmt `.vgl-pruef` OHNE Modifikator.
//    KEINE neue CSS-Regel, KEINE neue Klasse.
</interfaces>

<call_sites>
Kein CLI-Flag, kein Kommando, kein Script-Einstiegspunkt wird eingefuehrt oder
geaendert. Die geaenderte **JS-API** hat dagegen Aufrufer, und die sind hier
vollstaendig aufgezaehlt (gegrept in `web/ tests/ docs/ scripts/ src/`):

`standardVergleich` (Signatur wird zu `(dok, posten)` erweitert):
- `web/js/dashboard-data.js:659` — Definition — IN SCOPE (Task 3)
- `web/js/dashboard-data.js:699` — `default_vergleich: standardVergleich(dok)`
  → muss `post` mitgeben — IN SCOPE (Task 3)
- `tests/js/run.mjs:30` — Import — unveraendert
- `tests/js/run.mjs:1115` — Aufruf ohne `posten` — IN SCOPE (Task 3, Erwartung
  bleibt `null`, zweiter Fall kommt dazu)
- `tests/js/run.mjs:1120` — Aufruf ohne `posten` — IN SCOPE (Task 3, bleibt
  `{a:8,b:9}`; sichert den Rueckfall auf das heutige Verhalten ab)
- `web/js/vergleich.js:135` — liest `daten.meta.default_vergleich` — IN SCOPE
  (Task 4)
- `tests/js/run.mjs:1105-1112` — prueft `meta.default_vergleich` — IN SCOPE
  (Task 3)
- `docs/BROWSER-APP.md:82-85` — beschreibt die Vorbelegung in Prosa — IN SCOPE
  (Task 6)

`baueDiff` (Semantik von `a` wird erweitert, Signatur bleibt):
- `web/js/vergleich.js:263` — IN SCOPE (Task 4)
- `tests/js/run.mjs` (Diff-Block 1129-1327) — alle Aufrufe uebergeben explizite
  Dokument-Ids — OUT OF SCOPE (unveraendert gruen), ausser den neu ergaenzten
  Faellen in Tasks 1-2

Die falsche RA-Begruendung steht an genau **zwei** Stellen (gegrept, `src/` ist
nicht betroffen):
- `web/js/vergleich-daten.js:334-336` — IN SCOPE (Task 2)
- `docs/BROWSER-APP.md:118-120` — IN SCOPE (Task 6)
</call_sites>

Key files:
@web/js/vergleich-daten.js — Diff-Engine; hier entstehen `BASIS_INTERN`,
  `interneBasis`, `interneBasisLabel`, `hatVergleichsspalte`, `internHinweis`
@web/js/vergleich.js — Oberflaeche; Sichtbarkeit, Auswahl, Beschriftung
@web/js/dashboard-data.js — `standardVergleich` (D1-Vorbelegung)
@web/index.html — Panel-Geruest, Ueberschrift/Lead, Kontroll-Panel-Notiz
@tests/js/run.mjs — Node-Tests; Vergleichs-Block ab 1104
@tests/e2e/vergleich.spec.mjs — Browser-Tests des Tabs
@docs/BROWSER-APP.md — Abschnitt „Dokumenttypen: Reihenfolge und Vergleich"
</context>

<commit_format>
Format: conventional mit vorangestelltem Issue-Hash (`.issues/config.yaml`:
`commits.format: conventional`, `prefix: true`).
Pattern: `n8vmb: {type}({scope}): {subject}`
Beispiele:
- `n8vmb: feat(vergleich): abgedruckte Vergleichsspalte als Basis-Seite`
- `n8vmb: fix(vergleich): RA-Soll in der Selbstkontrolle zulassen`
- `n8vmb: test(e2e): interner Vergleich mit einem Dokument`
- `n8vmb: docs(browser-app): interner Vergleichsmodus und RA-Befund`
Subject auf Deutsch (Repo-Konvention, siehe `git log`), Bezeichner und Code auf
Deutsch wie im Bestand. **Keine Werkzeug-Attribution** — kein „claude", kein
„Generated with", kein `Co-Authored-By`. Pro Task mindestens ein atomarer
Commit.
</commit_format>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Interne Basis in der Engine — Sentinel, Klon, Beschriftungsregel, Hinweis</name>
  <files>web/js/vergleich-daten.js, tests/js/run.mjs</files>
  <behavior>
  - `baueDiff` mit `a: BASIS_INTERN`, `b: NVA 2026`, `haushalt: "EHH"` → 1048
    Zeilen, Status `{neu 32, entfallen 6, geaendert 122, unveraendert 888}`,
    Ertraege-Delta +790.300, Aufwendungen-Delta +502.200, Nettoergebnis-Delta
    +288.100, `wasserfall.von` 473.600, `wasserfall.nach` 761.700
  - Jede Zeile des internen Diffs: `delta === Math.round(ed)` (EHH) bzw. `fd`
    (FHH) — 160 EHH- / 178 FHH-Schluessel mit Bewegung, **0 Abweichungen**
  - Die Vergleichsseite wird nicht mitgeaendert: `wasserfall.von !== nach`,
    `status.unveraendert < status.gesamt`
  - `kontrolle` im internen Modus: `modus === "intern"`, **kein**
    `bestanden === true`, `ausloeser` nennt „VA 2026" und ob es geladen ist
  - `hatVergleichsspalte`: `true` fuer alle fuenf PDFs in beiden Haelften,
    `false` fuer das gemergte OH-CSV-Dokument
  - `interneBasisLabel`: NVA 2026 → „VA 2026 (laut NVA)", RA 2025 → „Soll 2025
    (laut RA)", VA 2026 → „VA 2025 (laut VA)"
  </behavior>
  <action>
  Arbeite ausschliesslich in `web/js/vergleich-daten.js` und `tests/js/run.mjs`.
  `kontrolle()` selbst bleibt in diesem Task **unangetastet** — sie kommt in
  Task 2 dran.

  **1a — Sentinel exportieren.** Neben `HAUSHALTE`/`STATUS` (Zeilen 31-35):

  ```js
  // Basis-Auswahl: dieser Wert steht nicht fuer ein Dokument, sondern fuer die
  // im Vergleichsdokument abgedruckte Vergleichsspalte. Kollisionsfrei, weil
  // dokument_id INTEGER PRIMARY KEY ist (web/schema.sql:19) und Ids ueberall
  // per String(...) verglichen werden.
  export const BASIS_INTERN = "intern"
  ```

  **1b — Die klonende Projektion.** Neu, modulintern, direkt vor `baueDiff`:

  ```js
  // Die abgedruckte Vergleichsspalte als Basis-Seite: dieselbe Map, auf dem
  // Feld `vergleich` gelesen. Ein KLON — wuerde `aggB` in-place umgeschrieben
  // (e.wert = e.vergleich), waeren Basis und Vergleich danach dasselbe Objekt
  // und jedes delta 0. Das faellt in keinem bestehenden Test auf.
  function interneBasis(aggB) {
    const m = new Map()
    for (const [k, e] of aggB) {
      m.set(k, { ...e, wert: e.vergleich, vergleich: 0 })
    }
    return m
  }
  ```

  **1c — `baueDiff` verzweigt in vier Zeilen.** Ersetze 120-121:

  ```js
  // Die Reihenfolge ist gedreht: aggB ist im internen Modus die Quelle der
  // Basis-Seite und muss deshalb zuerst stehen.
  const intern = String(a) === BASIS_INTERN
  const aggB = aggregiereDokument(posten, b, hh)
  const aggA = intern ? interneBasis(aggB) : aggregiereDokument(posten, a, hh)
  ```

  und Zeile 172:

  ```js
  kontrolle: intern
    ? internHinweis(dokumente, b)
    : kontrolle(aggA, aggB, dokumente, a, b),
  ```

  Alles zwischen 123 und 171 bleibt **unveraendert** — die Schluesselunion, der
  Nullzeilen-Filter (134), `stamm = eb || ea` (140), `prozent` (153), `status`
  (154), die Sortierung (160) und die fuenf Aggregatoren (167-171) lesen
  entweder zwei Maps derselben Form oder nur `zeilen`.

  **1d — Die Beschriftungsregel, exportiert.** Sie gehoert hierher, weil Task 2
  (`kontrolle().spalte`) und Task 4 (Kopf, Tabellenkopf, Karten, Achse, CSV)
  dieselbe Regel brauchen — eine Regel, ein Ort:

  ```js
  // Beschriftung der dokumentinternen Basis (CONTEXT.md D3): Spaltenname plus
  // kurze Herkunft. Beim Rechnungsabschluss tritt eine neutrale, zutreffende
  // Form an die Stelle der abgedruckten (CONTEXT.md D2): sein "Soll" ist der
  // Voranschlag INKLUSIVE Nachtrag, die abgedruckte Bezeichnung verschweigt
  // das. Beim Voranschlag ist es umgekehrt — seine Spalte 2 ist der
  // Vorjahres-VA im Original, ohne dessen Nachtrag.
  export function interneBasisLabel(d) {
    if (!d) return "Basis"
    if (d.typ === "RA") return `Soll ${d.jahr} (laut RA)`
    return `${d.spalte_vergleich} (laut ${d.typ})`
  }
  ```

  **1e — Die datenbasierte Pruefung, exportiert.** NICHT am Typ und NICHT am
  Spaltennamen entscheiden:

  ```js
  // Traegt das Dokument in seiner zweiten Betragsspalte ueberhaupt Zahlen?
  // Nicht am Typ entscheidbar: ein OH-CSV-Dokument traegt den Spaltennamen
  // ("VA 2025", geschrieben in loader.js:31), aber keine Werte — der
  // CSV-Parser setzt nur eh_wert/fh_wert (csv-parser.js:305,307; Kommentar
  // 330-333). Ohne Werte entstuende ein Diff mit Basis 0 auf jeder Zeile.
  // Ohne `haushalt` heisst das "eine der beiden Haelften".
  export function hatVergleichsspalte(posten, dokId, haushalt) {
    const id = String(dokId)
    for (const p of posten || []) {
      if (String(p.dok) !== id) continue
      if (haushalt !== "FHH" && (p.ev || 0) !== 0) return true
      if (haushalt !== "EHH" && (p.fv || 0) !== 0) return true
    }
    return false
  }
  ```

  **1f — Der Hinweis statt der Pruefung.** `kontrolle()` darf im internen Modus
  **nicht rechnen**: `aggA.wert` ist dort per Konstruktion `aggB.vergleich`, die
  Pruefung faende immer 0 Abweichungen und schriebe „Geprueft. Alle 1048
  belegbaren Haushaltsstellen der Basis stimmen mit der Spalte „VA 2026" des
  Vergleichsdokuments ueberein" — eine Tautologie, die wie ein Beweis aussieht.
  Genau das verbietet CONTEXT.md D1. Stattdessen liefert die Engine die
  **Voraussetzung** der Pruefung, damit `vergleich.js` keine Fachlogik traegt:

  ```js
  // Welches geladene Dokument wuerde die Selbstkontrolle ausloesen?
  //   dB = NVA -> der VA desselben Jahres
  //   dB = VA  -> der VA des Vorjahres
  //   dB = RA  -> der NVA desselben Jahres (sein Soll enthaelt den Nachtrag,
  //               CONTEXT.md D2), sonst der VA desselben Jahres
  function ausloeserFuer(docs, dB) { ... }

  // Rueckgabe im internen Modus — keine Pruefung, sondern ihre Voraussetzung.
  function internHinweis(dokumente, b) {
    const docs = dokumente || []
    const dB = docs.find((d) => String(d.id) === String(b))
    if (!dB) return null
    const gefunden = ausloeserFuer(docs, dB)   // Dokument oder null
    return {
      modus: "intern",
      spalte: interneBasisLabel(dB),
      dokument: dB.label,
      ausloeser: {
        label: gefunden ? gefunden.label : <erwartetes Label>,
        geladen: !!gefunden,
        id: gefunden ? gefunden.id : null,
      },
    }
  }
  ```

  `<erwartetes Label>` ist der Name des Dokuments, das die Kontrolle ausloesen
  *wuerde*, auch wenn es nicht geladen ist: `VA ${dB.jahr}` bei NVA,
  `VA ${dB.jahr - 1}` bei VA, `NVA ${dB.jahr}` bei RA. `internHinweis` liefert
  `null` nur, wenn `b` gar kein bekanntes Dokument ist — dann bleibt das Panel
  verborgen.

  **1g — Tests in `tests/js/run.mjs`.** Erweitere den Import aus
  `vergleich-daten.js` (Zeile 31-36) um `BASIS_INTERN`, `interneBasisLabel`,
  `hatVergleichsspalte`. Haenge die neuen Pruefungen an den bestehenden
  Diff-Block (nach Zeile 1268, vor „Filter und Export") mit der vorhandenen
  `pruefe(...)`-Hilfe an. Konkret:

  1. `const iEhh = baueDiff(datenPK.posten, datenPK.dokumente, { a: BASIS_INTERN, b: dNva.id, haushalt: "EHH" })`
     → `iEhh.zeilen.length === 1048`; `iEhh.status` gleich
     `{neu:32, entfallen:6, geaendert:122, unveraendert:888, gesamt:1048, veraendert:160}`;
     die drei Eckwerte-Deltas 790300 / 502200 / 288100 (nach `titel` suchen, nicht
     nach Index); `iEhh.wasserfall.von === 473600`, `.nach === 761700`.
  2. **Zeile fuer Zeile gegen die abgedruckte Spalte 3.** Baue je
     `(ansatz|konto|richtung)` die Summe von `ed` (bzw. `fd`) aus
     `datenPK.posten` fuer `dok === dNva.id` und vergleiche mit `zeile.delta`:
     0 Abweichungen, 160 Schluessel mit `delta !== 0` (EHH) bzw. 178 (FHH).
     Denselben Vergleich fuer `RA 2025` als `b` fahren: dort nur
     „0 Abweichungen" und „mehr als 0 geprueft" pinnen (die Recherche nennt
     dafuer keine belastbare Zahl bewegter Schluessel).
  3. **Kein Mutations-Leck.** `iEhh.wasserfall.von !== iEhh.wasserfall.nach`
     **und** `iEhh.status.unveraendert < iEhh.status.gesamt`. Zusaetzlich:
     nach dem internen Diff ein Zwei-Dokumente-`baueDiff(… a: dVa.id, b: dNva.id …)`
     auf denselben `datenPK.posten` rechnen und gegen die bereits gepinnten
     Werte des bestehenden `dEhh` pruefen. Fehlt der Klon, faellt (3) zuerst.
  4. **Keine Tautologie-Kontrolle.** `iEhh.kontrolle.modus === "intern"`,
     `iEhh.kontrolle.bestanden === undefined`,
     `iEhh.kontrolle.spalte === "VA 2026 (laut NVA)"`,
     `iEhh.kontrolle.ausloeser.label === "VA 2026"`,
     `iEhh.kontrolle.ausloeser.geladen === true`.
  5. **`interneBasisLabel`** fuer NVA 2026 / RA 2025 / VA 2026 gegen die drei
     Strings aus `<behavior>`.
  6. **`hatVergleichsspalte`** `=== true` fuer alle fuenf PDF-Dokumente, je
     einmal mit `"EHH"` und `"FHH"`. Den `false`-Fall im **CSV-Abschnitt**
     ergaenzen: in `tests/js/run.mjs` gibt es ab Zeile 882 die isolierte
     `:memory:`-DB `dbCsv`; ruf dort **vor** `dbCsv.close()` (ca. Zeile 915)
     `collect(dbCsv)` auf und pruefe
     `hatVergleichsspalte(datenCsv.posten, datenCsv.dokumente[0].id) === false`.
  7. **CSV-Kopfzeile.**
     `alsCsv(iEhh.zeilen.slice(0, 3), "VA 2026 (laut NVA)", "NVA 2026")` —
     erste Zeile hat 14 Felder und Feld 10 ist `VA 2026 (laut NVA)`.
  8. **Wasserfall-Achse.**
     `chartDiffWasserfall(iEhh, "VA 2026 (laut NVA)", "NVA 2026")` — erste
     `xAxis.data`-Kategorie `"VA 2026 (laut NVA)"`, letzte `"NVA 2026"`.
     `chartDiffWasserfall` ist in `run.mjs` bereits importiert.

  Sprache: Kommentare und Testnamen auf Deutsch wie im Bestand. Keine neue
  Datei, keine neue Abhaengigkeit, kein Build-Schritt.
  </action>
  <verify>
  <automated>npm run test:js 2>&1 | tail -40</automated>
  </verify>
  <done>
  - `BASIS_INTERN`, `interneBasisLabel`, `hatVergleichsspalte` werden aus
    `web/js/vergleich-daten.js` exportiert
  - `interneBasis` klont (`{ ...e, wert: e.vergleich, vergleich: 0 }`) und
    schreibt `aggB` nicht um — belegt durch Test 3
  - `baueDiff` ruft `kontrolle()` im internen Modus **nicht** auf; die neue
    Testpruefung `kontrolle.modus === "intern"` ist gruen und
    `bestanden === undefined`
  - Die Zeilen 123-171 von `baueDiff` sind unveraendert (`git diff` zeigt dort
    keine Aenderung)
  - Interner Diff NVA 2026 EHH: 1048 Zeilen, Status 32/6/122/888,
    Deltas 790300 / 502200 / 288100, Wasserfall 473600 → 761700
  - Zeile fuer Zeile gegen Spalte 3: 0 Abweichungen fuer NVA 2026 (EHH und
    FHH) und fuer RA 2025
  - `hatVergleichsspalte` ist `false` fuer das gemergte OH-CSV-Dokument
  - `npm run test:js` laeuft vollstaendig gruen (alle bisherigen Pruefungen
    plus die neuen)
  </done>
</task>

<task type="auto">
  <name>Task 2: kontrolle() korrigieren — falsche RA-Begruendung weg, RA-Soll zulassen</name>
  <files>web/js/vergleich-daten.js, tests/js/run.mjs</files>
  <action>
  **2a — Den falschen Kommentar entfernen.** `web/js/vergleich-daten.js:334-336`
  behauptet heute:

  > „Der Rechnungsabschluss bleibt bewusst aussen vor: seine Spalte 2 ist das
  > Soll, und das kann den Nachtrag schon enthalten — welches Dokument gemeint
  > ist, laesst sich aus dem Seitenkopf nicht entscheiden."

  Diese Begruendung ist **widerlegt** (CONTEXT.md D2, unabhaengig nachgerechnet
  in RESEARCH.md): das Soll eines RA ist der Voranschlag **inklusive Nachtrag**.
  Geprueft an `RA-2025-Auflage.pdf` gegen `NVA-2025-Auflage.pdf` je
  Haushaltsstelle: gegen NVA-Spalte 1 („VA 2025 inkl. NVA") **0 Abweichungen**,
  gegen NVA-Spalte 2 (Original) viele. Ersetze die drei Zeilen durch die
  Erkenntnis — dass die Spalte eindeutig ist und nur ihre abgedruckte
  Bezeichnung den Nachtrag verschweigt, weshalb `spalte` beim RA ueber
  `interneBasisLabel` neutral benannt wird.

  **2b — Das `raSoll`-Praedikat.** Der RA ist heute nicht explizit
  ausgeschlossen, sondern **durch Auslassung**: 342-343 lassen nur `nva` und
  `vaFolge` zu, 344 verwirft alles andere. Ergaenze:

  ```js
  // Der Rechnungsabschluss druckt in Spalte 2 sein Soll ab — den gueltigen
  // Plan des Jahres, Nachtrag inbegriffen (CONTEXT.md D2). Liegt der NVA
  // desselben Jahres als Basis vor, ist dessen Spalte 1 dagegen pruefbar.
  // Ohne NVA ist der VA der gueltige Plan und als Basis legitim; weicht er
  // ab, ist das die bekannte Fassungsfrage, die der bestehende
  // Abweichungstext (374-386) schon traegt.
  const raSoll = dB.typ === "RA" && dA.jahr === dB.jahr &&
                 (dA.typ === "NVA" || dA.typ === "VA")
  if (!nva && !vaFolge && !raSoll) return null
  ```

  `dA.typ === "VA"` wird **mit zugelassen** — ehrlicher als es zu verschweigen
  (RESEARCH.md Frage 5b, MEDIUM-Abwaegung, hier entschieden). Die Rechnung
  selbst (346-382) bleibt **unveraendert**: sie stellt `aggA.wert` gegen
  `aggB.vergleich`, und das ist genau „NVA-Spalte 1 gegen RA-Soll".

  **2c — `spalte` beim RA.** Zeile 384 liefert heute `dB.spalte_vergleich`, beim
  RA also „VA 2025" — die irrefuehrende PDF-Beschriftung. Nutze dort die in
  Task 1 gebaute Regel: `spalte: interneBasisLabel(dB) || "Vergleichsspalte"`
  bei `dB.typ === "RA"`, sonst wie bisher `dB.spalte_vergleich ||
  "Vergleichsspalte"`. **Wichtig:** der bestehende Test `run.mjs:1251-1255`
  erwartet fuer das Paar VA→NVA weiter `spalte === "VA 2026"` — die
  Nicht-RA-Faelle duerfen sich also **nicht** aendern.

  **2d — Tests.** In `tests/js/run.mjs` nach dem Kontroll-Block (ca. 1277)
  ergaenzen:
  - `const raK = baueDiff(datenPK.posten, datenPK.dokumente, { a: <NVA 2025>.id, b: <RA 2025>.id, haushalt: "EHH" }).kontrolle`
    → `raK !== null`, `raK.geprueft === 1156`, `raK.abweichungen.length === 0`,
    `raK.bestanden === true`, `raK.spalte === "Soll 2025 (laut RA)"`.
  - Dasselbe mit `haushalt: "FHH"` → `geprueft === 1160`,
    `abweichungen.length === 0`, `bestanden === true`.
  - Der bestehende Test „Kontrolle entfaellt fuer ein Paar, das sie nicht
    belegen kann" (1270-1277, RA 2024 als Basis gegen NVA 2026) **muss weiter
    `null` liefern** — `dA.typ === "RA"` erfuellt kein Praedikat, auch nicht
    `raSoll` (das fordert `dB.typ === "RA"`). Nicht anpassen, sondern bewusst
    nachpruefen, dass er gruen bleibt.
  - Der bestehende Test „Kontrolle laeuft fuer das Paar VA -> NVA desselben
    Jahres" mit `spalte === "VA 2026"` bleibt unveraendert gruen.
  </action>
  <verify>
  <automated>npm run test:js 2>&1 | tail -40 && ! grep -n "aus dem Seitenkopf nicht zu entscheiden\|aus dem Seitenkopf nicht entscheiden" web/js/vergleich-daten.js</automated>
  </verify>
  <done>
  - Der Kommentar „…laesst sich aus dem Seitenkopf nicht entscheiden" steht
    nicht mehr in `web/js/vergleich-daten.js`; an seiner Stelle steht die
    D2-Erkenntnis
  - `kontrolle()` liefert fuer NVA 2025 → RA 2025 ein Ergebnis:
    `geprueft` 1156 (EHH) / 1160 (FHH), 0 Abweichungen, `bestanden === true`
  - `kontrolle().spalte` ist beim RA „Soll 2025 (laut RA)", bei VA→NVA
    unveraendert „VA 2026"
  - RA 2024 als Basis gegen NVA 2026 liefert weiter `null`
  - `npm run test:js` gruen
  </done>
</task>

<task type="auto">
  <name>Task 3: Vorbelegung — die interne Spalte gewinnt (D1) in standardVergleich</name>
  <files>web/js/dashboard-data.js, tests/js/run.mjs</files>
  <action>
  **Umsetzung von CONTEXT.md D1:** traegt ein Dokument eine gefuellte
  Vergleichsspalte, ist diese die Basis-Vorbelegung — **auch dann**, wenn das
  passende zweite Dokument geladen ist. Sie ist per Definition die Fassung,
  gegen die das Dokument rechnet.

  **3a — Signatur erweitern.** `web/js/dashboard-data.js:659`:
  `standardVergleich(dok, posten)`. `posten` ist **optional**; ohne `posten`
  faellt die Funktion exakt auf das heutige Verhalten zurueck. Neue Reihenfolge:

  1. gibt es (mit `posten`) ein Dokument mit **gefuellter** Vergleichsspalte,
     gewinnt das **juengste** davon als `{ a: BASIS_INTERN, b: d.id }`
     — `dok` liegt in Entwicklungsreihenfolge vor, also von hinten suchen
  2. sonst die bestehende VA/NVA-Paar-Suche (661-665)
  3. sonst die zwei juengsten (666)
  4. sonst `null` (auch bei genau einem Dokument **ohne** Vergleichsspalte)

  Importiere dafuer in `dashboard-data.js`
  `import { BASIS_INTERN, hatVergleichsspalte } from "./vergleich-daten.js"`.
  `vergleich-daten.js` importiert selbst nichts — kein Zyklus.

  **3b — `collect` gibt die Posten mit.** Zeile 699:
  `default_vergleich: standardVergleich(dok, post)`. `post` steht dort bereits
  bereit (Zeile 673).

  **3c — Aktualisiere den Kommentar** ueber `standardVergleich` (651-658): die
  dokumentinterne Spalte gewinnt und **warum** (verlaesslichere Quelle, siehe
  D1) — und dass das Argument `posten` genau dafuer da ist, weil die Frage „hat
  das Dokument Zahlen in Spalte 2?" nicht am Typ entscheidbar ist.

  **3d — Die drei betroffenen Tests in `tests/js/run.mjs`.** RESEARCH.md
  Frage 7 nennt sie namentlich; pass **genau diese** an:

  - **1105-1112** („default_vergleich ist VA 2026 -> NVA 2026") **bricht**. Neu
    erwarten: `stdV.a === BASIS_INTERN` und `stdB.label === "NVA 2026"`. Den
    Testnamen mitziehen, etwa „default_vergleich ist die interne Spalte des
    NVA 2026". `stdA` entfaellt bzw. wird zur Sentinel-Pruefung.
  - **1114-1116** („standardVergleich mit einem Dokument liefert null")
    **bricht bzw. wird zu drei Faellen**. Der Test uebergibt ein **nacktes**
    Objekt `{id:1,typ:"VA",jahr:2026}` und **keine** `posten` — dieser Aufruf
    muss weiter `null` liefern. Ergaenze: (a) mit
    `posten = [{ dok: 1, ev: 100, fv: 0 }]` → `{ a: BASIS_INTERN, b: 1 }`;
    (b) mit `posten = [{ dok: 1, ev: 0, fv: 0 }]` → `null` (das ist der
    OH-CSV-Fall).
  - **1118-1127** („standardVergleich ohne NVA nimmt die zwei juengsten")
    **bleibt gruen**, weil ohne `posten` das heutige Verhalten gilt. Nicht
    aendern — aber im Testnamen oder Kommentar festhalten, dass er genau diesen
    Rueckfall absichert.

  Alle uebrigen Tests in `run.mjs` bleiben unveraendert gruen: der Diff-Block
  (1129-1246), der Kontroll-Block (1247-1277) und Filter/CSV/Charts
  (1280-1327) uebergeben durchgehend explizite Dokument-Ids.

  **Wichtig:** dieser Task aendert **nur** die Vorbelegung in der Datenschicht.
  Die Sichtbarkeit des Tabs bleibt hier noch bei `docs.length >= 2` — der Tab
  wird also mit einem Dokument weiter ausgeblendet, und der `undefined`-Pfad in
  `fuelleAuswahl` bleibt unerreichbar. Sichtbarkeit und der Fallback dort
  gehoeren zusammen in Task 4.
  </action>
  <verify>
  <automated>npm run test:js 2>&1 | tail -40</automated>
  </verify>
  <done>
  - `standardVergleich(dok, posten)` liefert mit `posten` `{ a: BASIS_INTERN,
    b: <juengstes Dokument mit gefuellter Spalte 2> }`
  - Ohne `posten` ist das Verhalten unveraendert (Test 1118-1127 gruen, ohne
    Aenderung an seiner Erwartung)
  - Ein einzelnes Dokument **ohne** gefuellte Spalte 2 liefert `null`
  - `collect()` uebergibt `post` an `standardVergleich`
  - Die drei genannten Tests (1105-1112, 1114-1116, 1118-1127) sind angepasst
    bzw. explizit als Rueckfall-Absicherung belassen
  - `npm run test:js` gruen
  </done>
</task>

<task type="auto">
  <name>Task 4: Oberflaeche — Sichtbarkeit, Auswahl, Beschriftung, Kontroll-Panel (ein Schritt)</name>
  <files>web/js/vergleich.js, web/index.html, tests/e2e/vergleich.spec.mjs</files>
  <action>
  **Alles in diesem Task gehoert zusammen.** Wird nur die Sichtbarkeit geaendert,
  kracht der Tab: `standardVergleich` liefert bei einem Dokument ohne
  Vergleichsspalte `null`, und `vergleich.js:136-137` greift dann
  `docs[docs.length - 2].id` = `docs[-1]` = `undefined` → TypeError, im nun
  sichtbaren Tab. Sichtbarkeit **und** Vorbelegung/Fallback zusammen aendern.

  **4a — Imports und Zustands-Kommentar.** `vergleich.js:17` um `BASIS_INTERN`,
  `interneBasisLabel`, `hatVergleichsspalte` erweitern. Beim `zustand` (28-35)
  vermerken, dass `a` **entweder** eine Dokument-Id **oder** `BASIS_INTERN`
  traegt — kein zweites Zustandsfeld, sonst gibt es zwei Quellen fuer einen
  Zustand.

  **4b — Sichtbarkeit datenbasiert** (`baueVergleich`, 97-118). `docs.length >= 2`
  ersetzen:

  ```js
  // Vergleichbar ist: zwei Dokumente gegeneinander — oder ein Dokument, das
  // seine Vergleichszahl selbst abdruckt. Die Pruefung geht ueber die DATEN
  // (ev/fv), nicht ueber den Typ: ein OH-CSV-Dokument traegt den
  // Spaltennamen, aber keine Werte (csv-parser.js:330-333). Am Typ gemessen
  // entstuenden dort still ueber 1000 Zeilen "neu" gegen eine Basis von 0.
  const docs = daten.dokumente || []
  const vergleichbar =
    docs.length >= 2 ||
    docs.some((d) => hatVergleichsspalte(daten.posten, d.id))
  ```

  `vergleichbar` an allen vier Stellen einsetzen, an denen heute `mehrere`
  steht (101, 103-105, 107-116, 118). Den Text des Leer-Hinweises (`.vgl-leer`,
  111-115) neu fassen: er gilt jetzt nur noch, wenn **weder** zwei Dokumente
  vorliegen **noch** eines eine gefuellte Vergleichsspalte hat — mit den
  vorhandenen Fixtures ist das genau der Fall „nur ein OH-CSV-Dokument". Der
  Text soll das benennen: eine OH-CSV bringt keine Vergleichszahl mit, es
  braucht ein zweites Dokument.

  **4c — `fuelleAuswahl`** (131-155). Drei Aenderungen:

  ```js
  const istDok = (id) => docs.some((d) => String(d.id) === String(id))
  // Der interne Eintrag gehoert zum gewaehlten Vergleichsdokument: gueltig
  // nur, solange dieses ueberhaupt Zahlen in seiner zweiten Spalte fuehrt.
  const internMoeglich = () =>
    istDok(zustand.b) && hatVergleichsspalte(daten.posten, zustand.b)
  const gueltigA = (id) => (id === BASIS_INTERN ? internMoeglich() : istDok(id))
  ```

  (i) Die Reset-Bedingung auf `gueltigA(zustand.a) / istDok(zustand.b)` umstellen
  (der Sentinel ist nie gleich einer Id, der `a === b`-Teil bleibt korrekt).
  (ii) Der Fallback darf **nicht** mehr `docs[docs.length - 2].id` greifen, wenn
  es nur ein Dokument gibt:

  ```js
  const v = daten.meta.default_vergleich
  if (v) { zustand.a = v.a; zustand.b = v.b }
  else if (docs.length >= 2) {
    zustand.a = docs[docs.length - 2].id
    zustand.b = docs[docs.length - 1].id
  } else {
    zustand.b = docs[docs.length - 1].id
    zustand.a = BASIS_INTERN
  }
  ```

  (iii) In `#vgl-a` den internen Eintrag als **erste** Option voranstellen, wenn
  `internMoeglich()` — `value = BASIS_INTERN`, `textContent =
  interneBasisLabel(dokument(zustand.b))`, ein `title`, der die Herkunft
  ausschreibt. Danach unveraendert alle Dokumente. `#vgl-b` bleibt eine **reine
  Dokumentliste**.

  **4d — `#vgl-b`-Wechsel baut die Basis-Auswahl neu** (`verdrahte`, 180-183).
  Heute ruft der Handler nur `rechneUndZeichne`. Das Label des internen Eintrags
  haengt aber an `b`, und bei einem `b` ohne Vergleichsspalte muss der Eintrag
  verschwinden. Also `fuelleAuswahl()` vor `rechneUndZeichne()` aufrufen.

  **4e — Tausch-Knopf** (`verdrahte`, 188-195 und Ende von `rechneUndZeichne`).
  Der Sentinel darf nie in `b` landen: `aggregiereDokument(posten, "intern", hh)`
  liefert eine leere Map und `baueDiff` eine leere Ansicht — **ohne
  Fehlermeldung**. Setze am Ende von `rechneUndZeichne`:

  ```js
  const tausch = el("vgl-tausch")
  if (tausch) {
    const intern = String(zustand.a) === BASIS_INTERN
    tausch.disabled = intern
    tausch.title = intern
      ? "Im dokumentinternen Vergleich nicht moeglich — die abgedruckte " +
        "Spalte ist immer die Basis."
      : ""
  }
  ```

  Den Knopf **nicht** umdeuten (kein „Tausch wechselt auf das geladene
  Basisdokument") — ein Knopf mit zwei Bedeutungen ist genau das Muster, das
  `vergleich.js:12-15` ablehnt.

  **4f — `rechneUndZeichne`** (252-261). Die `a === b`-Ausweichlogik im internen
  Modus **explizit ueberspringen**: `docs[i > 0 ? i - 1 : Math.min(1,
  docs.length - 1)]` ist bei einem Dokument `docs[0]` — also `b` selbst.

  ```js
  if (String(zustand.a) !== BASIS_INTERN &&
      String(zustand.a) === String(zustand.b)) { ...bestehende Logik... }
  ```

  **4g — Ein Helfer fuer die Beschriftung, fuenf Aufrufer.** Neu, neben
  `dokLang` (86-89):

  ```js
  // Beschriftung der Basis-Seite — eine Regel, ein Ort. `lang` haengt im
  // Zwei-Dokumente-Fall die Fassung an (Kopfzeile); ueberall sonst bleibt es
  // beim Kurzlabel (Tabellenkopf, Karten, Achse, CSV). Laufen diese Stellen
  // auseinander, ist genau der Unterschied verdeckt, den das Issue sichtbar
  // machen will: "VA 2026 (laut NVA)" gegen ein separat geladenes "VA 2026".
  function basisLabel(lang = false) {
    if (String(zustand.a) === BASIS_INTERN) {
      return interneBasisLabel(dokument(zustand.b))
    }
    const dA = dokument(zustand.a)
    if (!dA) return "Basis"
    return lang ? dokLang(dA) : dA.label
  }

  // Die Betragsspalte der Basis fuer den Erklaersatz der Kopfzeile.
  function basisSpalte() {
    const dB = dokument(zustand.b)
    if (String(zustand.a) === BASIS_INTERN) {
      return dB ? `${dB.spalte_vergleich} (abgedruckt im ${dB.label})` : ""
    }
    const dA = dokument(zustand.a)
    return dA ? dA.spalte_wert : ""
  }
  ```

  Aufrufer umstellen — `dokument(zustand.a)` nicht mehr direkt fuer Labels
  verwenden, es liefert beim Sentinel `undefined` und die bestehenden Fallbacks
  schrieben ueberall „Basis":

  | Stelle | heute | kuenftig |
  |---|---|---|
  | `zeichneKopf` 282 „Basis …" | `dokLang(dA)` | `basisLabel(true)` |
  | `zeichneKopf` 286 Betragsspalte | `dA.spalte_wert` | `basisSpalte()` |
  | `zeichneKopf` 291 `#vgl-th-a` | `dA.label` | `basisLabel()` |
  | `zeichneKennzahlen` 330 Basiszeile | `dA.label` | `basisLabel()` |
  | `zeichneCharts` 407 Wasserfall labelA | `dA.label` | `basisLabel()` |
  | `ladeCsv` 572 `alsCsv` labelA | `dA.label` | `basisLabel()` |

  `#vgl-th-b`, `chartDiffTreemap`, `chartDiffGruppen` (keine Labels) und
  `zeichneTabelle` (486-544, liest nur `diff.zeilen`) bleiben **unangetastet**.

  **4h — CSV-Dateiname** (`ladeCsv` 580-583). Heute wird nur Whitespace
  ersetzt — `"VA 2026 (laut NVA)"` wuerde zu `va-2026-(laut-nva)`. Klammern
  entfernen:

  ```js
  const teil = (s) => s.replace(/[()]/g, "").replace(/\s+/g, "-")
  // -> vergleich_va-2026-laut-nva_nva-2026_ehh.csv
  ```

  Der Dateiname muss die Herkunft weiter erkennbar tragen („laut-nva").

  **4i — Dritter Zweig in `zeichneKontrolle`** (336-344). Heute: `!k` → Panel
  `hidden`. Neu: Panel bleibt `hidden` **nur** bei `k === null`; bei
  `k.modus === "intern"` ist es **sichtbar** und erklaert (CONTEXT.md D1),
  wodurch die Kontrolle ausgeloest wird:

  ```js
  if (k.modus === "intern") {
    panel.hidden = false
    body.innerHTML = `<p class="vgl-pruef">…</p>`
    return
  }
  ```

  Der Text muss drei Dinge sagen: (1) die Basis **ist** die im `k.dokument`
  abgedruckte Spalte `k.spalte` — eine Gegenprobe gegen sie selbst belegt
  nichts; (2) die Kontrolle laeuft, sobald oben als Basis das geladene Dokument
  `k.ausloeser.label` gewaehlt wird; (3) ob `k.ausloeser.label` gerade geladen
  ist (`k.ausloeser.geladen`) — ist es das nicht, sagen, dass es dafuer geladen
  werden muesste. Alle eingesetzten Strings durch `escapeHtml` (558). Klasse
  `.vgl-pruef` **ohne** Modifikator (neutraler Hair-Rand, existiert bereits in
  `web/css/dashboard.css:258-259`) — weder `is-ok` noch `is-warn`, das waere
  ein Urteil, das hier keines gibt. **Keine neue CSS-Regel.**

  **4j — Texte in `web/index.html`.** Bestehendes Markup und die `gat-*`-Klassen
  beibehalten, nur Text:
  - `365` Ueberschrift „Vergleich zweier Dokumente" → eine Formulierung, die
    einen Vergleich aus **einem** Dokument mit einschliesst.
  - `366-371` Lead: dass die Basis entweder ein zweites geladenes Dokument oder
    die im Vergleichsdokument abgedruckte Spalte ist, und dass die interne
    Spalte die Vorbelegung ist.
  - `400-406` Kontroll-Panel-Notiz: dass die Kontrolle ein **geladenes**
    Basisdokument braucht, weil eine abgedruckte Spalte gegen sich selbst
    nichts belegt.
  - `361-362` Geruest-Kommentar mitziehen, wenn er von „zwei Dokumenten"
    spricht.

  **4k — Die vier brechenden e2e-Tests anpassen** (`tests/e2e/vergleich.spec.mjs`).
  RESEARCH.md Frage 7 nennt sie mit Zeilennummern; genau diese vier:
  - **52-77** „Vorbelegung ist VA 2026 -> NVA 2026 …": 57-60 erwartet in
    `#vgl-a` den `value` der VA-2026-Option; kuenftig steht dort der Sentinel
    (`await expect(page.locator('#vgl-a')).toHaveValue('intern')`). Die
    Assertions 61-63 (`#vgl-kopf` enthaelt „VA 2026", „NVA 2026",
    „Ergebnishaushalt") halten, wenn der Kopf „Basis VA 2026 (laut NVA) →
    Vergleich NVA 2026" schreibt; ergaenze eine Pruefung auf „laut NVA".
    66-76 (3 Karten, 3 Diagramme, Statuszeile) bleiben.
  - **131-140** „Richtungstausch dreht Basis und Vergleich": `#vgl-a` haelt den
    Sentinel, der Knopf ist `disabled`. Umschreiben: zuerst `#vgl-a` per
    `selectOption` auf das geladene VA 2026 stellen, **dann** tauschen;
    `#vgl-th-a` → „NVA 2026" gilt weiter. **Plus** eine Pruefung, dass
    `#vgl-tausch` bei interner Vorbelegung `disabled` ist.
  - **142-155** „Kontrolle gegen die abgedruckte Vergleichsspalte laeuft": mit
    interner Vorbelegung laeuft die Pruefung nicht. Umschreiben: zuerst
    `#vgl-a` auf das geladene VA 2026 stellen, dann wie bisher „Abweichung" und
    2 `tbody`-Zeilen erwarten.
  - **158-168** „Vergleichs-Tab bleibt verborgen, solange nur ein Dokument
    geladen ist": **bricht per Design**. Der VA 2026 allein hat 1116 EHH- /
    1144 FHH-Posten mit gefuellter Spalte 2, der Tab wird **sichtbar**.
    Ersetzen durch einen Test, der genau das prueft: nur den VA laden → Tab
    sichtbar.

  Die uebrigen e2e-Tests bleiben unveraendert und muessen gruen bleiben
  (verifiziert gegen die internen Diff-Werte): 35-50 (globaler Umschalter),
  79-99 (Tabelle zeigt nur Veraenderungen — intern 160 von 1048, „alle" liefert
  echt mehr; `#vgl-th-a` `toContainText('VA 2026')` trifft auch in „VA 2026
  (laut NVA)"), 101-117 (Schwelle 100.000 → 11 Zeilen, „Saldoeffekt" erscheint;
  „kommunalsteuer" → 1 Treffer), 119-129 (FHH, vier Karten, vierte „investive").
  </action>
  <verify>
  <automated>npm run test:js 2>&1 | tail -20 && npx playwright test tests/e2e/vergleich.spec.mjs 2>&1 | tail -30</automated>
  </verify>
  <done>
  - Der Tab ist mit **nur** dem NVA 2026 (bzw. nur dem VA 2026) sichtbar und
    baut ohne Konsolenfehler auf — kein `undefined`-Zugriff in `fuelleAuswahl`
  - `#vgl-a` haelt bei Vorbelegung den Sentinel `intern`, auch wenn der VA 2026
    geladen ist; das geladene Dokument bleibt als Option waehlbar
  - `#vgl-kopf` nennt die Herkunft („laut NVA"), `#vgl-th-a` traegt das interne
    Label, die Kennzahlen-Karten und die Wasserfall-Achse ebenso
  - CSV-Download im internen Modus: Kopfzeile traegt „VA 2026 (laut NVA)", der
    Dateiname traegt „laut-nva" und **keine** Klammern
  - `#vgl-kontrolle-panel` ist im internen Modus **sichtbar** und nennt das
    ausloesende Dokument samt Ladezustand; es schreibt **nicht** „Geprueft"
  - `#vgl-tausch` ist im internen Modus `disabled` mit erklaerendem `title`
  - Ein Wechsel von `#vgl-b` baut die Basis-Auswahl neu (Label des internen
    Eintrags folgt `b`; ohne Vergleichsspalte verschwindet der Eintrag)
  - `web/index.html` behauptet nirgends mehr den Zwei-Dokumente-Zwang;
    Markup-Struktur und `gat-*`-Klassen unveraendert, keine neue CSS-Datei
  - `zeichneTabelle` ist unveraendert (`git diff` zeigt dort keine Aenderung)
  - `npm run test:js` gruen; `npx playwright test tests/e2e/vergleich.spec.mjs`
    gruen
  </done>
</task>

<task type="auto">
  <name>Task 5: Neue e2e-Belege — ein Dokument, interne Vorbelegung, OH-CSV, CSV-Name</name>
  <files>tests/e2e/vergleich.spec.mjs</files>
  <action>
  Vier neue Browser-Tests, die die Akzeptanzkriterien im echten DOM belegen.
  Benutze die vorhandenen Helfer `oeffneApp` / `wartebisDashboardBereit` aus
  `tests/e2e/helpers.mjs` und das Muster von `ladePaar` (16-25) —
  `setInputFiles` in `Promise.all` mit `waitForNavigation`, danach
  `waitForFunction(() => window.__appBereit === true)`. Lege dafuer eine
  Ladehilfe `ladeEines(page, datei)` neben `ladePaar` an.

  1. **Nur den NVA 2026 laden** (`documents/NVA-2026-Auflage.pdf`):
     - Tab-Knopf `.tab-btn[data-tab="vergleich"]` sichtbar, Panel oeffnet
     - `#vgl-kopf` enthaelt „laut NVA"
     - `#vgl-a` hat den Wert `intern`
     - `#vgl-stats .vgl-karte` → 3 Karten (Ergebnishaushalt)
     - alle drei Diagramm-Canvas sichtbar (`#c_vgl_wasserfall`,
       `#c_vgl_treemap`, `#c_vgl_gruppen`)
     - `#vgl-th-a` enthaelt „laut NVA"
     - `#vgl-kontrolle-panel` **sichtbar**, `#vgl-kontrolle` enthaelt **nicht**
       „Geprueft", nennt aber „VA 2026"
     - `#vgl-tausch` ist `disabled`
  2. **Mit beiden PDFs: die interne Spalte ist die Vorbelegung (D1).**
     `ladePaar` nutzen. `#vgl-a` hat den Wert `intern`, obwohl VA 2026 geladen
     ist; die VA-2026-Option existiert im Select und ist waehlbar; nach
     `selectOption` auf das geladene VA 2026 erscheint die Selbstkontrolle mit
     „Abweichung" und 2 `#vgl-kontrolle tbody tr`. (Das ist das
     Akzeptanzkriterium „das geladene Dokument bleibt waehlbar, die Kontrolle
     findet dann die Community-Nurse-Differenz".)
  3. **Nur das OH-CSV-Paar laden** (`documents/offenerhaushalt_30201_2026_va_ehh.csv`
     und `…_fhh.csv`, wie in `tests/e2e/csv-upload.spec.mjs:4-5`): Tab-Knopf
     `toBeHidden()`, `.vgl-leer` im Panel vorhanden. Das ist der Beleg fuer die
     datenbasierte Sichtbarkeit — ein OH-CSV-Dokument traegt den Spaltennamen,
     aber keine Werte.
  4. **CSV-Name traegt die Herkunft.** Nur den NVA 2026 laden, Tab oeffnen,
     `page.waitForEvent('download')` um den Klick auf `#vgl-csv` legen und
     pruefen, dass `download.suggestedFilename()` „laut-nva" enthaelt und
     **keine** Klammern.

  Keine neue Fixture, keine neue Abhaengigkeit. `test.slow()` wie im Bestand,
  wo ein PDF verarbeitet wird.
  </action>
  <verify>
  <automated>npx playwright test tests/e2e/vergleich.spec.mjs tests/e2e/csv-upload.spec.mjs 2>&1 | tail -30</automated>
  </verify>
  <done>
  - Vier neue Tests in `tests/e2e/vergleich.spec.mjs`, alle gruen
  - Mit nur dem NVA 2026: Tab sichtbar, Sentinel in `#vgl-a`, 3 Karten, 3
    Diagramme, Kontroll-Panel mit Ausloeser-Hinweis statt „Geprueft",
    `#vgl-tausch` disabled
  - Mit beiden PDFs: Sentinel ist Vorbelegung, das geladene VA 2026 ist
    waehlbar und loest die Kontrolle mit 2 Abweichungszeilen aus
  - Mit nur dem OH-CSV-Paar: Tab verborgen, `.vgl-leer` sichtbar
  - Download-Name enthaelt „laut-nva" und keine Klammern
  - Die gesamte Spec-Datei und `csv-upload.spec.mjs` laufen gruen
  </done>
</task>

<task type="auto">
  <name>Task 6: Dokumentation nachziehen und Gesamtlauf</name>
  <files>docs/BROWSER-APP.md</files>
  <action>
  Nachzug in `docs/BROWSER-APP.md`, Abschnitt „Dokumenttypen: Reihenfolge und
  Vergleich" (ca. 70-121). Vier Stellen:

  **6a — `118-120`: die widerlegte RA-Begruendung entfernen.** Dort steht heute
  wortgleich derselbe Satz wie im Code-Kommentar („seine Spalte 2 ist das Soll
  … laesst sich aus dem Seitenkopf nicht entscheiden"). Ersetzen durch die
  D2-Erkenntnis: das Soll eines RA ist der Voranschlag **inklusive Nachtrag**,
  belegt an `RA-2025-Auflage.pdf` gegen `NVA-2025-Auflage.pdf` — gegen
  NVA-Spalte 1 („VA 2025 inkl. NVA") **0 Abweichungen**, gegen NVA-Spalte 2
  (Original) viele. Deshalb unterstuetzt `kontrolle()` den RA jetzt, und die
  Basis heisst dort „Soll <Jahr> (laut RA)" statt wie abgedruckt.
  **Wenn du die Abweichungszahl zitierst, nenne die Zaehlweise mit dazu** —
  CONTEXT.md D2 zaehlt 138 Posten / 16.083.400 EUR in **einem** Schluesselraum
  (EHH und FHH als Wertepaar), RESEARCH.md zaehlt je Haushaltshaelfte getrennt
  191 Posten / 9.211.600 EUR (EHH) und 231 / 18.238.700 EUR (FHH). Richtung und
  Schluss sind identisch; die Zaehlweise unterscheidet sich. Alternativ die
  Zahl weglassen und nur „0 Abweichungen gegen Spalte 1" nennen.

  **6b — `87-117`: den internen Modus beschreiben.** Dass die Basis-Seite eine
  zweite Herkunft hat — die im Vergleichsdokument abgedruckte Spalte 2 —, dass
  sie die **Vorbelegung** ist und warum (per Definition die Fassung, gegen die
  das Dokument rechnet; ein separat geladenes Dokument kann eine andere Fassung
  sein, siehe Community Nurse). Die Beschriftungsregel „VA 2026 (laut NVA)"
  bzw. „Soll 2025 (laut RA)" nennen. Und dass ein OH-CSV-Dokument den Modus
  **nicht** anbietet, weil es den Spaltennamen traegt, aber keine Werte — die
  Pruefung ist deshalb datenbasiert, nicht typbasiert. Dazu der Satz aus D1:
  bei interner Basis laeuft die Selbstkontrolle nicht mit, das Panel nennt
  stattdessen das Dokument, mit dem sie sich ausloesen laesst.

  **6c — `76-81` (Spaltentabelle): vermerken, welche Spalte 3 eine Differenz
  ist.** NVA („1. NVA") und RA („Abweichung RA-VA") drucken Spalte 1 minus
  Spalte 2 ab — dort ist der interne Diff gegen eine abgedruckte Zahl
  **verifizierbar**. Ein **Voranschlag** druckt keine Differenz ab: seine
  Spalte 3 ist der RA des Vorvorjahres. Der interne Modus funktioniert beim VA
  trotzdem (Basis = Vorjahres-VA), ist dort aber nicht gegen eine abgedruckte
  Spalte belegbar. Ergaenze den Spiegelfall zu D2: die Spalte 2 eines VA ist
  der Vorjahres-VA im **Original**, ohne dessen Nachtrag — RA und VA messen
  gegen verschiedene Staende, und genau das steckt in der Beschriftung.

  **6d — `82-85`:** die Beschreibung der Vorbelegung an D1 anpassen (die
  dokumentinterne Spalte gewinnt, wenn das Vergleichsdokument eine gefuellte
  Spalte 2 traegt).

  **6e — Gesamtlauf.** Danach die vollstaendige Verifikation fahren (siehe
  `<verification>`): js, e2e, Python. Die Python-Seite ist von diesem Issue
  nicht betroffen (`src/` enthaelt keine Diff-Engine), muss aber gruen bleiben.
  </action>
  <verify>
  <automated>! grep -rn "aus dem Seitenkopf nicht zu entscheiden\|aus dem Seitenkopf nicht entscheiden\|bleibt von der Kontrolle bewusst ausgenommen\|bleibt bewusst aussen vor" docs/ web/ && grep -q "laut RA" docs/BROWSER-APP.md && grep -q "laut NVA" docs/BROWSER-APP.md && npm run test:js 2>&1 | tail -15 && npx playwright test 2>&1 | tail -20 && PYTHONPATH=src pytest -q 2>&1 | tail -5 && ruff check src tests && mypy src</automated>
  </verify>
  <done>
  - Die widerlegte RA-Begruendung steht weder in `docs/` noch in `web/`
  - `docs/BROWSER-APP.md` beschreibt den internen Modus: Herkunft,
    Beschriftungsregel („laut NVA" / „laut RA"), warum die interne Spalte die
    Vorbelegung ist, warum OH-CSV ihn nicht anbietet
  - Die Spaltentabelle vermerkt, welche Spalte 3 eine Differenz ist (NVA, RA)
    und welche nicht (VA), samt Spiegelfall zu D2
  - Wird eine Abweichungszahl zitiert, steht die Zaehlweise dabei
  - Alle Suiten gruen: `npm run test:js`, `npx playwright test`,
    `PYTHONPATH=src pytest -q`, `ruff check src tests`, `mypy src`
  </done>
</task>

</tasks>

<verification>
Nach allen Tasks im Worktree ausfuehren:

```sh
npm run test:js                 # Node-Tests der Browser-App
npx playwright test             # alle Browser-e2e-Tests
PYTHONPATH=src pytest -q        # Python-Pipeline (nicht betroffen, muss gruen bleiben)
ruff check src tests
mypy src
```

Zusaetzliche Handpruefungen, die kein Test abdeckt:

```sh
# Die widerlegte RA-Begruendung ist nirgends mehr vorhanden.
grep -rn "aus dem Seitenkopf" web/ docs/ ; echo "erwartet: keine Treffer"

# Keine neue Abhaengigkeit, kein Vendoring, kein Build-Schritt.
git diff --stat package.json package-lock.json ; echo "erwartet: leer"
git status --porcelain web/vendor 2>/dev/null ; echo "erwartet: leer"

# Keine Werkzeug-Attribution in Commits oder Code.
git log --format='%s%n%b' main..HEAD | grep -i -E "claude|generated with|co-authored-by" ; echo "erwartet: keine Treffer"
git diff main..HEAD | grep -i -E "^\+.*(claude|generated with)" ; echo "erwartet: keine Treffer"
```
</verification>

<success_criteria>
1:1 zu den Akzeptanzkriterien aus ISSUE.md:

- [ ] Mit **nur** dem NVA 2026 geladen zeigt der Vergleichs-Tab den
      vollstaendigen Diff gegen dessen eigene Spalte „VA 2026" — belegt durch
      den js-Test (1048 Zeilen, Status 32/6/122/888) und den e2e-Test (Tab
      sichtbar, 3 Karten, 3 Diagramme)
- [ ] Die Ergebnisse stimmen **Zeile fuer Zeile** mit der abgedruckten Spalte
      „1. NVA" ueberein: `delta === Math.round(ed)` bzw. `fd` fuer jeden
      Schluessel, 160 EHH / 178 FHH mit Bewegung, 0 Abweichungen
- [ ] Die Kennzahlen entsprechen den Summenzeilen der Anlage 1a: Ertraege
      +790.300, Aufwendungen +502.200, Nettoergebnis +288.100
- [ ] Die interne Spalte ist die Vorbelegung, auch wenn der VA 2026 geladen
      ist (`#vgl-a` haelt `intern`); das geladene Dokument bleibt waehlbar
- [ ] Wird das geladene Dokument als Basis gewaehlt, laeuft die Selbstkontrolle
      wie bisher und findet die Community-Nurse-Differenz (2 Stellen,
      200.600 EUR, Ansatz 429000)
- [ ] Ist die interne Spalte die Basis, erklaert das Kontroll-Panel, wodurch
      die Kontrolle ausgeloest wird — es nennt das Dokument und ob es geladen
      ist, und schreibt **nicht** „Geprueft"
- [ ] Kopfzeile, Tabellenkopf, Kennzahlen-Karten, Wasserfall-Achse,
      CSV-Kopfzeile und CSV-Dateiname benennen die Herkunft der Basis
      („VA 2026 (laut NVA)" bzw. „laut-nva" im Dateinamen, ohne Klammern)
- [ ] Der Tab ist ab **einem** Dokument mit gefuellter Vergleichsspalte
      sichtbar; mit nur einem OH-CSV-Dokument bleibt er verborgen und der
      Leer-Hinweis steht
- [ ] Ein RA als Vergleichsdokument funktioniert ebenso (Spalte 2 = Soll):
      interner Diff gegen Spalte 3 mit 0 Abweichungen, Basis benannt
      „Soll 2025 (laut RA)", und `kontrolle()` belegt NVA 2025 gegen RA 2025
      (1156 EHH / 1160 FHH geprueft, 0 Abweichungen)
- [ ] Bestehende Zwei-Dokumente-Vergleiche unveraendert; alle Tests gruen
      (`npm run test:js`, `npx playwright test`, `PYTHONPATH=src pytest -q`,
      `ruff check src tests`, `mypy src`)
</success_criteria>
