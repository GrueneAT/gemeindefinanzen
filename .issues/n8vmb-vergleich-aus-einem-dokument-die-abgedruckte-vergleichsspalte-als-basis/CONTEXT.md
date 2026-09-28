# Context: Vergleich aus einem Dokument

Entscheidungen aus der Discuss-Phase, bevor Recherche und Plan beginnen.

## D1 — Vorbelegung: die dokumentinterne Spalte gewinnt

**Entscheidung:** Traegt das Vergleichsdokument eine Vergleichsspalte, ist
diese die Basis-Vorbelegung — auch dann, wenn das passende zweite Dokument
geladen ist.

**Warum:** Sie ist per Definition die Fassung, gegen die das Dokument rechnet.
Ein separat geladenes Dokument kann eine andere Fassung sein; genau das zeigt
der Herzogenburger `VA-2026-Auflage.pdf`, dem gegenueber der Spalte des
Nachtrags die Community Nurse fehlt (200.600 EUR).

**Folge:** Die Selbstkontrolle laeuft nicht mehr automatisch mit. Das
Kontroll-Panel muss deshalb erklaeren, wodurch sie ausgeloest wird — naemlich
dadurch, dass man ein geladenes Dokument als Basis waehlt.

## D2 — Der Rechnungsabschluss: Frage empirisch geklaert

**Offene Frage war:** Enthaelt die Spalte 2 eines RA ("VA Jahr", das Soll) den
Nachtrag oder den urspruenglichen Voranschlag? Aus dem Seitenkopf ist das
nicht zu entscheiden.

**Gepruft** an den Herzogenburg-Fixtures `RA-2025-Auflage.pdf` und
`NVA-2025-Auflage.pdf`, je Haushaltsstelle ueber (Ansatz, Konto, Richtung),
EHH und FHH:

| Vergleich | Schluessel | Abweichungen |
|---|---|---|
| RA-Soll gegen NVA-Spalte 1 ("VA 2025 inkl. NVA") | 1208 vs 1208 | **0** |
| RA-Soll gegen NVA-Spalte 2 ("VA 2025", original) | 1208 vs 1187 | 138 Posten, 16.083.400 EUR |

Aggregiert ebenso deckungsgleich: Ausgaben 23.630.200, Einnahmen 24.985.600.

**Zaehlweise:** oben ist ein Schluessel (Ansatz, Konto, Richtung) einmal
gezaehlt, mit Ergebnis- und Finanzierungshaushalt als Wertepaar. Zaehlt man
die Haushaltshaelften getrennt, lauten dieselben Zahlen 191 Posten /
9.211.600 EUR im Ergebnis- und 231 / 18.238.700 EUR im Finanzierungshaushalt
(so in RESEARCH.md). Richtung und Schlussfolgerung sind identisch — wer die
Zahl zitiert, nennt die Zaehlweise dazu.

**Ergebnis:** Das Soll eines RA ist der Voranschlag **inklusive Nachtrag**.
Die Spalte ist eindeutig; irrefuehrend ist nur ihre Beschriftung im PDF, die
den Nachtrag verschweigt.

**Entscheidung:** Der RA bekommt den internen Modus ohne Sonderwarnung. Seine
Basis heisst aber **nicht** wie im Dokument abgedruckt, sondern neutral und
zutreffend — "Soll 2025 (laut RA)". Das stimmt in beiden Faellen, mit und
ohne Nachtrag.

**Spiegelfall (aus der Recherche):** Beim **Voranschlag** ist es umgekehrt —
seine Spalte 2 ist der Vorjahres-VA im **Original**, ohne dessen Nachtrag
(0 Abweichungen gegen NVA-Spalte 2, 191/231 gegen Spalte 1). RA und VA
messen also gegen verschiedene Staende; das gehoert in die Beschriftung.

**Zweite Folge — Korrektur am bestehenden Code:** `kontrolle()` in
`web/js/vergleich-daten.js` schliesst den RA heute aus, mit der Begruendung,
seine Spalte 2 sei nicht entscheidbar. Diese Begruendung ist widerlegt. Der
Kommentar ist falsch und muss weg; der RA-Fall laesst sich stattdessen
unterstuetzen: liegt der NVA desselben Jahres als Basis vor, ist dessen
Spalte 1 gegen die Soll-Spalte des RA pruefbar — die Rechnung oben ist genau
diese Kontrolle.

## D3 — Beschriftung der internen Basis

**Entscheidung:** Spaltenname plus kurze Herkunft in Klammern, etwa
"VA 2026 (laut NVA)". Kurz genug fuer Achsenlabels und Tabellenkoepfe, macht
den Unterschied zu einem separat geladenen "VA 2026" aber sofort sichtbar.

Beim RA gilt D2: dort tritt "Soll <Jahr> (laut RA)" an die Stelle des
abgedruckten Spaltennamens.

## D4 — Umfang

Wie im ISSUE.md beschrieben: interne Basis, Auswahl-Eintrag, Vorbelegung,
Sichtbarkeit ab einem Dokument, Beschriftung — plus Tests (js und e2e) und
Nachzug in `docs/BROWSER-APP.md`.

Dazu aus D2 die Korrektur an `kontrolle()` samt falschem Kommentar.

**Nicht in diesem Schritt:** das Kontroll-Panel um aktives Umschalten auf das
ausloesende Dokument erweitern.

## Offen gelassen

Die Pruefung aus D2 stuetzt sich auf ein Jahr einer Gemeinde. Systematisch
plausibel ist sie — ein Rechnungsabschluss misst gegen den gueltigen Plan,
nicht gegen einen ueberholten —, aber breiter belegt ist sie nicht. Weitere
Rechnungsabschluesse Herzogenburgs liegen unter
https://www.herzogenburg.at/?kat=4132&ukat=4130 bereit, falls das ueber
mehrere Jahre abgesichert werden soll.
