# Plan: UI-Rebuild auf das Gruene-AT-Design-System

<objective>
Was dieser Plan erreicht: Die Browser-App unter `web/` wird vom persoenlichen
flomotlik-Design-System auf das org-weite Gruene-AT-Design-System umgebaut —
Farben, Typografie, Komponenten, Inline-Elemente und die ECharts-Palette folgen
kuenftig dem Gruene-AT-DS.

Warum es zaehlt: Die App ist ein Werkzeug der Gruenen AT; ihre Oberflaeche soll
dem org-weiten Corporate Design entsprechen statt einem persoenlichen System.

Scope: Reines `web/`-Vorhaben. `index.html`, `web/css/app.css`,
`web/vendor/dashboard/dashboard.css`, `web/js/dashboard-charts.js`,
`web/js/sankey-drill.js` und `web/vendor/LIZENZEN.md`.
NICHT im Scope: `src/gemeindefinanzen/` (kein Python-UI vorhanden — `html.py`/
`report.py` existieren nicht; die im Issue genannte „Python-Paritaet" ist
gegenstandslos), `web/vendor/dashboard/dashboard.js` (hauseigenes klassisches
Skript, das nur Klassen liest — wird NICHT editiert), WASM-Vendor-Bibliotheken
(`mupdf`, `sqlite-wasm`).
</objective>

<strategy>
Der Rebuild hat drei Arbeitsstraenge mit klarer Reihenfolge, sodass die App
zwischen keinem Commit kaputt ist:

1. **Fundament zuerst, dann strippen.** Der grosse Stolperstein ist NICHT das
   Diagramm-Recoloring, sondern dass die App auf ~12 Klassen und alle
   Basisstile (`body`, `h1..h3`) aus dem flomotlik-Stylesheet aufsetzt. Das
   Gruene-AT-DS ist ein reines Token-/Komponenten-Stylesheet ohne Reset und
   ohne Element-Basisstile. Wuerde man den Link einfach tauschen, stuende die
   Seite in Times New Roman da. Darum: ZUERST den DS-Link einsetzen UND
   `app.css` zum DS-Adapter ausbauen (Basisstile + alle ersatzlos verlorenen
   Klassen auf `--gat-*`-Tokens neu definieren), ERST DANN den
   flomotlik-Link entfernen — in derselben Task, nachdem der Ersatz steht.

2. **Custom-CSS auf DS-Tokens, echte DS-Komponenten nur wo sinnvoll.** Die App
   hat ~30 funktionale Custom-Klassen (`.dropzone`, `.doc-table`, `.drill-row`,
   `.filterbar` …), die das DS gar nicht abbildet — die bleiben Custom-CSS,
   aber auf `--gat-*`-Tokens statt flomotlik-Variablen/Hardcodes. Echte
   `.gat-*`-Komponenten kommen dort zum Einsatz, wo das DS ein Pendant hat:
   Header/Nav, Buttons, Karten. Verworfen: alles auf `.gat-*` umzubauen — das
   DS deckt die funktionalen Custom-Klassen nicht ab und der Aufwand stuende in
   keinem Verhaeltnis.

3. **Funktionale Klassen sind Vertrag.** `.tab-btn`/`.tab-panel`/`is-active`,
   `.switch-btn`, `span.doc-status.ok` mit Text „5/5 Pruefungen" sowie die
   getesteten IDs werden von `dashboard.js` gelesen und von der e2e-Suite
   geprueft. DS-Look wird durch eine ZUSAETZLICHE Klasse am selben Element
   erreicht (`class="gat-btn tab-btn"`), niemals durch Umbenennen.

Wichtige Entscheidungspunkte: (a) Die `.mark`-Semantik (blau/gruen/rot) wird
lokal auf DS-Tokens nachgebaut, da das DS nur einen Highlight-Stil (gelb) hat
— siehe Decisions. (b) Die kategoriale ECharts-Palette wird aus HSL-Tints/
-Shades der Markenfarben abgeleitet, weil das DS keine Data-Viz-Palette bietet.
(c) JS spiegelt die Palette-Hex-Werte hart (kein Build-Schritt; ECharts liest
keine CSS-Variablen).
</strategy>

<context>
Issue: @.issues/ye9ih-ui-rebuild-auf-das-gruene-at-design-system/ISSUE.md
Research: @.issues/ye9ih-ui-rebuild-auf-das-gruene-at-design-system/RESEARCH.md
Context: @.issues/ye9ih-ui-rebuild-auf-das-gruene-at-design-system/CONTEXT.md

<interfaces>
<!-- Executor: diese Kontrakte direkt verwenden. Codebasis NICHT erkunden. -->

=== Gruene-AT-DS — verifizierte Tokens (design-system.css, HIGH) ===
Farben:
  --gat-color-dunkelgruen: #257639;  --gat-color-hellgruen: #56af31;
  --gat-color-gelb: #ffed00;         --gat-color-magenta: #e6007e;
  --gat-color-weiss: #ffffff;        --gat-color-anthrazit: #1d1d1b;
Semantische Aliase:
  --gat-color-primary = dunkelgruen   --gat-color-secondary = hellgruen
  --gat-color-accent = magenta        --gat-color-highlight = gelb
  --gat-color-text = anthrazit        --gat-color-surface = weiss
  --gat-color-on-primary = weiss      --gat-color-on-secondary = anthrazit
Schrift:
  --gat-font-headline / --gat-font-copy = 'Barlow Semi Condensed', sans-serif
  --gat-font-emphasis = 'Vollkorn', serif
Typo-Groessen (Ratio 1.25):
  --gat-text-h1: 2.441rem  --gat-text-h2: 1.953rem  --gat-text-h3: 1.563rem
  --gat-text-subline: 1.25rem  --gat-text-copy: 1rem  --gat-text-small: 0.8rem
  --gat-leading-headline: 0.9   --gat-leading-copy: 1.3
Abstaende: --gat-space-1..6 = 0.25 / 0.5 / 1 / 1.5 / 2 / 3 rem
Masse: --gat-radius-sm: 0.25rem  --gat-radius-md: 0.5rem
  --gat-border-width: 2px  --gat-container-max: 72rem
  --gat-breakpoint-sm: 36rem  --gat-breakpoint-md: 48rem
Das DS importiert die Fonts selbst per @import (Barlow Semi Condensed +
Vollkorn) — die App braucht KEINE eigenen Font-Links.
Das DS hat KEINEN Reset, KEINE body/h*-Basisstile, KEINE Chart-Palette,
KEINE neutrale Grauskala.

=== Gruene-AT-DS — Komponentenklassen + Pflicht-Markup (HIGH) ===
Layout:
  .gat-container    // max-width 72rem, zentriert, padding-inline space-4
  .gat-grid         // auto-fit minmax(min(100%,16rem),1fr), gap space-4
  .gat-grid--2 / --3  // 2 bzw. 3 feste Spalten; <36rem -> 1 Spalte
  .gat-section      // padding-block space-6
Header — Pflichtstruktur:
  <header class="gat-header">
    <div class="gat-header__inner">
      <a class="gat-header__logo"><span class="gat-header__logo-mark"></span></a>
      <nav class="gat-nav">
        <a class="gat-nav__link gat-nav__link--active">..</a>
      </nav>
    </div></header>
  .gat-header -> bg primary (dunkelgruen), color on-primary (weiss)
  .gat-header__logo-mark nutzt mask url('assets/gruene-logo.svg') RELATIV zur
    DS-CSS — auf grueneat.github.io aufloesbar, KEIN lokales Asset noetig.
Buttons:  <button class="gat-btn gat-btn--primary"> / gat-btn--secondary
  primary: bg primary + weiss; secondary: transparent + dunkelgruener Rand
Cards:    <div class="gat-card gat-card--primary|--secondary">
            <div class="gat-card__title">..</div>
            <div class="gat-card__body">..</div></div>
  --primary: bg dunkelgruen / weiss; --secondary: bg hellgruen / anthrazit
Typografie-Klassen: .gat-headline (h1, 900)  .gat-subline (600, 1.25rem)
  .gat-fliesstext (400 copy)  .gat-emphasis (Vollkorn italic 900)
CD-Elemente:
  .gat-underline   // border-bottom 2px magenta
  .gat-highlight   // bg gelb, text anthrazit — EINZIGER Highlight-Stil
  .gat-stoerer / --gelb / --magenta   // gedrehtes Badge

=== Bestehende App — getestete IDs/Klassen, die ERHALTEN bleiben MUESSEN ===
(sonst brechen e2e-Tests / dashboard.js)
IDs: #boot-banner, #dashboard-inhalt, #dashboard-leer, #c_sankey,
  #c_wasserfall, #doc-tbody, #doc-manager, #file-input, #sankey-hinweis,
  #sankey-reset, #build-stamp, #st-netto, #drill-list, #drill-crumbs,
  #drill-sum, #mj-overlay, #such-* , #f-* , #mj-*
Klassen (Vertrag — NICHT umbenennen, NICHT entfernen):
  .tab-btn[data-tab="..."], .tab-panel[data-panel="..."], is-active,
  .switch-btn (+ is-active), span.doc-status.ok mit Text "5/5 Pruefungen",
  .arrow .sortable .row-pick .drill-row .chev .label .code .betrag .sep,
  is-green/is-red (auf #st-netto), is-open (#mj-overlay),
  is-visible (#sankey-hinweis), .open (#doc-manager)
window.__appBereit / window.__sankeyDrill muessen gesetzt bleiben.

=== ECharts INK-Palette — heute identisch in beiden Dateien ===
dashboard-charts.js:10-17
  const INK = { red:"#8E2F2A", blue:"#1F4A6D", orange:"#9A4A1C",
                green:"#2F6149", soft:"#5b5650", paper:"#F4EFE6" }
sankey-drill.js:23-29 (ohne `paper`)
  const INK = { red:"#8E2F2A", blue:"#1F4A6D", orange:"#9A4A1C",
                green:"#2F6149", soft:"#5b5650" }
dashboard-charts.js:449-460 — 10-stufige MEHRJAHR_PALETTE
  [INK.blue, INK.orange, INK.green, INK.red, INK.soft,
   "#b7ad99", "#3d6f8e", "#bf6a3a", "#4a8068", "#a85852"]
dashboard-charts.js:156-163 — chartAufwandart-palette {Personal:INK.blue,
  Sachaufwand:INK.orange, Transfers:INK.red, Finanz:INK.soft,
  Sonstige:"#b7ad99"}
chartTreemap color:235 — [INK.orange, INK.blue, INK.green, INK.red, INK.soft]
sankey-drill.js QUELLE_GRUEN:47 — Set{"Kommunalsteuer","Ertragsanteile (Bund)"}
  -> INK.green; sonstige Quellen -> INK.blue (quelleFarbe():49-51)
Diagramm-Achsen/-Text (dashboard-charts.js:19-49): Hardcodes #2b2825, #5b5650,
  #cdc4b4, #e6dfd0; fontFamily "Inter, sans-serif" (~20 Fundstellen ueber
  dashboard-charts.js + sankey-drill.js).

=== INK-Schluessel-Semantik (bleibt erhalten — nur Werte aendern sich) ===
green = positiv/Ertraege   blue = neutral/Personal   red = Aufwand/Risiko
orange = Sachaufwand       soft = neutral-grau       paper = Diagramm-Flaeche
</interfaces>

<call_sites>
Gegrept: Stylesheet-Link `flomotlik`, `design-system.css`, INK-Palette,
`MEHRJAHR_PALETTE`, die Komponenten-Klassen.
Oberflaechen gegrept: web/ (HTML/CSS/JS), web/vendor/, .github/workflows/.

Befund:
- web/index.html:9 — flomotlik-Stylesheet-`<link>` — IN SCOPE (Task 1).
- web/css/app.css:2 — Kommentar "Erweitert das flomotlik Design System" —
  IN SCOPE (Task 2).
- web/vendor/dashboard/dashboard.css:1 — `--hair`/`--raised` mit
  flomotlik-Fallback — IN SCOPE (Task 4).
- web/vendor/LIZENZEN.md:29 — flomotlik-Erwaehnung — IN SCOPE (Task 6).
- web/index.html:18 — Kommentar verweist auf nicht mehr existierende
  `_chart_div()` aus `html.py` — IN SCOPE (Task 2, Inline-Style-Bereinigung).
- INK-Palette: NUR web/js/dashboard-charts.js und web/js/sankey-drill.js —
  IN SCOPE (Task 5). Keine Python-Spiegelung (RESEARCH bestaetigt: `html.py`
  existiert nicht).
- .github/workflows/ — kein DS-/Palette-/Stylesheet-Bezug — OUT OF SCOPE
  (CI ruft nur Tests; keine UI-Invocation).
Keine weiteren Call-Sites gefunden.
</call_sites>

Key files:
@web/index.html — Markup, Stylesheet-Links, Inline-`<style>`; voller Umbau.
@web/css/app.css — Upload-/Dokumentverwaltungs-CSS; wird zum DS-Adapter.
@web/vendor/dashboard/dashboard.css — Dashboard-CSS; auf DS-Tokens.
@web/js/dashboard-charts.js — ECharts-Optionen; INK + MEHRJAHR_PALETTE.
@web/js/sankey-drill.js — Sankey-Drill-down; zweite INK-Palette.
@web/vendor/dashboard/dashboard.js — liest Klassen, wird NICHT editiert.
</context>

<commit_format>
Format: `{id}: {message}` (aus `.issues/config.yaml`), ohne Werkzeug-Attribution.
Beispiel: `ye9ih: app.css zum Gruene-AT-DS-Adapter ausbauen`
Pattern: `ye9ih: {praegnante deutsche Beschreibung der Aenderung}`
Keine `claude`-/`Generated with`-/`Co-Authored-By`-Zeilen.
</commit_format>

<tasks>

<task type="auto">
  <name>Task 1: Gruene-AT-DS-Link einsetzen, Token-Schicht in app.css anlegen</name>
  <files>web/index.html, web/css/app.css</files>
  <action>
  Fundament-Task: den DS-Link AKTIVIEREN und die Token-Adapterschicht vorbereiten
  — der flomotlik-Link bleibt in dieser Task noch erhalten (er wird erst in
  Task 2 entfernt, nachdem alle Ersatzstile stehen, damit die Seite nie kaputt
  ist).

  In `web/index.html`:
  - Nach Zeile 9 (dem flomotlik-`<link>`) eine neue Zeile einfuegen:
    `<link rel="stylesheet" href="https://grueneat.github.io/design-system/design-system.css">`.
    Beide Links bleiben vorerst parallel. Die `preconnect`-Zeilen 7-8 bleiben
    unveraendert (das Gruene-AT-DS importiert Fonts ebenfalls von Google).
  - Ladereihenfolge sicherstellen: DS-CSS-`<link>` MUSS vor
    `./vendor/dashboard/dashboard.css` (Z.11) und `./css/app.css` (Z.12)
    stehen, damit `dashboard.css`/`app.css` die `--gat-*`-Tokens nutzen und
    gezielt ueberschreiben koennen. KEINE eigenen Font-`<link rel=stylesheet>`
    hinzufuegen — Anti-Pattern (doppelter Font-Import).

  In `web/css/app.css`:
  - Den Kopfkommentar (Z.1-3) umschreiben: nicht mehr "Erweitert das flomotlik
    Design System", sondern beschreiben, dass app.css auf den `--gat-*`-Tokens
    des Gruene-AT-DS aufbaut. Keine Werkzeug-Attribution.
  - Den `:root`-Block (Z.5-13) ersetzen durch eine reine DS-Adapter-Schicht.
    Das DS hat KEINE neutrale Grauskala — diese aus den Tokens ableiten.
    Neue Variablen, alle aus `--gat-*` abgeleitet:
      --app-hair: Linienfarbe — ein heller Grauton, z.B.
        color-mix(in srgb, var(--gat-color-anthrazit) 18%, white);
      --app-raised: leicht erhabene Flaeche — z.B.
        color-mix(in srgb, var(--gat-color-anthrazit) 4%, white);
      --app-soft: gedaempfter Text — z.B.
        color-mix(in srgb, var(--gat-color-anthrazit) 55%, white);
    Die bisherigen App-Farbvariablen auf DS-Markenfarben mappen:
      --app-akzent-primaer: var(--gat-color-dunkelgruen);   (ersetzt --ink-blue)
      --app-positiv:        var(--gat-color-dunkelgruen);   (ersetzt --ink-green)
      --app-risiko:         var(--gat-color-magenta);       (ersetzt --ink-red)
      --app-sachaufwand:    color-mix(in srgb, var(--gat-color-magenta) 70%,
                                      var(--gat-color-gelb));  (ersetzt --ink-orange)
    Hinweis: `--app-akzent-primaer` und `--app-positiv` sind bewusst beide
    dunkelgruen — Gruen ist die org-Primaerfarbe; Unterscheidung erfolgt im
    Kontext (Buttons vs. Statusfarben). Wo in spaeteren Tasks zwei gruene Toene
    nebeneinander noetig sind, hellgruen `--gat-color-hellgruen` als zweiten
    Ton nutzen.
  - Diese Task aendert NUR den `:root`-Block und den Kopfkommentar; die
    konkreten Selektoren (`.dropzone`, `.doc-table` …) folgen in Task 2.
    Damit die App in diesem Zwischenstand lauffaehig bleibt: die alten
    Variablennamen (`--hair`, `--raised`, `--soft`, `--ink-*`) als Aliase auf
    die neuen `--app-*`-Variablen im selben `:root`-Block behalten — so brechen
    die noch nicht migrierten Selektoren nicht. Die Aliase werden in Task 2
    entfernt, sobald alle Selektoren migriert sind.

  Funktionale IDs/Klassen NICHT anfassen.
  </action>
  <verify>
  <automated>cd web && python3 -c "import pathlib; h=pathlib.Path('index.html').read_text(); assert 'grueneat.github.io/design-system/design-system.css' in h, 'DS-Link fehlt'; i_ds=h.index('grueneat.github.io/design-system'); i_app=h.index('css/app.css'); i_dash=h.index('vendor/dashboard/dashboard.css'); assert i_ds<i_dash<i_app, 'Ladereihenfolge falsch'; c=pathlib.Path('css/app.css').read_text(); assert '--gat-color' in c, 'app.css nutzt keine DS-Tokens'; print('OK')" && cd .. && npm run test:js</automated>
  </verify>
  <done>
  - `index.html` bindet die Gruene-AT-DS-CSS-URL per `<link>` ein.
  - Ladereihenfolge: DS-CSS vor `dashboard.css` vor `app.css`.
  - `app.css` `:root` definiert `--app-*`-Variablen ausschliesslich aus
    `--gat-*`-Tokens; alte Variablennamen bleiben als Aliase.
  - Kopfkommentar nennt kein flomotlik mehr.
  - `npm run test:js` gruen.
  </done>
</task>

<task type="auto">
  <name>Task 2: app.css auf DS-Tokens migrieren, Basisstile setzen, flomotlik-Link entfernen</name>
  <files>web/css/app.css, web/index.html</files>
  <action>
  Diese Task macht `app.css` vollstaendig DS-konform und entfernt DANN den
  flomotlik-Link — die Reihenfolge ist wichtig: erst Ersatz, dann strippen.

  In `web/css/app.css`:
  - Alle verbliebenen flomotlik-Token-Referenzen und Hardcodes durch die
    `--app-*`/`--gat-*`-Variablen aus Task 1 ersetzen. Konkret betroffen:
    `--hair`-Fallback `#cdc4b4`, `--raised`-Fallback `#faf6ee`, Hardcodes
    `#f1ebdf` (:54), `#eef2f6` (:81), `#173a57` (:103 — Hover dunkler), `#fff`
    (:99), `#e6dfd0` (:135), `#eef3ef`/`#f6eeed` (Status-/Toast-Hintergruende
    :188,193,247,252), `--paper`-Fallback `#f4efe6` (:230). Status-Hintergruende
    als helle Tints der jeweiligen Statusfarbe via `color-mix` ableiten.
  - Basisstile setzen, die das DS NICHT liefert — ans Ende oder an den Anfang
    von app.css einen Block fuer Element-Selektoren:
      body { font-family: var(--gat-font-copy); color: var(--gat-color-text);
             background: var(--gat-color-weiss); line-height: var(--gat-leading-copy);
             margin: 0; font-size: var(--gat-text-copy); }
      h1, h2, h3 { font-family: var(--gat-font-headline); font-weight: 900;
             line-height: 1.15; color: var(--gat-color-text); }
      h1 { font-size: var(--gat-text-h1); }
      h2 { font-size: var(--gat-text-h2); }
      h3 { font-size: var(--gat-text-h3); }
    Hinweis: NICHT `--gat-leading-headline` (0.9) fuer h2/h3 verwenden — zu eng
    fuer mehrzeilige Dashboard-Ueberschriften; 1.15 lokal nutzen (im RESEARCH
    als Conflict notiert).
      table { border-collapse: collapse; }
      input, select { font-family: var(--gat-font-copy); }
    Diese Element-Selektoren ersetzen die mit dem flomotlik-Link verschwindenden
    Basisstile.
  - `.page` (Z.15-17, `max-width: min(2400px,95vw)`) BEHALTEN — das Dashboard
    braucht die Breite; `.gat-container` (72rem) waere zu schmal. Nur ggf.
    `padding-inline` mit `--gat-space-*` ergaenzen.
  - Die in Task 1 eingefuehrten Alias-Variablen (`--hair`, `--raised`, `--soft`,
    `--ink-*`) jetzt aus `:root` ENTFERNEN — alle Selektoren sind migriert.
  - Den Inline-`<style>`-Block aus `index.html:13-26` (`.boot-banner`,
    `.dashboard-leer`, `.dash-chart`) nach `app.css` verschieben und dabei auf
    Tokens umstellen: `.boot-banner` Hintergrund auf `--gat-color-magenta` mit
    weisser Schrift (Magenta traegt weisse Schrift — Kontrast ok; NICHT
    dunkelgruen, da Boot-Fehler als Alarmfarbe erkennbar bleiben sollen),
    Schriftfamilie `--gat-font-copy` statt Inter. `.dash-chart`-Rahmen/-Flaeche
    auf `--app-hair`/`--app-raised`. Den veralteten `html.py`/`_chart_div()`-
    Kommentar dabei entfernen.

  In `web/index.html`:
  - Den flomotlik-`<link>` (urspruenglich Z.9,
    `href="https://flomotlik.github.io/claude-code/design-system.css"`)
    KOMPLETT entfernen.
  - Den Inline-`<style>`-Block (Z.13-26) entfernen — sein Inhalt ist jetzt in
    `app.css`.

  Funktionale IDs/Klassen NICHT anfassen. Markup-Klassenumbau (`.masthead-*`,
  `.stats`, `.callout`, `.mark`, Header) folgt in Task 3.
  </action>
  <verify>
  <automated>cd web && python3 -c "import pathlib; h=pathlib.Path('index.html').read_text(); assert 'flomotlik' not in h, 'flomotlik-Link noch da'; assert '<style>' not in h, 'Inline-style noch da'; c=pathlib.Path('css/app.css').read_text(); assert 'flomotlik' not in c, 'app.css nennt flomotlik'; assert 'body' in c and '--gat-font' in c, 'Basisstile fehlen'; import re; assert not re.search(r'#cdc4b4|#faf6ee|#1f4a6d|#8e2f2a', c, re.I), 'flomotlik-Hardcodes in app.css'; print('OK')" && cd .. && npm run test:js && npm run test:e2e</automated>
  </verify>
  <done>
  - Kein `flomotlik`-Vorkommen mehr in `index.html` oder `app.css`.
  - Kein Inline-`<style>` mehr in `index.html`.
  - `app.css` setzt `body`, `h1..h3`, `table`, `input`, `select` mit DS-Tokens.
  - `.page`-Breite (`min(2400px,95vw)`) erhalten.
  - Keine flomotlik-Hardcode-Hexwerte mehr in `app.css`.
  - `npm run test:js` und `npm run test:e2e` gruen.
  </done>
</task>

<task type="auto">
  <name>Task 3: index.html-Markup auf DS-Komponenten heben (Header, Kennzahlen, Callout, Inline-Marks)</name>
  <files>web/index.html, web/css/app.css</files>
  <action>
  Markup-Umbau gemaess Locked Decision "voll auf DS-Komponenten". Die
  redaktionelle flomotlik-Scaffolding entfaellt.

  Header (`index.html:32-46`): den `<header class="row">`-Block mit
  `.margin`/`.body`/`.kicker`/`.kicker-num`/`.margin-note`/`.masthead-title`/
  `.masthead-sub` ERSETZEN durch die DS-Header-Pflichtstruktur:
    <header class="gat-header">
      <div class="gat-header__inner">
        <a class="gat-header__logo" href="."><span class="gat-header__logo-mark"></span></a>
        <nav class="gat-nav"><span class="gat-nav__link gat-nav__link--active">Gemeindefinanzen</span></nav>
      </div>
    </header>
  Da die App nur eine Seite ist, traegt die `.gat-nav` keinen echten
  Navigationslink — der App-Titel "Gemeindefinanzen" steht als
  `gat-nav__link--active`. Der bisherige Intro-Absatz (`.masthead-sub
  .app-intro`, der VRV-Erklaertext) wird als eigener Absatz UNTER den Header
  gesetzt, mit Klasse `.app-intro` (bleibt) plus `.gat-fliesstext`.
  Den `.gat-headline`-Titel ggf. zusaetzlich sichtbar im Inhaltsbereich
  fuehren, falls der Header allein zu knapp wirkt — Discretion des Executors.

  Ueberblick-Kennzahlen (`index.html:128-137`, `.stats`/`.stat`/`.stat-num`/
  `.stat-label`): als DS-Karten-Raster umsetzen. Den `<div class="stats">`
  durch `<div class="gat-grid gat-grid--3">` ersetzen und jede `.stat` als
  `.gat-card gat-card--secondary` mit `.gat-card__title` (= Wert) und
  `.gat-card__body` (= Label) — oder umgekehrt, je nach Lesbarkeit. WICHTIG:
  Die IDs `st-ertraege`, `st-aufwand`, `st-netto`, `st-komm-anteil` MUESSEN
  erhalten bleiben (e2e + dashboard.js togglen `is-green`/`is-red` auf
  `#st-netto`). Die Klasse `is-orange` auf `#st-komm-anteil` kann entfallen
  (wird nicht getestet); falls Akzentfarbe gewuenscht, eine Karte
  `.gat-card--primary` nutzen. Vier Karten in `gat-grid--3` brechen sauber um.

  Callout Sparpotenzial (`index.html:240-247`, `.callout is-risk`/
  `.callout-label`): das DS hat kein Callout. Als `.gat-card gat-card--primary`
  (dunkelgruen/weiss) nachbauen — eine ruhige, klar abgesetzte Hinweisbox; der
  Label-Text "Wichtige Einordnung" als `.gat-card__title`. ODER lokal eine
  `.callout`-Klasse in `app.css` auf DS-Tokens neu definieren. Executor waehlt;
  `.gat-card--primary` ist vorzuziehen (echte DS-Komponente).

  Inline-Marks (`.mark mark-blue` :124, `.mark mark-green` :156,
  `.mark mark-red` :214,222): siehe Decision unten. Umsetzung: in `app.css`
  drei semantische Klassen `.mark-positiv`, `.mark-neutral`, `.mark-risiko`
  auf DS-Tokens definieren (dezente farbige `border-bottom`/`background`-Tint
  in dunkelgruen / hellgruen / magenta) und im Markup die alten
  `mark mark-blue|green|red` darauf umstellen:
    mark-blue  -> mark-neutral  (Nettoergebnis, neutral)
    mark-green -> mark-positiv  (Kommunalsteuer als Einnahmequelle)
    mark-red   -> mark-risiko   (Pflichtumlage / Transferaufwand)
  Begruendung: das DS hat nur `.gat-highlight` (gelb) — ein einziger Stil
  kann die heutige Dreifach-Semantik nicht abbilden. Die Semantik wird daher
  lokal auf DS-Markenfarben erhalten (siehe Decision).

  Restliche redaktionelle Reste: `.lead`-Absatz (:123) — Klasse `.lead`
  behalten, aber in `app.css` (Task 2 oder hier) als gut lesbarer Vorspann
  auf DS-Tokens definieren; `.footer` (:330-334) — Klasse behalten, in
  `app.css` mit DS-Tokens neu (dezenter Grauton, `--gat-text-small`).
  `.app-intro`/`.masthead-sub`/`.lead`-`max-width: 70rem` bleibt erhalten.

  Alle in `<interfaces>` als ERHALTEN gelisteten IDs/Klassen unangetastet
  lassen — insbesondere `.tab-btn`, `.tab-panel`, `.switch-btn`, `is-active`,
  `span.doc-status.ok`-Markup wird in dieser Task NICHT veraendert.
  </action>
  <verify>
  <automated>cd web && python3 -c "import pathlib; h=pathlib.Path('index.html').read_text(); assert 'gat-header' in h and 'gat-nav' in h, 'DS-Header fehlt'; assert 'kicker' not in h and 'masthead' not in h and 'class=\"row\"' not in h, 'flomotlik-Scaffolding noch da'; assert 'gat-grid' in h, 'DS-Grid fehlt'; [h.index(x) for x in ('st-ertraege','st-aufwand','st-netto','st-komm-anteil','tab-btn','tab-panel','switch-btn','doc-status')]; print('OK')" && cd .. && npm run test:js && npm run test:e2e</automated>
  </verify>
  <done>
  - Header nutzt `.gat-header`/`.gat-header__inner`/`.gat-nav`-Pflichtstruktur.
  - `.kicker*`, `.margin-note`, `.masthead-*`, das `.row`/`.margin`/`.body`-
    Geruest sind aus `index.html` entfernt.
  - Ueberblick-Kennzahlen als `.gat-grid`/`.gat-card`-Raster; IDs `st-*`
    erhalten.
  - Sparpotenzial-Hinweis als `.gat-card--primary` (oder DS-Token-Callout).
  - `.mark mark-*` auf semantische `.mark-positiv/-neutral/-risiko` umgestellt,
    in `app.css` auf DS-Markenfarben definiert.
  - Alle getesteten IDs/Klassen unveraendert; `test:js` + `test:e2e` gruen.
  </done>
</task>

<task type="auto">
  <name>Task 4: dashboard.css auf DS-Tokens umstellen, Tabs/Buttons als DS-Komponenten</name>
  <files>web/vendor/dashboard/dashboard.css, web/index.html</files>
  <action>
  `web/vendor/dashboard/dashboard.css` ist hauseigenes CSS (KEINE externe
  Vendor-Bibliothek) und wird auf DS-Tokens umgestellt. `dashboard.js` im selben
  Ordner wird NICHT angefasst.

  In `web/vendor/dashboard/dashboard.css`:
  - `:root`-Zeile 1 (`--hair`/`--raised` mit flomotlik-Fallback) ersetzen — auf
    die `--app-*`/`--gat-*`-Tokens umstellen oder die `--app-*`-Variablen aus
    `app.css` nutzen (app.css laedt vor dashboard.css? NEIN — Ladereihenfolge
    ist DS-CSS, dann dashboard.css, dann app.css). Daher: die `:root`-Variablen
    in dashboard.css direkt aus `--gat-*`-Tokens ableiten (gleiche Formeln wie
    `--app-hair`/`--app-raised` in app.css), NICHT auf `--app-*` referenzieren,
    da app.css spaeter laedt.
  - `.page` (Z.6, `max-width: min(2400px,95vw)`) BEHALTEN.
  - Alle hartkodierten flomotlik-Tinten ersetzen:
    `#1F4A6D` (Switcher/Mehrjahr-Primaer-Hintergrund :23,51,73,97) ->
      `var(--gat-color-dunkelgruen)`; zugehoeriger weisser Text bleibt weiss
      (dunkelgruen traegt weisse Schrift — Kontrastregel erfuellt). Beachte:
      heutiger Text auf `#1F4A6D` ist `#F4EFE6` (Papier) — auf
      `var(--gat-color-weiss)` umstellen.
    `#2b2825`/`#5b5650`/`#9a8f78` (Text/Grau) -> `var(--gat-color-text)` bzw.
      abgeleitete Grautoene.
    `#e6dfd0` (Tabellen-Trennlinien) -> die abgeleitete Hair-Variable.
    `rgba(31,74,109,0.06)` (Zeilen-Hover) -> dezenter dunkelgruener Tint, z.B.
      `color-mix(in srgb, var(--gat-color-dunkelgruen) 7%, transparent)`.
    `#9a4a1c` (`.table-hint`/`.mj-empty`) -> der Sachaufwand-Ton bzw. ein
      gedaempfter Hinweiston aus DS-Tokens.
    `var(--paper,#F4EFE6)` (:11,116 Hintergruende) -> `var(--gat-color-weiss)`
      oder die Raised-Variable.
  - `.dash-grid`-Umbruch (Z.39, `@media (max-width: 860px)`): auf einen
    DS-Breakpoint legen — `48rem` (`--gat-breakpoint-md`) verwenden, damit das
    Akzeptanzkriterium "DS-Breakpoints 36rem/48rem" erfuellt ist.
  - `.tab-btn.is-active`, `.switch-btn.is-active`, `.mj-btn.is-primary` nutzen
    heute `#1F4A6D` — auf `--gat-color-dunkelgruen`/`--gat-color-weiss` heben.

  In `web/index.html`:
  - An den sieben `.tab-btn`-Buttons (Z.112-118) zusaetzlich die DS-Klasse
    `gat-btn` fuehren: `class="gat-btn tab-btn"`. `.tab-btn` und `data-tab`
    bleiben unveraendert (Vertrag). Das gibt den Tabs DS-Button-Optik, ohne
    Klassen umzubenennen.
  - Analog die statischen Buttons mit `gat-btn`/`gat-btn--secondary`
    ausstatten, wo sie nicht funktional-getestet sind: `#sankey-reset`
    (`.sankey-reset`), `#mj-selected`/`#mj-group` (`.mj-btn`), `#doc-clear-all`
    (`.doc-clear-btn`), `#pick-btn` (`.dropzone-btn`). Beide Klassen am Element
    fuehren — z.B. `class="gat-btn gat-btn--secondary sankey-reset"`. Die
    funktionalen Klassen NIEMALS entfernen.
  - `.switch-btn` wird dynamisch von `dashboard-app.js` erzeugt — NICHT im
    Markup vorhanden; dort nichts zu tun (Styling kommt aus dashboard.css).
  Hinweis: Wo `gat-btn` und eine Custom-Button-Klasse kollidieren (z.B.
  Polsterung), in `app.css`/`dashboard.css` die Custom-Klasse gezielt
  nachjustieren — DS-Komponente gewinnt optisch, funktionale Klasse bleibt.
  </action>
  <verify>
  <automated>cd web && python3 -c "import pathlib,re; d=pathlib.Path('vendor/dashboard/dashboard.css').read_text(); assert not re.search(r'#1f4a6d|#9a4a1c|#f4efe6|#2b2825', d, re.I), 'flomotlik-Hardcodes in dashboard.css'; assert '--gat-' in d, 'dashboard.css nutzt keine DS-Tokens'; assert '48rem' in d or '--gat-breakpoint' in d, 'DS-Breakpoint fehlt'; h=pathlib.Path('index.html').read_text(); assert 'gat-btn tab-btn' in h or 'tab-btn gat-btn' in h or re.search(r'class=\"gat-btn[^\"]*tab-btn', h), 'tab-btn ohne gat-btn'; print('OK')" && cd .. && npm run test:js && npm run test:e2e</automated>
  </verify>
  <done>
  - `dashboard.css` enthaelt keine flomotlik-Hardcodes mehr, leitet `:root`
    aus `--gat-*`-Tokens ab; `.page`-Breite erhalten.
  - `.dash-grid`-Umbruch auf DS-Breakpoint 48rem.
  - `.tab-btn`-Buttons tragen zusaetzlich `gat-btn`; `data-tab`/`.tab-btn`/
    `is-active` unveraendert.
  - Statische Buttons (sankey-reset, mj-*, doc-clear, pick) tragen `gat-btn`;
    funktionale Klassen erhalten.
  - `npm run test:js` + `npm run test:e2e` gruen.
  </done>
</task>

<task type="auto">
  <name>Task 5: ECharts-Palette aus Gruene-Markenfarben ableiten</name>
  <files>web/js/dashboard-charts.js, web/js/sankey-drill.js</files>
  <action>
  Die ECharts-Palette wird aus den Gruene-Markenfarben abgeleitet. ECharts liest
  KEINE CSS-Variablen — die Hex-Werte werden in JS hart gespiegelt, mit einem
  Quellenkommentar, der die Herkunft (DS-Markenfarben + abgeleitete Tints)
  dokumentiert. Kein Build-Schritt, keine `getComputedStyle`-Aufloesung noetig.

  Palette ableiten (Methode: HSL-Tints/-Shades der 4 Markenfarben, benachbarte
  Stufen kontrastieren in Helligkeit ODER Farbton; gelb NICHT als Serienfarbe).
  Basis-Markenfarben: dunkelgruen #257639, hellgruen #56af31, magenta #e6007e,
  anthrazit #1d1d1b. Eine 10-stufige kategoriale Palette bilden, je Markenfarbe
  einen helleren Tint und/oder dunkleren Shade (HSL-Lightness ca. +/-12-18 %),
  Reihenfolge so, dass aufeinanderfolgende Serien maximal kontrastieren.
  Konkreter Vorschlag (Executor darf feinjustieren, muss aber Unterscheidbarkeit
  und Kontrast gegen Weiss wahren):
    1 dunkelgruen   #257639
    2 magenta       #e6007e
    3 hellgruen     #56af31
    4 anthrazit     #1d1d1b
    5 dunkelgruen-tint   #3f9457  (heller)
    6 magenta-shade      #a8005c  (dunkler)
    7 hellgruen-shade    #3c8a22  (dunkler)
    8 anthrazit-tint     #5a5a57  (heller, neutral-grau)
    9 magenta-tint       #f25aa8  (heller)
    10 dunkelgruen-shade #18532a  (dunkler)

  INK-Schluessel neu belegen (Schluesselnamen BEIBEHALTEN — der restliche Code
  referenziert `INK.red`/`INK.blue` etc.; nur die Werte aendern sich; siehe
  INK-Semantik in <interfaces>):
    red    -> #e6007e   (Aufwand/Risiko = magenta)
    blue   -> #3c8a22   (neutral/Personal = ein zweiter Gruenton, dunkler
                         hellgruen — deutlich vom dunkelgruenen `green` zu
                         unterscheiden)
    orange -> #a8005c   (Sachaufwand = magenta-Shade, waermer; gut von `red`
                         magenta unterscheidbar)
    green  -> #257639   (positiv/Ertraege = dunkelgruen)
    soft   -> #5a5a57   (neutral-grau = anthrazit-Tint)
    paper  -> #ffffff   (Diagramm-Flaeche = weiss; nur dashboard-charts.js)
  Falls `orange` (magenta-Shade) und `red` (magenta) im selben Chart zu nah
  wirken (chartAufwandart, chartTrendAufwand: beide Serien nebeneinander), fuer
  `orange` stattdessen einen klar warmen, magenta-fernen Ton waehlen, der
  dennoch aus den Markenfarben ableitbar ist — Executor prueft optisch.

  In `web/js/dashboard-charts.js`:
  - Den `INK`-Block (Z.10-17) neu belegen; den Kommentar Z.9 ("Die vier Tinten
    des Design Systems") aktualisieren auf "Aus den Gruene-AT-Markenfarben
    abgeleitete Palette; Quelle: Markenfarben des Gruene-AT-DS".
  - `MEHRJAHR_PALETTE` (Z.449-460) durch die 10-stufige Palette oben ersetzen.
  - `chartAufwandart`-`palette` (Z.157-163): die `Sonstige`-Farbe `#b7ad99`
    durch eine abgeleitete Stufe ersetzen (z.B. Palette-Stufe 8 `#5a5a57`).
  - `baseText`/`catAxis`/`valAxis` (Z.19-49): `fontFamily: "Inter, sans-serif"`
    durchgaengig auf `"Barlow Semi Condensed, sans-serif"` aendern (Diagramm-
    Parität zur Seitenschrift). Die Achsen-/Grid-Hardcodes `#2b2825`, `#5b5650`,
    `#cdc4b4`, `#e6dfd0` durch passende abgeleitete Grautoene ersetzen (anthrazit
    fuer Text, hellere Toene fuer Linien) — als JS-Hex-Konstanten, da ECharts
    keine CSS-Variablen liest.
  - Treemap `colorSaturation` (RESEARCH: `[0.32,0.62]`) belassen oder leicht
    anpassen, falls Kinder-Kacheln auf den neuen Farben kontrastschwach werden.

  In `web/js/sankey-drill.js`:
  - Den `INK`-Block (Z.23-29) identisch zu dashboard-charts.js neu belegen
    (ohne `paper`); den Kommentar Z.21-22 entsprechend aktualisieren.
  - Falls die Datei ebenfalls `fontFamily: "Inter..."` setzt: auf
    `"Barlow Semi Condensed, sans-serif"` umstellen.
  - `QUELLE_GRUEN`/`quelleFarbe()` (Z.47-51) unveraendert lassen — die Logik
    nutzt `INK.green`/`INK.blue`, die jetzt automatisch die neuen Werte tragen.

  Kontrastregel beachten: ECharts-Labels AUF farbigen Sankey-Knoten/Treemap-
  Kacheln muessen lesbar sein — auf dunklen Stufen (dunkelgruen, magenta,
  anthrazit, deren Shades) weisse Labels, auf hellen Stufen (Tints) anthrazit.
  Gelb wird NICHT als Serienfarbe verwendet. Keine exportierte Funktionssignatur
  aendern (sonst brechen die JS-Unit-Tests).
  </action>
  <verify>
  <automated>cd web && python3 -c "import pathlib,re; a=pathlib.Path('js/dashboard-charts.js').read_text(); s=pathlib.Path('js/sankey-drill.js').read_text(); assert '#8E2F2A' not in a and '#1F4A6D' not in a, 'alte INK-Werte in dashboard-charts.js'; assert '#8E2F2A' not in s and '#1F4A6D' not in s, 'alte INK-Werte in sankey-drill.js'; assert 'Inter' not in a and 'Inter' not in s, 'Inter-Font noch referenziert'; assert '#e6007e' in a.lower() and '#257639' in a.lower(), 'Markenfarben fehlen'; print('OK')" && cd .. && npm run test:js && npm run test:e2e</automated>
  </verify>
  <done>
  - Beide `INK`-Objekte tragen aus Markenfarben abgeleitete Werte; Schluessel-
    namen unveraendert.
  - `MEHRJAHR_PALETTE` ist eine 10-stufige, unterscheidbare Markenfarben-Palette.
  - `chartAufwandart`-`palette` ohne flomotlik-Hardcode `#b7ad99`.
  - Kein `Inter`-`fontFamily` mehr in beiden Dateien; Achsen-Hardcodes ersetzt.
  - Keine exportierte Signatur geaendert; `test:js` + `test:e2e` gruen.
  </done>
</task>

<task type="auto">
  <name>Task 6: Lizenzhinweis aktualisieren, Gesamtabnahme</name>
  <files>web/vendor/LIZENZEN.md</files>
  <action>
  In `web/vendor/LIZENZEN.md` (Zeile ~29) den flomotlik-Design-System-Eintrag
  durch den Gruene-AT-DS-Eintrag ersetzen: Name "Gruene-AT-Design-System",
  Quelle `https://grueneat.github.io/design-system/`, Lizenz "CC BY 4.0",
  Urheber "Die Gruenen". Format und Stil der bestehenden Eintraege uebernehmen.
  Falls der flomotlik-Eintrag andere benachbarte Eintraege beeinflusst (z.B.
  Sortierung), Konsistenz wahren. Keine Werkzeug-Attribution.

  Anschliessend Gesamtabnahme: alle Akzeptanzkriterien des Issues gegen den
  Stand pruefen — DS-CSS per Link eingebunden, flomotlik entfernt, Typografie/
  Farben/Komponenten DS-konform, Kontrastregel eingehalten, Diagramm-Palette
  abgeleitet, alle Funktionen lauffaehig, Responsivverhalten an DS-Breakpoints.
  </action>
  <verify>
  <automated>cd web && python3 -c "import pathlib; l=pathlib.Path('vendor/LIZENZEN.md').read_text(); assert 'flomotlik' not in l, 'LIZENZEN.md nennt flomotlik'; assert 'grueneat.github.io' in l, 'Gruene-AT-DS fehlt in LIZENZEN.md'; print('OK')" && cd .. && npm run test:js && npm run test:e2e && PYTHONPATH=src pytest -q && ruff check src tests && mypy src</automated>
  </verify>
  <done>
  - `web/vendor/LIZENZEN.md` nennt das Gruene-AT-DS (CC BY 4.0, "Die Gruenen"),
    kein flomotlik mehr.
  - `npm run test:js` und `npm run test:e2e` gruen.
  - `PYTHONPATH=src pytest -q`, `ruff check src tests`, `mypy src` gruen
    (Regressionsschranke — Python wurde nicht angefasst).
  </done>
</task>

</tasks>

<verification>
Nach allen Tasks die Gesamtschranke laufen lassen:
- `npm run test:js` — JS-Unit-Tests (Parser/Validator/Dashboard-Daten).
- `npm run test:e2e` — Playwright-e2e-Suite (smoke, dashboard, sankey, upload,
  persistence, build-stamp).
- `PYTHONPATH=src pytest -q` — Python-Regression (unveraendert, muss gruen sein).
- `ruff check src tests` — Python-Linter (Regression).
- `mypy src` — Python-Typecheck (Regression).
Manuelle Sichtpruefung empfohlen (nicht automatisierbar): Seite im Browser
oeffnen, DS-Typografie (Barlow Semi Condensed) und Farben pruefen, ein PDF
hochladen, durch alle Tabs klicken, Sankey-Drill-down und Mehrjahres-Vergleich
ausloesen — Kontrastregel und Diagramm-Lesbarkeit visuell bestaetigen.
</verification>

<success_criteria>
Messbare Kriterien (1:1 zu den Akzeptanzkriterien aus ISSUE.md):
- `index.html` bindet `https://grueneat.github.io/design-system/design-system.css`
  per `<link>` ein; der flomotlik-Stylesheet-Link ist entfernt.
- Farben, Typografie (Barlow Semi Condensed / Vollkorn ueber den DS-`@import`)
  und Ueberschriften-Skala der gesamten Seite folgen dem Gruene-AT-DS-Tokens.
- Buttons (`gat-btn`), Karten (`gat-card`), Header/Navigation (`gat-header`/
  `gat-nav`) und Inline-Marks nutzen DS-Komponenten bzw. -Tokens.
- Die ECharts-Diagramme nutzen eine aus den Gruene-Markenfarben abgeleitete
  10-stufige kategoriale Palette; Serien bleiben unterscheidbar.
- DS-Kontrastregel eingehalten: weisse Schrift nur auf Dunkelgruen, Anthrazit
  auf Hellgruen/Gelb — auch in ECharts-Labels.
- Upload, Parsing, Dashboard-Tabs, Dokument-Umschalter, Suche/Filter, Sankey-
  und Ausgaben-Drill-down sowie Mehrjahres-Vergleich unveraendert lauffaehig
  (durch die e2e-Suite belegt).
- Responsives Verhalten an den DS-Breakpoints 36rem / 48rem.
- Alle Tests gruen: `npm run test:js`, Playwright-e2e, `pytest -q`, `ruff`,
  `mypy`.
</success_criteria>
