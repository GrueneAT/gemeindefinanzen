// Plausibilitaetspruefung des Parse-Ergebnisses — JavaScript-Port von
// validate.py.
//
// Die Pruefung ist vollstaendig selbstbezueglich: Sie rechnet die Detailposten
// gegen die Summen- und Saldozeilen des Detailnachweises, die im selben PDF
// abgedruckt sind. Stimmen alle Ansatz-Summen, ist der Parser nachweislich
// korrekt — ohne externe Referenz.
//
// Geprueft wird je Ansatz:
//   Summe Detail-Ertraege  operativ  ==  Zeile 'SU 21'
//   Summe Detail-Aufwand   operativ  ==  Zeile 'SU 22'
//   Summe Detail-Einzahlg. investiv  ==  Zeile 'SU 33'
//   Summe Detail-Auszahlg. investiv  ==  Zeile 'SU 34'

const TOLERANZ = 0.05 // Euro — deckt Rundung in der PDF-Darstellung ab

// (SU-Code-Praefix, Richtung, Gebarung, Betragsspalte)
const CHECKS = [
  ["SU 21", "einnahme", "operativ", "eh_wert"],
  ["SU 22", "ausgabe", "operativ", "eh_wert"],
  ["SU 33", "einnahme", "investiv", "fh_wert"],
  ["SU 34", "ausgabe", "investiv", "fh_wert"],
]

// kaufmaennisch auf zwei Nachkommastellen runden — Pendant zu SQLs ROUND(x,2).
function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100
}

function deFormat(x) {
  return x.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function ansatzCheck(posten, suPrefix, richtung, gebarung, spalte) {
  // Detailsummen je Ansatz.
  const detail = new Map()
  for (const p of posten) {
    if (
      p.zeilentyp === "detail" &&
      p.richtung === richtung &&
      p.gebarung === gebarung
    ) {
      const key = p.ansatz
      detail.set(key, (detail.get(key) || 0) + (p[spalte] || 0))
    }
  }
  // SU-Summen je Ansatz.
  const summen = new Map()
  for (const p of posten) {
    if (p.zeilentyp === "summe" && (p.vrk || "").startsWith(suPrefix)) {
      const key = p.ansatz
      summen.set(key, (summen.get(key) || 0) + (p[spalte] || 0))
    }
  }

  const abweichungen = []
  for (const [ansatz, detailSumme] of detail) {
    const ds = round2(detailSumme)
    const erwartet = round2(summen.get(ansatz) || 0)
    if (Math.abs(ds - erwartet) > TOLERANZ) {
      abweichungen.push(
        `Ansatz ${ansatz}: Detail ${deFormat(ds)} != ` +
          `${suPrefix} ${deFormat(erwartet)}`,
      )
    }
  }
  const name = `${suPrefix} — ${richtung}/${gebarung} je Ansatz`
  if (abweichungen.length > 0) {
    return {
      name,
      ok: false,
      detail: `${abweichungen.length} Abweichung(en); z. B. ${abweichungen[0]}`,
    }
  }
  return { name, ok: true, detail: `${detail.size} Ansaetze stimmen` }
}

// Alle Pruefungen fuer ein Parse-Ergebnis (ein Dokument) ausfuehren.
export function validate(result) {
  const posten = result.posten
  const ergebnisse = []
  for (const [suPrefix, richtung, gebarung, spalte] of CHECKS) {
    ergebnisse.push(ansatzCheck(posten, suPrefix, richtung, gebarung, spalte))
  }
  // Strukturpruefung: jeder Detailposten hat einen Ansatz.
  const verwaist = posten.filter(
    (p) => p.zeilentyp === "detail" && (!p.ansatz || p.ansatz === ""),
  ).length
  ergebnisse.push({
    name: "Detailposten mit Ansatz",
    ok: verwaist === 0,
    detail: verwaist === 0 ? "alle zugeordnet" : `${verwaist} ohne Ansatz`,
  })
  return ergebnisse
}

// Ergebnis-Liste in einen Textbericht giessen.
export function formatReport(ergebnisse) {
  const zeilen = ["Plausibilitaetspruefung", "=".repeat(60)]
  for (const p of ergebnisse) {
    zeilen.push(`[${p.ok ? "OK  " : "FEHL"}] ${p.name}: ${p.detail}`)
  }
  const nOk = ergebnisse.filter((p) => p.ok).length
  zeilen.push("=".repeat(60))
  zeilen.push(`${nOk}/${ergebnisse.length} Pruefungen bestanden`)
  return zeilen.join("\n")
}

// Knappe Zusammenfassung (z. B. fuer die Dokumentliste).
export function pruefStatus(ergebnisse) {
  const nOk = ergebnisse.filter((p) => p.ok).length
  return { ok: nOk, gesamt: ergebnisse.length, bestanden: nOk === ergebnisse.length }
}
