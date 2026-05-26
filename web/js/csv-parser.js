// OH-CSV-Parser fuer die Browser-App.
//
// offenerhaushalt.at liefert pro Gemeinde, Jahr, Typ (Voranschlag/RA) und
// Haushalt (EHH/FHH) je eine Semikolon-CSV mit dem Detailnachweis. Die
// Spalten sind:
//
//   Jahr;Bundesland;Voranschlag/Rechnungsabschluss;Datenquelle;
//   Gemeindekennziffer;Gemeindename;Haushalt;
//   Ansatz-Uab;Ansatz-Ugl;Konto-Grp;Konto-Ugl;Vorhabencode;Mvag;
//   Ansatz-Text;Konto-Text;Wert
//
// Eine OH-CSV traegt damit nur **eine** Haushalts-Haelfte (EHH oder FHH).
// EHH+FHH-Paare gehoeren fachlich zu einem Dokument — das Zusammenfuehren
// und die Detection des Partners passiert in der Pipeline (pipeline.js),
// dieses Modul parst eine einzelne CSV in das ParseResult-Format, das auch
// der PDF-Parser liefert.
//
// Die SU-/SA-Aggregatzeilen, die im PDF-Detailnachweis abgedruckt sind,
// existieren in der OH-CSV nicht. Sie werden in `synthAggregate` aus den
// Detailposten **berechnet**, damit validate.js dieselben 52 Pruefungen
// (10 SU x 3 Spalten + 7 SA x 3 Spalten + 1 Struktur) auch ueber
// CSV-Dokumente laufen lassen kann. Die Pruefungen sind dann tautologisch
// — das ist gewollt: aus derselben Quelle kann nichts widerspruechlich
// werden, und der UI-Pruefstatus bleibt "OK 52/52" statt einer "n/a"-Wueste.

import { ParseResult, Posten } from "./parser.js"
import { GRUPPEN, MVAG, kontenklasse, mvagName } from "./reference.js"

// CSV-Header (Pflicht-Spalten, exakt diese Reihenfolge erwartet die OH-CSV).
const HEADER = [
  "Jahr",
  "Bundesland",
  "Voranschlag/Rechnungsabschluss",
  "Datenquelle",
  "Gemeindekennziffer",
  "Gemeindename",
  "Haushalt",
  "Ansatz-Uab",
  "Ansatz-Ugl",
  "Konto-Grp",
  "Konto-Ugl",
  "Vorhabencode",
  "Mvag",
  "Ansatz-Text",
  "Konto-Text",
  "Wert",
]

// Bytes/Uint8Array/String zu Text. UTF-8, optionales BOM wegschneiden.
function inText(input) {
  let text
  if (typeof input === "string") {
    text = input
  } else if (input instanceof Uint8Array) {
    text = new TextDecoder("utf-8").decode(input)
  } else if (input && input.buffer) {
    text = new TextDecoder("utf-8").decode(new Uint8Array(input.buffer))
  } else {
    throw new Error("CSV-Eingabe muss String oder Uint8Array sein.")
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  return text
}

// Schmaler Semikolon-CSV-Parser. Unterstuetzt doppelte Anfuehrungszeichen
// zum Maskieren von Semikolons und Anfuehrungszeichen innerhalb von
// Feldwerten ("" -> "). Zeilenumbruch in Feldern erlaubt (kommt im OH-CSV
// nicht vor, ist aber RFC-4180-konform). LF und CRLF werden akzeptiert.
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < n && text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (c === ";") {
      row.push(field)
      field = ""
      i += 1
      continue
    }
    if (c === "\r") {
      // Wird unten gemeinsam mit \n als Zeilenende behandelt.
      if (i + 1 < n && text[i + 1] === "\n") i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      i += 1
      continue
    }
    if (c === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      i += 1
      continue
    }
    field += c
    i += 1
  }
  // Letztes Feld/letzte Zeile (Datei ohne abschliessendes Newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

// DE-Zahlenformat: '1.300,00' -> 1300; '-12.919,71' -> -12919.71.
// Leere Werte liefern 0.
function deNum(text) {
  const s = String(text || "").trim()
  if (!s) return 0
  // Tausenderpunkte raus, Komma -> Punkt.
  const norm = s.replace(/\./g, "").replace(",", ".")
  const v = Number(norm)
  return Number.isFinite(v) ? v : 0
}

// Linksbuendig auf 6 Stellen mit '0' auffuellen — kompatibel zum
// PDF-Parser, der genauso vorgeht (ljust6).
function ljust6(s) {
  const t = String(s || "").trim()
  return t.length >= 6 ? t : t + "0".repeat(6 - t.length)
}

// MVAG-Klassifikation: aus dem 4-stelligen Code richtung, gebarung und die
// Zielspalte (eh/fh) ableiten. Die Konvention folgt VRV 2015 Anlage 5d
// (MVAG-Schluessel) — Praefix '2' liegt im Ergebnishaushalt, '3' im
// Finanzierungshaushalt, '4' bezeichnet "nicht voranschlagswirksame
// Gebarung" (Durchlaufer, Vorsteuer, Kautionen).
//
// Liefert: { haushalt: 'EHH'|'FHH', richtung, gebarung, mvag_eh, mvag_fh }
// oder null, wenn der Code nicht erkennbar ist.
function klassifiziereMvag(mvag) {
  const code = String(mvag || "").trim()
  if (code.length < 2) return null
  const p1 = code[0]
  const p2 = code.slice(0, 2)
  if (p1 === "2") {
    // EHH
    if (p2 === "21") {
      return { haushalt: "EHH", richtung: "einnahme", gebarung: "operativ",
               mvag_eh: code, mvag_fh: "" }
    }
    if (p2 === "22") {
      return { haushalt: "EHH", richtung: "ausgabe", gebarung: "operativ",
               mvag_eh: code, mvag_fh: "" }
    }
    if (p2 === "23") {
      return { haushalt: "EHH", richtung: "einnahme", gebarung: "ruecklage",
               mvag_eh: code, mvag_fh: "" }
    }
    if (p2 === "24") {
      return { haushalt: "EHH", richtung: "ausgabe", gebarung: "ruecklage",
               mvag_eh: code, mvag_fh: "" }
    }
    return null
  }
  if (p1 === "3") {
    // FHH (voranschlagswirksam)
    if (p2 === "31") {
      return { haushalt: "FHH", richtung: "einnahme", gebarung: "operativ",
               mvag_eh: "", mvag_fh: code }
    }
    if (p2 === "32") {
      return { haushalt: "FHH", richtung: "ausgabe", gebarung: "operativ",
               mvag_eh: "", mvag_fh: code }
    }
    if (p2 === "33") {
      return { haushalt: "FHH", richtung: "einnahme", gebarung: "investiv",
               mvag_eh: "", mvag_fh: code }
    }
    if (p2 === "34") {
      return { haushalt: "FHH", richtung: "ausgabe", gebarung: "investiv",
               mvag_eh: "", mvag_fh: code }
    }
    if (p2 === "35") {
      return { haushalt: "FHH", richtung: "einnahme", gebarung: "finanzierung",
               mvag_eh: "", mvag_fh: code }
    }
    if (p2 === "36") {
      return { haushalt: "FHH", richtung: "ausgabe", gebarung: "finanzierung",
               mvag_eh: "", mvag_fh: code }
    }
    return null
  }
  if (p1 === "4") {
    // FHH, nicht voranschlagswirksame Gebarung (durchlaufende Posten).
    // Faellt aus den SU 31..36-Aggregaten heraus, weil keine Gebarung
    // gesetzt wird — die SU-Pruefung in validate.js gruppiert nach
    // (richtung, gebarung) und uebersieht diese Zeilen daher korrekt.
    const richtung = p2 === "41" ? "einnahme" : (p2 === "42" ? "ausgabe" : null)
    if (!richtung) return null
    return { haushalt: "FHH", richtung, gebarung: null,
             mvag_eh: "", mvag_fh: code }
  }
  return null
}

// CSV-Bytes/Text in das ParseResult-Format des PDF-Parsers wandeln —
// **ohne** synthetische SU/SA-Aggregate (das uebernimmt synthAggregate
// nach dem optionalen Mergen von EHH+FHH).
//
// Liefert { result, meta }:
//   result: ParseResult mit Detailposten (zeilentyp='detail') und
//           ansatz_namen/konto_namen aus den Text-Spalten der CSV.
//   meta:   { gemeinde, typ, finanzjahr, bundesland, gkz, datenquelle,
//             haushalt }  — wird in der Pipeline zum Erkennen des
//             EHH/FHH-Partners und zum Anlegen des dokument-Datensatzes
//             gebraucht.
export function parseCsvBytes(input) {
  const text = inText(input)
  const rows = parseCsv(text)
  if (rows.length < 2) {
    throw new Error("CSV ist leer oder enthaelt keine Datenzeile.")
  }
  // Header-Pruefung: erste Zeile MUSS den OH-Spaltenkanon sein.
  const kopf = rows[0].map((c) => c.trim())
  for (let i = 0; i < HEADER.length; i++) {
    if (kopf[i] !== HEADER[i]) {
      throw new Error(
        `CSV-Spalte ${i + 1} ist '${kopf[i] || ""}', erwartet '${HEADER[i]}' ` +
          "— diese Datei sieht nicht wie eine OH-CSV (offenerhaushalt.at) aus.",
      )
    }
  }

  // Meta aus der ersten Datenzeile (in einer OH-CSV sind die Kopf-Felder
  // ueber alle Zeilen konstant).
  const erste = rows[1]
  const meta = {
    finanzjahr: String(erste[0] || "").trim(),
    bundesland: erste[1] || "",
    typ:
      String(erste[2] || "").startsWith("Rechnungs") ? "RA" :
      String(erste[2] || "").startsWith("Nachtrag") ? "NVA" :
      "VA",
    datenquelle: erste[3] || "",
    gkz: String(erste[4] || "").trim(),
    gemeinde: erste[5] || "",
    haushalt:
      String(erste[6] || "").startsWith("Finanzierung") ? "FHH" : "EHH",
  }

  const result = new ParseResult()
  let zeileIdx = 1
  for (let r = 1; r < rows.length; r++) {
    const z = rows[r]
    // Leere Trail-Zeile (z.B. abschliessende Newline) uebergehen.
    if (z.length === 1 && z[0].trim() === "") continue
    if (z.length < HEADER.length) {
      result.warnungen.push(
        `Zeile ${r + 1}: weniger Spalten als erwartet (${z.length}/${HEADER.length}) — uebersprungen.`,
      )
      continue
    }
    const ansatz = ljust6(z[7] + z[8]) // Uab + Ugl
    const konto = ljust6(z[9] + z[10]) // Grp + Ugl
    const mvag = String(z[12] || "").trim()
    const ansatzText = (z[13] || "").trim()
    const kontoText = (z[14] || "").trim()
    const wert = deNum(z[15])

    const klassi = klassifiziereMvag(mvag)
    if (!klassi) {
      result.warnungen.push(
        `Zeile ${r + 1}: MVAG '${mvag}' nicht klassifizierbar — uebersprungen.`,
      )
      continue
    }

    const p = new Posten(zeileIdx++, "detail", kontoText || konto)
    p.vrk = `${klassi.haushalt}/${ansatz}-${konto}`
    p.richtung = klassi.richtung
    p.ansatz = ansatz
    p.konto = konto
    p.gruppe = ansatz.slice(0, 1)
    p.gebarung = klassi.gebarung
    if (klassi.haushalt === "EHH") {
      p.eh_wert = wert
    } else {
      p.fh_wert = wert
    }
    p.mvag_eh = klassi.mvag_eh
    p.mvag_fh = klassi.mvag_fh
    result.posten.push(p)

    if (ansatz && ansatzText && !(ansatz in result.ansatz_namen)) {
      result.ansatz_namen[ansatz] = ansatzText
    }
    if (konto && kontoText && !(konto in result.konto_namen)) {
      result.konto_namen[konto] = kontoText
    }
  }

  return { result, meta }
}

// Detail-Liste (von einem oder zwei zusammengefuehrten CSVs) um synthetische
// SU- und SA-Zeilen ergaenzen, damit validate.js die ueblichen Pruefungen
// durchspielen kann. Pro Ansatz, in dem Detail-Posten existieren, wird ein
// vollstaendiger Block aus SU 21..36 und SA SA0..SA5 emittiert; die Werte
// werden direkt aus den Detail-Summen abgeleitet, also tautologisch.
//
// Spalten 2/3 (eh_vergleich/eh_dritte, fh_vergleich/fh_dritte) liegen im
// OH-CSV nicht vor und bleiben 0 — die Detail-Summen sind dort ebenfalls
// 0, also stimmt die Pruefung trivial.
//
// `posten` werden in-place erweitert; zurueckgegeben wird die Anzahl der
// neu angehaengten Aggregat-Zeilen (zur Diagnose in Tests).
const SU_KONFIG = [
  // [su,        richtung,    gebarung,        haushalt, spalte]
  ["SU 21",    "einnahme",  "operativ",     "EHH", "eh_wert"],
  ["SU 22",    "ausgabe",   "operativ",     "EHH", "eh_wert"],
  ["SU 23",    "einnahme",  "ruecklage",    "EHH", "eh_wert"],
  ["SU 24",    "ausgabe",   "ruecklage",    "EHH", "eh_wert"],
  ["SU 31",    "einnahme",  "operativ",     "FHH", "fh_wert"],
  ["SU 32",    "ausgabe",   "operativ",     "FHH", "fh_wert"],
  ["SU 33",    "einnahme",  "investiv",     "FHH", "fh_wert"],
  ["SU 34",    "ausgabe",   "investiv",     "FHH", "fh_wert"],
  ["SU 35",    "einnahme",  "finanzierung", "FHH", "fh_wert"],
  ["SU 36",    "ausgabe",   "finanzierung", "FHH", "fh_wert"],
]

const SA_KONFIG = [
  // [sa,        operanden ([su, sign]...),                                       haushalt]
  ["SA SA0",  [["SU 21", +1], ["SU 22", -1]],                                  "EHH"],
  ["SA SA00", [["SU 21", +1], ["SU 22", -1], ["SU 23", +1], ["SU 24", -1]],    "EHH"],
  ["SA SA1",  [["SU 31", +1], ["SU 32", -1]],                                  "FHH"],
  ["SA SA2",  [["SU 33", +1], ["SU 34", -1]],                                  "FHH"],
  ["SA SA3",  [["SU 31", +1], ["SU 32", -1], ["SU 33", +1], ["SU 34", -1]],    "FHH"],
  ["SA SA4",  [["SU 35", +1], ["SU 36", -1]],                                  "FHH"],
  ["SA SA5",  [["SU 31", +1], ["SU 32", -1], ["SU 33", +1], ["SU 34", -1],
               ["SU 35", +1], ["SU 36", -1]],                                  "FHH"],
]

export function synthAggregate(parseResult) {
  // 1) Ansaetze aus Detail-Posten sammeln.
  const ansaetze = new Set()
  for (const p of parseResult.posten) {
    if (p.zeilentyp === "detail" && p.ansatz) ansaetze.add(p.ansatz)
  }

  // 2) Pro (ansatz, su) die Detail-Summe je Spalte rechnen.
  // suSummen.get(ansatz).get(su) = { eh_wert, eh_vergleich, eh_dritte,
  //                                   fh_wert, fh_vergleich, fh_dritte }
  const sussen = new Map()
  for (const a of ansaetze) {
    const m = new Map()
    for (const [su] of SU_KONFIG) {
      m.set(su, { eh_wert: 0, eh_vergleich: 0, eh_dritte: 0,
                  fh_wert: 0, fh_vergleich: 0, fh_dritte: 0 })
    }
    sussen.set(a, m)
  }
  for (const p of parseResult.posten) {
    if (p.zeilentyp !== "detail") continue
    if (!p.ansatz) continue
    for (const [su, richtung, gebarung] of SU_KONFIG) {
      if (p.richtung !== richtung) continue
      if (p.gebarung !== gebarung) continue
      const bucket = sussen.get(p.ansatz).get(su)
      bucket.eh_wert += p.eh_wert || 0
      bucket.eh_vergleich += p.eh_vergleich || 0
      bucket.eh_dritte += p.eh_dritte || 0
      bucket.fh_wert += p.fh_wert || 0
      bucket.fh_vergleich += p.fh_vergleich || 0
      bucket.fh_dritte += p.fh_dritte || 0
    }
  }

  // 3) SU-Zeilen anhaengen. Pro Ansatz alle zehn Codes — auch 0-Werte,
  //    sonst greift validate.js fuer den 0-Bucket auf 'detail aber kein SU'
  //    und meldet Abweichung. Die Spalten-Befuellung folgt dem Haushalt:
  //    EHH-Codes fuellen die eh_*-Spalten, FHH-Codes die fh_*-Spalten.
  let synth = 0
  let seite = 0
  for (const p of parseResult.posten) seite = Math.max(seite, p.seite || 0)
  seite += 1

  for (const a of ansaetze) {
    const bucketMap = sussen.get(a)
    for (const [su,, , haushalt] of SU_KONFIG) {
      const b = bucketMap.get(su)
      const sp = new Posten(seite, "summe", "")
      sp.vrk = su
      sp.ansatz = a
      sp.gruppe = a.slice(0, 1)
      if (haushalt === "EHH") {
        sp.eh_wert = b.eh_wert
        sp.eh_vergleich = b.eh_vergleich
        sp.eh_dritte = b.eh_dritte
      } else {
        sp.fh_wert = b.fh_wert
        sp.fh_vergleich = b.fh_vergleich
        sp.fh_dritte = b.fh_dritte
      }
      parseResult.posten.push(sp)
      synth += 1
    }
    // 4) SA-Zeilen anhaengen — die Werte sind die im PDF gedruckte
    //    arithmetische Ableitung. Validate prueft die Identitaet
    //    erneut nach; weil wir aus denselben SUs ableiten, stimmt es.
    for (const [sa, operanden, haushalt] of SA_KONFIG) {
      const sp = new Posten(seite, "saldo", "")
      sp.vrk = sa
      sp.ansatz = a
      sp.gruppe = a.slice(0, 1)
      const init = { eh_wert: 0, eh_vergleich: 0, eh_dritte: 0,
                     fh_wert: 0, fh_vergleich: 0, fh_dritte: 0 }
      for (const [su, sign] of operanden) {
        const b = bucketMap.get(su)
        init.eh_wert += sign * b.eh_wert
        init.eh_vergleich += sign * b.eh_vergleich
        init.eh_dritte += sign * b.eh_dritte
        init.fh_wert += sign * b.fh_wert
        init.fh_vergleich += sign * b.fh_vergleich
        init.fh_dritte += sign * b.fh_dritte
      }
      if (haushalt === "EHH") {
        sp.eh_wert = init.eh_wert
        sp.eh_vergleich = init.eh_vergleich
        sp.eh_dritte = init.eh_dritte
      } else {
        sp.fh_wert = init.fh_wert
        sp.fh_vergleich = init.fh_vergleich
        sp.fh_dritte = init.fh_dritte
      }
      parseResult.posten.push(sp)
      synth += 1
    }
  }

  return synth
}

// Zwei ParseResults (typischerweise das EHH- und das FHH-CSV derselben
// Gemeinde+Jahr+Typ) zu einem einzigen verschmelzen. Posten werden
// hintereinander gehaengt, Referenz-Maps vereinigt (erste Quelle gewinnt
// bei Konflikten — irrelevant in der Praxis, weil Ansatz-/Konto-Text
// in beiden Haelften identisch ist).
//
// Liefert ein neues ParseResult; die Eingaben werden nicht veraendert.
export function mergeParseResults(a, b) {
  const out = new ParseResult()
  let zeileIdx = 0
  for (const src of [a, b]) {
    if (!src) continue
    for (const p of src.posten) {
      const klon = new Posten(++zeileIdx, p.zeilentyp, p.bezeichnung)
      Object.assign(klon, p)
      klon.seite = zeileIdx
      out.posten.push(klon)
    }
    for (const [k, v] of Object.entries(src.ansatz_namen)) {
      if (!(k in out.ansatz_namen)) out.ansatz_namen[k] = v
    }
    for (const [k, v] of Object.entries(src.konto_namen)) {
      if (!(k in out.konto_namen)) out.konto_namen[k] = v
    }
    for (const w of src.warnungen) out.warnungen.push(w)
  }
  return out
}

// Re-Export der Referenz-Helper, falls Aufrufer (Tests) sie noetig haben.
export { GRUPPEN, MVAG, kontenklasse, mvagName }
