// ECharts-Optionsbausteine fuer das Dashboard — JavaScript-Port von
// report/charts.py.
//
// Jede Funktion liefert ein ECharts-Options-Objekt, identisch zu dem, das die
// Python-Pipeline erzeugt. Formatter werden als '(...)=>...'-Strings
// eingebettet und clientseitig von dashboard.js per revive() in echte
// Funktionen zurueckverwandelt.

// Entsaettigte Diagramm-Palette des Web-Design-Systems (siehe
// docs/web-design-system.md). ECharts liest keine CSS-Variablen — die
// Hex-Werte werden hier gespiegelt und muessen mit den --web-chart-*-Token
// in app.css uebereinstimmen. Semantik der Schluessel:
// green=Ertraege/positiv, blue=Personal/neutral-kuehl (Teal),
// orange=Sachaufwand (Gold), red=Aufwand/Risiko (Clay),
// soft=Sonstige/Restgruppe (Sage), paper=Diagramm-Flaeche.
const INK = {
  green: "#3f7d4f",
  blue: "#4f93a0",
  orange: "#c9a24b",
  red: "#b9744f",
  soft: "#8a8f7d",
  paper: "#ffffff",
}

// Diagrammschrift = Seitenschrift (Gruene-AT-DS). Achsen-/Linientoene weich
// gehalten, abgestimmt auf den ruhigen Web-Grundton (web-design-system.md).
const CHART_FONT = "Barlow Semi Condensed, sans-serif"
const ACHSE_TEXT = "#23271f"
const ACHSE_TEXT_SOFT = "#5e6358"
const ACHSE_LINIE = "#cdd2c8"
const ACHSE_SPLIT = "#e7eae2"

// Gemeinsame Diagramm-Schriftgroessen (Iteration 16). Die App hat viele
// aeltere Nutzer:innen — die fruehere Skala (~10-12px) war zu klein. Ein
// Wert je Textrolle, damit Achsen, Legenden, Tooltips und Datenlabels in
// allen Buildern konsistent gross sind.
// LABEL_SIZE = Achsenlabels, Legende, Tooltip, Datenlabels, Sankey-Knoten.
// AXIS_SIZE  = Wertachse (etwas kleiner, bleibt klar lesbar).
const LABEL_SIZE = 15
const AXIS_SIZE = 14

function baseText() {
  return { fontFamily: CHART_FONT, color: ACHSE_TEXT }
}

// Balkenbreiten-Deckelung je Datendichte. Auf den jetzt vollbreiten Panels
// (~2000px auf einem 4K-Schirm) wuerde ein globaler schmaler Deckel
// kategorienarme Diagramme zu duennen Strichen verkommen lassen. Daher zwei
// Stufen: BAR_MAX_DICHT fuer Diagramme mit vielen Kategorien (horizontale
// Balkenlisten, Korridor), BAR_MAX_WEIT fuer kategorienarme Saeulendiagramme
// (Wasserfall mit 3 Saeulen, Trend ueber wenige Dokumente) — dort sollen die
// Saeulen substanziell wirken statt als Slivers in leerer Flaeche.
const BAR_MAX_DICHT = 56
const BAR_MAX_WEIT = 130

// Gemeinsame, ruhige Grid-Raender — jedes Diagramm nutzt seine Panel-
// flaeche gleichmaessig. containLabel haelt Achsenbeschriftungen drin;
// bottom wird je Diagramm erhoeht, wenn Legende oder gedrehte Labels
// zusaetzlichen Platz brauchen.
function grid(extra = {}) {
  return { left: 10, right: 18, top: 14, bottom: 10, containLabel: true, ...extra }
}

// Tooltip auf die Komponentensprache des Web-Design-Systems: helle Karte
// mit Haarlinie und weichem Schatten statt der dunklen ECharts-Voreinstellung.
// Schrift = Seitenschrift, Text im ruhigen --web-text-Ton. extra erlaubt es,
// trigger/axisPointer je Diagramm zu ergaenzen.
function tip(extra = {}) {
  return {
    backgroundColor: INK.paper,
    borderColor: ACHSE_LINIE,
    borderWidth: 1,
    padding: [7, 11],
    extraCssText: "box-shadow: 0 4px 14px rgba(31,38,28,.12); border-radius: 8px;",
    textStyle: {
      fontFamily: CHART_FONT,
      color: ACHSE_TEXT,
      fontSize: LABEL_SIZE,
    },
    ...extra,
  }
}

// Legende auf die ruhige Komponentensprache: Sekundaertext-Ton, Seitenschrift.
function legende(extra = {}) {
  return {
    bottom: 0,
    itemGap: 14,
    textStyle: {
      fontFamily: CHART_FONT,
      fontSize: LABEL_SIZE,
      color: ACHSE_TEXT_SOFT,
    },
    ...extra,
  }
}

function catAxis(data, fontsize = LABEL_SIZE, rotate = 0) {
  return {
    type: "category",
    data,
    axisLabel: {
      fontFamily: CHART_FONT,
      fontSize: fontsize,
      color: ACHSE_TEXT,
      rotate,
      interval: 0,
    },
    axisLine: { lineStyle: { color: ACHSE_LINIE } },
  }
}

function valAxis(formatter = "(v)=>(v/1000).toLocaleString('de')+'k'") {
  return {
    type: "value",
    axisLabel: {
      fontFamily: CHART_FONT,
      fontSize: AXIS_SIZE,
      color: ACHSE_TEXT_SOFT,
      formatter,
    },
    splitLine: { lineStyle: { color: ACHSE_SPLIT } },
  }
}

// Pythons round() rundet zur naechsten geraden Zahl — siehe dashboard-data.js.
function round(x) {
  const ab = Math.floor(x)
  const rest = x - ab
  if (rest < 0.5) return ab
  if (rest > 0.5) return ab + 1
  return ab % 2 === 0 ? ab : ab + 1
}

function bar(categories, values, color, colors = null, barMax = BAR_MAX_DICHT) {
  const data = colors
    ? values.map((v, i) => ({
        value: round(v),
        itemStyle: { color: colors[i] },
      }))
    : values.map((v) => round(v))
  return {
    textStyle: baseText(),
    grid: grid(),
    tooltip: tip({ trigger: "axis", axisPointer: { type: "shadow" } }),
    xAxis: valAxis(),
    yAxis: { ...catAxis(categories), inverse: true },
    series: [
      {
        type: "bar",
        data,
        barWidth: "62%",
        barMaxWidth: barMax,
        itemStyle: { color, borderRadius: 2 },
      },
    ],
  }
}

// --- Dokumentbezogene Diagramme ------------------------------------------- //
export function chartSankey(agg) {
  const nodes = []
  const links = []
  const seen = new Set()
  const node = (name, color) => {
    if (!seen.has(name)) {
      nodes.push({ name, itemStyle: { color } })
      seen.add(name)
    }
  }
  node("Gemeindehaushalt", INK.soft)
  for (const [name, betrag] of agg.sankey.quellen) {
    const col =
      name === "Kommunalsteuer" || name === "Ertragsanteile (Bund)"
        ? INK.green
        : INK.blue
    node(name, col)
    links.push({ source: name, target: "Gemeindehaushalt", value: betrag })
  }
  for (const [name, betrag] of agg.sankey.gruppen) {
    node(name, INK.orange)
    links.push({ source: "Gemeindehaushalt", target: name, value: betrag })
  }
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "item" }),
    series: [
      {
        type: "sankey",
        left: 8,
        right: 300,
        top: 16,
        bottom: 16,
        nodeGap: 13,
        nodeWidth: 26,
        label: {
          fontFamily: CHART_FONT,
          fontSize: LABEL_SIZE,
          color: ACHSE_TEXT,
        },
        lineStyle: { color: "gradient", opacity: 0.32, curveness: 0.5 },
        emphasis: { focus: "adjacency" },
        data: nodes,
        links,
      },
    ],
  }
}

export function chartEinnahmen(agg) {
  const e = agg.einnahmen
  const cats = e.map(([b]) => b.slice(0, 34)).reverse()
  const vals = e.map(([, v]) => v).reverse()
  const cols = e
    .map(([b]) => (b.includes("Kommunalsteuer") ? INK.green : INK.blue))
    .reverse()
  return bar(cats, vals, INK.blue, cols)
}

// Kostentreiber und Investitionen sitzen seit Iteration 13 in vollbreiten
// Einzel-Chart-Panels. Haben sie nur wenige Posten, blieben die liegenden
// Balken bei knappem Deckel duenne Streifen in viel Hoehe — daher der
// weitere BAR_MAX_WEIT-Deckel statt des dichten.
export function chartTreiber(agg) {
  const cats = agg.treiber.map(([b]) => b.slice(0, 34)).reverse()
  const vals = agg.treiber.map(([, d]) => d).reverse()
  return bar(cats, vals, INK.red, null, BAR_MAX_WEIT)
}

export function chartInvestitionen(agg) {
  const cats = agg.investitionen.map(([b]) => b.slice(0, 36)).reverse()
  const vals = agg.investitionen.map(([, , v]) => v).reverse()
  return bar(cats, vals, INK.orange, null, BAR_MAX_WEIT)
}

export function chartAufwandart(agg) {
  const palette = {
    Personal: INK.blue,
    Sachaufwand: INK.orange,
    Transfers: INK.red,
    Finanz: INK.soft,
    Sonstige: INK.soft,
  }
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "item" }),
    legend: legende(),
    series: [
      {
        type: "pie",
        radius: ["42%", "70%"],
        center: ["50%", "44%"],
        padAngle: 2,
        itemStyle: { borderRadius: 3 },
        label: {
          fontFamily: CHART_FONT,
          fontSize: LABEL_SIZE,
          // ECharts deutet '\n' im Formatter selbst als Zeilenumbruch — der
          // String enthaelt daher Backslash + n als zwei Zeichen.
          formatter: "{b}\\n{d}%",
        },
        data: agg.aufwand_art.map(([c, v]) => ({
          name: c,
          value: v,
          itemStyle: { color: palette[c] || INK.soft },
        })),
      },
    ],
  }
}

export function chartTreemap(agg) {
  const gruppen = new Map()
  for (const [g, a, betrag] of agg.treemap) {
    if (!gruppen.has(g)) gruppen.set(g, [])
    gruppen.get(g).push({ name: a, value: betrag })
  }
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "item" }),
    series: [
      {
        type: "treemap",
        data: [...gruppen.entries()].map(([g, k]) => ({
          name: g,
          children: k,
        })),
        top: 6,
        bottom: 6,
        left: 6,
        right: 6,
        roam: false,
        nodeClick: "zoomToNode",
        breadcrumb: { show: true, bottom: 0 },
        levels: [
          {
            itemStyle: {
              borderColor: INK.paper,
              borderWidth: 3,
              gapWidth: 3,
            },
          },
          {
            itemStyle: {
              borderColor: INK.paper,
              borderWidth: 1,
              gapWidth: 1,
            },
            colorSaturation: [0.32, 0.62],
          },
        ],
        color: [INK.orange, INK.blue, INK.green, INK.red, INK.soft],
        label: { fontFamily: CHART_FONT, fontSize: LABEL_SIZE },
        upperLabel: {
          show: true,
          height: 24,
          fontFamily: CHART_FONT,
          fontSize: LABEL_SIZE,
        },
      },
    ],
  }
}

export function chartWasserfall(agg, jahr) {
  const e = agg.eckwerte
  const schritte = [
    ["Ertraege", e.ertraege, INK.green],
    ["Aufwendungen", -e.aufwand, INK.red],
    [`Nettoergebnis ${jahr}`, e.netto, INK.blue],
  ]
  const namen = schritte.map((s) => s[0])
  const sockel = []
  const sichtbar = []
  for (const [name, wert, farbe] of schritte) {
    if (name.includes("Nettoergebnis") || wert >= 0) {
      sockel.push(0)
      sichtbar.push({ value: round(wert), itemStyle: { color: farbe } })
    } else {
      sockel.push(round(e.ertraege + wert))
      sichtbar.push({ value: round(-wert), itemStyle: { color: farbe } })
    }
  }
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "axis", axisPointer: { type: "shadow" } }),
    grid: grid({ top: 28 }),
    xAxis: catAxis(namen),
    yAxis: valAxis("(v)=>(v/1e6).toLocaleString('de')+' Mio'"),
    series: [
      {
        type: "bar",
        stack: "w",
        itemStyle: { color: "transparent" },
        data: sockel,
        silent: true,
        barWidth: "45%",
        barMaxWidth: BAR_MAX_WEIT,
      },
      {
        type: "bar",
        stack: "w",
        data: sichtbar,
        barWidth: "45%",
        barMaxWidth: BAR_MAX_WEIT,
        itemStyle: { borderRadius: 2 },
        // Ruhige Verbindungslinie zwischen den Wasserfall-Stufen — eine
        // duenne Haarlinie macht den Treppen-Verlauf ablesbar, ohne den
        // entsaettigten Charakter zu stoeren.
        markLine: {
          symbol: "none",
          silent: true,
          lineStyle: { color: ACHSE_LINIE, width: 1, type: "dashed" },
          label: { show: false },
          data: [
            [
              { coord: [0, round(e.ertraege)] },
              { coord: [1, round(e.ertraege)] },
            ],
            [
              { coord: [1, round(e.ertraege - e.aufwand)] },
              { coord: [2, round(e.ertraege - e.aufwand)] },
            ],
          ],
        },
        label: {
          show: true,
          position: "top",
          fontFamily: CHART_FONT,
          fontSize: LABEL_SIZE,
          formatter: "(p)=>(p.value/1000).toLocaleString('de')+'k'",
        },
      },
    ],
  }
}

export function chartKorridor(agg) {
  const e = agg.korridor
  const cats = e.map(([b]) => b.slice(0, 32))
  const einzeln = e.map(([, v]) => v)
  const kumuliert = e.map(([, , k]) => k)
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "axis", axisPointer: { type: "shadow" } }),
    legend: legende(),
    grid: grid({ bottom: 96, top: 18 }),
    xAxis: catAxis(cats, LABEL_SIZE, 38),
    yAxis: valAxis(),
    series: [
      {
        name: "Einzelposten",
        type: "bar",
        data: einzeln,
        itemStyle: { color: INK.orange, borderRadius: 2 },
        barWidth: "52%",
        barMaxWidth: BAR_MAX_DICHT,
      },
      {
        name: "kumuliert",
        type: "line",
        data: kumuliert,
        smooth: true,
        symbolSize: 5,
        itemStyle: { color: INK.red },
        lineStyle: { color: INK.red },
      },
    ],
  }
}

// --- Zeitreihen-Diagramme ------------------------------------------------- //
export function chartTrendEckwerte(trend) {
  const reihe = trend.eckwerte
  const namen = reihe.map((r) => r[0])
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "axis", axisPointer: { type: "shadow" } }),
    legend: legende(),
    grid: grid({ bottom: 52 }),
    xAxis: catAxis(namen),
    yAxis: valAxis("(v)=>(v/1e6).toLocaleString('de')+' Mio'"),
    series: [
      {
        name: "Ertraege",
        type: "bar",
        data: reihe.map((r) => r[1]),
        barMaxWidth: BAR_MAX_WEIT,
        itemStyle: { color: INK.green, borderRadius: 2 },
      },
      {
        name: "Aufwendungen",
        type: "bar",
        data: reihe.map((r) => r[2]),
        barMaxWidth: BAR_MAX_WEIT,
        itemStyle: { color: INK.red, borderRadius: 2 },
      },
      {
        name: "Nettoergebnis",
        type: "line",
        symbolSize: 7,
        data: reihe.map((r) => r[3]),
        itemStyle: { color: INK.blue },
        lineStyle: { color: INK.blue, width: 2 },
      },
    ],
  }
}

export function chartTrendKomm(trend) {
  const reihe = trend.komm
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "axis" }),
    grid: grid({ top: 30 }),
    xAxis: catAxis(reihe.map((r) => r[0])),
    yAxis: valAxis(),
    series: [
      {
        type: "line",
        smooth: true,
        symbolSize: 8,
        data: reihe.map((r) => r[1]),
        itemStyle: { color: INK.green },
        lineStyle: { color: INK.green, width: 2.5 },
        areaStyle: { color: "rgba(63,125,79,0.10)" },
        label: {
          show: true,
          position: "top",
          fontFamily: CHART_FONT,
          fontSize: 10,
          formatter: "(p)=>(p.value/1e6).toLocaleString('de')+' Mio'",
        },
      },
    ],
  }
}

export function chartTrendAufwand(trend) {
  const reihe = trend.aufwand
  const namen = reihe.map((r) => r[0])
  const reihen = [
    ["Personal", 1, INK.blue],
    ["Sachaufwand", 2, INK.orange],
    ["Transfers", 3, INK.red],
    ["Finanz", 4, INK.soft],
  ]
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "axis", axisPointer: { type: "shadow" } }),
    legend: legende(),
    grid: grid({ bottom: 52 }),
    xAxis: catAxis(namen),
    yAxis: valAxis("(v)=>(v/1e6).toLocaleString('de')+' Mio'"),
    series: reihen.map(([name, idx, col]) => ({
      name,
      type: "bar",
      stack: "a",
      data: reihe.map((r) => r[idx]),
      barMaxWidth: BAR_MAX_WEIT,
      itemStyle: { color: col },
    })),
  }
}

function mehrjahrBasis(jahre) {
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "axis", axisPointer: { type: "line" } }),
    legend: legende({ type: "scroll" }),
    grid: grid({ top: 30, bottom: 64 }),
    xAxis: catAxis(jahre),
    yAxis: valAxis(),
    series: [],
  }
}

// 10-stufige kategoriale Palette fuer den Mehrjahres-Vergleich: die acht
// entsaettigten Diagrammtoene des Web-Design-Systems plus zwei weiche Tints.
// Reihenfolge so, dass aufeinanderfolgende Serien in Farbton oder Helligkeit
// deutlich kontrastieren; durchgehend niedrige Saettigung.
const MEHRJAHR_PALETTE = [
  "#3f7d4f", // chart-green
  "#c9a24b", // chart-gold
  "#4f93a0", // chart-teal
  "#b9744f", // chart-clay
  "#6ba368", // chart-leaf
  "#9c5b7d", // chart-plum
  "#5d6b8a", // chart-slate
  "#8a8f7d", // chart-sage
  "#a7c4a3", // weicher Gruen-Tint
  "#c9a98c", // weicher Clay-Tint
]

// Vorberechnete ECharts-Optionen je Dokument plus Zeitreihen.
export function alleCharts(daten) {
  const dokCharts = {}
  for (const [did, agg] of Object.entries(daten.aggregate)) {
    const dokE = daten.dokumente.find((d) => String(d.id) === did)
    const jahr = dokE ? dokE.jahr : 0
    dokCharts[did] = {
      sankey: chartSankey(agg),
      einnahmen: chartEinnahmen(agg),
      aufwandart: chartAufwandart(agg),
      treemap: chartTreemap(agg),
      wasserfall: chartWasserfall(agg, jahr),
      korridor: chartKorridor(agg),
      treiber: chartTreiber(agg),
      investitionen: chartInvestitionen(agg),
    }
  }
  const trend = daten.trend
  const trendCharts = {
    trend_eck: chartTrendEckwerte(trend),
    trend_komm: chartTrendKomm(trend),
    trend_auf: chartTrendAufwand(trend),
  }
  const jahre = daten.dokumente.map((d) => d.label)
  const mehrjahr = {
    basis: mehrjahrBasis(jahre),
    palette: MEHRJAHR_PALETTE,
    dok_reihenfolge: daten.dokumente.map((d) => d.id),
  }
  return {
    dok_charts: dokCharts,
    trend_charts: trendCharts,
    mehrjahr,
  }
}
