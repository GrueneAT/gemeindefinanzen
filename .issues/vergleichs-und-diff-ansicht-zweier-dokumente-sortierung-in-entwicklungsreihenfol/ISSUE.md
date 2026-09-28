---
id: lsx7v
title: Vergleichs- und Diff-Ansicht zweier Dokumente, Sortierung in Entwicklungsreihenfolge
status: done
priority: high
---

Mit Voranschlag und Nachtragsvoranschlag 2026 derselben Gemeinde im Werkzeug
fehlen zwei Dinge: ein brauchbarer Vergleich der beiden, und eine richtige
Sortierung.

**Sortierung.** Ein Finanzjahr durchlaeuft immer dieselben Stufen — der
Voranschlag wird im Vorjahr beschlossen, ein Nachtragsvoranschlag aendert ihn
im laufenden Jahr, der Rechnungsabschluss schliesst es danach ab. Die App
sortiert an drei Stellen anders:

- `web/js/dashboard-data.js`: `CASE typ WHEN 'RA' THEN 0 WHEN 'NVA' THEN 1
  WHEN 'VA' THEN 2` mit dem Kommentar „Ist vor Plan" — genau verkehrt.
- Die Kommunalsteuer-Zeitreihe (ebenda) sortiert `ORDER BY finanzjahr, typ`,
  also alphabetisch: NVA, RA, VA.
- `web/js/db.js` (Liste der geladenen Dokumente) ebenso alphabetisch.

**Vergleich.** Es gibt nur den Dokument-Umschalter, der ein Dokument nach dem
anderen zeigt. Was ein Nachtrag am Voranschlag geaendert hat, muss man sich
aus zwei Ansichten zusammenreimen. Es fehlt eine Diff-Ansicht, die die
Veraenderungen — besonders auf der Ausgabenseite — schnell sichtbar und
visuell pruefbar macht.

## Was zu tun ist

### Sortierung

Die Entwicklungsreihenfolge VA -> NVA -> RA an einer Stelle definieren und von
dort beziehen, statt sie je Abfrage neu zu buchstabieren. Zwei Folgefehler
haengen daran:

- Die Vorbelegung des Dashboards ist „juengster Voranschlag". Mit geladenem
  Nachtrag zeigt die App beim Oeffnen den bereits ueberholten Voranschlag.
- Das Budgetierungspolster ist auf `typ='VA'` eingeschraenkt. Ein
  Nachtragsvoranschlag ist ein Voranschlag — die Frage nach der Luft im Plan
  stellt sich dort genauso.

### Vergleichs-Tab

Ein eigener Tab, der zwei beliebige geladene Dokumente gegeneinanderstellt
(Basis -> Vergleich), vorbelegt mit dem VA/NVA-Paar desselben Jahres.

Der Schluessel ist das VRV-Tripel **(Ansatz, Konto, Richtung)**: im
Detailnachweis eines PDF kommt jede Kombination genau einmal vor, der
Vergleich ist damit exakt und braucht kein Namens-Matching. Aggregiert wird
trotzdem, weil OH-CSV-Dokumente Ergebnis- und Finanzierungshaushalt in
getrennten Zeilen fuehren und PDF-Dokumente beide Haelften in einer.

Ergebnis- und Finanzierungshaushalt werden getrennt gerechnet und nie
addiert.

Fuenf Sichten auf denselben Diff:

1. Kennzahlen je Haushaltshaelfte mit Basis, Vergleich und Delta
2. Wasserfall-Bruecke vom Saldo der Basis zum Saldo des Vergleichs, nach
   Ansatz aufgeschluesselt
3. Treemap der Veraenderungen — Flaeche = Betrag, Farbe = Richtung
4. Veraenderung je Aufgabengruppe, Einnahmen und Ausgaben getrennt
5. Diff-Tabelle mit Filtern, Sortierung und CSV-Export; voreingestellt nur
   die veraenderten Zeilen

**Selbstkontrolle.** Jedes VRV-Dokument druckt seine Vergleichszahl mit ab —
ein Nachtrag den Voranschlag desselben Jahres, ein Voranschlag den des
Vorjahres. Ist das Basisdokument genau dieses Dokument, laesst sich die
geladene Basis gegen die abgedruckte Spalte nachrechnen. Der Diff ist dann
belegt und nicht nur plausibel.

### Fixtures

Der Nachtragsvoranschlag 2026 und der Voranschlag 2026 in der beschlossenen
Fassung (OH-CSV-Paar) gehoeren zu den gepinnten Herzogenburg-Fixtures — sonst
gibt es kein VA/NVA-Paar desselben Jahres zum Testen.

## Akzeptanzkriterien

- [ ] Dokumente stehen ueberall in Entwicklungsreihenfolge: Umschalter,
      Achsen der Trend-Diagramme, Dokumentliste
- [ ] Vorbelegung ist das juengste gueltige Planungsdokument (NVA vor VA)
- [ ] Der Vergleichs-Tab stellt zwei beliebige Dokumente gegeneinander,
      vorbelegt mit dem VA/NVA-Paar desselben Jahres
- [ ] Ergebnis- und Finanzierungshaushalt getrennt umschaltbar, nie addiert
- [ ] Alle fuenf Sichten vorhanden und im Browser nachgewiesen
- [ ] Die Diff-Tabelle ist filterbar (Richtung, Gruppe, Gebarung, Status,
      Schwellwert, Volltext), sortierbar und als CSV exportierbar
- [ ] Die Selbstkontrolle rechnet das Basisdokument gegen die abgedruckte
      Vergleichsspalte nach und meldet Abweichungen
- [ ] Die Kennzahlen stimmen mit den Summenzeilen der Anlage 1a des NVA
      ueberein
- [ ] Build/Tests laufen durch (js, e2e, Python)

## Constraints

- Kein Vendoring; ECharts und Design-System weiter per CDN
- Vanilla JS, ESM, kein Build-Schritt fuer die ausgelieferte Seite
- Deutsch in UI-Texten und Code-Bezeichnern
- Conventional Commit, keine Werkzeug-Attribution
