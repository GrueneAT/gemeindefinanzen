// Test-Stub fuer gat-charts.js (DS v2.0). Mirror der gehosteten Quelle bei
// https://grueneat.github.io/design-system/gat-charts.js — wird im Browser
// per CDN geladen, in Node-Tests ueber den Loader-Hook (gat-charts-shim.mjs)
// gegen diesen Stub aufgeloest. KEIN Produktiv-Vendoring; diese Datei sitzt
// ausschliesslich im Test-Pfad.

export const PALETTE = [
  "#3f7d4f", // 1 green
  "#6ba368", // 2 leaf
  "#4f93a0", // 3 teal
  "#c9a24b", // 4 gold
  "#b9744f", // 5 clay
  "#9c5b7d", // 6 plum
  "#5d6b8a", // 7 slate
  "#8a8f7d", // 8 sage
]

export const INK = {
  text: "#23271f",
  soft: "#5e6358",
  mute: "#6b6f63",
  hairline: "#e1e4db",
  gridline: "#e7eae2",
  axis: "#cdd2c8",
  green: "#3f7d4f",
  clay: "#9c5a38",
  slate: "#5d6b8a",
}

export const LABEL_SIZE = 15
export const AXIS_SIZE = 14
export const BAR_MAX_DICHT = 56
export const BAR_MAX_WEIT = 130

export const VA_DECAL = {
  symbol: "rect",
  symbolSize: 1,
  dashArrayX: [3, 0],
  dashArrayY: [1, 6],
  color: "rgba(255,255,255,0.45)",
  rotation: -Math.PI / 4,
}

const CHART_FONT = "Barlow Semi Condensed, sans-serif"

export function tip(extra = {}) {
  return {
    backgroundColor: "#ffffff",
    borderColor: INK.hairline,
    borderWidth: 1,
    extraCssText: "border-radius: 8px;",
    textStyle: {
      color: INK.text,
      fontFamily: CHART_FONT,
      fontSize: LABEL_SIZE,
    },
    ...extra,
  }
}

export function legende(extra = {}) {
  return {
    itemGap: 14,
    textStyle: {
      color: INK.soft,
      fontFamily: CHART_FONT,
      fontSize: LABEL_SIZE,
    },
    ...extra,
  }
}

export function grid(extra = {}) {
  return {
    left: 10,
    right: 18,
    top: 14,
    bottom: 10,
    containLabel: true,
    ...extra,
  }
}

export function planIstLegende() {
  return [
    {
      name: "Ist (RA)",
      type: "bar",
      data: [],
      itemStyle: { color: INK.soft },
    },
    {
      name: "Plan (VA/NVA)",
      type: "bar",
      data: [],
      itemStyle: { color: INK.soft, decal: VA_DECAL },
    },
  ]
}
