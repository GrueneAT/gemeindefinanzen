---
id: h3ukx
title: Dokumente direkt von Offener Haushalt importieren
status: open
priority: medium
labels:
- web
- import
- offenerhaushalt
---

> **Research-Ergebnis (2026-06-08) — siehe `RESEARCH-oh-feasibility.md`:**
> Der echte „lädt die CSV automatisch rein"-Direktimport ist unter der
> Strikt-statisch-Vorgabe **nicht möglich** — offenerhaushalt.at sendet keine
> CORS-Header und schützt den Download per CSRF/Session (im echten Chromium
> belegt, POC unter `poc/oh-direct-fetch/`). **Empfohlener Pivot:** Gemeinde-
> Suche + **Deep-Link** auf die korrekte OH-Download-Seite — die Seite wählt
> `haushalt`, `rechnungsabschluss` und `year` aus Query-Parametern vor (getestet).
> Der Scope unten ist entsprechend zu aktualisieren.

## Kontext

Die Browser-App (`web/`) kann VRV-2015-Dokumente bereits aus **zwei** Quellen
einlesen: als PDF (mupdf) und als **OH-CSV-Paar** (EHH+FHH) von
[offenerhaushalt.at](https://offenerhaushalt.at). Die OH-CSV traegt pro Datei
bereits alle Metadaten, die wir brauchen:

```
Jahr;Bundesland;Voranschlag/Rechnungsabschluss;Datenquelle;
Gemeindekennziffer;Gemeindename;Haushalt;...
```

Heute muss der Nutzer die CSVs aber **manuell von offenerhaushalt.at
herunterladen** und danach per Drag & Drop in die App ziehen
(`web/js/csv-parser.js`, Zusammenfuehrung EHH+FHH in `web/js/pipeline.js`).

## Ziel

Den Download-Zwischenschritt entfernen: Dokumente **direkt in der App** von
Offener Haushalt holen. Konkret soll der Nutzer

- nach **Gemeinden suchen** koennen (Name / Gemeindekennziffer),
- eine **Auswahl der Dokumente der letzten Jahre** angezeigt bekommen,
- zwischen **Voranschlag (VA/NVA)** und **Rechnungsabschluss (RA)**
  unterscheiden koennen,
- ein oder mehrere Dokumente auswaehlen und **direkt importieren** koennen —
  ohne die Dateien zwischendurch lokal speichern zu muessen.

Der eigentliche Parse-/Pruef-/Speicher-Pfad bleibt unveraendert: der Direkt-
Import erzeugt dieselben Eingaben (CSV-Text bzw. `Uint8Array`), die der
bestehende OH-CSV-Pfad schon verarbeitet (inkl. automatischer EHH+FHH-
Zusammenfuehrung). Neu ist im Wesentlichen eine **Such-/Auswahl-UI plus eine
Fetch-Schicht**.

## Harte Randbedingung: strikt statisch

Die App ist eine **reine statische Seite** (GitHub Pages, kein Server, kein
Build-Schritt, Vanilla JS/ESM). Das bleibt so — **kein eigener Server, kein
Proxy** (Entscheidung). Dadurch steht und faellt das Feature mit der Frage,
ob offenerhaushalt.at einen **im Browser direkt nutzbaren, CORS-tauglichen
Zugang** bietet.

Zusaetzlich gilt die Workspace-Regel **kein Vendoring** neuer
Drittabhaengigkeiten — nur CDN/Package-Manager. Keine eingebetteten Offline-
Datenstaende, die das Repo aufblaehen.

## Offene Punkte fuer die Research-Phase

1. **OH-Datenzugang:** Gibt es eine API oder ein stabiles CSV-Download-URL-
   Muster nach Gemeindekennziffer × Jahr × Typ (VA/RA) × Haushalt (EHH/FHH)?
   Wie sieht der heutige Download-Link aus, den ein Nutzer manuell bekommt?
2. **CORS:** Liefert offenerhaushalt.at die noetigen `Access-Control-Allow-
   Origin`-Header fuer einen Browser-`fetch()` von unserer Pages-Domain?
   (Wenn nein, ist das Feature unter der Strikt-statisch-Vorgabe **nicht
   lieferbar** — Ergebnis sauber dokumentieren, statt einen Proxy zu bauen.)
3. **Gemeindeverzeichnis:** Woher kommt die Liste der Gemeinden + GKZ fuer die
   Suche? Liefert OH ein durchsuchbares Verzeichnis/Endpoint, oder brauchen
   wir eine (klein gehaltene, per CDN/Pages bezogene, nicht ins Repo
   vendorisierte) statische Gemeindeliste?
4. **Verfuegbare Jahre/Typen pro Gemeinde:** Wie ermitteln wir, welche
   Dokumente (Jahre, VA/RA) fuer eine Gemeinde ueberhaupt existieren?
5. **Rate-Limits / Nutzungsbedingungen** von offenerhaushalt.at.

## Scope

- Such-/Auswahl-UI in der Dokumentverwaltung (`web/index.html`,
  `web/js/app.js`): Gemeindesuche, Jahres-/Typ-Auswahl, Mehrfachauswahl.
- Fetch-Schicht, die ausgewaehlte OH-Dokumente direkt laedt und in den
  bestehenden Import-Pfad (`csv-parser.js` → `pipeline.js`) einspeist.
- Wiederverwendung der bestehenden EHH+FHH-Zusammenfuehrung und der 52
  Plausibilitaetspruefungen — kein zweiter Parser.
- Saubere Fehlerbehandlung (Gemeinde/Jahr ohne Daten, Netzfehler, CORS-Block).

## Nicht im Scope (Folge-Arbeit)

- **Vergleich mehrerer Gemeinden** im Dashboard — eigenes, abhaengiges Issue
  (`hh... vergleich-mehrerer-gemeinden-im-dashboard`). Aktuell modelliert das
  Schema (`web/schema.sql`) zwar mehrere Dokumente, aber implizit **eine
  Gemeinde**; mehrere Gemeinden gleichzeitig sind noch nicht vorgesehen.

## Akzeptanzkriterien

- [ ] Research dokumentiert eindeutig, ob ein CORS-tauglicher Direkt-Zugang zu
      offenerhaushalt.at existiert; falls nicht, ist das Feature unter der
      Strikt-statisch-Vorgabe als nicht lieferbar dokumentiert (mit Beleg).
- [ ] Bei vorhandenem Zugang: In der App kann nach einer Gemeinde gesucht
      werden (Name oder Gemeindekennziffer).
- [ ] Fuer eine gefundene Gemeinde werden verfuegbare Dokumente der letzten
      Jahre gelistet, klar getrennt nach VA/NVA und RA.
- [ ] Ein oder mehrere Dokumente lassen sich auswaehlen und **ohne manuellen
      Download** importieren; sie erscheinen danach wie heutige Importe in der
      Dokumentliste und im Dashboard.
- [ ] Der Import nutzt den bestehenden CSV-/Pipeline-Pfad inkl. EHH+FHH-
      Merge und Pruefstatus „OK 52/52".
- [ ] Keine neue vendorisierte Drittabhaengigkeit; kein Server/Proxy.
- [ ] Tests gruen (`npm run test:js`, `make web-e2e`); e2e deckt den
      Direkt-Import zumindest mit gemocktem Netz ab.

## Hinweise zur Umsetzung

- Bestehende Bausteine: `web/js/csv-parser.js` (OH-CSV → ParseResult),
  `web/js/pipeline.js` (EHH+FHH-Merge, Detection), `web/js/db.js`
  (sqlite-wasm/IndexedDB-Persistenz), `web/js/app.js` (Dokumentverwaltung/UI).
- Der Direkt-Import sollte denselben Datentyp produzieren wie ein per Drag &
  Drop geladenes CSV, damit downstream nichts angepasst werden muss.
