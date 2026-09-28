---
id: n8vmb
title: 'Vergleich aus einem Dokument: die abgedruckte Vergleichsspalte als Basis'
status: done
priority: high
labels:
- web-app
- vergleich
---

Der Vergleichs-Tab (Issue lsx7v, PR #36) verlangt **zwei** geladene
Dokumente. Beim haeufigsten Fall ist das eines zu viel: ein
Nachtragsvoranschlag traegt den vollstaendigen Diff bereits selbst.

Seine drei Betragsspalten je Haushaltsstelle sind `VA 2026 inkl. NVA` |
`VA 2026` | `1. NVA`. Nachgerechnet am Herzogenburger NVA 2026: Spalte 3 =
Spalte 1 minus Spalte 2 auf allen 1114 Detailposten, **0 Abweichungen**. Wer
nur den Nachtrag laedt, sieht heute trotzdem gar keinen Vergleich — der Tab
blendet sich aus (`vergleich.js`: `const mehrere = docs.length >= 2`, der
Tab-Knopf wird `hidden`).

Die dokumentinterne Spalte ist ausserdem die **verlaesslichere** Quelle: sie
ist per Definition die Fassung, gegen die der Nachtrag rechnet. Der
Fassungsfehler, den die Selbstkontrolle beim Herzogenburger
`VA-2026-Auflage.pdf` findet (Community Nurse, 200.600 EUR), entsteht
ueberhaupt nur dadurch, dass ein zweites, aelteres Dokument als Basis
danebengelegt wird.

Zwei Dokumente bleiben noetig fuer alles, was kein Dokument abdruckt: VA 2025
gegen VA 2026, RA 2024 gegen RA 2025, NVA 2025 gegen NVA 2026, Vergleiche
ueber mehr als eine Stufe, den Quellenabgleich PDF gegen OH-CSV — und fuer
die Selbstkontrolle selbst, die beide Seiten braucht.

## Was zu tun ist

Die Engine sammelt die Vergleichsspalte je Haushaltsstelle **bereits**
(`aggregiereDokument` in `web/js/vergleich-daten.js` fuellt `wert` und
`vergleich`, gebraucht fuer `kontrolle()`). Der Modus ist deshalb kein neuer
Rechenweg, sondern eine zweite Herkunft fuer die Basis-Seite.

1. **Dokumentinterne Basis.** `baueDiff` akzeptiert als Basis das
   Vergleichsdokument selbst — die Basis-Werte kommen dann aus dessen Feld
   `vergleich` statt aus einem zweiten Dokument. Alle fuenf Sichten, Filter,
   Sortierung, Tabelle und CSV-Export bleiben unveraendert.

2. **Auswahl.** Traegt das Vergleichsdokument eine Vergleichsspalte (jeder
   VA, NVA und RA tut das), steht sie in der Basis-Auswahl als eigener
   Eintrag, benannt nach `spalte_vergleich` mit Herkunftshinweis — etwa
   „VA 2026 — laut NVA-Dokument".

3. **Vorbelegung: die interne Spalte gewinnt**, auch wenn das passende zweite
   Dokument geladen ist. Sie ist die verlaesslichere Quelle. Die
   Selbstkontrolle laeuft dann nicht mehr automatisch mit; im Kontroll-Panel
   steht stattdessen ein Hinweis, dass ein geladenes Basisdokument sie
   ausloest, samt Angabe, welches Dokument dafuer passt und ob es schon
   geladen ist.

4. **Sichtbarkeit.** Der Tab erscheint ab **einem** Dokument, sobald dieses
   eine Vergleichsspalte traegt. Der Leer-Hinweis gilt nur noch, wenn wirklich
   nichts zu vergleichen ist.

5. **Beschriftung.** Kopfzeile, Tabellenkoepfe und CSV-Dateiname muessen die
   Herkunft der Basis erkennbar machen — „laut NVA-Dokument" gegenueber einem
   separat geladenen „VA 2026" ist der entscheidende Unterschied, wenn die
   Zahlen einmal auseinandergehen.

## Akzeptanzkriterien

- [ ] Mit **nur** dem NVA 2026 geladen zeigt der Vergleichs-Tab den
      vollstaendigen Diff gegen dessen eigene Spalte „VA 2026"
- [ ] Die Ergebnisse stimmen mit der abgedruckten Spalte „1. NVA" ueberein —
      Zeile fuer Zeile, nicht nur in der Summe
- [ ] Die Kennzahlen entsprechen den Summenzeilen der Anlage 1a
      (Ertraege +790.300, Aufwendungen +502.200, Nettoergebnis +288.100)
- [ ] Die interne Spalte ist die Vorbelegung, auch wenn der VA 2026 geladen
      ist; das geladene Dokument bleibt waehlbar
- [ ] Wird das geladene Dokument als Basis gewaehlt, laeuft die
      Selbstkontrolle wie bisher und findet die Community-Nurse-Differenz
- [ ] Ist die interne Spalte die Basis, erklaert das Kontroll-Panel, wodurch
      die Kontrolle ausgeloest wird
- [ ] Kopfzeile, Tabellenkoepfe und CSV-Name benennen die Herkunft der Basis
- [ ] Der Tab ist ab einem Dokument mit Vergleichsspalte sichtbar
- [ ] Ein RA als Vergleichsdokument funktioniert ebenso (Spalte 2 = Soll)
- [ ] Bestehende Zwei-Dokumente-Vergleiche unveraendert; alle Tests gruen
      (js, e2e, Python)

## Constraints

- Kein Vendoring; ECharts und Design-System weiter per CDN
- Vanilla JS, ESM, kein Build-Schritt fuer die ausgelieferte Seite
- Deutsch in UI-Texten und Code-Bezeichnern
- Keine zweite Rechenlogik — der bestehende Diff bekommt eine zweite
  Herkunft fuer die Basis, keinen Parallelpfad
- Conventional Commit, keine Werkzeug-Attribution
