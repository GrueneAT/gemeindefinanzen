# Rohbefunde — ECOSYSTEM

## Ergebnis in einem Satz

**Keine neue Abhaengigkeit, keine externe Recherche noetig.** Der Modus ist
eine zweite Herkunft fuer die Basis-Seite einer bereits vorhandenen, rein
rechnenden Funktion plus ein Select-Eintrag. Bibliotheksfragen stellen sich
nicht.

## Bestehender Stack (unveraendert)

| Baustein | Bezug | Version | Ort |
|---|---|---|---|
| ECharts | CDN jsDelivr | 5.5.1 | `web/index.html:22` |
| Design-System CSS | CDN GH Pages | — | `web/index.html:21` |
| `@sqlite.org/sqlite-wasm` | npm (nur Tests/Runtime der App) | ^3.50.1-build1 | `package.json` |
| `mupdf` | npm | ^1.26.0 | `package.json` |
| `@playwright/test` | npm devDep | ^1.60.0 | `package.json` |

Die App ist Vanilla-ESM ohne Build-Schritt (CLAUDE.md). Ein neues Modul ist
nicht noetig: `vergleich-daten.js` und `vergleich.js` reichen.

## Nicht selbst bauen

| Problem | Nicht bauen | Stattdessen | Warum |
|---|---|---|---|
| Basis-Werte je Haushaltsstelle | zweite Aggregation | `aggregiereDokument()` (`vergleich-daten.js:55`) — sammelt `wert` **und** `vergleich` in einem Durchlauf | Genau dafuer wurde `vergleich` eingesammelt (`kontrolle()`) |
| Diff-Zeilen, Status, Prozent | zweiter Rechenweg | den bestehenden Block `vergleich-daten.js:123-160` | Issue-Constraint „keine zweite Rechenlogik" |
| Kennzahlen / Gruppen / Treemap / Wasserfall | neue Aggregatoren | `eckwerte` 186, `gruppenDelta` 227, `treemapDelta` 245, `wasserfall` 277 — alle lesen nur `zeilen` | Sie sind gegen die Zeilenform geschrieben, nicht gegen Dokumente |
| Spaltenbedeutung / Jahr / Typ | Strings aus dem PDF neu lesen | `dokument.spalte_vergleich`, `.typ`, `.jahr` aus `DATA.dokumente` (`dashboard-data.js:80-94`), erzeugt von `spalten()` (`loader.js:13-24`) | Einmalige Wahrheit, beim Import persistiert |
| CSV-Export | neuer Serialisierer | `alsCsv(zeilen, labelA, labelB)` (`vergleich-daten.js:431`) — nimmt die Labels schon als Parameter | Signatur ist bereits label-agnostisch |
| Wasserfall-Beschriftung | neue Chart-Funktion | `chartDiffWasserfall(diff, labelA, labelB)` (`dashboard-charts.js:1443`) | Nimmt Labels schon als Parameter; `chartDiffGruppen`/`chartDiffTreemap` brauchen keine |
| Sentinel-Kollision vermeiden | UUID / Praefix-Schema | ein fester nicht-numerischer String; `dokument_id` ist `INTEGER PRIMARY KEY` (`web/schema.sql:19`) | Kollision ist strukturell ausgeschlossen |

## Anti-Muster fuer diesen Issue

- **Ein zweites `baueDiffIntern()`.** Verstoesst direkt gegen den
  Issue-Constraint und verdoppelt fuenf Aggregatoren.
- **Ein neues `modus`-Feld neben `a`/`b`.** Zwei Felder, die denselben Zustand
  beschreiben, koennen auseinanderlaufen (`modus: "intern"` bei gesetztem
  `a`). Der Sentinel *in* `a` hat genau einen Zustand.
- **Typbasiertes Gating** („jeder VA/NVA/RA hat eine Spalte 2"). Empirisch
  falsch fuer OH-CSV — siehe `pitfalls.md`, Beleg 6.
- **`spalte_vergleich` als Existenznachweis.** Der Name wird immer geschrieben,
  auch wenn keine Daten dahinterliegen (`loader.js:31`).
- **`kontrolle()` im internen Modus laufen lassen.** Tautologie, siehe
  `pitfalls.md`, F1.

## Sprachliche Konventionen im Bestand

Bezeichner sind deutsch: `zustand`, `fuelleAuswahl`, `rechneUndZeichne`,
`zeichneKopf`, `baueDiff`, `aggregiereDokument`, `eckwerte`, `wasserfall`,
`kontrolle`, `filtereZeilen`, `alsCsv`, `hatVergleichsspalte` (neu, passt).
Tests sprechen deutsch (`pruefe("...")`). Kommentare erklaeren **warum**, nicht
was — dieser Stil ist im Bestand durchgehend und soll gehalten werden.
