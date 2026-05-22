// ECharts-Optionsbausteine fuer das Dashboard — JavaScript-Port von
// report/charts.py.
//
// Jede Funktion liefert ein ECharts-Options-Objekt, identisch zu dem, das die
// Python-Pipeline erzeugt. Formatter werden als '(...)=>...'-Strings
// eingebettet und clientseitig von dashboard.js per revive() in echte
// Funktionen zurueckverwandelt.

// Die vier Tinten des Design Systems — semantisch eingesetzt.
const INK = {
  red: "#8E2F2A",
  blue: "#1F4A6D",
  orange: "#9A4A1C",
  green: "#2F6149",
  soft: "#5b5650",
  paper: "#F4EFE6",
}

function baseText() {
  return { fontFamily: "Inter, sans-serif", color: "#2b2825" }
}

function catAxis(data, fontsize = 11, rotate = 0) {
  return {
    type: "category",
    data,
    axisLabel: {
      fontFamily: "Inter, sans-serif",
      fontSize: fontsize,
      color: "#2b2825",
      rotate,
      interval: 0,
    },
    axisLine: { lineStyle: { color: "#cdc4b4" } },
  }
}

function valAxis(formatter = "(v)=>(v/1000).toLocaleString('de')+'k'") {
  return {
    type: "value",
    axisLabel: {
      fontFamily: "Inter, sans-serif",
      fontSize: 10,
      color: "#5b5650",
      formatter,
    },
    splitLine: { lineStyle: { color: "#e6dfd0" } },
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

function bar(categories, values, color, colors = null) {
  const data = colors
    ? values.map((v, i) => ({
        value: round(v),
        itemStyle: { color: colors[i] },
      }))
    : values.map((v) => round(v))
  return {
    textStyle: baseText(),
    grid: { left: 8, right: 22, top: 12, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: valAxis(),
    yAxis: { ...catAxis(categories), inverse: true },
    series: [
      {
        type: "bar",
        data,
        barWidth: "62%",
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
    tooltip: { trigger: "item" },
    series: [
      {
        type: "sankey",
        left: 8,
        right: 170,
        top: 14,
        bottom: 14,
        nodeGap: 11,
        nodeWidth: 13,
        label: {
          fontFamily: "Inter, sans-serif",
          fontSize: 11,
          color: "#2b2825",
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

export function chartTreiber(agg) {
  const cats = agg.treiber.map(([b]) => b.slice(0, 34)).reverse()
  const vals = agg.treiber.map(([, d]) => d).reverse()
  return bar(cats, vals, INK.red)
}

export function chartInvestitionen(agg) {
  const cats = agg.investitionen.map(([b]) => b.slice(0, 36)).reverse()
  const vals = agg.investitionen.map(([, , v]) => v).reverse()
  return bar(cats, vals, INK.orange)
}

export function chartAufwandart(agg) {
  const palette = {
    Personal: INK.blue,
    Sachaufwand: INK.orange,
    Transfers: INK.red,
    Finanz: INK.soft,
    Sonstige: "#b7ad99",
  }
  return {
    textStyle: baseText(),
    tooltip: { trigger: "item" },
    legend: {
      bottom: 0,
      textStyle: { fontFamily: "Inter, sans-serif", fontSize: 11 },
    },
    series: [
      {
        type: "pie",
        radius: ["42%", "70%"],
        center: ["50%", "44%"],
        padAngle: 2,
        itemStyle: { borderRadius: 3 },
        label: {
          fontFamily: "Inter, sans-serif",
          fontSize: 11,
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
    tooltip: { trigger: "item" },
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
              borderColor: "#F4EFE6",
              borderWidth: 3,
              gapWidth: 3,
            },
          },
          {
            itemStyle: {
              borderColor: "#F4EFE6",
              borderWidth: 1,
              gapWidth: 1,
            },
            colorSaturation: [0.32, 0.62],
          },
        ],
        color: [INK.orange, INK.blue, INK.green, INK.red, INK.soft],
        label: { fontFamily: "Inter, sans-serif", fontSize: 11 },
        upperLabel: {
          show: true,
          height: 20,
          fontFamily: "Inter, sans-serif",
          fontSize: 11,
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
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 18, top: 16, bottom: 8, containLabel: true },
    xAxis: catAxis(namen, 10),
    yAxis: valAxis("(v)=>(v/1e6).toLocaleString('de')+' Mio'"),
    series: [
      {
        type: "bar",
        stack: "w",
        itemStyle: { color: "transparent" },
        data: sockel,
        silent: true,
      },
      {
        type: "bar",
        stack: "w",
        data: sichtbar,
        barWidth: "55%",
        itemStyle: { borderRadius: 2 },
        label: {
          show: true,
          position: "top",
          fontFamily: "Inter, sans-serif",
          fontSize: 10,
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
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: {
      bottom: 0,
      textStyle: { fontFamily: "Inter, sans-serif", fontSize: 11 },
    },
    grid: { left: 8, right: 18, top: 12, bottom: 48, containLabel: true },
    xAxis: catAxis(cats, 9, 38),
    yAxis: valAxis(),
    series: [
      {
        name: "Einzelposten",
        type: "bar",
        data: einzeln,
        itemStyle: { color: INK.orange, borderRadius: 2 },
        barWidth: "52%",
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
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: {
      bottom: 0,
      textStyle: { fontFamily: "Inter, sans-serif", fontSize: 11 },
    },
    grid: { left: 8, right: 18, top: 14, bottom: 40, containLabel: true },
    xAxis: catAxis(namen),
    yAxis: valAxis("(v)=>(v/1e6).toLocaleString('de')+' Mio'"),
    series: [
      {
        name: "Ertraege",
        type: "bar",
        data: reihe.map((r) => r[1]),
        itemStyle: { color: INK.green, borderRadius: 2 },
      },
      {
        name: "Aufwendungen",
        type: "bar",
        data: reihe.map((r) => r[2]),
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
    tooltip: { trigger: "axis" },
    grid: { left: 8, right: 18, top: 16, bottom: 8, containLabel: true },
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
        areaStyle: { color: "rgba(47,97,73,0.10)" },
        label: {
          show: true,
          position: "top",
          fontFamily: "Inter, sans-serif",
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
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: {
      bottom: 0,
      textStyle: { fontFamily: "Inter, sans-serif", fontSize: 11 },
    },
    grid: { left: 8, right: 18, top: 14, bottom: 40, containLabel: true },
    xAxis: catAxis(namen),
    yAxis: valAxis("(v)=>(v/1e6).toLocaleString('de')+' Mio'"),
    series: reihen.map(([name, idx, col]) => ({
      name,
      type: "bar",
      stack: "a",
      data: reihe.map((r) => r[idx]),
      itemStyle: { color: col },
    })),
  }
}

function mehrjahrBasis(jahre) {
  return {
    textStyle: baseText(),
    tooltip: { trigger: "axis", axisPointer: { type: "line" } },
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { fontFamily: "Inter, sans-serif", fontSize: 11 },
    },
    grid: { left: 8, right: 22, top: 16, bottom: 56, containLabel: true },
    xAxis: catAxis(jahre, 11),
    yAxis: valAxis(),
    series: [],
  }
}

// Reihenfolge der Tinten fuer die Linien des Mehrjahres-Vergleichs.
const MEHRJAHR_PALETTE = [
  INK.blue,
  INK.orange,
  INK.green,
  INK.red,
  INK.soft,
  "#b7ad99",
  "#3d6f8e",
  "#bf6a3a",
  "#4a8068",
  "#a85852",
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
