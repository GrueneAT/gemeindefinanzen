# Vendorisierte Bibliotheken

Die Browser-App ist ohne Build-Schritt deploybar; die benoetigten
Bibliotheken liegen daher direkt im Repo. Jede behaelt ihre Original-Lizenz.

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

`design-system.css` wird per CDN eingebunden
(`flomotlik.github.io/claude-code`).
