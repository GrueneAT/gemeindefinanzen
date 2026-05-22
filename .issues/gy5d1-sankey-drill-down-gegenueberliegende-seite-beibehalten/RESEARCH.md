# Research: Sankey-Drill-down: gegenueberliegende Seite beibehalten

**Researched:** 2026-05-22
**Issue:** gy5d1-sankey-drill-down-gegenueberliegende-seite-beibehalten
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**1. Gegenseite bleibt waehrend des Drill-downs voll interaktiv.**
Die Knoten der Gegenseite behalten `drillExpandbar: true`. Ein Klick darauf
startet ueber den bestehenden Handler `drillAufKnoten` in
`web/vendor/dashboard/dashboard.js` einen neuen Drill-down auf dieser Seite und
ersetzt den bisherigen (`sankeyExpand = { seite, key }`). Das ist symmetrisch,
entspricht dem "voellig unveraendert" der Anforderung und erfordert KEINE
Handler-Aenderung — der Handler ersetzt eine bestehende Ausklappung bereits.

**Loesungsskizze (aus CONTEXT.md):** In `buildSankeyOption` muss jede Seite in
drei statt zwei Zustaenden gerendert werden:
- Diese Seite, kein Drill-down (`!expand`): Uebersicht — jeder Knoten
  eingeklappt + aufklappbar. (unveraendert)
- Diese Seite ist die gedrillte Seite (`expand.seite === <dieseSeite>`):
  gewaehlten Knoten aufklappen, uebrige Knoten dieser Seite ausblenden.
  (unveraendert gegenueber PR #3)
- Diese Seite ist die Gegenseite (`expand` gesetzt, aber
  `expand.seite !== <dieseSeite>`): NEU — Uebersichtsform rendern, exakt wie im
  `!expand`-Fall.

Konkret: die aeusseren `if (!expand || expand.seite === ...)`-Guards entfallen
(beide Seiten werden immer durchlaufen). Die innere `else if (!expand)`-Bedingung
fuer die Uebersichtsform wird zu "Uebersicht rendern, wenn diese Seite NICHT die
gedrillte Seite ist".

### Claude's Discretion
Kein eigener Abschnitt in CONTEXT.md. Die Loesungsskizze ist eng vorgegeben;
Spielraum besteht nur bei der konkreten Formulierung der Bedingung und der
Test-Assertions.

### Deferred Ideas (OUT OF SCOPE)
- Keine Aenderung an `drillAufKnoten` / dem Klick-Handler in `dashboard.js`.
- Keine Aenderung der Uebersicht (kein Drill-down) und des "Uebersicht"-Resets.
- Keine Aenderung an Kapp-Logik (`TOP_N`, `kappen`) oder Aggregation.
</user_constraints>

## Summary

Dies ist ein eng begrenzter Ein-Datei-Bugfix in der reinen Funktion
`buildSankeyOption` (`web/js/sankey-drill.js`). PR #3 (`0bc9bf0`) hat zwei
aeussere Guards eingefuehrt — `if (!expand || expand.seite === "quelle")` (Zeile
179) und `if (!expand || expand.seite === "gruppe")` (Zeile 206) — die im
Drill-down die *gesamte* Gegenseite ueberspringen. Genau diese Guards muessen
entfernt werden. Damit wird jede Seite immer durchlaufen, und die innere
Bedingung entscheidet pro Seite ueber den Render-Zustand.

Die Korrektur ist klein und mechanisch: Die innere `else if (!expand)`-Bedingung
(Zeilen 191 und 218), die heute die Uebersichtsform nur rendert, wenn *gar kein*
Drill-down aktiv ist, wird zu "Uebersichtsform rendern, wenn diese Seite nicht
die gedrillte Seite ist". Das laesst sich am sichersten ueber eine pro-Seite
berechnete Boolean-Flagge ausdruecken (z. B. `quelleGedrillt = expand &&
expand.seite === "quelle"`). Der innere `if (expand && expand.key === name)`-
Zweig (aufgeklappter Zweig) bleibt unveraendert; nur der `else if`-Zweig wird
weiter geoeffnet. `drillAufKnoten` in `dashboard.js` braucht keine Aenderung —
der Handler ersetzt eine bestehende Ausklappung bereits, und die Gegenseiten-
Knoten behalten automatisch `drillExpandbar: true`, weil sie wieder ueber den
`!expand`-Pfad gerendert werden.

Der zweite Teil der Arbeit ist Test-Anpassung: Zwei Assertions in `tests/js/run.mjs`
kodieren explizit "keine Gegenseite" (Zeilen 352-360 fuer Gruppen, 397-405 fuer
Quellen) und schlagen nach der Korrektur fehl — sie muessen umgeschrieben werden,
plus neue Assertions, die die Gegenseite in Uebersichtsform bestaetigen. In
`tests/e2e/sankey.spec.mjs` ist die Erwartung `knotenzahl < vorher` (Zeile 48)
nach der Korrektur weiterhin korrekt (nur eine Seite verliert Knoten), sollte
aber praeziser gefasst werden.

**Primary recommendation:** Entferne beide aeusseren Guards in `buildSankeyOption`,
ersetze die inneren `else if (!expand)` durch `else if (!<dieseSeite>Gedrillt)`,
und passe die zwei "nur gewaehlter Zweig"-Assertions in `run.mjs` so an, dass sie
nur die gedrillte Seite pruefen — plus neue Assertions fuer die Gegenseite.

## Codebase Analysis

### Relevant Code
| File | Purpose | Relevance |
|------|---------|-----------|
| `web/js/sankey-drill.js` | Reine Funktion `buildSankeyOption` + Helfer; baut Knoten/Links | PRIMAER — einzige zu aendernde Quelldatei |
| `web/vendor/dashboard/dashboard.js` | Klick-Handler `drillAufKnoten`, `renderSankey`, `setupSankeyDrill` | Lesen/verstehen — KEINE Aenderung |
| `tests/js/run.mjs` | Node-Unit-Tests inkl. sankey-drill (Zeilen 258-413) | Assertions anpassen + ergaenzen |
| `tests/e2e/sankey.spec.mjs` | Playwright-e2e: Drill-down + Reset | Erwartung praezisieren |

### Interfaces
<interfaces>
// From web/js/sankey-drill.js — die zu aendernde Datei
export const TOP_N: number  // = 8
export function quelleVonPosten(p: { konto?: string, mvag?: string }): string
export function einnahmePosten(posten: Posten[], dokId): Posten[]
export function ausgabePosten(posten: Posten[], dokId): Posten[]
export function kappen(map: Map<string, number>, sonstigeLabel: string): [string, number][]
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

// From web/vendor/dashboard/dashboard.js — Handler, NICHT aendern
// var sankeyExpand = null;  // null | { seite, key }
// function drillAufKnoten(d):
//   - d.drillSeite === "mitte" || !d.drillSeite  -> sankeyExpand = null  (Reset)
//   - d.drillExpandbar                           -> sankeyExpand = { seite: d.drillSeite, key: d.drillKey }
//   - sankeyExpand && gleicher Knoten            -> sankeyExpand = null  (Einklappen)
//   danach renderSankey() + updateSankeyHinweis()
// function sankeyOption(): window.buildSankeyOption(posten, aktivDok, sankeyExpand)
// window.__sankeyDrill(knotenName): Test-Seam — sucht Knoten in der Serie,
//   ruft drillAufKnoten(knoten)

// From tests/js/run.mjs — Test-Harness
// function pruefe(name: string, bedingung: boolean, detail = ""): void
// imports: { buildSankeyOption, quelleVonPosten, kappen, TOP_N } aus sankey-drill.js
</interfaces>

### Die drei Render-Zustaende pro Seite — Mapping auf den Code

Heute (PR #3) kennt jede Seite nur zwei effektive Zustaende, weil der aeussere
Guard die Gegenseite ganz wegschneidet. Nach der Korrektur muessen pro Seite
drei Zustaende sauber unterschieden werden. Beispiel **Einnahmeseite**
(`web/js/sankey-drill.js`, Zeilen 179-202):

| Zustand | Bedingung | Render | Heutiger Code |
|---------|-----------|--------|---------------|
| Eigene Seite, Uebersicht | `!expand` | jede Quelle eingeklappt + `expandbar: true` | `else if (!expand)`-Zweig, Zeile 191-199 |
| Eigene Seite gedrillt | `expand.seite === "quelle"` | gewaehlte Quelle in Konten aufgeklappt; andere Quellen weggelassen | `if (expand && expand.key === name)`-Zweig, Zeile 181-190 |
| Gegenseite (gruppe gedrillt) | `expand && expand.seite === "gruppe"` | wie Uebersicht — jede Quelle eingeklappt + `expandbar: true` | KEIN Code — aeusserer Guard ueberspringt alles |

Symmetrisch fuer die **Ausgabeseite** (Zeilen 206-228), mit `gruppe`/`quelle`
vertauscht.

**Konkrete Code-Struktur nach der Korrektur** (Einnahmeseite):

- Zeile 179: `if (!expand || expand.seite === "quelle") {` → Guard ENTFERNEN.
  Die `quellen(einnahmen).forEach(...)`-Schleife laeuft immer.
- Zeile 191: `} else if (!expand) {` → ersetzen durch eine Bedingung, die
  "diese Seite ist nicht die gedrillte Seite" ausdrueckt. Empfohlen: vor der
  Schleife eine Flagge berechnen, z. B.
  `const quelleGedrillt = !!expand && expand.seite === "quelle"`, und den Zweig
  zu `} else if (!quelleGedrillt) {` machen.
  - Rationale: Der innere `if (expand && expand.key === name)`-Zweig feuert nur,
    wenn die Seite gedrillt ist UND es der gewaehlte Knoten ist. Faellt man in
    den `else`-Zweig, ist man entweder (a) auf der Gegenseite — dann
    `!quelleGedrillt === true` → Uebersicht; oder (b) auf der gedrillten Seite,
    aber NICHT der gewaehlte Knoten — dann `!quelleGedrillt === false` → Knoten
    bleibt ausgeblendet (korrekt, "andere Knoten derselben Seite ausblenden").
- Der Kommentar Zeile 200 (`// Im Drill-down einer anderen Quelle: dieser Knoten
  bleibt ausgeblendet.`) bleibt sinngemaess gueltig, sollte aber praezisiert
  werden auf "anderer Knoten DERSELBEN gedrillten Seite".

Symmetrisch Ausgabeseite: Zeile 206 Guard entfernen,
`const gruppeGedrillt = !!expand && expand.seite === "gruppe"`,
Zeile 218 `} else if (!expand) {` → `} else if (!gruppeGedrillt) {`.

Die Kopf-Kommentare des Moduls (Zeilen 1-13) und der `buildSankeyOption`-Block
(Zeilen 147-154, 176-178, 204-205) beschreiben das aktuelle "die Gegenseite
entfaellt ganz"-Verhalten und MUESSEN sinngemaess auf das neue Verhalten
("Gegenseite bleibt in Uebersichtsform") angepasst werden — Sprache Deutsch.

### Warum `drillAufKnoten` keine Aenderung braucht (verifiziert)
`drillAufKnoten` (`dashboard.js` Zeilen 467-485) wertet ausschliesslich
`d.drillSeite`, `d.drillExpandbar`, `d.drillKey` eines angeklickten Knotens aus.
Nach der Korrektur werden die Gegenseiten-Knoten wieder ueber den
Uebersicht-Pfad gerendert — d. h. mit `expandbar: true` (Zeilen 193-197 bzw.
219-223 setzen `expandbar: true`). Klickt man einen Gegenseiten-Knoten an,
greift der `else if (d.drillExpandbar)`-Zweig (Zeile 471) und setzt
`sankeyExpand = { seite: d.drillSeite, key: d.drillKey }` — er ERSETZT die
bestehende Ausklappung. Das ist exakt das in CONTEXT.md gewuenschte Verhalten.
Bestaetigt: KEINE Handler-Aenderung noetig.

### Tests in `tests/js/run.mjs` — was sich aendert
Block `sankey-drill — Geldfluss-Drill-down`, Zeilen 258-413. Import Zeilen 29-34.

**Assertions, die das aktuelle "Gegenseite verschwindet"-Verhalten kodieren und
nach der Korrektur FEHLSCHLAGEN — muessen umgeschrieben werden:**

1. **Zeilen 352-360** — `"buildSankeyOption: Drill-down einer Gruppe zeigt nur
   den gewaehlten Zweig"`. Aktuelle Bedingung:
   `gSerie.data.every((n) => n.drillSeite === "mitte" || n.drillKey === eineGruppe.drillKey)`.
   Schlaegt fehl, weil die Einnahmeseite (Knoten mit `drillSeite === "quelle"`)
   jetzt wieder vorhanden ist. → Umschreiben: pruefen, dass es KEINE *anderen*
   Gruppen-Knoten gibt, d. h. jeder Knoten mit `drillSeite === "gruppe"` hat
   `drillKey === eineGruppe.drillKey`. Knoten mit `drillSeite === "quelle"`
   bzw. `"mitte"` sind erlaubt.

2. **Zeilen 397-405** — `"buildSankeyOption: Drill-down einer Quelle zeigt nur
   den gewaehlten Zweig"`. Symmetrisch: aktuelle Bedingung
   `qSerie.data.every((n) => n.drillSeite === "mitte" || n.drillKey === eineQuelle.drillKey)`
   schlaegt fehl wegen der jetzt vorhandenen Ausgabeseite. → Umschreiben:
   jeder Knoten mit `drillSeite === "quelle"` hat
   `drillKey === eineQuelle.drillKey`; `"gruppe"`/`"mitte"` erlaubt.

**Assertions, die UNVERAENDERT gruen bleiben (verifiziert):**
- Zeilen 346-351 (`"aufgeklappte Gruppe verschwindet als Einzelknoten"`) —
  pruefen nur, dass es keinen `expandbar`-Knoten mit dem Gruppennamen gibt;
  trifft weiter zu.
- Zeilen 391-396 (`"aufgeklappte Quelle verschwindet als Einzelknoten"`) —
  analog.
- Zeilen 362-376 (Betragstreue Gruppe via `gruppenSumme` — Links mit
  `source === "Gemeindehaushalt"`). ACHTUNG PRUEFEN: `gruppenSumme` summiert
  ALLE Links mit `source === "Gemeindehaushalt"`. Im Drill-down auf eine Gruppe
  gehen die Links der gedrillten Gruppe von `Gemeindehaushalt` zu den Ansatz-
  Knoten; die Gegenseite (Einnahmen) erzeugt nur Links MIT
  `target === "Gemeindehaushalt"`. Damit summiert `gruppenSumme` weiterhin nur
  die Ansatz-Links der gedrillten Gruppe → Test bleibt gruen. Gleiches gilt fuer
  `quellenSumme` (Zeilen 384-390, Filter `target === "Gemeindehaushalt"`) und
  die Quellen-Betragstreue Zeilen 406-413. Diese Betragstreue-Tests bleiben
  korrekt, MUESSEN aber im Plan ausdruecklich als "nach Aenderung erneut
  verifizieren" markiert werden.
- Zeilen 311-338 (Uebersicht ohne Drill-down) — `expand = null`, voellig
  unberuehrt.
- `quelleVonPosten`- und `kappen`-Tests (Zeilen 259-308) — unberuehrt.

**Neue Assertions, die hinzukommen sollten:**
- Nach dem Gruppen-Drill-down (`sGruppe`/`gSerie`, ab Zeile 341): bestaetigen,
  dass die Einnahmeseite in Uebersichtsform vorhanden ist — z. B. es gibt
  Knoten mit `drillSeite === "quelle"` UND alle davon haben
  `drillExpandbar === true`; und ihre Anzahl/Namen entsprechen denen der
  Uebersicht `sSerie` (Vergleich gegen `quelleKnoten` aus Zeile 323).
- Nach dem Quellen-Drill-down (`sQuelle`/`qSerie`, ab Zeile 379): symmetrisch —
  Knoten mit `drillSeite === "gruppe"`, alle `drillExpandbar === true`,
  entsprechen `gruppeKnoten` aus Zeile 324.
- Optional: bestaetigen, dass die Gegenseiten-Links unveraendert sind
  (gleiche Link-Menge wie in der Uebersicht fuer die Gegenseite).

Format jeder neuen Assertion: `pruefe(name, bedingung, detail?)` — Deutscher
Name, Boolean-Bedingung, optionaler Detail-String (Helfer Zeile 42).

### Tests in `tests/e2e/sankey.spec.mjs` — was sich aendert
Test `"Sankey-Drill-down zeigt nur den gewaehlten Zweig"` (Zeilen 24-49):
- `aufklappbarerKnoten` (Zeilen 13-22) liefert den ERSTEN aufklappbaren Knoten
  der Uebersicht. In der Uebersicht stehen Quellen-Knoten vor Gruppen-Knoten
  (Einnahmeseite wird zuerst gebaut, Zeilen 179-202), daher ist das in der
  Praxis ein Quellen-Knoten. Der Test bleibt seitenagnostisch korrekt.
- Zeile 48 `await expect.poll(() => knotenzahl(page)).toBeLessThan(vorher)` —
  bleibt korrekt: Beim Drill-down verliert die gedrillte Seite die uebrigen
  Top-Level-Knoten; selbst wenn die gewaehlte Quelle in mehrere Konten
  aufklappt, ist die Netto-Knotenzahl bei den realen Fixture-Daten weiter
  geringer. NICHT BLIND VERLASSEN — der Plan sollte vorgeben, `npm run test:e2e`
  laufen zu lassen und bei Bedarf den Vergleich zu praezisieren.
- Empfehlung (Discretion): Eine zusaetzliche Assertion ergaenzen, die das neue
  Verhalten explizit prueft — nach dem Drill-down ist mindestens ein Knoten der
  GEGENSEITE noch in Uebersichtsform vorhanden (z. B. ueber `drillSeite` der
  Serien-Daten und `drillExpandbar === true`). Das ist die e2e-Verankerung des
  Akzeptanzkriteriums.
- Der Kommentar Zeile 45-46 (`// ... blendet die uebrigen Knoten der obersten
  Ebene aus ...`) ist nach der Korrektur ungenau und sollte praezisiert werden
  auf "der gedrillten Seite".

Test `"Sankey-Reset klappt zurueck auf die Uebersicht"` (Zeilen 51-68) —
unberuehrt; Reset-Verhalten aendert sich nicht.

### Reusable Components
- `quellen()`, `gruppen()`, `kontenDerQuelle()`, `ansaetzeDerGruppe()`,
  `kappen()` — alle Aggregations-Helfer bleiben unveraendert genutzt.
- `node()`-Closure und das `seen`-Set verhindern Doppelknoten — die
  Uebersichts-Render-Logik der Gegenseite wird einfach wieder durchlaufen,
  kein neuer Code noetig.
- `pruefe()`-Helfer im Test-Harness fuer neue Assertions.

### Potential Conflicts
- KEINE strukturellen Konflikte. Die Aenderung ist additiv (Guards entfernen,
  Bedingung weiten) innerhalb einer reinen Funktion.
- Aufpassen: Die zwei "nur gewaehlter Zweig"-Assertions MUESSEN angepasst werden,
  sonst bleibt `npm run test:js` rot. Nicht uebersehen.
- `gruppenSumme`/`quellenSumme` filtern korrekt nach Link-Richtung — durch die
  jetzt vorhandene Gegenseite kommen keine falschen Links in die Summe (Filter
  `source ===` bzw. `target === "Gemeindehaushalt"` trennt sauber).

## Standard Stack
| Library | Version | Purpose | Why Standard | Confidence |
|---------|---------|---------|--------------|------------|
| ECharts | per CDN (jsDelivr) | Sankey-Rendering im Browser | Bestehend; `buildSankeyOption` ist nur der Optionen-Builder | HIGH |
| @playwright/test | ^1.60.0 | e2e-Tests | Bereits devDependency, `npm run test:e2e` | HIGH |
| Node (Test-Runner) | ESM | `tests/js/run.mjs` ueber `npm run test:js` | Bestehendes Harness, kein Framework | HIGH |

Keine neue Abhaengigkeit noetig. Reiner Logik-Fix in einer bestehenden Datei.

## Don't Hand-Roll
| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Aggregation Quellen/Gruppen/Konten/Ansaetze | keine neue Aggregation | `quellen()`/`gruppen()`/`kontenDerQuelle()`/`ansaetzeDerGruppe()` | bestehend, deckungsgleich mit Uebersicht |
| TOP_N-Kappung | nicht neu implementieren | `kappen()` | unveraendert, ausser Scope |
| Test-Assertion-Runner | kein Framework einziehen | `pruefe()` in `run.mjs` | Projektkonvention, kein Build |

## Architecture Patterns

### Recommended Approach
Vier Schritte (die `#flow`-Knoten von RESEARCH.html bilden genau diese ab):

- **Step 1 — buildSankeyOption korrigieren.** In `buildSankeyOption`
  (`web/js/sankey-drill.js`) vor jeder Seiten-Schleife eine Boolean-Flagge
  berechnen (`quelleGedrillt` bzw. `gruppeGedrillt`). Beide aeusseren Guards
  (`if (!expand || expand.seite === ...)`, Zeilen 179 und 206) entfernen —
  Schleifen laufen immer. Inneren `else if (!expand)` zu
  `else if (!quelleGedrillt)` bzw. `else if (!gruppeGedrillt)` aendern; der
  `if (expand && expand.key === ...)`-Zweig bleibt unveraendert. Modul- und
  Block-Kommentare auf das neue Verhalten anpassen (Deutsch).
- **Step 2 — Unit-Tests in run.mjs anpassen.** Die zwei "nur gewaehlter Zweig"-
  Assertions (Zeilen 352-360, 397-405) umschreiben (nur die gedrillte Seite
  pruefen) + neue Assertions fuer die Gegenseite in Uebersichtsform.
- **Step 3 — e2e-Test praezisieren.** `tests/e2e/sankey.spec.mjs`: Kommentar
  praezisieren, optional eine Assertion fuer "Gegenseite bleibt sichtbar"
  ergaenzen.
- **Step 4 — Tests gruen.** `npm run test:js` und `npm run test:e2e` laufen
  lassen.

### Anti-Patterns to Avoid
- **`drillAufKnoten` anfassen.** Ausdruecklich ausser Scope (CONTEXT.md). Der
  Handler funktioniert symmetrisch ohne Aenderung.
- **`kappen`/`TOP_N`/Aggregation aendern.** Ausser Scope.
- **Uebersichts-Render-Pfad duplizieren.** Den bestehenden `else if`-Zweig
  einfach weiter oeffnen, nicht eine zweite Kopie fuer die Gegenseite schreiben.
- **Die Betragstreue-Tests ignorieren.** Sie bleiben vermutlich gruen, muessen
  aber nach der Aenderung verifiziert werden — `gruppenSumme`/`quellenSumme`
  duerfen keine Gegenseiten-Links einsammeln (tun sie dank Richtungsfilter
  nicht, aber pruefen).

## Common Pitfalls

### Test-Assertions vergessen anzupassen
**What goes wrong:** Nur die Quelldatei wird geaendert, `npm run test:js` bleibt
rot, weil Zeilen 352-360 und 397-405 das alte Verhalten einfordern.
**Why it happens:** Die Assertions heissen "zeigt nur den gewaehlten Zweig" —
klingt nach gewuenschtem Verhalten, kodiert aber "keine Gegenseite".
**How to avoid:** Beide Assertions explizit umschreiben, sodass sie nur die
gedrillte Seite einschraenken.
**Warning signs:** `npm run test:js` meldet zwei rote `buildSankeyOption`-Zeilen.

### Bedingung falsch weiten
**What goes wrong:** `else if (!expand)` zu `else { ... }` machen wuerde auch die
*anderen* Knoten der gedrillten Seite wieder einblenden — das ist genau das von
PR #3 korrekt entfernte Verhalten.
**Why it happens:** Verwechslung von "Gegenseite" und "andere Knoten derselben
Seite".
**How to avoid:** Die Flagge ist seitenspezifisch (`quelleGedrillt`), nicht
`!expand`. Auf der gedrillten Seite landet ein nicht-gewaehlter Knoten im
`else if`-Zweig, dessen Bedingung dann `false` ist → bleibt korrekt ausgeblendet.
**Warning signs:** Im Gruppen-Drill-down erscheinen wieder mehrere Gruppen-Knoten.

### Kommentare bleiben veraltet
**What goes wrong:** Modul-Header (Zeilen 1-13) und Block-Kommentare (176-178,
204-205) behaupten weiter "die Gegenseite entfaellt ganz".
**How to avoid:** Kommentare im selben Commit auf das neue Verhalten anpassen.
**Warning signs:** Codereview findet widerspruechliche Kommentare.

## Environment Availability
| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Node + npm | `npm run test:js`, `npm run test:e2e` | Annahme: ja (Repo nutzt es bereits) | reines ESM-Harness, kein Build |
| Playwright Browser | `tests/e2e/sankey.spec.mjs` | ggf. `npx playwright install` noetig | e2e kann CI-Browser-Setup erfordern |
| documents/*.pdf | `run.mjs` (fuehrt echte Pipeline) | im Repo vorhanden (4 PDFs) | Tests laufen gegen echte Fixture-PDFs |

Environment wurde nicht aktiv geprobt — der Fix ist Code-only; der Planner
sollte einen Task "Tests gruen" einplanen, der Browser-Install bei Bedarf
abdeckt.

## Project Constraints (from CLAUDE.md)
- **Browser-App: Vanilla JavaScript, ESM, kein Build-Schritt.** `sankey-drill.js`
  bleibt eine reine ESM-Datei ohne Build.
- **Sprache: Deutsch in UI-Texten und Code-Bezeichnern.** Neue
  Variablen/Kommentare/Test-Namen auf Deutsch (`quelleGedrillt`,
  `gruppeGedrillt`).
- **Keine Werkzeug-Attribution** in Commits/Code/Kommentaren.
- **Kein Vendoring, kein Offline.** Nicht relevant — keine neue Abhaengigkeit.
- **Tests muessen gruen bleiben:** `npm run test:js`, e2e (Playwright). Python-
  Checks (`pytest`, `ruff`, `mypy`) sind von dieser reinen JS-Aenderung nicht
  betroffen, sollten aber unberuehrt gruen bleiben.
- **Deployment:** GitHub Pages bei jedem `main`-Push — keine Aktion noetig.

## Sources
### HIGH confidence
- Codebase-Analyse: `web/js/sankey-drill.js` (vollstaendig gelesen),
  `web/vendor/dashboard/dashboard.js` (Zeilen 430-518), `tests/js/run.mjs`
  (Zeilen 1-40, 240-435), `tests/e2e/sankey.spec.mjs` (vollstaendig).
- `package.json` Scripts; `git log` fuer `sankey-drill.js`.
- ISSUE.md + CONTEXT.md des Issues; `/workspace/CLAUDE.md`.

### MEDIUM confidence
- e2e-Erwartung `knotenzahl < vorher` bleibt gueltig — logisch hergeleitet, aber
  abhaengig von den konkreten Fixture-Betraegen; vom Planner als
  "Test-Lauf bestaetigen" zu behandeln.

### LOW confidence (needs validation)
- Keine.

## Metadata
**Confidence breakdown:**
- Codebase: HIGH — alle relevanten Dateien direkt gelesen, Zeilennummern exakt.
- Loesungsansatz: HIGH — durch CONTEXT.md gelockt und durch Code bestaetigt.
- Test-Impact: HIGH fuer die zwei roten Assertions; MEDIUM fuer e2e (Lauf
  bestaetigt es).
**Research date:** 2026-05-22
**Sub-agents used:** keine — Single-File-Bugfix, direkte Recherche durch den
Orchestrator.
**Raw research files:** keine (Single-File-Scope).
