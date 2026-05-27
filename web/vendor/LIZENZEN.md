# Vendorisierte Bibliotheken

Die Browser-App laeuft ohne Build-Schritt. Drittbibliotheken werden so
weit wie moeglich per CDN eingebunden (jsDelivr, GitHub Pages); die
unten gelisteten WASM-Pakete liegen aktuell noch direkt im Repo.
Jede behaelt ihre Original-Lizenz.

## mupdf/

`mupdf.js` (npm-Paket `mupdf`) — PDF-Textextraktion.
Lizenz: **GNU AGPL v3** (alternativ kommerzielle Lizenz von Artifex).
Dieses Projekt ist Open Source; die AGPL-Pflicht zur Quelloffenlegung ist
erfuellt. Quelle: https://github.com/ArtifexSoftware/mupdf.js

Dateien: `mupdf.js`, `mupdf-wasm.js`, `mupdf-wasm.wasm`.

## sqlite-wasm/

`@sqlite.org/sqlite-wasm` — SQLite als WebAssembly.
Lizenz: **Public Domain** (SQLite-Lizenz). Quelle: https://sqlite.org/wasm

Dateien: `sqlite3.mjs`, `sqlite3.wasm`, `sqlite3-opfs-async-proxy.js`.

## ECharts

Wird per CDN eingebunden (jsDelivr). Lizenz: Apache 2.0.

## Design System

Gruene-AT-Design-System — `design-system.css` wird per CDN eingebunden
(`https://grueneat.github.io/design-system/`).
Lizenz: **CC BY 4.0**. Urheber: Die Gruenen.

`gat-charts.js` (ECharts-Hilfsfunktionen und Chart-Konstanten,
gleicher Anbieter, gleiche Lizenz) wird per CDN-Import in
`web/js/dashboard-charts.js` und `web/js/sankey-drill.js` eingebunden
(`https://grueneat.github.io/design-system/gat-charts.js`) — kein
Vendoring. Quelle: https://github.com/GrueneAT/design-system
