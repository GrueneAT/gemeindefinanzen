# Research: Auswertungen erweitern — Gemeindebudget verstaendlicher machen

**Researched:** 2026-05-23
**Issue:** auswertungen-erweitern-gemeindebudget (a7x2n)
**Confidence:** HIGH (Reviews + Verifikation gegen aktuellen Code)
**Forschungsquelle:** zwei externe Topic-Reviews (Claude Opus 4.7, Codex gpt-5)
plus leichte Code-Verifikation. **Keine Neu-Erkundung** der Chart-Vorschlaege —
wie vom User direktiert (CONTEXT.md).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Discuss-Phase entfaellt.** Direkt aus den zwei vorhandenen Topic-Reviews
  implementieren — Quelle: `.issues/grafische-auswertungen-gemeindebudget-verstaendlichkeit/reviews/review-*claude-opus-4-7.md`
  und `review-*gpt-5-4.md`.
- **`web/vendor/dashboard/dashboard.js` ist editierbar.** Erstparteilicher
  Dashboard-Controller (kein vendorisiertes Drittprodukt). Die bisherige
  "nicht anfassen"-Beschraenkung galt nur fuer den reinen CSS-Rebuild und
  entfaellt fuer diese Feature-Arbeit. Neue Charts werden im
  `CFG.dok_charts`/`CFG.cross_charts`-Schema verdrahtet.
- **Einwohnerzahl als optionale Metadaten-Eingabe** pro Dokument in der
  Dokumentverwaltung, lokal in IndexedDB persistiert — schaltet die
  Pro-Kopf-Sichten frei.
- **Konsens-Vorschlaege priorisieren** (von beiden Reviewern genannt) vor
  Einzelvorschlaegen.
- **Tests muessen gruen bleiben** (`npm run test:js`, e2e, `pytest`, `ruff`,
  `mypy`). Bei Verhaltensaenderungen am Dashboard die e2e-Suite ergaenzen.

### Claude's Discretion

- **Mehrere Varianten bei unklaren Designentscheidungen.** Wo das Review oder
  die Datenlage zwei sinnvolle Diagrammvarianten zulaesst (z. B. "Wofuer geht
  1 Euro?" als 100-%-Balken oder Piktogramm-Raster; Soll-Ist als Diverging-Bar
  oder Dumbbell), beide implementieren und mit klarem Label "Variante A" /
  "Variante B" untereinander rendern, damit der User sie online vergleichen
  und auswaehlen kann. Eine Nach-Iteration nimmt dann jeweils die nicht
  gewaehlte heraus.
- Wahl der Diagrammtypen (ECharts), Platzierung in der Tab-Struktur,
  Begleittexte (`.web-panel__note`).
- Reihenfolge der Implementierung innerhalb der Tier-Gruppen.

### Deferred Ideas (OUT OF SCOPE)

- **Sankey-Komplett-Umbau auf `fh_wert`** (echter Cashflow). Iteration 17 hat
  Umbenennung + Einordnungshinweis bereits geliefert. Die *bilanzielle
  Ehrlichkeit* (Ueberschuss/Abgang als Knoten — Claude H2 zweiter Punkt) bleibt
  drin, der EH/FH-Umbau nicht.
- **Grafik-Builder (Issue uwxdv)** bleibt im Backlog.
- **Bereits in Iteration 17 erledigt** und daher nicht mehr im Scope:
  - Sankey-Rename + Cashflow-Hinweis (Claude H2 Punkt 1, Codex C1)
  - Plan/Ist optische Trennung in Trends (Claude H1, Codex H2)
  - `chartTrendKomm`-Labels auf `LABEL_SIZE` (Claude M1, Teil Codex M2)
  - Kostentreiber zweiseitig + Einordnungshinweis (Claude C1, H4)
  - Wasserfall: Nettoergebnis nach Vorzeichen einfaerben (Claude M3)

</user_constraints>

## Summary

Beide Reviews finden uebereinstimmend dasselbe Kernproblem: die Diagramme sind
handwerklich sauber, surfacen aber das vorhandene Datenpotenzial nicht. Im
Detailnachweis liegen `eh_vergleich`/`eh_dritte` je Posten und SQL-Sichten fuer
Soll-Ist (`14`) und Budgetierungspolster (`08`) bereit, ohne dass eine einzige
Auswertung sie nutzt — und die Bezeichnung "Schulden der Gemeinde" als erste
Laien-Frage hat heute *kein* Diagramm, obwohl `gebarung='finanzierung'`
modelliert ist. Pro-Kopf-Werte (Standard jeder Buergerhaushalt-Darstellung)
fehlen, weil das Datenmodell die Einwohnerzahl gar nicht kennt.

Iteration 17 hat die fuenf billigen Konsens-Korrekturen abgearbeitet (siehe
Deferred Ideas). Was bleibt, sind die **groesseren Erweiterungen**: neue Tabs,
neue Aggregationen, eine optionale Metadaten-Eingabe. Diese RESEARCH konsolidiert
sie in einen geordneten Punch-List mit konkreten Code-Stellen und markiert sieben
Stellen, an denen *zwei* sinnvolle Diagrammvarianten existieren (Variante A / B
fuer den online-Vergleich pro CONTEXT.md-Direktive).

**Primary recommendation:** Tier 1 (R1-R6) in einem Schwung umsetzen, dabei je
Variante-Stelle BEIDE Diagramme nebeneinander rendern. Tier 2 (R7-R10) als
zweite Welle. Schema-Aenderung (Einwohnerzahl) ist die einzige migrations-
relevante Stelle und gehoert als R0 *vor* R5/R6/R8.

## Konsolidierter Punch-List (priorisiert)

### Tier 1 — Konsens (von beiden Reviewern genannt, hoher Lerngewinn)

#### R1 — Kennzahlen-Karten: Delta gegenueber Vergleichswert (Vorjahr/Ist)

- **Quellen:** Claude H3, Codex H1 (Teil "Vergleich zu Vorjahr/Ist")
- **Was:** Auf den vier `.metric-card`s (`#st-ertraege`, `#st-aufwand`,
  `#st-netto`, `#st-komm-anteil`) eine zweite Zeile ergaenzen — Delta gegenueber
  `spalte_vergleich` als `+4,1 % ggü. VA 2025` mit Auf/Ab-Pfeil, eingefaerbt in
  `INK.green`/`INK.red`. Beschriftung dynamisch aus `dokument.spalte_vergleich`,
  weil die Bedeutung je Dokumenttyp wechselt (VA: Vorjahresplan, RA: Soll laut
  VA — `schema.sql:109-111`).
- **Code-Stellen:**
  - `web/index.html:132-145` (`.stats > .metric-card`-Markup um zweite Zeile
    erweitern, neue `<div class="stat-delta" id="st-delta-*">`).
  - `web/js/dashboard-data.js:153-251` (`aggregateDok`): `eckwerte` um die
    Vergleichssummen `ertraege_vgl`, `aufwand_vgl`, `netto_vgl` plus den
    Prozent-Delta-Wert ergaenzen. Datenbasis: `SUM(eh_vergleich)` analog zur
    bestehenden `SUM(eh_wert)`-Logik in den Zeilen 154-168.
  - `web/vendor/dashboard/dashboard.js:116-129` (`rerenderStats`): Delta-
    Felder fuellen + `is-green`/`is-red`-Klassen toggeln. Hinweistext mit
    `dokLabel(spalte_vergleich)` befuellen.
- **Variante:** keine — Konsens-Form ist klar (Prozent + Pfeil).
- **Confidence:** HIGH.

#### R2 — Schulden & Finanzierung als eigener Tab

- **Quellen:** Claude H5, Codex H7 (Investitions-Tragbarkeit, Finanzierungs-
  taetigkeit)
- **Was:** Neuer Tab "Schulden &amp; Finanzierung" in der `.tabs`-Leiste. Drei
  Charts:
  1. **Darlehensaufnahme vs. Tilgung je Dokument** — Saeulen, Richtung
     getrennt (`richtung='einnahme'` und `richtung='ausgabe'` jeweils bei
     `gebarung='finanzierung'`) — zeigt Netto-Neuverschuldung.
  2. **Fortgeschriebener Schuldenstand** als Liniendiagramm ueber alle
     Dokumente (`trend_charts`-Eintrag, dokumentuebergreifend). Hinweis: der
     reine *Stand* steht nicht zwingend im Detailnachweis — falls nicht
     ableitbar, transparent als Kennzahl-Luecke ausweisen und nur die
     *Bewegung* (Aufnahme - Tilgung kumuliert ueber alle Dokumente) zeigen.
  3. **Kennzahlen-Karte "Schuldendienst"** — Tilgung + Zinsen aus MVAG-224
     (Finanzaufwand), als `.metric-card`-Block oberhalb der Charts.
- **Code-Stellen:**
  - `web/index.html:113-120` (neuer `<button class="tab-btn" data-tab="schulden">`).
  - `web/index.html` (neues `<section class="tab-panel" data-panel="schulden">`
    nach dem `transfers`-Panel; drei `<div class="dash-chart">`-Container).
  - `web/js/dashboard-data.js`: zwei neue Aggregationen — `finanzierung` je
    Dokument (in `aggregateDok`) und `schuldenstand` als Trend (in `trend()`).
    SQL-Basis: `v_detail WHERE gebarung='finanzierung'` (siehe `schema.sql:71`).
  - `web/js/dashboard-charts.js`: drei neue Builder
    (`chartFinanzierung(agg)`, `chartSchuldenstand(trend)`, optionales
    `chartSchuldendienst(agg)` falls als Mini-Chart statt nur Karte).
  - `web/vendor/dashboard/dashboard.js:749-761`: `registerChart`-Aufrufe fuer
    die neuen Div-Ids ergaenzen.
- **Variante:** **Schulden-Tab-Layout**:
  - **Variante A** — drei volle Panels untereinander (Aufnahme/Tilgung-Saeulen,
    Schuldenstand-Linie, Schuldendienst-Kennzahl).
  - **Variante B** — Schuldenstand als zwei-Achsen-Combo: Saeulen
    (Aufnahme/Tilgung pro Jahr) + Linie (kumulierter Stand) in einem Chart;
    Schuldendienst daneben als kleine Karte rechts.
- **Confidence:** HIGH (Datenmodell deckt es ab — `schema.sql:71`, Filter-
  Option `finanzierung` bereits in `web/index.html:387`); offen bleibt nur, ob
  der absolute Schuldenstand aus den Detailnachweisen rekonstruierbar ist
  (MEDIUM bei Punkt 2).

#### R3 — Soll-Ist-Abweichung sichtbar machen

- **Quellen:** Claude H6 Punkt 1, Codex H6 Punkt 2
- **Was:** Fuer RA-Dokumente ein Diagramm, das die groessten Abweichungen
  zwischen Soll laut Voranschlag (`eh_vergleich`) und Ist (`eh_wert`) zeigt.
  Mehrertrag/Minderaufwand gruen, Mehraufwand/Mindereinnahme rot.
- **Code-Stellen:**
  - SQL ist bereits da: `web/sql/14-soll-ist-abweichung.sql`. Die Abfrage muss
    in `dashboard-data.js` portiert werden — direkt parametriert auf
    `dokument_id`, nicht auf "juengsten RA" wie die SQL-Referenz.
  - `web/js/dashboard-data.js:153-251`: neuer Block `sollIst` in `aggregateDok`
    — nur befuellen bei `dok.typ==='RA'`, sonst `[]`.
  - `web/js/dashboard-charts.js`: neuer Builder `chartSollIst(agg)` —
    zweiseitiges horizontales Balkendiagramm, analog zum heutigen
    `chartTreiber` (das die Form bereits beherrscht).
  - `web/index.html:313-358` (Sparpotenzial-Tab) oder Ueberblick-Tab: neues
    Panel. Da bei VA-Dokumenten leer, mit Fallback-Text "Nur bei
    Rechnungsabschluessen verfuegbar" oder Panel-Hide via
    `aktualisiereSparpotenzial`-Hook.
  - `web/vendor/dashboard/dashboard.js:100` (`setDok`): bei Dok-Wechsel das
    Panel je nach `typ` ein-/ausblenden (neuer `onDocChange`-Hook).
- **Variante:** **Diagrammform fuer Soll-Ist**:
  - **Variante A** — Diverging-Bar (zweiseitige horizontale Balken, Nulllinie
    in der Mitte). Wie heutiger `chartTreiber`, daher 1:1 wiederverwendbar.
  - **Variante B** — Dumbbell/Lollipop (zwei Punkte je Posten: Soll und Ist,
    Linie dazwischen; Codex H6 nennt das explizit). Vorteil: zeigt beide
    Absolutwerte. Nachteil: erfordert neuen ECharts-Custom-Renderer.
- **Confidence:** HIGH.

#### R4 — Budgetierungspolster (VA-Plan ueber letztem RA-Ist)

- **Quellen:** Claude H6 Punkt 2, Codex H6 Punkt 1
- **Was:** Fuer VA-Dokumente: wo liegt der Voranschlag deutlich ueber dem
  letzten Ist-Rechnungsabschluss (`eh_dritte`)? Ersetzt sinnvoll den
  *doppelten* Wasserfall im Sparpotenzial-Tab (Claude M6: `c_wasserfall_sp`
  duplikat von `c_wasserfall`).
- **Code-Stellen:**
  - SQL liegt vor: `web/sql/08-budgetierungspolster.sql`. Portierung nach
    `dashboard-data.js`, parametriert auf `dokument_id`. Filter:
    `richtung='ausgabe' AND eh_dritte > 2000 AND eh_wert - eh_dritte > 5000`.
    Nur bei `dok.typ === 'VA'` befuellen.
  - `web/js/dashboard-charts.js`: neuer Builder `chartPolster(agg)`.
  - `web/index.html:316-324`: das doppelte Wasserfall-Panel (`c_wasserfall_sp`)
    durch das Polster-Panel ersetzen.
  - `web/vendor/dashboard/dashboard.js:755`: `registerChart("c_wasserfall_sp",
    ...)` entfernen, neuen `c_polster`-Eintrag registrieren.
- **Variante:** **Polster-Diagrammform**:
  - **Variante A** — Horizontale Balken `voranschlag` vs. `ist_rechnungs-
    abschluss` je Posten, Differenz markiert (zweite Serie als helle
    Geisterssaeule hinter dem Hauptbalken — Claude H3-Fix wendet dasselbe
    Pattern beim Wasserfall an).
  - **Variante B** — Diverging-Bar nach Polster-Hoehe in EUR (groesste Luft
    nach rechts, Posten unter Vorjahres-Ist nach links). Knapper, fokussiert
    auf das Delta.
- **Confidence:** HIGH.

#### R5 — Pro-Kopf-Werte (Einwohnerzahl als optionale Metadaten-Eingabe)

- **Quellen:** Claude H7, Codex M5 (Pro-Kopf-Sichten)
- **Was:** Optionales Eingabefeld "Einwohner:innen" je Dokument in der
  Dokumentverwaltung. Sobald gesetzt: Pro-Kopf-Zeile auf jeder
  `.metric-card` und ein Umschalter "absolut / je Einwohner:in" fuer die
  horizontalen Balkendiagramme.
- **Datenmodell-Aenderung:** `dokument`-Tabelle um `einwohner INTEGER`-Spalte
  ergaenzen. Aenderung muss in BEIDEN Schema-Dateien gemacht werden:
  - `src/gemeindefinanzen/schema.sql:18-30` (Python-Quelle)
  - `web/schema.sql:18-30` (Kopie, von `make web-sync` ueberschrieben — also
    *nicht* hand-pflegen, sondern Quelle aendern und `make web-sync` laufen
    lassen — siehe `Makefile:50-53`)
  - `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE dokument ADD COLUMN einwohner
    INTEGER` als idempotente Migration (denn `schemaAnwenden()` laeuft bei
    jedem Start gegen eine moeglicherweise schon befuellte IndexedDB-DB).
    Pattern: separater `ALTER`-Block mit `try { ... } catch {}` in
    `db.schemaAnwenden`, oder `PRAGMA user_version`-Vergleich. Konkrete
    Empfehlung: Da das Schema bisher *additiv* ist und `IF NOT EXISTS` nutzt,
    konsequenter Stil: einen separaten `web/schema-migrations.sql`-Block, der
    nach `schemaAnwenden()` laeuft und idempotent `ALTER TABLE ... ADD
    COLUMN` versucht (SQLite akzeptiert "duplicate column"-Fehler nicht still;
    daher try/catch im JS-Code).
- **UI-Eingabe:**
  - `web/index.html:79-96` — `.doc-table` um eine Spalte "Einwohner:innen"
    erweitern (oder ein Bearbeiten-Icon in der bestehenden letzten Spalte).
  - Erste Iteration: pro Zeile `<input type="number" min="0" step="1">`, das
    onChange einen `UPDATE dokument SET einwohner=? WHERE dokument_id=?` macht
    und `db.sichern()` aufruft. Persistenz folgt automatisch ueber die
    bestehende IndexedDB-Spiegelung (`web/js/db.js:83-87`).
- **Code-Stellen UI-Anzeige:**
  - `web/js/dashboard-data.js:49-65` (`dokumente`): `einwohner` mit lesen.
  - `web/js/dashboard-data.js:153-251` (`aggregateDok`): `eckwerte` um
    pro-Kopf-Werte ergaenzen (nur wenn `einwohner > 0`, sonst null).
  - `web/vendor/dashboard/dashboard.js:116-129` (`rerenderStats`): zweite Zeile
    "je Einwohner:in" wenn Wert verfuegbar, sonst Zeile ausblenden.
  - Umschalter "absolut / pro Kopf": neuer Toggle im `.dash-controls`-Bereich
    (`web/index.html:109-121`); rerendert nur betroffene Charts via Hook.
- **Variante:** **Einwohner-Eingabe-Form**:
  - **Variante A** — Inline-Input direkt in der `.doc-table` (jede Zeile, ein
    Feld). Minimal-invasiv; jeder Wert speichert sich onBlur.
  - **Variante B** — Modal/Edit-Dialog je Zeile via "Bearbeiten"-Knopf,
    spaeter erweiterbar um weitere Metadaten (z. B. Gemeinde-Slug,
    Einwohnerstichtag).
- **Confidence:** HIGH fuer die Daten- und UI-Mechanik; MEDIUM fuer die exakte
  Stelle des Umschalters (Designentscheidung — Variante kommt zusaetzlich in
  R8 zur Sprache).

#### R6 — Aufgabenbereiche als sortierte Balken (Treemap als Sekundaersicht)

- **Quellen:** Claude M5, Codex H4
- **Was:** Im Ausgaben-Tab (`web/index.html:212-259`) das Treemap aus seiner
  *primaeren* Rolle nehmen — als Erstes ein horizontales Balken-Ranking der
  Aufgabengruppen rendern (Laengen statt Flaechen vergleichen). Treemap bleibt
  als optionale, sekundaere Detailsicht darunter (mit Drill-down beibehalten).
- **Code-Stellen:**
  - `web/index.html:219-232`: das `dash-grid` umordnen — neues
    `c_gruppen_balken` als erstes Panel oben, Ring (`c_aufwandart`) daneben
    oder darunter, Treemap (`c_treemap`) nach unten ans Ende des Tabs.
  - `web/js/dashboard-data.js:235-240` (`gruppen`-Aggregation): liefert bereits
    `[gruppe, gruppe_text, betrag]` je Dokument — kann direkt verwendet werden.
  - `web/js/dashboard-charts.js`: neuer Builder `chartGruppenBalken(agg)`. Die
    bestehende `bar()`-Hilfsfunktion (`dashboard-charts.js:135-158`) ist
    direkt wiederverwendbar.
  - `web/vendor/dashboard/dashboard.js:753`: neuer
    `registerChart("c_gruppen_balken", "dok", "gruppen_balken")`.
- **Variante:** keine — Konsens-Loesung ist eindeutig (horizontale Balken).
- **Confidence:** HIGH.

### Tier 2 — Solo aber klar wertvoll

#### R7 — Saldo je Aufgabenbereich (zweiseitiges Balkendiagramm)

- **Quellen:** Claude M8, Codex M5 ("Wofuer gibt die Gemeinde netto Geld
  aus?")
- **Was:** Je Aufgabengruppe (0-9) den Saldo (Einnahmen - Ausgaben) als
  diverging horizontale Balken. Zuschussbereiche links/clay (rot),
  Ueberschussbereiche rechts/gruen. Beantwortet: welcher Bereich traegt sich
  selbst, welcher ist ein Zuschussbereich? Bislang **nirgends** sichtbar — die
  Treemap zeigt nur Ausgaben, das Sankey nur Bruttofluesse.
- **Code-Stellen:**
  - SQL liegt vor: `web/sql/02-gruppen-uebersicht.sql` — liefert je Gruppe
    `einnahmen`, `ausgaben`, `saldo`. Portierung in `dashboard-data.js`.
  - `web/js/dashboard-data.js`: neue Aggregation `gruppenSaldo` (Einnahmen +
    Ausgaben je Gruppe; Saldo daraus berechnen).
  - `web/js/dashboard-charts.js`: neuer Builder `chartGruppenSaldo(agg)` —
    identisches Pattern wie das in Iteration 17 fuer `chartTreiber` etablierte
    zweiseitige Diagramm.
  - Platzierung: Ausgaben-Tab unter R6 *oder* in einem neuen Lagebild-Block.
    Empfehlung: Ausgaben-Tab — geringerer Eingriff, semantisch passend.
- **Variante:** keine — diverging-Balken sind klare Konsensform.
- **Confidence:** HIGH.

#### R8 — "Wofuer geht 1 Euro?" — laientaugliche Aufwandsaufteilung

- **Quellen:** Claude H8, Codex H3 ("Wofuer kommen 100 Euro herein?" — Pendant)
- **Was:** Ganz oben im Ueberblick-Tab eine einzige, sofort lesbare Komposition
  der Aufwendungen (bzw. Einnahmen), normalisiert auf 100. Datenquelle:
  vorhandenes `aufwand_art` (`dashboard-data.js:177-187`) bzw. `gruppen`. Cent
  pro Euro: kein Achsenlesen noetig.
- **Code-Stellen:**
  - `web/index.html:132-145` *oberhalb* der bestehenden `.stats`-Karten — neues
    Panel.
  - `web/js/dashboard-charts.js`: zwei neue Builder (je nach Variante).
- **Variante:** **"Wofuer geht 1 Euro?"-Form**:
  - **Variante A** — ECharts vollgestapelter 100-%-Balken (einzelner
    horizontaler Balken, in Segmente unterteilt, Beschriftung in Cent je
    Euro). Knapp, ein Bild.
  - **Variante B** — 10×10-Piktogramm-Raster (ECharts `pictorialBar`, 100
    Quadrate, je Aufgabengruppe ein Anteil). Buchstaeblich "von 100 Cent gehen
    X in Verwaltung". Visueller, aber mehr Code.
- **Quaternaere Frage:** Eine *zweite* Instanz fuer die Einnahmenseite
  ("Wofuer kommen 100 Euro herein?", Codex H3) ist sinnvoll — selbe
  Diagrammform, andere Aggregation (`sankey.quellen` aus
  `dashboard-data.js:124-150` enthaelt schon eine geeignete Klassifikation).
  Im Plan beide Seiten als Twin-Panel im Ueberblick.
- **Confidence:** HIGH.

#### R9 — "Gebunden vs. gestaltbar"

- **Quellen:** Codex H5 (Solo, aber inhaltlich stark — schliesst die Luecke,
  die das Issue explizit als Akzeptanzziel "Pflichtbindungen sichtbar"
  benennt). Claude diskutiert das implizit im Ausgaben-Lead-Text
  (`index.html:215-218`), zeigt es aber nicht in einem Chart.
- **Was:** Gestapelter Balken oder Marimekko mit Personal (MVAG 221),
  Pflichtumlagen (MVAG 223 + Heuristik aus `dashboard.js:160-161`),
  Finanzaufwand (MVAG 224), freiwillige Transfers (Rest MVAG 223) und freie
  Sachausgaben (MVAG 222 ohne nicht zahlungswirksam — analog Korridor-Filter
  in `dashboard-data.js:213-215`). Sichtbar: welcher Anteil ist kurzfristig
  beweglich, welcher nicht?
- **Code-Stellen:**
  - `web/js/dashboard-data.js`: neue Aggregation `bindung` je Dokument — kommt
    aus denselben SQL-Patterns wie `aufwand_art`, nur feiner (Pflichtumlagen-
    Klassifikation per Regex *im SQL*, nicht clientseitig wie heute).
  - `web/js/dashboard-charts.js`: neuer Builder `chartBindung(agg)`.
  - `web/index.html:123-178` (Ueberblick) und/oder `web/index.html:313-358`
    (Sparpotenzial): zwei Panels — *Codex* schlaegt explizit beide Stellen vor.
- **Caveat (Codex M1):** Die Pflichtumlagen-Klassifikation ist heuristisch
  (Regex auf `bezeichnung`). Im neuen Chart muss das transparent sein —
  entweder als Tooltip-Hinweis oder als eigenes Segment "unklar / nicht
  zugeordnet". *Nicht* als feste Kategorie verkaufen.
- **Variante:** **Bindungs-Diagrammform**:
  - **Variante A** — Einzelner gestapelter horizontaler 100-%-Balken (sehr
    nah an R8 Variante A, semantisch andere Achse).
  - **Variante B** — Vertikale gestapelte Saeule pro Aufwandsart-Gruppe, also
    nebeneinander Personal/Sach/Transfer/Finanz, jeweils intern in
    gebunden/frei geteilt. Detaillierter, weniger plakativ.
- **Confidence:** MEDIUM-HIGH (Solo-Vorschlag, aber die Akzeptanzkriterien des
  Issues benennen das Thema explizit).

#### R10 — Einnahmen-Balken um Anteil ergaenzen

- **Quellen:** Claude L1 (Solo, sehr billig)
- **Was:** Im `chartEinnahmen` (`dashboard-charts.js:210-218`) Datenlabel um
  den Anteil am Gesamtertrag ergaenzen — `"2,4 Mio € · 18 %"`. Der Aufwand-
  Ring beschriftet bereits mit Prozent (`{d}%`); die Einnahmen-Balken
  verwerfen die in `web/sql/03-einnahmestruktur.sql:1-19` bereits berechnete
  `anteil_prozent`-Information.
- **Code-Stellen:**
  - `web/js/dashboard-data.js:171-176`: `einnahmen` um `anteil_prozent`
    ergaenzen (Quotient ueber Summe der `einnahmen` — kein neuer Query).
  - `web/js/dashboard-charts.js:210-218` (`chartEinnahmen`): Label-Formatter
    erweitern.
- **Variante:** keine.
- **Confidence:** HIGH.

### Tier 3 — Nice-to-have / haengt an Tier 1

#### R11 — Sankey um Abschluss-Knoten (bilanzielle Ehrlichkeit)

- **Quellen:** Claude H2 *Teil 2* (Punkt 1 — Cashflow-Hinweis — ist in
  Iteration 17 schon erledigt; Punkt 2 fehlt noch).
- **Was:** In `chartSankey` (`web/js/dashboard-charts.js:161-208`) einen
  zusaetzlichen Knoten ergaenzen: bei Ueberschuss
  `Gemeindehaushalt -> Ueberschuss/Ruecklagenzufuhr` (INK.green); bei Abgang
  `Abgangsdeckung -> Gemeindehaushalt` (INK.red). Hoehe = `|netto|`.
- **Code-Stellen:**
  - `web/js/dashboard-charts.js:161-208`: vor dem `return` einen Link plus
    Knoten ergaenzen, basierend auf `agg.eckwerte.netto`.
  - `web/js/sankey-drill.js:181` (`buildSankeyOption`): selbe Aenderung, weil
    die Drill-down-Variante ihr eigenes Options-Objekt baut.
- **Variante:** keine.
- **Confidence:** HIGH. CONTEXT.md schliesst nur den FH-Komplett-Umbau aus,
  nicht den Abschluss-Knoten.

#### R12 — Investitionen: Finanzierungsherkunft

- **Quellen:** Claude L2, Codex H7 (Teil "Finanzierungsuebersicht")
- **Was:** Im Investitionen-Tab (`web/index.html:261-282`) zusaetzlich
  zeigen, woher das Investitionsvolumen kommt: Foerderungen/Kapitaltransfers
  (`richtung='einnahme' AND gebarung='investiv'`), Darlehen
  (`gebarung='finanzierung'`, Aufnahme), Eigenmittel (Restgroesse aus
  Saldo).
- **Code-Stellen:**
  - `web/js/dashboard-data.js`: neue Aggregation `investFinanzierung`.
  - `web/js/dashboard-charts.js`: neuer Builder
    `chartInvestFinanzierung(agg)`.
- **Variante:** **Investitions-Finanzierung-Form**:
  - **Variante A** — gestapelter Saeulenbalken (eine Saeule = Gesamtvolumen,
    in Quellen unterteilt).
  - **Variante B** — Mini-Sankey: Quellen links (Foerderung/Darlehen/Eigen),
    Investitionen rechts.
- **Confidence:** MEDIUM (Datenrekonstruktion "Eigenmittel" ist nicht
  trivial; ggf. nur Foerderungen und Darlehen explizit, "Eigenmittel" als
  abgeleitete Restgroesse mit Disclaimer).

#### R13 — Korridor zweite Achse (Pareto-Chart sauber)

- **Quellen:** Claude M4 (Solo)
- **Was:** Im Korridor-Chart (`chartKorridor`, `dashboard-charts.js:407-439`)
  die kumulierte Linie auf eine zweite y-Achse (`yAxisIndex: 1`), skaliert
  0-100 % der Gesamtsumme. Heute teilen Balken und Summenlinie eine Achse,
  Einzelbalken werden dadurch gestaucht.
- **Code-Stellen:** ausschliesslich `web/js/dashboard-charts.js:407-439`.
- **Variante:** keine — klare technische Korrektur.
- **Confidence:** HIGH (Solo, aber unstrittig). Tier 3, weil rein Lesbarkeit
  und nicht Funktionsumfang.

#### R14 — Wertformate vereinheitlichen ("k" vs. "Mio")

- **Quellen:** Claude M7 (Solo)
- **Was:** Aktuell mischen Builder Einheiten: Achse "Mio" + Datenlabel "k"
  innerhalb derselben Wasserfall-Saeule (`dashboard-charts.js:358` vs. `:400`);
  Trends in "Mio", Einnahmen/Treiber/Investitionen/Korridor in "k". Einheit-
  liche Formatter-Helferfunktion analog zu `euro()` in
  `dashboard.js:21-25`.
- **Code-Stellen:** `web/js/dashboard-charts.js` (alle Builder mit
  `valAxis()`-Aufrufen).
- **Variante:** keine.
- **Confidence:** HIGH (Solo, aber unstrittig).

#### R15 — Achsenlabels truncate-mit-Ellipse + voller Name im Tooltip

- **Quellen:** Claude M2 (Solo)
- **Was:** Kategorienamen werden per `String.slice()` gekuerzt — kein
  Auslassungszeichen, Tooltip nutzt dieselbe gestumpfte Kategorie. Verlagern in
  `axisLabel.formatter`, voller Name als Kategorie behalten.
- **Code-Stellen:** `dashboard-charts.js:212` (`chartEinnahmen`), `:230`
  (`chartTreiber`), `:237` (`chartInvestitionen`), `:409` (`chartKorridor`).
- **Variante:** keine.
- **Confidence:** HIGH.

#### R16 — Wasserfall um Aufwandsarten verfeinern

- **Quellen:** Claude M9 (Solo, Ideation)
- **Was:** Den heute 3-stufigen Wasserfall (Ertraege, Aufwendungen-Block,
  Nettoergebnis) in einen 6-stufigen Wasserfall aufloesen: Ertraege - Personal -
  Sachaufwand - Transfers - Finanzaufwand = Nettoergebnis. Datenquelle:
  `aufwand_art` (`dashboard-data.js:177-187`).
- **Code-Stellen:** ausschliesslich `dashboard-charts.js:331-405`
  (`chartWasserfall`) — Schrittliste erweitern; Sockel-Logik bleibt analog.
- **Variante:** keine (Variante "3-stufig behalten" entspricht dem Status quo).
- **Confidence:** HIGH. Tier 3, weil das Issue den Wasserfall nicht als
  Konsens-Punkt benennt — Ideation-Vorschlag.

#### R17 — Informationsarchitektur entlang Erkenntnisfragen ordnen

- **Quellen:** Codex M3 (Solo, aber das Issue benennt das explizit als Punkt
  "Informationsarchitektur ... ordnen").
- **Was:** Tabs umbenennen/umordnen entlang von Laien-Fragen:
  `Lagebild` -> `Woher kommt das Geld?` -> `Wofuer geht 1 Euro?` ->
  `Was ist gebunden?` -> `Was aendert sich?` -> `Spielraeume & Risiken` ->
  `Suche & Rohdaten`. Inhalte bleiben weitgehend gleich, werden anders
  gruppiert plus 1-2-Satz-Zusammenfassungen je Abschnitt.
- **Code-Stellen:** `web/index.html:113-120` (Tab-Buttons) und alle
  `data-panel`-Werte; `dashboard.js` referenziert die `data-tab`-Werte nicht
  hartcodiert (`activateTab` arbeitet generisch — Zeilen 84-93).
- **Variante:** Diese Aufgabe ist eine *strukturelle* Umordnung — der Planer
  sollte sie *nach* R1-R10 schedulen, damit die neuen Charts vorhanden sind,
  bevor das Layout umgestellt wird. Empfehlung: Tier 3 oder eigenes Folge-
  Issue.
- **Confidence:** MEDIUM (Strukturentscheidung; risikobehaftet weil viele
  Tests / Selektoren betroffen sein koennen — die e2e-Tests
  (`tests/web-e2e/`) haengen am `data-tab`-Wert).

## Datenlayer-Referenz

Aus welchen Feldern / SQL-Sichten die neuen Charts gespeist werden — was
wiederverwendet werden kann vs. neue Aggregation noetig.

| Chart | Datenquelle (vorhanden) | Neu noetig | SQL-Referenz |
|-------|------------------------|------------|--------------|
| R1 Delta Kennzahlen | `posten.eh_vergleich` ueber alle Posten je Dok | `aggregateDok` um `ertraege_vgl`, `aufwand_vgl`, `netto_vgl` (analog Zeilen 154-168) | — |
| R2.1 Aufnahme/Tilgung | `v_detail WHERE gebarung='finanzierung'` | Neue Aggregation `finanzierung` (richtung getrennt) | — (Filteroption bereits in `index.html:387`) |
| R2.2 Schuldenstand | Kumulierte Netto-Veraenderung ueber alle Dok | Neuer Trend-Eintrag in `trend()` | — |
| R2.3 Schuldendienst | `v_detail WHERE substr(mvag_eh,1,3)='224' AND gebarung='finanzierung'` (Tilgung) + Zinsen | Neuer Skalar in `aggregateDok.eckwerte` | — |
| R3 Soll-Ist | `v_detail WHERE typ='RA'`, `eh_delta` | `aggregateDok.sollIst` (nur bei `typ==='RA'`) | `web/sql/14-soll-ist-abweichung.sql` — direkt portierbar |
| R4 Polster | `v_detail WHERE typ='VA'`, `eh_dritte` vs. `eh_wert` | `aggregateDok.polster` (nur bei `typ==='VA'`) | `web/sql/08-budgetierungspolster.sql` — direkt portierbar |
| R5 Pro-Kopf | NEU: `dokument.einwohner` | Schema-Migration + UI-Eingabe + Divisor in `aggregateDok` | — (Schema-Aenderung) |
| R6 Gruppen-Balken | `aggregateDok.gruppen` (`dashboard-data.js:235-240`) | nur Chart-Builder, keine neue Aggregation | — |
| R7 Saldo je Gruppe | `v_gruppe_summe` (Einnahmen/Ausgaben/Saldo) | `aggregateDok.gruppenSaldo` | `web/sql/02-gruppen-uebersicht.sql` — direkt portierbar |
| R8 1-Euro/100-Euro | `aggregateDok.aufwand_art`, `agg.sankey.quellen` | Nur Normalisierung auf 100, keine neue Aggregation | `web/sql/03-einnahmestruktur.sql:1-19` (Pendant fuer Einnahmen) |
| R9 Gebunden vs. gestaltbar | MVAG-Filter + Pflichtumlagen-Heuristik | `aggregateDok.bindung`; Heuristik aus `dashboard.js:160-161` in Aggregation hochziehen | `web/sql/07-transferaufwand.sql:9-16` (Pflichtumlagen-Regex), `web/sql/12-personalaufwand.sql`, `web/sql/05-sachaufwand-kumuliert.sql` |
| R10 Einnahmen-Anteil | `aggregateDok.einnahmen` + Gesamtsumme | nur Label-Formatter | `web/sql/03-einnahmestruktur.sql` (Referenz fuer Format) |
| R11 Sankey-Knoten | `aggregateDok.eckwerte.netto` | nur Builder-Aenderung | — |
| R12 Invest-Finanzierung | `v_detail` mit `gebarung='investiv' AND richtung='einnahme'` und `gebarung='finanzierung'` | `aggregateDok.investFinanzierung` | `web/sql/09-investitionen.sql:1-14` |

## Integration in `dashboard.js`

Die zentralen Verdrahtungspunkte, die der Planer kennen muss:

- **`CFG.dok_charts` vs. `CFG.trend_charts`** (`dashboard.js:9-11`, befuellt
  von `alleCharts(daten)` in `dashboard-charts.js:645-678`). Jedes neue
  *dokumentabhaengige* Chart (R1 Delta, R2.1, R3, R4, R6, R7, R8, R9, R10,
  R12) gehoert in `dok_charts[did].neuerKey`. Jedes *dokumentuebergreifende*
  Chart (R2.2 Schuldenstand) gehoert in `trend_charts`.
- **`registerChart(divId, kind, src)`** (`dashboard.js:51-56`) — beim Hinzufuegen
  jedes neuen Charts MUSS ein Aufruf an die Registrierungsliste
  (`dashboard.js:749-761`) ergaenzt werden. Ohne diesen Eintrag bleibt der
  Chart leer (kein automatischer Scan des DOM).
- **`setDok(id)`** (`dashboard.js:100-108`) ruft `renderAllCharts` plus die
  `rerenderHooks`. Fuer R3/R4 (Charts, die nur bei bestimmten `typ`-Werten
  Sinn haben) ist ein neuer `onDocChange`-Hook der saubere Weg, das jeweils
  passende Panel zu zeigen/verstecken (`rerenderHooks` in
  `dashboard.js:97-98`).
- **Kennzahlen-Karten-Render (`rerenderStats`, `dashboard.js:116-129`)** — der
  Punkt fuer R1 Delta-Zeile und R5 Pro-Kopf-Zeile. Schon heute setzt es die
  Vorzeichen-Klassen (`is-green`/`is-red`).
- **Mehrjahres-Overlay** (`dashboard.js:325-407`, `openMehrjahr`) — fuer R2.2
  potenziell wiederverwendbar (gleiches Liniendiagramm-Pattern, fehlende
  Jahre als Luecke); aber Schuldenstand passt eher als fester Trend-Chart,
  nicht als On-Demand-Overlay.
- **`buildSankeyOption`** (`web/js/sankey-drill.js:181-283`) — fuer R11 muss
  *zusaetzlich* zum statischen `chartSankey`-Builder die Drill-down-Variante
  angepasst werden; sie baut ihr eigenes Options-Objekt.

## Einwohnerzahl — minimale Spezifikation (R5-Detail)

- **Schema:** `dokument.einwohner INTEGER NULL` in
  `src/gemeindefinanzen/schema.sql:18-30` ergaenzen.
  `make web-sync` synchronisiert nach `web/schema.sql`.
- **Migration:** `schemaAnwenden()` in `web/js/db.js:38-40` laeuft beim Start
  gegen eine evtl. bereits gefuellte IndexedDB-DB. `CREATE TABLE IF NOT
  EXISTS` deckt **kein** spaeteres Hinzufuegen einer Spalte ab. Optionen:
  1. Separater Migrations-Block (`ALTER TABLE dokument ADD COLUMN einwohner
     INTEGER`) mit `try { ... } catch {}`, der nach `schemaAnwenden()` laeuft.
  2. `PRAGMA user_version`-Vergleich + idempotenter Migrations-Schritt.
  **Empfehlung:** Variante 1 — minimaler Eingriff, das Schema bleibt
  weiterhin reine `CREATE`-Anweisungen, der ALTER-Schritt lebt separat in
  `db.js` als `migrationenAnwenden()`.
- **UI-Eingabe (Variante A — Inline):** je `<tr>` in `#doc-tbody`
  (`web/js/app.js:233-244`) ein `<input type="number" min="0" step="100">`.
  onChange/onBlur: `UPDATE dokument SET einwohner = ? WHERE dokument_id = ?`,
  dann `db.sichern()`. `zeichneDashboard()` neu aufrufen, damit die Pro-Kopf-
  Zeile sofort erscheint.
- **UI-Eingabe (Variante B — Edit-Modal):** Pro Zeile ein "Bearbeiten"-
  Knopf, der einen kleinen Dialog oeffnet (HTML5 `<dialog>` reicht). Spaeter
  erweiterbar um Gemeinde-Slug, Stichtag, Klassifikation.
- **Anzeige:** Pro-Kopf-Wert nur rendern, wenn `einwohner > 0`. Sonst die
  Zeile in der Kennzahl-Karte ausblenden (kein "—"-Platzhalter, weil das nur
  Aufmerksamkeit klaut).
- **Umschalter "absolut / pro Kopf":** Eine globale Pille im
  `.dash-controls`-Bereich. Beim Toggle: nur die Charts neu rendern, die
  beide Versionen anbieten (R6, evtl. R7); Karten haben *beide* Zeilen
  ohnehin sichtbar.
- **Persistenz:** Automatisch via bestehende `db.sichern()` (IndexedDB).
  Kein separater Speicher.
- **Confidence:** HIGH fuer Schema + Persistenz; MEDIUM fuer den genauen
  UX-Flow (Variante A vs. B haengt vom User ab).

<interfaces>
// =========================================================================
// From web/js/dashboard-data.js — Datenaggregation pro Dokument und als Trend
// =========================================================================
// Eingabe: `db` (Datenbank-Wrapper aus web/js/db.js)
// Ausgabe: das vollstaendige DATA-Objekt, das dashboard.js erwartet.

// Top-level Sammler — wird von dashboard-app.js:baueDashboard() aufgerufen.
export function collect(db): {
  meta: {
    gemeinde: string,
    dok_anzahl: number,
    posten_anzahl: number,
    default_dok: number,   // dokument_id des juengsten VA, sonst juengstes Dok
  },
  dokumente: Array<{
    id: number,
    typ: 'VA' | 'NVA' | 'RA',
    jahr: number,
    label: string,            // == spalte_wert
    spalte_wert: string,      // z.B. 'VA 2026'
    spalte_vergleich: string, // z.B. 'VA 2025'
    spalte_dritte: string,    // z.B. 'RA 2024'
    // R5: NEU einwohner?: number
  }>,
  posten: Array<{
    dok: number, typ: string, jahr: number,
    richtung: 'einnahme' | 'ausgabe',
    gebarung: 'operativ' | 'investiv' | 'finanzierung' | 'ruecklage',
    gruppe: string, gruppe_text: string,
    ansatz: string, ansatz_text: string,
    konto: string, konto_text: string,
    bezeichnung: string,
    mvag: string, qu: string,
    ew: number, ev: number, ed: number,  // EH wert/vergleich/dritte
    fw: number, fv: number, fd: number,  // FH wert/vergleich/dritte
  }>,
  aggregate: Record<dokument_id_string, AggregateDok>,
  trend: {
    eckwerte: Array<[label, ertraege, aufwand, netto, typ]>,
    komm:     Array<[label, betrag, typ]>,
    aufwand:  Array<[label, personal, sach, transfer, finanz, typ]>,
    // R2.2: NEU schuldenstand?: Array<[label, aufnahme, tilgung, stand, typ]>
  },
}

// Einzeldokument-Aggregat (eine Entry je dokument_id in DATA.aggregate).
type AggregateDok = {
  eckwerte: {
    ertraege: number, aufwand: number, netto: number, komm: number,
    komm_anteil: number,  // Prozent, eine Nachkommastelle
    // R1: NEU ertraege_vgl, aufwand_vgl, netto_vgl: number
    // R1: NEU delta_ertraege_proz, delta_aufwand_proz, delta_netto_proz: number
    // R5: NEU ertraege_pk, aufwand_pk, netto_pk: number | null
  },
  einnahmen: Array<[bezeichnung, betrag]>,    // Top 12
  // R10: NEU einnahmen[i][2]?: number (anteil_prozent)
  aufwand_art: Array<[kategorie, betrag]>,    // Personal/Sach/Transfers/Finanz/Sonstige
  treemap:     Array<[gruppe_text, ansatz_text, betrag]>,
  treiber:     Array<[bezeichnung, delta]>,   // zweiseitig: +Anstieg, -Rueckgang
  korridor:    Array<[bezeichnung, einzeln, kumuliert]>,  // Pareto-Daten
  transfers:   Array<[bezeichnung, betrag, vergleich]>,
  investitionen: Array<[bezeichnung, ansatz_text, betrag]>,
  gruppen:     Array<[gruppe, gruppe_text, betrag]>,      // nur Ausgaben (R6 nutzt das)
  sankey: {
    quellen: Array<[quelle_text, betrag]>,
    gruppen: Array<[gruppe_text, betrag]>,
  },
  // R3:  NEU sollIst?: Array<[bezeichnung, gruppe_text, richtung, soll, ist, abweichung]>
  // R4:  NEU polster?: Array<[bezeichnung, gruppe_text, ist_rechnungsabschluss, voranschlag, polster, polster_prozent]>
  // R2:  NEU finanzierung?: { aufnahme: number, tilgung: number, schuldendienst: number }
  // R7:  NEU gruppenSaldo?: Array<[gruppe, gruppe_text, einnahmen, ausgaben, saldo]>
  // R9:  NEU bindung?: { personal, pflichtumlagen, finanz, freiwilligeTransfers, freieSachaus, unklar: number }
  // R12: NEU investFinanzierung?: { foerderung, darlehen, eigen: number }
}

// =========================================================================
// From web/js/dashboard-charts.js — ECharts-Optionsbausteine
// =========================================================================

// Konstanten — werden von allen Buildern genutzt.
const INK: { green, blue, orange, red, soft, paper: string }
const CHART_FONT: string         // "Barlow Semi Condensed, sans-serif"
const LABEL_SIZE: 15, AXIS_SIZE: 14
const BAR_MAX_DICHT: 56, BAR_MAX_WEIT: 130
const VA_DECAL: object  // Decal-Schraffur fuer Plan-Saeulen (Iteration 17)

// Hilfsfunktionen — fuer neue Builder direkt wiederverwendbar.
function baseText(): { fontFamily, color }
function grid(extra?): object
function tip(extra?): object
function legende(extra?): object
function catAxis(data, fontsize?, rotate?): object
function valAxis(formatter?): object
function bar(categories, values, color, colors?, barMax?): ECOption
// Plan/Ist-Hilfen (Iteration 17):
function trendBalken(wert, typ, farbe): { value, itemStyle }
function planIstLegende(): Array<Series>

// Heutige Builder — Vertrag (Input -> ECOption):
export function chartSankey(agg):       ECOption
export function chartEinnahmen(agg):    ECOption
export function chartTreiber(agg):      ECOption  // R3-Variante-A nutzt dasselbe Pattern
export function chartInvestitionen(agg): ECOption
export function chartAufwandart(agg):   ECOption
export function chartTreemap(agg):      ECOption
export function chartWasserfall(agg, jahr): ECOption  // R16 erweitert hier
export function chartKorridor(agg):     ECOption  // R13 zweite Achse
export function chartTrendEckwerte(trend): ECOption
export function chartTrendKomm(trend):     ECOption
export function chartTrendAufwand(trend):  ECOption

// Top-Level: baut die CFG fuer dashboard.js.
export function alleCharts(daten): {
  dok_charts: Record<dok_id, { sankey, einnahmen, aufwandart, treemap,
                                wasserfall, korridor, treiber, investitionen,
                                // R*: NEU neue Keys hier ergaenzen
                                ...
                              }>,
  trend_charts: { trend_eck, trend_komm, trend_auf, ... },
  mehrjahr: { basis, palette, dok_reihenfolge },
}

// =========================================================================
// From web/vendor/dashboard/dashboard.js — Dashboard-Controller
// =========================================================================

// Globale State-Variablen (im IIFE):
//   docs, posten, aggs, meta  ← DATA
//   dokChart, trendChart, mehrjahrCfg  ← CFG
//   aktivDok: string                   ← aktuelles Dokument
//   charts: { [divId]: { inst, kind, src } }
//   rerenderHooks: Array<(dokId) => void>

// Bedienoberflaeche fuer die Verdrahtung:
function registerChart(divId, kind, src)
// kind: "dok" | "trend" | "sankey"
// src: Key in dokChart[aktivDok] bzw. trendChart bzw. "sankey"

function setDok(id)                 // ruft renderAllCharts + alle rerenderHooks
function onDocChange(fn)            // registriert einen rerenderHook
function activateTab(name)          // setzt is-active auf Tab + Panel
function resizeVisibleCharts()

// Erweiterungspunkte fuer Tier 1:
function rerenderStats(dokId)       // dashboard.js:116-129 — R1, R5 hier
function rerenderTables(dokId)      // dashboard.js:147-167

// Heutige Registrierungen (dashboard.js:749-761):
registerChart("c_sankey", "sankey", "sankey");
registerChart("c_einnahmen", "dok", "einnahmen");
registerChart("c_aufwandart", "dok", "aufwandart");
registerChart("c_treemap", "dok", "treemap");
registerChart("c_wasserfall", "dok", "wasserfall");
registerChart("c_wasserfall_sp", "dok", "wasserfall");  // R4 entfernt diesen
registerChart("c_korridor", "dok", "korridor");
registerChart("c_treiber", "dok", "treiber");
registerChart("c_investitionen", "dok", "investitionen");
registerChart("c_trend_eck", "trend", "trend_eck");
registerChart("c_trend_komm", "trend", "trend_komm");
registerChart("c_trend_auf", "trend", "trend_auf");

// =========================================================================
// From web/schema.sql — dokument-Tabelle (R5 erweitert hier)
// =========================================================================
CREATE TABLE IF NOT EXISTS dokument (
    dokument_id      INTEGER PRIMARY KEY,
    gemeinde         TEXT,
    typ              TEXT,      -- 'VA' | 'NVA' | 'RA'
    finanzjahr       INTEGER,
    spalte_wert      TEXT,      -- z.B. 'VA 2026'
    spalte_vergleich TEXT,      -- z.B. 'VA 2025'
    spalte_dritte    TEXT,      -- z.B. 'RA 2024'
    fassung          TEXT,
    quelldatei       TEXT,
    seiten           INTEGER,
    eingelesen_am    TEXT DEFAULT (datetime('now'))
    // R5: NEU einwohner INTEGER  (per ALTER TABLE-Migration, da DB schon existieren kann)
);

// =========================================================================
// From web/js/db.js — Persistenz und Schreiben
// =========================================================================
class Datenbank {
  schemaAnwenden(schemaSql)  // legt Tabellen an (CREATE IF NOT EXISTS) — kein ALTER!
  abfrage(sql, bind?): Array<{...}>
  wert(sql, bind?): any
  ausfuehren(sql, bind?)     // R5: UPDATE dokument SET einwohner=? WHERE dokument_id=?
  transaktion(fn)
  async sichern(): boolean   // -> IndexedDB
}
export function oeffneDb(initModul): Promise<Datenbank>
export function dokumente(db): Array<{ dokument_id, gemeinde, typ, finanzjahr,
                                        quelldatei, seiten, detailposten,
                                        // R5: NEU einwohner?: number
                                      }>
export function dokumentEntfernen(db, dokId)
</interfaces>

## Konsens-Matrix (zur Begruendung der Tier-Einteilung)

| ID | Thema | Claude | Codex | Tier |
|----|-------|--------|-------|------|
| R1 | Vorjahres/Ist-Delta an Kennzahlen | H3 | H1 | 1 |
| R2 | Schulden & Finanzierung als Tab | H5 | (H7 angrenzend) | 1 |
| R3 | Soll-Ist-Abweichung | H6.1 | H6.2 | 1 |
| R4 | Budgetierungspolster | H6.2 | H6.1 | 1 |
| R5 | Pro-Kopf via Einwohner | H7 | M5 | 1 |
| R6 | Aufgabenbereiche als Balken | M5 | H4 | 1 |
| R7 | Saldo je Aufgabenbereich | M8 | M5 | 2 (impl. Konsens) |
| R8 | "Wofuer geht 1 Euro?" | H8 | H3 | 2 |
| R9 | Gebunden vs. gestaltbar | (impl. Lead-Text) | H5 | 2 |
| R10 | Einnahmen-Anteil-Label | L1 | — | 2 |
| R11 | Sankey Abschluss-Knoten | H2.2 | — | 3 |
| R12 | Invest-Finanzierung | L2 | H7 | 3 |
| R13 | Korridor zweite Achse | M4 | — | 3 |
| R14 | Wertformate vereinheitlichen | M7 | — | 3 |
| R15 | Achsenlabels Ellipse + Tooltip | M2 | — | 3 |
| R16 | Wasserfall um Aufwandsarten verfeinern | M9 | — | 3 |
| R17 | Informationsarchitektur | — | M3 | 3 |

## Varianten-Liste (zur Klarheit fuer den Planer)

Stellen, an denen *beide* Varianten implementiert werden — Label "Variante A" /
"Variante B" untereinander rendern, sodass der User online auswaehlen kann:

1. **R2 Schulden-Tab-Layout** — A: drei separate Panels / B: Combo-Chart +
   Schuldendienst-Karte.
2. **R3 Soll-Ist** — A: Diverging-Bar (analog `chartTreiber`) / B: Dumbbell
   (Soll- und Ist-Punkt pro Posten).
3. **R4 Polster** — A: Doppelbalken VA vs. RA / B: Diverging-Bar nach
   Polster-Hoehe.
4. **R5 Einwohner-Eingabe** — A: Inline-Input in `.doc-table` / B:
   Edit-Modal je Zeile.
5. **R8 "Wofuer geht 1 Euro?"** — A: 100-%-Stapelbalken / B: 10×10-Pikto-
   gramm-Raster.
6. **R9 Gebunden vs. gestaltbar** — A: ein 100-%-Stapelbalken / B: vertikale
   gestapelte Saeulen je Aufwandsart.
7. **R12 Investitions-Finanzierung** — A: gestapelter Saeulenbalken / B:
   Mini-Sankey.

## Common Pitfalls (verifiziert aus den Reviews + Codebase-Check)

### Schema-Migration via `CREATE IF NOT EXISTS` deckt **kein** spaeteres Hinzufuegen einer Spalte ab
- **Was geht schief:** R5 fuegt `einwohner` zur `dokument`-Tabelle hinzu. Bei
  vielen Nutzer:innen existiert die DB schon in IndexedDB (siehe
  `web/js/db.js:200-209`). `schemaAnwenden()` ruft nur `CREATE IF NOT
  EXISTS` — die neue Spalte fehlt dann fuer immer.
- **Wie vermeiden:** Separater Migrations-Block mit `ALTER TABLE ... ADD
  COLUMN` und try/catch (SQLite wirft bei doppelter Spalte einen Fehler).
  Pattern: `migrationenAnwenden(db)` als zweiter Aufruf nach
  `schemaAnwenden()` in `web/js/app.js:41`.

### `CFG.dok_charts` ohne `registerChart` ist unsichtbar
- **Was geht schief:** Neuer Chart in `alleCharts()` ergaenzt, neues Div in
  `index.html`, *kein* Eintrag in `dashboard.js:749-761` — bleibt leer.
- **Wie vermeiden:** Jedes neue Chart muss in `registerChart` registriert
  werden. Checkliste pro neuem Chart: (1) Div-Id in `index.html`, (2) Builder
  in `dashboard-charts.js`, (3) Wiring in `alleCharts.dok_charts[did]`, (4)
  `registerChart("c_neu", "dok", "key")` in `dashboard.js`.

### `setDok` rendert *alle* dok-Charts neu — Performance bei vielen Aenderungen
- **Was geht schief:** Bei jedem Klick auf den Dok-Umschalter laeuft
  `renderAllCharts()` (`dashboard.js:72-74`) ueber alle registrierten
  Diagramme. Bei 12+ neuen Diagrammen kann das spuerbar werden.
- **Wie vermeiden:** Nicht jetzt optimieren — erst messen. Wenn doch:
  `kind === 'trend'` ueberspringen (trend-Charts aendern sich nicht mit dem
  Dokument).

### Doc-Wechsel kann Charts leer rendern, wenn `agg[neueKey]` fehlt
- **Was geht schief:** R3 (Soll-Ist) ist nur fuer RA-Dokumente sinnvoll. Wenn
  der User auf ein VA-Dok umschaltet, ist `agg.sollIst` `undefined`. Builder
  ohne Null-Check rendert eine leere oder kaputte Option.
- **Wie vermeiden:** Builder muss `agg.sollIst ?? []` defensiv abfedern; oder
  besser: per `onDocChange`-Hook das Panel zeigen/verstecken (`hidden`-Klasse
  auf `.web-panel`).

### `make web-sync` ueberschreibt `web/schema.sql` und `web/sql/*.sql`
- **Was geht schief:** Schema-Aenderung *nur* in `web/schema.sql` — beim
  naechsten `make web-sync` (das jeder PR-Build laeuft) wird sie ueberschrieben.
- **Wie vermeiden:** Schema in `src/gemeindefinanzen/schema.sql` aendern,
  *dann* `make web-sync`. Gilt analog fuer `sql/*.sql` (Codebase hat zwei
  Spiegel — `sql/` und `web/sql/`).

### Pflichtumlagen-Heuristik ist *bezeichnungs-basiert* (Codex M1)
- **Was geht schief:** R9 nutzt die Pflichtumlagen-Klassifikation. Aktuell
  passiert das per Regex auf `bezeichnung` in `dashboard.js:160-161` —
  Fehlklassifikationen sind plausibel.
- **Wie vermeiden:** In R9 die Heuristik transparent als solche kennzeichnen
  (Tooltip-Hinweis "automatisch erkannt") und ggf. ein eigenes Segment
  "unklar" beistellen, statt Pflichtumlagen-Anteile als harte Wahrheit zu
  verkaufen.

### `dashboard.js:160-161`-Heuristik liegt im Vendor-Controller — bei R9 hochziehen
- **Was geht schief:** Pflichtumlage-Erkennung steckt aktuell in der
  Tabellen-Render-Schleife (`rerenderTables`) — fuer R9 (Aggregation) muss
  dieselbe Logik in `dashboard-data.js` ein zweites Mal stehen oder
  ausgelagert werden.
- **Wie vermeiden:** Eine `istPflichtumlage(bezeichnung)`-Helferfunktion an
  einer einzigen Stelle (in `dashboard-data.js`), die `dashboard.js` per
  globalem Import (oder via DATA-Vorberechnung im Posten-Objekt) konsumiert.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| ECharts | alle neuen Charts | ja, ueber CDN | 5.5.1 | — (CDN-Pflicht laut CLAUDE.md) |
| sqlite-wasm | DB-Operationen | ja, vendor | wie bisher | — |
| IndexedDB | R5 Persistenz Einwohnerzahl | ja, im Browser | nativ | In-Memory-Fallback (siehe `db.js:96-97`) |
| ECharts `pictorialBar` | R8 Variante B | ja, in ECharts 5 enthalten | 5.5.1 | — |
| HTML5 `<dialog>` | R5 Variante B | ja, alle modernen Browser | nativ | `<details>` |
| Playwright e2e | Tests fuer neue Tabs | ja, bestehend | — | — |

CLAUDE.md verbietet Vendoring — alle externen Bibliotheken muessen ueber CDN
gezogen werden. ECharts ist bereits so eingebunden (`web/index.html:13`),
keine neue Abhaengigkeit noetig.

## Project Constraints (from CLAUDE.md)

- **Kein Vendoring.** Drittbibliotheken nur ueber CDN (`jsdelivr.net`).
  Bestaetigt: alle bestehenden Charts nutzen ECharts via CDN. Keine neue
  Library hinzunehmen, ohne sie ebenfalls per CDN einzubinden.
- **Kein Build-Schritt** fuer die ausgelieferte Browser-App. ESM in
  `web/js/`, klassisches Skript in `web/vendor/dashboard/dashboard.js`. R5
  Schema-Migration muss daher *direkt* in `db.js` als JS-Code stehen — kein
  separates Migrations-Build-Step.
- **Sprache:** Deutsch in UI-Texten und Code-Bezeichnern. Alle neuen
  Chart-Titel, Panel-Notes, Tab-Buttons auf Deutsch.
- **Keine Werkzeug-Attribution** in Commits/Code/Kommentaren.
- **Tests gruen halten:** `npm run test:js`, `PYTHONPATH=src pytest -q`,
  `ruff check src tests`, `mypy src`. Bei UI-Verhaltensaenderungen die
  e2e-Suite ergaenzen (das Issue selbst nennt das nochmals).
- **Deployment ueber `pages.yml`** — jeder Push auf `main` deployt neu. Keine
  besonderen Build-Steps zu beachten.

## Sources

### HIGH confidence
- **Codebase analysis (direkter Lese-Check 2026-05-23):** `web/index.html`,
  `web/js/dashboard-data.js`, `web/js/dashboard-charts.js`,
  `web/vendor/dashboard/dashboard.js`, `web/schema.sql`,
  `web/sql/02|08|09|14.sql`, `web/js/db.js`, `web/js/app.js`,
  `web/js/dashboard-app.js`, `Makefile:50-53`.
- **Beide externen Topic-Reviews** unter
  `.issues/grafische-auswertungen-gemeindebudget-verstaendlichkeit/reviews/`
  — Claude Opus 4.7 (367s, 18 Findings, file:line-Zitate) und Codex gpt-5
  (197s, 12 Findings, file:line-Zitate). Cross-Check der Code-Stellen gegen
  den aktuellen Stand bestaetigt die Zitate.
- **`docs/web-design-system.md` Iteration 17** — bestaetigt, welche
  Konsens-Korrekturen bereits erledigt sind und damit aus dem Scope fallen.

### MEDIUM confidence
- **Schuldenstand absolut rekonstruierbar?** — Hypothese: aus
  `gebarung='finanzierung'`-Bewegungen kumulierbar; der absolute Stand zum
  Bilanzstichtag steht moeglicherweise *nicht* im Detailnachweis. Praktisch
  zu pruefen bei R2-Implementierung — Fallback: nur kumulative Bewegung.
- **Eigenmittel-Anteil bei Investitionen** (R12) — als Restgroesse aus
  Saldo-Rechnung ableitbar, aber nicht direkt im Datenmodell. Mit
  Disclaimer.

### LOW confidence (needs validation)
- Keine LOW-confidence-Punkte — Research ist eng auf die zwei verifizierten
  Reviews beschnitten.

## Metadata

**Confidence breakdown:**
- **Konsens-Aufstellung (R1-R6):** HIGH — beide Reviews nennen die Themen.
- **Datenlayer-Mapping:** HIGH — SQL-Quellen direkt eingesehen.
- **Integrationspunkte in `dashboard.js`:** HIGH — Datei zeilengenau gelesen.
- **Einwohner-Spezifikation:** HIGH (Schema/Persistenz), MEDIUM (UX-Form —
  Varianten-Entscheidung).
- **Tier-3-Items:** HIGH einzeln, MEDIUM in Reihenfolge (kann der Planer
  nach Kapazitaet ziehen).

**Research date:** 2026-05-23
**Sub-agents used:** keine — Single-Pass-Konsolidierung aus den vorhandenen
Reviews, wie in CONTEXT.md direktiert.
**Raw research files:** `.issues/auswertungen-erweitern-gemeindebudget/research/`
(leer — die Reviews selbst sind unter
`.issues/grafische-auswertungen-gemeindebudget-verstaendlichkeit/reviews/`).
