# Plan: Sankey-Drill-down: gegenueberliegende Seite beibehalten

<objective>
Was: Beim Sankey-Drill-down soll nur die *gedrillte* Seite ihre uebrigen
Top-Level-Knoten ausblenden; die gegenueberliegende Seite bleibt in ihrer
Uebersichtsform stehen.

Warum: PR #3 (`0bc9bf0`) blendet beim Aufklappen eines Knotens die *gesamte*
Gegenseite aus. Dadurch ist nicht mehr ablesbar, welchen Anteil der
aufgeklappte Bereich am Gesamthaushalt hat — genau diese Einordnung ist der
Zweck des Sankey.

Scope: Reiner Logik-Fix in der reinen Funktion `buildSankeyOption`
(`web/js/sankey-drill.js`) plus Anpassung der Unit-Tests (`tests/js/run.mjs`)
und e2e-Tests (`tests/e2e/sankey.spec.mjs`). Ausser Scope: der Klick-Handler
`drillAufKnoten` in `web/vendor/dashboard/dashboard.js` (keine Aenderung
noetig — bereits in RESEARCH.md verifiziert), die Kapp-/Aggregations-Logik
(`TOP_N`, `kappen`), die Uebersicht und der "Uebersicht"-Reset.
</objective>

<strategy>
Der Bug ist eng begrenzt: zwei aeussere Guards in `buildSankeyOption`
(`if (!expand || expand.seite === "quelle")` bzw. `=== "gruppe"`) ueberspringen
im Drill-down die komplette Gegenseite. Heute kennt jede Seite damit nur zwei
Zustaende; gebraucht werden drei: (a) Uebersicht, (b) eigene Seite gedrillt,
(c) Gegenseite — Zustand (c) soll wie (a) rendern.

Optionen erwogen:
- *Beide Guards entfernen + innere Bedingung weiten* (gewaehlt). Minimal,
  rein additiv, dupliziert keinen Render-Pfad. Der bestehende
  Uebersicht-Zweig (`else if (!expand)`) wird zu `else if (!<seite>Gedrillt)`
  ueber eine pro-Seite berechnete Boolean-Flagge — damit faellt die Gegenseite
  in den Uebersicht-Zweig, ein nicht-gewaehlter Knoten der gedrillten Seite
  bleibt korrekt ausgeblendet.
- *Uebersicht-Render-Pfad fuer die Gegenseite duplizieren* (verworfen) —
  doppelter Code, Wartungslast, kein Vorteil.

Schluessel-Entscheidungspunkt: die Bedingung muss seitenspezifisch sein
(`quelleGedrillt`, `gruppeGedrillt`) — NICHT `!expand`. Ein `else { ... }`
wuerde die von PR #3 korrekt entfernten anderen Knoten der gedrillten Seite
wieder einblenden. Das ist der einzige Fallstrick.

Die zwei Unit-Test-Assertions "zeigt nur den gewaehlten Zweig" kodieren
explizit "keine Gegenseite" und werden nach dem Fix rot — sie muessen
umgeschrieben werden (nur die gedrillte Seite einschraenken) und um
Assertions fuer die Gegenseite in Uebersichtsform ergaenzt werden.
</strategy>

<context>
Issue: @.issues/gy5d1-sankey-drill-down-gegenueberliegende-seite-beibehalten/ISSUE.md
Research: @.issues/gy5d1-sankey-drill-down-gegenueberliegende-seite-beibehalten/RESEARCH.md

<interfaces>
<!-- Executor: nutze diese Kontrakte direkt. Keine Codebase-Erkundung noetig. -->

// Aus web/js/sankey-drill.js — die zu aendernde Datei:
export const TOP_N: number  // = 8
export function buildSankeyOption(
  posten: Posten[],
  dokId: string | number,
  expand: null | { seite: "quelle" | "gruppe", key: string }
): EChartsSankeyOption

// Knoten-Struktur, die buildSankeyOption pro Knoten erzeugt (node()-Helfer):
// {
//   name: string,
//   itemStyle: { color: string },
//   drillSeite: "" | "mitte" | "quelle" | "gruppe",
//   drillKey: string,        // Quellenname bzw. Gruppencode
//   drillExpandbar: boolean, // true = eingeklappter, aufklappbarer Knoten
// }
// Link-Struktur: { source: string, target: string, value: number }
// MITTE = "Gemeindehaushalt" (konstanter Mittelknoten, drillSeite "mitte")

// Aktuelle Code-Struktur in buildSankeyOption (verifiziert, Zeilennummern exakt):
//   Zeile 176-178: Block-Kommentar Einnahmeseite (behauptet "entfaellt ganz")
//   Zeile 179:     if (!expand || expand.seite === "quelle") {   <- Guard
//   Zeile 181-190: if (expand && expand.key === name) { ... }    <- aufgeklappter Zweig
//   Zeile 191:     } else if (!expand) {                         <- Uebersicht-Zweig
//   Zeile 200:     // Kommentar "andere Quelle bleibt ausgeblendet"
//   Zeile 202:     }   <- Ende Guard-Block
//   Zeile 204-205: Block-Kommentar Ausgabeseite (behauptet "entfaellt ganz")
//   Zeile 206:     if (!expand || expand.seite === "gruppe") {   <- Guard
//   Zeile 208-217: if (expand && expand.key === code) { ... }    <- aufgeklappter Zweig
//   Zeile 218:     } else if (!expand) {                         <- Uebersicht-Zweig
//   Zeile 226:     // Kommentar "andere Gruppe bleibt ausgeblendet"
//   Zeile 228:     }   <- Ende Guard-Block

// Aus tests/js/run.mjs — Test-Harness:
// function pruefe(name: string, bedingung: boolean, detail?: string): void
// imports aus sankey-drill.js: { buildSankeyOption, quelleVonPosten, kappen, TOP_N }

// Aus web/vendor/dashboard/dashboard.js — NICHT aendern:
// window.__sankeyDrill(knotenName): Test-Seam, ruft drillAufKnoten(knoten)
</interfaces>

Key files:
@web/js/sankey-drill.js — reine Funktion `buildSankeyOption`, einzige zu aendernde Quelldatei
@tests/js/run.mjs — Node-Unit-Tests, sankey-drill-Block Zeilen 258-413
@tests/e2e/sankey.spec.mjs — Playwright-e2e, Drill-down-Test Zeilen 24-49
</context>

<commit_format>
Format: `{id}: {message}` (aus .issues/config.yaml), keine Werkzeug-Attribution.
Beispiel: `gy5d1: fix(sankey): Gegenseite im Drill-down erhalten`
Pattern: `gy5d1: <type>(<scope>): <Beschreibung>` — type aus feat/fix/test/refactor.
</commit_format>

<tasks>

<task type="auto">
  <name>Task 1: buildSankeyOption — Gegenseite im Drill-down erhalten</name>
  <files>web/js/sankey-drill.js</files>
  <action>
  In `buildSankeyOption` (`web/js/sankey-drill.js`) die beiden aeusseren Guards
  entfernen, sodass beide Seiten immer durchlaufen werden, und die inneren
  Uebersicht-Bedingungen seitenspezifisch weiten.

  1. Direkt nach `node(MITTE, ...)` (nach Zeile 174, vor dem
     Einnahmeseiten-Kommentar) zwei pro-Seite-Flaggen berechnen:
       const quelleGedrillt = !!expand && expand.seite === "quelle"
       const gruppeGedrillt = !!expand && expand.seite === "gruppe"

  2. Einnahmeseite:
     - Zeile 179 `if (!expand || expand.seite === "quelle") {` ENTFERNEN.
       Die `quellen(einnahmen).forEach(...)`-Schleife laeuft jetzt immer
       (Einrueckung der Schleife entsprechend reduzieren).
     - Zeile 202 `}` (schliessender Guard-Block) ENTFERNEN.
     - Zeile 191 `} else if (!expand) {` ersetzen durch
       `} else if (!quelleGedrillt) {`.
     - Der `if (expand && expand.key === name)`-Zweig (Zeilen 181-190) bleibt
       UNVERAENDERT.

  3. Ausgabeseite (symmetrisch):
     - Zeile 206 `if (!expand || expand.seite === "gruppe") {` ENTFERNEN.
       Die `gruppen(ausgaben).forEach(...)`-Schleife laeuft jetzt immer.
     - Zeile 228 `}` (schliessender Guard-Block) ENTFERNEN.
     - Zeile 218 `} else if (!expand) {` ersetzen durch
       `} else if (!gruppeGedrillt) {`.
     - Der `if (expand && expand.key === code)`-Zweig (Zeilen 208-217) bleibt
       UNVERAENDERT.

  WICHTIG — Bedingung NICHT zu `else { ... }` aufweiten: das wuerde die
  anderen, nicht-gewaehlten Knoten der GEDRILLTEN Seite wieder einblenden (das
  von PR #3 korrekt entfernte Verhalten). Auf der gedrillten Seite faellt ein
  nicht-gewaehlter Knoten in den `else if`-Zweig, dessen Bedingung dann `false`
  ist -> Knoten bleibt korrekt ausgeblendet. Auf der Gegenseite ist
  `!<seite>Gedrillt === true` -> Uebersichtsform.

  4. Kommentare auf das neue Verhalten anpassen (Deutsch, keine
     Werkzeug-Attribution):
     - Modul-Header Zeilen 8-11: Die Aussage "die uebrigen Knoten der obersten
       Ebene werden ausgeblendet" praezisieren auf "die uebrigen Knoten der
       gedrillten Seite werden ausgeblendet; die Gegenseite bleibt in
       Uebersichtsform sichtbar".
     - Block-Kommentar Einnahmeseite (Zeilen 176-178): den Satz "Bei einem
       Drill-down in eine Gruppe entfaellt die Einnahmeseite ganz" ersetzen
       durch eine Beschreibung des neuen Verhaltens (Gegenseite bleibt in
       Uebersichtsform).
     - Block-Kommentar Ausgabeseite (Zeilen 204-205): analog, "bei einem
       Drill-down in eine Quelle entfaellt die Ausgabeseite ganz" ersetzen.
     - Kommentar Zeile 200 ("Im Drill-down einer anderen Quelle ...") und
       Zeile 226 ("Im Drill-down einer anderen Gruppe ...") praezisieren auf
       "anderer Knoten DERSELBEN gedrillten Seite".

  Keine Aenderung an `node()`, `quellen()`, `gruppen()`, `kontenDerQuelle()`,
  `ansaetzeDerGruppe()`, `kappen()`, `TOP_N` oder der zurueckgegebenen
  Options-Struktur.
  </action>
  <verify>
  <automated>cd /workspace/.worktrees/gy5d1-sankey-drill-down-gegenueberliegende-seite-beibehalten && node -e "import('./web/js/sankey-drill.js').then(m=>{const o1=m.buildSankeyOption([],1,null);const o2=m.buildSankeyOption([],1,{seite:'gruppe',key:'x'});console.log('lädt:',typeof m.buildSankeyOption==='function', Array.isArray(o1.series[0].data), Array.isArray(o2.series[0].data))}).catch(e=>{console.error(e);process.exit(1)})"</automated>
  </verify>
  <done>
  - Beide aeusseren Guards `if (!expand || expand.seite === ...)` sind entfernt.
  - Vor den Schleifen sind `quelleGedrillt` und `gruppeGedrillt` definiert.
  - Die beiden Uebersicht-Zweige lauten `} else if (!quelleGedrillt) {` bzw.
    `} else if (!gruppeGedrillt) {`.
  - Die `if (expand && expand.key === ...)`-Zweige sind unveraendert.
  - Modul- und Block-Kommentare beschreiben das neue Verhalten (kein
    "entfaellt ganz" mehr).
  - `buildSankeyOption` ist syntaktisch gueltig und ESM-importierbar (Smoke-Test gruen).
  </done>
</task>

<task type="auto">
  <name>Task 2: Unit-Tests in run.mjs an das neue Drill-down-Verhalten anpassen</name>
  <files>tests/js/run.mjs</files>
  <action>
  Im sankey-drill-Block (`tests/js/run.mjs`, Zeilen 258-413) die zwei
  Assertions umschreiben, die das alte "Gegenseite verschwindet"-Verhalten
  kodieren, und neue Assertions fuer die Gegenseite in Uebersichtsform
  ergaenzen. Alle Namen Deutsch, Format `pruefe(name, bedingung, detail?)`.

  1. Gruppen-Drill-down — Assertion Zeilen 352-360
     (`"buildSankeyOption: Drill-down einer Gruppe zeigt nur den gewaehlten
     Zweig"`) umschreiben: nur noch die GEDRILLTE Seite einschraenken. Neue
     Bedingung: jeder Knoten mit `drillSeite === "gruppe"` hat
     `drillKey === eineGruppe.drillKey`. Knoten mit `drillSeite === "quelle"`
     oder `"mitte"` sind erlaubt. Konkret:
       gSerie.data
         .filter((n) => n.drillSeite === "gruppe")
         .every((n) => n.drillKey === eineGruppe.drillKey)
     Den Kommentar darueber auf "keine ANDEREN Gruppen-Knoten" praezisieren.

  2. Nach der Gruppen-Drill-down-Assertion eine NEUE Assertion ergaenzen, die
     bestaetigt, dass die Einnahmeseite in Uebersichtsform erhalten ist. Nutze
     `quelleKnoten` aus Zeile 323 (Uebersicht). Pruefe:
       const gEinnahmeseite = gSerie.data.filter((n) => n.drillSeite === "quelle")
       pruefe(
         "buildSankeyOption: Gruppen-Drill-down erhaelt die Einnahmeseite in Uebersichtsform",
         gEinnahmeseite.length === quelleKnoten.length &&
           gEinnahmeseite.every((n) => n.drillExpandbar) &&
           gEinnahmeseite.every((n) =>
             quelleKnoten.some((q) => q.name === n.name)),
         gEinnahmeseite.length + " vs " + quelleKnoten.length,
       )

  3. Quellen-Drill-down — Assertion Zeilen 397-405
     (`"buildSankeyOption: Drill-down einer Quelle zeigt nur den gewaehlten
     Zweig"`) symmetrisch umschreiben: jeder Knoten mit
     `drillSeite === "quelle"` hat `drillKey === eineQuelle.drillKey`;
     `"gruppe"`/`"mitte"` erlaubt. Konkret:
       qSerie.data
         .filter((n) => n.drillSeite === "quelle")
         .every((n) => n.drillKey === eineQuelle.drillKey)
     Kommentar entsprechend praezisieren.

  4. Nach der Quellen-Drill-down-Assertion eine NEUE Assertion ergaenzen, die
     bestaetigt, dass die Ausgabeseite in Uebersichtsform erhalten ist. Nutze
     `gruppeKnoten` aus Zeile 324:
       const qAusgabeseite = qSerie.data.filter((n) => n.drillSeite === "gruppe")
       pruefe(
         "buildSankeyOption: Quellen-Drill-down erhaelt die Ausgabeseite in Uebersichtsform",
         qAusgabeseite.length === gruppeKnoten.length &&
           qAusgabeseite.every((n) => n.drillExpandbar) &&
           qAusgabeseite.every((n) =>
             gruppeKnoten.some((g) => g.name === n.name)),
         qAusgabeseite.length + " vs " + gruppeKnoten.length,
       )

  NICHT aendern (bleiben gruen, RESEARCH.md verifiziert):
  - Zeilen 346-351 / 391-396 (aufgeklappter Knoten verschwindet als
    Einzelknoten) — pruefen nur den aufgeklappten Knoten selbst.
  - Zeilen 362-376 / 384-413 (Betragstreue via `gruppenSumme`/`quellenSumme`)
    — die Richtungsfilter `source === "Gemeindehaushalt"` bzw.
    `target === "Gemeindehaushalt"` trennen die Gegenseiten-Links sauber ab.
    Diese Tests muessen nach der Aenderung weiterhin gruen sein — beim
    Test-Lauf ausdruecklich pruefen.
  - Zeilen 311-338 (Uebersicht ohne Drill-down) und 259-308
    (`quelleVonPosten`/`kappen`) — unberuehrt.
  </action>
  <verify>
  <automated>cd /workspace/.worktrees/gy5d1-sankey-drill-down-gegenueberliegende-seite-beibehalten && npm run test:js</automated>
  </verify>
  <done>
  - Die zwei "zeigt nur den gewaehlten Zweig"-Assertions schraenken nur die
    gedrillte Seite ein.
  - Zwei neue Assertions bestaetigen die Gegenseite in Uebersichtsform
    (gleiche Knotenanzahl/Namen wie die Uebersicht, alle `drillExpandbar`).
  - Die Betragstreue-Assertions (`gruppenSumme`/`quellenSumme`) sind gruen.
  - `npm run test:js` laeuft vollstaendig gruen.
  </done>
</task>

<task type="auto">
  <name>Task 3: e2e-Test sankey.spec.mjs praezisieren und verankern</name>
  <files>tests/e2e/sankey.spec.mjs</files>
  <action>
  Den Drill-down-e2e-Test (`tests/e2e/sankey.spec.mjs`, Zeilen 24-49) an das
  neue Verhalten anpassen.

  1. Kommentar Zeilen 45-46 praezisieren: "die Grafik blendet die uebrigen
     Knoten der obersten Ebene aus" ist nach dem Fix ungenau. Auf "die Grafik
     blendet die uebrigen Knoten DER GEDRILLTEN SEITE aus; die Gegenseite
     bleibt in Uebersichtsform sichtbar" aendern.

  2. `await expect.poll(() => knotenzahl(page)).toBeLessThan(vorher)`
     (Zeile 48) bleibt korrekt — die gedrillte Seite verliert Top-Level-Knoten,
     die Netto-Knotenzahl sinkt. Beim Testlauf bestaetigen; falls die Zusicherung
     bei den realen Fixture-Daten doch nicht haelt (z. B. die gewaehlte Quelle
     klappt in viele Konten auf), den Vergleich praezisieren — z. B. statt der
     Gesamtknotenzahl gezielt pruefen, dass auf der gedrillten Seite weniger
     Top-Level-Knoten stehen.

  3. Eine neue Assertion ergaenzen, die das Akzeptanzkriterium "Gegenseite
     bleibt sichtbar" e2e verankert. Nach dem Drill-down ueber die ECharts-
     Serien-Daten pruefen, dass mindestens ein Knoten der Gegenseite noch in
     Uebersichtsform vorhanden ist (`drillExpandbar === true`). Der gedrillte
     Knoten kann Quelle oder Gruppe sein — pruefe daher seitenagnostisch, dass
     nach dem Drill-down noch aufklappbare Knoten existieren, deren
     `drillSeite` sich von der gedrillten Seite unterscheidet. Beispiel:
       const seiten = await page.evaluate(() =>
         window.echarts
           .getInstanceByDom(document.getElementById('c_sankey'))
           .getOption().series[0].data
           .filter((n) => n.drillExpandbar)
           .map((n) => n.drillSeite))
       // Im Drill-down ist genau eine Seite gedrillt; die Gegenseite muss
       // weiterhin aufklappbare Knoten beisteuern.
       expect(new Set(seiten).size).toBeGreaterThan(0)
     Praeziser: ermittle die gedrillte Seite aus dem zuvor gewaehlten Knoten
     und pruefe, dass `seiten` mindestens einen Eintrag mit der ANDEREN Seite
     enthaelt. Den gewaehlten Knoten liefert `aufklappbarerKnoten`; seine
     `drillSeite` laesst sich im selben `page.evaluate` mitlesen.

  4. Der Reset-Test (Zeilen 51-68) bleibt unveraendert.

  Sprache Deutsch in Kommentaren, keine Werkzeug-Attribution.
  </action>
  <verify>
  <automated>cd /workspace/.worktrees/gy5d1-sankey-drill-down-gegenueberliegende-seite-beibehalten && (npx playwright install --with-deps chromium || npx playwright install chromium) && npm run test:e2e</automated>
  </verify>
  <done>
  - Kommentar Zeilen 45-46 beschreibt das neue Verhalten praezise.
  - Eine neue Assertion bestaetigt, dass die Gegenseite nach dem Drill-down in
    Uebersichtsform (aufklappbare Knoten) sichtbar bleibt.
  - Der Reset-Test ist unveraendert.
  - `npm run test:e2e` laeuft gruen (beide Tests).
  </done>
</task>

</tasks>

<verification>
Nach allen Tasks die volle Test-Suite des Projekts gruen halten:
- `cd <worktree> && npm run test:js` — Node-Unit-Tests, alle `pruefe`-Zeilen gruen.
- `cd <worktree> && npm run test:e2e` — Playwright-e2e, beide Sankey-Tests gruen.
  Bei fehlendem Browser zuvor `npx playwright install chromium`.
- Manuell sicherstellen, dass keine Werkzeug-Attribution in Code/Kommentaren/
  Commit-Messages steht und alle neuen Bezeichner Deutsch sind.
</verification>

<success_criteria>
Bildet 1:1 die Akzeptanzkriterien aus ISSUE.md ab:
- Drill-down auf eine Aufgabengruppe blendet nur die anderen Gruppen aus; die
  Einnahmeseite bleibt unveraendert in Uebersichtsform sichtbar.
  (Task 1 + Unit-Assertion in Task 2)
- Drill-down auf eine Einnahmequelle blendet nur die anderen Quellen aus; die
  Ausgabeseite bleibt unveraendert in Uebersichtsform sichtbar.
  (Task 1 + Unit-Assertion in Task 2)
- Der aufgeklappte Knoten zeigt seine Unterelemente; die Betragstreue bleibt
  erhalten (Betragstreue-Assertions in Task 2 gruen).
- Die Uebersicht (kein Drill-down) bleibt unveraendert (Uebersicht-Assertions
  Zeilen 311-338 unberuehrt und gruen).
- Der "Uebersicht"-Reset funktioniert weiterhin (Reset-e2e-Test unveraendert
  und gruen).
- Tests gruen: `npm run test:js` und `npm run test:e2e`.
</success_criteria>
