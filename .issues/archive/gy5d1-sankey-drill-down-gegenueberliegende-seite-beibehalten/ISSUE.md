---
id: gy5d1
title: 'Sankey-Drill-down: gegenueberliegende Seite beibehalten'
status: done
ship_state: merged
priority: high
labels:
- sankey
- dashboard
- ux
- bug
---

## Problem

Der Sankey-Drill-down (zuletzt geaendert in PR #3, Commit `0bc9bf0`) blendet
beim Aufklappen eines Knotens die **gesamte gegenueberliegende Seite** aus.
Klickt man rechts eine Aufgabengruppe an, verschwindet die komplette
Einnahmeseite links. Das ist nicht gewollt.

Folge: Es ist nicht mehr ersichtlich, welchen Anteil der aufgeklappte Bereich
am **gesamten Haushalt** hat — genau diese Einordnung soll der Sankey aber
zeigen.

## Gewuenschtes Verhalten

Der Sankey bleibt strukturell gleich (drei Ebenen:
Einnahmequellen -> "Gemeindehaushalt" -> Aufgabengruppen). Beim Drill-down auf
einen Knoten:

- **Nur die uebrigen Knoten DERSELBEN Seite werden ausgeblendet** — nicht die
  Gegenseite.
- Der angeklickte Knoten wird in seine Unterelemente aufgeklappt.
- Die **gegenueberliegende Seite bleibt unveraendert** in ihrer
  Uebersichtsform bestehen, damit der Anteil am Gesamthaushalt sichtbar bleibt.

**Beispiel:** Klick auf "Dienstleistungen" rechts (Ausgabeseite)
- Die anderen Aufgabengruppen (Unterricht, Gesundheit, ...) verschwinden.
- Die Unterelemente von "Dienstleistungen" werden sichtbar.
- Die **Einnahmeseite links bleibt voellig unveraendert.**

Symmetrisch fuer die Einnahmeseite: Klick auf eine Einnahmequelle links blendet
die anderen Quellen aus und klappt die gewaehlte auf — die **Ausgabeseite
rechts bleibt unveraendert** in der Uebersicht bestehen.

## Abgrenzung zum aktuellen Stand

| | aktuell (PR #3) | gewuenscht |
| --- | --- | --- |
| andere Knoten derselben Seite | ausgeblendet | ausgeblendet (korrekt) |
| gegenueberliegende Seite | ausgeblendet | **bleibt in Uebersichtsform** |

Das "andere Knoten derselben Seite ausblenden" aus PR #3 bleibt also richtig —
nur das Ausblenden der Gegenseite muss zurueckgenommen werden.

## Betroffene Stellen (Orientierung)

- `web/js/sankey-drill.js` — `buildSankeyOption`: die Bedingungen
  `if (!expand || expand.seite === "quelle")` bzw. `=== "gruppe"` umkehren, so
  dass die Gegenseite im Drill-down weiterhin in Uebersichtsform gerendert wird.
- `tests/js/run.mjs` — die Sankey-Drill-down-Tests entsprechend anpassen.
- `tests/e2e/sankey.spec.mjs` — e2e-Erwartung anpassen.

## Akzeptanzkriterien

- [ ] Drill-down auf eine Aufgabengruppe blendet nur die anderen Gruppen aus;
      die Einnahmeseite bleibt unveraendert in Uebersichtsform sichtbar.
- [ ] Drill-down auf eine Einnahmequelle blendet nur die anderen Quellen aus;
      die Ausgabeseite bleibt unveraendert in Uebersichtsform sichtbar.
- [ ] Der aufgeklappte Knoten zeigt seine Unterelemente; die Betragstreue
      bleibt erhalten (Summe der Kinder == Betrag des Knotens).
- [ ] Die Uebersicht (kein Drill-down) bleibt unveraendert.
- [ ] Der "Uebersicht"-Reset funktioniert weiterhin.
- [ ] Tests gruen: `npm run test:js`, e2e (Playwright).
