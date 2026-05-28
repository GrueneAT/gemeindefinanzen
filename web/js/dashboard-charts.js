// ECharts-Optionsbausteine fuer das Dashboard — JavaScript-Port von
// report/charts.py.
//
// Jede Funktion liefert ein ECharts-Options-Objekt, identisch zu dem, das die
// Python-Pipeline erzeugt. Formatter werden als '(...)=>...'-Strings
// eingebettet und clientseitig von dashboard.js per revive() in echte
// Funktionen zurueckverwandelt.

// Org-weite Chart-Helfer: Palette/INK/Schriftgroessen/Tooltip/Legende/Grid/
// Decal werden ueber den gehosteten ES-Modul-Import bezogen. DS v2.0 liefert
// die gleichen Werte, die diese App vor der Konvergenz lokal pflegte.
import {
  PALETTE,
  INK as DS_INK,
  LABEL_SIZE,
  AXIS_SIZE,
  BAR_MAX_DICHT,
  BAR_MAX_WEIT,
  VA_DECAL,
  tip,
  legende,
  grid,
  planIstLegende,
} from "https://grueneat.github.io/design-system/gat-charts.js"

// App-Adapter: DS-INK ist tonal (text/soft/mute/hairline/gridline/axis/...),
// die App nutzt semantische Rollen (green/blue/orange/red/soft/paper). Die
// Bruecke besteht aus einem dichten PALETTE-Mapping plus einer paper-
// Konstante fuer ECharts-Flaechen. Semantik der Schluessel:
// green=Ertraege/positiv, blue=Personal/neutral-kuehl (Teal),
// orange=Sachaufwand (Gold), red=Aufwand/Risiko (Clay),
// soft=Sonstige/Restgruppe (Sage), paper=Diagramm-Flaeche.
const INK = {
  green: PALETTE[0],
  blue: PALETTE[2],
  orange: PALETTE[3],
  red: PALETTE[4],
  soft: PALETTE[7],
  paper: "#ffffff",
}

// Diagrammschrift = Seitenschrift (Gruene-AT-DS). Achsen-/Linientoene weich
// gehalten, abgestimmt auf den ruhigen Web-Grundton — Werte aus DS-INK
// (tonal): text fuer Achsenbeschriftung, soft fuer Sekundaertext, axis fuer
// Achsenlinie, gridline fuer Trennlinien im Plot.
const CHART_FONT = "Barlow Semi Condensed, sans-serif"
const ACHSE_TEXT = DS_INK.text
const ACHSE_TEXT_SOFT = DS_INK.soft
const ACHSE_LINIE = DS_INK.axis
const ACHSE_SPLIT = DS_INK.gridline

// App-Wrapper um die DS-Legende: DS hat keinen bottom-Default; die App
// platziert die Legende durchgaengig am Diagramm-Fuss. Damit nicht jede
// Call-Site `bottom: 0` setzen muss, kapselt dieser Wrapper den Default.
function legende_app(extra = {}) {
  return legende({ bottom: 0, ...extra })
}

function baseText() {
  return { fontFamily: CHART_FONT, color: ACHSE_TEXT }
}

// R15: Achsenlabels mit Ellipse abkuerzen, wenn sie zu lang werden.
// Tooltip-Trigger 'axis' nutzt den vollen Kategorienamen weiter — daher
// die Kuerzung NUR im axisLabel.formatter, nicht in den `data`-Werten.
const ELLIPSE_LIMIT = 34
const ELLIPSE_FORMATTER =
  "(v)=>v && v.length>34 ? v.slice(0,33)+'…' : v"

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
      formatter: ELLIPSE_FORMATTER,
    },
    axisLine: { lineStyle: { color: ACHSE_LINIE } },
  }
}

// R14: Einheitliche Wertformate. Wertachsen tragen "Mio EUR" (die Achse
// dient der Groessenordnung); einzelne Datenlabels duerfen weiterhin in
// "k EUR" mit Postenbezug stehen. fmtMio/fmtK liefern die Formatter-
// Strings, die ECharts (per revive in dashboard.js) zu Funktionen
// auspackt — innerhalb eines Diagramms wird konsequent EIN Format genutzt.
const FMT_MIO_AXIS =
  "(v)=>(v/1e6).toLocaleString('de-AT',{minimumFractionDigits:1," +
  "maximumFractionDigits:1})+' Mio'"
const FMT_K_LABEL =
  "(v)=>(v/1000).toLocaleString('de-AT')+'k'"

function valAxis(formatter = FMT_MIO_AXIS) {
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
  // R11 — Bilanzielle Ehrlichkeit: Ueberschuss/Abgang als eigener Knoten.
  // Bei netto > 0 fliesst ein Teil aus dem Gemeindehaushalt in die
  // Ruecklagenzufuhr (Ueberschuss); bei netto < 0 muss Abgangsdeckung in
  // den Haushalt fliessen, damit Ertraege + Deckung = Aufwendungen.
  const netto = agg.eckwerte ? agg.eckwerte.netto : 0
  if (netto > 0) {
    node("Ueberschuss / Ruecklagenzufuhr", INK.green)
    links.push({
      source: "Gemeindehaushalt",
      target: "Ueberschuss / Ruecklagenzufuhr",
      value: netto,
    })
  } else if (netto < 0) {
    node("Abgangsdeckung", INK.red)
    links.push({
      source: "Abgangsdeckung",
      target: "Gemeindehaushalt",
      value: -netto,
    })
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
  // R10: jede Zeile traegt [bezeichnung, betrag, anteil_prozent] —
  // Datenlabel zeigt zusaetzlich den Anteil am Gesamtertrag.
  // R15: voller Kategorienname im Tooltip, axisLabel.formatter kuerzt.
  const e = agg.einnahmen
  const cats = e.map(([b]) => b).reverse()
  const vals = e.map(([, v]) => v).reverse()
  const ants = e.map(([, , p]) => p ?? 0).reverse()
  const cols = e
    .map(([b]) => (b.includes("Kommunalsteuer") ? INK.green : INK.blue))
    .reverse()
  const opt = bar(cats, vals, INK.blue, cols)
  // Datenpunkte um den Anteil ergaenzen und Datenlabel rechts vom Balken
  // platzieren — "2,4 Mio EUR · 18 %"-Form.
  opt.series[0].data = vals.map((v, i) => ({
    value: round(v),
    anteil: ants[i],
    itemStyle: { color: cols[i] },
  }))
  opt.series[0].label = {
    show: true,
    position: "right",
    fontFamily: CHART_FONT,
    fontSize: AXIS_SIZE,
    color: ACHSE_TEXT,
    formatter:
      "(p)=>(p.value/1000).toLocaleString('de-AT')+' k EUR · '+" +
      "(p.data && p.data.anteil!=null ? p.data.anteil : 0)+' %'",
  }
  // Damit das rechte Label nicht von der Panel-Kante abgeschnitten wird,
  // dem Grid mehr rechten Innenrand goennen.
  opt.grid = grid({ right: 110 })
  return opt
}

// Kostentreiber und Investitionen sitzen seit Iteration 13 in vollbreiten
// Einzel-Chart-Panels. Haben sie nur wenige Posten, blieben die liegenden
// Balken bei knappem Deckel duenne Streifen in viel Hoehe — daher der
// weitere BAR_MAX_WEIT-Deckel statt des dichten.
//
// Zweiseitiges (diverging) Diagramm: agg.treiber enthaelt die groessten
// Anstiege (positives Delta) UND die groessten Rueckgaenge (negatives
// Delta). Anstiege in der Risiko-Farbe (Clay), Rueckgaenge in Gruen —
// konsistent mit der Farbsemantik des Design-Systems.
export function chartTreiber(agg) {
  // R15: keine manuelle Kuerzung mehr — catAxis kuerzt im axisLabel,
  // Tooltip zeigt den vollen Namen.
  const cats = agg.treiber.map(([b]) => b).reverse()
  const vals = agg.treiber.map(([, d]) => d).reverse()
  const cols = vals.map((v) => (v >= 0 ? INK.red : INK.green))
  return bar(cats, vals, INK.red, cols, BAR_MAX_WEIT)
}

export function chartInvestitionen(agg) {
  // R15: voller Name in der Kategorie, axisLabel.formatter kuerzt.
  const cats = agg.investitionen.map(([b]) => b).reverse()
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
    legend: legende_app(),
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
  // Nettoergebnis nach Vorzeichen einfaerben: Ueberschuss gruen, Defizit
  // in der Risiko-Farbe (Clay) — konsistent mit der Kennzahlen-Karte.
  const nettoFarbe = e.netto >= 0 ? INK.green : INK.red
  const schritte = [
    ["Ertraege", e.ertraege, INK.green],
    ["Aufwendungen", -e.aufwand, INK.red],
    [`Nettoergebnis ${jahr}`, e.netto, nettoFarbe],
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
    yAxis: valAxis(),
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
          // R14: dieselbe Einheit wie auf der Wertachse — Mio EUR.
          formatter:
            "(p)=>(p.value/1e6).toLocaleString('de-AT',{minimumFractionDigits:1," +
            "maximumFractionDigits:1})+' Mio'",
        },
      },
    ],
  }
}

export function chartKorridor(agg) {
  // R13: kumulierte Linie auf eine eigene zweite y-Achse legen, skaliert
  // 0-100 % der Gesamtsumme — die Einzelbalken werden sonst von der hohen
  // Endsumme vertikal gestaucht.
  // R15: voller Kategorienname; axisLabel.formatter kuerzt.
  const e = agg.korridor
  const cats = e.map(([b]) => b)
  const einzeln = e.map(([, v]) => v)
  const total = e.length ? e[e.length - 1][2] : 0
  // Kumulierte Linie in Prozent der Gesamtsumme.
  const kumProz = e.map(([, , k]) =>
    total > 0 ? round((100 * k) / total) : 0,
  )
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "axis", axisPointer: { type: "shadow" } }),
    legend: legende_app(),
    grid: grid({ bottom: 96, top: 18, right: 60 }),
    xAxis: catAxis(cats, LABEL_SIZE, 38),
    yAxis: [
      // links: Einzelposten in Mio EUR
      valAxis(),
      // rechts: kumulierter Anteil in Prozent
      {
        type: "value",
        min: 0,
        max: 100,
        position: "right",
        axisLabel: {
          fontFamily: CHART_FONT,
          fontSize: AXIS_SIZE,
          color: ACHSE_TEXT_SOFT,
          formatter: "(v)=>v + ' %'",
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Einzelposten",
        type: "bar",
        yAxisIndex: 0,
        data: einzeln,
        itemStyle: { color: INK.orange, borderRadius: 2 },
        barWidth: "52%",
        barMaxWidth: BAR_MAX_DICHT,
      },
      {
        name: "kumuliert (Anteil an Gesamtsumme)",
        type: "line",
        yAxisIndex: 1,
        data: kumProz,
        smooth: true,
        symbolSize: 5,
        itemStyle: { color: INK.red },
        lineStyle: { color: INK.red },
      },
    ],
  }
}

// --- Zeitreihen-Diagramme ------------------------------------------------- //
// Plan (VA/NVA) und Ist (RA) sind fachlich verschiedene Groessen. In den
// Trend-Diagrammen werden sie deshalb optisch getrennt: RA-Datenpunkte
// voll gefuellt, VA/NVA-Datenpunkte mit einem leichten Schraffur-Decal.
// `typ` kommt je Datenpunkt aus dashboard-data.js (trend()).
// VA_DECAL und planIstLegende kommen aus dem gat-charts.js-Import.

// Balkendatenpunkt mit typabhaengigem itemStyle: RA solide, VA/NVA mit
// Decal-Schraffur. Wert und Grundfarbe wie bisher.
function trendBalken(wert, typ, farbe) {
  const stil = { color: farbe, borderRadius: 2 }
  if (typ !== "RA") stil.decal = VA_DECAL
  return { value: wert, itemStyle: stil }
}

export function chartTrendEckwerte(trend) {
  const reihe = trend.eckwerte
  const namen = reihe.map((r) => r[0])
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "axis", axisPointer: { type: "shadow" } }),
    legend: legende_app(),
    aria: { enabled: true, decal: { show: true } },
    grid: grid({ bottom: 52 }),
    xAxis: catAxis(namen),
    yAxis: valAxis(),
    series: [
      {
        name: "Ertraege",
        type: "bar",
        data: reihe.map((r) => trendBalken(r[1], r[4], INK.green)),
        barMaxWidth: BAR_MAX_WEIT,
        // Serien-Grundfarbe nur fuer die Legenden-Swatch — die Balken
        // selbst tragen ihre Farbe je Datenpunkt aus trendBalken().
        itemStyle: { color: INK.green },
      },
      {
        name: "Aufwendungen",
        type: "bar",
        data: reihe.map((r) => trendBalken(r[2], r[4], INK.red)),
        barMaxWidth: BAR_MAX_WEIT,
        itemStyle: { color: INK.red },
      },
      {
        name: "Nettoergebnis",
        type: "line",
        symbolSize: 7,
        // Plan-Punkte als Ring, Ist-Punkte als gefuellter Kreis.
        data: reihe.map((r) => ({
          value: r[3],
          symbol: r[4] === "RA" ? "circle" : "emptyCircle",
        })),
        itemStyle: { color: INK.blue },
        lineStyle: { color: INK.blue, width: 2 },
      },
      ...planIstLegende(),
    ],
  }
}

export function chartTrendKomm(trend) {
  const reihe = trend.komm
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "axis" }),
    legend: legende_app(),
    grid: grid({ top: 30, bottom: 36 }),
    xAxis: catAxis(reihe.map((r) => r[0])),
    yAxis: valAxis(),
    series: [
      {
        name: "Kommunalsteuer",
        type: "line",
        smooth: true,
        symbolSize: 9,
        // Ist-Punkte gefuellt, Plan-Punkte als Ring — Plan/Ist sichtbar
        // getrennt (typ je Datenpunkt aus dashboard-data.js).
        data: reihe.map((r) => ({
          value: r[1],
          symbol: r[2] === "RA" ? "circle" : "emptyCircle",
        })),
        itemStyle: { color: INK.green },
        lineStyle: { color: INK.green, width: 2.5 },
        areaStyle: { color: "rgba(63,125,79,0.10)" },
        label: {
          show: true,
          position: "top",
          fontFamily: CHART_FONT,
          fontSize: LABEL_SIZE,
          formatter:
            "(p)=>(p.value/1e6).toLocaleString('de-AT'," +
            "{minimumFractionDigits:1,maximumFractionDigits:1})+' Mio'",
        },
      },
      // Legendenhinweise: Punktform erklaert Plan vs. Ist.
      {
        name: "Ist (RA)",
        type: "line",
        data: [],
        symbol: "circle",
        symbolSize: 9,
        itemStyle: { color: ACHSE_TEXT_SOFT },
        lineStyle: { opacity: 0 },
      },
      {
        name: "Plan (VA/NVA)",
        type: "line",
        data: [],
        symbol: "emptyCircle",
        symbolSize: 9,
        itemStyle: { color: ACHSE_TEXT_SOFT },
        lineStyle: { opacity: 0 },
      },
    ],
  }
}

export function chartTrendAufwand(trend) {
  const reihe = trend.aufwand
  const namen = reihe.map((r) => r[0])
  // typ-Index ist die letzte Spalte je Zeile.
  const reihen = [
    ["Personal", 1, INK.blue],
    ["Sachaufwand", 2, INK.orange],
    ["Transfers", 3, INK.red],
    ["Finanz", 4, INK.soft],
  ]
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "axis", axisPointer: { type: "shadow" } }),
    legend: legende_app(),
    aria: { enabled: true, decal: { show: true } },
    grid: grid({ bottom: 52 }),
    xAxis: catAxis(namen),
    yAxis: valAxis(),
    series: [
      ...reihen.map(([name, idx, col]) => ({
        name,
        type: "bar",
        stack: "a",
        // Plan-Stapel (VA/NVA) mit Decal-Schraffur, Ist-Stapel (RA) solide.
        data: reihe.map((r) => trendBalken(r[idx], r[5], col)),
        barMaxWidth: BAR_MAX_WEIT,
        // Serien-Grundfarbe nur fuer die Legenden-Swatch.
        itemStyle: { color: col },
      })),
      ...planIstLegende(),
    ],
  }
}

// --- R2 — Schulden & Finanzierung -----------------------------------------
// Gemeinsame Empty-State-Grafik fuer Charts, die je nach Dokumenttyp leer
// sein koennen (z. B. ein VA ohne Finanzierungsposten).
function leerHinweis(text) {
  return {
    type: "text",
    left: "center",
    top: "middle",
    style: {
      text,
      fontFamily: CHART_FONT,
      fontSize: LABEL_SIZE,
      fill: ACHSE_TEXT_SOFT,
    },
  }
}

// R2 Variante A.1: Aufnahme vs. Tilgung als zwei Saeulen fuer das
// aktuelle Dokument. Wenn beide Werte 0, einen dezenten Hinweistext
// im `graphic`-Block einblenden.
export function chartFinanzierung(agg) {
  const f = agg.finanzierung || { aufnahme: 0, tilgung: 0 }
  const namen = ["Darlehensaufnahme", "Tilgung"]
  const werte = [f.aufnahme || 0, f.tilgung || 0]
  const farben = [INK.green, INK.red]
  const opt = {
    textStyle: baseText(),
    grid: grid({ top: 28 }),
    tooltip: tip({ trigger: "axis", axisPointer: { type: "shadow" } }),
    xAxis: catAxis(namen),
    yAxis: valAxis(),
    series: [
      {
        type: "bar",
        data: werte.map((v, i) => ({
          value: round(v),
          itemStyle: { color: farben[i] },
        })),
        barWidth: "45%",
        barMaxWidth: BAR_MAX_WEIT,
        label: {
          show: true,
          position: "top",
          fontFamily: CHART_FONT,
          fontSize: LABEL_SIZE,
          formatter:
            "(p)=>(p.value/1e6).toLocaleString('de-AT'," +
            "{minimumFractionDigits:1,maximumFractionDigits:1})+' Mio'",
        },
        itemStyle: { borderRadius: 2 },
      },
    ],
  }
  if ((f.aufnahme || 0) === 0 && (f.tilgung || 0) === 0) {
    opt.graphic = [
      leerHinweis("Keine Finanzierungs-Posten in diesem Dokument."),
    ]
  }
  return opt
}

// R2 Variante A.2: Schuldenstand kumuliert als Liniendiagramm ueber alle
// Dokumente. Plan-Punkte hohl, Ist-Punkte voll — analog zu chartTrendKomm.
export function chartSchuldenstand(trend) {
  const reihe = (trend && trend.schuldenstand) || []
  const labels = reihe.map((r) => r[0])
  const kum = reihe.map((r) => ({
    value: r[3],
    symbol: r[4] === "RA" ? "circle" : "emptyCircle",
  }))
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "axis", axisPointer: { type: "line" } }),
    legend: legende_app(),
    grid: grid({ bottom: 52, top: 30 }),
    xAxis: catAxis(labels),
    yAxis: valAxis(),
    series: [
      {
        name: "Schuldenstand (kumulativ aus eingelesenen Dokumenten)",
        type: "line",
        data: kum,
        smooth: true,
        symbolSize: 9,
        itemStyle: { color: INK.red },
        lineStyle: { color: INK.red, width: 2.5 },
        areaStyle: { color: "rgba(185,116,79,0.10)" },
      },
      // Legendenhinweise: Punktform erklaert Plan vs. Ist (analog Komm).
      {
        name: "Ist (RA)",
        type: "line",
        data: [],
        symbol: "circle",
        symbolSize: 9,
        itemStyle: { color: ACHSE_TEXT_SOFT },
        lineStyle: { opacity: 0 },
      },
      {
        name: "Plan (VA/NVA)",
        type: "line",
        data: [],
        symbol: "emptyCircle",
        symbolSize: 9,
        itemStyle: { color: ACHSE_TEXT_SOFT },
        lineStyle: { opacity: 0 },
      },
    ],
  }
}

// Investitions-Finanzierung als Sankey: drei Quellknoten links
// (Foerderung, Darlehen, Eigenmittel) → die einzelnen groessten Investitionen
// rechts. Frueher fuehrten alle Quellen auf einen Sammel-Knoten
// "Investitionsvolumen" — das verschenkte die Ausdruckskraft eines Sankeys.
// Jetzt fliessen die Mittel proportional in die echten Investitions-Posten
// (Top-N nach Volumen, Rest unter "Sonstige" gebuendelt).
//
// Proportionalitaet: pro Quelle wird der Quellen-Betrag auf die Ziel-Posten
// im Verhaeltnis ihrer Volumina umgelegt. Damit summieren die abgehenden
// Fluesse je Quelle exakt auf den Quellbetrag, und die ankommenden Fluesse
// je Ziel-Posten exakt auf dessen Volumen — sankey-konform.
const INVEST_TOP_N = 8

export function chartInvestFinanzierungSankey(agg) {
  const f = agg.investFinanzierung || { foerderung: 0, darlehen: 0, eigen: 0 }
  const quellen = [
    ["Foerderung / Kapitaltransfer", f.foerderung || 0, INK.green],
    ["Darlehen (netto)", f.darlehen || 0, INK.blue],
    ["Eigenmittel (Restgroesse)", f.eigen || 0, INK.soft],
  ].filter(([, v]) => v > 0)
  // Investitionen: Top-N + "Sonstige"-Buendel. agg.investitionen liefert
  // eine nach Wert sortierte Liste (groesster zuerst, Limit 14 in
  // dashboard-data.js).
  //
  // Vorher nach Bezeichnung aggregieren: dieselbe Bezeichnung kann ueber
  // mehrere Ansaetze hinweg auftauchen (z. B. "Wasser- und Abwasserbauten
  // und -anlagen" als 8520/4500 und 8500/4500). Sankey-Nodes muessen
  // eindeutige Namen haben — sonst kollabieren die Duplikate im internen
  // Name->Index-Map und ECharts wirft beim Layout `TypeError: Cannot set
  // properties of undefined (setting 'dataIndex')`. Die Anteile fuer den
  // User bleiben korrekt: eine Zeile pro Bezeichnung, Summe ueber die
  // beteiligten Ansaetze.
  const aggrNachBez = new Map()
  for (const [b, , v] of agg.investitionen || []) {
    if (v > 0) aggrNachBez.set(b, (aggrNachBez.get(b) || 0) + v)
  }
  const invListe = Array.from(aggrNachBez.entries())
    .sort((a, c) => c[1] - a[1])
  const top = invListe.slice(0, INVEST_TOP_N)
  const rest = invListe.slice(INVEST_TOP_N)
  const restSumme = rest.reduce((s, [, v]) => s + v, 0)
  const ziele = top.map(([b, v]) => [b, v])
  if (restSumme > 0) {
    ziele.push([`Sonstige (${rest.length})`, restSumme])
  }
  const zielSumme = ziele.reduce((s, [, v]) => s + v, 0)
  const quellSumme = quellen.reduce((s, [, v]) => s + v, 0)

  const nodes = quellen.map(([n, , c]) =>
    ({ name: n, itemStyle: { color: c } }))
  for (const [n] of ziele) {
    nodes.push({ name: n, itemStyle: { color: INK.orange } })
  }
  // Links: jede Quelle splittet ihren Betrag proportional zu den Ziel-
  // volumina. Falls Quell- und Zielsumme abweichen (z. B. wenn ein
  // VA-Dokument keine ausreichenden Detailposten hat), bleibt der Quell-
  // Betrag erhalten und die Ziele werden anteilsgewichtet.
  const links = []
  for (const [qName, qWert] of quellen) {
    for (const [zName, zWert] of ziele) {
      const anteil = zielSumme > 0 ? zWert / zielSumme : 0
      const wert = round(qWert * anteil)
      if (wert > 0) {
        links.push({ source: qName, target: zName, value: wert })
      }
    }
  }
  const opt = {
    textStyle: baseText(),
    tooltip: tip({ trigger: "item" }),
    series: [
      {
        type: "sankey",
        left: 8,
        right: 280,
        top: 16,
        bottom: 16,
        nodeGap: 11,
        nodeWidth: 24,
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
  if (quellen.length === 0 || ziele.length === 0 || quellSumme === 0) {
    opt.graphic = [leerHinweis("Keine investiven Posten in diesem Dokument.")]
  }
  return opt
}

// --- R9 — Gebunden vs. gestaltbar ----------------------------------------
// Sechs Segmente in fester Reihenfolge. Personal/Pflichtumlagen/Finanz
// gelten als gebunden (kurzfristig nicht beweglich), freie Sachausgaben
// als gestaltbar, freiwillige Transfers als teilweise gebunden, "unklar"
// als Rest (Pflichtumlagen-Heuristik mit Disclaimer).
const BINDUNG_SEGMENTE_ORDNUNG = [
  ["personal", "Personal (gebunden)", "INK.blue"],
  ["pflichtumlagen", "Pflichtumlagen (gebunden)", "INK.red"],
  ["finanz", "Finanz (gebunden)", "INK.soft"],
  [
    "freiwilligeTransfers",
    "freiwillige Transfers (teilweise gebunden)",
    "INK.orange",
  ],
  ["freieSachaus", "freie Sachausgaben (gestaltbar)", "INK.green"],
  ["unklar", "automatisch erkannt", "INK.soft"],
]

function bindungSegmente(agg) {
  const farben = {
    "INK.blue": INK.blue,
    "INK.red": INK.red,
    "INK.soft": INK.soft,
    "INK.orange": INK.orange,
    "INK.green": INK.green,
  }
  const b = agg.bindung || {}
  return BINDUNG_SEGMENTE_ORDNUNG.map(([k, label, farbe]) => [
    label,
    b[k] || 0,
    farben[farbe],
  ]).filter(([, v]) => v > 0)
}

// R9 Variante A: einzelner horizontaler 100-%-Stapelbalken.
export function chartBindungStapel(agg) {
  const segmente = bindungSegmente(agg)
  const total = segmente.reduce((s, [, v]) => s + v, 0) || 1
  return {
    textStyle: baseText(),
    tooltip: tip({
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter:
        "(arr)=>arr.map(p=>p.seriesName+': '+(p.value/1e3).toLocaleString" +
        "('de-AT')+' k EUR ('+Math.round(100*p.value/" + (total || 1) +
        ")+' %)').join('<br>')+'<br><br><em>Pflichtumlagen-Heuristik " +
        "per Regex auf Bezeichnung — Fehlklassifikationen moeglich.</em>'",
    }),
    legend: legende_app({ type: "scroll" }),
    grid: grid({ left: 12, right: 18, top: 32, bottom: 56 }),
    xAxis: valAxis(),
    yAxis: catAxis(["Operativer Aufwand"]),
    series: segmente.map(([name, wert, farbe]) => ({
      name,
      type: "bar",
      stack: "bindung",
      data: [round(wert)],
      itemStyle: { color: farbe },
      barWidth: "55%",
      barMaxWidth: BAR_MAX_WEIT,
    })),
  }
}

// R9 Variante B: vertikale gestapelte Saeulen je Aufwandsart-Gruppe.
// Personal komplett gebunden, Sachaufwand komplett gestaltbar, Transfer
// geteilt in Pflicht/freiwillig, Finanz komplett gebunden.
export function chartBindungSaeulen(agg) {
  const b = agg.bindung || {}
  // Spalten: Personal | Transfer | Sachaufwand | Finanz
  const namen = ["Personal", "Transfer", "Sachaufwand", "Finanz"]
  const gebunden = [
    b.personal || 0,
    b.pflichtumlagen || 0,
    0,
    b.finanz || 0,
  ]
  const gestaltbar = [
    0,
    b.freiwilligeTransfers || 0,
    b.freieSachaus || 0,
    0,
  ]
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "axis", axisPointer: { type: "shadow" } }),
    legend: legende_app(),
    grid: grid({ top: 30, bottom: 56 }),
    xAxis: catAxis(namen),
    yAxis: valAxis(),
    series: [
      {
        name: "gebunden",
        type: "bar",
        stack: "bind",
        data: gebunden.map((v) => round(v)),
        itemStyle: { color: INK.red, borderRadius: 2 },
        barMaxWidth: BAR_MAX_WEIT,
      },
      {
        name: "gestaltbar",
        type: "bar",
        stack: "bind",
        data: gestaltbar.map((v) => round(v)),
        itemStyle: { color: INK.green, borderRadius: 2 },
        barMaxWidth: BAR_MAX_WEIT,
      },
    ],
  }
}

// --- R6 — Aufgabenbereiche als sortierte Balken --------------------------
// Horizontales Balken-Ranking aller Aufgabengruppen (Ausgaben) — Laengen
// statt Flaechen vergleichen. Reuse von `bar()`.
export function chartGruppenBalken(agg) {
  const liste = (agg.gruppen || [])
    .slice()
    .sort((a, b) => (b[2] || 0) - (a[2] || 0))
  const cats = liste
    .map((r) => (r[1] && r[1].length ? r[1] : "Gruppe " + (r[0] || "?")))
    .reverse()
  const vals = liste.map((r) => r[2] || 0).reverse()
  return bar(cats, vals, INK.orange, null, BAR_MAX_DICHT)
}

// --- R7 — Saldo je Aufgabenbereich (zweiseitig) --------------------------
// Diverging-Balken: Gruen = Ueberschuss-Bereich (Einnahmen > Ausgaben),
// Clay = Zuschussbereich. Sortiert nach Saldo (groesster Ueberschuss
// oben). Liefert die Grundfrage: welcher Bereich traegt sich selbst?
export function chartGruppenSaldo(agg) {
  const liste = (agg.gruppenSaldo || [])
    .slice()
    .sort((a, b) => (b[4] || 0) - (a[4] || 0))
  const cats = liste
    .map((r) => (r[1] && r[1].length ? r[1] : "Gruppe " + (r[0] || "?")))
    .reverse()
  const vals = liste.map((r) => r[4] || 0).reverse()
  const cols = vals.map((v) => (v >= 0 ? INK.green : INK.red))
  return bar(cats, vals, INK.green, cols, BAR_MAX_WEIT)
}

// --- R8 — "Wofuer geht 1 Euro?" / "Wofuer kommen 100 Euro herein?" -------
// Variante A: ein einzelner horizontaler 100-%-Stapelbalken; jedes Segment
// eine Kategorie, Datenlabel als Cent-Wert. seite ist "aus" oder "ein".
export function chartEinEuroStapel(agg, seite) {
  const liste = (seite === "ein" ? agg.einEuroEin : agg.einEuroAuf) || []
  // Palette: konsistent zur Pie/Sankey-Semantik der App.
  const palette = {
    Personal: INK.blue,
    Sachaufwand: INK.orange,
    Transfers: INK.red,
    Finanz: INK.soft,
    Sonstige: INK.soft,
    Kommunalsteuer: INK.green,
    "Ertragsanteile (Bund)": INK.green,
    Grundsteuer: INK.green,
    "Gebuehren & Leistungen": INK.blue,
    "Transfers & Zuschuesse": INK.orange,
    "Sonstige Einnahmen": INK.soft,
  }
  return {
    textStyle: baseText(),
    tooltip: tip({
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter:
        "(arr)=>arr.map(p=>p.seriesName+': '+p.value+' Cent').join('<br>')",
    }),
    legend: legende_app({ type: "scroll" }),
    grid: grid({ left: 12, right: 18, top: 32, bottom: 56 }),
    xAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: {
        fontFamily: CHART_FONT,
        fontSize: AXIS_SIZE,
        color: ACHSE_TEXT_SOFT,
        formatter: "(v)=>v + ' Cent'",
      },
      splitLine: { lineStyle: { color: ACHSE_SPLIT } },
    },
    yAxis: catAxis([seite === "ein" ? "100 Euro Einnahmen" : "1 Euro Ausgaben"]),
    series: liste.map(([cat, cent]) => ({
      name: cat,
      type: "bar",
      stack: "eineuro",
      data: [cent],
      itemStyle: { color: palette[cat] || INK.soft },
      barWidth: "50%",
      barMaxWidth: BAR_MAX_WEIT,
      label: {
        show: cent >= 4,
        position: "inside",
        fontFamily: CHART_FONT,
        fontSize: AXIS_SIZE,
        color: "#fff",
        formatter: "(p)=>p.value+''",
      },
    })),
  }
}

// Variante B: 10x10-Piktogramm-Raster. ECharts hat keinen nativen "100
// Quadrate eingefaerbt nach Anteil"-Modus; eine bewusst schlichte
// Loesung: 100 gleichgrosse Pie-Slices, jeweils einer Kategorie
// zugeordnet. Optisch sehr nahe an einem Pikto-Raster, ohne neuen Renderer.
export function chartEinEuroPikto(agg, seite) {
  const liste = (seite === "ein" ? agg.einEuroEin : agg.einEuroAuf) || []
  const palette = {
    Personal: INK.blue,
    Sachaufwand: INK.orange,
    Transfers: INK.red,
    Finanz: INK.soft,
    Sonstige: INK.soft,
    Kommunalsteuer: INK.green,
    "Ertragsanteile (Bund)": INK.green,
    Grundsteuer: INK.green,
    "Gebuehren & Leistungen": INK.blue,
    "Transfers & Zuschuesse": INK.orange,
    "Sonstige Einnahmen": INK.soft,
  }
  // 100 gleichgrosse Pie-Slices (waeren mit pictorialBar etwas natuerlicher,
  // hier aber bewusst auf Pie reduziert — Variante-Vergleich braucht keine
  // pixelgenaue Pikto-Geometrie, sondern eine alternative Anmutung).
  const segmente = []
  for (const [cat, cent] of liste) {
    for (let i = 0; i < cent; i++) {
      segmente.push({
        name: cat + " #" + (i + 1),
        value: 1,
        itemStyle: { color: palette[cat] || INK.soft },
      })
    }
  }
  // Auf exakt 100 Felder auffuellen, falls Rundungsdrift.
  while (segmente.length < 100) {
    segmente.push({
      name: "Restdifferenz #" + segmente.length,
      value: 1,
      itemStyle: { color: ACHSE_SPLIT },
    })
  }
  return {
    textStyle: baseText(),
    tooltip: tip({
      trigger: "item",
      formatter: "(p)=>p.name.replace(/ #\\d+$/, '')+': '+p.percent+' %'",
    }),
    legend: legende_app({
      data: liste.map(([cat]) => cat),
      type: "scroll",
    }),
    series: [
      {
        type: "pie",
        radius: ["20%", "80%"],
        center: ["50%", "50%"],
        padAngle: 0,
        startAngle: 90,
        data: segmente.slice(0, 100),
        itemStyle: { borderColor: "#fff", borderWidth: 0.5 },
        label: { show: false },
      },
    ],
  }
}

// --- R3 — Soll-Ist-Abweichung (nur RA) -----------------------------------
// Defensive Builder: bei undefined/leerem sollIst eine Empty-Hinweis-Grafik
// statt eines kaputten Charts. onDocChange-Hook in dashboard.js blendet das
// Panel zusaetzlich aus, wenn der Doktyp nicht RA ist.
export function chartSollIstDiverging(agg) {
  const liste = agg.sollIst ?? []
  if (liste.length === 0) {
    return emptyOption("Nur fuer Rechnungsabschluesse verfuegbar.")
  }
  // r = [bezeichnung, gruppe_text, richtung, soll, ist, abweichung]
  // Diverging-Form analog chartTreiber. Bei Einnahmen ist eine positive
  // Abweichung (mehr Ist als Soll) gut (gruen); bei Ausgaben schlecht (clay).
  // Sortiert nach |abweichung| absteigend; in catAxis-Inverse von unten.
  const reverse = liste.slice().reverse()
  const cats = reverse.map((r) => r[0])
  const vals = reverse.map((r) => r[5])
  const cols = reverse.map((r) => {
    const richtung = r[2]
    const abw = r[5]
    // Einnahme: positive Abweichung gut, negative schlecht.
    // Ausgabe: positive Abweichung schlecht, negative gut.
    const positivGut =
      richtung === "einnahme" ? abw >= 0 : abw < 0
    return positivGut ? INK.green : INK.red
  })
  return bar(cats, vals, INK.red, cols, BAR_MAX_WEIT)
}

// R3 Variante B: Dumbbell — pro Posten ein Soll-Punkt (blau) und ein
// Ist-Punkt (clay/gruen je nach Abweichungsrichtung), mit Verbindungslinie.
export function chartSollIstDumbbell(agg) {
  const liste = agg.sollIst ?? []
  if (liste.length === 0) {
    return emptyOption("Nur fuer Rechnungsabschluesse verfuegbar.")
  }
  const reverse = liste.slice().reverse()
  const cats = reverse.map((r) => r[0])
  const soll = reverse.map((r, i) => [r[3], i])
  const ist = reverse.map((r, i) => [r[4], i])
  // Verbindungslinien als `lines`-Serie.
  const linien = reverse.map((r, i) => [
    { value: [r[3], i] },
    { value: [r[4], i] },
  ])
  const istFarbe = reverse.map((r) => {
    const richtung = r[2]
    const abw = r[5]
    const positivGut =
      richtung === "einnahme" ? abw >= 0 : abw < 0
    return positivGut ? INK.green : INK.red
  })
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "item" }),
    legend: legende_app(),
    grid: grid({ left: 12, right: 18, top: 32, bottom: 56 }),
    xAxis: valAxis(),
    yAxis: {
      type: "category",
      data: cats,
      inverse: false,
      axisLabel: {
        fontFamily: CHART_FONT,
        fontSize: LABEL_SIZE,
        color: ACHSE_TEXT,
        interval: 0,
        formatter: ELLIPSE_FORMATTER,
      },
      axisLine: { lineStyle: { color: ACHSE_LINIE } },
    },
    series: [
      {
        name: "Verbindung",
        type: "lines",
        coordinateSystem: "cartesian2d",
        data: linien,
        lineStyle: { color: ACHSE_LINIE, width: 1.5 },
        silent: true,
      },
      {
        name: "Soll (VA)",
        type: "scatter",
        data: soll,
        symbolSize: 11,
        itemStyle: { color: INK.blue },
      },
      {
        name: "Ist (RA)",
        type: "scatter",
        data: ist.map((d, i) => ({
          value: d,
          itemStyle: { color: istFarbe[i] },
        })),
        symbolSize: 13,
      },
    ],
  }
}

// --- R4 — Budgetierungspolster (nur VA) ----------------------------------
// Variante A: horizontale Doppelbalken — Vordergrundbalken Voranschlag
// (gold), Geistersbalken Ist-RA-Vorjahr (heller Sage) als Referenz.
export function chartPolsterDoppel(agg) {
  const liste = agg.polster ?? []
  if (liste.length === 0) {
    return emptyOption("Nur fuer Voranschlaege verfuegbar.")
  }
  // r = [bezeichnung, gruppe_text, ist_ra, voranschlag, polster, prozent]
  const reverse = liste.slice().reverse()
  const cats = reverse.map((r) => r[0])
  const ist = reverse.map((r) => r[2])
  const va = reverse.map((r) => r[3])
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "axis", axisPointer: { type: "shadow" } }),
    legend: legende_app(),
    grid: grid({ left: 12, right: 18, top: 32, bottom: 56 }),
    xAxis: valAxis(),
    yAxis: { ...catAxis(cats), inverse: false },
    series: [
      {
        name: "Voranschlag (VA)",
        type: "bar",
        data: va,
        itemStyle: { color: INK.orange, borderRadius: 2 },
        barWidth: "55%",
        barMaxWidth: BAR_MAX_DICHT,
        z: 2,
      },
      {
        name: "Ist (letzter RA)",
        type: "bar",
        data: ist,
        itemStyle: { color: INK.soft, borderRadius: 2, opacity: 0.55 },
        barGap: "-100%",
        barWidth: "55%",
        barMaxWidth: BAR_MAX_DICHT,
        z: 1,
      },
    ],
  }
}

// Variante B: Diverging-Balken nach Polster-Hoehe in EUR. Posten mit der
// groessten Luft nach oben (Voranschlag deutlich ueber Ist-RA) gehen
// rechts in clay; Posten unter Vorjahres-Ist (hier nicht in der Liste,
// weil der SQL-Filter sie ausblendet — die Form bleibt offen).
export function chartPolsterDiverging(agg) {
  const liste = agg.polster ?? []
  if (liste.length === 0) {
    return emptyOption("Nur fuer Voranschlaege verfuegbar.")
  }
  const reverse = liste.slice().reverse()
  const cats = reverse.map((r) => r[0])
  const vals = reverse.map((r) => r[4])
  const cols = vals.map((v) => (v >= 0 ? INK.red : INK.green))
  return bar(cats, vals, INK.red, cols, BAR_MAX_WEIT)
}

// Hilfsoption: leerer Chart mit Hinweistext. Wird von R3/R4 genutzt, wenn
// der aktuelle Dokumenttyp die Liste leer laesst.
function emptyOption(text) {
  return {
    textStyle: baseText(),
    grid: grid(),
    xAxis: { show: false },
    yAxis: { show: false },
    series: [],
    graphic: [leerHinweis(text)],
  }
}

function mehrjahrBasis(jahre) {
  return {
    textStyle: baseText(),
    tooltip: tip({ trigger: "axis", axisPointer: { type: "line" } }),
    legend: legende_app({ type: "scroll" }),
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
      // Schulden & Finanzierung — Aufnahme/Tilgung-Saeulen je Dokument.
      // Der kumulierte Stand laeuft als Zeitreihe in trend_charts.schuldenstand.
      fin_saeulen: chartFinanzierung(agg),
      // Investitions-Finanzierung als Sankey (Quellen → einzelne Investitionen).
      investfin_b: chartInvestFinanzierungSankey(agg),
      // R3 — Soll-Ist (Variante A + B)
      sollist_a: chartSollIstDiverging(agg),
      sollist_b: chartSollIstDumbbell(agg),
      // R4 — Polster (Variante A + B)
      polster_a: chartPolsterDoppel(agg),
      polster_b: chartPolsterDiverging(agg),
      // R6 — Aufgabenbereiche als sortierte Balken
      gruppen_balken: chartGruppenBalken(agg),
      // R7 — Saldo je Aufgabenbereich (zweiseitig)
      gruppen_saldo: chartGruppenSaldo(agg),
      // R8 — "Wofuer geht 1 Euro?" / "Wofuer kommen 100 Euro herein?"
      eineuro_aus_a: chartEinEuroStapel(agg, "aus"),
      eineuro_aus_b: chartEinEuroPikto(agg, "aus"),
      eineuro_ein_a: chartEinEuroStapel(agg, "ein"),
      eineuro_ein_b: chartEinEuroPikto(agg, "ein"),
      // R9 — Gebunden vs. gestaltbar (Variante A + B)
      bindung_a: chartBindungStapel(agg),
      bindung_b: chartBindungSaeulen(agg),
    }
  }
  const trend = daten.trend
  const trendCharts = {
    trend_eck: chartTrendEckwerte(trend),
    trend_komm: chartTrendKomm(trend),
    trend_auf: chartTrendAufwand(trend),
    // R2 — kumulierter Schuldenstand ueber alle Dokumente
    schuldenstand: chartSchuldenstand(trend),
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
