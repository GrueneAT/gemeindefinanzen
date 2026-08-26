---
id: s290j
title: 'Beta-Status prominent zeigen: Ueberschrift und grosser Hinweis beim Oeffnen'
status: done
priority: medium
---

Der Beta-Stand steht heute nur als kleiner Satz unter dem Hero
(`web/index.html:75`, `.app-beta-hinweis`) plus ein kleiner BETA-Stoerer am
Logo (`web/index.html:37`). Rueckmeldung aus dem Anwenderfeedback: das ist zu leicht
zu ueberlesen — der Beta-Stand soll gleich in der Ueberschrift stehen und beim
Oeffnen des Werkzeugs noch einmal gross erscheinen.

## Was zu tun ist

1. **Ueberschrift.** Die H1 „Gemeindebudget auswerten" trraegt den Beta-Stand
   sichtbar mit (z. B. „Gemeindebudget auswerten — Beta" oder ein grosses
   Beta-Label direkt neben der H1, nicht nur der kleine Stoerer am Logo).
2. **Beim Oeffnen gross.** Oberhalb der Dokumentverwaltung ein deutlicher
   Beta-Hinweis (DS-Callout, `gat-callout --warn` o. ae.) statt des kleinen
   Fliesstext-Absatzes: was Beta hier heisst (Ergebnisse pruefen, Parser kann
   irren) und wohin Rueckmeldungen gehen (florian.motlik@gruene.at).
3. Der bisherige kleine `.app-beta-hinweis`-Absatz geht darin auf — nicht
   zusaetzlich stehen lassen.
4. Kein Blocker-Dialog, der weggeklickt werden muss — der Hinweis steht
   sichtbar auf der Seite und bleibt beim Arbeiten sichtbar bzw. wandert nicht
   aus dem Blick, bevor man ihn gelesen hat.

Gegenstueck im Verzeichnis: siehe Issue im Repo `werkzeuge`
(`status: beta` beim Eintrag Gemeindefinanzen).

## Akzeptanzkriterien

- [ ] Der Beta-Stand ist in der H1 bzw. unmittelbar daneben sichtbar
- [ ] Beim Oeffnen der Seite ist ein grosser, nicht zu uebersehender
      Beta-Hinweis sichtbar, inklusive Kontakt fuer Rueckmeldungen
- [ ] Der alte kleine Beta-Satz existiert nicht mehr doppelt
- [ ] Hinweis funktioniert in beiden Farbmodi und im Print-Stylesheet sinnvoll
      (im Druck-Report darf er nicht stoeren, aber auch nicht luegen)
- [ ] Playwright-Tests laufen durch

## Constraints

- DS-Callout statt Eigenbau; kein Vendoring
- Conventional Commit, keine Werkzeug-Attribution
