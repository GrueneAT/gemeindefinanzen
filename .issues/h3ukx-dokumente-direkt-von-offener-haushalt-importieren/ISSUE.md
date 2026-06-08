---
id: h3ukx
title: Dokumente direkt von Offener Haushalt importieren
status: done
priority: medium
labels:
- web
- import
- offenerhaushalt
---

## Kontext

Die Browser-App (`web/`) kann VRV-2015-Dokumente bereits aus **zwei** Quellen
einlesen: als PDF (mupdf) und als **OH-CSV-Paar** (EHH+FHH) von
[offenerhaushalt.at](https://offenerhaushalt.at). Die OH-CSV traegt pro Datei
alle noetigen Metadaten (`Jahr;Bundesland;Voranschlag/Rechnungsabschluss;
Datenquelle;Gemeindekennziffer;Gemeindename;Haushalt;...`).

Heute muss der Nutzer die CSVs **manuell** auf offenerhaushalt.at
zusammensuchen (Gemeinde finden → Jahr → VA/RA → Haushalt waehlen),
herunterladen und per Drag & Drop in die App ziehen
(`web/js/csv-parser.js`, EHH+FHH-Merge in `web/js/pipeline.js`).

## Research-Befund (2026-06-08) — entscheidet den Ansatz

Vollstaendig belegt in `RESEARCH-oh-feasibility.md` (echte HTTP-Header,
End-to-End-Flow, Browser-POC unter `poc/oh-direct-fetch/`):

- **Automatischer In-Browser-Import ist NICHT moeglich** (unter Strikt-statisch).
  offenerhaushalt.at sendet **keine CORS-Header** (`Access-Control-Allow-Origin`
  fehlt ueberall) und schuetzt den Download per **CSRF/Session** (Laravel-Flow
  `GET seite` → `POST /downloads/get-token` → `POST /downloads/ghdByParams`).
  Im echten Chromium bricht jeder Cross-Origin-`fetch` mit „blocked by CORS
  policy" ab; `no-cors` liefert nur eine opake, unlesbare Antwort.
- Ein **Proxy/Backend** wuerde funktionieren (serverseitig laesst sich die CSV
  per curl ziehen) — ist aber **ausgeschlossen** (kein Server/Proxy).
- **Tragfaehiger statischer Weg = Deep-Link.** Die OH-Download-Seite **waehlt
  Formularfelder aus Query-Parametern vor** (getestet):
  `…/gemeinde/<slug>/download?haushalt=ehh&rechnungsabschluss=ra&year=2023`
  markiert `haushalt`, `rechnungsabschluss` UND `year` als `selected`.

## Ziel (Pivot auf Deep-Link)

Die App entfernt den **Such-Aufwand**, nicht den Download-Klick: Nutzer sucht
eine Gemeinde, waehlt Jahr + Typ (VA/RA), und die App **verlinkt direkt** auf
die passende OH-Download-Seite mit allem vorausgewaehlt. Konkret soll der Nutzer

- nach **Gemeinden suchen** koennen (Name oder Gemeindekennziffer/GKZ),
- **Jahr** (z. B. 2015–laufend) und **Typ** (Voranschlag/Rechnungsabschluss)
  waehlen,
- pro Auswahl die **zwei Deep-Links (EHH + FHH)** erzeugt bekommen, die in
  einem neuen Tab die exakte OH-Seite mit vorausgewaehlten Feldern oeffnen,
- die zwei heruntergeladenen CSVs per Drag & Drop importieren — die bestehende
  **EHH+FHH-Auto-Zusammenfuehrung** macht daraus unveraendert ein Dokument.

Der Parse-/Pruef-/Speicher-Pfad bleibt **unveraendert**.

## Harte Randbedingungen

- **Strikt statisch:** reine statische Seite (GitHub Pages, kein Build-Schritt,
  Vanilla JS/ESM), **kein Server/Proxy**.
- **Kein Vendoring** neuer Drittbibliotheken (CDN/Package-Manager). Ein
  selbst erzeugter, kleiner Gemeinde-**Datensatz** (eigene Daten, kein
  Fremd-Lib) ist davon nicht betroffen.

## Scope

1. **Gemeinde-Index (Daten):** kleiner statischer Datensatz Name ↔ OH-`slug` ↔
   GKZ (~2.100 oesterreichische Gemeinden). Einmalig erzeugen (Skript unter
   `scripts/`), als JSON unter `web/` ausliefern. Der OH-`slug` ist i. d. R.
   der kleingeschriebene Gemeindename — Sonderfaelle (Umlaute, gleichnamige
   Gemeinden) muessen verifiziert/gemappt werden.
2. **Such-UI** in der Dokumentverwaltung (`web/index.html`, `web/js/app.js`):
   Eingabefeld mit Autocomplete gegen den Index (Name/GKZ), darunter Auswahl
   **Jahr** und **Typ (VA/RA)**.
3. **Deep-Link-Bauer** (neues kleines Modul, z. B. `web/js/oh-deeplink.js`):
   aus (slug, year, ra|va) die zwei URLs (`haushalt=ehh` und `haushalt=fhh`)
   erzeugen; Buttons „EHH oeffnen" / „FHH oeffnen" (neuer Tab) plus klarer
   Hinweis „Dateien herunterladen und hier hineinziehen".
4. **Tests:** Unit-Tests fuer Index-Lookup + URL-Bau; e2e-Test, der Suche →
   Deep-Link-URL prueft (ohne echten Netzabruf).

## Bewusste Grenzen (ehrlich dokumentieren)

- Der **Download-Klick + Drag & Drop bleibt manuell** — der Zwischenschritt
  „runterladen" verschwindet nicht ganz, wird aber zielgenau gefuehrt.
- **Verfuegbarkeit** (welche Jahre/Typen eine Gemeinde freigeschaltet hat) kann
  die App **nicht vorab pruefen** (`data-availability` ist cross-origin
  blockiert) — sie bietet die Jahre an; fehlt etwas, zeigt OH es auf der
  Zielseite.
- **Slug-Pflege**: Umbenennungen/Fusionen koennen den Index veralten lassen.

## Akzeptanzkriterien

- [ ] In der App kann nach einer Gemeinde gesucht werden (Name **oder** GKZ),
      mit Autocomplete gegen den statischen Index.
- [ ] Nach Auswahl von Gemeinde + Jahr + Typ (VA/RA) erzeugt die App die zwei
      korrekten Deep-Links (EHH + FHH), die auf die OH-Seite mit
      vorausgewaehlten Feldern fuehren.
- [ ] Die erzeugten URLs entsprechen dem verifizierten Muster
      `…/gemeinde/<slug>/download?haushalt=<ehh|fhh>&rechnungsabschluss=<ra|va>&year=<jahr>`.
- [ ] Klarer UI-Hinweis fuehrt vom Deep-Link zum bestehenden Drag&Drop-Import;
      die heruntergeladenen EHH+FHH werden wie heute zu einem Dokument
      zusammengefuehrt und erscheinen im Dashboard.
- [ ] Strikt statisch, kein Server/Proxy, kein Vendoring neuer Bibliotheken.
- [ ] Tests gruen (`npm run test:js`, `make web-e2e`); neue Tests fuer
      Index-Lookup, URL-Bau und Such-UI.

## Nicht im Scope (Folge-Arbeit)

- **Automatischer Auto-Import ohne Download-Klick** — nur mit Proxy/Backend
  moeglich (siehe Research); bleibt ausgeschlossen, solange Strikt-statisch gilt.
- **Vergleich mehrerer Gemeinden** im Dashboard — eigenes, abhaengiges Issue
  `uecaf-vergleich-mehrerer-gemeinden-im-dashboard`.

## Bestehende Bausteine

- `web/js/csv-parser.js` (OH-CSV → ParseResult), `web/js/pipeline.js`
  (EHH+FHH-Merge/Detection), `web/js/app.js` (Dokumentverwaltung/UI),
  `web/index.html` (Dropzone/Verwaltung).
- Deep-Link-Mechanik + verifizierte Parameter: `RESEARCH-oh-feasibility.md`.
