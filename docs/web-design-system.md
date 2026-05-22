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

_Folgende Iterationen werden hier fortgeschrieben._
