# CLAUDE.md — Gemeindefinanzen

Werkzeug zur Analyse oesterreichischer Gemeindevoranschlaege und Rechnungs-
abschluesse (VRV 2015). Die statische Browser-App unter `web/` ist das
genutzte Produkt; die Python-Pipeline (`src/`, CLI `gemfin`) ist Referenz-
implementierung und Datenwerkzeug.

## Kein Vendoring, kein Offline

- **Drittbibliotheken werden NICHT ins Repo vendorisiert.** Sie werden per
  **CDN** eingebunden (jsDelivr o. ae.) — das gilt fuer ECharts, das
  Design-System-CSS, Schriften und jede weitere externe Bibliothek.
- Grund: geteiltes Browser-Caching ueber Seiten hinweg und schlanke Deploys.
- **Es gibt kein Offline-Ziel.** Die App und ihre Seiten duerfen eine
  Internetverbindung voraussetzen. Nichts wird „fuer offline" eingebettet,
  gebuendelt oder vendorisiert — nirgends.
- Wer eine neue Abhaengigkeit braucht: per CDN verlinken, nicht ins Repo
  kopieren.

## Weitere Konventionen

- Browser-App: Vanilla JavaScript, ESM, **kein Build-Schritt** fuer die
  ausgelieferte Seite.
- Sprache: Deutsch in UI-Texten und Code-Bezeichnern.
- Commits, Code und Kommentare: **keine Werkzeug-Attribution** (kein
  „claude", kein „Generated with", kein Co-Authored-By).
- Tests muessen gruen bleiben: `npm run test:js`, `PYTHONPATH=src pytest -q`,
  `ruff check src tests`, `mypy src`.
- Deployment: GitHub Pages ueber `.github/workflows/pages.yml`; jeder Push
  auf `main` deployt neu.
