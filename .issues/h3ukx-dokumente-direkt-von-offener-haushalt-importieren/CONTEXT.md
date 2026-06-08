# CONTEXT — Entscheidungen (Discuss)

## Getroffene Entscheidungen

- **Strikt statisch, kein Proxy/Server.** Bestätigt. Damit ist ein echter
  Auto-Import ausgeschlossen (OH nicht CORS-fähig + CSRF; Statistik Austria
  ohne CORS und nur aggregiert) → **Ansatz: Suche + Deep-Link** auf die OH-
  Download-Seite mit vorausgewählten Feldern.
- **Statistik Austria geprüft** (Wunsch des Users): als direkte Browser-Quelle
  ungeeignet — nur Aggregate, kein offener Detaildatensatz, kein CORS. Siehe
  RESEARCH-oh-feasibility.md, Ansatz D.
- **Gemeinde-Index: ganz Österreich.** Quelle ist OHs eigenes
  `__ives.gemeinden` (2496 Gemeinden inkl. nicht-ableitbarer Slugs). Einmalig
  per Build-Skript zu statischem JSON extrahiert — kein Vendoring einer Fremd-
  bibliothek, kein Laufzeit-Cross-Origin-Abruf.
- **UI-Platzierung: in der Dokumentverwaltung** (neuer Abschnitt „Auf Offener
  Haushalt finden" über der Dropzone).

## Bewusst akzeptierte Grenzen

- Der Download-Klick + Drag&Drop bleibt manuell (Reibung reduziert, nicht
  eliminiert).
- Verfügbarkeit je Gemeinde/Jahr ist vorab nicht prüfbar (cross-origin) — alle
  Jahre werden angeboten.
- Slug-Index muss bei Gemeinde-Fusionen/-Umbenennungen neu erzeugt werden.

## Umgebungs-Anmerkung

Background-Session in isoliertem Worktree: die formale `/issue:work`-Mechanik
(separater Executor-Worktree) bricht hier (issue-cli-Worktrees verschachteln
und korrumpieren den git-Pointer; ein frischer isolierter Worktree zweigt von
origin/main ab, dem Issue + Config-Fix fehlen). Daher Pipeline **auf dem Branch
`worktree-issue-oh-import`** ausgeführt; Merge nach `main` durch den User.
