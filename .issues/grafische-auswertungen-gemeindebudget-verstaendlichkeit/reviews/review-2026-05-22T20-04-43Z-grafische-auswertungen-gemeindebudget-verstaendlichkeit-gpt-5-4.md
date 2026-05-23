---
review_of: grafische-auswertungen-gemeindebudget-verstaendlichkeit
review_type: topic
review_mode: topic
review_topic: "Grafische Auswertungen der Gemeindefinanzen-App: Bewertung und Ideenfindung fuer bessere Verstaendlichkeit des Gemeindebudgets"
reviewed_at: 2026-05-22T20-04-43Z
tool: codex
model: gpt-5.4
duration_seconds: 197
---

<review>
<findings>
<finding severity="critical" id="C1">
  <title>Das als "Geldfluss" bezeichnete Sankey zeigt keinen tatsaechlichen Geldfluss</title>
  <location>web/index.html:154-165; web/js/dashboard-data.js:124-150; web/js/sankey-drill.js:78-97, 181-283</location>
  <description>Die Visualisierung heisst im UI "Geldfluss", wird aber ausschliesslich aus `eh_wert` des Ergebnishaushalts gebaut: Einnahmenseite = operative Ertraege, Ausgabeseite = operative Aufwendungen. Investive Zahlungen, Finanzierungstaetigkeit, Ruecklagenbewegungen und echte Ein-/Auszahlungen des Finanzierungshaushalts fehlen. Fuer Laien klingt "Geldfluss" nach Kassenfluss; tatsaechlich ist es ein Mischbild des Ergebnishaushalts. Das ist aktiv irrefuehrend, gerade weil die App sonst zwischen EH/FH sauber modelliert.</description>
  <fix>Entweder 1. das Diagramm strikt umbenennen in "Ertraege und Aufwendungen im Ergebnishaushalt" und direkt darunter eine Einordnung "keine Cashflow-Darstellung", oder 2. ein echtes Geldflussbild auf `fh_wert` bauen: operative Einzahlungen -> investive Einzahlungen/Finanzierung/Ruecklagen -> operative Auszahlungen/investive Auszahlungen/Tilgungen. Datenquelle: `v_detail` mit `fh_wert`, `gebarung`, `richtung`, optional `mvag_fh`. Platzierung: erster Chart im Lagebild, der bisherige EH-Sankey danach oder im Ausgaben-Tab als Strukturdiagramm.</fix>
</finding>

<finding severity="high" id="H1">
  <title>Das Lagebild zeigt zu wenig der wirklich erklaerenden Kernkennzahlen</title>
  <location>web/index.html:126-179; web/js/dashboard-data.js:153-257</location>
  <description>Oben sichtbar sind nur Ertraege, Aufwendungen, Nettoergebnis und Kommunalsteuer-Anteil. Fuer das Verstehen eines Gemeindebudgets fehlen damit genau jene Anker, die Laien brauchen: operativer Saldo, investive Auszahlungen, Finanzierungssaldo, Groesse der Pflichtbindungen, Vergleich zu Vorjahr/Ist, pro Kopf. Das bestehende Lagebild beantwortet "woher/wohin/wie riskant?" nur teilweise.</description>
  <fix>Die erste Zeile in ein gefuehrtes Lagebild mit 6-8 Kennzahlen umbauen: Nettoergebnis, operativer Ueberschuss/Fehlbetrag, investive Auszahlungen, Pflichttransfers, freie Sachausgaben, Kommunalsteuer pro Kopf/Anteil, Veraenderung zu Vorjahr, Veraenderung zum letzten RA. Datenquelle: vorhandene `v_eckwerte`, `v_detail`, `eh_vergleich`, `eh_dritte`, `fh_wert`, MVAG-Logik aus `04`, `05`, `07`, `08`, `14`. Platzierung: vor allen Charts, mit kurzen 1-Satz-Erlaeuterungen je Kennzahl.</fix>
</finding>

<finding severity="high" id="H2">
  <title>Plan- und Ist-Dokumente werden in den Zeitreihen zusammengemischt, ohne die Semantik sichtbar zu machen</title>
  <location>web/index.html:168-177, 196-203, 294-304; web/js/dashboard-data.js:260-290; web/sql/01-eckwerte.sql:1-10; web/sql/13-kommunalsteuer-zeitreihe.sql:1-10; web/sql/15-aufwand-zeitreihe.sql:1-13</location>
  <description>Alle Trendcharts ordnen `RA`, `NVA` und `VA` einfach auf derselben x-Achse an. Die Texte sagen zwar "dokumentuebergreifend", aber die Diagramme markieren nicht sichtbar, was Plan und was Ist ist. Fuer Laien sieht die Linie wie eine normale Zeitreihe aus, obwohl `RA 2024` und `VA 2025` etwas grundsaetzlich Verschiedenes messen. Das kann zu falschen Schluessen ueber "Entwicklung" fuehren.</description>
  <fix>Plan/Ist visuell trennen: z. B. RA als durchgezogene Linie/Balken, VA als gestrichelte Linie oder heller Balken, NVA separat markiert. Noch besser: eigener Chart "Letztes Ist vs neuer Plan" plus daneben echte Ist-Zeitreihe. Datenquelle: `dokument.typ`, `finanzjahr`, `v_eckwerte`, `v_zeitreihe`. Platzierung: im Lagebild unter den Kennzahlen; Kommunalsteuer- und Aufwandstrends ebenfalls mit Typ-Codierung versehen.</fix>
</finding>

<finding severity="high" id="H3">
  <title>Die Einnahmenseite zeigt Betraege, aber kaum Struktur, Abhaengigkeit und Robustheit</title>
  <location>web/index.html:182-207; web/js/dashboard-charts.js:210-218, 470-497; web/js/dashboard-data.js:171-176; web/sql/03-einnahmestruktur.sql:1-19; web/sql/11-kommunalsteuer-kontext.sql:1-18</location>
  <description>Der Tab "Einnahmen" zeigt groesste Ertragsposten und eine reine Kommunalsteuer-Zeitreihe. Nicht gezeigt werden Anteile, Konzentration auf wenige Quellen, Unterschiede zwischen eigenen Einnahmen und Transfers sowie Kontext zu Ertraegen insgesamt. Gerade fuer Laien ist aber die Frage zentral, wie abhaengig die Gemeinde von einzelnen Quellen ist und welcher Teil selbst gestaltbar ist.</description>
  <fix>Ergaenze einen 100%-gestapelten Strukturchart oder horizontale Anteilsliste "Wofuer kommen 100 Euro herein?" mit Anteilen und Farben nach Quellentyp. Daneben eine Abhaengigkeitskarte fuer Kommunalsteuer: Betrag, Anteil, Veraenderung gg. Vorjahr, Veraenderung gg. letztem RA. Datenquelle: bestehende CASE-Logik aus `sankey()` bzw. `quelleVonPosten()`, `03-einnahmestruktur.sql`, `11-kommunalsteuer-kontext.sql`, `eh_vergleich`, `eh_dritte`. Platzierung: direkt vor dem Tabellenblock im Einnahmen-Tab.</fix>
</finding>

<finding severity="high" id="H4">
  <title>Ringdiagramm und Treemap sind fuer Vergleiche schwach, obwohl hier die zentrale Verteilungsfrage beantwortet werden soll</title>
  <location>web/index.html:210-224; web/js/dashboard-charts.js:236-323</location>
  <description>Der Ausgaben-Tab setzt fuer die zwei wichtigsten Strukturfragen auf Flaechen- und Winkelvergleiche: Ring fuer Aufwandsarten, Treemap fuer Aufgabenbereiche. Beides ist fuer kommunalpolitische Laien und aeltere Nutzer:innen anstrengender als sortierte Balken, besonders wenn Unterschiede klein sind oder die Frage "wie viel mehr ist Bereich A als B?" beantwortet werden soll. Die Charts sind nicht falsch, aber nicht die klarste Wahl fuer die Kernbotschaft.</description>
  <fix>Den Tab in zwei klare Vergleichsansichten umbauen: 1. horizontale Balken "Aufwand nach Art" mit Betrag, Anteil und Beweglichkeitshinweis; 2. horizontale Balken "Nettoaufwand nach Aufgabenbereich" oder "Ausgaben je 100 Euro Budget". Die Treemap kann optional als zweite Exploration bleiben, aber nicht als primaere Lesart. Datenquelle: vorhandene `aufwand_art`, `gruppen`, plus `02-gruppen-uebersicht.sql` fuer Einnahmen/Ausgaben/Saldo je Gruppe. Platzierung: als erste Charts im Ausgaben-Tab, Treemap als optionaler Zusatz darunter.</fix>
</finding>

<finding severity="high" id="H5">
  <title>Die App surfacet Pflichtbindungen zu schwach, obwohl genau dort die politische Beweglichkeit erklaert wird</title>
  <location>web/index.html:281-304, 309-343; web/js/dashboard-data.js:213-219; web/sql/07-transferaufwand.sql:1-22; web/sql/12-personalaufwand.sql:1-16</location>
  <description>Transfers & Umlagen erscheinen nur als Tabelle, Personalaufwand sogar nur indirekt im Ringchart. Damit bleibt unsichtbar, wie gross der Anteil der kurzfristrig kaum beweglichen Ausgaben wirklich ist. Fuer Budgetverstaendnis ist das aber eine Schluesselfrage: Welche Teile sind politisch gestaltbar und welche nicht?</description>
  <fix>Fuehre einen neuen Chart "Gebunden vs gestaltbar" ein: gestapelte Balken oder Marimekko mit Personal, Pflichtumlagen, Finanzaufwand, freiwillige Transfers, freie Sachausgaben. Datenquelle: MVAG 221/223/224, Regex-/besser Referenzlogik fuer Pflichtumlagen aus `07-transferaufwand.sql`, operative Sachausgaben aus `05-sachaufwand-kumuliert.sql`. Platzierung: direkt im Lagebild als Erklaerchart und nochmals im Tab "Sparpotenzial" als Ausgangspunkt vor dem Korridor.</fix>
</finding>

<finding severity="high" id="H6">
  <title>Im Tab "Sparpotenzial" fehlt ausgerechnet der schon vorberechnete Vergleich Plan gegen letztes Ist</title>
  <location>web/index.html:309-343; web/js/dashboard-data.js:194-219; web/sql/06-kostentreiber.sql:1-18; web/sql/08-budgetierungspolster.sql:1-21; web/sql/14-soll-ist-abweichung.sql:1-17</location>
  <description>Der Tab wiederholt zunaechst denselben Wasserfall wie im Ueberblick und zeigt dann Korridor plus Kostentreiber. Das ist nuetzlich, laesst aber zwei fachlich viel lehrreichere Sichtweisen ungenutzt: wo der Voranschlag ueber dem letzten Ist liegt (`08-budgetierungspolster`) und wo im juengsten RA groessere Soll-Ist-Abweichungen auftraten (`14-soll-ist-abweichung`). Gerade fuer Laien erklaert das, welche Zahlen "hart" und welche "optimistisch" sind.</description>
  <fix>Ersetze den doppelten Wasserfall durch zwei neue Panels: 1. Diverging-Bar-Chart "Voranschlag ueber letztem Ist" mit absolutem und prozentualem Polster; 2. Lollipop/Dumbbell "Soll vs Ist im juengsten Rechnungsabschluss". Datenquelle: direkte Uebernahme aus `08-budgetierungspolster.sql` und `14-soll-ist-abweichung.sql`. Platzierung: oben im Sparpotenzial-Tab vor Korridor und Kostentreibern.</fix>
</finding>

<finding severity="high" id="H7">
  <title>Investitionen werden isoliert gezeigt, aber nicht in Finanzierung und Tragbarkeit eingeordnet</title>
  <location>web/index.html:266-278; web/js/dashboard-charts.js:230-234; web/js/dashboard-data.js:220-225; web/sql/09-investitionen.sql:1-14; web/schema.sql:71-82, 153-163</location>
  <description>Der Investitions-Tab zeigt nur die groessten investiven Auszahlungen. Es fehlt jede Einordnung, ob diese Vorhaben neu, wachsend, foerderfinanziert, kreditgetrieben oder gegenueber dem Vorjahr ruecklaeufig sind. Gerade investive Vorhaben sind fuer Gemeindepolitik zentral, und das Datenmodell haelt FH-Vergleichswerte sowie Finanzierungskategorien bereits vor.</description>
  <fix>Ergaenze mindestens zwei Auswertungen: 1. Dumbbell oder Delta-Balken "Investive Auszahlung aktuell vs Vergleich"; 2. Finanzierungsuebersicht fuer Investitionen nach Gebarung/FH mit Eigenmitteln, Foerderungen, Finanzierungstaetigkeit/Ruecklagen als Quellen. Datenquelle: `fh_wert`, `fh_vergleich`, `gebarung`, `mvag_fh`, `qu`, `09-investitionen.sql`. Platzierung: direkt unter dem Top-Investitionen-Chart.</fix>
</finding>

<finding severity="medium" id="M1">
  <title>Die Transfer-Klassifikation ist heuristisch, aber die UI praesentiert sie als harte Kategorie</title>
  <location>web/vendor/dashboard/dashboard.js:159-166; web/sql/07-transferaufwand.sql:9-16</location>
  <description>Pflichtumlagen werden aktuell ueber Textmuster in `bezeichnung` erkannt. Das ist als erster Filter brauchbar, aber die Oberflaeche macht daraus eine scheinbar saubere fachliche Kategorie. Fehlklassifikationen sind plausibel, vor allem bei uneinheitlichen Benennungen zwischen Gemeinden.</description>
  <fix>Die Kategorie in der UI als Heuristik kennzeichnen oder eine explizite Referenzliste fuer bekannte Umlagen einfuehren. Zusaetzlich ein Unsicherheits-Flag bzw. Tooltip "automatisch erkannt". Datenquelle: bestehende Transfertabelle plus spaeter referenzierte Konten-/Bezeichnungslisten. Platzierung: im Transfers-Tab direkt am Tabellenkopf und in einem zusaetzlichen Chart mit separatem Segment "unklar".</fix>
</finding>

<finding severity="medium" id="M2">
  <title>Mehrjahres-Overlay und Kommunalsteuer-Labels fallen wieder auf kleine Standardschrift zurueck</title>
  <location>web/js/dashboard-charts.js:487-493; web/vendor/dashboard/dashboard.js:366-381</location>
  <description>Die App hat die Hauptcharts bewusst auf 15px/14px vergroessert, aber ausgerechnet im Mehrjahres-Overlay und bei den Punktlabels der Kommunalsteuer-Linie bleiben 10px und einmal sogar `Inter, sans-serif` stehen. Das unterlaeuft das eigene Lesbarkeitsziel fuer aeltere Nutzer:innen.</description>
  <fix>Auch diese Sonderfaelle auf dieselbe Typoskala und Schriftfamilie heben: mindestens `LABEL_SIZE` bzw. 13-15px, `Barlow Semi Condensed` oder die Seiten-Schrift. Datenquelle: reine Chart-Konfiguration. Platzierung: bestehende Charts unveraendert, aber mit konsistenter Lesbarkeit.</fix>
</finding>

<finding severity="medium" id="M3">
  <title>Die Informationsarchitektur fuehrt nicht konsequent von Verstehen zu Detail, sondern springt frueh in Fachstrukturen</title>
  <location>web/index.html:108-343</location>
  <description>Nach dem Lagebild folgen sofort technische Tabs wie Einnahmen, Ausgaben, Investitionen und Suche. Was fehlt, ist eine erzaehlende Reihenfolge fuer Laien: 1. Wie steht die Gemeinde insgesamt da? 2. Wovon lebt sie? 3. Wofuer gehen 100 Euro weg? 4. Was ist gebunden? 5. Was hat sich geaendert? 6. Wo liegen Risiken/Spielraeume? Die aktuelle Reihenfolge ist fachlich ordentlich, aber nicht didaktisch optimal.</description>
  <fix>Die Oberflaeche nach Erkenntnisfragen statt Fachtabellen sortieren: `Lagebild` -> `Woher kommt das Geld?` -> `Wofuer geht 1 Euro?` -> `Was ist gebunden?` -> `Was aendert sich ueber Jahre?` -> `Spielraeume & Risiken` -> `Suche & Rohdaten`. Viele bestehende Charts koennen bleiben, aber anders gruppiert und mit 1-2 Satz-Zusammenfassungen oberhalb jedes Abschnitts.</fix>
</finding>

<finding severity="medium" id="M4">
  <title>Abkuerzungen und Vergleichsspalten bleiben fuer Laien in Suche und Tabellen weitgehend unerklaert</title>
  <location>web/index.html:286-292, 352-431; web/vendor/dashboard/dashboard.js:149-166, 591-605; web/schema.sql:6-12</location>
  <description>`EH`, `FH`, `Vergleich`, `Dritte`, `MVAG`, `QU` sind fuer Fachleute normal, fuer Gelegenheitsnutzer:innen aber nicht selbsterklaerend. Die Daten sind stark, nur ihre Beschriftung bleibt zu intern. Besonders problematisch: die Bedeutung von `Vergleich` und `Dritte` aendert sich je nach Dokumenttyp.</description>
  <fix>Spaltennamen ausschreiben und kontextualisieren: z. B. `Ergebnishaushalt aktuell`, `Vorjahr/Planvergleich`, `letztes Ist`, `Finanzierungshaushalt aktuell`. Fuer RA-Dokumente sollte die UI statt generischem `Vergleich` explizit `Soll laut VA` zeigen. Datenquelle: `dokument.spalte_wert`, `spalte_vergleich`, `spalte_dritte`. Platzierung: Tabellenkoepfe, Tooltips, ein kleines Hilfe-Panel im Suche-Tab.</fix>
</finding>

<finding severity="medium" id="M5">
  <title>Die App nutzt das vorhandene Datenpotenzial fuer Pro-Kopf- und Saldo-Sichten gar nicht</title>
  <location>web/sql/02-gruppen-uebersicht.sql:1-14; web/schema.sql:120-163; web/js/dashboard-data.js:227-257</location>
  <description>Es gibt bereits eine Gruppenuebersicht mit Einnahmen, Ausgaben und Saldo je Aufgabenbereich, trotzdem wird im UI nur die Ausgabenseite betont. Ebenso fehlen ueberall Pro-Kopf-Sichten, obwohl gerade sie in Buergerhaushalten und Open-Budget-Darstellungen fuer Verstaendlichkeit sorgen. Ohne Saldo- und Pro-Kopf-Kontext bleiben einige Betraege abstrakt.</description>
  <fix>Neue Standardansicht "Wofuer gibt die Gemeinde netto Geld aus?" als Diverging-Bar nach Gruppe einbauen, optional zusaetzlich pro Kopf falls Einwohnerzahl verfuegbar gemacht wird; falls noch nicht im Datenmodell, als kleine manuelle Metadaten-Ergaenzung je Dokument/Gemeinde vorsehen. Datenquelle: `02-gruppen-uebersicht.sql`, `v_gruppe_summe`, spaeter Gemeindemetadaten. Platzierung: zentral im Ausgaben- oder Lagebild-Tab.</fix>
</finding>
</findings>

<strengths>
<strength>Die App baut konsequent auf dem Detailnachweis auf und haelt damit fachlich eine starke Basis fuer weitere Auswertungen offen; `web/schema.sql:60-163` und `web/js/dashboard-data.js:67-122` surfacen EH/FH, Vergleichs- und Drittspalten je Posten.</strength>
<strength>Der Drill-down im Ausgaben-Tab ist fuer Aufklaerung im Gemeinderat wertvoll, weil er von Gruppe ueber Ansatz bis zum Einzelposten fuehrt und damit aus einer Uebersicht in echte Nachvollziehbarkeit kippt; `web/vendor/dashboard/dashboard.js:169-323`.</strength>
<strength>Der Suche-&-Daten-Tab ist als Volltabelle mit Filtern, Sortierung und Mehrjahresvergleich ein starkes Rueckgrat fuer fortgeschrittene Nutzer:innen; `web/index.html:348-431` und `web/vendor/dashboard/dashboard.js:523-735`.</strength>
<strength>Der Sparpotenzial-Tab setzt wenigstens eine wichtige fachliche Leitplanke explizit: Die Callout-Einordnung verhindert, dass die Suchhilfe als automatische Kuerrzungsempfehlung missverstanden wird; `web/index.html:336-343`.</strength>
</strengths>

<traces>
<trace name="Lagebild-Kennzahlen">web/js/dashboard-data.js:153-257 -> aggregateDok().eckwerte -> web/vendor/dashboard/dashboard.js:116-129 -> web/index.html:133-145</trace>
<trace name="Sankey-Datenbasis">web/js/dashboard-data.js:124-150 -> agg.sankey mit eh_wert -> web/js/dashboard-charts.js:161-208 bzw. web/js/sankey-drill.js:181-283 -> web/index.html:154-165</trace>
<trace name="Trend-Mischung aus RA/NVA/VA">web/js/dashboard-data.js:49-65, 260-290 -> ORDER/typ-Folge -> web/js/dashboard-charts.js:433-523 -> web/index.html:168-177, 196-203, 294-304</trace>
<trace name="Ungenutztes Soll-Ist- und Polster-Potenzial">web/sql/08-budgetierungspolster.sql:1-21 und web/sql/14-soll-ist-abweichung.sql:1-17 sind vorhanden, werden aber in web/js/dashboard-data.js:153-257 und web/vendor/dashboard/dashboard.js:749-761 nicht in die UI verdrahtet</trace>
<trace name="Vergleichs- und Drittspalten im Datenmodell">web/schema.sql:6-12, 60-82, 95-163 -> web/js/dashboard-data.js:67-122 -> Suche-Tabelle in web/vendor/dashboard/dashboard.js:591-605</trace>
</traces>

<verdict value="fail" critical="1" high="7" medium="5">
  <blockers>
    <blocker>Der Begriff "Geldfluss" fuer eine auf `eh_wert` basierende Sankey-Grafik ist fachlich missverstaendlich und sollte vor weiterer Produkt-Schaerfung zuerst korrigiert oder ersetzt werden.</blocker>
  </blockers>
</verdict>
</review>

<verdict value="fail" critical="1" high="7" medium="5">
Die grafischen Auswertungen haben eine gute fachliche Datenbasis und einige starke Erkundungswerkzeuge, surfacen fuer Laien aber noch nicht die entscheidenden Unterschiede zwischen Ergebnishaushalt, Finanzierung, Bindungen, Risiken und Plan-Ist-Realitaet klar genug.
</verdict>

