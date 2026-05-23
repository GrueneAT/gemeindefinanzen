---
id: vc8nm
title: Varianten-Auswahl bereinigen — Sieger pro Paar behalten
status: open
priority: medium
labels:
- dashboard
- auswertung
- cleanup
- follow-up
---

## Kontext

Issue **a7x2n** (PR #6, gemergt) hat sieben Diagramm-Vorschlaege aus dem
externen Auswertungs-Review (Claude Opus 4.7 + Codex gpt-5) **jeweils in
zwei Varianten** umgesetzt, die nebeneinander gerendert werden — explizit
fuer einen Online-Review durch den User. Beide Varianten tragen sichtbare
Labels „Variante A" / „Variante B".

Sobald der User pro Paar einen Sieger ausgewaehlt hat, wird die jeweils
andere Variante entfernt: Markup, Builder, Datenaufbereitung, Tests und
DOM-Wiring.

Live deployt: https://grueneat.github.io/gemeindefinanzen/

## Variantenpaare zur Auswahl

| Ref | Bereich | Variante A | Variante B |
| --- | --- | --- | --- |
| R2 | Schulden & Finanzierung — Layout | drei Panels (Aufnahme/Tilgung-Saeulen + Schuldenstand-Linie) — `#c_fin_saeulen`, `#c_schuldenstand` | Combo-Diagramm mit zwei y-Achsen — `#c_fin_combo` |
| R3 | Soll-Ist-Abweichung (RA) | Diverging-Balken — `#c_sollist_a` | Dumbbell — `#c_sollist_b` |
| R4 | Budgetierungspolster (VA) | Doppelbalken — `#c_polster_a` | Diverging — `#c_polster_b` |
| R5 | Einwohnerzahl-Eingabe | Inline-Input je Tabellenzeile | Edit-Button + `<dialog>` |
| R8 | „Wofuer geht 1 Euro?" | 100-%-Stapel — `#c_eineuro_*_a` | 10×10-Piktogramm-Pie — `#c_eineuro_*_b` |
| R9 | Gebunden vs. gestaltbar | 100-%-Stapel — `#c_bindung_a` | Saeulen je Aufwandsart — `#c_bindung_b` |
| R12 | Investitions-Finanzierung | gestapelter Saeulenbalken — `#c_investfin_a` | Mini-Sankey — `#c_investfin_b` |

## Vorgehen

Pro Sieger:

1. Den jeweils anderen Chart-Container aus `web/index.html` entfernen
   (inklusive Panel-Wrapper und „Variante X"-Label).
2. Den dazugehoerigen Builder aus `web/js/dashboard-charts.js` /
   `web/js/sankey-drill.js` entfernen.
3. Etwaige Datenfelder in `web/js/dashboard-data.js`, die ausschliesslich
   der unterlegenen Variante dienten, entfernen.
4. Die `registerChart()`-Eintraege und CFG-Verweise in
   `web/vendor/dashboard/dashboard.js` entfernen.
5. Bei R5 die nicht gewaehlte UI in `web/js/app.js` und das zugehoerige
   Markup in `index.html` entfernen.
6. Sobald nur noch eine Variante uebrig ist, das „Variante A"/„Variante B"-
   Label durch einen normalen Diagramm-Titel ersetzen — die Komponenten-
   Konvention `.web-panel__head` mit `<h3>` und ggf. `.web-panel__note`
   nutzen.
7. e2e- und JS-Tests anpassen, die die entfernten `#id`s pruefen.

## Quellen

- Reviews: `.issues/grafische-auswertungen-gemeindebudget-verstaendlichkeit/reviews/`
- Eltern-Issue: `.issues/auswertungen-erweitern-gemeindebudget/`
- PLAN.md des Eltern-Issues fuer die genauen Builder-Stellen.

## Akzeptanzkriterien

- [ ] Fuer jedes der sieben Variantenpaare ist genau eine Variante uebrig.
- [ ] Keine `#id`/Builder/Datenfelder der entfernten Varianten verbleiben
      im Code (`grep -r 'Variante A\|Variante B' web/` leer).
- [ ] Die verbliebenen Charts tragen normale Titel, keine A/B-Labels mehr.
- [ ] Tests gruen: `npm run test:js`, e2e (Playwright), `pytest`, `ruff`,
      `mypy`.
- [ ] Deploy laeuft sauber durch.
