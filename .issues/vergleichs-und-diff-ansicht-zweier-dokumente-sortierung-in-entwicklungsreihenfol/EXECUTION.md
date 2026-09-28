# Execution: Vergleichs- und Diff-Ansicht zweier Dokumente, Sortierung in Entwicklungsreihenfolge

**Started:** 2026-09-28T11:50:00Z
**Status:** complete
**Branch:** issue/vergleichs-und-diff-ansicht-zweier-dokumente-sortierung-in-entwicklungsreihenfol

> Hinweis zur Entstehung: die Arbeit lief interaktiv aus einem Vorschlag
> heraus, nicht ueber `/issue:research` -> `/issue:plan` -> `/issue:execute`.
> ISSUE.md und diese Datei sind nach der Umsetzung aus den Commits und den
> tatsaechlichen Testlaeufen geschrieben. Es gibt deshalb keine RESEARCH.md
> und keine PLAN.md.

## Execution Log

- [x] Herzogenburg-Fixtures ergaenzt: NVA 2026 (PDF) und beschlossener
      VA 2026 (OH-CSV-Paar EHH/FHH) — commit 3d1fd92
  - Erst damit gibt es ein VA/NVA-Paar desselben Jahres im Repo.
- [x] Entwicklungsreihenfolge VA -> NVA -> RA an einer Stelle definiert und
      alle drei Sortier-Stellen darauf umgestellt — commit 9e81ccb
  - `TYP_RANG`, `TYP_ORDER_SQL`, `typRang`, `vergleicheDokumente` in
    `web/js/reference.js`; bezogen von `dashboard-data.js` und `db.js`.
  - Vorbelegung auf das juengste gueltige Planungsdokument umgestellt.
  - Budgetierungspolster gilt jetzt auch fuer NVA; `data-typ-panel` nimmt
    dafuer eine Komma-Liste ("VA,NVA").
  - Dokumentlabels auf die Kurzform ("NVA 2026" statt "VA 2026 inkl. NVA"),
    weil die lange Form im Umschalter direkt neben "VA 2026" steht und auf
    einen Blick nicht zu unterscheiden ist.
- [x] Vergleichs-Tab mit Diff-Engine, fuenf Sichten und Selbstkontrolle —
      commit d3b0511
  - `web/js/vergleich-daten.js` (rein rechnend, ohne DOM) und
    `web/js/vergleich.js` (Oberflaeche); Diagramm-Vorlagen in
    `dashboard-charts.js` neben den bestehenden Buildern.

## Verification Results

**js (`npm run test:js`):** 185 bestanden, 0 fehlgeschlagen (vorher 143).
Neu darunter: Entwicklungsreihenfolge (`typRang`, `vergleicheDokumente`,
DATA.dokumente, `default_dok`, `standardVergleich`), Eindeutigkeit des
VRV-Schluessels, die Diff-Kennzahlen gegen die Summenzeilen der Anlage 1a,
Wasserfall-Abstimmung, Filter, CSV-Export und die drei Diagramm-Vorlagen.

**e2e (`npx playwright test`):** 66 passed, 27 skipped, 0 failed. Die 27
Skips sind die Korpus-Tests (Opt-in ueber Umgebungsvariablen, liefen auch
vorher nicht mit). Neu: `tests/e2e/vergleich.spec.mjs` mit 8 Tests gegen den
ausgelieferten Zustand ueber `scripts/serve.mjs`.

**Python (`pytest -q`):** 34 passed. Der neue Fixture-PDF verschiebt nichts —
`HERZOGENBURG_PDFS` in `tests/test_parser.py` ist explizit gepinnt.

**mypy:** Success, no issues in 8 source files.
**ruff:** 6 Findings (B008 in `parser.py`, RUF in `extract.py`) — identisch
auf `main`, nicht von dieser Aenderung verursacht.

**Fachliche Gegenprobe gegen die Quelle.** Mit dem beschlossenen VA 2026
(OH-CSV) als Basis gegen den NVA 2026 meldet die Selbstkontrolle
„Geprueft. Alle 1 016 belegbaren Haushaltsstellen stimmen mit der Spalte
,VA 2026' ueberein" — fuer EHH und FHH. Die Kennzahlen decken sich exakt mit
den Summenzeilen der Anlage 1a (Seite 19) des NVA-PDF:

| Kennzahl | VA 2026 | NVA 2026 | Delta |
|---|---|---|---|
| Ertraege | 22.540.500 | 23.330.800 | +790.300 |
| Aufwendungen | 22.066.900 | 22.569.100 | +502.200 |
| Nettoergebnis | 473.600 | 761.700 | +288.100 |
| investive Auszahlungen | 13.361.100 | 11.556.900 | -1.804.200 |

**Visuelle Pruefung** im Browser (Chromium, 1500px): Kennzahlen, Wasserfall,
Treemap, Gruppen-Diagramm, Kontroll-Panel und Diff-Tabelle je einzeln als
Screenshot geprueft. Dabei zwei Darstellungsfehler gefunden und behoben
(siehe unten).

## Deviations from Plan

### Auto-fixed

- **Budgetierungspolster bei NVA.** Mit der neuen Vorbelegung (NVA statt VA)
  waeren die beiden Polster-Panels im Sparpotenzial-Tab verschwunden, weil
  `data-typ-panel="VA"` strikt auf den Typ prueft. Das waere eine Regression
  durch die Sortier-Aenderung gewesen, also mitbehoben: `aggregateDok` fuellt
  `polster` auch fuer NVA, und `data-typ-panel` nimmt eine Komma-Liste.

- **Wasserfall-Beschriftung.** Erste Fassung zeigte `NaNk` — das Datenlabel
  bekommt in ECharts das params-Objekt, nicht den nackten Wert wie ein
  `axisLabel`-Formatter. Danach zeigte es den Betrag ohne Vorzeichen; ein
  Clay-Balken mit „297k" liest sich wie ein Zuwachs. Der vorzeichenbehaftete
  Beitrag faehrt jetzt am Datenpunkt mit.

- **Summenzeile der Diff-Tabelle.** Erste Fassung addierte Ertrags- und
  Aufwandsaenderungen zu einer Zahl. Ein Mehrertrag von 100.000 und ein
  Mehraufwand von 100.000 ergeben zusammen aber nicht 200.000, sondern heben
  sich im Saldo auf. Die Zeile weist beide jetzt getrennt aus, plus
  Saldoeffekt.

- **Mehrdeutige Ansatz-Labels** im Wasserfall: zwei Ansaetze tragen den Text
  „Sonstige Einrichtungen und Massnahmen" und waren im gekuerzten Achsenlabel
  nicht zu unterscheiden. Der Ansatz-Code steht jetzt davor.

### Blocked

Keine.

## Discovered Issues

**Der gepinnte `VA-2026-Auflage.pdf` ist nicht die beschlossene Fassung.**
Die Selbstkontrolle findet mit ihm als Basis zwei Abweichungen ueber
zusammen 200.600 EUR: Ansatz 429000 „Community Nurse" (Ausgabe 100.600) und
„Foerderung Community Nurse" (Einnahme 100.000). Die Vergleichsspalte des
Nachtrags fuehrt beide, das aufgelegte PDF nicht — die Auflage-Fassung ist
aelter als die beschlossene. Das beschlossene OH-CSV-Paar stimmt dagegen auf
allen 1 070 Haushaltsstellen exakt mit der Vergleichsspalte des Nachtrags
ueberein.

Kein Fehler im Werkzeug, sondern genau der Fall, den die Kontrolle finden
soll. Beide Fassungen liegen jetzt als Fixtures im Repo und decken beide
Kontroll-Ausgaenge ab (bestanden / Abweichung).

**ruff meldet 6 Findings in `src/`** (B008 in `parser.py`,
RUF-Regeln in `extract.py`), identisch auf `main`. Vermutlich eine neuere
ruff-Version als die, gegen die der Code geschrieben wurde. Ausserhalb des
Scopes, nicht angefasst.

## Self-Check

- [x] Dokumente stehen in Entwicklungsreihenfolge — im e2e-Test gegen
      Umschalter und Dokumentliste nachgewiesen
- [x] Vorbelegung ist das juengste gueltige Planungsdokument (NVA vor VA)
- [x] Vergleichs-Tab vorbelegt mit dem VA/NVA-Paar desselben Jahres
- [x] EHH/FHH getrennt umschaltbar; FHH zeigt vier Kennzahlen inkl.
      investiver Auszahlungen, EHH drei
- [x] Alle fuenf Sichten vorhanden, Canvas-Rendering im e2e geprueft
- [x] Diff-Tabelle filterbar, sortierbar, CSV-Export vorhanden
- [x] Selbstkontrolle rechnet nach und meldet die Fassungsdifferenz
- [x] Kennzahlen stimmen mit der Anlage 1a des NVA ueberein
- [x] js-, e2e- und Python-Suite gruen
- [x] Kein TODO/FIXME/console.log/debugger in den neuen Dateien
- [x] Keine Drittbibliothek ins Repo kopiert; kein Build-Schritt ergaenzt
- [x] Keine Werkzeug-Attribution in Commits oder Code
- **Result:** PASSED

**Completed:** 2026-09-28T12:35:00Z
**Commits:** 3
