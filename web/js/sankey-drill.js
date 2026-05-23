// Geldfluss-Sankey mit Drill-down — baut Knoten und Verbindungen direkt aus
// DATA.posten, fuer die Uebersicht und fuer den eingeklappten/ausgeklappten
// Zustand.
//
// Drei Ebenen: Einnahmequellen -> "Gemeindehaushalt" -> Aufgabengruppen.
// Ein Klick auf einen Quellen-Knoten klappt diesen in seine Konten auf, ein
// Klick auf einen Aufgabengruppen-Knoten in seine Ansaetze. Im Drill-down
// werden die uebrigen Knoten der gedrillten Seite ausgeblendet; die
// Gegenseite bleibt in Uebersichtsform sichtbar, damit der Anteil des
// aufgeklappten Bereichs am Gesamthaushalt ablesbar bleibt. Lange
// Kinderlisten werden auf TOP_N gekappt und der Rest in einen
// "Sonstige"-Knoten gebuendelt.
//
// Reine Funktionen ohne ECharts-/DOM-Abhaengigkeit, damit in Node testbar.

// Org-weite Chart-Konstanten: PALETTE/INK/LABEL_SIZE kommen aus dem
// gehosteten gat-charts.js-Modul, identisch zu dashboard-charts.js.
import {
  PALETTE,
  INK as DS_INK,
  LABEL_SIZE,
} from "https://grueneat.github.io/design-system/gat-charts.js"

const MITTE = "Gemeindehaushalt"

// Hoechstzahl Detailknoten je ausgeklapptem Bereich; der Rest wird gebuendelt.
export const TOP_N = 8

// App-Adapter: DS-INK ist tonal (text/soft/axis/...), die App nutzt
// semantische Rollen (green/blue/orange/red/soft) — Mapping ueber PALETTE,
// identisch zu dashboard-charts.js. green=Ertraege/positiv,
// blue=Personal/neutral-kuehl (Teal), orange=Sachaufwand (Gold),
// red=Aufwand/Risiko (Clay), soft=Sonstige/Restgruppe (Sage).
const INK = {
  green: PALETTE[0],
  blue: PALETTE[2],
  orange: PALETTE[3],
  red: PALETTE[4],
  soft: PALETTE[7],
}

// Diagrammschrift = Seitenschrift (Gruene-AT-DS). Achsenwerte aus DS-INK.
const CHART_FONT = "Barlow Semi Condensed, sans-serif"
const ACHSE_TEXT = DS_INK.text
const ACHSE_LINIE = DS_INK.axis

// Tooltip auf die Komponentensprache: helle Karte mit Haarlinie und weichem
// Schatten statt der dunklen ECharts-Voreinstellung — identisch zu
// dashboard-charts.js.
const TOOLTIP = {
  trigger: "item",
  backgroundColor: "#ffffff",
  borderColor: ACHSE_LINIE,
  borderWidth: 1,
  padding: [7, 11],
  extraCssText: "box-shadow: 0 4px 14px rgba(31,38,28,.12); border-radius: 8px;",
  textStyle: { fontFamily: CHART_FONT, color: ACHSE_TEXT, fontSize: LABEL_SIZE },
}

// Einnahmequelle eines Postens — Portierung der CASE-Logik aus
// dashboard-data.js (sankey()), damit die Quellen-Aggregation des
// Drill-downs deckungsgleich mit der Uebersicht bleibt.
export function quelleVonPosten(p) {
  const konto = p.konto || ""
  const mvag3 = (p.mvag || "").slice(0, 3)
  if (konto === "859400") return "Ertragsanteile (Bund)"
  if (konto === "833000") return "Kommunalsteuer"
  if (konto === "830000" || konto === "831000") return "Grundsteuer"
  if (konto.startsWith("852") || konto.startsWith("810")) {
    return "Gebuehren & Leistungen"
  }
  if (mvag3 === "212") return "Transfers & Zuschuesse"
  return "Sonstige Einnahmen"
}

const QUELLE_GRUEN = new Set(["Kommunalsteuer", "Ertragsanteile (Bund)"])

function quelleFarbe(name) {
  return QUELLE_GRUEN.has(name) ? INK.green : INK.blue
}

// Operative Einnahmeposten eines Dokuments — Ergebnishaushalt, ew > 0.
export function einnahmePosten(posten, dokId) {
  return posten.filter(
    (p) =>
      String(p.dok) === String(dokId) &&
      p.richtung === "einnahme" &&
      p.ew > 0,
  )
}

// Operative Ausgabeposten eines Dokuments — gleiche Basis wie der
// Ausgaben-Drill-down (ausgabePosten in dashboard.js).
export function ausgabePosten(posten, dokId) {
  return posten.filter(
    (p) =>
      String(p.dok) === String(dokId) &&
      p.richtung === "ausgabe" &&
      p.ew > 0,
  )
}

// Eine Map name -> Betrag in eine nach Betrag absteigend sortierte Liste
// [name, betrag] verwandeln und dabei auf TOP_N kappen; der Rest wird in
// einen "Sonstige"-Eintrag gebuendelt. sonstigeLabel erlaubt einen
// eindeutigen Namen ("Sonstige Ansaetze" / "Sonstige Konten"), damit der
// Buendel-Knoten nie mit einem echten Knoten kollidiert.
export function kappen(map, sonstigeLabel) {
  const liste = [...map.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
  if (liste.length <= TOP_N) return liste
  const sichtbar = liste.slice(0, TOP_N)
  const rest = liste.slice(TOP_N).reduce((s, [, v]) => s + v, 0)
  if (rest > 0) sichtbar.push([sonstigeLabel, rest])
  return sichtbar
}

// Aufgabengruppen eines Dokuments: [code, text, betrag], absteigend.
function gruppen(rows) {
  const byGruppe = new Map()
  rows.forEach((p) => {
    const code = p.gruppe || ""
    const cur = byGruppe.get(code) || {
      text: p.gruppe_text || "ohne Gruppe",
      sum: 0,
    }
    cur.sum += p.ew
    byGruppe.set(code, cur)
  })
  return [...byGruppe.entries()]
    .map(([code, g]) => [code, g.text, g.sum])
    .filter((r) => r[2] > 0)
    .sort((a, b) => b[2] - a[2])
}

// Ansaetze einer Aufgabengruppe: gekappte Liste [label, betrag].
function ansaetzeDerGruppe(rows, gruppeCode) {
  const byAnsatz = new Map()
  rows
    .filter((p) => (p.gruppe || "") === gruppeCode)
    .forEach((p) => {
      const label =
        (p.ansatz ? p.ansatz + " " : "") +
        (p.ansatz_text || "ohne Ansatz")
      byAnsatz.set(label, (byAnsatz.get(label) || 0) + p.ew)
    })
  return kappen(byAnsatz, "Sonstige Ansaetze")
}

// Konten einer Einnahmequelle: gekappte Liste [label, betrag].
function kontenDerQuelle(rows, quelle) {
  const byKonto = new Map()
  rows
    .filter((p) => quelleVonPosten(p) === quelle)
    .forEach((p) => {
      const label =
        (p.konto ? p.konto + " " : "") +
        (p.bezeichnung || "ohne Bezeichnung")
      byKonto.set(label, (byKonto.get(label) || 0) + p.ew)
    })
  return kappen(byKonto, "Sonstige Konten")
}

// Quellen eines Dokuments: [name, betrag], absteigend.
function quellen(rows) {
  const byQuelle = new Map()
  rows.forEach((p) => {
    const q = quelleVonPosten(p)
    byQuelle.set(q, (byQuelle.get(q) || 0) + p.ew)
  })
  return [...byQuelle.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
}

// Baut die ECharts-Sankey-Optionen fuer ein Dokument.
//
// expand: null fuer die Uebersicht, sonst { seite, key }
//   seite "quelle":  key ist der Quellenname, der in Konten aufgeklappt wird
//   seite "gruppe":  key ist der Gruppencode, der in Ansaetze aufgeklappt wird
//
// Jeder Knoten bekommt drillMeta-Felder, die der Klick-Handler in dashboard.js
// auswertet: { seite, key, expandbar }.
export function buildSankeyOption(posten, dokId, expand) {
  const einnahmen = einnahmePosten(posten, dokId)
  const ausgaben = ausgabePosten(posten, dokId)
  const nodes = []
  const links = []
  const seen = new Set()

  function node(name, color, meta) {
    if (seen.has(name)) return
    seen.add(name)
    nodes.push({
      name,
      itemStyle: { color },
      drillSeite: meta ? meta.seite : "",
      drillKey: meta ? meta.key : "",
      drillExpandbar: meta ? !!meta.expandbar : false,
    })
  }

  // R11 — Eckwerte aus den Posten ableiten, um den Abschlussknoten
  // (Ueberschuss/Abgangsdeckung) bilanziell korrekt einzuzeichnen.
  // Summe ueber alle einnahmen- und ausgabenposten dieses Dokuments.
  const ertraegeGesamt = einnahmen.reduce((s, p) => s + (p.ew || 0), 0)
  const aufwandGesamt = ausgaben.reduce((s, p) => s + (p.ew || 0), 0)
  const netto = ertraegeGesamt - aufwandGesamt

  node(MITTE, INK.soft, { seite: "mitte", key: "", expandbar: false })

  // Pro Seite: ist genau diese Seite die gedrillte Seite? Nur auf der
  // gedrillten Seite werden die nicht-gewaehlten Knoten ausgeblendet; die
  // Gegenseite faellt in den Uebersichts-Zweig.
  const quelleGedrillt = !!expand && expand.seite === "quelle"
  const gruppeGedrillt = !!expand && expand.seite === "gruppe"

  // Einnahmeseite. Ist sie die gedrillte Seite, wird nur der aufgeklappte
  // Zweig gezeigt; ist sie die Gegenseite (oder kein Drill-down aktiv),
  // bleibt sie in Uebersichtsform sichtbar.
  quellen(einnahmen).forEach(([name, betrag]) => {
    if (expand && expand.key === name) {
      // Diese Quelle ausgeklappt: ein Knoten je Konto.
      kontenDerQuelle(einnahmen, name).forEach(([kLabel, kBetrag]) => {
        node(kLabel, quelleFarbe(name), {
          seite: "quelle",
          key: name,
          expandbar: false,
        })
        links.push({ source: kLabel, target: MITTE, value: kBetrag })
      })
    } else if (!quelleGedrillt) {
      // Uebersicht: jede Quelle als eingeklappter, aufklappbarer Knoten.
      node(name, quelleFarbe(name), {
        seite: "quelle",
        key: name,
        expandbar: true,
      })
      links.push({ source: name, target: MITTE, value: betrag })
    }
    // Anderer, nicht-gewaehlter Knoten DERSELBEN gedrillten Seite: bleibt
    // ausgeblendet.
  })

  // Ausgabeseite — symmetrisch zur Einnahmeseite.
  gruppen(ausgaben).forEach(([code, text, betrag]) => {
    if (expand && expand.key === code) {
      // Diese Gruppe ausgeklappt: ein Knoten je Ansatz.
      ansaetzeDerGruppe(ausgaben, code).forEach(([aLabel, aBetrag]) => {
        node(aLabel, INK.orange, {
          seite: "gruppe",
          key: code,
          expandbar: false,
        })
        links.push({ source: MITTE, target: aLabel, value: aBetrag })
      })
    } else if (!gruppeGedrillt) {
      node(text, INK.orange, {
        seite: "gruppe",
        key: code,
        expandbar: true,
      })
      links.push({ source: MITTE, target: text, value: betrag })
    }
    // Anderer, nicht-gewaehlter Knoten DERSELBEN gedrillten Seite: bleibt
    // ausgeblendet.
  })

  // R11 — Bilanzielle Ehrlichkeit: Ueberschuss/Abgang als Abschlussknoten,
  // konsistent mit chartSankey in dashboard-charts.js. Im Drill-down
  // ebenfalls sichtbar, weil das Gemeindehaushalt-Saldo unabhaengig vom
  // Aufklapp-Zustand ist.
  if (netto > 0.5) {
    node("Ueberschuss / Ruecklagenzufuhr", INK.green, {
      seite: "abschluss", key: "ueberschuss", expandbar: false,
    })
    links.push({
      source: MITTE,
      target: "Ueberschuss / Ruecklagenzufuhr",
      value: netto,
    })
  } else if (netto < -0.5) {
    node("Abgangsdeckung", INK.red, {
      seite: "abschluss", key: "abgang", expandbar: false,
    })
    links.push({
      source: "Abgangsdeckung",
      target: MITTE,
      value: -netto,
    })
  }

  return {
    textStyle: { fontFamily: CHART_FONT, color: ACHSE_TEXT },
    tooltip: TOOLTIP,
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
