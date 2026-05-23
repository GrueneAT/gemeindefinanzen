# CONTEXT — a7x2n Auswertungen erweitern

## Direktiven (vom User)

- **Discuss-Phase entfaellt.** Direkt aus den vorhandenen Reviews implementieren.
- **Quelle:** die zwei externen Topic-Reviews unter
  `.issues/grafische-auswertungen-gemeindebudget-verstaendlichkeit/reviews/`
  (Claude Opus 4.7 + Codex gpt-5).
- **Mehrere Varianten bei unklaren Designentscheidungen.** Wo das Review oder
  die Datenlage zwei sinnvolle Diagrammvarianten zulaesst (z. B.
  „Wofuer geht 1 Euro?" als 100-%-Balken oder Piktogramm-Raster;
  Soll-Ist als Diverging-Bar oder Dumbbell), beide implementieren und mit
  klarem Label „Variante A" / „Variante B" untereinander rendern, damit der
  User sie online vergleichen und auswaehlen kann. Eine Nach-Iteration nimmt
  dann jeweils die nicht gewaehlte heraus.

## Geklaerte Designentscheidungen

- **`web/vendor/dashboard/dashboard.js` ist editierbar.** Es ist
  erstparteilicher Dashboard-Controller (kein vendorisiertes Drittprodukt).
  Die bisherige „nicht anfassen"-Beschraenkung galt nur fuer den reinen
  CSS-Rebuild und entfaellt fuer diese Feature-Arbeit. Neue Charts werden im
  `CFG.dok_charts`/`CFG.cross_charts`-Schema verdrahtet (siehe Trace im
  Claude-Review).
- **Einwohnerzahl als optionale Metadaten-Eingabe** pro Dokument in der
  Dokumentverwaltung (lokal in IndexedDB persistiert) — schaltet die
  Pro-Kopf-Sichten frei.
- **Konsens-Vorschlaege priorisieren** (von beiden Reviewern genannt) vor
  Einzelvorschlaegen.
- **Tests muessen gruen bleiben** (`npm run test:js`, e2e, `pytest`, `ruff`,
  `mypy`). Bei Verhaltensaenderungen am Dashboard die e2e-Suite ergaenzen.

## Nicht im Scope

- Sankey-Komplett-Umbau auf `fh_wert` (Cash-Flow) — Iteration 17 hat das
  bereits durch Umbenennung + Einordnungshinweis adressiert. Bilanzielle
  Ehrlichkeit (Ueberschuss/Abgang als Knoten) bleibt drin.
- Grafik-Builder (Issue uwxdv) bleibt im Backlog.
