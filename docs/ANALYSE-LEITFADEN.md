# Analyse-Leitfaden

Wie man mit der Datenbank arbeitet — und wie sich Sparpotenzial im
Gemeindebudget methodisch finden lässt.

## Die Abfragen-Bibliothek

Jede Datei in `sql/` beantwortet eine Fragestellung. Ausführen einzeln oder
gesammelt:

```sh
gemfin query --db data/gemeindefinanzen.db            # alle
gemfin query --db data/gemeindefinanzen.db --name 05  # nur eine Abfrage
```

| Datei | Fragestellung |
|-------|---------------|
| `01-eckwerte` | Erträge, Aufwand, Nettoergebnis — eine Zeile je Dokument |
| `02-gruppen-uebersicht` | Einnahmen/Ausgaben/Saldo je Aufgabengruppe |
| `03-einnahmestruktur` | größte Ertragsquellen, mit Anteil |
| `04-aufwand-nach-art` | Personal / Sach / Transfer / Finanz |
| `05-sachaufwand-kumuliert` | zahlungswirksamer Sachaufwand, kumuliert |
| `06-kostentreiber` | größte Aufwandssteigerungen vs. Vorjahr |
| `07-transferaufwand` | Umlagen und Zuschüsse im Detail |
| `08-budgetierungspolster` | Posten deutlich über dem letzten Ist |
| `09-investitionen` | größte investive Vorhaben |
| `10-top-ausgaben` | größte Einzelausgaben gesamt |
| `11-kommunalsteuer-kontext` | Kommunalsteuer im Kontext der Erträge |
| `12-personalaufwand` | Personalaufwand je Aufgabengruppe |
| `13-kommunalsteuer-zeitreihe` | Kommunalsteuer über alle Dokumente |
| `14-soll-ist-abweichung` | größte Abweichungen Ist↔Soll im jüngsten RA |
| `15-aufwand-zeitreihe` | Aufwand nach Art über alle Dokumente |

Abfragen 01–12 beziehen sich auf den jüngsten Voranschlag; 13–15 vergleichen
über alle eingelesenen Dokumente. Die Dateien sind bewusst lesbar gehalten —
als Vorlage für eigene Abfragen.

## Sparpotenzial methodisch finden

Wenn das Nettoergebnis schrumpft oder ein Einnahmenausfall droht, stellt sich
die Frage, wo im Budget Spielraum liegt. Fünf Schritte:

### Schritt 1 — den Bedarf beziffern

`01-eckwerte` zeigt Erträge, Aufwand und Nettoergebnis je Dokument; ein
schrumpfendes oder negatives Nettoergebnis benennt die Größenordnung. Ist das
Haushaltspotenzial im mittelfristigen Finanzplan dauerhaft negativ, ist laut
NÖ Gemeindeordnung ein **Haushaltskonsolidierungskonzept** zu erstellen.

### Schritt 2 — die richtige Basis wählen

Gespart werden kann nur **zahlungswirksam** — daher Finanzierungshaushalt
(`fh_*`), nicht Ergebnishaushalt. Abschreibungen stehen zwar als Aufwand im
Budget, sind aber kein Geldfluss und fallen über die `fh`-Spalten automatisch
heraus.

### Schritt 3 — Pflicht von Ermessen trennen

`04-aufwand-nach-art` teilt den Aufwand nach Art auf:

| Art | kurzfristig kürzbar? |
|-----|----------------------|
| Personalaufwand | kaum — bestehende Dienstverhältnisse |
| Transferaufwand | überwiegend Pflichtumlagen (`07-transferaufwand`); freiwillige Förderungen sind steuerbar |
| Finanzaufwand | durch bestehende Schulden gebunden |
| **Sachaufwand** | **größter Ermessensanteil** |

Spielraum ist also realistischerweise im **Sachaufwand** zu suchen — plus den
freiwilligen Förderungen innerhalb des Transferaufwands.

### Schritt 4 — den Sachaufwand-Korridor durchgehen

`05-sachaufwand-kumuliert` listet den zahlungswirksamen Sachaufwand absteigend
und summiert ihn kumuliert auf. Die Spalte `kumuliert` zeigt direkt, wie viele
Posten zusammen einen bestimmten Betrag ergeben. Im Dashboard ist das die
Korridor-Grafik im Tab „Sparpotenzial".

### Schritt 5 — weitere Hebel prüfen

Sparen am Sachaufwand ist nur ein Weg. Die Abfragen zeigen weitere Ansätze:

- **`06-kostentreiber`** — die Steigerungen zuerst bremsen, statt Bestehendes
  zu kürzen.
- **`08-budgetierungspolster`** — Posten, die deutlich über dem letzten Ist
  liegen: zu vorsichtig budgetiert oder echter Mehrbedarf?
- **`09-investitionen`** — investive Vorhaben zeitlich strecken entlastet den
  Finanzierungshaushalt, ohne laufende Leistung zu kürzen.
- Einnahmenseite — Gebühren und eigene Abgaben (`03-einnahmestruktur`).

## Wichtige Einordnung

Die Auswertungen sind eine **Entscheidungsgrundlage, keine Entscheidung**.
`05-sachaufwand-kumuliert` zeigt, *wo* im Budget Beträge welcher Größenordnung
liegen — nicht, *was* gekürzt werden soll. Ob ein Posten kürzbar ist, ist eine
fachliche und politische Frage. Das Werkzeug bereitet die Zahlen auf; bewertet
wird im Gemeinderat.

## Mehrjahresanalyse

Der eigentliche Wert entsteht über die Zeit. Sind mehrere Dokumente geladen
(Rechnungsabschlüsse, Nachtragsvoranschläge, Voranschläge mehrerer Jahre),
liefern `13`–`15` echte Zeitreihen, und das Dashboard zeigt einen eigenen
Abschnitt „Entwicklung über die Jahre".

Besonders aufschlussreich ist der Vergleich von letztem **Ist**
(Rechnungsabschluss) und neuem **Plan** (Voranschlag): Weicht der Voranschlag
einer wichtigen Einnahme spürbar vom zuletzt tatsächlich erzielten Betrag ab,
ist das ein früher Hinweis auf ein strukturelles Risiko (`14-soll-ist-abweichung`,
`13-kommunalsteuer-zeitreihe`).

Weitere Dokumente lassen sich jederzeit ergänzen: PDF nach `documents/`
legen, `make db` erneut ausführen.

## Das interaktive Dashboard

Die Browser-App unter `web/` (siehe [`BROWSER-APP.md`](BROWSER-APP.md)) wertet
die hochgeladenen PDFs vollständig clientseitig aus und zeigt sie als
interaktives Dashboard — meetingtauglich, ohne Server.

- **Themen-Tabs** gliedern die Auswertung: Überblick, Einnahmen, Ausgaben,
  Investitionen, Transfers & Umlagen, Sparpotenzial, Suche & Daten.
- Der **Dokument-Umschalter** über den Tabs stellt die sechs dokumentbezogenen
  Tabs auf das gewählte Dokument um. So lässt sich dieselbe Kennzahl direkt
  über die geladenen Dokumente vergleichen.
- **Suche & Daten** ist die Volltabelle aller Detailposten: Volltextsuche über
  Bezeichnung, Konto und Ansatz, Filter nach Dokument, Aufgabengruppe,
  Richtung, Gebarung und Betragsbereich, sortierbare Spalten sowie Treffer-
  und Summenanzeige. Das ist der schnellste Weg, einen konkreten Posten zu
  finden, ohne eine SQL-Abfrage zu schreiben.
- Der **Drill-down** im Ausgaben-Tab führt von der Aufgabengruppe über den
  Ansatz bis zum Einzelposten — die Summen je Ebene stimmen mit den
  Ansatz-Summen der Datenbank überein.
- Der **Mehrjahres-Vergleich** zeigt, wie sich einzelne Budgetzeilen oder
  ganze Gruppen über die Dokumente entwickeln. In „Suche & Daten" einzelne
  Posten ankreuzen und über „Ausgewählte Posten über die Jahre" als
  Liniendiagramm öffnen — jede Linie ist ein Posten, über Ansatz + Konto
  über die Jahre hinweg identifiziert; fehlt ein Posten in einem Dokument,
  bleibt die Linie dort offen. „Gefilterte Menge als Gruppe" summiert die
  gesamte aktuell gefilterte Treffermenge je Dokument zu einer einzigen
  Linie — etwa „alles aus Gruppe 5" oder alle Treffer eines Suchbegriffs.
  Im Drill-down öffnet die Schaltfläche „über die Jahre" je Aufgabengruppe
  und je Ansatz dieselbe Mehrjahres-Ansicht.
