---
id: uwxdv
title: Diagramm-Werkzeuge — Builder, Galerie und Bild-Export
status: open
priority: medium
labels:
- dashboard
- export
- frontend
- feature
---

## Kontext

Das Dashboard der Web-App (`web/`) enthaelt zahlreiche ECharts-Diagramme —
Wasserfall, Geldfluss-Sankey, Einnahmestruktur, Aufwand nach Art, Treemap,
Sparpotenzial-Korridor, Kostentreiber, die Trend-/Zeitreihen-Charts und den
Mehrjahres-Vergleich.

Es kam die Anfrage, diese Finanz-Diagramme **als Bild exportierbar** zu
machen, damit sie auf Social Media oder anderen Seiten weiterverwendet werden
koennen. Zusaetzlich gewuenscht: ein eigener Tab mit einer **Diagramm-
Galerie** — eine durchsuchbare Uebersicht vieler Diagramme, jedes davon
exportierbar — sowie ein **Diagramm-Builder**, mit dem sich aus den Daten der
„Suche & Daten"-Ansicht eigene Diagramme erstellen lassen.

## Ziel

1. **Bild-Export je Diagramm:** jedes Diagramm laesst sich als PNG/Bild
   herunterladen.
2. **Galerie-Tab:** ein neuer Tab, der viele Diagramme gesammelt zeigt,
   durchsuch- und filterbar, jedes exportierbar.
3. **Diagramm-Builder:** aus der gefilterten/ausgewaehlten Datenmenge der
   Suche ein eigenes Diagramm bauen — Diagrammtyp und Achsen/Gruppierung
   waehlbar, Ergebnis exportierbar (und ggf. in der Galerie ablegbar).

## Umfang

- **Export:** je Diagramm eine Export-Aktion (ECharts bietet `getDataURL()`
  bzw. die `saveAsImage`-Toolbox). Das exportierte Bild soll **eigenstaendig
  brauchbar** sein — also mit Titel, Gemeinde/Quelle und Dokument/Jahr
  beschriftet, nicht nur das nackte Diagramm. Fuer Social Media zaehlt
  ausreichende Aufloesung (z.B. `pixelRatio` 2) und ein sauberer Hintergrund.
- **Galerie-Tab** „Diagramme": eine Uebersicht der verfuegbaren Diagramme
  (die bestehenden Dashboard-Diagramme gesammelt, ggf. zusaetzliche
  Varianten/Aufschluesselungen).
- **Durchsuchbar/filterbar:** die Galerie nach Thema (Einnahmen, Ausgaben,
  Investitionen, Transfers, Trends ...), nach Dokument/Jahr und per Volltext
  auffindbar.
- **Diagramm-Builder:** im Tab „Suche & Daten" (bzw. anschliessend) aus der
  aktuell gefilterten oder angekreuzten Postenmenge ein Diagramm erzeugen.
  Der Nutzer waehlt einen Diagrammtyp (Balken, Linie, Kreis/Ring, Treemap …)
  und was dargestellt wird (Kategorie-/Gruppierungsfeld, Wertspalte, ggf.
  Aggregation). Das erzeugte Diagramm ist exportierbar und kann optional in
  der Galerie abgelegt werden.
- Konsistent mit dem flomotlik Design System; Vanilla JS, kein Build-Schritt.

## Offene Designfragen (in discuss/plan zu klaeren)

- ECharts-eigener `saveAsImage` vs. eigenes Rendering mit Beschriftung/Quelle.
- Bildformat: PNG (Hintergrund Papierfarbe oder transparent?), evtl. SVG.
- Branding im Export: Gemeindename, Quelle, Datum/Commit als Fusszeile?
- Galerie-Inhalt: nur die bestehenden Dashboard-Diagramme gesammelt, oder
  zusaetzliche Diagrammvarianten?
- Builder: wie viel Konfigurierbarkeit (feste Diagrammvorlagen vs. freie
  Achsen-/Aggregationswahl)? Welche Diagrammtypen? Bleiben gebaute Diagramme
  erhalten (in der Galerie / lokal gespeichert)?

## Abhaengigkeit

Baut auf dem bestehenden Dashboard auf (Issues pba6b, cac6c — erledigt). Die
Browser-Test-Infrastruktur (Issue oh4sz) sollte den Bild-Export per e2e-Test
mit abdecken, sobald sie gemergt ist.

## Acceptance Criteria

- [ ] Jedes Diagramm im Dashboard laesst sich als PNG/Bild exportieren
- [ ] Das exportierte Bild ist eigenstaendig brauchbar — mit Titel,
      Gemeinde/Quelle und Dokument/Jahr beschriftet, social-media-tauglich
- [ ] Neuer Tab „Diagramme" mit einer Galerie-Uebersicht vieler Diagramme
- [ ] Die Galerie ist durchsuch- und filterbar (Thema, Dokument, Volltext)
- [ ] Jedes Diagramm in der Galerie ist exportierbar
- [ ] Diagramm-Builder: aus der gefilterten/ausgewaehlten Suchmenge laesst
      sich ein Diagramm mit waehlbarem Typ und waehlbarer Daten-/Achsenbelegung
      erzeugen
- [ ] Ein im Builder erzeugtes Diagramm ist exportierbar
- [ ] Vanilla JS, kein Build-Schritt; Design System konsistent
- [ ] Bestehende Python- und JS-Tests bleiben gruen; auf GitHub Pages deploybar
