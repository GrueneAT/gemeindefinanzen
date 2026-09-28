# Rohbefunde — DATEN & FALLSTRICKE

Alle Zahlen unten sind **ausgefuehrt**, nicht geschaetzt: Ad-hoc-Skripte gegen
die echten Fixtures, gefahren mit demselben Loader-Shim wie `npm run test:js`
(`node --import ./tests/js/gat-charts-shim.mjs`), Pfad
`verarbeitePdf` -> `collect` -> `aggregiereDokument`.

## Beleg 1 — Der interne Diff stimmt mit der abgedruckten Spalte 3

Je Schluessel `wert - vergleich` gegen die abgedruckte Spalte 3 (`ed`/`fd`):

| Dokument | Spalte 3 | EHH geprueft | EHH Abw. | FHH geprueft | FHH Abw. |
|---|---|---|---|---|---|
| NVA 2025 | `1. NVA` | 191 | **0** | 231 | **0** |
| NVA 2026 | `1. NVA` | 160 | **0** | 178 | **0** |
| RA 2024 | `Abweichung RA-VA` | 1295 | **0** | 1320 | **0** |
| RA 2025 | `Abweichung RA-VA` | 1270 | **0** | 1267 | **0** |
| VA 2026 | `RA 2024` | 1276 | 1275 | 1310 | 1309 |

**NVA und RA drucken eine echte Differenz ab; ein VA nicht.** Die Spalte 3
eines Voranschlags ist der RA des Vorvorjahres, keine Differenz. Der interne
Modus rechnet fuer einen VA also korrekt, ist aber **nicht gegen eine
abgedruckte Spalte belegbar**. Das ist kein Grund, ihn zu sperren — aber die
Kopfzeile darf nicht suggerieren, das Dokument drucke diesen Diff ab.

## Beleg 2 — Die Eckwerte des internen NVA-2026-Diffs

| Haushalt | Einnahmen | Ausgaben | Saldo-Delta |
|---|---|---|---|
| EHH | 22.540.500 -> 23.330.800 (**+790.300**) | 22.066.900 -> 22.569.100 (**+502.200**) | **+288.100** |
| FHH | 34.759.300 -> 33.163.900 (−1.595.400) | 34.916.600 -> 33.628.000 (−1.288.600) | −306.800; investiv 13.361.100 -> 11.556.900 (−1.804.200) |

Die drei EHH-Zahlen sind **exakt** die Akzeptanzkriterien des Issues
(+790.300 / +502.200 / +288.100). Wasserfall: von 473.600 nach 761.700,
Delta 288.100 — `nach` ist der Saldo aus Spalte 1 und stimmt mit dem bereits
gepinnten Wert 761.700 (`run.mjs:1170`).

## Beleg 3 — Intern weicht vom Zwei-Dokumente-Diff ab (D1 ist wirksam)

EHH, NVA 2026:

| | Zeilen | Ertraege | Aufwendungen | Nettoergebnis |
|---|---|---|---|---|
| Basis = geladener VA 2026 | 1047 | +890.300 | +602.800 | +287.500 |
| Basis = interne Spalte | 1048 | +790.300 | +502.200 | +288.100 |

Differenz = die Community Nurse (Ertrag 100.000, Aufwand 100.600, netto 600) —
genau die Fassungsdifferenz, die `kontrolle()` findet. **Die beiden Modi geben
unterschiedliche Zahlen; die Beschriftung muss sie unterscheidbar machen.**
Der interne Diff hat eine Zeile **mehr** (1048 vs 1047): der geladene VA und
der NVA fuehren nicht exakt dieselbe Schluesselmenge in der EHH-Haelfte.

Statusverteilung intern EHH: `{neu: 32, entfallen: 6, geaendert: 122,
unveraendert: 888}` — 160 veraendert von 1048.

## Beleg 4 — D2 unabhaengig nachgerechnet

RA 2025, Spalte 2 (das Soll), gegen NVA 2025:

| | geprueft | Abweichungen | Summe |
|---|---|---|---|
| EHH vs NVA-Spalte 1 (`VA 2025 inkl. NVA`) | 1156 | **0** | 0 |
| EHH vs NVA-Spalte 2 (`VA 2025`, original) | 1171 | 191 | 9.211.600 |
| FHH vs NVA-Spalte 1 | 1160 | **0** | 0 |
| FHH vs NVA-Spalte 2 | 1203 | 231 | 18.238.700 |

D2 ist bestaetigt: **das Soll eines RA ist der Voranschlag inklusive
Nachtrag.** Anmerkung zur Ehrlichkeit: CONTEXT.md D2 nennt „138 Posten,
16.083.400 EUR"; meine je-Haushalt getrennte Rechnung ergibt 191/9.211.600
(EHH) und 231/18.238.700 (FHH). Die Richtung ist identisch und eindeutig, die
Zaehlweise offensichtlich eine andere (D2 hat EHH und FHH vermutlich in einem
Schluesselraum gezaehlt). Die **Entscheidung** ist davon nicht beruehrt.

## Beleg 5 — Der Spiegelfall: die Spalte 2 eines VA

VA 2026, Spalte 2 (`VA 2025`), gegen NVA 2025:

| | geprueft | Abweichungen | Summe |
|---|---|---|---|
| EHH vs NVA-Spalte 1 (inkl. NVA) | 1171 | 191 | 9.211.600 |
| EHH vs NVA-Spalte 2 (original) | 1116 | **0** | 0 |
| FHH vs NVA-Spalte 1 | 1203 | 231 | 18.238.700 |
| FHH vs NVA-Spalte 2 | 1144 | **0** | 0 |

**Genau umgekehrt zum RA:** die Vergleichsspalte eines Voranschlags ist der
Vorjahres-Voranschlag **im Original, ohne Nachtrag**. Das ist neu und in
CONTEXT.md nicht erfasst. Folge: „VA 2025 (laut VA)" ist die richtige
Beschriftung, aber sie bedeutet nicht dasselbe wie ein separat geladener
„NVA 2025". Kein Blocker fuer D3 — ein Satz in `docs/BROWSER-APP.md` wert.

## Beleg 6 — OH-CSV traegt KEINE Vergleichsspalte

`offenerhaushalt_31912_2026_va_{ehh,fhh}.csv` durch `verarbeiteCsvDateien` +
`collect`:

```
VA 2026 (fassung=OH-CSV) typ=VA jahr=2026 spalte_vergleich="VA 2025"
  n=3149 Posten | ev!=0: 0   fv!=0: 0   ed!=0: 0   fd!=0: 0
  EHH: 1452 Schluessel, 1016 mit Bewegung, Summe|vergleich| = 0
```

Ursache im Code: `HEADER` (`csv-parser.js:31-47`) hat 16 Spalten mit **einer**
`Wert`-Spalte; `parseCsvBytes` setzt nur `eh_wert`/`fh_wert`
(`csv-parser.js:304-308`). Der Kommentar `csv-parser.js:330-333` sagt es
ausdruecklich: „Spalten 2/3 … liegen im OH-CSV nicht vor und bleiben 0".
Gleichzeitig schreibt `dokumentDatensatz` (`loader.js:31`) via
`spalten("VA", 2026)` weiter `spalte_vergleich = "VA 2025"` — **der Name
existiert, die Daten nicht.**

=> **Die Sichtbarkeits- und Auswahl-Pruefung MUSS datenbasiert sein.** Eine
Pruefung auf `typ` (oder auf den Spaltennamen) wuerde einem OH-CSV-Dokument
eine interne Basis anbieten und einen Diff erzeugen, dessen Basis ueberall 0
ist — 1016 Zeilen „neu", still und falsch.

Auch nicht auf `fassung === "OH-CSV"` pruefen: der Halb-Zustand heisst
`"OH-CSV (nur EHH)"` (`run.mjs:882-886, 921-927`) — zwei Strings, die
synchron bleiben muessten.

## Beleg 7 — Fuellung der Vergleichsspalte je Dokument und Haushalt

Summe `|vergleich|` ueber alle Schluessel:

| Dokument | Spalte-2-Name | EHH | FHH |
|---|---|---|---|
| RA 2024 | `VA 2024` | 44.209.200 | 53.937.200 |
| NVA 2025 | `VA 2025` | 45.265.000 | 64.611.500 |
| RA 2025 | `VA 2025` | 48.615.800 | 55.619.200 |
| VA 2026 | `VA 2025` | 45.265.000 | 64.611.500 |
| NVA 2026 | `VA 2026` | 44.607.400 | 69.675.900 |
| OH-CSV VA 2026 | `VA 2025` | **0** | **0** |

Alle fuenf PDFs tragen beide Haelften. Der Halb-Fall (eine Haelfte gefuellt,
die andere nicht) tritt bei den Fixtures nicht auf, ist aber beim
CSV-Nachreichungspfad strukturell moeglich — eine Pruefung je Haushaltshaelfte
ist die ehrliche.

## Beleg 8 — Kontrolle laeuft heute nicht fuer den RA

`baueDiff(posten, dokumente, { a: NVA 2025, b: RA 2025, haushalt: "EHH" })`
-> `kontrolle === null`. Bestaetigt: der RA ist durch die Paar-Praedikate
(`vergleich-daten.js:342-343`) ausgeschlossen, nicht durch einen expliziten
Check.

## Beleg 9 — `standardVergleich` bei einem Dokument

`standardVergleich([NVA 2026])` -> `null` (`dashboard-data.js:660`).
`fuelleAuswahl` (`vergleich.js:136-137`) faellt dann auf
`docs[docs.length - 2].id` zurueck = `docs[-1]` = `undefined` -> **TypeError**.
Heute unerreichbar, weil der Tab bei 1 Dokument ausgeblendet wird
(`vergleich.js:98, 118`). **Mit der neuen Sichtbarkeit wird dieser Pfad
erreichbar.**

## Fallstricke

### F1 — Die Tautologie-Kontrolle (der gefaehrlichste)
Wird `kontrolle()` im internen Modus mit `aggA.wert === aggB.vergleich`
aufgerufen, findet sie per Konstruktion 0 Abweichungen und schreibt
**„Geprueft. Alle 1048 Haushaltsstellen stimmen ueberein"** — eine
Selbstbestaetigung, die nichts belegt. Das ist die Kernaussage von D1 in
Code-Form: `kontrolle` darf im internen Modus nicht rechnen.

### F2 — Die mutierte Basis-Map
Wird `aggA` durch Ueberschreiben von `aggB` gebildet (`e.wert = e.vergleich`
ohne Klon), zerstoert das die Vergleichsseite: `wert` und `vergleich` sind
dasselbe Objekt. Ergebnis: ueberall `delta = 0`, `wasserfall.nach` wird falsch,
und kein Test faellt zwingend auf. Der Klon muss explizit sein.

### F3 — Das leere Basis-Dokument
`dokument(zustand.a)` (`vergleich.js:78-80`) liefert fuer den Sentinel
`undefined`. Die bestehenden Fallbacks (`dA ? dA.label : "Basis"` in 291, 330,
407, 572) greifen dann und schreiben ueberall das Wort „Basis" — funktional,
aber die Herkunft verschwindet. Genau das verbietet Akzeptanzkriterium
„Kopfzeile, Tabellenkoepfe und CSV-Name benennen die Herkunft".

### F4 — Der Richtungstausch
`vgl-tausch` (`vergleich.js:188-195`) vertauscht `a`/`b` ohne Pruefung. Mit dem
Sentinel in `a` landet er in `b` — ein „Vergleichsdokument", das kein Dokument
ist. `aggregiereDokument(posten, "intern", hh)` liefert eine leere Map, und
`baueDiff` produziert eine leere Ansicht ohne Fehlermeldung.

### F5 — Die interne Option gehoert zum gewaehlten `b`
Der Auswahleintrag „VA 2026 (laut NVA)" ist keine Eigenschaft der
Dokumentliste, sondern des **gerade gewaehlten Vergleichsdokuments**. Wechselt
der User `#vgl-b`, muss sich das Label des Eintrags aendern — und der Eintrag
verschwinden, wenn das neue `b` keine Vergleichsspalte traegt. Heute ruft der
`vgl-b`-Handler (`vergleich.js:180-183`) nur `rechneUndZeichne`, nicht
`fuelleAuswahl`.

### F6 — Der CSV-Dateiname
`ladeCsv` (`vergleich.js:580-583`) baut `vergleich_${label}_${label}_${hh}.csv`
mit `replace(/\s+/g, "-")` + `toLowerCase()`. Aus „VA 2026 (laut NVA)" wird
`va-2026-(laut-nva)`. Legal, aber haesslich — eine eigene Kurzform fuer den
Dateinamen ist besser.

### F7 — `a === b`-Ausweichlogik bei einem Dokument
`rechneUndZeichne` (`vergleich.js:253-261`) weicht bei gleicher Auswahl auf ein
Nachbardokument aus: `docs[i > 0 ? i - 1 : Math.min(1, docs.length - 1)]`. Bei
genau **einem** Dokument ist das `docs[0]` — also `b` selbst, die Ausweichung
tut nichts. Mit dem Sentinel ist der Zweig unerreichbar; er bleibt trotzdem
eine Falle, wenn jemand spaeter die Sentinel-Logik umbaut.

## Umgebung

| Abhaengigkeit | vorhanden | Version |
|---|---|---|
| Node | ja | v26.8.1 |
| Python | ja | 3.13.5 |
| Playwright | ja | 1.60.0 |
| `node_modules` **im Worktree** | **nein** | Node loest nach oben auf `<repo>/node_modules` auf — `npm run test:js` laeuft trotzdem |
| ECharts | CDN | `cdn.jsdelivr.net/npm/echarts@5.5.1` (`web/index.html:22`) |
| Design-System | CDN | `design-system.gruene.at/design-system.css` (`web/index.html:21`) |

Keine neue Abhaengigkeit noetig — der Modus ist reine Rechenlogik plus DOM.
