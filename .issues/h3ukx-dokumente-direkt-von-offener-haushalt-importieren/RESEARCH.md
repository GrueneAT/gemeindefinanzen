# RESEARCH — Synthese

> Vollständige Evidenz (HTTP-Header, End-to-End-Flow, Chromium-POC, Statistik-
> Austria-Prüfung, Index-Extraktion): **`RESEARCH-oh-feasibility.md`**.

## Frage

Lässt sich „Dokumente direkt von Offener Haushalt importieren" in einer
strikt-statischen Browser-App (GitHub Pages, kein Server/Proxy) umsetzen?

## Befunde

1. **Echter Auto-Import (CSV im Browser laden): nicht möglich.**
   offenerhaushalt.at sendet keine CORS-Header und schützt den Download per
   CSRF/Session (Laravel: `GET seite` → `POST /downloads/get-token` → `POST
   /downloads/ghdByParams`). Im echten Chromium scheitert jeder Cross-Origin-
   `fetch` („blocked by CORS policy"); `no-cors` liefert eine opake, unlesbare
   Antwort. Server-/Proxy-seitig funktioniert der Flow (per curl belegt) — Proxy
   ist aber ausgeschlossen.
2. **Statistik Austria als Quelle: ungeeignet.** Nur aggregierte Daten (kein
   Ansatz/Konto-Detailnachweis), kein offener Detaildatensatz im OGD-Katalog,
   und ebenfalls kein CORS auf den OGD-CSVs.
3. **Tragfähiger Weg = Deep-Link.** Die OH-Download-Seite wählt `haushalt`,
   `rechnungsabschluss` und `year` aus Query-Parametern vor (verifiziert). Die
   App sucht die Gemeinde und verlinkt zielgenau; der Nutzer lädt EHH+FHH und
   zieht sie in die bestehende Dropzone (Auto-Merge unverändert).
4. **Gemeinde-Index extrahierbar.** OHs `__ives.gemeinden` (2496 Gemeinden,
   Name↔slug↔GKZ) ist die zuverlässige Quelle; Slugs sind nicht aus dem Namen
   ableitbar.

## Integrationspunkte (Bestand)

- `web/js/csv-parser.js` (OH-CSV → ParseResult), `web/js/pipeline.js`
  (`verarbeiteCsvDateien`, EHH+FHH-Merge), `web/js/app.js`
  (`verdrahteUpload`/`verarbeiteDateien`, Dropzone `#file-input`/`#dropzone`),
  `web/index.html` (`doc-manager-body`), `tests/js/run.mjs` (Unit-Harness
  mit `pruefe()`), `tests/e2e/*.spec.mjs` (`oeffneApp`, `window.__appBereit`).

## Schlussfolgerung

Ansatz C umsetzen (Suche + Deep-Link). Auto-Import bleibt Folge-Arbeit unter
einer eventuellen Proxy-Entscheidung; Mehr-Gemeinden-Vergleich → Issue `uecaf`.
