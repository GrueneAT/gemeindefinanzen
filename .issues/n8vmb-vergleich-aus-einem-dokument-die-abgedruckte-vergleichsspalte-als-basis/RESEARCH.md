# Research: Vergleich aus einem Dokument — die abgedruckte Vergleichsspalte als Basis

**Researched:** 2026-09-28
**Issue:** n8vmb-vergleich-aus-einem-dokument-die-abgedruckte-vergleichsspalte-als-basis
**Confidence:** HIGH (alle Datenaussagen ausgefuehrt, nicht vermutet)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D1 — Vorbelegung: die dokumentinterne Spalte gewinnt.** Traegt das
Vergleichsdokument eine Vergleichsspalte, ist diese die Basis-Vorbelegung —
auch dann, wenn das passende zweite Dokument geladen ist. Warum: sie ist per
Definition die Fassung, gegen die das Dokument rechnet. Folge: Die
Selbstkontrolle laeuft nicht mehr automatisch mit. Das Kontroll-Panel muss
erklaeren, wodurch sie ausgeloest wird — dadurch, dass man ein geladenes
Dokument als Basis waehlt.

**D2 — Der Rechnungsabschluss: Frage empirisch geklaert.** Das Soll eines RA
ist der Voranschlag **inklusive Nachtrag** (geprueft an `RA-2025-Auflage.pdf`
gegen `NVA-2025-Auflage.pdf`: 0 Abweichungen gegen NVA-Spalte 1). Der RA
bekommt den internen Modus ohne Sonderwarnung. Seine Basis heisst nicht wie
abgedruckt, sondern **„Soll <Jahr> (laut RA)"**. Zweite Folge — Korrektur am
bestehenden Code: `kontrolle()` in `web/js/vergleich-daten.js` schliesst den RA
heute aus, mit der Begruendung, seine Spalte 2 sei nicht entscheidbar. Diese
Begruendung ist widerlegt. **Der Kommentar ist falsch und muss weg**; der
RA-Fall laesst sich stattdessen unterstuetzen: liegt der NVA desselben Jahres
als Basis vor, ist dessen Spalte 1 gegen die Soll-Spalte des RA pruefbar.

**D3 — Beschriftung der internen Basis.** Spaltenname plus kurze Herkunft in
Klammern, etwa „VA 2026 (laut NVA)". Kurz genug fuer Achsenlabels und
Tabellenkoepfe. Beim RA gilt D2: dort tritt „Soll <Jahr> (laut RA)" an die
Stelle des abgedruckten Spaltennamens.

**D4 — Umfang.** Wie im ISSUE.md: interne Basis, Auswahl-Eintrag, Vorbelegung,
Sichtbarkeit ab einem Dokument, Beschriftung — plus Tests (js und e2e) und
Nachzug in `docs/BROWSER-APP.md`. Dazu aus D2 die Korrektur an `kontrolle()`
samt falschem Kommentar.

### Claude's Discretion

Nicht explizit als Ermessensraum ausgewiesen. Faktisch offen und in dieser
Recherche entschieden: die **Form** der Signaturerweiterung von `baueDiff`, die
**Art** der Sichtbarkeitspruefung, der **Ort** der D1-Vorbelegung
(`standardVergleich` vs. `fuelleAuswahl`), das Verhalten des
Richtungstausch-Knopfs und die Form des CSV-Dateinamens.

### Deferred Ideas (OUT OF SCOPE)

- **Das Kontroll-Panel um aktives Umschalten auf das ausloesende Dokument
  erweitern** (CONTEXT.md D4, „Nicht in diesem Schritt"). Das Panel **nennt**
  das ausloesende Dokument, es **schaltet** nicht darauf um.
- **D2 ueber mehrere Jahre breiter absichern** (CONTEXT.md „Offen gelassen").
  Weitere Herzogenburger RA liegen bereit, werden aber in diesem Schritt nicht
  geholt.
</user_constraints>

## Summary

Der Vergleichs-Tab braucht **keinen neuen Rechenweg**, sondern eine zweite
Herkunft fuer die Basis-Seite — und die liegt bereits vor.
`aggregiereDokument()` (`web/js/vergleich-daten.js:55-87`) sammelt je
Haushaltsstelle in einem Durchlauf **beides**: `wert` (Spalte 1, Zeile 79) und
`vergleich` (Spalte 2, Zeile 80). Der interne Modus ist deshalb eine
Projektion: dieselbe Map, auf einem anderen Feld gelesen. Weil alle fuenf
Sichten (`status`, `eckwerte`, `gruppen`, `treemap`, `wasserfall`) sowie
`filtereZeilen` und `alsCsv` ausschliesslich die fertigen `zeilen` lesen —
einzige Ausnahme ist `kontrolle()` — bleibt ab `vergleich-daten.js:123` alles
unveraendert. Die kleinste Signatur ist deshalb **gar keine neue Signatur**:
`a` traegt einen exportierten Sentinel-String. `dokument_id` ist
`INTEGER PRIMARY KEY` (`web/schema.sql:19`), eine Kollision ist strukturell
ausgeschlossen.

Die Datenlage ist belegt, nicht vermutet. Der interne Diff des NVA 2026 ergibt
Ertraege **+790.300**, Aufwendungen **+502.200**, Nettoergebnis **+288.100** —
exakt die Akzeptanzkriterien. Zeile fuer Zeile stimmt er mit der abgedruckten
Spalte 3 ueberein: 160 EHH- und 178 FHH-Schluessel mit Bewegung, **0
Abweichungen**; dasselbe gilt fuer NVA 2025, RA 2024 und RA 2025. Ein
**Voranschlag** druckt dagegen keine Differenz ab (seine Spalte 3 ist der RA
des Vorvorjahres) — der interne Modus rechnet dort korrekt, ist aber nicht
gegen eine Spalte belegbar. Und die schaerfste Einschraenkung: ein
**OH-CSV-Dokument hat ueberhaupt keine Spalte 2** (`ev`/`fv` durchgehend 0,
3149 Posten geprueft), traegt aber trotzdem den Spaltennamen „VA 2025". Die
Sichtbarkeits- und Auswahlpruefung muss daher **datenbasiert** sein, nicht
typbasiert.

Zwei Fallstricke entscheiden ueber Erfolg oder stille Fehlfunktion. Erstens
darf `kontrolle()` im internen Modus **nicht rechnen**: `aggA.wert` ist dann
per Konstruktion `aggB.vergleich`, die Pruefung findet immer 0 Abweichungen und
schreibt eine Selbstbestaetigung, die nichts belegt. Zweitens muss die
Basis-Map **geklont** werden — wird `aggB` in-place umgeschrieben, wird jedes
`delta` zu 0, ohne dass ein Test zwingend faellt.

**Primary recommendation:** Sentinel `BASIS_INTERN` in `vergleich-daten.js`
exportieren; `baueDiff` baut `aggB` zuerst und leitet `aggA` bei Sentinel per
**Klon** aus `aggB.vergleich` ab; `kontrolle()` liefert im internen Modus statt
einer Pruefung ein `{ modus: "intern", ausloeser }`-Objekt (und weiter `null`,
wo gar keine Beziehung besteht — das haelt `run.mjs:1270-1277` gruen);
Sichtbarkeit und Auswahleintrag gegen einen neuen, **datenbasierten** Helfer
`hatVergleichsspalte(posten, dokId, haushalt)`; ein einziger Helfer
`basisLabel()` in `vergleich.js` versorgt Kopf, Kennzahlen, Wasserfall und CSV.

## Codebase Analysis

### Relevant Code

| Datei | Zweck | Zuletzt geaendert | Relevanz |
|---|---|---|---|
| `web/js/vergleich-daten.js` | Diff-Engine, rein rechnend | `d3b0511` (PR #36) | KERN — `baueDiff`, `kontrolle`, `aggregiereDokument` |
| `web/js/vergleich.js` | Oberflaeche des Tabs | `d3b0511` | KERN — Zustand, Auswahl, Sichtbarkeit, Beschriftung |
| `web/js/dashboard-data.js` | `dokumente()` 74, `standardVergleich()` 659, `collect()` 671 | `d3b0511` | HOCH — Vorbelegung, Dokumentfelder |
| `web/js/dashboard-charts.js` | `chartDiffWasserfall` 1443, `chartDiffGruppen` 1537, `chartDiffTreemap` 1592 | `d3b0511` | MITTEL — nur der Wasserfall nimmt Labels |
| `web/js/loader.js` | `spalten()` 13-24, `dokumentDatensatz()` 27-43 | aelter | MITTEL — Herkunft von `spalte_vergleich` |
| `web/js/csv-parser.js` | `HEADER` 31-47, `parseCsvBytes` 236-322, Kommentar 330-333 | aelter | HOCH — Beweis, dass OH-CSV keine Spalte 2 hat |
| `web/index.html` | Panel 363-521, Kontroll-Panel 396-411, Tabellenkopf 495-513 | `d3b0511` | MITTEL — Ueberschrift/Lead/Notiz |
| `tests/js/run.mjs` | Vergleichs-Tests 1104-1327 | `d3b0511` | HOCH |
| `tests/e2e/vergleich.spec.mjs` | Browser-Tests | `d3b0511` | HOCH |
| `docs/BROWSER-APP.md` | Abschnitt 87-121 | `d3b0511` | MITTEL — D4-Nachzug, falsche Begruendung 118-120 |

Alle Kerndateien stammen aus einem einzigen Commit (`d3b0511`, PR #36, bereits
gemerged). Keine offenen PRs auf diesen Dateien — die Interfaces sind frisch
und stabil.

### Interfaces

<interfaces>
// From web/js/vergleich-daten.js — die Diff-Engine (rein rechnend, kein DOM)
export const HAUSHALTE = ["EHH", "FHH"]                       // Zeile 31
export const STATUS = ["neu", "entfallen", "geaendert", "unveraendert"]  // 35
export const WASSERFALL_N = 10                                // 272

export function schluessel(p): string                         // 38
  // `${p.ansatz}|${p.konto}|${p.richtung}`

export function aggregiereDokument(posten, dokId, haushalt): Map<string, {
  key, gruppe, gruppe_text, ansatz, ansatz_text, konto, konto_text,
  bezeichnung, richtung, gebarung,
  wert: number,        // Spalte 1 — ew/fw     (Zeile 79)
  vergleich: number,   // Spalte 2 — ev/fv     (Zeile 80)  <-- die interne Basis
}>                                                            // 55-87

export function baueDiff(posten, dokumente, { a, b, haushalt = "EHH" }): {
  haushalt: "EHH" | "FHH",
  a, b,
  zeilen: Array<{
    key, gruppe, gruppe_text, ansatz, ansatz_text, konto, konto_text,
    bezeichnung, richtung, gebarung,
    a: number, b: number, delta: number,
    prozent: number | null,
    status: "neu" | "entfallen" | "geaendert" | "unveraendert",
  }>,
  status: { neu, entfallen, geaendert, unveraendert, gesamt, veraendert },
  eckwerte: Array<{ titel, a, b, delta, prozent, gut: "auf"|"ab"|"neutral" }>,
  gruppen: Array<{ gruppe, gruppe_text, einnahme, ausgabe }>,
  treemap: Array<{ gruppe, gruppe_text, ansatz, ansatz_text,
                   einnahme, ausgabe, delta }>,
  wasserfall: { von: number, nach: number,
                schritte: Array<{ ansatz, name, beitrag }> },
  kontrolle: null | {
    spalte, dokument, fassung_a, fassung_b,
    geprueft: number, ohne_beleg: number,
    abweichungen: Array<{ key, gruppe, ansatz, ansatz_text, konto,
                          bezeichnung, richtung,
                          basis, abgedruckt, abweichung }>,
    summeAbweichung: number, bestanden: boolean,
  },
}                                                             // 118-174

export function filtereZeilen(zeilen, f = {}): Array<Zeile>    // 406
  // f: { richtung, gruppe, gebarung, status, schwelle, suche }
export function alsCsv(zeilen, labelA, labelB): string         // 431

// NICHT exportiert (modulintern):
function wertVon(p, haushalt)            // 42  -> haushalt === "FHH" ? p.fw : p.ew
function vergleichVon(p, haushalt)       // 49  -> haushalt === "FHH" ? p.fv : p.ev
function statusVon(a, b)                 // 90
function euroRund(x)                     // 99
function saldoBeitrag(zeile)             // 105
function statusZaehlung(zeilen)          // 176   liest NUR zeilen
function eckwerte(zeilen, haushalt)      // 186   liest NUR zeilen
function gruppenDelta(zeilen)            // 227   liest NUR zeilen
function treemapDelta(zeilen)            // 245   liest NUR zeilen
function wasserfall(zeilen)              // 277   liest NUR zeilen
function kontrolle(aggA, aggB, dokumente, a, b)  // 337  liest die AGGREGATE

// From web/js/vergleich.js — Oberflaeche
export function baueVergleich(datenNeu): void                  // 92
const zustand = { a: null, b: null, haushalt: "EHH",
                  sortKey: "delta", sortAbsteigend: true,
                  verdrahtet: false }                          // 28-35
let daten = null; let diff = null; const charts = {}           // 37-41
const LIMIT = 500                                              // 25
const STATUS_TEXT = { neu, entfallen, geaendert, unveraendert } // 43-48
// modulintern:
function euro(v) / euroVz(v) / prozentVz(p)                    // 51 / 55 / 60
function el(id) / text(id, wert)                               // 69 / 73
function dokument(id)                                          // 78  -> DATA.dokumente-Lookup
function dokLang(d)                                            // 86  -> label (+ fassung)
function fuelleAuswahl()                                       // 131
function fuelleGruppenFilter()                                 // 157
function verdrahte()                                           // 175
function passeGroesseAn()                                      // 244
function rechneUndZeichne()                                    // 252
function zeichneKopf()                                         // 274
function zeichneKennzahlen()                                   // 308
function zeichneKontrolle()                                    // 336
function zeichneCharts()                                       // 401
function zeichneChart(divId, option) / revive(o)               // 419 / 440
function aktuelleFilter() / sortiere(zeilen)                   // 459 / 470
function zeichneTabelle() / markiereSortierung()               // 486 / 546
function escapeHtml(s)                                         // 558
function ladeCsv()                                             // 566

// From web/js/dashboard-data.js
export function collect(db): {
  meta: { gemeinde, dok_anzahl, posten_anzahl, default_dok,
          default_vergleich: { a, b } | null },                // 693-701
  dokumente: Array<Dokument>, posten: Array<Posten>,
  aggregate: Record<string, Aggregat>, trend: Trend,
}                                                              // 671-705
export function standardVergleich(dok): { a, b } | null        // 659-668
  // 660: if (!dok || dok.length < 2) return null
  // 661-665: juengstes NVA mit passendem VA desselben Jahres
  // 666: sonst die zwei juengsten

// Dokument-Datensatz (dashboard-data.js:80-94)
{ id: number, typ: "VA"|"NVA"|"RA", jahr: number | null,
  label: string,              // `${typ} ${jahr}`                (Zeile 89)
  spalte_wert: string,        // z. B. "VA 2026 inkl. NVA"
  spalte_vergleich: string,   // z. B. "VA 2026"   <-- Grundlage von D3
  spalte_dritte: string,      // z. B. "1. NVA"
  einwohner: number | null }
// `fassung` ist NICHT in DATA.dokumente enthalten, obwohl vergleich.js:88 und
// :383 darauf zugreifen — dort immer undefined. Bestandsbefund, kein Blocker.

// Posten-Datensatz (dashboard-data.js:140-152)
{ dok, typ, jahr, richtung, gebarung, gruppe, gruppe_text,
  ansatz, ansatz_text, konto, konto_text, bezeichnung, mvag, qu,
  ew, ev, ed,     // Ergebnishaushalt: Spalte 1 / 2 / 3
  fw, fv, fd }    // Finanzierungshaushalt: Spalte 1 / 2 / 3

// From web/js/loader.js
export function spalten(typ, jahr): [string, string, string]   // 13-24
  // jahr null        -> ["Spalte 1", "Spalte 2", "Spalte 3"]
  // RA               -> [`RA ${jahr}`, `VA ${jahr}`, "Abweichung RA-VA"]
  // NVA              -> [`VA ${jahr} inkl. NVA`, `VA ${jahr}`, "1. NVA"]
  // sonst (VA)       -> [`VA ${jahr}`, `VA ${jahr-1}`, `RA ${jahr-2}`]
export function dokumentDatensatz(dateiname, meta)             // 27-43
  // Zeile 31 setzt spalte_wert/_vergleich/_dritte aus spalten() — IMMER,
  // auch fuer OH-CSV, wo keine Spalte-2-Daten existieren.

// From web/js/dashboard-charts.js
export function chartDiffWasserfall(diff, labelA = "Basis",
                                    labelB = "Vergleich"): EChartsOption  // 1443
export function chartDiffGruppen(diff): EChartsOption          // 1537  (keine Labels)
export function chartDiffTreemap(diff): EChartsOption          // 1592  (keine Labels)

// From web/js/dashboard-app.js
export function baueDashboard(db): boolean                     // 22
  // 23 collect(db); 39 baueVergleich(daten) — einziger Aufrufer

// DOM-Vertrag (web/index.html)
#vgl-a  #vgl-b  #vgl-hh  #vgl-tausch          // Auswahl, 375-390
#vgl-kopf                                      // 391
#vgl-stats  #vgl-statuszeile                   // 393-394
#vgl-kontrolle-panel[hidden]  #vgl-kontrolle   // 396-411
#c_vgl_wasserfall  #c_vgl_treemap  #c_vgl_gruppen
#vgl-f-such #vgl-f-gruppe #vgl-f-richtung #vgl-f-gebarung
#vgl-f-status #vgl-f-schwelle                  // Filter
#vgl-csv  #vgl-meta  #vgl-hint                 // Export/Fusszeilen
#vgl-th-a (506)  #vgl-th-b (508)  #vgl-tbody   // Tabelle
.tab-btn[data-tab="vergleich"] (229)  [data-panel="vergleich"] (363)
</interfaces>

### Reusable Components

Alles, was der Modus braucht, existiert bereits — zu bauen ist nur die
Verzweigung:

- `aggregiereDokument()` liefert `wert` **und** `vergleich` in einem Durchlauf
  (Zeilen 79/80). Genau dafuer wurde `vergleich` eingesammelt.
- Die fuenf Sichten lesen ausschliesslich `zeilen` — `statusZaehlung` 176,
  `eckwerte` 186, `gruppenDelta` 227, `treemapDelta` 245, `wasserfall` 277.
- `filtereZeilen` 406 und `alsCsv(zeilen, labelA, labelB)` 431 sind bereits
  label- und dokumentagnostisch.
- `chartDiffWasserfall(diff, labelA, labelB)` 1443 nimmt Labels als Parameter.
- `spalte_vergleich`, `typ`, `jahr` liegen in `DATA.dokumente` bereit — die
  Beschriftung braucht kein erneutes PDF-Lesen.

### Potential Conflicts

- **`fuelleAuswahl` crasht bei einem Dokument** (`vergleich.js:136-137`):
  `standardVergleich` liefert `null` (verifiziert), der Fallback greift auf
  `docs[docs.length - 2].id` = `docs[-1]` = `undefined`. Heute unerreichbar,
  weil der Tab bei einem Dokument ausgeblendet wird (98, 118) — **mit der neuen
  Sichtbarkeit wird dieser Pfad erreichbar.**
- **`vgl-b`-Handler ruft `fuelleAuswahl` nicht** (`vergleich.js:180-183`). Der
  interne Auswahleintrag gehoert aber zum gewaehlten `b` und muss beim Wechsel
  neu beschriftet oder entfernt werden.
- **`vgl-tausch` vertauscht blind** (188-195). Mit dem Sentinel in `a` landet
  er in `b`; `aggregiereDokument(posten, "intern", hh)` liefert eine leere Map
  und `baueDiff` eine leere Ansicht — ohne Fehlermeldung.
- **`dokument(zustand.a)` liefert `undefined`** fuer den Sentinel (78-80). Die
  bestehenden Fallbacks (291, 330, 407, 572) schreiben dann ueberall „Basis" —
  funktional, aber genau das verbietet das Akzeptanzkriterium zur Herkunft.
- **`web/index.html:365` Ueberschrift „Vergleich zweier Dokumente"** und Lead
  366-371 sowie die Kontroll-Panel-Notiz 400-406 behaupten den
  Zwei-Dokumente-Zwang.
- **`docs/BROWSER-APP.md:118-120`** traegt die identische widerlegte
  RA-Begruendung wie der Code-Kommentar. Beide Stellen muessen zusammen weg
  (D2). Die Python-Seite (`src/`) enthaelt keine Diff-Engine und ist nicht
  betroffen (per grep geprueft).

---

## Die sieben Fragen

### 1 — Wie muss `baueDiff()` erweitert werden?

**Kleinste Signatur: keine neue Signatur.** `a` traegt einen exportierten
Sentinel-String. Begruendung:

- `dokument_id` ist `INTEGER PRIMARY KEY` (`web/schema.sql:19`) und wird in
  `vergleich.js` und in `baueDiff` durchgehend per `String(...)` verglichen
  (z. B. `vergleich-daten.js:57`, `339-340`; `vergleich.js:79, 133, 253`). Ein
  nicht-numerischer String kann nicht kollidieren.
- Ein zusaetzliches `modus`-Feld waere ein **zweiter Zustand fuer dieselbe
  Sache** — `{ a: 5, modus: "intern" }` ist widerspruechlich und muesste
  ueberall mitgeprueft werden. Der Sentinel *in* `a` hat genau einen Zustand.
- `zustand.a` und der `value` des `#vgl-a`-Select bleiben **ein** Feld. Kein
  Zweitzustand in der Oberflaeche.

Der Eingriff in `baueDiff` (`vergleich-daten.js:118-174`) betrifft **vier
Zeilen**:

```
Zeile 120-121 heute:
    const aggA = aggregiereDokument(posten, a, hh)
    const aggB = aggregiereDokument(posten, b, hh)

kuenftig (Reihenfolge gedreht — aggB ist die Quelle der internen Basis):
    const intern = String(a) === BASIS_INTERN
    const aggB = aggregiereDokument(posten, b, hh)
    const aggA = intern ? interneBasis(aggB) : aggregiereDokument(posten, a, hh)

Zeile 172 heute:
    kontrolle: kontrolle(aggA, aggB, dokumente, a, b)

kuenftig:
    kontrolle: intern
      ? internHinweis(dokumente, b)
      : kontrolle(aggA, aggB, dokumente, a, b)
```

Dazu ein neuer, exportierter Sentinel und eine kleine Projektion:

```
export const BASIS_INTERN = "intern"

// Die abgedruckte Vergleichsspalte als Basis-Seite. Ein KLON — die
// Vergleichsseite darf nicht mitgeaendert werden.
function interneBasis(aggB) {
  const m = new Map()
  for (const [k, e] of aggB) m.set(k, { ...e, wert: e.vergleich, vergleich: 0 })
  return m
}
```

**Warum `zeilen`, `eckwerte`, `gruppen`, `treemap`, `wasserfall` unveraendert
weiterfunktionieren:** ab `vergleich-daten.js:123` liest die Engine nur noch
`aggA`/`aggB` in Gestalt zweier Maps derselben Form, und ab Zeile 162 nur noch
die fertigen `zeilen`. Konkret:

- **123-156** Schluesselunion, `wa`/`wb` aus `.wert`, Nullzeilen-Filter (134),
  `stamm = eb || ea` (140), `prozent` (153), `status` (154) — alles
  strukturell identisch. Im internen Modus ist die Schluesselmenge
  `aggA.keys() === aggB.keys()`, und `stamm` ist immer `eb`, weil
  `interneBasis` die Stammdaten mitklont.
- **160** Sortierung nach `|delta|` — unveraendert.
- **167-171** `statusZaehlung(zeilen)`, `eckwerte(zeilen, hh)`,
  `gruppenDelta(zeilen)`, `treemapDelta(zeilen)`, `wasserfall(zeilen)` — alle
  fuenf nehmen ausschliesslich `zeilen`. Kein Aufruf liest `aggA`, `aggB`, `a`,
  `b` oder `dokumente`.
- Ebenso ausserhalb: `filtereZeilen(zeilen, f)` 406, `alsCsv(zeilen, ...)` 431,
  `chartDiffWasserfall(diff, ...)` 1443, `chartDiffGruppen(diff)` 1537,
  `chartDiffTreemap(diff)` 1592.

Die **einzige** Funktion, die die Aggregate liest, ist `kontrolle()` (337) — und
genau die darf im internen Modus nicht rechnen (siehe Frage 5).

Empirisch bestaetigt (ausgefuehrt): der so gebildete interne Diff ergibt fuer
NVA 2026 EHH 1048 Zeilen, Status `{neu 32, entfallen 6, geaendert 122,
unveraendert 888}`, Ertraege +790.300, Aufwendungen +502.200, Nettoergebnis
+288.100, Wasserfall von 473.600 nach 761.700. Confidence: **HIGH**.

**Fallstrick (F2, HOCH):** wird `aggA` durch Ueberschreiben statt Klonen
gebildet (`e.wert = e.vergleich` auf `aggB`), sind `wert` und `vergleich`
danach dasselbe Objekt — jedes `delta` wird 0, `wasserfall.nach` falsch, und
**kein bestehender Test faellt zwingend**. Der Klon muss explizit sein, und ein
neuer Test muss ihn absichern (siehe Frage 7, Test 3).

### 2 — Welche Stellen in `vergleich.js` haengen an „zwei Dokument-Ids"?

| Stelle | Zeile(n) | Heutige Annahme | Was passieren muss |
|---|---|---|---|
| **Zustand** | 28-35 | `a`, `b` sind Dokument-Ids | `a` darf `BASIS_INTERN` sein. Kein neues Feld. Kommentar ergaenzen. |
| **`dokument(id)`** | 78-80 | Lookup findet immer etwas | Bleibt wie es ist (liefert `undefined`) — aber nicht mehr direkt fuer Labels verwenden. |
| **Neu: `basisLabel()` / `basisSpalte()`** | — | — | Ein Helfer, der bei Sentinel die D3-Beschriftung aus `dokument(zustand.b)` bildet, sonst `dokLang(dA)` bzw. `dA.spalte_wert`. **Vier Aufrufer** (Kopf, Kennzahlen, Charts, CSV) — damit die Beschriftungsregel genau einmal existiert. |
| **`fuelleAuswahl`** | 131-155 | beide Selects gleich befuellt; Vorbelegung aus `meta.default_vergleich` | (a) `gueltig()` (133) muss `BASIS_INTERN` akzeptieren, solange das gewaehlte `b` eine Vergleichsspalte traegt. (b) Der Fallback 136-137 `docs[docs.length - 2].id` **crasht bei einem Dokument** — muss auf `{ a: BASIS_INTERN, b: docs[docs.length-1].id }` gehen. (c) In `#vgl-a` den internen Eintrag als **erste** Option voranstellen (Frage 3). (d) `#vgl-b` bleibt unveraendert reine Dokumentliste. |
| **`verdrahte` / `#vgl-b`** | 180-183 | ruft nur `rechneUndZeichne` | Muss zuerst die Basis-Auswahl neu aufbauen: der interne Eintrag gehoert zum gewaehlten `b` (Label aendert sich, Eintrag entfaellt ggf.). `fuelleAuswahl()` bzw. ein herausgezogenes `fuelleBasisAuswahl()` davor aufrufen. |
| **`verdrahte` / `#vgl-tausch`** | 188-195 | `a`/`b` sind tauschbar | Tausch ist im internen Modus sinnlos (der Sentinel darf nie in `b`). Empfehlung: Knopf `disabled` setzen (mit `title`-Begruendung), gesetzt aus `rechneUndZeichne`. Alternative — Tausch **wechselt** auf das geladene Basisdokument — waere eine zweite Bedeutung fuer denselben Knopf; nicht empfohlen. |
| **`rechneUndZeichne`** | 252-272 | `a === b`-Ausweichlogik 253-261 | Der Sentinel ist nie gleich `b`, der Zweig ist damit inert. Trotzdem explizit ueberspringen, denn `docs[i>0?i-1:Math.min(1,docs.length-1)]` ist bei einem Dokument `docs[0]` = `b` selbst (F7). Am Ende: Tausch-Knopf-Zustand setzen. |
| **`zeichneKopf`** | 274-303 | 275 `dokument(zustand.a)`; 282 `dokLang(dA)`; 286 `dA.spalte_wert`; 291 `thA` = `dA.label` | 282 auf `basisLabel()`, 286 auf `basisSpalte()`, 291 auf `basisLabel()`. Der Satz „Gegenuebergestellt werden die Betragsspalten …" (285-287) traegt im internen Modus die Herkunft — er ist die Stelle, an der „laut NVA-Dokument" ausgeschrieben gehoert. |
| **`zeichneKennzahlen`** | 308-334 | 311 `dA`; 330 `dA.label` | 330 auf `basisLabel()`. `k.a`/`k.b` unveraendert. |
| **`zeichneKontrolle`** | 336-399 | 341-344: `!k` -> Panel `hidden` | Neuer dritter Zweig fuer `k.modus === "intern"`: Panel **sichtbar**, Hinweistext mit dem ausloesenden Dokument und ob es geladen ist (D1). Panel bleibt `hidden` nur bei `k === null`. |
| **`zeichneCharts`** | 401-414 | 405-410 `dA.label` fuer `chartDiffWasserfall` | 407 auf `basisLabel()`. `chartDiffTreemap`/`chartDiffGruppen` nehmen keine Labels — nichts zu tun. |
| **`zeichneTabelle`** | 486-544 | — | **Keine Aenderung.** Liest nur `diff.zeilen`, Filter und `diff.haushalt`. Verifiziert: Schwellwert 100.000 auf dem internen Diff -> 11 Zeilen, Ertraege +146.000, Aufwendungen +280.400 (also erscheint „Saldoeffekt"); Volltext „kommunalsteuer" -> 1 Treffer, delta −200.000. |
| **`ladeCsv`** | 566-592 | 568 `dA`; 572 `dA.label`; 581 Dateiname | 572 auf `basisLabel()`. Fuer 581 eine **eigene Kurzform**: `"VA 2026 (laut NVA)"` wuerde zu `va-2026-(laut-nva)` (F6). Empfehlung: Klammern entfernen, z. B. `vergleich_va-2026-laut-nva_nva-2026_ehh.csv`. |
| **Sichtbarkeit** | 97-118 | `docs.length >= 2` | Siehe Frage 6. |

**Die Aenderung ist klein, weil `zeichneTabelle` — die groesste Funktion — gar
nicht betroffen ist** und weil ein einziger Helfer (`basisLabel`) vier
Beschriftungsstellen versorgt.

### 3 — Wie wird die Basis-Auswahl aufgebaut? Welcher Wert steht fuer die interne Spalte?

**Der Wert: ein exportierter, nicht-numerischer Sentinel.**

```
// web/js/vergleich-daten.js
// Basis-Auswahl: dieser Wert steht nicht fuer ein Dokument, sondern fuer die
// im Vergleichsdokument abgedruckte Vergleichsspalte. Kollisionsfrei, weil
// dokument_id INTEGER PRIMARY KEY ist (web/schema.sql:19).
export const BASIS_INTERN = "intern"
```

Der Sentinel gehoert in `vergleich-daten.js`, weil dort seine Bedeutung
interpretiert wird (`baueDiff`); `vergleich.js` importiert ihn (die
Import-Zeile 17 existiert bereits).

**Aufbau des `#vgl-a`-Select** (`fuelleAuswahl`, heute 139-153): der interne
Eintrag steht als **erste** Option vor den Dokumenten, danach unveraendert alle
geladenen Dokumente. Er erscheint nur, wenn das **gerade gewaehlte `b`** eine
gefuellte Vergleichsspalte traegt (Frage 6) — er ist eine Eigenschaft von `b`,
nicht der Dokumentliste. `#vgl-b` bleibt eine reine Dokumentliste.

```
Basis:      [ VA 2026 (laut NVA) ]   <-- BASIS_INTERN, Vorbelegung (D1)
            [ RA 2024 ]
            [ NVA 2025 ]
            [ RA 2025 ]
            [ VA 2026 ]              <-- das geladene Dokument, weiter waehlbar
Vergleich:  [ ... alle Dokumente ... ]
```

Zwei Konsequenzen fuer die Verdrahtung:

1. **`gueltig()` (Zeile 133) erweitern:**
   `id === BASIS_INTERN || docs.some((d) => String(d.id) === String(id))`.
   Damit ueberlebt die Auswahl einen Dashboard-Neuaufbau (`baueVergleich` laeuft
   nach jedem Upload und bei jedem Palettenwechsel, siehe Kommentar 8-10) —
   aber nur, solange das gewaehlte `b` seine Spalte behaelt.
2. **`#vgl-b`-Wechsel muss die Basis-Auswahl neu aufbauen** (heute nicht,
   180-183): das Label des internen Eintrags haengt an `b`, und bei einem `b`
   ohne Vergleichsspalte muss der Eintrag verschwinden — samt Umschalten der
   Basis auf ein geladenes Dokument.

**Vorbelegung (D1) — Ort der Entscheidung.** Zwei Orte sind moeglich:

| Ort | Vorteil | Nachteil |
|---|---|---|
| **`standardVergleich(dok, posten)`** in `dashboard-data.js:659` — empfohlen | Die Vorbelegung bleibt an genau **einer** Stelle (`meta.default_vergleich`, gesetzt in `collect()` 699); in Node unittestbar ohne DOM | Signaturerweiterung; drei bestehende Tests muessen mitziehen (Frage 7) |
| `fuelleAuswahl()` in `vergleich.js:134-138` | keine Signaturaenderung, kein js-Test bricht | Vorbelegungslogik an zwei Orten; nur per e2e testbar |

**Empfehlung: `standardVergleich(dok, posten)`** mit `posten` als **optionalem**
Argument. Neue Reihenfolge: (1) gibt es ein Dokument mit gefuellter
Vergleichsspalte, gewinnt das juengste davon als `{ a: BASIS_INTERN, b: id }`;
(2) sonst die bestehende VA/NVA-Paar-Suche (661-665); (3) sonst die zwei
juengsten (666); (4) sonst `null`. Ohne `posten` faellt die Funktion auf das
heutige Verhalten zurueck — das haelt die beiden Tests mit nackten
Dokumentobjekten (`run.mjs:1114`, `1118`) lauffaehig, wenn sie nur die
Erwartung anpassen.

### 4 — Wie wird die Beschriftung gebildet?

**Regel (aus D3 + D2):**

```
function interneBasisLabel(d) {
  return d.typ === "RA"
    ? `Soll ${d.jahr} (laut RA)`
    : `${d.spalte_vergleich} (laut ${d.typ})`
}
```

**Ausgefuehrt gegen die Fixtures:**

| Dokument | `typ` | `jahr` | `spalte_vergleich` | interne Beschriftung |
|---|---|---|---|---|
| NVA 2026 | NVA | 2026 | `VA 2026` | **VA 2026 (laut NVA)** |
| NVA 2025 | NVA | 2025 | `VA 2025` | **VA 2025 (laut NVA)** |
| RA 2025 | RA | 2025 | `VA 2025` | **Soll 2025 (laut RA)** |
| RA 2024 | RA | 2024 | `VA 2024` | **Soll 2024 (laut RA)** |
| VA 2026 | VA | 2026 | `VA 2025` | **VA 2025 (laut VA)** |

**Woher Jahres- und Typbezug kommen:** beide stehen fertig in
`DATA.dokumente` — `typ` und `jahr` aus `dashboard-data.js:80-94` (SQL-Select
Zeile 77-79 gegen `dokument.typ` / `dokument.finanzjahr`), `spalte_vergleich`
aus derselben Zeile. Der String selbst entsteht **beim Import**:
`dokumentDatensatz()` (`loader.js:27-43`) ruft `spalten(meta.typ, jahr)`
(Zeile 31), `spalten()` (13-24) baut die drei Namen aus Typ und Jahr und
persistiert sie in `dokument.spalte_wert/_vergleich/_dritte`. Die Jahreszahl
fuer die RA-Form kommt aus `d.jahr` — **nicht** aus dem Parsen von
`spalte_vergleich`.

**Wo die Beschriftung erscheinen muss** (Akzeptanzkriterium „Kopfzeile,
Tabellenkoepfe und CSV-Name benennen die Herkunft"):

| Ort | Datei:Zeile |
|---|---|
| Kopfzeile „Basis …" | `vergleich.js:282` |
| Kopfzeile „Betragsspalten „X" und „Y"" | `vergleich.js:286` |
| Tabellenkopf `#vgl-th-a` | `vergleich.js:291` |
| Kennzahlen-Karte, Basiszeile | `vergleich.js:330` |
| Wasserfall, erste Kategorie | `vergleich.js:407` -> `dashboard-charts.js:1449` |
| CSV-Kopfzeile | `vergleich.js:572` -> `alsCsv` labelA (`vergleich-daten.js:442`) |
| CSV-Dateiname | `vergleich.js:581` (Kurzform, F6) |
| `kontrolle().spalte` im RA-Fall | `vergleich-daten.js:384` (siehe Frage 5) |

Weil `interneBasisLabel` auch in `kontrolle()` gebraucht wird, gehoert die
Funktion nach `vergleich-daten.js` und wird von `vergleich.js` importiert — eine
Regel, ein Ort.

**Zusatzbefund (MEDIUM-relevant, nicht in CONTEXT.md):** die Vergleichsspalte
eines **Voranschlags** ist der Vorjahres-Voranschlag **im Original, ohne
Nachtrag**. Ausgefuehrt: VA 2026 Spalte 2 gegen NVA 2025 Spalte 2 (original) —
1116 EHH / 1144 FHH Schluessel, **0 Abweichungen**; gegen NVA 2025 Spalte 1
(inkl. NVA) — 191 EHH / 231 FHH Abweichungen (9.211.600 / 18.238.700 EUR). Das
ist der **Spiegelfall zu D2**: beim RA enthaelt das Soll den Nachtrag, beim VA
nicht. „VA 2025 (laut VA)" ist damit korrekt, bedeutet aber nicht dasselbe wie
ein separat geladener „NVA 2025". **Kein Grund, D3 anzutasten** — aber ein Satz
in `docs/BROWSER-APP.md` wert.

### 5 — Welche Aenderung braucht `kontrolle()`?

Drei Aenderungen, alle in `vergleich-daten.js`.

**(a) Der falsche Kommentar muss weg.** Zeilen **334-336**:

> „Der Rechnungsabschluss bleibt bewusst aussen vor: seine Spalte 2 ist das
> Soll, und das kann den Nachtrag schon enthalten — welches Dokument gemeint
> ist, laesst sich aus dem Seitenkopf nicht entscheiden."

Laut D2 widerlegt. **Dieselbe Passage steht ein zweites Mal** in
`docs/BROWSER-APP.md:118-120` und muss zusammen mit dem Code-Kommentar
verschwinden (per grep geprueft: nur diese zwei Stellen; `src/` ist nicht
betroffen).

**(b) Der RA-Fall wird unterstuetzt.** Der RA ist heute nicht explizit
ausgeschlossen, sondern **durch Auslassung**: die Praedikate 342-343 lassen nur
`nva` (dB=NVA, dA=VA, gleiches Jahr) und `vaFolge` (dB=VA, dA=VA, Jahr−1) zu,
344 verwirft alles andere. Verifiziert: `baueDiff({ a: NVA 2025, b: RA 2025 })`
-> `kontrolle === null`.

Neues Praedikat:

```
const raSoll = dB.typ === "RA" && dA.jahr === dB.jahr &&
               (dA.typ === "NVA" || dA.typ === "VA")
if (!nva && !vaFolge && !raSoll) return null
```

Die Rechnung selbst (346-382) bleibt **unveraendert**: sie stellt `aggA.wert`
gegen `aggB.vergleich` — genau „NVA-Spalte 1 gegen RA-Soll". Ausgefuehrt: RA
2025 gegen NVA 2025 — **1156 EHH / 1160 FHH geprueft, 0 Abweichungen,
`bestanden === true`**. Das ist exakt die Rechnung aus D2.

Zur `dA.typ === "VA"`-Haelfte: liegt kein NVA des Jahres vor, ist der VA der
gueltige Plan und legitim als Basis. Weicht er ab, ist das die bekannte
Fassungsfrage, und der bestehende Abweichungstext (374-386) traegt das schon.
Ausgefuehrt gegen die Fixtures: VA-artige Basis gegen RA-Soll weicht auf
191 EHH / 231 FHH Stellen ab — das ist informativ, nicht falsch. **Kleine
offene Entscheidung fuer den Plan:** `dA.typ === "VA"` mit zulassen (empfohlen,
ehrlicher) oder nur NVA (weniger Rauschen).

**(c) `spalte` im RA-Fall.** Zeile 384 liefert `dB.spalte_vergleich` = `"VA
2025"` — laut D2 die irrefuehrende PDF-Beschriftung. Hier dieselbe D3-Regel
anwenden: bei `dB.typ === "RA"` -> `Soll ${dB.jahr} (laut RA)`. Ein
gemeinsames `interneBasisLabel(d)` bedient Frage 4 und diese Stelle.

**(d) Interner Modus: NICHT rechnen — das ist der gefaehrlichste Punkt des
Issues.** Im internen Modus ist `aggA.wert` per Konstruktion `aggB.vergleich`.
`kontrolle()` wuerde 0 Abweichungen finden und schreiben: **„Geprueft. Alle
1048 belegbaren Haushaltsstellen der Basis stimmen mit der Spalte „VA 2026"
des Vergleichsdokuments ueberein."** (`vergleich.js:348-357`) — eine
Tautologie, die wie ein Beweis aussieht. Genau das verbietet D1.

**Was das Panel dann zeigen soll.** D1: „im Kontroll-Panel steht stattdessen
ein Hinweis, dass ein geladenes Basisdokument sie ausloest, samt Angabe, welches
Dokument dafuer passt und ob es schon geladen ist." Empfohlene Form — der
Hinweis kommt **aus der Engine**, damit `vergleich.js` keine Fachlogik traegt:

```
// Rueckgabe im internen Modus — keine Pruefung, sondern ihre Voraussetzung.
{ modus: "intern",
  spalte: interneBasisLabel(dB),
  dokument: dB.label,
  ausloeser: { label: "VA 2026", geladen: true | false, id: number | null } }
```

Das ausloesende Dokument ist eine reine Funktion von `dokumente` und `b`:
dB=NVA -> der VA desselben Jahres; dB=VA -> der VA des Vorjahres; dB=RA -> der
NVA desselben Jahres, sonst der VA desselben Jahres. `geladen` = ob dieses
Dokument in `dokumente` steht.

**Wichtig fuer die Testlage:** `kontrolle` muss weiter **`null`** liefern, wo
gar keine Beziehung besteht (z. B. RA 2024 als Basis gegen NVA 2026, verifiziert
`null` und auch nach (b) noch `null`, weil `dA.typ === "RA"`). Nur der interne
Modus liefert das Objekt. Damit bleibt `run.mjs:1270-1277` gruen und
`vergleich.js:342-344` behaelt seinen `hidden`-Zweig — es kommt ein dritter
Zweig fuer `k.modus === "intern"` hinzu.

### 6 — Sichtbarkeit

**Die Stelle heute:** `web/js/vergleich.js:98`

```
const mehrere = (daten.dokumente || []).length >= 2
```

benutzt an **vier** Stellen: 101 (`tabBtn.hidden = !mehrere`), 103-105 (alle
`.gat-panel, .stats, .gat-callout` im Panel), 107-116 (Leer-Hinweis `.vgl-leer`
anlegen/entfernen), 118 (`if (!mehrere) return`). `vergleich.js` ist
Alleinbesitzer dieser Sichtbarkeit — `dashboard.js:94` (`activateTab`) macht
einen `hidden`-Knopf nicht wieder sichtbar.

**Die neue Bedingung:**

```
const docs = daten.dokumente || []
const vergleichbar =
  docs.length >= 2 ||
  docs.some((d) => hatVergleichsspalte(daten.posten, d.id))
```

**Traegt jeder Dokumenttyp eine brauchbare Vergleichsspalte? Nein.**

Gegen `loader.js:spalten()` (13-24) sieht es so aus: jeder Typ **benennt** eine
Spalte 2 — RA `VA ${jahr}`, NVA `VA ${jahr}`, VA `VA ${jahr-1}`. Der Name ist
aber kein Daten-Nachweis. Ausgefuehrt (Summe `|vergleich|` ueber alle
Schluessel):

| Dokument | Spalte-2-Name | EHH | FHH |
|---|---|---|---|
| RA 2024 | `VA 2024` | 44.209.200 | 53.937.200 |
| NVA 2025 | `VA 2025` | 45.265.000 | 64.611.500 |
| RA 2025 | `VA 2025` | 48.615.800 | 55.619.200 |
| VA 2026 | `VA 2025` | 45.265.000 | 64.611.500 |
| NVA 2026 | `VA 2026` | 44.607.400 | 69.675.900 |
| **OH-CSV VA 2026 (31912)** | `VA 2025` | **0** | **0** |

**Haben OH-CSV-Dokumente eine gefuellte Spalte 2? Nein — nachgewiesen.**
`offenerhaushalt_31912_2026_va_{ehh,fhh}.csv` durch `verarbeiteCsvDateien` +
`collect`: 3149 Posten, `ev != 0`: **0**, `fv != 0`: **0**, `ed != 0`: 0,
`fd != 0`: 0, `Summe|vergleich|` = **0**.

Ursache im Code:

- `HEADER` (`csv-parser.js:31-47`) hat 16 Spalten mit **einer** `Wert`-Spalte.
- `parseCsvBytes` setzt nur `eh_wert` bzw. `fh_wert` (`csv-parser.js:304-308`).
- Der Kommentar `csv-parser.js:330-333` sagt es ausdruecklich: „Spalten 2/3
  (eh_vergleich/eh_dritte, fh_vergleich/fh_dritte) liegen im OH-CSV nicht vor
  und bleiben 0."
- **Trotzdem** schreibt `dokumentDatensatz` (`loader.js:31`) via
  `spalten("VA", 2026)` weiter `spalte_vergleich = "VA 2025"`. Der Name
  existiert, die Daten nicht.

**Folge — die Pruefung MUSS datenbasiert sein.** Ein typbasiertes Gate („jeder
VA/NVA/RA hat eine Spalte 2") wuerde einem OH-CSV-Dokument eine interne Basis
anbieten und einen Diff erzeugen, dessen Basis ueberall 0 ist: **1016 Zeilen
„neu", still und falsch**, mit einer Kopfzeile, die „VA 2025 (laut VA)"
behauptet. Auch nicht auf `fassung === "OH-CSV"` pruefen — der Halb-Zustand
heisst `"OH-CSV (nur EHH)"` (`run.mjs:882-886`, `921-927`), das waeren zwei
Strings, die synchron bleiben muessten. Ausserdem ist `fassung` in
`DATA.dokumente` gar nicht enthalten (`dashboard-data.js:80-94`).

**Empfohlener Helfer** (exportiert aus `vergleich-daten.js`, weil er zur
Aggregationslogik gehoert):

```
// Traegt das Dokument in seiner zweiten Betragsspalte ueberhaupt Zahlen?
// Nicht am Typ und nicht am Spaltennamen entscheidbar: ein OH-CSV-Dokument
// traegt den Namen ("VA 2025"), aber keine Werte (csv-parser.js:330-333).
export function hatVergleichsspalte(posten, dokId, haushalt) {
  const id = String(dokId)
  for (const p of posten) {
    if (String(p.dok) !== id) continue
    if (haushalt !== "FHH" && (p.ev || 0) !== 0) return true
    if (haushalt !== "EHH" && (p.fv || 0) !== 0) return true
  }
  return false
}
```

Ohne `haushalt` heisst das „eine der beiden Haelften". Kosten: ein Durchlauf
ueber `DATA.posten` (6529 Posten bei fuenf Dokumenten) — vernachlaessigbar.
Alle fuenf PDFs haben **beide** Haelften gefuellt, der Halb-Fall tritt bei den
Fixtures nicht auf, ist aber beim CSV-Nachreichungspfad strukturell moeglich —
die Pruefung je Haelfte ist die ehrliche.

**Leer-Hinweis (107-116).** Der Text „Fuer einen Vergleich braucht es zwei
Dokumente — bitte ein weiteres laden (etwa den Voranschlag zum
Nachtragsvoranschlag)." trifft nicht mehr. Neue Bedingung: **weder** ≥2
Dokumente **noch** irgendein Dokument mit gefuellter Spalte. Mit den
vorhandenen Fixtures ist der einzige erreichbare Fall **ein einzelnes
OH-CSV-Dokument** — der Text sollte genau das benennen: eine OH-CSV bringt
keine Vergleichszahl mit, es braucht ein zweites Dokument.

**Anschlussfalle (F-hoch):** mit Sichtbarkeit ab einem Dokument wird
`fuelleAuswahl:136-137` erstmals mit einem Dokument erreicht —
`standardVergleich` liefert dort `null` (verifiziert) und der Fallback
`docs[docs.length - 2].id` ist `undefined` -> **TypeError**. Muss mit der
Sichtbarkeitsaenderung **im selben Schritt** behoben werden, sonst ist der Tab
sichtbar und wirft beim Aufbau.

### 7 — Tests

#### `tests/js/run.mjs` — was bricht

| Zeile | Testname | Bricht? | Warum / was zu tun |
|---|---|---|---|
| 1105-1112 | `default_vergleich ist VA 2026 -> NVA 2026` | **JA**, wenn D1 in `standardVergleich` implementiert wird (empfohlen) | Neu erwarten: `{ a: BASIS_INTERN, b: <NVA 2026 id> }`. Bei D1 in `fuelleAuswahl` bleibt der Test unberuehrt. |
| 1114-1116 | `standardVergleich mit einem Dokument liefert null` | **JA** | Mit einem Dokument **mit** Vergleichsspalte muss jetzt `{ a: BASIS_INTERN, b: 1 }` kommen. Achtung: der Test uebergibt ein **nacktes** Objekt `{id:1,typ:"VA",jahr:2026}` und **keine** `posten` — die neue Signatur muss ein fehlendes `posten` tolerieren. Test um einen zweiten Fall ergaenzen: ohne Vergleichsspalte weiter `null`. |
| 1118-1127 | `standardVergleich ohne NVA nimmt die zwei juengsten` | **Moeglich** | Ebenfalls nackte Objekte ohne `posten`. Bleibt gruen, wenn die Funktion ohne `posten` auf das heutige Verhalten zurueckfaellt. Explizit absichern. |
| 1129-1246 | Diff-Block EHH/FHH/Tausch | nein | Alle Aufrufe uebergeben explizite `a`/`b`-Dokument-Ids. |
| 1247-1268 | Kontroll-Block (Spalte, 2 Abweichungen, 200600, Ansatz 429000) | nein | Zwei-Dokumente-Pfad unveraendert. |
| 1270-1277 | `Kontrolle entfaellt fuer ein Paar, das sie nicht belegen kann` | nein | RA 2024 als Basis gegen NVA 2026 bleibt `null` — `dA.typ === "RA"` erfuellt kein Praedikat, auch nicht das neue `raSoll` (das fordert `dB.typ === "RA"`). Trotzdem beim Umbau bewusst nachpruefen. |
| 1280-1327 | Filter, CSV-Export, drei Chart-Vorlagen | nein | Arbeiten auf `dEhh`/`dFhh` aus dem Zwei-Dokumente-Pfad. |

#### `tests/e2e/vergleich.spec.mjs` — was bricht

| Zeile | Testname | Bricht? | Warum / was zu tun |
|---|---|---|---|
| **158-168** | `Vergleichs-Tab bleibt verborgen, solange nur ein Dokument geladen ist` | **JA, per Design** | Ausgefuehrt: VA 2026 allein hat 1116 EHH- / 1144 FHH-Posten mit gefuellter Spalte 2. Der Tab wird **sichtbar**. Ersetzen durch: (a) Tab ist mit nur dem VA **sichtbar**; (b) neuer Test — mit nur dem **OH-CSV-Paar** bleibt der Tab verborgen und der Leer-Hinweis steht (Upload-Pfad in `tests/e2e/csv-upload.spec.mjs`). |
| **52-77** | `Vorbelegung ist VA 2026 -> NVA 2026 mit Kennzahlen und Diagrammen` | **JA** | 57-60 erwartet in `#vgl-a` den `value` der VA-2026-Option; kuenftig steht dort der Sentinel. Anpassen. Die Assertions 61-63 (`#vgl-kopf` enthaelt `VA 2026`, `NVA 2026`, `Ergebnishaushalt`) halten weiter, wenn der Kopf „Basis VA 2026 (laut NVA) → Vergleich NVA 2026" schreibt. 66-76 (3 Karten, 3 Diagramme, Statuszeile) halten. |
| **142-155** | `Kontrolle gegen die abgedruckte Vergleichsspalte laeuft` | **JA** | Mit interner Vorbelegung laeuft die Pruefung nicht. Umschreiben: zuerst `#vgl-a` auf das geladene VA 2026 `selectOption`, dann wie bisher „Abweichung" + 2 `tbody`-Zeilen. **Plus neuer Test:** bei interner Vorbelegung ist das Panel sichtbar und nennt das ausloesende Dokument (D1). |
| **131-140** | `Richtungstausch dreht Basis und Vergleich` | **JA** | `#vgl-a` haelt den Sentinel; der Tausch-Knopf ist (Empfehlung) `disabled`. Umschreiben: erst das geladene VA 2026 waehlen, dann tauschen; `#vgl-th-a` -> `NVA 2026` gilt weiter. **Plus:** neuer Test, dass der Knopf im internen Modus `disabled` ist. |
| 79-99 | `Tabelle zeigt voreingestellt nur Veraenderungen` | **nein** (verifiziert) | Interner Diff EHH: 160 veraendert von 1048 Zeilen, `{neu 32, entfallen 6, geaendert 122, unveraendert 888}` — „alle" liefert also echt mehr. `#vgl-th-a` `toContainText('VA 2026')` trifft auch in „VA 2026 (laut NVA)"; `#vgl-th-b` unveraendert. |
| 101-117 | `Schwellwert-Filter und Volltextsuche wirken` | **nein** (verifiziert) | Interner Diff, Schwelle 100.000: 11 Zeilen (< 160); Ertraege +146.000 **und** Aufwendungen +280.400 ≠ 0, also erscheint „Saldoeffekt"; „kommunalsteuer" -> 1 Treffer „Kommunalsteuer", delta −200.000. |
| 119-129 | `Haushalts-Umschalter zeigt vier Kennzahlen im Finanzierungshaushalt` | **nein** (verifiziert) | Interner FHH-Diff: 178 bewegte Schluessel, investive Auszahlungen 13.361.100 -> 11.556.900. Vier Karten, vierte enthaelt „investive". |
| 35-50 | `Dokumente stehen in Entwicklungsreihenfolge, NVA ist Default` | nein | Betrifft den globalen Umschalter, nicht den Tab. |

#### Neue js-Tests (`tests/js/run.mjs`)

1. **Eckwerte des internen Diffs.** `baueDiff(posten, dokumente,
   { a: BASIS_INTERN, b: NVA2026.id, haushalt: "EHH" })` -> Ertraege-Delta
   **+790.300**, Aufwendungen-Delta **+502.200**, Nettoergebnis-Delta
   **+288.100** (= Anlage 1a, = Akzeptanzkriterium; ausgefuehrt bestaetigt).
2. **Zeile fuer Zeile gegen die abgedruckte Spalte 3.** Fuer jeden Schluessel
   `delta === Math.round(ed)` (EHH) bzw. `fd` (FHH): **160 EHH / 178 FHH**
   Schluessel mit Bewegung, **0 Abweichungen** (ausgefuehrt). Mindestens NVA
   2026 pinnen; RA 2025 (1270 EHH / 1267 FHH, 0 Abweichungen) als zweiter Typ
   ist billig und deckt den RA-Fall mit ab.
3. **Kein Mutations-Leck (F2).** Nach dem internen `baueDiff` muss ein
   Zwei-Dokumente-`baueDiff` auf denselben `posten` unveraenderte Zahlen
   liefern; und `wasserfall.nach` des internen Diffs muss **761.700** sein (der
   Saldo aus Spalte 1, schon in `run.mjs:1170` gepinnt). Faellt ohne Klon.
4. **Keine Tautologie-Kontrolle (F1).** Interner Diff -> `kontrolle.modus ===
   "intern"`, **nicht** `bestanden === true`, und `kontrolle.ausloeser.label`
   nennt „VA 2026" mit `geladen: true/false`.
5. **Die D2-Korrektur.** `baueDiff({ a: NVA2025.id, b: RA2025.id })` ->
   `kontrolle !== null`, `geprueft === 1156` (EHH) bzw. `1160` (FHH),
   `abweichungen.length === 0`, `bestanden === true` (ausgefuehrt bestaetigt).
   Zusatz: `kontrolle.spalte === "Soll 2025 (laut RA)"`.
6. **`hatVergleichsspalte`.** `true` fuer alle fuenf PDFs in beiden Haelften;
   **`false`** fuer das gemergte OH-CSV-Dokument (31912). Der CSV-Testabschnitt
   (`run.mjs:879-920`) baut die dafuer noetige isolierte `:memory:`-DB schon.
7. **`standardVergleich`.** Mit nur dem NVA 2026 (+ `posten`) ->
   `{ a: BASIS_INTERN, b: id }`; mit nur einem OH-CSV-Dokument -> `null`; ohne
   `posten` -> heutiges Verhalten.
8. **`interneBasisLabel`.** NVA 2026 -> `"VA 2026 (laut NVA)"`; RA 2025 ->
   `"Soll 2025 (laut RA)"`; VA 2026 -> `"VA 2025 (laut VA)"`.
9. **CSV-Export.** `alsCsv(zeilenIntern.slice(0,3), "VA 2026 (laut NVA)", "NVA
   2026")` — Kopfzeile traegt das interne Label, weiter 14 Spalten.
10. **Wasserfall-Beschriftung.** `chartDiffWasserfall(diffIntern, "VA 2026
    (laut NVA)", "NVA 2026")` — erste und letzte `xAxis`-Kategorie.

#### Neue e2e-Tests (`tests/e2e/vergleich.spec.mjs`)

- **Nur den NVA 2026 laden** (neue Ladehilfe neben `ladePaar`): Tab sichtbar;
  `#vgl-kopf` enthaelt „laut NVA"; `#vgl-a` haelt den Sentinel; 3
  Kennzahlen-Karten; 3 Diagramme gerendert; `#vgl-th-a` traegt das interne
  Label; `#vgl-kontrolle-panel` sichtbar mit dem Ausloeser-Hinweis (nicht
  „Geprueft"); `#vgl-tausch` `disabled`.
- **Mit beiden PDFs: interne Vorbelegung (D1)** — `#vgl-a` haelt den Sentinel,
  obwohl VA 2026 geladen ist; die VA-2026-Option ist waehlbar; nach dem
  Umschalten erscheint die Selbstkontrolle mit 2 `tbody`-Zeilen.
- **Nur das OH-CSV-Paar laden:** Tab `hidden`, `.vgl-leer` sichtbar.
- **CSV-Name:** Klick auf `#vgl-csv` im internen Modus, Download-Name enthaelt
  die Herkunft (Playwright `page.waitForEvent('download')`).

#### Doku (D4)

- `docs/BROWSER-APP.md:118-120` — die widerlegte RA-Begruendung entfernen und
  durch die D2-Erkenntnis ersetzen (Soll = Voranschlag inkl. Nachtrag, belegt
  an RA 2025 gegen NVA 2025).
- `docs/BROWSER-APP.md:87-117` — den internen Modus beschreiben: Herkunft,
  Beschriftungsregel, warum die interne Spalte die Vorbelegung ist, warum
  OH-CSV ihn nicht anbietet.
- `docs/BROWSER-APP.md:76-81` (Spaltentabelle) — vermerken, welche Spalte 3
  eine **Differenz** ist (NVA, RA) und welche nicht (VA).
- `web/index.html:365-371` Ueberschrift/Lead und `:400-406`
  Kontroll-Panel-Notiz sprechen von „zwei Dokumenten" und muessen mitziehen.

---

## Standard Stack

Keine neue Bibliothek. Der Bestand bleibt unveraendert:

| Baustein | Version | Zweck | Warum Standard | Confidence |
|---|---|---|---|---|
| ECharts (CDN jsDelivr) | 5.5.1 | Diagramme | bereits eingebunden, `web/index.html:22` | HIGH |
| Design-System CSS (CDN) | — | Optik | `web/index.html:21`, CLAUDE.md verlangt CDN | HIGH |
| `@sqlite.org/sqlite-wasm` | ^3.50.1-build1 | Datenhaltung | `package.json` | HIGH |
| `mupdf` | ^1.26.0 | PDF-Parsing | `package.json` | HIGH |
| `@playwright/test` | ^1.60.0 | e2e | `package.json` | HIGH |

### Alternatives Considered

| Statt | Koennte man | Abwaegung |
|---|---|---|
| Sentinel in `a` | drittes Feld `modus: "intern"` | Zwei Felder fuer einen Zustand — `{ a: 5, modus: "intern" }` ist widerspruechlich und muesste in `zustand`, `fuelleAuswahl`, `rechneUndZeichne`, `ladeCsv` mitgeprueft werden. **Sentinel gewinnt.** |
| Sentinel in `a` | `a: null` als „intern" | `null` heisst in `zustand` (28-29) schon „noch nichts gewaehlt". Doppelbedeutung. |
| `hatVergleichsspalte` datenbasiert | Pruefung auf `typ` | Empirisch falsch: OH-CSV ist `typ: "VA"` mit leerer Spalte 2. |
| `hatVergleichsspalte` datenbasiert | Pruefung auf `fassung === "OH-CSV"` | Proxy statt Sache; Halb-Zustand `"OH-CSV (nur EHH)"`; `fassung` fehlt in `DATA.dokumente`. |
| D1 in `standardVergleich` | D1 in `fuelleAuswahl` | Kein js-Test bricht — aber Vorbelegungslogik an zwei Orten und nur per e2e pruefbar. |
| `kontrolle` liefert `{ modus: "intern", ... }` | `kontrolle: null` + Fachlogik in `vergleich.js` | Die Oberflaeche muesste wissen, welches Dokument die Pruefung ausloest — Domaenenlogik im DOM-Modul. |
| Tausch-Knopf `disabled` | Tausch wechselt auf das geladene Basisdokument | Zweite Bedeutung fuer einen Knopf; genau die Sorte Doppeldeutigkeit, die `vergleich.js:12-15` fuer den Dokument-Umschalter ausdruecklich vermeidet. |

## Don't Hand-Roll

| Problem | Nicht bauen | Stattdessen | Warum |
|---|---|---|---|
| Basis-Werte je Haushaltsstelle | zweite Aggregation | `aggregiereDokument()` `vergleich-daten.js:55` — liefert `wert` **und** `vergleich` | genau dafuer wurde `vergleich` gesammelt |
| Diff-Zeilen, Status, Prozent | zweiter Rechenweg | Block `vergleich-daten.js:123-160` | Issue-Constraint „keine zweite Rechenlogik" |
| Kennzahlen/Gruppen/Treemap/Wasserfall | neue Aggregatoren | `eckwerte` 186, `gruppenDelta` 227, `treemapDelta` 245, `wasserfall` 277 | lesen nur `zeilen` |
| Filter, CSV | neue Serialisierer | `filtereZeilen` 406, `alsCsv(zeilen, labelA, labelB)` 431 | schon label-agnostisch |
| Wasserfall-Beschriftung | neue Chart-Funktion | `chartDiffWasserfall(diff, labelA, labelB)` `dashboard-charts.js:1443` | nimmt Labels als Parameter |
| Spaltenname/Jahr/Typ | PDF neu lesen, String parsen | `d.spalte_vergleich`, `d.typ`, `d.jahr` aus `DATA.dokumente` | beim Import persistiert (`loader.js:31`) |
| Kollisionsfreier Sentinel | UUID, Praefix-Schema | fester String; `dokument_id` ist `INTEGER PRIMARY KEY` | Kollision strukturell ausgeschlossen |
| „Hat das Dokument eine Spalte 2?" | Typ-/Namenspruefung | `hatVergleichsspalte(posten, dokId, haushalt)` ueber `ev`/`fv` | Name existiert ohne Daten (OH-CSV) |

## Architecture Patterns

### Recommended Approach

1. **`vergleich-daten.js`** — `BASIS_INTERN` exportieren; `interneBasis(aggB)`
   als **klonende** Projektion; `baueDiff` dreht 120-121 und verzweigt in vier
   Zeilen; `interneBasisLabel(d)` und `hatVergleichsspalte(posten, dokId,
   haushalt)` exportieren; `kontrolle()` — Kommentar 334-336 weg, `raSoll`-Fall
   dazu, `spalte` beim RA ueber `interneBasisLabel`, interner Modus liefert
   `{ modus: "intern", ausloeser }`.
2. **`dashboard-data.js`** — `standardVergleich(dok, posten)`: interne Spalte
   gewinnt (D1), `posten` optional.
3. **`vergleich.js`** — Sichtbarkeitsbedingung (98) datenbasiert; `fuelleAuswahl`
   um den internen Eintrag und einen 1-Dokument-taugliche Vorbelegung; `vgl-b`
   baut die Basis-Auswahl neu; ein `basisLabel()`/`basisSpalte()`-Paar fuer
   Kopf (282, 286, 291), Kennzahlen (330), Wasserfall (407) und CSV (572, 581);
   dritter Zweig in `zeichneKontrolle`; Tausch-Knopf im internen Modus
   `disabled`.
4. **`web/index.html`** — Ueberschrift/Lead (365-371) und Kontroll-Notiz
   (400-406) nachziehen.
5. **Tests** — Frage 7.
6. **`docs/BROWSER-APP.md`** — D4-Nachzug inkl. Entfernen von 118-120.

Die Reihenfolge ist bewusst „Engine zuerst": Schritt 1 ist vollstaendig in
Node testbar (`npm run test:js`), ohne Browser. Schritt 3 ist danach reine
Verdrahtung gegen eine bereits belegte Engine.

### Anti-Patterns to Avoid

- **Ein zweites `baueDiffIntern()`.** Verstoesst direkt gegen den
  Issue-Constraint und verdoppelt fuenf Aggregatoren.
- **`kontrolle()` im internen Modus laufen lassen.** Tautologie, die wie ein
  Beweis aussieht (F1).
- **`aggB` in-place umschreiben.** Zerstoert die Vergleichsseite still (F2).
- **Typ- oder namensbasiertes Gating.** Empirisch falsch fuer OH-CSV.
- **Beschriftung an vier Stellen einzeln zusammensetzen.** Ein Helfer, sonst
  laufen Kopf, Tabellenkopf, Achse und CSV auseinander — genau das, was das
  Akzeptanzkriterium verhindern soll.
- **Ein zweites Zustandsfeld neben `a`.** Zwei Quellen fuer einen Zustand.
- **Den Tausch-Knopf umdeuten.** Doppelbedeutung; `vergleich.js:12-15` lehnt
  genau dieses Muster fuer den Dokument-Umschalter explizit ab.

## Common Pitfalls

### Die Tautologie-Kontrolle
**Was schiefgeht:** `kontrolle()` laeuft im internen Modus und meldet
„Geprueft. Alle 1048 belegbaren Haushaltsstellen stimmen ueberein."
**Warum:** `aggA.wert` ist dort per Konstruktion `aggB.vergleich` — die
Pruefung vergleicht eine Zahl mit sich selbst.
**Vermeidung:** `baueDiff` ruft `kontrolle()` im internen Modus nicht auf;
stattdessen `{ modus: "intern", ausloeser }`.
**Warnzeichen:** `kontrolle.geprueft` entspricht der Zeilenzahl des Diffs
(1048) statt einer kleineren belegbaren Menge; `abweichungen.length === 0` bei
jedem Dokument.

### Die mutierte Basis-Map
**Was schiefgeht:** ueberall `delta === 0`, `wasserfall.nach` falsch, Treemap
leer.
**Warum:** `aggA` wurde durch `e.wert = e.vergleich` auf `aggB` gebildet —
`wert` und `vergleich` sind danach dasselbe Objekt.
**Vermeidung:** expliziter Klon (`{ ...e, wert: e.vergleich, vergleich: 0 }`).
**Warnzeichen:** `status.unveraendert === status.gesamt`; `wasserfall.von ===
wasserfall.nach`.

### Das typbasierte Gate
**Was schiefgeht:** ein OH-CSV-Dokument bekommt eine interne Basis; der Diff
zeigt 1016 Zeilen „neu" mit Basis 0.
**Warum:** `spalte_vergleich` wird immer geschrieben (`loader.js:31`), die
Daten fehlen (`csv-parser.js:330-333`).
**Vermeidung:** `hatVergleichsspalte` ueber `ev`/`fv`.
**Warnzeichen:** `eckwerte[0].a === 0`; Statusverteilung fast nur „neu".

### Der `undefined`-Fallback in `fuelleAuswahl`
**Was schiefgeht:** TypeError beim Aufbau, sobald der Tab mit **einem**
Dokument sichtbar wird.
**Warum:** `standardVergleich` liefert `null` (verifiziert), Zeile 136-137
greift `docs[docs.length - 2].id` = `docs[-1]`.
**Vermeidung:** Sichtbarkeit und Vorbelegung im **selben** Schritt aendern.
**Warnzeichen:** leerer Tab bei genau einem Dokument, Fehler in der Konsole.

### Der veraltete interne Auswahleintrag
**Was schiefgeht:** nach einem `#vgl-b`-Wechsel steht im Basis-Select noch
„VA 2026 (laut NVA)", obwohl `b` nun der RA 2025 ist.
**Warum:** `vgl-b`-Handler (180-183) ruft `fuelleAuswahl` nicht.
**Vermeidung:** Basis-Auswahl bei jedem `b`-Wechsel neu aufbauen.
**Warnzeichen:** Kopfzeile und Select-Label widersprechen sich.

### Der Richtungstausch mit Sentinel
**Was schiefgeht:** leere Ansicht ohne Fehlermeldung.
**Warum:** der Sentinel landet in `b`; `aggregiereDokument(posten, "intern",
hh)` liefert eine leere Map.
**Vermeidung:** Knopf im internen Modus `disabled`.
**Warnzeichen:** `diff.zeilen.length === 0`, alle Karten 0 EUR.

### Der Klammer-Dateiname
**Was schiefgeht:** `vergleich_va-2026-(laut-nva)_nva-2026_ehh.csv`.
**Warum:** `ladeCsv` 580-583 ersetzt nur Whitespace.
**Vermeidung:** eigene Kurzform fuer den Dateinamen (Klammern entfernen).
**Warnzeichen:** Klammern im Download-Namen.

## Environment Availability

| Abhaengigkeit | gebraucht von | vorhanden | Version | Rueckfall |
|---|---|---|---|---|
| Node | `npm run test:js` | ja | v26.8.1 | — |
| `node_modules` **im Worktree** | Tests | **nein** — Node loest nach oben auf `<repo>/node_modules` auf | — | `npm install` im Worktree, falls der Haupt-Checkout aufraeumt |
| `@sqlite.org/sqlite-wasm`, `mupdf` | Tests | ja (ueber den Haupt-Checkout) | s. `package.json` | — |
| Loader-Shim | `npm run test:js` | ja | `tests/js/gat-charts-shim.mjs` (`package.json:test:js`) | — |
| Playwright | e2e | ja | 1.60.0 | — |
| Python | `pytest`, `ruff`, `mypy` | ja | 3.13.5 | — |
| Fixtures | Tests | ja | 5 PDFs + 2 OH-CSV-Paare in `documents/` | — |
| Netz (ECharts/DS per CDN) | e2e-Rendering | vorausgesetzt | — | CLAUDE.md: kein Offline-Ziel |

## Project Constraints (from CLAUDE.md)

Aus `/Users/florianmotlik/Code/GrueneAT/web-apps/CLAUDE.md` (Workspace) und
`<worktree>/CLAUDE.md` (Repo):

- **Immer im Worktree arbeiten, nie am `main`-Checkout.** Worktrees entstehen
  nur ueber `issue-cli`. Aenderungen gehen per **PR** nach `main`.
- **Kein Vendoring von Drittabhaengigkeiten.** ECharts, Design-System,
  Schriften per CDN oder Package Manager. Legacy `web/vendor/...` ist Altlast.
  → Fuer diesen Issue irrelevant: keine neue Abhaengigkeit.
- **Es gibt kein Offline-Ziel.** Nichts einbetten oder buendeln.
- **Browser-App: Vanilla JavaScript, ESM, kein Build-Schritt.** → Der Modus
  bleibt in `vergleich-daten.js` / `vergleich.js`; kein Bundler, kein
  Transpiler, keine neue Datei noetig.
- **Deutsch in UI-Texten und Code-Bezeichnern.** → `BASIS_INTERN`,
  `interneBasis`, `interneBasisLabel`, `hatVergleichsspalte`, `basisLabel`,
  `ausloeser`, `modus` passen in den Bestand (`zustand`, `fuelleAuswahl`,
  `rechneUndZeichne`, `zeichneKopf`).
- **Keine Werkzeug-Attribution** in Commits, Code oder Kommentaren.
- **Tests muessen gruen bleiben:** `npm run test:js`,
  `PYTHONPATH=src pytest -q`, `ruff check src tests`, `mypy src`. Dazu
  `npx playwright test`. → Die Python-Seite ist von diesem Issue nicht
  betroffen (per grep geprueft), muss aber gruen bleiben.
- **Conventional Commit** (ISSUE.md-Constraint).
- **Deployment** ueber GitHub Pages bei jedem Push auf `main`.

Keine Empfehlung dieser Recherche widerspricht einer dieser Direktiven.

## Sources

### HIGH confidence
- Codebase-Analyse: `web/js/vergleich-daten.js`, `vergleich.js`,
  `dashboard-data.js`, `dashboard-charts.js`, `loader.js`, `csv-parser.js`,
  `dashboard-app.js`, `dashboard.js`, `web/index.html`, `web/schema.sql`,
  `tests/js/run.mjs`, `tests/e2e/vergleich.spec.mjs`, `docs/BROWSER-APP.md`
  (jeweils mit Zeilenangabe belegt).
- **Ausgefuehrte Messungen** gegen die echten Fixtures, Pfad
  `verarbeitePdf`/`verarbeiteCsvDateien` -> `collect` ->
  `aggregiereDokument`/`baueDiff`, gefahren mit
  `node --import ./tests/js/gat-charts-shim.mjs`: interner Diff gegen Spalte 3
  (5 Dokumente x 2 Haelften), Eckwerte NVA 2026 EHH/FHH, Zeilenzahlen intern
  vs. zwei Dokumente, D2-Nachrechnung RA 2025 gegen NVA 2025, Spiegelfall
  VA 2026 Spalte 2 gegen NVA 2025, OH-CSV-Spalte-2-Fuellung,
  Filter-/Suchverhalten auf dem internen Diff, `standardVergleich` mit einem
  Dokument, `kontrolle()` fuer NVA-2025->RA-2025. Rohdaten in
  `research/pitfalls.md`.
- `git log` (`d3b0511`, PR #36 gemerged; keine offenen Aenderungen auf den
  Kerndateien).
- `CLAUDE.md` (Workspace und Repo), `ISSUE.md`, `CONTEXT.md`.

### MEDIUM confidence
- Die Empfehlung, `dA.typ === "VA"` im neuen `raSoll`-Praedikat mitzuzulassen:
  fachlich schluessig (ohne NVA ist der VA der gueltige Plan) und durch die
  Fixtures illustriert (191 EHH / 231 FHH Abweichungen = Nachtragseffekt), aber
  eine Abwaegung, keine Messung.
- Die Empfehlung, D1 in `standardVergleich` statt in `fuelleAuswahl` zu
  verorten: Testbarkeitsargument, keine Messung.

### LOW confidence (needs validation)
- **Nichts.** Es wurde keine Behauptung aus Trainingswissen uebernommen; alle
  Datenaussagen sind ausgefuehrt, alle Codeaussagen mit `pfad:zeile` belegt.

### Bekannte Unstimmigkeit (offen benannt)
CONTEXT.md D2 nennt fuer „RA-Soll gegen NVA-Spalte 2" **138 Posten /
16.083.400 EUR**; meine je-Haushalt getrennte Nachrechnung ergibt **191
Posten / 9.211.600 EUR (EHH)** und **231 / 18.238.700 (FHH)**. Die Richtung
ist in beiden Rechnungen identisch und eindeutig (Spalte 1 = 0 Abweichungen,
Spalte 2 = viele) — die Zaehlweise unterscheidet sich (D2 hat EHH und FHH
offenbar in einem Schluesselraum gezaehlt). **Die Entscheidung D2 ist davon
nicht beruehrt.** Wird die Zahl in `docs/BROWSER-APP.md` zitiert, sollte die
Zaehlweise mit dabeistehen.

## Metadata

**Confidence breakdown:**

| Bereich | Level | Grund |
|---|---|---|
| Codebase / Interfaces | HIGH | vollstaendig gelesen, jede Aussage mit Zeilenangabe |
| Datenaussagen (Spalte 2/3, Eckwerte, OH-CSV) | HIGH | ausgefuehrt gegen die echten Fixtures |
| `baueDiff`-Signatur | HIGH | folgt aus der Datenflussanalyse: nur `kontrolle()` liest die Aggregate |
| D2-Bestaetigung | HIGH | unabhaengig nachgerechnet, 0 Abweichungen in beiden Haelften |
| Testbruch-Liste | HIGH | jede Bruch-/Nicht-Bruch-Aussage gegen die internen Diff-Werte geprueft |
| Beschriftungsregel | HIGH (Form aus D3 gesetzt) | gegen alle fuenf Fixtures gerendert |
| `raSoll` mit `dA.typ === "VA"` | MEDIUM | Abwaegung, keine Messung |
| Ort der D1-Vorbelegung | MEDIUM | Abwaegung, keine Messung |
| Ecosystem / neue Bibliotheken | HIGH (N/A) | kein Bedarf; Bestand per CDN/npm belegt |

**Research date:** 2026-09-28
**Sub-agents used:** keine — das `Agent`-Werkzeug stand in dieser Umgebung
nicht zur Verfuegung. Die drei Mandate (CODEBASE, ECOSYSTEM, PITFALLS) wurden
sequenziell durchgefuehrt und getrennt abgelegt.
**Raw research files:** `.issues/n8vmb-vergleich-aus-einem-dokument-die-abgedruckte-vergleichsspalte-als-basis/research/`
(`codebase.md`, `ecosystem.md`, `pitfalls.md`)
**MAP.md:** nicht vorhanden (`.issues/MAP.md` existiert nicht) — Orientierung
kam aus der direkten Codelektuere.
