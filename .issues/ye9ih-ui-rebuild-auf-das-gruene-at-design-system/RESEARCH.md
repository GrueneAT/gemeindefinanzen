# Research: UI-Rebuild auf das Gruene-AT-Design-System

**Researched:** 2026-05-22
**Issue:** ye9ih-ui-rebuild-auf-das-gruene-at-design-system
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Python-Seite ist out of scope.** `src/gemeindefinanzen/` enthaelt keine
  HTML-/ECharts-/INK-Erzeugung (`html.py`/`report.py` existieren nicht mehr).
  Dies ist ein reines `web/`-Vorhaben. `pytest -q`, `ruff`, `mypy` bleiben
  gruen, weil Python unberuehrt bleibt — reine Regressionsschranken.
- **Layout-Tiefe: voll auf DS-Komponenten.** Die redaktionelle
  Randspalten-Struktur (`.kicker`, `.kicker-num`, `.margin-note`,
  `.masthead-*`, das `.row`/`.margin`/`.body`-Geruest) ENTFAELLT. Header,
  Navigation, Buttons, Cards, Container und Grid kommen durchgaengig aus dem
  Gruene-AT-DS (`.gat-header`/`.gat-nav`, `.gat-btn`, `.gat-card`,
  `.gat-container`, `.gat-grid`).
- DS-CSS wird per `<link>` eingebunden, NICHT vendorisiert. Das
  flomotlik-Stylesheet wird entfernt.

### Claude's Discretion
- **Struktur ist frei anpassbar:** Spaltenzahl, Abschnittsaufteilung und
  Seitenaufbau muessen NICHT 1:1 dem DS folgen — sie duerfen auf das
  VRV-Analysetool zugeschnitten werden.
- **Erweiterte kategoriale Diagramm-Palette:** wenn das DS keine fertige
  Data-Viz-Palette bietet, eine aus den Markenfarben abgeleitete Palette
  selbst definieren (Serien muessen unterscheidbar bleiben).
- Farben, Formen, Ueberschriften und Typografie folgen dem DS — das ist NICHT
  frei.

### Deferred Ideas (OUT OF SCOPE)
- Keine Aenderung an `src/gemeindefinanzen/`.
- Kein Funktionsverlust: Upload, Parsing, Dashboard-Tabs, Dokument-Umschalter,
  Suche/Filter, Sankey- und Ausgaben-Drill-down, Mehrjahresvergleich bleiben
  vollstaendig erhalten.
- Keine WASM-Vendor-Bibliotheken (`mupdf`, `sqlite-wasm`) anfassen.
</user_constraints>

## Summary

Der Rebuild ist ein abgegrenztes `web/`-Vorhaben mit drei klar trennbaren
Arbeitssträngen: (1) **CSS-Fundament tauschen** — der flomotlik-Stylesheet-Link
(`index.html:9`) weicht dem Gruene-AT-DS-Link; (2) **Markup und App-CSS auf
DS-Tokens/-Komponenten umstellen**; (3) **die ECharts-Palette neu ableiten**.
Der grösste Brocken ist *nicht* das Diagramm-Recoloring, sondern die Tatsache,
dass die App heute auf rund einem Dutzend Klassen aus dem flomotlik-Stylesheet
aufsetzt (`.page`, `.row`/`.margin`/`.body`, `.kicker*`, `.masthead-*`, `.mark`,
`.stats`/`.stat*`, `.callout*`, `.lead`, `.footer`, Basisstile für `body` und
`h1..h3`). Diese Klassen verschwinden mit dem alten Link ersatzlos — das DS
liefert KEINE Gegenstücke. Jede davon muss entweder durch eine DS-Komponente
ersetzt oder in `web/css/app.css` neu definiert werden.

Das DS-CSS (verifiziert, vollständig gelesen) ist ein **Token- plus
Komponenten-Stylesheet ohne Reset und ohne Basisstile**: es importiert die
Fonts selbst per `@import` (Barlow Semi Condensed + Vollkorn) — die App braucht
also KEINE eigenen Font-Links, die `googleapis`/`gstatic`-Preconnects in
`index.html:7-8` können bleiben (Performance) oder entfallen. Das DS stylt
`body`, `h1..h3`, `table`, `input` etc. NICHT — wer DS-Typografie auf einer
Überschrift will, muss die Klasse `.gat-headline`/`.gat-subline` setzen oder in
`app.css` die Element-Selektoren mit DS-Tokens versorgen. Das DS definiert
**keine Data-Viz-Palette** und nur 4 Markenfarben — die kategoriale
ECharts-Palette muss aus Tints/Shades dieser 4 Farben abgeleitet werden.

Die Diagramm-Farben sind auf zwei Dateien begrenzt (`dashboard-charts.js`,
`sankey-drill.js`, beide ein `INK`-Objekt) — die Python-Datei aus dem Issue
existiert nicht. Die Testlage ist günstig: die JS-Unit-Tests prüfen keine
Farben/Klassen, die e2e-Tests hängen nur an **IDs und zwei funktionalen
Klassen** (`.tab-btn`/`.tab-panel`/`is-active`, `.switch-btn`,
`span.doc-status.ok`) — diese müssen erhalten bleiben, dann bleiben alle Tests
grün.

**Primary recommendation:** DS-CSS-Link tauschen; die flomotlik-abhängigen
Klassen 1:1 in einer überarbeiteten `app.css` auf DS-Tokens neu definieren
(statt überall im Markup auf `.gat-*`-Klassen umzubauen — die App hat ~30
Custom-Klassen, die das DS nicht kennt); Header/Buttons/Cards/Nav auf echte
`.gat-*`-Komponenten heben; eine 10-stufige kategoriale Chart-Palette aus den
4 Markenfarben + Tints in `app.css` als `--gat-chart-*`-Variablen ablegen und
in beiden JS-`INK`-Objekten verwenden. Die funktional getesteten IDs/Klassen
unverändert lassen.

## Codebase Analysis

### Relevant Code
| Datei | Zweck | Stand | Relevanz |
|-------|-------|-------|----------|
| `web/index.html` (355 Z.) | Markup, Stylesheet-Links, Inline-`<style>` | aktuell | KERN — voller Umbau |
| `web/css/app.css` (291 Z.) | Upload-UI, Dokumentverwaltung, Sankey-Leiste | aktuell | KERN — auf DS-Tokens umstellen |
| `web/vendor/dashboard/dashboard.css` (130 Z.) | Dashboard: Tabs, Tabellen, Drill-down, Mehrjahr-Overlay | aktuell | KERN — auf DS-Tokens umstellen |
| `web/js/dashboard-charts.js` (497 Z.) | ECharts-Optionen; `INK`-Palette Z.10-17 | aktuell | Diagrammfarben |
| `web/js/sankey-drill.js` (258 Z.) | Sankey-Drill-down; `INK`-Palette Z.23-29, `QUELLE_GRUEN` Z.47 | aktuell | Diagrammfarben |
| `web/js/dashboard-app.js` (98 Z.) | baut Switcher (`switch-btn`), lädt `dashboard.js` | aktuell | nur Klassen-Check |
| `web/vendor/dashboard/dashboard.js` (773 Z.) | Tab-/Switcher-Logik, Tabellen, Drill-down, Sankey-Wiring | aktuell | liest Klassen — NICHT ändern (vendor) |
| `web/js/app.js` (366 Z.) | Upload, Toast, Dokumentliste, Progress | aktuell | erzeugt Custom-Klassen-Markup |
| `web/js/boot-guard.js` | Boot-Fehlerbanner `.boot-banner` | aktuell | eigener Inline-Stil in `index.html:14-16` |

### Flomotlik-Referenzen, die entfernt/ersetzt werden
- `index.html:9` — `<link rel="stylesheet" href="https://flomotlik.github.io/claude-code/design-system.css">` → ersetzen durch `https://grueneat.github.io/design-system/design-system.css`.
- `index.html:7-8` — `preconnect` zu `fonts.googleapis.com`/`fonts.gstatic.com` — bleiben gültig (das Gruene-AT-DS importiert ebenfalls von Google Fonts), sind aber optional.
- `app.css:2` — Kommentar „Erweitert das flomotlik Design System" — umschreiben.
- `web/vendor/LIZENZEN.md:29` — flomotlik-Erwähnung — auf Gruene-AT-DS aktualisieren (CC BY 4.0, Urheber „Die Grünen").
- `index.html:18` — Kommentar verweist auf nicht mehr existierende `_chart_div()` aus `html.py` — bereinigen.

### KRITISCH: Klassen, die das DS NICHT ersetzt
Mit dem Entfernen des flomotlik-Links verschwinden diese Klassen **ersatzlos**.
Das Gruene-AT-DS (vollständig gelesen) definiert KEINE davon und auch keine
Basisstile für `body`, `h1..h3`, `table`, `input`, `select`. Jede Zeile unten
braucht eine Entscheidung „durch `.gat-*`-Komponente ersetzen" ODER „in
`app.css` mit DS-Tokens neu definieren":

| Flomotlik-Klasse / Selektor | Verwendet in | Empfohlene Behandlung |
|-----------------------------|--------------|------------------------|
| `body` Basisstil (Font, Größe, Farbe, Hintergrund) | global | In `app.css` neu setzen: `font-family: var(--gat-font-copy)`, `color: var(--gat-color-text)`, weisser/heller Hintergrund |
| `h1, h2, h3` Basisstil | überall | In `app.css` via Element-Selektor auf `--gat-font-headline`, `--gat-text-h1..h3`, `--gat-leading-headline` ODER pro Überschrift `.gat-headline`/`.gat-subline` setzen |
| `.page` (max-width) | `index.html:30`, in `app.css:15` + `dashboard.css:6` auf `min(2400px,95vw)` überschrieben | In `app.css` behalten/neu definieren — DS `.gat-container` ist auf 72rem begrenzt, zu schmal fürs Dashboard |
| `.row`/`.margin`/`.body` (2-Spalten-Grid) | `index.html:32-46` (Header) | ENTFÄLLT laut Locked Decision — Header auf `.gat-header`/`.gat-header__inner` |
| `.kicker`, `.kicker-num`, `.margin-note` | `index.html:34-36` | ENTFÄLLT laut Locked Decision |
| `.masthead-title`, `.masthead-sub` | `index.html:39-44` | ersetzen durch `.gat-headline` + `.gat-fliesstext` (oder `.gat-subline`) |
| `.mark` / `.mark-blue`/`.mark-green`/`.mark-red` | `index.html:124,156,214,222` (Inline-Hervorhebungen) | DS-Pendant ist `.gat-highlight` (gelber Marker) bzw. `.gat-underline` (magenta Unterstreichung). Achtung Semantik: heute farbcodiert (blau/grün/rot) — DS kennt nur EINEN Highlight-Stil. Entscheidung im Plan nötig |
| `.lead` (Vorspann-Absatz) | `index.html:123`, `dashboard.css:8` | in `app.css` mit DS-Tokens neu (z.B. `.gat-subline` oder eigener Absatzstil) |
| `.stats`, `.stat`, `.stat-num` (+`.is-orange`), `.stat-label` | `index.html:128-137` (Überblick-Kennzahlen) | in `app.css` neu definieren — passt gut zu `.gat-card`/`.gat-grid` als Kennzahlen-Karten |
| `.callout`, `.callout-label`, `.is-risk` | `index.html:240-247` (Sparpotenzial-Hinweis) | in `app.css` neu — DS hat kein Callout; mit `--gat-color-*`-Tokens nachbauen |
| `.footer` | `index.html:330-334` | in `app.css` neu mit DS-Tokens |
| Inline-`<style>` `index.html:13-26` | `.boot-banner`, `.dashboard-leer`, `.dash-chart` | hartkodierte Farben (`#8E2F2A`, `--rule-hair`/`--paper-raised`-Fallbacks) auf `--gat-*`-Tokens umstellen; idealerweise nach `app.css` verschieben |

### app.css — flomotlik-Token-Abhängigkeiten (alle Z. brauchen Ersatz)
`app.css` definiert oben eigene `:root`-Variablen, die auf flomotlik-Variablen
mit Fallback zurückgreifen, und nutzt zusätzlich viele hartkodierte Hex-Werte:
- `app.css:6-7` — `--hair: var(--rule-hair, #cdc4b4)`, `--raised: var(--paper-raised, #faf6ee)` → auf DS-Tokens / neutrale Grautöne umstellen.
- `app.css:8-12` — eigene `--ink-blue/-red/-green/-orange/-soft` (flomotlik-Tinten) → durch DS-Markenfarben ersetzen (siehe Kontrastregel unten).
- Hartkodiert: `#f1ebdf` (`:54`), `#eef2f6` (`:81`), `#173a57` (`:103`), `#e6dfd0` (`:135`), `#eef3ef`/`#f6eeed` (`:188,193,247,252`), `--paper`-Fallback `#f4efe6` (`:230`) — alle auf DS-Tokens/Tints heben.

### dashboard.css — flomotlik-Token-Abhängigkeiten
- `dashboard.css:1` — `--hair`/`--raised` mit flomotlik-Fallback.
- `dashboard.css:6` — `.page { max-width: min(2400px,95vw) }` — überschreibt die DS-Breitenbegrenzung; muss erhalten bleiben (Dashboard braucht Breite).
- Hartkodierte flomotlik-Tinten überall: `#1F4A6D` (Switcher/Mehrjahr-Primär `:23,51,73,97`), `#2b2825`/`#5b5650`/`#9a8f78` (Text/Grau), `#e6dfd0`, `rgba(31,74,109,0.06)` (Hover), `#9a4a1c` (`.table-hint`/`.mj-empty`), `var(--paper,#F4EFE6)` (`:11,116`).
- **Hinweis:** `dashboard.css` und `dashboard.js` liegen unter `web/vendor/` — sind aber NICHT externe Vendor-Bibliotheken (kein WASM, hauseigen). `dashboard.css` darf und muss auf DS-Tokens umgestellt werden. `dashboard.js` ist klassisches Skript ohne Farben im Markup — nur die Klassen, die es liest, dürfen sich nicht ändern (siehe Pitfalls).

<interfaces>
// === Gruene-AT-DS — verifizierte Tokens (design-system.css, HIGH) ===
// Farben
--gat-color-dunkelgruen: #257639;   --gat-color-hellgruen: #56af31;
--gat-color-gelb: #ffed00;          --gat-color-magenta: #e6007e;
--gat-color-weiss: #ffffff;         --gat-color-anthrazit: #1d1d1b;
// Semantische Aliase
--gat-color-primary  = dunkelgruen   --gat-color-secondary = hellgruen
--gat-color-accent   = magenta       --gat-color-highlight = gelb
--gat-color-text     = anthrazit     --gat-color-surface   = weiss
--gat-color-on-primary = weiss       --gat-color-on-secondary = anthrazit
// Schrift
--gat-font-headline / --gat-font-copy = 'Barlow Semi Condensed', sans-serif
--gat-font-emphasis = 'Vollkorn', serif
// Typo-Groessen (Ratio 1.25)
--gat-text-h1: 2.441rem  --gat-text-h2: 1.953rem  --gat-text-h3: 1.563rem
--gat-text-subline: 1.25rem  --gat-text-copy: 1rem  --gat-text-small: 0.8rem
--gat-leading-headline: 0.9   --gat-leading-copy: 1.3
// Abstaende
--gat-space-1..6 = 0.25 / 0.5 / 1 / 1.5 / 2 / 3 rem
// Masse
--gat-radius-sm: 0.25rem  --gat-radius-md: 0.5rem  --gat-border-width: 2px
--gat-container-max: 72rem
--gat-breakpoint-sm: 36rem   --gat-breakpoint-md: 48rem
// Fonts: das DS macht selbst @import url('...Barlow Semi Condensed...Vollkorn...')
// -> die App braucht KEINE eigenen Font-Links.
// Das DS hat KEINEN Reset, KEINE body/h*-Basisstile, KEINE Chart-Palette.

// === Gruene-AT-DS — Komponentenklassen + Pflicht-Markup (HIGH) ===
// Layout
.gat-container        // max-width 72rem, zentriert, padding-inline space-4
.gat-grid             // auto-fit, minmax(min(100%,16rem),1fr), gap space-4
.gat-grid--2 / --3    // 2 bzw. 3 feste Spalten; <36rem -> 1 Spalte
.gat-section          // padding-block space-6
// Header  — Pflichtstruktur:
//   <header class="gat-header">
//     <div class="gat-header__inner">
//       <a class="gat-header__logo"><span class="gat-header__logo-mark"></span></a>
//       <nav class="gat-nav"> <a class="gat-nav__link gat-nav__link--active">..</a> </nav>
//     </div></header>
//   .gat-header  -> bg primary (dunkelgruen), color on-primary (weiss)
//   .gat-header__logo-mark nutzt mask url('assets/gruene-logo.svg') — RELATIV
//     zur CSS-Datei; auf grueneat.github.io aufloesbar, KEIN lokales Asset noetig.
//   .gat-nav__link--active / :hover -> gelbe Unterstreichung (border-bottom highlight)
// Buttons — <button class="gat-btn gat-btn--primary"> / gat-btn--secondary
//   primary: bg primary + weiss; secondary: transparent + dunkelgruener Rand
// Cards — <div class="gat-card gat-card--primary|--secondary">
//            <div class="gat-card__title">..</div>
//            <div class="gat-card__body">..</div></div>
//   --primary: bg dunkelgruen / weiss; --secondary: bg hellgruen / anthrazit
// Typografie-Klassen — .gat-headline (h1, 900) .gat-subline (600, 1.25rem)
//   .gat-fliesstext (400 copy) .gat-emphasis (Vollkorn italic 900)
// CD-Elemente
.gat-underline        // border-bottom 2px magenta
.gat-highlight        // bg gelb, text anthrazit  (EINZIGER Highlight-Stil)
.gat-stoerer / --gelb / --magenta   // gedrehtes Badge

// === Bestehende App: getestete IDs/Klassen, die ERHALTEN bleiben MUESSEN ===
// (sonst brechen e2e-Tests — siehe Test Surface)
#boot-banner (Abwesenheit getestet), #dashboard-inhalt, #dashboard-leer,
#c_sankey, #c_wasserfall, #doc-tbody, #doc-manager, #file-input,
#sankey-hinweis, #sankey-reset, #build-stamp
.tab-btn[data-tab="..."], .tab-panel[data-panel="..."], Klasse `is-active`
.switch-btn  (+ Klasse `is-active`)
span.doc-status.ok  (Text "5/5 Pruefungen")
// dashboard.js liest zusaetzlich (toggelt Klassen / liest DOM):
.tabs .switcher .tab-btn .tab-panel .switch-btn  is-active
.arrow .sortable .row-pick .drill-row .chev .label .code .betrag .sep
is-green/is-red (auf #st-netto)  is-open (#mj-overlay)  is-visible (#sankey-hinweis)
#st-netto #drill-list #drill-crumbs #drill-sum #mj-* #such-* #f-* usw.

// === ECharts INK-Palette — heute identisch in beiden Dateien ===
// dashboard-charts.js:10-17
const INK = { red:"#8E2F2A", blue:"#1F4A6D", orange:"#9A4A1C",
              green:"#2F6149", soft:"#5b5650", paper:"#F4EFE6" }
// sankey-drill.js:23-29  (ohne `paper`)
const INK = { red:"#8E2F2A", blue:"#1F4A6D", orange:"#9A4A1C",
              green:"#2F6149", soft:"#5b5650" }
// dashboard-charts.js:449-460 — 10-stufige Mehrjahr-Palette MEHRJAHR_PALETTE
//   [blue,orange,green,red,soft, "#b7ad99","#3d6f8e","#bf6a3a","#4a8068","#a85852"]
// chartAufwandart palette:157-163 — {Personal:blue, Sachaufwand:orange,
//   Transfers:red, Finanz:soft, Sonstige:"#b7ad99"}
// chartTreemap color:235 — [orange,blue,green,red,soft]
// sankey-drill.js QUELLE_GRUEN:47 — Set{"Kommunalsteuer","Ertragsanteile (Bund)"}
//   -> grün; sonstige Quellen -> blau (quelleFarbe():49-51)
</interfaces>

### Wo Diagrammfarben pro Charttyp verwendet werden
| Chart | Funktion / Zeile | Farbnutzung |
|-------|------------------|-------------|
| Wasserfall | `chartWasserfall` :248-297 | 3 feste Rollen: Erträge=green, Aufwendungen=red, Nettoergebnis=blue |
| Sankey (statisch) | `chartSankey` :85-132 | Quellen grün/blau (Kommunalst./Ertragsant. grün, Rest blau), Mitte=soft, Gruppen=orange |
| Sankey (Drill) | `buildSankeyOption` :156-258 (sankey-drill.js) | gleiche Logik; Mitte=soft, Konten grün/blau, Ansätze=orange |
| Treemap | `chartTreemap` :195-246 | `color`-Array `[orange,blue,green,red,soft]` + `colorSaturation [0.32,0.62]` für Kinder |
| Ring (Aufwand n. Art) | `chartAufwandart` :156-193 | feste Kategorie→Farbe-Map (5 Kategorien) |
| Balken Einnahmen | `chartEinnahmen` :134-142 | blau, Kommunalsteuer-Posten grün |
| Balken Treiber | `chartTreiber` :144-148 | rot |
| Balken Investitionen | `chartInvestitionen` :150-154 | orange |
| Korridor (Balken+Linie) | `chartKorridor` :299-333 | Balken=orange, Linie=red |
| Trend Eckwerte | `chartTrendEckwerte` :336-372 | Erträge=green, Aufwand=red, Netto=blue (Linie) |
| Trend Kommunalsteuer | `chartTrendKomm` :374-401 | green + `rgba(47,97,73,0.10)` Areastyle |
| Trend Aufwand (Stack) | `chartTrendAufwand` :403-430 | 4 Serien: blue/orange/red/soft |
| Mehrjahr-Vergleich | `MEHRJAHR_PALETTE` :449-460 | **10 unterscheidbare Farben** — der Engpass |
| Achsen/Grid/Text | `baseText`/`catAxis`/`valAxis` :19-49 | `#2b2825`, `#5b5650`, `#cdc4b4`, `#e6dfd0`, `fontFamily "Inter"` |

### Reusable Components
- `.gat-card` + `.gat-grid` eignen sich direkt für die Überblick-Kennzahlen
  (`.stats`) und für die Zwei-Spalten-Diagrammbereiche (`.dash-grid`).
- `.gat-btn` ersetzt: `.dropzone-btn`, `.doc-clear-btn`, `.doc-remove`,
  `.tab-btn`, `.switch-btn`, `.mj-btn`, `.sankey-reset` (Achtung: `.tab-btn`
  und `.switch-btn` als Klassennamen MÜSSEN bleiben — siehe Pitfalls; man kann
  beide Klassen am Element führen: `class="gat-btn switch-btn"`).
- `.gat-header`/`.gat-nav` für Kopfzeile; die Tab-Leiste kann optisch an
  `.gat-nav` angelehnt werden, behält aber ihre `.tab-btn`-Klassen.

### Potential Conflicts
- `.gat-container` begrenzt auf 72rem — das Dashboard braucht volle Breite
  (`dashboard.css:6` öffnet `.page` auf `min(2400px,95vw)`). Lösung: für die
  Dashboard-Sektion KEIN `.gat-container` verwenden, sondern eine eigene breite
  Wrapper-Klasse; `.gat-container` nur für schmale Textbereiche.
- `.gat-grid--2` bricht erst bei `<36rem` auf 1 Spalte um; `.dash-grid` bricht
  heute bei `860px`. Akzeptanzkriterium nennt die DS-Breakpoints 36/48rem —
  also `.gat-grid--2` nutzen oder den Bruchpunkt auf einen DS-Breakpoint legen.
- DS `--gat-leading-headline: 0.9` ist sehr eng — für mehrzeilige
  Tabellenüberschriften/`h3` ggf. lokal lockern.

## Standard Stack
| Baustein | Version | Zweck | Einbindung | Confidence |
|----------|---------|-------|------------|------------|
| Gruene-AT-DS-CSS | `grueneat.github.io/design-system/design-system.css` (kanonische URL, unversioniert) | Tokens + Komponenten | `<link>`, kein Vendoring | HIGH |
| ECharts | 5.5.1 (bereits per jsDelivr, `index.html:10`) | Diagramme | unverändert | HIGH |
| Barlow Semi Condensed + Vollkorn | via Google Fonts `@import` IM DS-CSS | App-Schrift | automatisch durch DS-Link | HIGH |
| Playwright | ^1.60.0 | e2e-Tests | unverändert | HIGH |

### Alternatives Considered
| Statt | Möglich | Tradeoff |
|-------|---------|----------|
| Flomotlik-Klassen in `app.css` neu definieren | Markup komplett auf `.gat-*`-Komponenten umbauen | Reiner `.gat-*`-Umbau ist DS-puristisch, aber die App hat ~30 funktionale Custom-Klassen (`.dropzone`, `.doc-table`, `.drill-row`, `.filterbar`…), die das DS gar nicht abbildet — die müssen ohnehin in `app.css` bleiben. Empfehlung: Header/Buttons/Cards/Nav auf echte `.gat-*`-Komponenten, der Rest bleibt Custom-CSS auf DS-Tokens. |
| Eigene Chart-Palette aus Tints/Shades | Auf DS-Data-Viz-Palette warten | Das DS bietet KEINE Data-Viz-Palette (verifiziert) und ist ein junges System — selbst ableiten ist die einzige Option. |

## Don't Hand-Roll
| Problem | Nicht selbst bauen | Stattdessen | Warum |
|---------|--------------------|-------------|-------|
| Markenfarben, Typo-Skala, Abstände | eigene Hex-/rem-Werte | `--gat-*`-Tokens aus dem DS-CSS | DS ist Single Source of Truth; Tokens ändern sich zentral |
| Header/Nav/Button/Card-Styling | eigenes CSS | `.gat-header`/`.gat-nav`/`.gat-btn`/`.gat-card` | Locked Decision: volle DS-Komponenten |
| Font-Laden | eigene `@font-face`/`<link rel=stylesheet>` für Fonts | nichts — DS-CSS importiert die Fonts selbst | Doppelte Font-Ladung vermeiden |
| Kontrastprüfung | Augenmaß | DS-Kontrastregel mechanisch anwenden (siehe Pitfalls) | dokumentierte Ratios, klare Regel |

## Architecture Patterns

### Recommended Approach
1. **Stylesheet-Tausch:** `index.html:9` auf die Gruene-AT-DS-URL umstellen;
   `index.html:7-8`-Preconnects beibehalten (DS lädt Fonts von Google).
   Ladereihenfolge: DS-CSS zuerst, dann `dashboard.css`, dann `app.css` (so
   können `app.css`/`dashboard.css` DS-Tokens nutzen und gezielt überschreiben).
2. **`app.css` zum DS-Adapter machen:** ganz oben einen `:root`-Block mit
   App-eigenen Variablen, die ausschliesslich aus `--gat-*`-Tokens abgeleitet
   sind (Grautöne für Linien/Flächen ableiten, da das DS keine Neutralskala
   hat). Alle flomotlik-Token-Referenzen und Hardcodes durch diese ersetzen.
   Basisstile für `body`, `h1..h3`, `table`, `input`, `select` hier neu setzen.
3. **Markup-Umbau in `index.html`:** Header-Block (Z.32-46) durch
   `.gat-header`/`.gat-header__inner`/`.gat-nav` ersetzen; `.masthead-*` durch
   `.gat-headline`/`.gat-fliesstext`. Überblick-Kennzahlen (`.stats`) als
   `.gat-card`-Raster. Funktionale IDs und getestete Klassen unverändert lassen.
4. **Chart-Palette:** in `app.css` 10 CSS-Variablen `--gat-chart-1..10`
   definieren; in `dashboard-charts.js` und `sankey-drill.js` das `INK`-Objekt
   neu belegen (semantische Schlüssel beibehalten, damit der restliche Code
   unverändert bleibt) und `MEHRJAHR_PALETTE` neu setzen. JS kann CSS-Variablen
   nicht direkt lesen — entweder Werte in JS hart spiegeln (mit Kommentar
   „Quelle: --gat-chart-* in app.css") oder einmalig per
   `getComputedStyle(document.documentElement)` auslesen. Empfehlung:
   hart spiegeln (kein Build-Schritt, einfachste Lösung, Parität zum DS-Token
   per Kommentar dokumentiert).
5. **Inline-`<style>` (Z.13-26)** nach `app.css` verschieben und auf Tokens
   umstellen.

### Chart-Palette ableiten (HIGH-MEDIUM)
Das DS hat 4 Markenfarben — Sankey/Treemap/Mehrjahr brauchen bis zu 10
unterscheidbare Kategorien. Bewährter Ansatz für kategoriale Paletten aus
wenigen Basisfarben:
- **Basis:** die 4 Markenfarben als die 4 stärksten Kategorien:
  dunkelgrün `#257639`, hellgrün `#56af31`, magenta `#e6007e`, anthrazit
  `#1d1d1b`. (Gelb `#ffed00` ist als Flächen-/Serienfarbe heikel — sehr hell,
  schlechter Kontrast auf Weiss, niemals weisser Text darauf; eher als Akzent
  sparsam oder gar nicht als Serienfarbe.)
- **Erweiterung:** je Markenfarbe einen abgedunkelten Shade und/oder einen
  helleren Tint erzeugen (z.B. HSL-Lightness ±12-18%), bis 10 Stufen erreicht
  sind. Benachbarte Stufen sollen in Helligkeit ODER Farbton deutlich
  differieren.
- **Reihenfolge:** so anordnen, dass aufeinanderfolgende Serien maximal
  kontrastieren (nicht alle Grüntöne nebeneinander).
- **Kontrast:** jede Serienfarbe muss gegen die Flächenfarbe (weiss/hell) und
  ihre Label-Farbe ausreichend kontrastieren; gelbe und sehr helle Töne
  brauchen dunklen Text.
- **Semantische Bindung beibehalten:** Erträge/positiv = grünstämmig,
  Aufwand/Risiko = magenta-/rotstämmig — die heutige Semantik (green=positiv,
  red=Aufwand, blue=neutral, orange=Sachaufwand) auf das neue Vokabular mappen.
  Konkrete Belegung der `INK`-Schlüssel ist Aufgabe des Planners; Vorschlag:
  `green→dunkelgrün`, eine zweite Grünstufe für „blue" (neutral/Personal),
  `red→magenta`, `orange→` ein abgeleiteter wärmerer Ton, `soft→anthrazit-Tint`.

### Anti-Patterns to Avoid
- **`.tab-btn`/`.switch-btn`/`.tab-panel`/`is-active`/`doc-status ok` umbenennen
  oder entfernen** — bricht sofort `dashboard.js` UND e2e-Tests. Diese
  Klassennamen sind Vertrag. DS-Look durch zusätzliche Klasse erreichen
  (`class="gat-btn tab-btn"`), nicht durch Umbenennen.
- **`dashboard.js` editieren** — es ist hauseigenes klassisches Skript, das nur
  Klassen liest; ein Umbau dort ist nicht nötig und riskant. Styling über CSS.
- **Eigene Font-`<link>`s zusätzlich setzen** — das DS importiert die Fonts
  bereits; doppeltes Laden.
- **Gelb als Serien-/Textgrundfarbe** — `#ffed00` trägt nur Anthrazit-Text,
  nie Weiss; als Diagrammfläche kontrastschwach.
- **`.gat-container` ums Dashboard legen** — 72rem-Limit erstickt die breiten
  Tabellen.

## Common Pitfalls

### Verlust funktionaler Klassen
**Was schiefgeht:** Beim „DS-Komponenten überall"-Umbau werden `.tab-btn`,
`.tab-panel`, `.switch-btn`, `is-active`, `span.doc-status.ok` umbenannt.
**Warum:** `dashboard.js` (Z.85-89,102-103,738-744) toggelt/liest exakt diese
Namen; `dashboard.spec.mjs`, `sankey.spec.mjs`, `upload.spec.mjs` asserten
darauf.
**Vermeiden:** Klassennamen als Vertrag behandeln — DS-Optik durch zusätzliche
`.gat-*`-Klasse am selben Element.
**Frühwarnzeichen:** Tabs schalten nicht mehr um; e2e-Test
`Dashboard ist sichtbar, Tabs schalten um` schlägt fehl.

### Fehlende Basisstile nach Stylesheet-Tausch
**Was schiefgeht:** Nach Entfernen des flomotlik-Links sind `body` und
`h1..h3` ungestylt (Browser-Default Times/serifenlos, falsche Grössen) — das DS
liefert KEINEN Reset und KEINE Element-Basisstile.
**Warum:** Das Gruene-AT-DS ist ein reines Token-/Komponenten-Stylesheet.
**Vermeiden:** `body`, `h1..h3`, `table`, `input`, `select` in `app.css`
explizit mit DS-Tokens neu setzen ODER an jeder Überschrift die
`.gat-headline`/`.gat-subline`-Klassen führen.
**Frühwarnzeichen:** Seite erscheint in Times New Roman; Überschriften zu klein.

### Kontrastregel verletzt
**Was schiefgeht:** Weisser Text auf Gelb/Hellgrün oder Anthrazit auf
Dunkelgrün.
**Warum:** DS-Regel: weisser Text NUR auf Dunkelgrün; Hellgrün UND Gelb tragen
Anthrazit-Text, nie Weiss. (Dokumentierte Ratios: Dunkelgrün+Weiss 5.63:1,
Hellgrün+Anthrazit 6.09:1.)
**Vermeiden:** Konsequent die Token-Paare nutzen: `--gat-color-on-primary`
(weiss) gehört zu `--gat-color-primary`; `--gat-color-on-secondary` (anthrazit)
zu `--gat-color-secondary`. Bei jeder farbigen Fläche prüfen. Das betrifft auch
ECharts-Labels auf farbigen Sankey-Knoten/Treemap-Kacheln.
**Frühwarnzeichen:** Helle Schrift auf hellem Grund kaum lesbar.

### Doppelter Font-Import
**Was schiefgeht:** Eigene Barlow/Vollkorn-`<link>`s zusätzlich zum DS-Import.
**Vermeiden:** DS-CSS macht `@import url('...Barlow Semi Condensed...Vollkorn...')`
selbst — nichts weiter tun. Die `googleapis`/`gstatic`-Preconnects dürfen
bleiben (sie beschleunigen den DS-Import).

### ECharts liest keine CSS-Variablen
**Was schiefgeht:** `itemStyle.color: 'var(--gat-chart-1)'` — ECharts
interpretiert CSS-Variablen NICHT, der Wert wird ignoriert/transparent.
**Vermeiden:** In JS echte Hex-Werte verwenden (hart gespiegelt mit
Quellenkommentar) oder einmalig via `getComputedStyle` auflösen und in das
`INK`-Objekt schreiben.
**Frühwarnzeichen:** Diagramme rendern grau/transparent.

### "Inter"-Schrift in Diagrammen
**Was schiefgeht:** `dashboard-charts.js`/`sankey-drill.js`/`dashboard.js`
setzen überall `fontFamily: "Inter, sans-serif"` — Inter wird nach dem
Stylesheet-Tausch nicht mehr geladen, Charts fallen auf `sans-serif` zurück.
**Vermeiden:** Für Diagramm-Parität zum Rest der Seite `fontFamily` auf
`"Barlow Semi Condensed, sans-serif"` umstellen (gut sichtbar, ~20 Fundstellen
über die drei Dateien). Optional, aber empfohlen für ein einheitliches Bild.
**Frühwarnzeichen:** Diagrammschrift weicht sichtbar von der Seitenschrift ab.

### `dashboard.js` ist klassisches Skript
**Was schiefgeht:** Versuch, `dashboard.js` als ESM zu behandeln/zu importieren.
**Warum:** `dashboard-app.js:92-98` lädt es bewusst per `<script>`-Tag, weil es
globale Namen (`DATA`, `CFG`, `buildSankeyOption`) liest. Für den Rebuild
braucht es gar keinen Eingriff in `dashboard.js`.

## Environment Availability
| Abhängigkeit | Benötigt von | Verfügbar | Hinweis |
|--------------|--------------|-----------|---------|
| Internet (CDN) | DS-CSS, ECharts, Fonts | ja (kein Offline-Ziel laut CLAUDE.md) | DS-CSS + Fonts werden zur Laufzeit geladen |
| Node | `npm run test:js` | ja (package.json `type: module`) | reine Unit-Tests, keine UI |
| Playwright/Chromium | `npm run test:e2e` | devDependency `^1.60.0`; `playwright.config.mjs` startet `scripts/serve.mjs:8080` | e2e gegen echtes Markup |
| Python/pytest/ruff/mypy | `pytest -q`, `ruff`, `mypy` | — | Python unberührt → bleiben grün; reine Regressionsschranke |

Hinweis: Konnte das laufende Environment nicht aktiv proben (keine
Tool-Versionsabfragen ausgeführt); obige Tabelle leitet sich aus
`package.json`, `playwright.config.mjs` und CLAUDE.md ab — HIGH für die
deklarierten Versionen, das tatsächliche Vorhandensein der Binaries ist
ungeprüft.

## Test Surface

### `tests/js/run.mjs` (`npm run test:js`)
Prüft Parser/Validator/DB/Dashboard-DATEN — **keine** Farben, **keine**
CSS-Klassen, **kein** DOM. Importiert `alleCharts` und `buildSankeyOption` und
prüft nur Struktur (Knotenzahlen, Beträge, `drillSeite`/`drillExpandbar`).
**→ Eine Farbänderung in `INK`/`MEHRJAHR_PALETTE` bricht diese Tests NICHT.**
Risiko nur, falls der Rebuild eine exportierte Signatur ändert — nicht geplant.

### `tests/e2e/*.spec.mjs` (`npm run test:e2e`, Playwright)
Hängen an IDs und wenigen funktionalen Klassen — **keine Farbassertions**:
| Test | Selektoren / Assertions | Brechen, wenn… |
|------|--------------------------|----------------|
| `smoke.spec.mjs` | `#boot-banner` (Count 0) | Boot-Banner-ID entfällt / Boot-Fehler |
| `dashboard.spec.mjs` | `#dashboard-inhalt`, `#dashboard-leer`, `#c_sankey canvas`, `#c_wasserfall canvas`, `.tab-btn[data-tab="einnahmen"]`, Klasse `is-active`, `.tab-panel[data-panel="einnahmen"]` | IDs/`.tab-btn`/`data-tab`/`data-panel`/`is-active` umbenannt |
| `sankey.spec.mjs` | `#c_sankey`, `.tab-btn[data-tab="ueberblick"]`+`is-active`, `#sankey-hinweis`+`is-visible`, `#sankey-reset` | IDs/`is-visible`/`.tab-btn` geändert |
| `upload.spec.mjs` | `#doc-tbody tr`, `#doc-manager` (`.open`), `span.doc-status.ok`, Text `"5/5 Pruefungen"` | `#doc-manager`-ID, `.doc-status.ok`-Klasse oder der Statustext geändert |
| `persistence.spec.mjs` | `#file-input`, `#doc-tbody tr`, `window.__appBereit` | `#file-input`/`#doc-tbody`-IDs geändert |
| `build-stamp.spec.mjs` | `#build-stamp`, Text enthält `"Build"` | `#build-stamp`-ID geändert |
| `helpers.mjs` | `#file-input`, `window.__appBereit`, `window.__sankeyDrill` | — |

**Fazit:** Tests bleiben grün, solange (a) keine getestete ID/Klasse umbenannt
wird, (b) der Status-Span weiter `class="doc-status ok"` mit Text
`"5/5 Pruefungen"` trägt, (c) ECharts weiter in `#c_sankey`/`#c_wasserfall` ein
`<canvas>` rendert, (d) `window.__appBereit`/`window.__sankeyDrill` gesetzt
werden. All das hängt an Markup-IDs/-Klassen, nicht an Styling — der Rebuild
ist mit den Tests verträglich, wenn die `<interfaces>`-Liste „ERHALTEN" beachtet
wird.

### Testkommandos (CLAUDE.md)
`npm run test:js` · `npm run test:e2e` (Playwright) · `PYTHONPATH=src pytest -q`
· `ruff check src tests` · `mypy src`. Alle müssen grün bleiben.

## Project Constraints (from CLAUDE.md)
- **Kein Vendoring, kein Offline:** Drittbibliotheken (DS-CSS, ECharts, Fonts)
  per CDN/Link, NICHT ins Repo kopieren. Internetverbindung darf vorausgesetzt
  werden.
- **Browser-App: Vanilla JS, ESM, KEIN Build-Schritt** für die ausgelieferte
  Seite. (→ Chart-Palette kann keine Build-Zeit-Berechnung nutzen.)
- **Sprache: Deutsch** in UI-Texten und Code-Bezeichnern.
- **Keine Werkzeug-Attribution** in Commits, Code, Kommentaren.
- Deployment: GitHub Pages über `.github/workflows/pages.yml`; jeder Push auf
  `main` deployt.

## Sources
### HIGH confidence
- `grueneat.github.io/design-system/design-system.css` — vollständig gelesen (Tokens, Komponenten, `@import` der Fonts, keine Chart-Palette, keine Basisstile).
- `grueneat.github.io/design-system/` — Showcase: Komponenten-Markup, Kontrastregel + dokumentierte Ratios.
- `flomotlik.github.io/claude-code/design-system.css` — Bestätigung, welche Klassen mit dem alten Link verschwinden.
- Codebase: `web/index.html`, `web/css/app.css`, `web/vendor/dashboard/dashboard.css`, `web/js/dashboard-charts.js`, `web/js/sankey-drill.js`, `web/js/dashboard-app.js`, `web/js/app.js`, `web/vendor/dashboard/dashboard.js` (grep), alle `tests/`-Dateien, `package.json`, `playwright.config.mjs`, `git log`.

### MEDIUM confidence
- Ansatz zur Ableitung einer kategorialen Palette aus wenigen Basisfarben (HSL-Tints/-Shades, Kontrastreihung) — etabliertes Data-Viz-Vorgehen; konkrete 10 Werte sind im Plan/in der Umsetzung festzulegen.

### LOW confidence (needs validation)
- Tatsächliches Vorhandensein der Test-Binaries im Ausführungs-Environment (nicht aktiv geprobt).
- Ob `gruene-logo.svg` (vom DS via `mask` referenziert) auf `grueneat.github.io` erreichbar ist — Pfad ist relativ zum DS-CSS, sehr wahrscheinlich vorhanden, aber nicht direkt verifiziert.

## Metadata
**Confidence breakdown:**
- Codebase / betroffene Dateien: HIGH — alle Kerndateien gelesen.
- DS-Tokens & -Komponenten: HIGH — Stylesheet vollständig gelesen.
- Chart-Palette-Ableitung: MEDIUM — Methode solide, konkrete Werte offen.
- Test-Verträglichkeit: HIGH — alle Testdateien gelesen.
- Environment: MEDIUM — aus Konfig abgeleitet, nicht geprobt.

**Research date:** 2026-05-22
**Sub-agents used:** keiner — Single-Researcher-Lauf (überschaubarer, gut
eingegrenzter `web/`-Scope; CONTEXT.md hatte den Codebase-Befund bereits
vorstrukturiert).
**Raw research files:** keine separaten — Befunde direkt in dieser Datei.
