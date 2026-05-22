// Geldfluss-Sankey mit Drill-down — baut Knoten und Verbindungen direkt aus
// DATA.posten, fuer die Uebersicht und fuer den eingeklappten/ausgeklappten
// Zustand.
//
// Drei Ebenen: Einnahmequellen -> "Gemeindehaushalt" -> Aufgabengruppen.
// Ein Klick auf einen Quellen-Knoten klappt diesen in seine Konten auf, ein
// Klick auf einen Aufgabengruppen-Knoten in seine Ansaetze. Es bleibt je Seite
// hoechstens ein Knoten ausgeklappt; lange Listen werden auf TOP_N gekappt und
// der Rest in einen "Sonstige"-Knoten gebuendelt.
//
// Reine Funktionen ohne ECharts-/DOM-Abhaengigkeit, damit in Node testbar.

const MITTE = "Gemeindehaushalt"

// Hoechstzahl Detailknoten je ausgeklapptem Bereich; der Rest wird gebuendelt.
export const TOP_N = 8

// Die vier Tinten des Design Systems — semantisch eingesetzt, identisch zu
// dashboard-charts.js.
const INK = {
  red: "#8E2F2A",
  blue: "#1F4A6D",
  orange: "#9A4A1C",
  green: "#2F6149",
  soft: "#5b5650",
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

  node(MITTE, INK.soft, { seite: "mitte", key: "", expandbar: false })

  // Einnahmeseite.
  const quellenListe = quellen(einnahmen)
  quellenListe.forEach(([name, betrag]) => {
    if (expand && expand.seite === "quelle" && expand.key === name) {
      // Diese Quelle ausgeklappt: ein Knoten je Konto.
      const konten = kontenDerQuelle(einnahmen, name)
      konten.forEach(([kLabel, kBetrag]) => {
        node(kLabel, quelleFarbe(name), {
          seite: "quelle",
          key: name,
          expandbar: false,
        })
        links.push({ source: kLabel, target: MITTE, value: kBetrag })
      })
    } else {
      node(name, quelleFarbe(name), {
        seite: "quelle",
        key: name,
        expandbar: true,
      })
      links.push({ source: name, target: MITTE, value: betrag })
    }
  })

  // Ausgabeseite.
  const gruppenListe = gruppen(ausgaben)
  gruppenListe.forEach(([code, text, betrag]) => {
    if (expand && expand.seite === "gruppe" && expand.key === code) {
      // Diese Gruppe ausgeklappt: ein Knoten je Ansatz.
      const ansaetze = ansaetzeDerGruppe(ausgaben, code)
      ansaetze.forEach(([aLabel, aBetrag]) => {
        node(aLabel, INK.orange, {
          seite: "gruppe",
          key: code,
          expandbar: false,
        })
        links.push({ source: MITTE, target: aLabel, value: aBetrag })
      })
    } else {
      node(text, INK.orange, {
        seite: "gruppe",
        key: code,
        expandbar: true,
      })
      links.push({ source: MITTE, target: text, value: betrag })
    }
  })

  return {
    textStyle: { fontFamily: "Inter, sans-serif", color: "#2b2825" },
    tooltip: { trigger: "item" },
    series: [
      {
        type: "sankey",
        left: 8,
        right: 170,
        top: 14,
        bottom: 14,
        nodeGap: 11,
        nodeWidth: 26,
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
