# Der Voranschlag im VRV-2015-Format

Kurzerklärung des Dokumentaufbaus — so viel, wie zum Verständnis der
geparsten Daten nötig ist.

## Was ist ein Voranschlag

Österreichische Gemeinden stellen ihre Finanzen jährlich in vier Dokumenten dar:

| Dokument | Bedeutung |
|----------|-----------|
| **Voranschlag (VA)** | Budget-*Plan* für das kommende Jahr, vor Jahresbeginn beschlossen |
| **Nachtragsvoranschlag (NVA)** | unterjährige Korrektur des Voranschlags |
| **Rechnungsabschluss (RA)** | das tatsächliche *Ist* nach Jahresende |

Alle vier folgen der **VRV 2015** (Voranschlags- und Rechnungsabschluss­verordnung)
— bundesweit einheitlich. Ein Parser für ein Dokument funktioniert daher für
alle Gemeinden und alle Jahre.

## Die drei Haushalte

Die VRV 2015 kennt drei Sichten auf dieselben Vorgänge:

- **Ergebnishaushalt (EH)** — Erträge und Aufwendungen, *inklusive* nicht
  zahlungswirksamer Posten wie Abschreibungen. Das **Nettoergebnis** zeigt, ob
  die laufende Leistung der Gemeinde gedeckt ist.
- **Finanzierungshaushalt (FH)** — Ein- und Auszahlungen, also nur das
  *zahlungswirksame* Geschehen. Maßgeblich für die Liquidität.
- **Vermögenshaushalt** — Bestände; hier nicht im Detail verarbeitet.

Für die Frage „wo lässt sich Geld sparen“ zählt der **Finanzierungshaushalt**:
Abschreibungen stehen zwar im Ergebnishaushalt, lassen sich aber nicht „kürzen“.

## Aufbau der PDF (283 Seiten)

| Abschnitt | Inhalt |
|-----------|--------|
| Vorbericht | Textteil, Pflichtkennzahlen, Diagramme |
| Ergebnis-/Finanzierungshaushalt | aggregierte Tabellen je Aufgabengruppe |
| Querschnitt (Anlage 5b) | stark verdichtete Gesamtsicht |
| **Detailnachweis** | **jede einzelne Haushaltsstelle — die Datenquelle** |
| Nachweise | Transfers, Schulden, Rücklagen, Investitionen |
| MFP | mittelfristiger Finanzplan (Folgejahre) |

Dieses Projekt parst den **Detailnachweis**. Er ist vollständig: Jede andere
Tabelle der PDF ist eine Aggregation daraus und lässt sich aus den Detaildaten
nachrechnen (genau das macht `gemfin validate`).

## Der Kontoschlüssel

Jede Detailzeile trägt einen Schlüssel wie `2/920000+833000`:

```
2 / 920000 + 833000
│   │        └── ökonomisches Konto — WAS (hier: Kommunalsteuer)
│   └─────────── Ansatz — WOFÜR, funktionelle Gliederung (hier: Gemeindeabgaben)
└─────────────── Mittelherkunft: 1 Aufwand, 2 Ertrag, 5 inv. Auszahlung,
                                 6 inv. Einzahlung
```

Das Vorzeichen ist eindeutig: `+` = Einnahme, `-` = Ausgabe.

### Ansatz — die funktionelle Gliederung (wofür)

Die erste Ziffer des Ansatzes ist die **Aufgabengruppe** (0–9):

| Gruppe | Aufgabenbereich |
|--------|-----------------|
| 0 | Vertretungskörper, allgemeine Verwaltung |
| 1 | Öffentliche Ordnung und Sicherheit |
| 2 | Unterricht, Erziehung, Sport, Wissenschaft |
| 3 | Kunst, Kultur, Kultus |
| 4 | Soziale Wohlfahrt, Wohnbauförderung |
| 5 | Gesundheit |
| 6 | Straßen- und Wasserbau, Verkehr |
| 7 | Wirtschaftsförderung |
| 8 | Dienstleistungen |
| 9 | Finanzwirtschaft |

### MVAG — Mittelverwendungs-/-aufbringungsgruppen (Art)

Klassifiziert die Aufwands- bzw. Ertragsart. Für die Analyse zentral, weil
sie die *Steuerbarkeit* anzeigt:

| MVAG | Bedeutung | Steuerbarkeit |
|------|-----------|---------------|
| 221 | Personalaufwand | kurzfristig kaum |
| 222 | Sachaufwand | größter Ermessensanteil |
| 223 | Transferaufwand | Pflichtumlagen gebunden, Förderungen frei |
| 224 | Finanzaufwand | durch Schuldenstruktur bestimmt |
| 211–213 | Erträge (Verwaltung / Transfers / Finanz) | — |

## Zeilentypen im Detailnachweis

Der Parser unterscheidet drei Zeilentypen:

- **detail** — eine echte Haushaltsstelle (Kontoschlüssel + 6 Beträge)
- **summe** — eine `SU`-Zeile (z. B. `SU 21` = Summe operative Erträge)
- **saldo** — eine `SA`-Zeile (z. B. `SA 0` = Nettoergebnis)

Nur **detail**-Zeilen sind die Nutzdaten. Die summe-/saldo-Zeilen werden
mitgeparst, um die Detaildaten dagegen prüfen zu können.

## Die sechs Betragsspalten

Jede Detailzeile hat sechs Beträge — drei je Haushalt (Ergebnis- und
Finanzierungshaushalt). **Was die drei Spalten bedeuten, hängt vom
Dokumenttyp ab:**

| Dokumenttyp | Spalte 1 | Spalte 2 | Spalte 3 |
|-------------|----------|----------|----------|
| Voranschlag (VA) | VA Jahr | VA Vorjahr | RA Vorvorjahr |
| Nachtragsvoranschlag (NVA) | VA Jahr inkl. NVA | VA Jahr | 1. NVA (Änderung) |
| Rechnungsabschluss (RA) | RA Jahr (Ist) | VA Jahr (Soll) | Abweichung RA−VA |

Beim Rechnungsabschluss steht in Spalte 1 also das **tatsächliche Ist**, in
Spalte 2 der ursprünglich beschlossene Voranschlag — Spalte 1 gegen Spalte 2
ist die Soll-Ist-Abweichung.

Im Schema heißen die Spalten deshalb neutral `eh_wert` / `eh_vergleich` /
`eh_dritte` (bzw. `fh_*`); die konkrete Bedeutung je Dokument steht in
`dokument.spalte_wert` usw. Siehe [`SCHEMA.md`](SCHEMA.md).
