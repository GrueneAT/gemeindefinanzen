# Execution: Impressum und Datenschutzerklaerung im Footer verlinken

**Started:** 2026-09-01T21:40:00Z
**Status:** complete
**Branch:** issue/khnpz-impressum-und-datenschutzerklaerung-im-footer-verlinken

## Execution Log

- [x] Impressum- und Datenschutz-Links im Footer ergaenzen — commit 15ff25b
  - Kein Rule-1/2/3-Abweichen noetig; Umsetzung folgt exakt der ISSUE.md.

## Verification Results

**e2e (Playwright, `npm run test:e2e`):** 58 passed, 27 skipped (Korpus-Tests
sind Opt-in ueber Umgebungsvariablen und liefen bereits vor der Aenderung
nicht mit), 0 failed. Neuer Test `tests/e2e/footer-links.spec.mjs` prueft den
gebauten/ausgelieferten Zustand (via lokalem `scripts/serve.mjs`-Server auf
Port 8080), nicht nur den Quelltext.
**js (`npm run test:js`):** 143 bestanden, 0 fehlgeschlagen.
**Lint/Typecheck:** kein JS-Lint-Skript im Repo konfiguriert (`package.json`
hat nur `test:js`/`test:e2e`); nichts zu pruefen fuer eine reine
HTML-Aenderung.
**Geteilter Preview-Server:** vor dem Testlauf geprueft — kein
`vite preview`- oder `serve.mjs`-Prozess auf Port 8080 aktiv, kein
Portkonflikt.

## Deviations from Plan

### Auto-fixed (Rules 1-3)

Keine.

### Blocked (Rule 4)

Keine.

## Discovered Issues

Keine ausserhalb des Scopes gefunden.

## Self-Check

- [x] `web/index.html` enthaelt beide Links mit korrekten URLs
      (`https://gruene.at/impressum/`,
      `https://gruene.at/datenschutzerklarung/` — exakt ohne "ae"/"ss")
- [x] Beide Links tragen `target="_blank" rel="noopener"`
- [x] Commit 15ff25b existiert auf dem Branch (`git log --oneline`)
- [x] Volle e2e- und js-Suite laeuft gruen
- [x] Kein TODO/FIXME/console.log/debugger in den geaenderten Dateien
- [x] Neuer Test verifiziert das gebaute/ausgelieferte Ergebnis, nicht nur
      den Quelltext
- **Result:** PASSED

**Completed:** 2026-09-01T21:49:00Z
**Duration:** ~9 min
**Commits:** 1
