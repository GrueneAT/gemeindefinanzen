# CONTEXT — gy5d1 Sankey-Drill-down: gegenueberliegende Seite beibehalten

## Ausgangslage

PR #3 (`0bc9bf0`) hat den Sankey-Drill-down so geaendert, dass beim Aufklappen
eines Knotens nur noch der gewaehlte Zweig sichtbar bleibt. Nebenwirkung: die
**gesamte gegenueberliegende Seite** verschwindet, weil `buildSankeyOption` in
`web/js/sankey-drill.js` den ganzen Seitenblock per
`if (!expand || expand.seite === "quelle"|"gruppe")` ueberspringt.

Gewuenscht: nur die *anderen Knoten derselben Seite* ausblenden; die Gegenseite
bleibt in ihrer Uebersichtsform stehen, damit der Anteil am Gesamthaushalt
ablesbar bleibt.

## Geklaerte Entscheidungen

### 1. Gegenseite bleibt waehrend des Drill-downs voll interaktiv

Die Knoten der Gegenseite behalten `drillExpandbar: true`. Ein Klick darauf
startet ueber den bestehenden Handler `drillAufKnoten` in
`web/vendor/dashboard/dashboard.js` einen **neuen Drill-down auf dieser Seite**
und ersetzt den bisherigen (`sankeyExpand = { seite, key }`). Das ist
symmetrisch, entspricht dem "voellig unveraendert" der Anforderung und
**erfordert keine Handler-Aenderung** — der Handler ersetzt eine bestehende
Ausklappung bereits.

## Loesungsskizze

In `buildSankeyOption` muss jede der beiden Seiten in **drei** statt zwei
Zustaenden gerendert werden:

- **Diese Seite, kein Drill-down aktiv** (`!expand`): Uebersicht — jeder Knoten
  eingeklappt + aufklappbar. (unveraendert)
- **Diese Seite ist die gedrillte Seite** (`expand.seite === <dieseSeite>`):
  gewaehlten Knoten aufklappen, uebrige Knoten *dieser* Seite ausblenden.
  (unveraendert gegenueber PR #3)
- **Diese Seite ist die Gegenseite** (`expand` gesetzt, aber
  `expand.seite !== <dieseSeite>`): **neu** — Uebersichtsform rendern, exakt
  wie im `!expand`-Fall.

Konkret: die aeusseren `if (!expand || expand.seite === ...)`-Guards entfallen
(beide Seiten werden immer durchlaufen). Die innere `else if (!expand)`-Bedingung
fuer die Uebersichtsform wird zu "Uebersicht rendern, wenn diese Seite **nicht**
die gedrillte Seite ist".

## Betroffene Dateien

- `web/js/sankey-drill.js` — `buildSankeyOption`: Guards/innere Bedingungen.
- `tests/js/run.mjs` — Drill-down-Tests: erwarten jetzt zusaetzlich die
  Gegenseite in Uebersichtsform.
- `tests/e2e/sankey.spec.mjs` — e2e-Erwartung anpassen.

## Nicht im Scope

- Keine Aenderung an `drillAufKnoten` / dem Klick-Handler in `dashboard.js`.
- Keine Aenderung der Uebersicht (kein Drill-down) und des "Uebersicht"-Resets.
- Keine Aenderung an Kapp-Logik (`TOP_N`, `kappen`) oder Aggregation.

## Akzeptanzkriterien (aus ISSUE.md)

- Drill-down auf Aufgabengruppe: nur andere Gruppen weg, Einnahmeseite bleibt
  in Uebersichtsform.
- Drill-down auf Einnahmequelle: nur andere Quellen weg, Ausgabeseite bleibt
  in Uebersichtsform.
- Aufgeklappter Knoten zeigt Unterelemente; Betragstreue erhalten.
- Uebersicht und "Uebersicht"-Reset unveraendert.
- Tests gruen: `npm run test:js`, e2e (Playwright).
