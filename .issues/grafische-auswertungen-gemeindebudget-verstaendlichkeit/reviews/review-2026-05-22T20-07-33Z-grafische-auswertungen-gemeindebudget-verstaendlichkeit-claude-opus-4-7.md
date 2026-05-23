---
review_of: grafische-auswertungen-gemeindebudget-verstaendlichkeit
review_type: topic
review_mode: topic
review_topic: "Grafische Auswertungen der Gemeindefinanzen-App: Bewertung und Ideenfindung fuer bessere Verstaendlichkeit des Gemeindebudgets"
reviewed_at: 2026-05-22T20-07-33Z
tool: claude
model: claude-opus-4-7
duration_seconds: 367
---

<review>

<findings>

<finding severity="critical" id="C1">
  <title>Kostentreiber-Diagramm wechselt mit dem Dokumenttyp stillschweigend die Bedeutung</title>
  <location>web/js/dashboard-charts.js:224 (chartTreiber) — Datenquelle web/js/dashboard-data.js:194-199 (treiber, eh_delta) — UI web/index.html:333-340 (Tab Sparpotenzial)</location>
  <description>Der Kostentreiber-Balken nutzt `eh_delta = eh_wert - eh_vergleich`. Was die Vergleichsspalte bedeutet, haengt laut schema.sql:108-111 und dokument.spalte_vergleich vom Dokumenttyp ab: bei einem Voranschlag ist `eh_vergleich` der VA des Vorjahres (Delta = Budgetwachstum), bei einem Rechnungsabschluss ist `eh_vergleich` der VA desselben Jahres (Delta = Ist-minus-Soll-Abweichung). Der Dokument-Umschalter (dashboard.js:100 setDok) tauscht alle dok-Charts aus, ohne Titel oder Beschreibung anzupassen. Wird ein RA-Dokument gewaehlt, zeigt das Diagramm unter dem Titel „Kostentreiber gegenueber dem Vergleichswert" im Tab „Sparpotenzial" in Wahrheit Ist-Soll-Abweichungen — eine voellig andere Aussage. Ein Laie liest das als „diese Posten sind teurer geworden", obwohl es heisst „hier wurde mehr ausgegeben als geplant". Das Diagramm fuehrt aktiv in die Irre.</description>
  <fix>Titel und Begleittext datengetrieben aus `dokument.spalte_vergleich` ableiten (z. B. „Mehrausgaben gegenueber VA 2025" bzw. „Ist ueber Soll — RA 2024"). Alternativ den Treiber-Chart auf VA-Dokumente beschraenken und fuer RA-Dokumente stattdessen den eigenstaendigen Soll-Ist-Chart (siehe H6) zeigen. In jedem Fall muss am Diagramm sichtbar stehen, gegen welche konkrete Spalte verglichen wird.</description>
  <fix>Titel/Untertitel je Diagramm aus `dokument.spalte_wert` und `dokument.spalte_vergleich` generieren; bei RA-Dokument den Treiber-Chart durch den Soll-Ist-Chart (H6) ersetzen.</fix>
</finding>

<finding severity="high" id="H1">
  <title>Mehrjahres-Trends mischen Voranschlag (Plan) und Rechnungsabschluss (Ist) ohne sichtbare Unterscheidung</title>
  <location>web/js/dashboard-charts.js:433 (chartTrendEckwerte), :499 (chartTrendAufwand), :470 (chartTrendKomm) — UI web/index.html:164-174, :296-306</location>
  <description>Die x-Achse dieser Diagramme reiht alle eingelesenen Dokumente chronologisch (dashboard-data.js:260-291). Eine VA-Saeule (geplant) und eine RA-Saeule (tatsaechlich) stehen optisch identisch nebeneinander. Ein kommunalpolitischer Laie vergleicht Saeulenhoehen und liest einen Plan/Ist-Sprung als echte Entwicklung. Der einzige Hinweis ist der Achsentext „VA 2026" / „RA 2024" — fuer aeltere Nutzer:innen leicht zu uebersehen. Damit ist der prominenteste Vergleich des Ueberblick-Tabs ein Apfel-Birnen-Vergleich.</description>
  <fix>Dokumenttyp visuell kodieren: RA-Saeulen voll gefuellt, VA/NVA-Saeulen mit gemustertem/aufgehelltem `itemStyle` (decal oder reduzierte Opacity), plus Legendeneintrag „Plan (VA) / Ist (RA)". Zusaetzlich `markArea` hinter den VA-Dokumenten oder ein zweizeiliges Achsenlabel mit „Plan"/„Ist". Datenquelle: `dokument.typ` ist in `daten.dokumente` bereits vorhanden.</fix>
</finding>

<finding severity="high" id="H2">
  <title>„Geldfluss"-Sankey beruht auf dem Ergebnishaushalt und macht Ueberschuss/Abgang unsichtbar</title>
  <location>web/js/dashboard-charts.js:161 (chartSankey), web/js/sankey-drill.js:181 (buildSankeyOption) — Datenquelle dashboard-data.js:124-151 (sankey, SUM(eh_wert))</location>
  <description>Zwei Probleme. (1) Der Sankey heisst „Geldfluss", nutzt aber `eh_wert` (Ergebnishaushalt). Der Ergebnishaushalt enthaelt nicht zahlungswirksame Posten (Abschreibungen, interne Verrechnungen) — fachlich ist „Geldfluss" der Finanzierungshaushalt. Der Titel verspricht einen Cash-Blick, den die Daten nicht liefern. (2) Der Mittelknoten „Gemeindehaushalt" hat Zufluss = Summe Einnahmequellen und Abfluss = Summe Aufgabengruppen. Stimmen Ertraege und Aufwendungen nicht ueberein (Ueberschuss oder Abgang — der zentrale Befund jedes Budgets), gibt es keinen Knoten dafuer. Das Sankey balanciert die Differenz still weg; der Laie sieht das Defizit im Geldfluss-Bild nicht.</description>
  <fix>(1) Titel praezisieren zu „Mittelherkunft und -verwendung" oder den Sankey konsequent auf `fh_wert` umstellen. (2) Einen Abschlussknoten ergaenzen: bei Ueberschuss `Gemeindehaushalt -> Ueberschuss/Ruecklagenzufuhr`, bei Abgang `Abgangsdeckung -> Gemeindehaushalt`, eingefaerbt in INK.green bzw. INK.red. So bleibt das Sankey bilanziell ehrlich und das Ergebnis sichtbar.</fix>
</finding>

<finding severity="high" id="H3">
  <title>Kein Vorjahresvergleich an Kennzahlen-Karten und Wasserfall, obwohl drei Vergleichsspalten je Posten vorliegen</title>
  <location>web/index.html:132-145 (metric-cards), web/js/dashboard-charts.js:325 (chartWasserfall) — ungenutzte Felder dashboard-data.js:114-119 (ev/ed, fv/fd)</location>
  <description>Jeder Detailposten traegt drei Betragsspalten je Haushalt (`eh_wert`, `eh_vergleich`, `eh_dritte` — schema.sql:73-79). Genutzt werden im Dashboard fast nur die Wert-Spalten. Die vier Kennzahlen-Karten (Ertraege, Aufwendungen, Nettoergebnis, Kommunalsteuer-Anteil) zeigen nur den aktuellen Stand — ohne Delta, ohne Pfeil, ohne Bezug. Der Wasserfall zeigt ebenfalls nur das aktuelle Jahr. Ein Laie kann „2,3 Mio Aufwendungen" nicht einordnen, ohne zu wissen, ob das mehr oder weniger als zuvor ist. Die naheliegendste Einordnung ueberhaupt fehlt.</description>
  <fix>Auf den `.metric-card`s eine zweite Zeile ergaenzen: Delta gegenueber `spalte_vergleich` als „+4,1 % ggü. VA 2025" mit kleinem Auf/Ab-Pfeil, eingefaerbt in INK.green/INK.red. Im Wasserfall je Stufe eine duenne Geisterssaeule fuer den Vergleichswert hinter die Hauptsaeule legen (zweite Serie, niedrige Opacity). Datenbasis: Eckwerte aus `eh_vergleich`/`eh_dritte` summieren — voellig analog zur bestehenden `aggregateDok`.</fix>
</finding>

<finding severity="high" id="H4">
  <title>Kostentreiber zeigt nur Anstiege — Einsparungen bleiben unsichtbar und erzeugen einen Wachstums-Eindruck</title>
  <location>web/js/dashboard-data.js:194-199 (treiber: WHERE eh_delta>0 ... LIMIT 12), web/js/dashboard-charts.js:224 (chartTreiber)</location>
  <description>Die Treiber-Abfrage filtert `eh_delta > 0` und zeigt nur die zwoelf groessten Steigerungen. Posten, die guenstiger wurden, erscheinen nirgends. Der Laie sieht eine reine Liste roter, wachsender Balken und schliesst, das Budget kenne nur eine Richtung. Die Gegenbewegung — wo wurde gespart, wo sind Kosten gefallen — ist genauso entscheidungsrelevant und wird unterschlagen. Das verzerrt das Gesamtbild im Sparpotenzial-Tab.</description>
  <fix>Diagramm zu einem zweiseitigen (diverging) Balkendiagramm umbauen: oben die groessten Anstiege (INK.red), unten die groessten Rueckgaenge (INK.green), Nulllinie in der Mitte. Datenquelle: dieselbe `v_detail`-Abfrage ohne das `eh_delta>0`-Filter, je Top-N nach `eh_delta DESC` und `eh_delta ASC`. Titel „Groesste Veraenderungen gegenueber {spalte_vergleich}".</fix>
</finding>

<finding severity="high" id="H5">
  <title>Keine Verschuldungs-/Finanzierungs-Ansicht — die zentrale Laien-Frage fehlt vollstaendig</title>
  <location>Konzept-/Architektur-Ebene — Tabs web/index.html:113-120; Datenmodell schema.sql:71 (gebarung 'finanzierung'), web/index.html:377 (Filter-Option 'finanzierung')</location>
  <description>„Wie hoch sind die Schulden der Gemeinde?" ist fuer Buergerinnen und Buerger die erste Frage zu einem Gemeindebudget. Die App beantwortet sie nicht: kein Tab, kein Diagramm. Das Datenmodell kennt `gebarung='finanzierung'` (Darlehensaufnahme, Tilgung, Rueckzahlungen) — der Suche-Tab bietet die Filteroption an, aber keine einzige Auswertung greift sie auf. Damit fehlt ein ganzer Haushaltsbereich in der grafischen Aufbereitung.</description>
  <fix>Neuer Tab „Schulden &amp; Finanzierung". Diagramme: (a) Saeulen Darlehensaufnahme vs. Tilgung je Dokument (`gebarung='finanzierung'`, Richtung getrennt) — zeigt Netto-Neuverschuldung; (b) Liniendiagramm des fortgeschriebenen Schuldenstands ueber alle Dokumente; (c) Kennzahlen-Karte „Schuldendienst" (Tilgung + Zinsen aus MVAG-224-Finanzaufwand). Falls der Schuldenstand selbst nicht im Detailnachweis steht: das transparent als Kennzahl-Luecke ausweisen und nur die Bewegung zeigen.</fix>
</finding>

<finding severity="high" id="H6">
  <title>Soll-Ist-Abweichung und Budgetierungspolster sind als SQL berechnet, aber in keinem Diagramm sichtbar</title>
  <location>web/sql/14-soll-ist-abweichung.sql, web/sql/08-budgetierungspolster.sql — kein Pendant in dashboard-data.js/dashboard-charts.js</location>
  <description>Die SQL-Referenz enthaelt zwei fachlich starke Auswertungen, die das Dashboard nicht zeigt. (14) Soll-Ist-Abweichung im RA — „wie belastbar war der Voranschlag?" (`eh_delta` im RA = Ist minus Soll). (08) Budgetierungspolster — VA-Ansatz deutlich ueber dem letzten Ist-Rechnungsabschluss (`eh_dritte`), also moegliche Luft im Plan. Beide treffen genau die Produktfrage nach Spielraeumen und Risiken, beide bleiben dem Web-Nutzer vorenthalten.</description>
  <fix>(1) Soll-Ist-Chart fuer RA-Dokumente: zweiseitiges Balkendiagramm der groessten Abweichungen, Mehrertrag/Minderaufwand gruen, Mehraufwand/Mindereinnahme rot — Tab „Ueberblick" oder „Sparpotenzial". (2) Budgetierungspolster-Chart fuer VA-Dokumente im Sparpotenzial-Tab: horizontale Balken `voranschlag` vs. `ist_rechnungsabschluss` je Posten, Differenz markiert; ersetzt sinnvoll den dort doppelten Wasserfall (siehe M6). Datenquelle: `eh_delta` bzw. `eh_wert - eh_dritte` aus `v_detail`, je Dokumenttyp.</fix>
</finding>

<finding severity="high" id="H7">
  <title>Keine Pro-Kopf-Werte — der Standard kommunaler Haushaltsdarstellung fehlt</title>
  <location>Konzept-/Architektur-Ebene — Datenmodell dokument (schema.sql:18-30) kennt kein Einwohnerfeld; keine Fundstelle fuer „einwohner" im Code</location>
  <description>Jede Buergerhaushalt-/„open budget"-Darstellung arbeitet mit Pro-Kopf-Betraegen — sie sind das einzige Mittel, mit dem ein Laie eine Million Euro greifbar machen und Gemeinden vergleichen kann. Die App kennt keine Einwohnerzahl und zeigt nur Absolutbetraege in „k" und „Mio". „1,2 Mio Aufwendungen" bleibt fuer die meisten Nutzer:innen abstrakt; „1.450 € je Einwohner:in" ist sofort verstaendlich.</description>
  <fix>Ein Eingabefeld fuer die Einwohnerzahl in der Dokumentverwaltung ergaenzen (einmalig, optional, lokal gespeichert). Damit: Pro-Kopf-Zeile auf den Kennzahlen-Karten (Ertraege, Aufwendungen, Nettoergebnis, ggf. Schulden je Einwohner:in) und eine „je Einwohner:in"-Umschaltung fuer die Balkendiagramme. Kein neues Diagramm noetig — nur eine zweite Bezugsgroesse, die jede Zahl einordnet.</fix>
</finding>

<finding severity="high" id="H8">
  <title>Ideenvorschlag: „Wofuer geht 1 Euro?" — eine laientaugliche Aufwandsaufteilung</title>
  <location>Konzept-Ebene — Tab Ueberblick web/index.html:123-175; Datenquelle dashboard-data.js:177-187 (aufwand_art) bzw. :227-232 (gruppen)</location>
  <description>Der Ueberblick-Tab fuehrt mit Wasserfall und Sankey ein — beides eher abstrakte Diagrammtypen. Es fehlt das einfachste, in Buergerhaushalten bewaehrte Bild: „Von einem Euro Ausgaben gehen X Cent in …". Es uebersetzt Anteile in eine Einheit (Cent), die jeder versteht, und braucht keine Achsenlesung.</description>
  <fix>Ein einzelner, voll gestapelter 100-%-Balken oder ein 10x10-Piktogramm-Raster (ECharts `pictorialBar`) der Aufgabengruppen bzw. Aufwandsarten, beschriftet in Cent je Euro. Datenquelle: vorhandenes `aufwand_art` oder `gruppen` aus der Aggregation, nur Normalisierung auf 100. Platzierung ganz oben im Ueberblick-Tab, vor dem Wasserfall.</fix>
</finding>

<finding severity="medium" id="M1">
  <title>Inkonsistente Datenlabel-Schriftgroesse — Iteration 16 wurde im Kommunalsteuer-Trend nicht nachgezogen</title>
  <location>web/js/dashboard-charts.js:492 (chartTrendKomm, fontSize: 10)</location>
  <description>Iteration 16 hat die Diagrammschrift bewusst auf 15px (LABEL_SIZE) angehoben, weil die App viele aeltere Nutzer:innen hat. Die Datenlabels der Kommunalsteuer-Zeitreihe stehen weiterhin auf `fontSize: 10` — ein uebersehener Rest. Genau die Beschriftung, die den Wert direkt am Punkt lesbar machen soll, ist hier am kleinsten. (Hinweis: das vendor-`dashboard.js:379` `gruppenLinie` nutzt ebenfalls noch fontSize 10, ist aber laut Konvention eingefroren.)</description>
  <fix>In chartTrendKomm `fontSize: 10` durch `LABEL_SIZE` ersetzen — Einzeiler, konsistent mit allen anderen Buildern.</fix>
</finding>

<finding severity="medium" id="M2">
  <title>Achsenbeschriftungen werden hart abgeschnitten — der volle Postenname geht auch im Tooltip verloren</title>
  <location>web/js/dashboard-charts.js:212 (chartEinnahmen .slice(0,34)), :225 (chartTreiber .slice(0,34)), :231 (chartInvestitionen .slice(0,36)), :400 (chartKorridor .slice(0,32))</location>
  <description>Die Kategorienamen werden per `String.slice()` gekuerzt, bevor sie als Achsen-Kategorie gesetzt werden. Es gibt kein Auslassungszeichen (der Laie sieht nicht, dass abgeschnitten wurde) und — gravierender — der Tooltip nutzt dieselbe Kategorie, zeigt also ebenfalls nur den Stummel. Der vollstaendige Postenname ist damit nirgends im Diagramm abrufbar. VRV-Bezeichnungen sind oft lang und unterscheiden sich erst spaet im Text; das Abschneiden kann zwei Posten ununterscheidbar machen.</description>
  <fix>Vollen Namen als Kategoriewert behalten; die Kuerzung in den `axisLabel.formatter` verlagern (mit „…"-Suffix). Der Tooltip zeigt dann automatisch den vollen Text. Alternativ Tooltip-`formatter` mit dem Originalnamen versorgen.</fix>
</finding>

<finding severity="medium" id="M3">
  <title>Wasserfall faerbt das Nettoergebnis immer blau — ein Defizit signalisiert kein Risiko</title>
  <location>web/js/dashboard-charts.js:329 (schritte: Nettoergebnis fest INK.blue) vs. dashboard.js:123-126 (Kennzahl-Karte faerbt netto rot/gruen)</location>
  <description>Die Nettoergebnis-Saeule im Wasserfall ist unabhaengig vom Vorzeichen INK.blue. Die Kennzahlen-Karte daneben faerbt dasselbe Nettoergebnis bei Defizit rot, bei Ueberschuss gruen (`is-red`/`is-green`). Ein negatives Ergebnis erscheint im Wasserfall also in ruhigem Blau — und damit harmloser als auf der Karte. Inkonsistente Risiko-Signalisierung im selben Tab.</description>
  <fix>Im Wasserfall die Nettoergebnis-Saeule abhaengig vom Vorzeichen einfaerben: `e.netto >= 0 ? INK.green : INK.red`. Konsistent mit der Kennzahlen-Karte und mit der Farbsemantik des Design-Systems (chart-green = positiv, chart-clay = Risiko).</fix>
</finding>

<finding severity="medium" id="M4">
  <title>Kumulierter Sachaufwand: Balken und Summenlinie teilen eine Achse — die Einzelposten werden zu Strichen</title>
  <location>web/js/dashboard-charts.js:398 (chartKorridor)</location>
  <description>Das Korridor-Diagramm ist ein Pareto-Chart: Einzelposten als Balken, kumulierte Summe als Linie. Beide Serien haengen an derselben Wertachse. Die kumulierte Linie erreicht die Gesamtsumme aller 18 Posten — ein Vielfaches des groessten Einzelbalkens. Folge: die Einzelbalken werden gegen die Achsenobergrenze gequetscht und sind kaum noch differenzierbar. Pareto-Diagramme brauchen zwei Achsen. Zusatzlich ist der Diagrammtyp fuer Laien ohnehin anspruchsvoll.</description>
  <fix>Zweite Wertachse fuer die kumulierte Linie (`yAxisIndex: 1`), skaliert 0-100 % der Gesamtsumme — dann lesen sich die Einzelbalken klar und die Linie sagt „Posten 1-5 = 60 % des Sachaufwands". Begleittext entsprechend in Prozent formulieren. Alternativ den Pareto durch eine schlichte Top-Posten-Balkenliste mit darunter stehender Prozent-Marke ersetzen.</fix>
</finding>

<finding severity="medium" id="M5">
  <title>Treemap als Primaerdarstellung der Aufgabenbereiche — Flaechenvergleich ist fuer Laien ungenau</title>
  <location>web/js/dashboard-charts.js:272 (chartTreemap), UI web/index.html:222-227</location>
  <description>Der „Aufwand nach Aufgabenbereich" wird als Treemap gezeigt. Flaechen lassen sich vom Auge deutlich schlechter vergleichen als Laengen — gerade fuer aeltere Nutzer:innen und bei aehnlich grossen Kacheln. Die verschachtelte Treemap mit Breadcrumb-Zoom verlangt zudem Interaktion, um an die zweite Ebene zu kommen. Fuer die Kernaussage „welcher Aufgabenbereich kostet wie viel" ist das der unnoetig schwerere Weg.</description>
  <fix>Als Primaerdarstellung ein horizontales Balken-Ranking der Aufgabengruppen (Laengen statt Flaechen, sofort vergleichbar) — Daten aus `gruppen` liegen bereits aggregiert vor. Die Treemap als optionale, sekundaere Detailsicht behalten. Damit bleibt der Drill-down erhalten, aber der erste Blick ist eindeutig.</fix>
</finding>

<finding severity="medium" id="M6">
  <title>Der Ergebnis-Wasserfall steht doppelt — im Sparpotenzial-Tab ohne Mehrwert</title>
  <location>web/index.html:146-151 (Ueberblick, c_wasserfall) und :316-321 (Sparpotenzial, c_wasserfall_sp); beide registriert auf dieselbe Chart-Quelle dashboard.js:754-755</location>
  <description>Derselbe Wasserfall wird in zwei Tabs gerendert (beide `kind:"dok", src:"wasserfall"`). Im Sparpotenzial-Tab liefert er keine neue Information — der Tab verspricht „wo liegt Spielraum", der Wasserfall zeigt nur das Gesamtergebnis. Wertvolle Flaeche oberhalb der eigentlichen Sparpotenzial-Diagramme wird mit einer Wiederholung belegt.</description>
  <fix>Den Wasserfall im Sparpotenzial-Tab durch eine dort fehlende Analyse ersetzen — naheliegend das Budgetierungspolster-Diagramm (H6) oder den zweiseitigen Veraenderungs-Chart (H4). Der Wasserfall bleibt einmalig im Ueberblick.</fix>
</finding>

<finding severity="medium" id="M7">
  <title>Uneinheitliche Wertformate erschweren das Lesen — „k" neben „Mio" im selben Diagramm</title>
  <location>web/js/dashboard-charts.js:113 (valAxis default „k"), :349/:391 (Wasserfall: Achse „Mio", Datenlabel „k"), :442/:514 (Trend „Mio")</location>
  <description>Die Diagramme mischen Einheiten: der Wasserfall beschriftet die Achse in „Mio", die Datenlabels derselben Saeulen aber in „k" (`/1000+'k'`). Einnahmen-, Treiber-, Investitionen- und Korridor-Achsen stehen in „k", die Trends in „Mio". Fuer aeltere Nutzer:innen ist „1.234k" schwerer zu erfassen als „1,2 Mio", und der Wechsel innerhalb eines Diagramms zwingt zum Umrechnen.</description>
  <fix>Ein einheitliches Format ueber alle Builder: grosse Betraege als „Mio €" mit einer Nachkommastelle, kleinere als volle Euro mit Tausenderpunkt. Innerhalb eines Diagramms Achse und Datenlabel auf dieselbe Einheit. Eine gemeinsame Formatter-Hilfsfunktion analog zu `euro()` in dashboard.js:21.</fix>
</finding>

<finding severity="medium" id="M8">
  <title>Ideenvorschlag: Saldo je Aufgabenbereich als zweiseitiges Balkendiagramm</title>
  <location>Konzept-Ebene — Datenquelle bereits in web/sql/02-gruppen-uebersicht.sql (einnahmen/ausgaben/saldo je Gruppe), im Dashboard ungenutzt</location>
  <description>SQL 02 berechnet je Aufgabengruppe Einnahmen, Ausgaben und Saldo — kein Dashboard-Diagramm zeigt das. Dabei beantwortet es eine sehr verstaendliche Frage: welcher Aufgabenbereich traegt sich selbst und welcher ist ein Zuschussbereich? Die Treemap zeigt nur Ausgaben, der Sankey nur Bruttofluesse — der Netto-Saldo je Bereich fehlt.</description>
  <fix>Zweiseitiges horizontales Balkendiagramm: je Aufgabengruppe (0-9) der Saldo, Zuschussbereiche links/rot, Ueberschussbereiche rechts/gruen. Datenquelle: `v_gruppe_summe` bzw. die bestehende `gruppen`-Aggregation um die Einnahmenseite ergaenzt. Platzierung im Ausgaben-Tab oder in einem neuen „Aufgabenbereiche"-Tab.</fix>
</finding>

<finding severity="medium" id="M9">
  <title>Ideenvorschlag: Wasserfall vom Ergebnis bis in die Aufwandsarten verfeinern</title>
  <location>Konzept-Ebene — heutige Umsetzung web/js/dashboard-charts.js:325 (chartWasserfall, nur 3 Stufen)</location>
  <description>Der Wasserfall hat nur drei Saeulen: Ertraege, Aufwendungen (Block), Nettoergebnis. Die Aufwandsseite — das, wo der Laie „wohin geht das Geld" verstehen will — ist ein einziger undifferenzierter Balken. Der Diagrammtyp Wasserfall kann genau das: Komposition und Ergebnis in einem Bild.</description>
  <fix>Den Aufwand-Schritt in vier absteigende Stufen aufloesen: Ertraege (Sockel) minus Personal, minus Sachaufwand, minus Transfers, minus Finanzaufwand, Restsaeule = Nettoergebnis. Datenquelle: vorhandenes `aufwand_art`. Ergebnis: ein Bild, das zugleich „so viel nehmen wir ein", „so verteilt sich der Aufwand" und „so viel bleibt" zeigt.</fix>
</finding>

<finding severity="low" id="L1">
  <title>Einnahmen-Balken zeigen keinen Anteil am Gesamtertrag, obwohl der Ring es vormacht</title>
  <location>web/js/dashboard-charts.js:210 (chartEinnahmen) — Anteil bereits in web/sql/03-einnahmestruktur.sql berechnet</location>
  <description>Der Aufwand-Ring beschriftet jede Scheibe mit Prozent (`{d}%`, Zeile 260). Das Einnahmen-Balkendiagramm zeigt nur Absolutwerte. Gerade die Einnahmenseite lebt von der Frage „wie abhaengig sind wir von einer Quelle" — SQL 03 berechnet `anteil_prozent` bereits, das Dashboard verwirft es.</description>
  <fix>Datenlabel der Einnahmen-Balken um den Anteil am Gesamtertrag ergaenzen (z. B. „2,4 Mio € · 18 %"). Anteil aus der Summe der `einnahmen`-Aggregation berechenbar, kein neuer Query noetig.</fix>
</finding>

<finding severity="low" id="L2">
  <title>Ideenvorschlag: Investitionen — wie werden sie finanziert?</title>
  <location>Konzept-Ebene — Tab Investitionen web/index.html:257-278 zeigt nur Auszahlungen</location>
  <description>Der Investitionen-Tab listet nur die groessten investiven Auszahlungen. Die fuer Laien wichtige Anschlussfrage „und wer bezahlt das — Foerderung, Darlehen oder Eigenmittel?" bleibt offen. Investive Einnahmen (`richtung='einnahme'`, `gebarung='investiv'`: Kapitaltransfers/Foerderungen) und die Finanzierungs-Gebarung liegen im Datenmodell vor.</description>
  <fix>Einen gestapelten Balken oder kleinen Sankey ergaenzen: Investitionsvolumen aufgeteilt in Foerderungen/Kapitaltransfers (investive Einnahmen), Darlehen (`gebarung='finanzierung'`) und Eigenmittel (Restgroesse). Falls die Zuordnung aus den Daten nicht eindeutig ableitbar ist, zumindest investive Einnahmen den investiven Auszahlungen gegenueberstellen.</fix>
</finding>

</findings>

<strengths>
<strength>Der Geldfluss-Sankey mit Drill-down (web/js/sankey-drill.js) ist konzeptionell stark: ein Klick klappt eine Einnahmequelle in Konten bzw. eine Aufgabengruppe in Ansaetze auf, die Gegenseite bleibt als Uebersicht stehen, lange Listen werden sauber auf TOP_N gekappt und in „Sonstige" gebuendelt (kappen(), Zeile 104). Das fuehrt vom Ueberblick gefuehrt ins Detail.</strength>
<strength>Der Callout „Wichtige Einordnung" im Sparpotenzial-Tab (web/index.html:341-348) sagt ausdruecklich, dass die Auswertung eine Suchhilfe und keine Empfehlung ist — eine vorbildliche Absicherung gegen Fehlinterpretation durch Laien.</strength>
<strength>Die Kommunalsteuer ist als eigene Kennzahl (Anteil an den Ertraegen, dashboard-data.js:240-242) und als Zeitreihe gefuehrt — eine fachlich treffende Strukturkennzahl, die die Abhaengigkeit von der wichtigsten eigenen Abgabe sichtbar macht.</strength>
<strength>Iteration 16 hat die Diagrammschriften bewusst und konsistent auf 15px angehoben (LABEL_SIZE/AXIS_SIZE, dashboard-charts.js:39-40) mit dokumentierter Begruendung „viele aeltere Nutzer:innen" — die Lesbarkeitsabsicht ist klar im Code verankert.</strength>
<strength>Der Mehrjahres-Vergleich (dashboard.js:325-407, openMehrjahr) erlaubt es, beliebige gesuchte oder gedrillte Posten ueber alle Dokumente als Liniendiagramm zu vergleichen — ein flexibles, ueber die festen Diagramme hinausgehendes Werkzeug, das fehlende Jahre ehrlich als Luecke (`connectNulls:false`) zeigt.</strength>
<strength>Die entsaettigte, semantisch belegte Palette (gruen=positiv, clay=Risiko) und die ruhige Tooltip-/Legenden-Sprache (tip(), legende()) sind konsequent ueber alle Builder gezogen — das Design-System-Ziel „angenehm und gut lesbar" ist auf Diagrammebene eingeloest.</strength>
</strengths>

<traces>
<trace name="Dokumentwechsel -> alle Diagramme">web/vendor/dashboard/dashboard.js:100 setDok -> renderAllCharts -> chartOption (dok-Charts aus CFG.dok_charts[aktivDok]) — Treiber-Titel bleibt dabei statisch (C1)</trace>
<trace name="Geldfluss vom Posten zum Sankey">web/js/dashboard-data.js:124 sankey() SUM(eh_wert) -> web/js/sankey-drill.js:181 buildSankeyOption -> Mittelknoten ohne Bilanz-Ausgleich (H2)</trace>
<trace name="Vergleichsspalten je Posten">web/schema.sql:73-79 eh_vergleich/eh_dritte -> dashboard-data.js:114-119 ev/ed -> in chart-Buildern weitgehend ungenutzt (H3)</trace>
<trace name="Kostentreiber-Delta">web/schema.sql:108-111 eh_delta (Bedeutung typabhaengig) -> dashboard-data.js:194 treiber WHERE eh_delta>0 -> chartTreiber (C1, H4)</trace>
</traces>

<verdict value="fail" critical="1" high="8" medium="9">
Die Diagramme sind handwerklich sauber gebaut, entsaettigt und seit Iteration 16 gut lesbar — aber sie surfacen noch nicht die richtige Information auf die richtige Weise. Ein Befund ist aktiv irrefuehrend: das Kostentreiber-Diagramm wechselt mit dem Dokumenttyp stillschweigend seine Aussage (C1) — daher „fail". Schwer wiegen ausserdem der Plan/Ist-Mischvergleich in den Trends (H1), der bilanziell unvollstaendige „Geldfluss"-Sankey (H2) und vor allem das ungenutzte Datenpotenzial: kein Vorjahresvergleich an den Kennzahlen, keine Verschuldungs-Ansicht, keine Pro-Kopf-Werte, ungenutzte Soll-Ist- und Polster-Analysen. Die groessten Hebel fuer das Verstaendnis eines Gemeindebudgets durch Laien — Einordnung (ggü. Vorjahr, je Einwohner:in), Schulden und eine laientaugliche „Wofuer geht 1 Euro?"-Darstellung — fehlen heute. Empfehlung: C1 sofort beheben, dann H1/H2 entschaerfen und die Ideation-Vorschlaege H5-H8 priorisiert umsetzen.
</verdict>

</review>

