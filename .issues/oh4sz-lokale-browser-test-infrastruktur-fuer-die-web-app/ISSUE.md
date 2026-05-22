---
id: oh4sz
title: Lokale Browser-Test-Infrastruktur fuer die Web-App
status: done
priority: high
labels:
- testing
- browser
- infrastruktur
- ci
---

## Kontext

Die Web-App (`web/`) wird laufend erweitert (Sankey-Drill-down, Upload,
Dashboard, Persistenz). Die bestehenden JS-Tests (`tests/js/run.mjs`, Node)
decken die **Datenpipeline** ab — Parser, Validierung, Aggregation,
Persistenz-Round-Trip — aber nie die **DOM-/Interaktionsschicht**: ob die
Seite im Browser tatsaechlich rendert, ob ein Klick wirkt, ob ein Diagramm
erscheint. Diese Dinge konnten bisher nur manuell im echten Browser geprueft
werden.

Aktueller Anlassfall: Der Sankey-Drill-down (T12) "scheint nicht zu
funktionieren" — und es gibt keinen automatisierten Weg festzustellen, ob das
ein echter Fehler ist oder nur ein noch nicht aktualisiertes Deployment.

## Ziel

Eine lokale, headless ausfuehrbare **Browser-Test-Infrastruktur**, mit der
sich automatisiert und wiederholbar pruefen laesst, dass die Web-App
end-to-end funktioniert: Seite laedt, PDF-Upload, Dashboard rendert, Tabs
schalten, Sankey-Knoten sind klickbar und klappen auf, Persistenz ueberlebt
einen Reload.

## Stack (Vorschlag, im Plan zu bestaetigen)

Playwright mit headless Chromium: per npm installierbar, CI-tauglich. Der
Test serviert `web/` ueber das vorhandene `scripts/serve.mjs`, steuert einen
Browser, laedt eine echte PDF aus `documents/` hoch und prueft das gerenderte
DOM bzw. die Diagramme.

## Umfang

- Playwright (oder Aequivalent) als Dev-Abhaengigkeit aufnehmen.
- Ein Befehl zum Ausfuehren der Browser-Tests (Make-Ziel bzw. npm-Skript),
  der den statischen Server selbst startet/stoppt.
- Testfaelle: Seite laedt ohne Boot-Fehlerbanner; Upload einer documents/-PDF
  fuellt die Dokumentliste mit gruenem Pruefstatus; Dashboard erscheint; Tabs
  schalten um; Diagramme rendern; Sankey-Drill-down (Klick auf einen Knoten
  klappt die naechste Ebene auf); Persistenz (nach Reload sind die Daten da).
- In die GitHub-Actions-CI einbinden oder zumindest dokumentieren, wie man es
  lokal ausfuehrt.
- Den gemeldeten Sankey-Fehler als ersten konkreten Anwendungsfall mit dem
  neuen Harness reproduzieren bzw. ausschliessen.
- **Versionsstempel:** den aktuellen Git-Commit (Kurz-Hash, ggf. Build-Datum)
  in die Seite einbauen (Fusszeile). Der Pages-Workflow stempelt ihn beim
  Build ein (`github.sha`). So laesst sich ein veraltetes Deployment sofort
  erkennen — direkt der zweite Teil des Anlassfalls ("oder deployment ist
  noch stale"). Der Browser-Test prueft den Stempel gegen den erwarteten
  Commit.

## Acceptance Criteria

- [ ] Browser-Tests laufen lokal mit einem Befehl; der statische Server wird
      dabei automatisch gestartet und beendet
- [ ] Ein Headless-Browser laedt die Seite, laedt eine echte PDF hoch und
      prueft Dokumentliste samt Pruefstatus
- [ ] Test prueft: Dashboard erscheint, Tabs schalten um, Diagramme rendern
- [ ] Test prueft den Sankey-Drill-down: Klick auf einen Knoten klappt die
      naechste Ebene auf
- [ ] Test prueft die Persistenz: nach einem Reload sind die Daten noch da
- [ ] Der gemeldete Sankey-Fehler ist reproduziert/diagnostiziert (echter
      Bug vs. veraltetes Deployment)
- [ ] In CI eingebunden oder dokumentiert, wie man es lokal ausfuehrt
- [ ] Die Seite zeigt den Git-Commit, mit dem sie gebaut wurde (Fusszeile) —
      ein veraltetes Deployment ist damit sofort erkennbar
- [ ] Bestehende Python- und JS-Tests bleiben gruen

## Hinweis zum Sankey

"scheint nicht zu funktionieren (oder deployment ist noch stale)" — bei der
Umsetzung zuerst ein veraltetes Deployment ausschliessen (Hard-Reload,
Pages-Stand gegen den aktuellen Commit pruefen), dann mit dem neuen Harness
reproduzieren und ggf. den eigentlichen Fehler beheben.
