// Plausibilitaetspruefung — JavaScript-Port von validate.py.
//
// Die Pruefung ist vollstaendig selbstbezueglich: Sie rechnet die Detailposten
// gegen die Summen- und Saldozeilen des Detailnachweises, die im selben PDF
// abgedruckt sind. Stimmen alle Ansatz-Summen, ist der Parser nachweislich
// korrekt — ohne externe Referenz.
//
// Geprueft wird je Ansatz und je Spalte:
//   Ergebnishaushalt (EHH)
//     einnahme/operativ      == 'SU 21'
//     ausgabe/operativ       == 'SU 22'
//     einnahme/ruecklage     == 'SU 23' (Entnahmen HH-Rl)
//     ausgabe/ruecklage      == 'SU 24' (Zufuehrungen HH-Rl)
//   Finanzierungshaushalt (FHH)
//     einnahme/operativ      == 'SU 31'
//     ausgabe/operativ       == 'SU 32'
//     einnahme/investiv      == 'SU 33'
//     ausgabe/investiv       == 'SU 34'
//     einnahme/finanzierung  == 'SU 35'
//     ausgabe/finanzierung   == 'SU 36'
//   Salden (arithmetische Ableitung im PDF)
//     SA0  ==  SU 21 - SU 22         (Nettoergebnis EHH)
//     SA00 ==  SA0  + SU 23 - SU 24  (nach HH-Ruecklagen)
//     SA1  ==  SU 31 - SU 32
//     SA2  ==  SU 33 - SU 34
//     SA3  ==  SA1  + SA2
//     SA4  ==  SU 35 - SU 36
//     SA5  ==  SA3  + SA4

const TOLERANZ = 0.05 // Euro

const EHH_SPALTEN = ["eh_wert", "eh_vergleich", "eh_dritte"]
const FHH_SPALTEN = ["fh_wert", "fh_vergleich", "fh_dritte"]

// [SU-Code, richtung, gebarung, Spalten-Tripel]
const CHECKS = [
  ["SU 21", "einnahme", "operativ",     EHH_SPALTEN],
  ["SU 22", "ausgabe",  "operativ",     EHH_SPALTEN],
  ["SU 23", "einnahme", "ruecklage",    EHH_SPALTEN],
  ["SU 24", "ausgabe",  "ruecklage",    EHH_SPALTEN],
  ["SU 31", "einnahme", "operativ",     FHH_SPALTEN],
  ["SU 32", "ausgabe",  "operativ",     FHH_SPALTEN],
  ["SU 33", "einnahme", "investiv",     FHH_SPALTEN],
  ["SU 34", "ausgabe",  "investiv",     FHH_SPALTEN],
  ["SU 35", "einnahme", "finanzierung", FHH_SPALTEN],
  ["SU 36", "ausgabe",  "finanzierung", FHH_SPALTEN],
]

// Saldo-Identitaeten: [SA-Code, Operanden-Liste]
const SALDEN = [
  ["SA SA0",  [["SU 21", +1], ["SU 22", -1]]],
  ["SA SA00", [["SU 21", +1], ["SU 22", -1], ["SU 23", +1], ["SU 24", -1]]],
  ["SA SA1",  [["SU 31", +1], ["SU 32", -1]]],
  ["SA SA2",  [["SU 33", +1], ["SU 34", -1]]],
  ["SA SA3",  [["SU 31", +1], ["SU 32", -1], ["SU 33", +1], ["SU 34", -1]]],
  ["SA SA4",  [["SU 35", +1], ["SU 36", -1]]],
  ["SA SA5",  [["SU 31", +1], ["SU 32", -1], ["SU 33", +1], ["SU 34", -1],
               ["SU 35", +1], ["SU 36", -1]]],
]

const SPALTEN_LABEL = {
  eh_wert: "EHH Sp.1", eh_vergleich: "EHH Sp.2", eh_dritte: "EHH Sp.3",
  fh_wert: "FHH Sp.1", fh_vergleich: "FHH Sp.2", fh_dritte: "FHH Sp.3",
}

// True wenn vrk den SU-Code als ganzes Wort enthaelt — erfasst auch
// kombinierte Formen wie 'SU 21 / 31' (Herzogenburg-Konvention).
function vrkPasst(vrk, suNr) {
  if (!vrk) return false
  return new RegExp(`\\b${suNr}\\b`).test(vrk)
}

function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100
}

function ansatzCheck(posten, suPrefix, richtung, gebarung, spalte) {
  // Detail-Summe je Ansatz
  const detail = new Map()
  for (const p of posten) {
    if (p.zeilentyp !== "detail" || p.richtung !== richtung || p.gebarung !== gebarung) continue
    const wert = p[spalte] || 0
    detail.set(p.ansatz, (detail.get(p.ansatz) || 0) + wert)
  }
  // SU-Summe je Ansatz aus den im PDF gedruckten Summen-Zeilen
  const suNr = suPrefix.split(" ")[1]
  const summen = new Map()
  for (const p of posten) {
    if (p.zeilentyp !== "summe") continue
    if (!vrkPasst(p.vrk, suNr)) continue
    const wert = p[spalte] || 0
    summen.set(p.ansatz, (summen.get(p.ansatz) || 0) + wert)
  }

  const label = SPALTEN_LABEL[spalte] || spalte
  const name = `${suPrefix} — ${richtung}/${gebarung} ${label}`
  if (summen.size === 0) {
    return { name, ok: true, detail: "n/a (keine SU-Zeile)" }
  }

  const abweichungen = []
  for (const [ansatz, ds] of detail) {
    const erwartet = summen.get(ansatz) || 0
    if (Math.abs(ds - erwartet) > TOLERANZ) {
      abweichungen.push(
        `Ansatz ${ansatz}: Detail ${round2(ds)} != ${suPrefix} ${round2(erwartet)}`,
      )
    }
  }
  if (abweichungen.length > 0) {
    return {
      name, ok: false,
      detail: `${abweichungen.length} Abweichung(en); z.B. ${abweichungen[0]}`,
    }
  }
  return { name, ok: true, detail: `${detail.size} Ansaetze stimmen` }
}

function saldoCheck(posten, saPrefix, operanden, spalte) {
  // SU-Werte je Ansatz sammeln
  const suWerte = new Map() // ansatz -> { code: wert }
  for (const [suCode] of operanden) {
    const suNr = suCode.split(" ")[1]
    for (const p of posten) {
      if (p.zeilentyp !== "summe") continue
      if (!vrkPasst(p.vrk, suNr)) continue
      const wert = p[spalte] || 0
      if (!suWerte.has(p.ansatz)) suWerte.set(p.ansatz, {})
      const bucket = suWerte.get(p.ansatz)
      bucket[suCode] = (bucket[suCode] || 0) + wert
    }
  }
  // SA-Werte aus PDF
  const saNr = saPrefix.split(" ")[1]
  const saWerte = new Map()
  for (const p of posten) {
    if (p.zeilentyp !== "saldo") continue
    if (!vrkPasst(p.vrk, saNr)) continue
    const wert = p[spalte] || 0
    saWerte.set(p.ansatz, (saWerte.get(p.ansatz) || 0) + wert)
  }

  const label = SPALTEN_LABEL[spalte] || spalte
  const name = `${saPrefix} ${label} — Saldo-Identitaet`

  // Wenn ein SU-Operand komplett fehlt → n/a
  const opCodes = new Set(operanden.map(([c]) => c))
  const gesammelt = new Set()
  for (const bucket of suWerte.values()) {
    for (const k of Object.keys(bucket)) gesammelt.add(k)
  }
  for (const code of opCodes) {
    if (!gesammelt.has(code)) {
      return { name, ok: true, detail: "n/a (SU-Operand fehlt im PDF)" }
    }
  }

  const abweichungen = []
  for (const [ansatz, gedruckt] of saWerte) {
    if (ansatz === null || ansatz === undefined) continue
    let berechnet = 0
    const bucket = suWerte.get(ansatz) || {}
    for (const [code, sign] of operanden) {
      berechnet += sign * (bucket[code] || 0)
    }
    if (Math.abs(berechnet - gedruckt) > TOLERANZ) {
      abweichungen.push(
        `Ansatz ${ansatz}: SU-Rechnung ${round2(berechnet)} != ${saPrefix} ${round2(gedruckt)}`,
      )
    }
  }
  if (abweichungen.length > 0) {
    return {
      name, ok: false,
      detail: `${abweichungen.length} Abweichung(en); z.B. ${abweichungen[0]}`,
    }
  }
  return { name, ok: true, detail: `${saWerte.size} Salden stimmen` }
}

// Liefert {ok, gesamt, bestanden} fuer die UI-Status-Anzeige.
export function pruefStatus(ergebnisse) {
  const ok = ergebnisse.filter((p) => p.ok).length
  return { ok, gesamt: ergebnisse.length, bestanden: ok === ergebnisse.length }
}

// Alle Pruefungen fuer ein Parse-Ergebnis (ein Dokument) ausfuehren.
// Alias-Export ``validate`` bleibt fuer Aufrufer in pipeline.js erhalten.
export { pruefe as validate }
export function pruefe(parseResult) {
  const posten = parseResult.posten
  const ergebnisse = []
  // SU-Pruefungen je Spalte (3 EHH + 3 FHH = 6 Spalten je Check)
  for (const [su, richtung, gebarung, spalten] of CHECKS) {
    for (const spalte of spalten) {
      ergebnisse.push(ansatzCheck(posten, su, richtung, gebarung, spalte))
    }
  }
  // Saldo-Identitaeten je Spalte
  for (const [sa, operanden] of SALDEN) {
    const spalten = sa === "SA SA0" || sa === "SA SA00" ? EHH_SPALTEN : FHH_SPALTEN
    for (const spalte of spalten) {
      ergebnisse.push(saldoCheck(posten, sa, operanden, spalte))
    }
  }
  // Strukturpruefung: jeder Detailposten hat einen Ansatz
  const verwaist = posten.filter(
    (p) => p.zeilentyp === "detail" && !p.ansatz,
  ).length
  ergebnisse.push({
    name: "Detailposten mit Ansatz",
    ok: verwaist === 0,
    detail: verwaist === 0 ? "alle zugeordnet" : `${verwaist} ohne Ansatz`,
  })
  return ergebnisse
}

export function formatiereReport(ergebnisse) {
  const zeilen = ["Plausibilitaetspruefung", "=".repeat(60)]
  for (const p of ergebnisse) {
    const marke = p.ok ? "OK  " : "FEHL"
    zeilen.push(`[${marke}] ${p.name}: ${p.detail}`)
  }
  const nOk = ergebnisse.filter((p) => p.ok).length
  zeilen.push("=".repeat(60), `${nOk}/${ergebnisse.length} Pruefungen bestanden`)
  return zeilen.join("\n")
}
