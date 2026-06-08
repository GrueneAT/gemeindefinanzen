# PLAN — OH-Direktimport via Deep-Link

Ansatz C (siehe RESEARCH.md). Strikt statisch, kein Vendoring neuer Fremd-Libs.

## Aufgaben

<task id="1" title="Gemeinde-Index-Build-Skript">
  <action>scripts/oh-gemeinde-index.mjs: OH-Startseite holen, `__ives.gemeinden`
  extrahieren, type==="GEM" filtern, web/gemeinden-index.json schreiben
  (name, slug, gkz, published).</action>
  <verify>node scripts/oh-gemeinde-index.mjs erzeugt ~2496 Einträge; Stichproben
  (Herzogenburg, St. Pölten→sankt-pölten, Wörgl→wörgl) korrekt.</verify>
  <done>web/gemeinden-index.json vorhanden und plausibel.</done>
</task>

<task id="2" title="Deep-Link-Modul">
  <action>web/js/oh-deeplink.js: normalisiere() (umlaut-tolerant),
  sucheGemeinden(index,q) (Name + GKZ), baueDownloadLink/baueDownloadLinks()
  (verifiziertes OH-URL-Muster, Slug URL-kodiert), ladeGemeindeIndex().</action>
  <verify>Unit-Tests in tests/js/run.mjs grün.</verify>
  <done>Modul exportiert + getestet.</done>
</task>

<task id="3" title="UI in der Dokumentverwaltung">
  <action>web/index.html: Abschnitt „Auf Offener Haushalt finden" (Suchfeld,
  Jahr, Typ, EHH/FHH-Links, Hinweis). web/js/app.js: verdrahteOhSuche() +
  Aufruf in init(). web/css/app.css: .oh-finder-Stile (Design-Tokens).</action>
  <verify>e2e tests/e2e/oh-finder.spec.mjs grün; smoke/upload ohne Regression.</verify>
  <done>Suche zeigt Treffer, korrekte Deep-Links, EHH+FHH öffnen die richtige
  OH-Seite.</done>
</task>

<task id="4" title="Tests">
  <action>Unit-Tests (Suche/URL/Index) + e2e (Suche per Name und GKZ →
  korrekte URLs).</action>
  <verify>npm run test:js (143/0); npx playwright test (oh-finder + Regression).</verify>
  <done>alle grün.</done>
</task>

## Out of scope

- Automatischer Auto-Import (Proxy-abhängig). 
- Mehr-Gemeinden-Vergleich → Issue uecaf.
