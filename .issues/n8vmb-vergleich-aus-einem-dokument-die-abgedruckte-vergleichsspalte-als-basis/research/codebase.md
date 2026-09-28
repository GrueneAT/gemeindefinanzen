# Rohbefunde — CODEBASE

Alle Zeilenangaben gegen den Worktree-Stand (PR #36, Commit d3b0511).

## Relevante Dateien

| Datei | LOC | Rolle | Letzte Aenderung |
|---|---|---|---|
| `web/js/vergleich-daten.js` | 476 | Diff-Engine, rein rechnend | d3b0511 (PR #36) |
| `web/js/vergleich.js` | 592 | Oberflaeche Vergleichs-Tab | d3b0511 (PR #36) |
| `web/js/dashboard-charts.js` | 1652 | `chartDiff*` ab Zeile 1443 | d3b0511 |
| `web/js/dashboard-data.js` | 706 | `dokumente()` 74, `standardVergleich()` 659, `collect()` 671 | d3b0511 |
| `web/js/loader.js` | 92 | `spalten()` 13-24, `dokumentDatensatz()` 27-43 | aelter |
| `web/js/csv-parser.js` | 492 | OH-CSV, `HEADER` 31-47, `parseCsvBytes` 236-322 | aelter |
| `web/index.html` | — | Panel `data-panel="vergleich"` 363-521 | d3b0511 |
| `tests/js/run.mjs` | 1374 | Vergleichs-Tests 1104-1327 | d3b0511 |
| `tests/e2e/vergleich.spec.mjs` | 168 | Browser-Tests | d3b0511 |
| `docs/BROWSER-APP.md` | — | Abschnitt 87-121 | d3b0511 |

## Aufrufkette

`app.js` -> `dashboard-app.js:baueDashboard()` (Zeile 22) -> `collect(db)` (23)
-> `baueVergleich(daten)` (39). Kein anderer Aufrufer von `baueVergleich`.
Der Vergleichs-Tab haengt **nicht** am globalen Dokument-Umschalter
(`vergleich.js:12-15`).

`dashboard.js` ist klassisches Skript (nachgeladen, `dashboard-app.js:105-108`)
und beruehrt den Vergleichs-Tab nur ueber `activateTab()` (`dashboard.js:94`)
und den Klick-Delegator (`dashboard.js:811-814`). Ein `hidden`-Knopf wird von
`activateTab` nicht wieder sichtbar gemacht — `vergleich.js` ist Alleinbesitzer
der Sichtbarkeit.

## Datenfelder

`DATA.posten` je Eintrag (`dashboard-data.js:140-152`):
`dok, typ, jahr, richtung, gebarung, gruppe, gruppe_text, ansatz, ansatz_text,
konto, konto_text, bezeichnung, mvag, qu, ew, ev, ed, fw, fv, fd`
— `ev`/`fv` = Spalte 2 (Vergleich), `ed`/`fd` = Spalte 3.

`DATA.dokumente` je Eintrag (`dashboard-data.js:80-94`):
`id, typ, jahr, label, spalte_wert, spalte_vergleich, spalte_dritte, einwohner`.
`label` = `${typ} ${jahr}` (Zeile 89). `dokument_id` ist
`INTEGER PRIMARY KEY` (`web/schema.sql:19`) — Ids sind numerische Strings, ein
nicht-numerischer Sentinel kann nicht kollidieren.

`DATA.meta.default_vergleich` = `standardVergleich(dok)`
(`dashboard-data.js:699`, Funktion 659-668). Signatur nimmt **nur** `dok`,
keine Posten. Liefert `null` bei < 2 Dokumenten (Zeile 660).

## Die Engine

`aggregiereDokument(posten, dokId, haushalt)` (`vergleich-daten.js:55-87`)
sammelt je Schluessel **beides**: `wert` (Zeile 79, via `wertVon` 42-44) und
`vergleich` (Zeile 80, via `vergleichVon` 49-51). Die interne Basis ist damit
bereits vorhanden — es fehlt nur die zweite Herkunft.

`baueDiff(posten, dokumente, { a, b, haushalt })` (118-174):
- 120-121 baut `aggA`/`aggB`
- 123-156 Zeilen aus der Schluesselunion; 134 verwirft doppelte Nullen;
  140 `stamm = eb || ea`; 153 Prozent; 154 Status
- 160 Sortierung nach `|delta|`
- 162-173 Rueckgabe: `haushalt, a, b, zeilen, status, eckwerte, gruppen,
  treemap, wasserfall, kontrolle`

**Alle fuenf Sichten lesen ausschliesslich `zeilen`:**
`statusZaehlung(zeilen)` 176, `eckwerte(zeilen, hh)` 186, `gruppenDelta(zeilen)`
227, `treemapDelta(zeilen)` 245, `wasserfall(zeilen)` 277. Ebenso
`filtereZeilen(zeilen, f)` 406 und `alsCsv(zeilen, labelA, labelB)` 431.
Nur `kontrolle(aggA, aggB, dokumente, a, b)` (337) liest die Aggregate direkt.

=> Wird `aggA` aus `aggB.vergleich` abgeleitet, bleibt alles ab Zeile 123
unveraendert. Kein Parallelpfad.

`kontrolle()` (337-394):
- 339-341 beide Dokumente aufloesen, sonst `null`
- 342-343 zugelassene Paare: `nva` (dB=NVA, dA=VA, gleiches Jahr) und
  `vaFolge` (dB=VA, dA=VA, Jahr-1); 344 sonst `null`
- **Der RA ist nicht explizit ausgeschlossen, sondern durch Auslassung.**
  Der Begruendungskommentar steht in 334-336 (laut D2 widerlegt).
- 384 `spalte: dB.spalte_vergleich || "Vergleichsspalte"`

## Die Oberflaeche — jede Stelle mit „zwei Dokument-Ids"

| Stelle | Zeile(n) | Abhaengigkeit |
|---|---|---|
| `zustand` | 28-35 | `a`, `b` als Dokument-Ids |
| `dokument(id)` | 78-80 | Lookup in `daten.dokumente` — liefert `undefined` fuer Sentinel |
| `dokLang(d)` | 86-89 | `d.label` + `d.fassung` |
| Sichtbarkeit | 98 | `const mehrere = (daten.dokumente \|\| []).length >= 2` |
| Tab-Knopf | 101 | `tabBtn.hidden = !mehrere` |
| Panels | 103-105 | `.gat-panel, .stats, .gat-callout` -> `hidden` |
| Leer-Hinweis | 107-116 | Text „braucht es zwei Dokumente" |
| Early return | 118 | `if (!mehrere) return` |
| `fuelleAuswahl` | 131-155 | 133 `gueltig()`; 136-137 Fallback `docs[docs.length - 2].id` (**crasht bei 1 Dokument**); 139-153 beide Selects identisch befuellt |
| `verdrahte` / Tausch | 188-195 | vertauscht `a`/`b` blind |
| `verdrahte` / `vgl-b` | 180-183 | ruft nur `rechneUndZeichne`, **nicht** `fuelleAuswahl` |
| `rechneUndZeichne` | 253-261 | `a === b`-Ausweichlogik, `docs[i>0?i-1:Math.min(1,docs.length-1)]` |
| `zeichneKopf` | 275-276, 282, 286, 291 | `dokLang(dA)`, `dA.spalte_wert`, `thA` |
| `zeichneKennzahlen` | 311-312, 330 | `dA.label` |
| `zeichneKontrolle` | 341-344 | `!k` -> Panel `hidden` |
| `zeichneCharts` | 405-411 | nur `chartDiffWasserfall` nimmt `labelA` |
| `zeichneTabelle` | 486-544 | **keine** Dokument-Abhaengigkeit |
| `ladeCsv` | 568, 572, 581 | Labels + Dateiname |

`chartDiffGruppen(diff)` (`dashboard-charts.js:1537`) und
`chartDiffTreemap(diff)` (1592) nehmen **keine** Labels — nur
`chartDiffWasserfall(diff, labelA, labelB)` (1443).

## HTML

`web/index.html`:
- 229 Tab-Knopf `data-tab="vergleich"`
- 363 Panel; 365 `<h2>Vergleich zweier Dokumente</h2>`; 366-371 Lead
- 375-390 Auswahl-Filterbar: `#vgl-a`, `#vgl-b`, `#vgl-hh`, `#vgl-tausch`
- 391 `#vgl-kopf`
- 393-394 `#vgl-stats`, `#vgl-statuszeile`
- 396-411 `#vgl-kontrolle-panel` (`hidden`) mit Notiz 400-406, Body `#vgl-kontrolle`
- 495-513 Tabellenkopf, `#vgl-th-a` (506), `#vgl-th-b` (508)

## Die widerlegte Begruendung — genau zwei Stellen

`web/js/vergleich-daten.js:334-336` und `docs/BROWSER-APP.md:118-120`.
Die Python-Seite (`src/`) enthaelt keine Diff-Engine und ist nicht betroffen
(geprueft per grep).
