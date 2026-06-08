---
id: uecaf
title: Vergleich mehrerer Gemeinden im Dashboard
status: open
priority: low
labels:
- web
- dashboard
- vergleich
- folge-issue
---

## Kontext

Folge-Issue zu **„Dokumente direkt von Offener Haushalt importieren"**
(`h3ukx-dokumente-direkt-von-offener-haushalt-importieren`). Sobald sich
Dokumente vieler Gemeinden bequem direkt importieren lassen, wird der
**Vergleich mehrerer Gemeinden** interessant — Benchmarking statt nur
Einzelanalyse.

> Abhaengigkeit: baut auf dem Direkt-Import auf. Technisch ginge ein erster
> Schritt auch mit manuellem Mehr-Gemeinden-CSV-Upload, der eigentliche Nutzen
> entsteht aber erst mit dem komfortablen Import.

## Ist-Stand (warum heute noch nicht direkt machbar)

Das Datenmodell (`web/schema.sql`) modelliert zwar **mehrere Dokumente** ueber
Jahre, aber implizit **eine Gemeinde**:

- Die 15 Auswertungs-SQLs unter `sql/` (und ihre Spiegelungen in der App)
  waehlen typischerweise `WHERE typ='VA' ORDER BY finanzjahr DESC LIMIT 1` —
  also **ein** Dokument **einer** Gemeinde. Es gibt kein `GROUP BY gemeinde`.
- `dokument.gemeinde` ist ein Freitext; eine stabile **Gemeindekennziffer
  (GKZ)** als Schluessel fehlt.
- Das Dashboard hat einen Dokument-Umschalter fuer den **Jahresvergleich
  einer** Gemeinde, aber kein Konzept fuer mehrere Gemeinden nebeneinander.

## Ziel

Kennzahlen **ueber mehrere Gemeinden hinweg** vergleichen, z. B.:

- Kommunalsteuer **pro Kopf**, Abhaengigkeit von einzelnen Einnahmequellen,
- Aufwandsstruktur (Personal/Sach/Transfer/Finanz) im Vergleich,
- Verschuldung/Investitionen pro Kopf, Nettoergebnis,
- Soll-Ist-Treue (VA vs. RA) als Qualitaetsindikator.

## Machbarkeits-Skizze (Vorueberlegung, kein finaler Plan)

VRV 2015 ist ein **bundesweit einheitliches Format** — gleicher Kontenrahmen,
gleiche Ansatz-/MVAG-Gliederung. Damit ist die fachliche Vergleichbarkeit
zwischen Gemeinden von Haus aus hoch; der Aufwand liegt im Datenmodell und der
UI, nicht in der Semantik. Moegliche Phasen:

1. **Datenmodell Gemeinde-faehig machen:** GKZ als erstklassiger Schluessel
   (aus der OH-CSV-Spalte „Gemeindekennziffer" bereits vorhanden), mehrere
   Gemeinden koexistieren sauber; `einwohner` (Spalte existiert schon)
   konsequent fuer Pro-Kopf-Sichten nutzen.
2. **Gemeinde-Auswahl/Kontext:** UI-Selektor, der den „aktuellen" Gemeinde-
   kontext steuert; bestehende Single-Gemeinde-Auswertungen darauf umstellen,
   ohne sie zu brechen.
3. **Vergleichs-Views:** neue SQL-Sichten mit `GROUP BY gemeinde` plus Pro-
   Kopf-Normalisierung (faire Groessenbereinigung) und sauberer Trennung
   VA/NVA vs. RA.
4. **Vergleichs-UI:** eigener Tab „Gemeindevergleich": 2..n Gemeinden + eine
   Kennzahl auswaehlen → Balken-/Linien-Diagramme (ECharts, wie bestehend) und
   Benchmark-Tabellen (pro Kopf).

**Knackpunkte:** unterschiedliche verfuegbare Jahre je Gemeinde; VA/RA nicht
vermischen; Datenmenge/Performance in sqlite-wasm bei vielen Gemeinden;
Gemeindeidentitaet ueber GKZ statt Freitext; faire Normalisierung (pro Kopf,
ggf. Groessenklassen).

## Scope (Design-Stadium)

- Noch kein endgueltiger Implementierungsplan — dieses Issue haelt Idee,
  Abhaengigkeit und Machbarkeit fest. Konkrete Akzeptanzkriterien entstehen in
  der Research-/Plan-Phase, sobald der Direkt-Import steht.

## Akzeptanzkriterien (vorlaeufig)

- [ ] Research klaert das Gemeinde-faehige Datenmodell (GKZ-Schluessel,
      Koexistenz mehrerer Gemeinden) und den Umbau der Single-Gemeinde-SQLs.
- [ ] Mindestens eine Kennzahl laesst sich pro Kopf ueber mehrere Gemeinden
      vergleichen (Diagramm + Tabelle).
- [ ] VA/NVA und RA werden im Vergleich nicht vermischt.
- [ ] Bestehende Einzel-Gemeinde-Auswertungen bleiben funktionsfaehig.
- [ ] Strikt statisch, kein Vendoring neuer Abhaengigkeiten.

## Abhaengigkeit

- Setzt `h3ukx-dokumente-direkt-von-offener-haushalt-importieren` voraus
  (komfortable Mehr-Gemeinden-Datenbeschaffung).
