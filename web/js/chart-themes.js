// Chart-Color-Themes — drei definierte Paletten fuer alle ECharts-Charts.
//
// Themes sind statisch definierte Objekte mit `palette` (8 Diagrammfarben)
// und `ink` (semantische Rollen: green/blue/orange/red/soft, fuer
// Chart-Helfer in dashboard-charts.js). Der aktive Theme-Name wird in
// localStorage gehalten (Key `app-chart-theme`) und beim Theme-Wechsel
// per Custom-Event `theme-change` broadcastet — alle ECharts-Instanzen
// re-rendern ihre Optionen mit den neuen Farben (siehe `aktualisiereAlleCharts`
// in app.js).
//
// Standard: die entsaettigte DS-v2.2-Palette (wie bisher).
// Druckfreundlich: Graustufen + zwei Akzentfarben (Gruen + Clay) fuer
//   Schwarzweiss-Druck-Berichte.
// Barrierefrei (Daltonismus-sicher): die Wong-Palette (Wong, B. Nature
//   Methods 2011) — getestet fuer Deuteranopia/Protanopia/Tritanopia.

export const CHART_THEMES = {
  standard: {
    name: "Standard",
    palette: [
      "#3f7d4f", "#c9a24b", "#4f93a0", "#b9744f",
      "#6ba368", "#9c5b7d", "#5d6b8a", "#8a8f7d",
    ],
    ink: {
      green: "#3f7d4f",
      blue: "#4f93a0",
      orange: "#c9a24b",
      red: "#b9744f",
      soft: "#8a8f7d",
    },
  },
  druck: {
    name: "Druckfreundlich",
    palette: [
      "#2c6e40", "#b9744f", "#444444", "#777777",
      "#aaaaaa", "#5a5a5a", "#8a8a8a", "#cfcfcf",
    ],
    ink: {
      green: "#2c6e40",
      blue: "#444444",
      orange: "#777777",
      red: "#b9744f",
      soft: "#aaaaaa",
    },
  },
  barrierefrei: {
    name: "Barrierefrei",
    palette: [
      "#009E73", "#F0E442", "#0072B2", "#D55E00",
      "#56B4E9", "#CC79A7", "#E69F00", "#999999",
    ],
    ink: {
      green: "#009E73",
      blue: "#0072B2",
      orange: "#E69F00",
      red: "#D55E00",
      soft: "#999999",
    },
  },
}

const STORAGE_KEY = "app-chart-theme"
const DEFAULT_THEME = "standard"

export function holeAktivenThemeName() {
  try {
    const wert = localStorage.getItem(STORAGE_KEY)
    if (wert && CHART_THEMES[wert]) return wert
  } catch (e) { /* gesperrt — egal */ }
  return DEFAULT_THEME
}

export function holeAktivesTheme() {
  return CHART_THEMES[holeAktivenThemeName()] || CHART_THEMES[DEFAULT_THEME]
}

export function setzeTheme(name) {
  if (!CHART_THEMES[name]) return
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch (e) { /* egal */ }
  if (typeof window !== "undefined") {
    window.__chartTheme = CHART_THEMES[name]
    window.dispatchEvent(new CustomEvent("theme-change",
      { detail: { name, theme: CHART_THEMES[name] } }))
  }
}

// Globalen Zugriff auf das aktive Theme einrichten — alle Chart-Builder
// (dashboard-charts.js, app.js Drill-Sync, Builder) lesen window.__chartTheme.
export function initChartTheme() {
  if (typeof window !== "undefined") {
    window.__chartTheme = holeAktivesTheme()
    window.CHART_THEMES = CHART_THEMES
  }
}
