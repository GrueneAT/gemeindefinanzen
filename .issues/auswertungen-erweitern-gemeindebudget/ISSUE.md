---
id: a7x2n
title: Auswertungen erweitern — Gemeindebudget verstaendlicher machen
status: done
priority: high
labels:
- dashboard
- auswertung
- visualisierung
- ux
---

## Kontext

Externes Topic-Review (Claude Opus 4.7 + Codex gpt-5) der grafischen
Auswertungen der Browser-App. Die Konsens-Korrekturen an bestehenden
Diagrammen wurden bereits umgesetzt (Issue ye9ih, Iteration 17). Dieses
Issue buendelt die **groesseren, von beiden Reviewern als sinnvoll
bewerteten Erweiterungen** — neue Diagramme/Tabs, die neue Verdrahtung im
Dashboard-Controller (`web/vendor/dashboard/dashboard.js`) erfordern und
daher den Rahmen eines Same-Day-Deploys gesprengt haetten.

Die vollstaendigen Reviews liegen unter
`.issues/grafische-auswertungen-gemeindebudget-verstaendlichkeit/reviews/`
(im Branch `issue/ye9ih-...`).

## Ziel

Das Gemeindebudget fuer kommunalpolitische Laien und aeltere Nutzer:innen
besser verstaendlich machen — mehr Einordnung, die zentralen Laien-Fragen
beantworten, das vorhandene Datenpotenzial nutzen.

## Umfang (Konsens-Ideen aus dem Review)

- **Vorjahres-/Ist-Vergleich an den Kennzahlen-Karten.** Delta gegenueber
  `spalte_vergleich` mit Auf/Ab-Pfeil. Felder `eh_vergleich`/`eh_dritte`
  liegen je Posten vor, werden aber kaum genutzt.
- **Pro-Kopf-Werte.** Optionales Einwohnerzahl-Feld in der Dokument-
  verwaltung; Pro-Kopf-Zeile auf den Kennzahlen-Karten und „je
  Einwohner:in"-Umschaltung — Standard jeder Buergerhaushalt-Darstellung.
- **Tab „Schulden & Finanzierung".** Darlehensaufnahme vs. Tilgung,
  fortgeschriebener Schuldenstand, Schuldendienst. Datenmodell kennt
  `gebarung='finanzierung'`, bisher in keiner Auswertung genutzt.
- **Soll-Ist-Abweichung & Budgetierungspolster sichtbar machen.**
  `web/sql/14-soll-ist-abweichung.sql` und `web/sql/08-budgetierungspolster.sql`
  sind berechnet, aber in keinem Diagramm — Diverging-Bar bzw.
  Dumbbell/Lollipop.
- **Aufgabenbereiche als sortierte Balken** statt nur Treemap (Laengen
  schlagen Flaechen fuer den Vergleich); Treemap als sekundaere Detailsicht.
- **Saldo je Aufgabenbereich** als zweiseitiges Balkendiagramm
  (Zuschuss- vs. Ueberschussbereiche) — `web/sql/02-gruppen-uebersicht.sql`
  liefert Einnahmen/Ausgaben/Saldo je Gruppe, ungenutzt.
- **„Wofuer geht 1 Euro?"** — laientauglicher 100-%-Balken / Piktogramm der
  Aufwandsaufteilung, ganz oben im Ueberblick.
- **„Gebunden vs. gestaltbar"** — Anteil kurzfristig kaum beweglicher
  Ausgaben (Personal, Pflichtumlagen, Finanzaufwand) sichtbar machen.
- **Sankey bilanziell ehrlich** — Ueberschuss/Abgang als eigener
  Abschlussknoten; oder konsequent auf `fh_wert` (Finanzierungshaushalt).
- **Informationsarchitektur** entlang von Erkenntnisfragen ordnen
  (Lagebild -> Woher -> Wofuer -> Was ist gebunden -> Was aendert sich ->
  Spielraeume/Risiken -> Rohdaten).

## Abgrenzung

- Erfordert Aenderungen an `web/vendor/dashboard/dashboard.js` (erstpartei-
  licher Dashboard-Controller, kein vendorisiertes Drittprodukt) — die
  bisherige Selbstbeschraenkung „nicht anfassen" galt nur fuer den reinen
  CSS-Rebuild und entfaellt fuer diese Feature-Arbeit.
- Pro-Kopf braucht eine neue, optionale Dateneingabe (Einwohnerzahl).

## Akzeptanzkriterien

- [ ] Kennzahlen tragen einen sichtbaren Vergleich (Vorjahr/Ist).
- [ ] Pro-Kopf-Werte verfuegbar, sobald die Einwohnerzahl erfasst ist.
- [ ] Schulden/Finanzierung sind grafisch dargestellt.
- [ ] Soll-Ist-Abweichung und Budgetierungspolster haben je ein Diagramm.
- [ ] Aufgabenbereiche sind als sortierte Balken vergleichbar.
- [ ] Tests bleiben gruen: `npm run test:js`, e2e, `pytest`, `ruff`, `mypy`.
