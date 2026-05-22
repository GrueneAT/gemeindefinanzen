# Web-Design-System — Gemeindefinanzen

Arbeitsdokument fuer die Web-Adaption des Gruene-AT-Design-Systems. Es haelt
die Design-Entscheidungen fest, die in der Browser-App (`web/`) erprobt werden,
**damit sie spaeter ins org-weite Design-System (`grueneat/design-system`)
zurueckfliessen koennen.**

Leitsatz: Das Gruene-AT-DS ist heute stark druck-/plakatgepraegt — vollgesaettigte
Marken­farben auf Weiss. Fuer eine Datenanwendung, in der lange gelesen und
verglichen wird, ist das anstrengend. Diese App ist das Labor: Wir entsaettigen,
geben der Flaeche einen ruhigen Grundton und bauen echte Web-Komponenten. Das
Ergebnis soll **klar als gruene Anwendung erkennbar**, aber **angenehm und gut
lesbar** sein. Das DS darf dafuer erweitert und angepasst werden — die
Markenfarben sind Ausgangspunkt, nicht Fessel.

## Designziele

1. **Ruhiger Grund statt hartem Weiss.** Ein warmer, leicht gruenstichiger
   Hintergrund; Inhalt sitzt auf hellen Karten mit weichem Schatten.
2. **Entsaettigte Palette.** Markenfarben bleiben als Identitaet erkennbar,
   werden aber fuer Flaechen und Diagramme deutlich entsaettigt. Kein
   vollgesaettigtes Magenta, kein knalliges Hellgruen als Grossflaeche.
3. **Zentriertes, ruhiges Layout.** Begrenzte Lesebreite, grosszuegige
   Raender, klare vertikale Rhythmik.
4. **Echte Web-Komponenten.** Kennzahlen-Karten, Panels, Tableiste,
   Diagramm-Rahmen, Callouts — als wiederverwendbare `.web-*`-Komponenten
   definiert und hier dokumentiert.
5. **Tests bleiben gruen.** Funktionsklassen (`.tab-btn`/`.tab-panel`/
   `is-active`, `.switch-btn`, `span.doc-status.ok`) unveraendert; `web/vendor/
   dashboard/dashboard.js` wird nicht angefasst.

## Farb-Token

Definiert als `--web-*` in `web/css/app.css` (`:root`). Bewusst unabhaengig von
den `--gat-*`-Tokens, damit die Entsaettigung an einer Stelle steuerbar ist.
ECharts liest kein CSS — die Hex-Werte stehen zusaetzlich in den Chart-Modulen.

### Flaeche & Text

| Token | Wert | Einsatz |
| --- | --- | --- |
| `--web-bg` | `#f3f5f0` | App-Hintergrund, weich gruenstichig |
| `--web-surface` | `#ffffff` | Karten, Panels |
| `--web-surface-sunk` | `#f7f9f4` | Diagramm-Inlay, ruhige Zonen |
| `--web-hairline` | `#e1e4db` | Haarlinien, Rahmen |
| `--web-shadow` | `0 1px 2px rgba(31,38,28,.05), 0 4px 14px rgba(31,38,28,.05)` | Karten-Schatten |
| `--web-text` | `#23271f` | Fliesstext, Ueberschriften |
| `--web-text-soft` | `#5e6358` | Sekundaertext, Labels |
| `--web-text-mute` | `#8b8f82` | Hinweise, deaktiviert |

### Gruene Identitaet (entsaettigt)

| Token | Wert | Einsatz |
| --- | --- | --- |
| `--web-green-deep` | `#2c6e40` | Header, Primaerbutton, Schluesselakzent |
| `--web-green` | `#4a8a52` | Mittelgruen, Akzent, positiv |
| `--web-green-tint` | `#e7efe3` | weiche gruene Fuellung (Hero-Karte, Callout) |
| `--web-yellow` | `#ecd64a` | nur als duenner Akzent (Unterstreichung), winzige Flaeche |

### Diagramm-Palette (kategorial, niedrige Saettigung)

Acht harmonische, entsaettigte Toene. Reihenfolge = kategoriale Vergabe.

| # | Token | Wert | semantische Rolle |
| --- | --- | --- | --- |
| 1 | `chart-green` | `#3f7d4f` | Ertraege / positiv |
| 2 | `chart-leaf` | `#6ba368` | zweiter Gruenton / Personal-Alt |
| 3 | `chart-teal` | `#4f93a0` | Personal / neutral-kuehl |
| 4 | `chart-gold` | `#c9a24b` | Sachaufwand |
| 5 | `chart-clay` | `#b9744f` | Aufwand / Risiko (ersetzt Magenta) |
| 6 | `chart-plum` | `#9c5b7d` | Transfers (entsaettigt aus Magenta abgeleitet) |
| 7 | `chart-slate` | `#5d6b8a` | Nettoergebnis / Vergleich |
| 8 | `chart-sage` | `#8a8f7d` | Sonstige / Restgruppe |

Achsen/Gitter: Text `#23271f`, Sekundaertext `#5e6358`, Achslinie `#cdd2c8`,
Gitterlinie `#e7eae2`. Diagramm-Hintergrund = `--web-surface`.

## Komponenten

Als `.web-*` in `web/css/app.css` umgesetzt; bestehende Funktionsklassen
bleiben zusaetzlich am Element stehen.

- **`.web-shell`** — zentrierter Container, `max-width: 1180px`
  (Dashboard-weite Variante `.web-shell--wide`, `1480px`),
  `margin-inline:auto`, Seitenrand `clamp(1rem, 4vw, 2.5rem)`.
- **`.metric-card`** — Kennzahlenkarte: weisse Flaeche, Haarlinie, weicher
  Schatten, farbiger Akzentbalken oben (3px), grosse Zahl (`tabular-nums`),
  kleines Grossbuchstaben-Label. Hero-Variante `.metric-card--hero` mit
  `--web-green-tint`-Fuellung. Raster 4-spaltig -> 2 -> 1.
- **`.web-panel`** — Diagramm-/Inhaltsrahmen: Flaeche, Haarlinie, Schatten,
  Innenabstand; ersetzt `.dash-chart`-Optik.
- **`.web-callout`** — Hinweis-Panel: `--web-green-tint`, gruener Randstreifen
  links, kein vollflaechiges Knallgruen.
- **Tableiste** — ruhige Reiter; aktiver Reiter klar gruen unterlegt/markiert.
- **Buttons** — Primaer: `--web-green-deep`, weisse Schrift. Sekundaer:
  Umriss auf heller Flaeche.

## Kontrast & Lesbarkeit

- Weisse Schrift nur auf `--web-green-deep`.
- Auf `--web-green` / `--web-yellow` immer dunkler Text (`--web-text`).
- Grossflaechen tragen nie eine vollgesaettigte Markenfarbe.
- Fliesstext-Spalten auf ~70rem begrenzen.

## Iterationsprotokoll

Jede Iteration: fokussierter Batch -> visuelle Validierung (Screenshots) ->
Eintrag hier.

### Iteration 0 — Ausgangslage (Befund)

Erste DS-Umsetzung (Issue ye9ih, 6 Commits): pures Weiss, vollgesaettigtes
Magenta + Hellgruen, linksbuendiges Layout ohne zentrierten Container,
Lagebild-Raster 3+1 (4 Karten in `gat-grid--3`), Kennzahlen als geflutete
Knallgruen-Karten. Visuell als „anstrengend zu lesen" bewertet. Der Sankey
(bereits `color-mix`-gedaempft) ist die ruhige Referenz.

### Iteration 1 — Fundament (erledigt)

`--web-*`-Tokenschicht, ruhiger Grundton (`--web-bg`), zentrierter Container
(`.page` 1200px, mittig), Lagebild als 4-spaltiges `.metric-card`-Raster,
Diagrammpalette entsaettigt (8 ruhige Toene, kein Magenta). Visuelle Pruefung:
deutlich ruhiger, Kernprobleme geloest. **Tests gruen.**

Verbleibende Befunde fuer die naechsten Runden:
- Ueberschriften durchgehend Gewicht 900, schwarz, condensed — wirken schreiend.
- Header ist ein hoher, wuchtiger Dunkelgruen-Block; Logo winzig; Wortmarke
  „Gemeindefinanzen" doppelt (Header-Nav + Body-h1).
- Diagramm-Ueberschriften (`h3`) schweben frei ueber den Panels.
- Metric-Card-Akzentbalken alle gruen — keine semantische Unterscheidung.

## Typografie & Rhythmus (ab Iteration 2)

Barlow Semi Condensed (Headline) ist von Natur aus schmal — Gewicht 900
zusaetzlich macht es laut. Ruhigere Skala:

| Ebene | Gewicht | Einsatz |
| --- | --- | --- |
| h1 | 800 | Seitentitel, einmal pro Seite |
| h2 | 700 | Abschnittstitel (Lagebild, Einnahmestruktur …) |
| h3 | 700 | Panel-/Diagrammtitel, kleiner |
| Label/Kicker | 600, uppercase, `letter-spacing` | Metric-Label, Spaltenkopf |

- Klarer vertikaler Rhythmus: `h2` mit grossem Oberabstand, `h3` enger an
  seinen Inhalt gebunden.
- Header: schlank (~64–72px), Logo + Wortmarke als Markenleiste; nicht als
  hoher Farbblock.

### Iteration 2 — Typografie & Header (erledigt)

Ueberschriften von durchgehend Gewicht 900 auf die ruhigere Skala gebracht:
`h1`/`​.gat-headline` -> 800, `h2`/`h3` -> 700, `h3` kleiner (auf
`--gat-text-subline`). Farbe `--web-text` statt Schwarz. Vertikaler Rhythmus
in CSS statt Inline-Hacks: `h2` mit grossem Oberabstand (`--gat-space-6`),
`h3` eng am Inhalt (`--gat-space-5`/`-2`); erste Panel-Ueberschrift und
erste h3 einer Rasterzelle ohne Extra-Oberabstand. Inline-`margin-top`-Hacks
auf `<h3>` und Callout aus `index.html` entfernt.

Header von einem ~115px-Dunkelgruen-Block zu einer schlanken Markenleiste
(~65px) umgebaut: Logo-Mark plus Wortmarke „Gemeindefinanzen" als
Markeneinheit auf `--web-green-deep`, weisse Schrift. Doppelte Wortmarke
aufgeloest — der Header traegt die Marke, die rechte Navi zeigt jetzt
„VRV-2015-Analyse", der Body-`<h1>` lautet „Gemeindebudget auswerten"
(Arbeitstitel der Seite). DS-Klassen (`.gat-header`/`.gat-nav`/
`.gat-header__logo-mark`) bleiben am Element, nur per `.web-brandbar*`
ueberschrieben. **Tests gruen.**

Verbleibende Befunde fuer die naechsten Runden:
- Metric-Card-Akzentbalken alle gruen — keine semantische Unterscheidung.
- Diagramm-Container (`.dash-chart`) noch nicht als `.web-panel` umgesetzt.

### Iteration 3 — Chart-Panels, Sektionsstruktur, Metric-Akzente (erledigt)

Ziel: echte Komponentenstruktur statt frei schwebender Ueberschriften.

- **`.web-panel` als Diagramm-Komponente umgesetzt.** Jedes Diagramm aller
  Tabs sitzt jetzt mit seiner `h3`-Ueberschrift (und ggf. Kurzbeschreibung
  als `.web-panel__note`) in einer Karte: `.web-panel` >
  `.web-panel__head` > `.web-panel__body`. Der Kopf traegt eine subtile
  untere Haarlinie, die Sankey-Drill-down-Leiste sitzt im Panel-Kopf. Die
  frei stehenden `<h3>` ueber `.dash-chart`-Containern entfallen.
  `.dash-chart` ist auf einen reinen, rahmenlosen Container reduziert (nur
  `margin: 0`) — kein doppelter Rahmen/Schatten mehr. Panels in der
  2-spaltigen `.dash-grid` fuellen ihre Rasterzelle gleich hoch aus.
  Chart-`id`s und Inline-Hoehen unveraendert (Dashboard-JS).
- **`.metric-card`-Akzente semantisch.** Modifier je Kennzahl: Ertraege
  gruen (`.metric-card--ertrag`, `--web-chart-green`), Aufwendungen Clay
  (`--aufwand`, `--web-chart-clay`), Nettoergebnis Schiefer (`--netto`,
  `--web-chart-slate`), Kommunalsteuer-Anteil bleibt Hero (gruener Tint).
  Der Akzentbalken setzt `--metric-accent`.
- **Sektionskopf `.web-section-head`.** Jeder Tab oeffnet mit `h2`-Titel
  und einleitendem Absatz als ruhige Einheit, klar von der Steuerleiste
  getrennt. Der Intro-Absatz nutzt `--web-text-soft`.

Visuelle Pruefung (Screenshots Ueberblick + Ausgaben): Diagramme als klar
abgegrenzte Karten, keine Karte-in-Karte-Optik, differenzierte
Metric-Akzente, gruppierte Sektionskoepfe. **Tests gruen**
(`npm run test:js`, `npm run test:e2e`).

### Iteration 4 — Bedienelemente & Sekundaerflaechen (erledigt)

Ziel: alle interaktiven Elemente auf eine konsistente, ruhige Komponenten-
sprache bringen — gleiche Radien, gedaempfte Palette, klare aktive/Hover/
Fokus-Zustaende.

- **Tableiste** (`.tabs`/`.tab-btn`) — flache, ruhige Reiter; aktiver Reiter
  klar gruen markiert (weisse Flaeche, gruene Unterkante als `inset`-Schatten,
  Gewicht 700, `--web-green-deep`-Schrift). Tastatur-Fokus als sichtbarer
  Ring.
- **Dokument-Umschalter** (`.switcher`/`.switch-btn`) — ruhige Segmente auf
  heller Flaeche, aktives Segment gruen gefuellt, Hover als gruener Tint.
- **Tabellen** (`.dtable`) — leichte, sticky Kopfzeile mit Grossbuchstaben-
  Label und kraeftigerer Unterlinie; sanfter Zeilen-Hover; `.sortable` mit
  Fokuszustand.
- **Filterleiste & Suche** (`.filterbar` Inputs/Selects, `input.search`) —
  einheitliche Feldoptik, Kontrollradius, Hover- und Fokusring
  (`--web-focus-ring`).
- **Mehrjahres-Overlay** (`.mj-overlay`/`.mj-dialog`/`.mj-chart`/`.mj-close`)
  — Dialog als Karte (`--web-radius-card`), ruhig abgedunkelter Hintergrund,
  weicher Schatten; Schliessen-Knopf mit Hover- und Fokuszustand.
- **Buttons** (`.mj-btn`, `.mj-drill`) — Sekundaer als Umriss auf heller
  Flaeche, Primaer gruen gefuellt; einheitliche Radien, deaktivierte
  Zustaende und sichtbarer Fokus.
- **Breadcrumbs & Drill-Liste** (`.crumbs`/`.drill-row`) — auf die
  `--web-*`-Tokenschicht umgestellt; Breadcrumb-Knoepfe mit Fokusring.

Alle Bedienelemente von den `--gat-*`-Tokens auf die `--web-*`-Schicht
umgestellt, Funktionsklassen/-IDs unveraendert, `dashboard.js` nicht
angefasst. **Tests gruen** (`npm run test:js` 61/61, `npm run test:e2e`
7/7).

### Iteration 5 — Responsives Verhalten (erledigt)

Ziel: die App nutzt die volle Bandbreite vom Smartphone bis zum breiten
Desktop ordentlich — nicht nur eine zusammengestauchte Druckseite.

Pruefbreiten: ~390px (Smartphone), ~760px (Tablet), ~1440px (Desktop).
Visuelle Pruefung mit Playwright/Chromium, Screenshots Ueberblick- und
Suche-Tab je Breite.

- **Lagebild-Raster** (`.stats`) — 4 -> 2 -> 1 Spalten, jetzt an den
  Design-System-Breakpoints `48rem`/`36rem` ausgerichtet (zuvor eigene
  Werte `60rem`/`34rem`). Bei 1440px vier Spalten, bei 760px zwei, bei
  390px eine.
- **Tableiste** (`.tabs`/`.tab-btn`) — bricht ueber `flex-wrap: wrap`
  bereits sauber in mehrere Zeilen um; bei 390px drei tidy Reihen, der
  aktive Reiter bleibt sichtbar und markiert. Keine Aenderung noetig.
- **`.dash-grid`** — die zweispaltigen Einnahmen-/Ausgaben-Raster fallen
  bei `48rem` auf eine Spalte; Diagramm-Panels bleiben voller Breite und
  lesbar. Bereits aus Iteration 3/4 vorhanden, visuell bestaetigt.
- **Breite Suchtabelle** — die 15-spaltige Tabelle bekommt im
  `.table-scroll` eine Mindestbreite (`56rem`), damit ihre Spalten lesbar
  bleiben statt zusammenzustauchen; reicht der Platz nicht, scrollt der
  Container horizontal. Die Seite selbst bleibt schmal — kein
  horizontaler Seiten-Ueberlauf bei 390/760/1440px.
- **Dokumentliste** — die fuenfspaltige `.doc-table` verursachte
  ausgeklappt bei 390px einen Seiten-Ueberlauf (~474px). Sie sitzt jetzt
  in einem `.doc-table-scroll`-Wrapper mit horizontalem Scroll und einer
  Mindestbreite, die die Spalten lesbar haelt.
- **Header, Steuerleiste, Filterleiste, Dokument-Umschalter,
  Mehrjahres-Overlay** — bei 390px geprueft: Header, Switcher und
  Filterleiste umbrechen sauber, der Overlay-Dialog (`width: min(880px,
  94vw)`) passt in den kleinen Viewport. Seitenraender greifen weiterhin
  ueber `clamp(1rem, 4vw, 2.5rem)`.

Ergebnis: kein horizontaler Seiten-Ueberlauf bei 390/760/1440px, weder
auf dem Ueberblick- noch auf dem Suche-Tab, auch nicht bei ausgeklappter
Dokumentverwaltung. Breite Tabellen scrollen intern. **Tests gruen**
(`npm run test:js` 61/61, `npm run test:e2e` 7/7).

### Iteration 6 — Code-Struktur (erledigt)

Die CSS war ueber fuenf Runden organisch gewachsen. Rein strukturelles
Aufraeumen, ohne das gerenderte Ergebnis zu veraendern:

- **`web/css/app.css` in fuenf nummerierte Abschnitte gegliedert**:
  (1) Design-Token, (2) Basis-/Element-Stile, (3) Layout & Container,
  (4) Komponenten (`.metric-card`, `.web-panel`, `.web-section-head`,
  Callout, Markenleiste), (5) Bedienelemente & app-spezifische Flaechen
  (Buttons, Dropzone, Dokumentverwaltung, Fortschritt, Tabellen,
  Sankey-Leiste). Jeder Abschnitt mit knappem Kopfkommentar; verstreute
  Regeln (z. B. `[hidden]`, `.dash-chart`, Toast) zu ihrer Gruppe
  zusammengezogen.
- **Token-Schichten entwirrt.** `--web-*` ist die Quelle. Tote/einmalige
  `--app-*`-Aliase entfernt: `--app-sachaufwand` (nirgends referenziert)
  geloescht, `--app-positiv` und `--app-raised` (je einmal genutzt) auf
  ihre `--web-*`-Quelle inline aufgeloest. Behalten als semantische,
  mehrfach genutzte Aliase: `--app-hair`, `--app-soft`,
  `--app-akzent-primaer`, `--app-risiko`. In `dashboard.css` das nie
  genutzte `--raised` entfernt; `--hair` bleibt.
- **`dashboard.css` analog in sechs Abschnitte geordnet** (Token, Layout,
  Tableiste/Umschalter, Tabellen/Filter, Drill-down, Mehrjahres-Vergleich);
  zusammengehoerende Regeln (`.tab-panel`, `.mj-drill`, `th.pick`) zu ihrer
  Gruppe gezogen. Keine Funktionsklasse umbenannt.
- Radius-/Abstandswerte: bereits konsistent ueber `--web-radius-*` /
  `--gat-space-*` getokenisiert; verbleibende Literale sind echte
  Sonderwerte (Pill-Radius `999px`, 3px-Akzentbalken) ohne passenden Token.

Umfang: `app.css` 718 -> 744 Zeilen, `dashboard.css` 215 -> 252 Zeilen
(reine Zunahme durch Abschnittskommentare; vier Custom-Properties
entfernt). Pixel-Diff der gerenderten Seite (Landing + Ueberblick mit
Fixture-PDF, 1440px) = 0. **Tests gruen** (`npm run test:js` 61/61,
`npm run test:e2e` 7/7).

### Iteration 7 — Feinschliff (erledigt)

Abschliessender Feinschliff — volle Karten-Konsistenz, ruhiges
Diagramm-Innenleben, sauberer vertikaler Rhythmus.

- **Datentabellen in `.web-panel`.** Alle frei stehenden `.dtable`-Bloecke
  sitzen jetzt mit ihrer `h3` in `.web-panel`-Karten: `t-einnahmen`,
  `t-ausgaben`, `t-investitionen`, `t-transfers`, der Ausgaben-Drill-down
  (Brotkrumen, Summenzeile, `drill-list`) sowie die Suche-Tab-Bloecke
  (Filterleiste + Aktionen als Panel „Filter", die Suchtabelle als Panel
  „Detailposten"). Neue Body-Variante `.web-panel__body--table`: der
  Innenabstand entfaellt, damit die `.dtable` mit ihren eigenen
  Zellpolstern bis an die Kante laeuft (kein doppelter Rand); Rand-Zellen
  einer rahmenlosen Tabelle werden auf den Panel-Innenrand ausgerichtet,
  die letzte Zeile traegt keine baumelnde Haarlinie. Alle `#id`s und
  Funktionsklassen (`.dtable`/`.table-scroll`/`.tab-panel` …) unveraendert.
- **Diagramm-Innenleben.** Zwei geteilte Helfer in `dashboard-charts.js`
  (`tip()`, `legende()`): der Tooltip ist jetzt eine helle Karte (weisser
  Grund, `#cdd2c8`-Haarlinie, weicher Schatten, 8px-Radius, `#23271f`-Text,
  Barlow Semi Condensed) statt der dunklen ECharts-Voreinstellung; die
  Legende nutzt den Sekundaertext-Ton `#5e6358`. Konsistent ueber alle
  Builder (Wasserfall, Sankey, Balken, Ring, Treemap, Linien) sowie den
  Drill-down-Sankey in `sankey-drill.js`. Datenpalette und Farbzuordnung
  unveraendert.
- **Landing/Empty-State.** `.doc-manager-body` mit grosszuegigem
  Innenabstand (`--gat-space-3/4`), damit die Abschnitts-`h2` nicht an der
  Kante kleben; die beiden Abschnitte durch Abstand + Haarlinie getrennt.
  Der Empty-State-Hinweis ist eine ruhige, zentrierte Karte (gestrichelte
  Haarlinie, gesenkter Grundton) statt eines lose schwebenden Absatzes.
- **Rhythmus-Durchgang.** Erstes/letztes Element im `.web-panel__body`
  ohne Eigenabstand; `.doc-table-scroll`-Unterabstand auf die
  Sektionspolsterung abgestimmt; Drill-down-Liste am Panel-Ende ohne
  doppelten Abstand.

Visuelle Pruefung mit Playwright/Chromium (1440px, Fixture-PDF
`VA-2026-Auflage.pdf`): Landing plus alle sieben Tabs als Screenshots
geprueft — jeder Tab liest sich als klare Panel-Sequenz, der restilte
Tooltip erscheint beim Hover ueber dem Wasserfall als helle Karte.
**Tests gruen** (`npm run test:js` 61/61, `npm run test:e2e` 7/7).

### Iteration 8 — Barrierefreiheit & Qualitaet (erledigt)

Abschliessende Haertung: Kontrast auf WCAG-AA-Niveau, durchgaengiger
Tastatur-Fokus, reduzierte Bewegung und eine letzte Defektpruefung.

- **Kontrast (WCAG AA).** Alle Token-Paare gemessen (sRGB-Leuchtdichte,
  Schwelle 4.5 fuer Fliesstext, 3.0 fuer Grosstext und den 3px-Akzent-
  balken). Drei Befunde nachgezogen, jeweils kleine Verschiebungen, die
  den ruhigen, entsaettigten Charakter wahren:
  - `--web-text-mute` von `#8b8f82` (3.0–3.3 — durchgefallen) auf
    `#6b6f63` — Hinweise, Sankey-Hinweis, Spaltenpfeile, Drill-Code.
  - Neuer Token `--web-clay-text` `#9c5a38` fuer Risiko-/Fehler-**Text**
    (`#b9744f` aus der Diagrammpalette war als Text mit 3.2–3.7 zu hell):
    Fehl-Pruefstatus, `.doc-remove`, `.doc-clear`, `.progress-error`,
    Fehler-Toast. Die Diagrammfuellung `--web-chart-clay` bleibt unberuehrt.
  - `.doc-clear-btn:hover` (weiss auf Clay) nutzt jetzt `--web-clay-text`
    als Flaeche.

  Gemessene Kontrastwerte nach der Iteration (alle bestehen AA):

  | Paar | Ratio |
  | --- | --- |
  | `--web-text` auf `--web-bg` / `--web-surface` | 13.85 / 15.20 |
  | `--web-text` auf `--web-green-tint` | 12.92 |
  | `--web-text-soft` auf `--web-bg` / `--web-surface` | 5.62 / 6.17 |
  | `--web-text-soft` auf `--web-green-tint` | 5.25 |
  | `--web-text-mute` auf bg / surface / surface-sunk | 4.69 / 5.15 / 4.86 |
  | Weiss auf `--web-green-deep` (Header) | 6.16 |
  | `--web-green-deep` auf `--web-green-tint` (Hero-Label) | 5.23 |
  | Callout: Weiss auf DS-Gruen `#257639` | 5.63 |
  | Metric-Label `--web-text-soft` auf Weiss / Hero-Tint | 6.17 / 5.25 |
  | `--web-clay-text` auf Fehl-Tint / Weiss | 4.67 / 5.34 |
  | Weiss auf `--web-clay-text` (`.doc-clear`-Hover) | 5.34 |

- **Tastatur-Fokus.** Ein gemeinsamer `:focus-visible`-Block in `app.css`
  gibt jedem interaktiven Element dieselbe sichtbare Markierung — 2px-
  Kontur in `--web-green-deep` plus den weichen `--web-focus-ring`:
  Reiter, alle Buttons (`.gat-btn`, Dropzone-Auswahl, `.doc-remove`,
  `.doc-clear`, `.mj-btn`, `.mj-drill`, `.mj-close`, `.sankey-reset`),
  Dokument-Umschalter, Filter-/Suchfelder, Brotkrumen, sortierbare
  Spaltenkoepfe, Auswahl-Checkboxen und die Dokumentverwaltungs-Summary.
  Neuer lokaler Token `--web-focus-offset`: Elemente, die buendig an einer
  Kante sitzen (Reiter, Sortierkoepfe, Summary), setzen ihn negativ, damit
  die Kontur nicht abgeschnitten wird. Der Marken-Link im dunklen Header
  bekommt eine helle Kontur. Verstreute, nur-Kontur-Fokusregeln in
  `dashboard.css` wurden auf den gemeinsamen Block zurueckgefuehrt.
- **`prefers-reduced-motion`.** Neuer Abschnitt 6 in `app.css`: bei
  reduzierter Bewegung werden Transitions/Animationen global auf nahezu
  null gesetzt (Hover-/Fokus-Farbwechsel, Fortschrittsbalken, Dropzone,
  Aufklapp-Pfeil, Tableiste).
- **Overlay-Semantik.** Schliessen per Esc und Klick auf den Hintergrund
  sind bereits in `dashboard.js` geregelt (`setupMehrjahr`) — unveraendert.
  Die fehlende Tastatur-Fokusfuehrung wurde minimal in `app.js`
  (`verdrahteOverlayFokus`) ergaenzt: ein `MutationObserver` auf der
  `is-open`-Klasse setzt den Fokus beim Oeffnen in den Dialog, faengt Tab
  innerhalb des Dialogs (Fokusfalle) und gibt den Fokus beim Schliessen an
  das ausloesende Element zurueck. `dashboard.js` bleibt unangetastet.
- **Visuelle Defektpruefung.** Playwright/Chromium, Fixture-PDF
  `VA-2026-Auflage.pdf`, alle sieben Tabs plus Landing bei 390/760/1440px:
  kein horizontaler Ueberlauf, keine geclippten Texte, keine schiefen
  Panels — die Politur der Iterationen 1–7 bleibt intakt.

**Tests gruen** (`npm run test:js` 61/61, `npm run test:e2e` 7/7).

### Iteration 9 — Review-Findings beheben (erledigt)

Aus dem code-reviewer-Durchgang ueber alle 45 Commits:
- **Wichtig:** `.gat-btn`-`border-radius` in app.css ueberschrieb die
  Folder-Tab-Ecken von `.tab-btn` (gleiche Spezifitaet, app.css laedt
  spaeter). Behoben: `gat-btn` aus dem `.tab-btn`-Markup entfernt —
  `.tab-btn` bringt eigene Flaeche/Rahmen/Radius mit und steht per eigenem
  Namen im Fokus-Block.
- **Klein:** `chartTrendKomm`-`areaStyle` nutzte noch `rgba(47,97,73,…)`
  (Vor-Entsaettigungs-Gruen) — auf `rgba(63,125,79,…)` (= `INK.green`)
  umgestellt.
- **Klein:** `--web-yellow` und `--web-chart-leaf/-teal/-gold/-plum/-sage`
  sind reine Doku-Token (Charts lesen die Hex-Werte direkt im JS) — ein
  Kommentar ueber der Gruppe haelt das nun explizit fest.

**Ergebnis:** Der aktive Reiter rendert wieder als Folder-Tab — berechnetes
`border-radius` `6px 6px 0px 0px`, also runde Oberkante und buendig in die
Panel-Flaeche uebergehende, eckige Unterkante (visuell per Playwright mit
geladenem VA-2026-PDF geprueft).

**Tests gruen** (`npm run test:js` 61/61, `npm run test:e2e` 7/7).

### Iteration 10 — Diagramm-Proportionen & Interaktion (erledigt)

Die Diagramme waren funktional, aber noch sehr ECharts-Default: sehr breite
Balken bei Ein-Dokument-Ansichten, lockere und je Diagramm unterschiedliche
Raender, willkuerlich streuende Panel-Hoehen.

- **Balkenbreite gedeckelt.** Neue gemeinsame Konstante `BAR_MAX = 40` in
  `dashboard-charts.js`; jede Balken-/Saeulenserie traegt jetzt
  `barMaxWidth: 40` (horizontale Balken, Wasserfall — Sockel und sichtbarer
  Teil —, Korridor-Saeulen, Trend-Eckwerte, gestapelter Trend-Aufwand). Bei
  Ein-Dokument-Ansichten mit wenigen Kategorien rendern die Balken nicht mehr
  uebermaessig wuchtig; insbesondere der Wasserfall dominiert das Panel nicht
  mehr.
- **Grid-Raender vereinheitlicht.** Neuer Helfer `grid(extra)` liefert ruhige,
  konsistente Standardraender (`left:10, right:18, top:14, bottom:10,
  containLabel:true`); Diagramme mit Legende oder gedrehten Achsenlabels
  erhoehen nur `bottom`/`top` per `extra`. Alle Builder (Balken, Wasserfall,
  Korridor, Trend-Eckwerte, Trend-Kommunalsteuer, Trend-Aufwand,
  Mehrjahres-Basis) nutzen den Helfer statt eigener Streuwerte.
- **Wasserfall.** Balkenbreite von `55%` auf `45%` plus 40px-Deckel; die
  Stufen wirken ruhiger. Eine duenne, gestrichelte Haarlinie (`markLine`,
  `ACHSE_LINIE`) verbindet die Stufen — Ertraege -> Aufwendungen ->
  Nettoergebnis — und macht den Treppen-Verlauf klar ablesbar.
- **Chart-Hoehen in `index.html` gestrafft.** Zuvor 320/340/360/380/400/520px
  ohne System. Jetzt gepaart und vereinheitlicht: beide Wasserfaelle 340px,
  die Trend-Diagramme `c_trend_eck`/`c_trend_auf` 340px, das Paar
  `c_einnahmen`/`c_trend_komm` 360px, das Paar `c_aufwandart`/`c_treemap`
  340px, das Paar `c_investitionen`/`c_treiber` 360px, der Korridor von 400
  auf 380px gestrafft, der intrinsisch hohe Sankey bleibt 520px. Chart-`#id`s
  und `class="dash-chart"` unveraendert.
- **Interaktion (zurueckhaltend, Reduced-Motion abgedeckt).** Weicher
  Tab-Panel-Wechsel: `.tab-panel.is-active` blendet ueber die Keyframe-
  Animation `tab-panel-ein` (.18s, leichtes Aufblenden + 4px-Versatz) ein —
  `display` laesst sich nicht uebergangen, daher eine Animation. Klare
  Active-Rueckmeldung auf wirklich klickbaren Elementen: `.drill-row.is-
  clickable` bekommt einen kraeftigeren Active-Hintergrund, `.gat-btn` und
  inaktive `.switch-btn` werden beim Klick um 1px eingedrueckt. Metric-Karten
  und Diagramm-Panels (nicht klickbar) bleiben ohne Hover/Active. Der
  bestehende `prefers-reduced-motion`-Block neutralisiert ueber seine
  `animation-duration`-Regel auch `tab-panel-ein`; der Kopfkommentar nennt
  den Panel-Wechsel jetzt explizit.

Visuelle Pruefung mit Playwright/Chromium (1440px, Fixture-PDF
`VA-2026-Auflage.pdf`): Ueberblick, Einnahmen, Ausgaben und Sparpotenzial als
Screenshots geprueft — die Balken sind durchgehend schlank und gleichmaessig
breit, kein Diagramm dominiert mehr sein Panel, die Wasserfall-Stufen tragen
sichtbare Verbindungslinien, die Panel-Raender sitzen ruhig und konsistent.

**Tests gruen** (`npm run test:js` 61/61, `npm run test:e2e` 7/7).

### Iteration 11 — Komponenten erweitern (erledigt)

Mehr Web-Tauglichkeit: Druckausgabe, gestraffter Auftakt, Seiten-Metadaten.

- **Badge/Pill `.web-tag` — nicht umsetzbar, Befund.** Die kategorialen
  Tabellenwerte (Transfer-Art „Pflichtumlage" / „freiwillig/sonstige",
  Suche-Richtung „Einnahme" / „Ausgabe") werden ausschliesslich von
  `web/vendor/dashboard/dashboard.js` gerendert. Beide Stellen geben die
  Werte als **blanken Text** in einer `<td>` aus: der gemeinsame Helfer
  `tableRows()` baut `"<td" + (c.num ? ' class="num"' : "") + ">" +
  c.text + "</td>"`, also ohne jede Klasse oder umschliessendes Element;
  die Transfer-Art (`rerenderTables`) liefert nur den Klartext
  „Pflichtumlage" bzw. „freiwillig/sonstige", die Suche-Richtung (`row()`)
  nur `esc(p.richtung)`. Es gibt **keinen klassifizierbaren Anker** —
  weder eine Klasse auf der `<td>` noch ein `<span>` um den Wert. Ein
  reines CSS-Pill liesse sich daher nicht zielgenau ansetzen (eine Regel
  auf der ganzen Spalte traefe auch die Kopfzeile und liesse die zwei
  semantischen Varianten nicht unterscheiden). Pills waeren nur ueber eine
  Aenderung an `dashboard.js` moeglich — und das ist fuer diese Iteration
  ausdruecklich untersagt. Folglich **kein `.web-tag` umgesetzt**; die
  bestehenden `.doc-status`-Pills (in `app.js`-gerenderten Tabellen)
  bleiben die Pill-Referenz. Sollte `dashboard.js` spaeter angefasst
  werden duerfen, ist die saubere Loesung: den Art-/Richtungswert dort in
  ein `<span class="web-tag web-tag--pflicht|--neutral">` wickeln und das
  `.web-tag`-CSS analog zu `.doc-status` ergaenzen.
- **Druck-Stylesheet** (`@media print`, neuer Abschnitt 7 in `app.css`):
  Beim Ausdruck einer Auswertung werden Dokumentverwaltung/Upload,
  Empty-State, Dokument-Umschalter, Tableiste, Toasts, Sankey-Leiste,
  Mehrjahres-Aktionen, das Overlay und der Seitenfuss ausgeblendet. Der
  aktive Tab (nur `.tab-panel.is-active` ist sichtbar) druckt ruhig in
  Schwarz auf Weiss: Markenleiste als schlichte Kopfzeile mit duenner
  Unterlinie statt Dunkelgruen-Block, Karten/Panels ohne Schatten mit
  feiner Graulinie, Metric-Akzentbalken und Hero-Tint entfernt. Panels,
  Sektionskoepfe und Tabellenzeilen tragen `break-inside: avoid`,
  Ueberschriften `break-after: avoid`, `thead` wird je Seite wiederholt;
  der `.page`-Container nutzt die volle Druckbreite. Die hohe
  Sankey-Flaeche wird auf 420px gekuerzt.
- **Hero/Auftakt gestrafft.** Titel und Intro sitzen jetzt in einer
  `<header class="web-hero">`-Einheit: `.web-hero__title` und
  `.web-hero__intro` ohne eigenen Streuabstand, eng gebunden, mit einem
  gemeinsamen Block-Abstand zum Header. Der Intro-Text wurde von drei auf
  zwei Saetze gekuerzt (factually unveraendert: clientseitiges Parsen von
  VRV-2015-PDFs, kein Server, kein Upload ins Netz).
- **Seiten-Metadaten.** `<head>` ergaenzt um `<meta name="description">`
  (deutsch, knapp), `<meta name="theme-color" content="#2c6e40">` (=
  `--web-green-deep`) und ein Inline-SVG-Favicon (`web/favicon.svg`, ein
  schlichtes gruenes Balken-Mark, keine externe Abhaengigkeit).

Visuelle Pruefung mit Playwright/Chromium (1440px, Fixture-PDF
`VA-2026-Auflage.pdf`): Hero als ruhige Einheit, Transfers-Tab unveraendert
(Art-Spalte weiter als Klartext — siehe Befund), Druckemulation
(`emulateMedia({ media: 'print' })`) zeigt eine saubere Schwarz-auf-Weiss-
Auswertung ohne Bedienelemente. **Tests gruen** (`npm run test:js`,
`npm run test:e2e`).

### Iteration 12 — Grossbildschirm-Breite (erledigt)

Befund: `.page` wurde in Iteration 1 auf 1200px zentriert — auf einem
4K-Monitor ein schmaler Streifen mit riesigen Leerraendern. Das alte Design
nutzte `min(2400px, 95vw)`, also fast die volle Breite. Korrektur:

- **`.page` deutlich verbreitert.** Neuer gemeinsamer Token
  `--web-page-max: min(2040px, 94vw)` in `app.css`; sowohl `.page` als auch
  `.gat-header__inner` lesen ihn — eine Quelle, Header und Body teilen sich
  weiter den linken Rand. Der frueher in `dashboard.css` doppelt vermutete
  `.page`-Block existiert dort nicht; `dashboard.css` cappt nur Fliesstext.
  `.page` bleibt mittig (`margin-inline: auto`) mit der `clamp()`-
  Seitenpolsterung. Bei 2560px nutzt der Inhalt jetzt 2040px Lese-/
  Inhaltsbreite (plus 2×40px Polster = 2120px Box), bei Ultra-Wide bleibt
  ueber `94vw` ein kleiner Rand.
- **Fliesstext bleibt schmal.** Intro (`.app-intro`/`.web-hero__intro`),
  `.lead`, die Tab-Einleitungen (`.tab-panel > p`, `.web-section-head p`),
  `.web-panel__note` und `.callout` bleiben explizit auf ~70rem begrenzt —
  die Caps haengen nicht mehr am (jetzt breiten) Container, sondern stehen
  je Komponente. Saetze laufen nicht ueber 2000px.
- **Grossflaechige Einzel-Diagramme gedeckelt.** Neue Modifier-Klasse
  `.web-panel--breit`: ab `min-width: 75rem` werden die Einzel-Chart-Panels
  (Wasserfall `c_wasserfall`/`c_wasserfall_sp`, `c_korridor`, `c_treiber`,
  `c_investitionen`, `c_trend_eck`, `c_trend_auf`) auf 1180px gedeckelt und
  mittig gesetzt — sonst wuerde ein 340px-Chart in 2040px-Breite zum
  flachen Streifen. Ihre Inline-Hoehen wurden einheitlich auf 380px
  angehoben (zuvor 340/360). Der Sankey `c_sankey` behaelt volle Breite und
  520px Hoehe — er profitiert von der Breite. Die 2-spaltigen `.dash-grid`-
  Panels (Einnahmen/Ausgaben) bekommen je ~halbe Breite und bleiben
  unveraendert.
- **Metric-Raster & `.dash-grid` gepruyft.** Das 4-spaltige `.metric-card`-
  Raster und die 2-spaltige `.dash-grid` sitzen bei 2040px Breite gut
  proportioniert — keine duenn gezogenen Karten, Gaps unveraendert.

Visuelle Pruefung mit Playwright/Chromium (Fixture-PDF `VA-2026-Auflage.pdf`),
Ueberblick/Einnahmen/Suche je bei 2560/1440/390px: bei 2560 nutzt der Inhalt
die volle Breite wie ein echtes Dashboard (kein zentrierter Streifen mehr),
die Wasserfall-/Trend-Diagramme sitzen ruhig in 1180px-Breite statt flach
ueber den ganzen Schirm, das 2-Spalten-Einnahmen-Raster und die breiten
Tabellen fuellen die Flaeche sinnvoll, Fliesstextzeilen bleiben kurz. Bei
1440 und 390 keine Regression, kein horizontaler Seiten-Ueberlauf.

Gewaehlte `.page`-`max-width`: **`min(2040px, 94vw)`** (Token
`--web-page-max`).

**Tests gruen** (`npm run test:js` 61/61, `npm run test:e2e` 7/7).

### Iteration 13 — Einheitliche Panel-Breite (erledigt)

Befund nach Iteration 12: `.web-panel--breit` deckelte grosse Einzel-Charts
auf 1180px und zentrierte sie — sie schwebten als Insel zwischen vollbreiten
Metric-Cards und vollbreitem Sankey. Inkonsistente Kanten, wirkte unfertig.

- **`.web-panel--breit` entfernt.** Die Modifier-Klasse ist aus den sieben
  betroffenen Panels in `index.html` (`c_wasserfall`, `c_trend_eck`,
  `c_investitionen`, `c_wasserfall_sp`, `c_korridor`, `c_treiber`,
  `c_trend_auf`) und die zugehoerige `@media`-Regel aus `app.css`
  geloescht. Jedes `.web-panel` — Metric-Cards, Chart-Panels, Tabellen-
  Panels, Sankey — spannt jetzt die volle Containerbreite mit identischer
  linker und rechter Kante. Kein zentrierter Insel-Block mehr; das
  Dashboard liest sich als eine durchgehende Spalte vollbreiter Panels.
- **`barMaxWidth` nach Datendichte gestaffelt.** Der globale `BAR_MAX = 40`
  aus Iteration 10 wurde durch zwei Stufen ersetzt: `BAR_MAX_DICHT = 56`
  fuer kategorienreiche Diagramme (horizontale Ertragsposten-Liste,
  Korridor-Saeulen) und `BAR_MAX_WEIT = 130` fuer kategorienarme
  Diagramme. Den weiten Deckel tragen jetzt: beide Wasserfaelle (nur 3
  Saeulen — bei 40px duenne Slivers ueber 2000px), die Trend-Eckwerte und
  der gestapelte Trend-Aufwand (wenige Dokumente je Achse) sowie die
  vollbreiten Einzel-Chart-Balkenlisten Kostentreiber und Investitionen
  (liegende Balken, bei wenigen Posten sonst duenne Streifen in viel
  Hoehe). `bar()` nimmt dafuer einen optionalen `barMax`-Parameter.
- **Chart-Hoehen angehoben.** Die vollbreiten Einzel-Charts wurden von
  einheitlich 380px gezielt erhoeht, damit ein ~2000px-Panel kein flacher
  Streifen ist: beide Wasserfaelle und der Korridor 460px, die beiden
  Trend-Diagramme 440px, die liegenden Balkenlisten Kostentreiber und
  Investitionen 480px. Die halbbreiten `.dash-grid`-Charts (360px) und
  der Sankey (520px) bleiben unveraendert. Alle `#id`s erhalten.
- **`.dash-grid` und 4-up-Metric-Raster** unveraendert — beide spannen
  bereits die volle Breite und sitzen bei 2040px gut proportioniert.

Visuelle Pruefung mit Playwright/Chromium (Fixture-PDF `VA-2026-Auflage.pdf`),
Ueberblick/Einnahmen/Ausgaben/Sparpotenzial je bei 2560/1440/390px: bei 2560
teilen alle Panels dieselbe linke und rechte Kante — keine zentrierte Insel
mehr, das Dashboard ist eine durchgehende vollbreite Spalte. Die
Wasserfall-Saeulen wirken mit 130px-Deckel substanziell statt als Striche,
Korridor und Kostentreiber fuellen ihre Flaeche, die hoeheren Panels sind
keine flachen Streifen. Bei 1440 und 390 keine Regression, kein
horizontaler Seiten-Ueberlauf.

**Tests gruen** (`npm run test:js` 61/61, `npm run test:e2e` 7/7).
