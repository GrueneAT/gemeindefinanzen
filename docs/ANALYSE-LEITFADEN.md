# Analyse-Leitfaden

Wie man mit der Datenbank arbeitet — und wie die 800.000-Euro-Frage
methodisch angegangen wird.

## Die Abfragen-Bibliothek

Jede Datei in `sql/` beantwortet eine Fragestellung. Ausführen einzeln oder
gesammelt:

```sh
gemfin query --db data/gemeindefinanzen.db            # alle
gemfin query --db data/gemeindefinanzen.db --name 05  # nur die 800k-Abfrage
```

| Datei | Fragestellung |
|-------|---------------|
| `01-eckwerte` | Erträge, Aufwand, Nettoergebnis — eine Zeile je Dokument |
| `02-gruppen-uebersicht` | Einnahmen/Ausgaben/Saldo je Aufgabengruppe |
| `03-einnahmestruktur` | größte Ertragsquellen, mit Anteil |
| `04-aufwand-nach-art` | Personal / Sach / Transfer / Finanz |
| `05-luecke-800k` | zahlungswirksamer Sachaufwand, kumuliert |
| `06-kostentreiber` | größte Aufwandssteigerungen vs. Vorjahr |
| `07-transferaufwand` | Umlagen und Zuschüsse im Detail |
| `08-budgetierungspolster` | Posten deutlich über dem letzten Ist |
| `09-investitionen` | größte investive Vorhaben |
| `10-top-ausgaben` | größte Einzelausgaben gesamt |
| `11-kommunalsteuer-szenario` | Kommunalsteuer im Kontext, Szenario −800k |
| `12-personalaufwand` | Personalaufwand je Aufgabengruppe |
| `13-kommunalsteuer-zeitreihe` | Kommunalsteuer über alle Dokumente |
| `14-soll-ist-abweichung` | größte Abweichungen Ist↔Soll im jüngsten RA |
| `15-aufwand-zeitreihe` | Aufwand nach Art über alle Dokumente |

Abfragen 01–12 beziehen sich auf den jüngsten Voranschlag; 13–15 vergleichen
über alle eingelesenen Dokumente. Die Dateien sind bewusst lesbar gehalten —
als Vorlage für eigene Abfragen.

## Befund aus dem Voranschlag 2026

Die wichtigsten Zahlen, die die Abfragen liefern:

- **Nettoergebnis** rund **+0,47 Mio €** — gegenüber dem Voranschlag 2025
  (+1,45 Mio €) stark gesunken. Der Puffer ist dünn.
- **Kommunalsteuer 4,9 Mio €** = ~22 % aller Erträge; zusammen mit den
  Bundes-**Ertragsanteilen (8,47 Mio €, ~38 %)** hängen rund **60 %** der
  Einnahmen an nur zwei Quellen.
- **Transferaufwand** ist der größte Kostentreiber: **+0,98 Mio €** gegenüber
  dem Vorjahr — vor allem NÖKAS-Sprengelbeitrag (+214k) und Sozialhilfeumlage
  (+164k). Beides Pflichtumlagen.

Daraus die Kernaussage: Ein dauerhafter Kommunalsteuer-Ausfall von 800.000 €
trifft ein Budget, das schon ohne ihn kaum Spielraum hat.

## Die 800.000-Euro-Methodik

### Schritt 1 — die Lücke beziffern

`11-kommunalsteuer-szenario` rechnet es vor: Nettoergebnis +0,47 Mio €,
minus 800.000 € → **rund −0,33 Mio € Abgang**. Ein dauerhaft negatives
Ergebnis macht laut NÖ Gemeindeordnung ein **Haushaltskonsolidierungskonzept**
zum Thema.

### Schritt 2 — die richtige Basis wählen

Gespart werden kann nur **zahlungswirksam** — daher Finanzierungshaushalt
(`fh_*`), nicht Ergebnishaushalt. Abschreibungen stehen zwar als Aufwand im
Budget, sind aber kein Geldfluss und fallen über die `fh`-Spalten automatisch
heraus.

### Schritt 3 — Pflicht von Ermessen trennen

`04-aufwand-nach-art` teilt den Aufwand:

| Art | Größenordnung | kurzfristig kürzbar? |
|-----|---------------|----------------------|
| Personalaufwand | ~4,9 Mio € | kaum — Dienstverhältnisse |
| Transferaufwand | ~7,9 Mio € | überwiegend Pflichtumlagen (`07-transferaufwand`) |
| Finanzaufwand | ~0,4 Mio € | durch bestehende Schulden gebunden |
| **Sachaufwand** | **~8,8 Mio €** | **größter Ermessensanteil** |

Die 800.000 € sind also realistischerweise im **Sachaufwand** zu suchen —
plus den freiwilligen Förderungen innerhalb des Transferaufwands.

### Schritt 4 — den Korridor durchgehen

`05-luecke-800k` listet den zahlungswirksamen Sachaufwand absteigend und
summiert ihn kumuliert auf. Die Spalte `kumuliert` zeigt direkt, wie viele
Posten zusammen 800.000 € ergeben. Im Dashboard ist das der Wasserfall plus
die Korridor-Grafik mit der 800.000-Euro-Linie.

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
`05-luecke-800k` zeigt, *wo* im Budget Beträge dieser Größe liegen — nicht,
*was* gekürzt werden soll. Ob ein Posten kürzbar ist, ist eine fachliche und
politische Frage. Das Werkzeug bereitet die Zahlen auf; bewertet wird im
Gemeinderat.

## Mehrjahresanalyse

Der eigentliche Wert entsteht über die Zeit. Sind mehrere Dokumente geladen
(RA 2024, NVA 2025, RA 2025, VA 2026 …), liefern `13`–`15` echte Zeitreihen,
und das Dashboard zeigt einen eigenen Abschnitt „Entwicklung über die Jahre“.

Ein Befund aus diesem Vergleich: Die Kommunalsteuer lag im **Ist 2025**
(Rechnungsabschluss) bei rund **4,48 Mio €** — niedriger als im Ist 2024
(4,55 Mio €). Der Voranschlag 2026 setzt dennoch **4,90 Mio €** an. Diese
Lücke zwischen letztem Ist und neuem Plan ist für die 800.000-Euro-Frage
ebenso bedeutsam wie der angekündigte Firmenwegzug — beides zusammen
betrachtet werden.

Weitere Dokumente lassen sich jederzeit ergänzen: PDF nach `documents/`
legen, `make db` erneut ausführen.

## Das interaktive Dashboard

Die Browser-App unter `web/` (siehe [`BROWSER-APP.md`](BROWSER-APP.md)) wertet
die hochgeladenen PDFs vollständig clientseitig aus und zeigt sie als
interaktives Dashboard — meetingtauglich, ohne Server.

- **Themen-Tabs** gliedern die Auswertung: Überblick, Einnahmen, Ausgaben,
  Investitionen, Transfers & Umlagen, Sparpotenzial, Suche & Daten.
- Der **Jahr-/Dokument-Umschalter** über den Tabs stellt die sechs
  dokumentbezogenen Tabs auf RA 2024, RA 2025, VA 2025 inkl. NVA oder VA 2026
  um. So lässt sich dieselbe Kennzahl direkt über die Dokumente vergleichen.
- **Suche & Daten** ist die Volltabelle aller Detailposten: Volltextsuche über
  Bezeichnung, Konto und Ansatz, Filter nach Dokument, Aufgabengruppe,
  Richtung, Gebarung und Betragsbereich, sortierbare Spalten sowie Treffer-
  und Summenanzeige. Das ist der schnellste Weg, einen konkreten Posten zu
  finden, ohne eine SQL-Abfrage zu schreiben.
- Der **Drill-down** im Ausgaben-Tab führt von der Aufgabengruppe über den
  Ansatz bis zum Einzelposten — die Summen je Ebene stimmen mit den
  Ansatz-Summen der Datenbank überein.
- Der **Mehrjahres-Vergleich** zeigt, wie sich einzelne Budgetzeilen oder
  ganze Gruppen über die Dokumente entwickeln. In „Suche & Daten“ einzelne
  Posten ankreuzen und über „Ausgewählte Posten über die Jahre“ als
  Liniendiagramm öffnen — jede Linie ist ein Posten, über Ansatz + Konto
  über die Jahre hinweg identifiziert; fehlt ein Posten in einem Dokument,
  bleibt die Linie dort offen. „Gefilterte Menge als Gruppe“ summiert die
  gesamte aktuell gefilterte Treffermenge je Dokument zu einer einzigen
  Linie — etwa „alles aus Gruppe 5“ oder alle Treffer eines Suchbegriffs.
  Im Drill-down öffnet die Schaltfläche „über die Jahre“ je Aufgabengruppe
  und je Ansatz dieselbe Mehrjahres-Ansicht. So lässt sich ein Posten oder
  eine Gruppe direkt im zeitlichen Verlauf bewerten, ohne die Dokumente
  einzeln umzuschalten.
