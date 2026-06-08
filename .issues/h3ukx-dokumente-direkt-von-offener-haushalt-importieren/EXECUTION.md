# EXECUTION — OH-Direktimport via Deep-Link

Ausgeführt auf Branch `worktree-issue-oh-import` (Background-Session, isolierter
Worktree; Merge nach `main` durch den User — siehe CONTEXT.md).

## Aufgaben

- [x] **1 — Gemeinde-Index-Build-Skript.** `scripts/oh-gemeinde-index.mjs`
  extrahiert `__ives.gemeinden` und schreibt `web/gemeinden-index.json`.
  Lauf-Ergebnis: **2496 Gemeinden** (1759 mit freigeschalteten Daten), ~206 KB.
  Stichproben verifiziert (Herzogenburg/31912, St. Pölten→`sankt-pölten`,
  Wörgl→`wörgl`).
- [x] **2 — Deep-Link-Modul** `web/js/oh-deeplink.js`: `normalisiere`
  (ö→oe/ä→ae/ü→ue/ß→ss + Diakritika), `sucheGemeinden` (Name- und GKZ-Suche,
  Präfix vor Teiltreffer), `baueDownloadLink`/`baueDownloadLinks` (verifiziertes
  OH-URL-Muster, Slug URL-kodiert), `ladeGemeindeIndex`.
- [x] **3 — UI** in der Dokumentverwaltung: Abschnitt „Auf Offener Haushalt
  finden" (`web/index.html`), `verdrahteOhSuche()` + init-Aufruf
  (`web/js/app.js`), Stile (`web/css/app.css`). Suchfeld mit Autocomplete,
  Jahr- und Typ-Auswahl, EHH/FHH-Deep-Link-Buttons, Hinweis auf Drag&Drop.
- [x] **4 — Tests** (siehe unten).

## Testergebnisse

- `npm run test:js` → **143 bestanden, 0 fehlgeschlagen** (inkl. neuer
  OH-Deeplink-Block: normalisiere, URL-Bau inkl. Umlaut-Encoding, EHH+FHH-Paar,
  Fehlerfälle, Index-Suche nach Name/GKZ, nicht-ableitbarer Slug `sankt-pölten`).
- `npx playwright test tests/e2e/oh-finder.spec.mjs` → **2 passed** (Suche nach
  Name → korrekte Deep-Links EHH+FHH; Suche nach GKZ 31912 → Herzogenburg).
- Regression `smoke + csv-upload + upload` → **4 passed**.

## Akzeptanzkriterien (aus ISSUE.md)

- [x] Suche nach Gemeinde (Name **oder** GKZ) mit Autocomplete.
- [x] Korrekte Deep-Links (EHH+FHH) mit vorausgewählten Feldern.
- [x] URLs entsprechen dem verifizierten Muster.
- [x] UI-Hinweis führt zum bestehenden Drag&Drop-Import (Auto-Merge unverändert).
- [x] Strikt statisch, kein Server/Proxy, kein Vendoring neuer Bibliotheken.
- [x] Tests grün (Unit + e2e).

## Geänderte/neue Dateien

- neu: `scripts/oh-gemeinde-index.mjs`, `web/gemeinden-index.json`,
  `web/js/oh-deeplink.js`, `tests/e2e/oh-finder.spec.mjs`
- geändert: `web/index.html`, `web/js/app.js`, `web/css/app.css`,
  `tests/js/run.mjs`

## Offene Punkte / Folge-Arbeit

- `web/gemeinden-index.json` ist abgeleitete Momentaufnahme — bei Gemeinde-
  Fusionen/-Umbenennungen `node scripts/oh-gemeinde-index.mjs` erneut laufen
  lassen (idealerweise als `make`-Target / CI-Schritt).
- Verfügbarkeit je Jahr/Typ nicht vorab prüfbar (cross-origin).
- Automatischer Auto-Import bleibt Proxy-abhängig; Mehr-Gemeinden-Vergleich →
  Issue `uecaf`.
- `.html`-Sichten (RESEARCH/PLAN/EXECUTION) via `/issue:view` noch nicht erzeugt.
