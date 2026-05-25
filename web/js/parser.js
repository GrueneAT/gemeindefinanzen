// VRV-2015-Parser fuer den Detailnachweis — JavaScript-Port von parser.py.
//
// Der Detailnachweis ist das vollstaendige Kerndatenblatt: jede einzelne
// Haushaltsstelle mit Ergebnis- und Finanzierungshaushalt. Alle anderen
// Tabellen sind Aggregationen davon. Deshalb parst dieses Modul nur den
// Detailnachweis — daraus laesst sich der Rest nachrechnen (siehe validate.js).
//
// **Mehrere Layout-Familien:** Verschiedene Software-Anbieter und Bundeslaender
// emittieren den VRV-Detailnachweis mit leicht unterschiedlicher Geometrie und
// Schluessel-Syntax. ``LayoutCfg`` parametrisiert die Geometrie pro Dokument,
// ``detectLayout(doc, range)`` waehlt die richtige Variante:
//
// - "standard" (Herzogenburg-Familie): 1-Wort-Schluessel `1/210000-728100`.
// - "salzburg" (Wels/Stadt Salzburg): 3-5stelliger Ansatz im Seitenheader,
//   Detailzeile beginnt mit Mittelherkunft-Indikator + 6stelligem Konto.
// - "2wort" (Burgenland/Vorau/Innsbruck/Bregenz): Ansatz und Konto als zwei
//   getrennte Wortspalten; Richtung aus Konten-/Block-MVAG-Heuristik.
// - Steyr-Slash und "/N"-Suffix sind in DETAIL_RE inline-erfasst.
//
// Die Spalten-x1 werden pro Dokument auto-kalibriert, falls das
// Standard-Tupel nicht passt.

import {
  openDocument,
  sectionRanges,
  detailnachweisRangeByText,
  pageLines,
  Word,
} from "./extract.js"

// --- Standard-Geometrie (aus VA-2026-Auflage.pdf vermessen, A4 quer) -------
// Rechte Kante (x1) der sechs Betragsspalten: EH VA / EH VA-VJ / EH RA-VJ |
//                                             FH VA / FH VA-VJ / FH RA-VJ
export const AMOUNT_X1 = [463.7, 526.1, 588.4, 662.1, 724.5, 786.9]
const AMOUNT_TOL = 7.0

const X_CODE_MAX = 130.0 // Konto-/Summencode
const X_LABEL_MAX = 280.0 // Bezeichnung
const X_MVAG_FH = 304.0 // Grenze MVAG-EH | MVAG-FH
const X_MVAG_MAX = 326.0 // Grenze MVAG | VC/QU
const Y_HEADER = 90.0 // darueber: Seitenkopf
// Y_FOOTER wird je Seite dynamisch berechnet (page_height - Y_FOOTER_MARGIN).
const Y_FOOTER_MARGIN = 37.0

// Detailzeilen-Schluessel '<typ>/<ansatz><sep><konto>'. Trenner:
//   '+' = Einnahme, '-' = Ausgabe (Herzogenburg-Standard)
//   '/' = neutral (Steyr-Variante; Richtung aus Mittelherkunft-Ziffer)
// 4-stellige Ansaetze/Konten kommen bei Bregenz/Hohenems vor.
// Optionaler '/N'-Suffix bei Klosterneuburg-Variante.
const DETAIL_RE = /^(\d)\/(\d{4,6})([+\-/])(\d{1,6})(?:\/\d+)?$/
const NUMBER_RE = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$|^-?\d+,\d{2}$/
const SEITE_RE = /^Seite\s+\d+$/

// Zahlfragmente fuer die Vor-Aufbereitung aufgeteilter Betraege.
const FRAG_HEAD_RE = /^-?\d{1,3}$/
const FRAG_TAIL_RE = /^\d{3},\d{2}$/
const FRAG_GAP_MAX = 6.0

// 2-Wort-Detail-Pattern: zwei aufeinanderfolgende 5- oder 6-stellige Tokens
// als Ansatz und Konto.
const TWO_WORD_KEY_RE = /^\d{5,6}$/

// Salzburg-/Wels-Header: 3-5 stellige Ansatznummer im Seitenkopf.
const SALZBURG_ANSATZ_RE = /^(\d{3,5})$/

const GEBARUNG_LABELS = {
  "operative gebarung": "operativ",
  "investive gebarung": "investiv",
  finanzierungstaetigkeit: "finanzierung",
  "finanzierungstätigkeit": "finanzierung",
}

// Layout-Konfiguration fuer ein konkretes PDF. Werte ausgehend von Default
// (Herzogenburg) — ``detectLayout`` ueberschreibt sie wo noetig.
export class LayoutCfg {
  constructor() {
    this.name = "standard"
    this.amount_x1 = AMOUNT_X1.slice()
    this.amount_tol = AMOUNT_TOL
    this.x_code_max = X_CODE_MAX
    this.x_konto_max = X_CODE_MAX // im 2-Wort-Modus rechte Grenze der Konto-Spalte
    this.x_label_max = X_LABEL_MAX
    this.x_mvag_fh = X_MVAG_FH
    this.x_mvag_max = X_MVAG_MAX
    this.y_header = Y_HEADER
    this.y_footer_margin = Y_FOOTER_MARGIN
    this.mode = "standard" // standard | 2wort | salzburg
  }
}

// Eine Zeile des Detailnachweises (Detailposten, Summe oder Saldo).
export class Posten {
  constructor(seite, zeilentyp, bezeichnung) {
    this.seite = seite
    this.zeilentyp = zeilentyp
    this.bezeichnung = bezeichnung
    this.vrk = ""
    this.richtung = null
    this.ansatz = null
    this.konto = null
    this.gruppe = null
    this.gebarung = null
    this.eh_wert = null
    this.eh_vergleich = null
    this.eh_dritte = null
    this.fh_wert = null
    this.fh_vergleich = null
    this.fh_dritte = null
    this.mvag_eh = ""
    this.mvag_fh = ""
    this.qu = ""
  }
}

export class ParseResult {
  constructor() {
    this.posten = []
    this.ansatz_namen = {}
    this.konto_namen = {}
    this.warnungen = []
  }
}

function num(text) {
  if (!NUMBER_RE.test(text)) return null
  return Number(text.replace(/\./g, "").replace(",", "."))
}

function istFragment(text) {
  return FRAG_HEAD_RE.test(text) || FRAG_TAIL_RE.test(text) || NUMBER_RE.test(text)
}

function ljust6(s) {
  return s.length >= 6 ? s : s + "0".repeat(6 - s.length)
}

// VRV-2015 Konvention: 1/5 = Ausgabe, 2/6 = Einnahme.
function richtungAusMittelherkunft(typDigit) {
  return typDigit === "2" || typDigit === "6" ? "einnahme" : "ausgabe"
}

// Aufgeteilte Betraege ('47' + '800,00') wieder zusammenfuehren.
export function mergeNumberFragments(words) {
  if (words.length < 2) return words
  const merged = []
  let i = 0
  while (i < words.length) {
    const cluster = [words[i]]
    let j = i + 1
    while (j < words.length) {
      const vorgaenger = cluster[cluster.length - 1]
      const kandidat = words[j]
      const gap = kandidat.x0 - vorgaenger.x1
      if (FRAG_TAIL_RE.test(vorgaenger.text) || NUMBER_RE.test(vorgaenger.text)) {
        break
      }
      if (
        gap >= 0 &&
        gap <= FRAG_GAP_MAX &&
        istFragment(vorgaenger.text) &&
        istFragment(kandidat.text)
      ) {
        cluster.push(kandidat)
        j += 1
      } else {
        break
      }
    }
    if (cluster.length > 1) {
      const last = cluster[cluster.length - 1]
      merged.push(
        new Word(
          cluster.map((w) => w.text).join(""),
          cluster[0].x0,
          cluster[0].y0,
          last.x1,
          last.y1,
        ),
      )
    } else {
      merged.push(cluster[0])
    }
    i = j > i + 1 ? j : i + 1
  }
  return merged
}

function amountColumn(x1, cfg) {
  for (let idx = 0; idx < cfg.amount_x1.length; idx++) {
    if (Math.abs(x1 - cfg.amount_x1[idx]) <= cfg.amount_tol) return idx
  }
  return null
}

function collectAmounts(words, cfg) {
  const cols = [null, null, null, null, null, null]
  for (const w of words) {
    const value = num(w.text)
    if (value === null) continue
    const col = amountColumn(w.x1, cfg)
    if (col !== null) cols[col] = value
  }
  return cols
}

// Woerter einer Zeile nach x-Lage den logischen Spalten zuordnen.
// Im 2-Wort-Modus liegt die Konto-Spalte zwischen x_code_max und x_konto_max
// (z.B. Vorau: Ansatz x0~45, Konto x0~215).
function splitColumns(words, cfg) {
  const buckets = {
    code: [], label: [], mvag_eh: [], mvag_fh: [], qu: [], amount: [],
  }
  for (const w of words) {
    if (num(w.text) !== null && amountColumn(w.x1, cfg) !== null) {
      buckets.amount.push(w)
    } else if (w.x0 < cfg.x_code_max) {
      buckets.code.push(w)
    } else if (cfg.mode === "2wort" && w.x0 < cfg.x_konto_max && /^\d+$/.test(w.text)) {
      buckets.code.push(w)
    } else if (w.x0 < cfg.x_label_max) {
      buckets.label.push(w)
    } else if (w.x0 < cfg.x_mvag_fh) {
      buckets.mvag_eh.push(w)
    } else if (w.x0 < cfg.x_mvag_max) {
      buckets.mvag_fh.push(w)
    } else {
      buckets.qu.push(w)
    }
  }
  return buckets
}

function digits(words) {
  return words.filter((w) => /^\d+$/.test(w.text)).map((w) => w.text).join("")
}

function isDigitString(s) {
  return s.length > 0 && /^\d+$/.test(s)
}

// --- Auto-Kalibrierung / Layout-Detection ---------------------------------

function samplePages(start, end, n) {
  const span = Math.max(end - start, 1)
  const samples = []
  const nReal = Math.min(n, span)
  for (let i = 0; i < nReal; i++) {
    samples.push(start + 1 + Math.floor((span - 1) * i / nReal))
  }
  return [...new Set(samples)].sort((a, b) => a - b)
}

// Sechs Spalten-x1 aus einem Histogram der Zahl-x1 messen.
function calibrateColumns(doc, pageRange, cfg) {
  const [start, end] = pageRange
  if (end <= start) return null
  const samples = samplePages(start, end, 5)
  if (samples.length === 0) return null

  // 0.5-pt-Bins fuer Robustheit
  const bins = new Map()
  for (const pg of samples) {
    const pageHeight = doc.loadPage(pg).getBounds()[3]
    const yFooter = pageHeight - cfg.y_footer_margin
    for (const line of pageLines(doc, pg)) {
      if (line.y < cfg.y_header || line.y > yFooter) continue
      for (const w of line.words) {
        if (num(w.text) !== null) {
          const key = Math.round(w.x1 * 2) / 2
          bins.set(key, (bins.get(key) || 0) + 1)
        }
      }
    }
  }

  // Cluster bilden (Abstand <= 1.5 pt)
  const sorted = [...bins.entries()].sort((a, b) => b[1] - a[1])
  const clusters = [] // [mittelwert, count]
  for (const [x, n] of sorted) {
    let merged = false
    for (let i = 0; i < clusters.length; i++) {
      const [cx, cn] = clusters[i]
      if (Math.abs(x - cx) <= 1.5) {
        clusters[i] = [(cx * cn + x * n) / (cn + n), cn + n]
        merged = true
        break
      }
    }
    if (!merged) clusters.push([x, n])
  }
  if (clusters.length < 6) return null
  clusters.sort((a, b) => b[1] - a[1])
  const top6 = clusters.slice(0, 6).map((c) => c[0]).sort((a, b) => a - b)
  for (let i = 0; i < 5; i++) {
    if (top6[i + 1] - top6[i] < 30) return null
  }
  return top6.map((x) => Math.round(x * 10) / 10)
}

// Salzburg-/Wels-Modus: 1/2/5/6 + 6-stelliges Konto als erste zwei Worte.
function detectSalzburgMode(doc, pageRange, cfg) {
  const [start, end] = pageRange
  const samples = samplePages(start, end, 3)
  let hits = 0
  for (const pg of samples) {
    const pageHeight = doc.loadPage(pg).getBounds()[3]
    const yFooter = pageHeight - cfg.y_footer_margin
    for (const line of pageLines(doc, pg)) {
      if (line.y < cfg.y_header || line.y > yFooter) continue
      const ws = line.words
      if (ws.length < 2) continue
      if (
        ["1", "2", "5", "6"].includes(ws[0].text) &&
        ws[0].x0 < cfg.x_code_max &&
        TWO_WORD_KEY_RE.test(ws[1].text) &&
        ws[1].x0 < cfg.x_code_max
      ) {
        hits++
      }
    }
  }
  return hits >= 8
}

// 2-Wort-Modus: zwei aufeinanderfolgende 5/6-stellige Tokens als Ansatz+Konto.
function detectTwoWordMode(doc, pageRange, cfg) {
  const [start, end] = pageRange
  if (end - start <= 1) return false
  const samples = samplePages(start, end, 8)
  let oneWordHits = 0
  let twoWordHits = 0
  const kontoX0s = []
  for (const pg of samples) {
    const pageHeight = doc.loadPage(pg).getBounds()[3]
    const yFooter = pageHeight - cfg.y_footer_margin
    for (const line of pageLines(doc, pg)) {
      if (line.y < cfg.y_header || line.y > yFooter) continue
      if (line.words.length === 0) continue
      const first = line.words[0]
      if (first.x0 >= cfg.x_code_max) continue
      if (DETAIL_RE.test(first.text)) {
        oneWordHits++
      } else if (
        TWO_WORD_KEY_RE.test(first.text) &&
        line.words.length >= 2 &&
        TWO_WORD_KEY_RE.test(line.words[1].text) &&
        line.words[1].x0 < cfg.x_label_max
      ) {
        twoWordHits++
        kontoX0s.push(line.words[1].x0)
      }
    }
  }
  if (twoWordHits > oneWordHits && twoWordHits >= 3 && kontoX0s.length > 0) {
    kontoX0s.sort((a, b) => a - b)
    const median = kontoX0s[Math.floor(kontoX0s.length / 2)]
    cfg.x_konto_max = median + 25
    return true
  }
  return false
}

export function detectLayout(doc, pageRange) {
  const cfg = new LayoutCfg()
  if (detectSalzburgMode(doc, pageRange, cfg)) {
    cfg.mode = "salzburg"
  } else if (detectTwoWordMode(doc, pageRange, cfg)) {
    cfg.mode = "2wort"
  }
  const kalibriert = calibrateColumns(doc, pageRange, cfg)
  if (kalibriert) cfg.amount_x1 = kalibriert
  return cfg
}

// Block-MVAG-Header-Erkennung — '2 2224/3224 ...' oder '2 2224 3224 ...' oder
// '2 3325 ...' (nur ein MVAG-Code, EHH oder FHH erkennbar am Praefix).
function istBlockMvag(words, cfg) {
  if (words.length < 2 || words[0].x0 >= cfg.x_code_max) return false
  if (!["1", "2", "5", "6"].includes(words[0].text)) return false
  const second = words[1].text
  if (/^\d{3,4}\/\d{3,4}$/.test(second)) return true
  if (/^\d{3,4}$/.test(second)) return true
  return false
}

function parseBlockMvag(words) {
  const second = words[1].text
  if (second.includes("/")) {
    const [eh, fh] = second.split("/", 2)
    return [eh, fh]
  }
  if (words.length > 2 && /^\d{3,4}$/.test(words[2].text)) {
    return [second, words[2].text]
  }
  if (second.startsWith("3")) return ["", second]
  return [second, ""]
}

// Salzburg-/Wels-Seitenheader: Ansatznummer als Block-Titel.
function salzburgHeaderAnsatz(doc, page) {
  const kandidaten = []
  for (const line of pageLines(doc, page)) {
    if (line.y >= Y_HEADER) break
    for (const w of line.words) {
      const m = SALZBURG_ANSATZ_RE.exec(w.text)
      if (m) {
        const code = m[1]
        // Jahreszahlen 19xx/20xx ausschliessen
        if (!(code.length === 4 && (code.startsWith("19") || code.startsWith("20")))) {
          kandidaten.push(code)
        }
      }
    }
  }
  if (kandidaten.length === 0) return null
  return kandidaten[0].padStart(6, "0")
}

function buildPosten(seite, vrk, label, ansatz, konto, richtung, amounts, buckets, curGebarung) {
  const posten = new Posten(seite, "detail", label)
  posten.vrk = vrk
  posten.richtung = richtung
  posten.ansatz = ansatz
  posten.konto = konto
  posten.gruppe = ansatz ? ansatz.slice(0, 1) : null
  posten.gebarung = curGebarung
  posten.eh_wert = amounts[0]
  posten.eh_vergleich = amounts[1]
  posten.eh_dritte = amounts[2]
  posten.fh_wert = amounts[3]
  posten.fh_vergleich = amounts[4]
  posten.fh_dritte = amounts[5]
  posten.mvag_eh = digits(buckets.mvag_eh)
  posten.mvag_fh = digits(buckets.mvag_fh)
  posten.qu = digits(buckets.qu)
  if (posten.mvag_eh.startsWith("230") || posten.mvag_eh.startsWith("240")) {
    posten.gebarung = "ruecklage"
  }
  return posten
}

// Detailzeile gemaess Layout-Modus parsen.
function tryParseDetail(words, buckets, label, cfg, curAnsatz, curGebarung, seite,
                       curBlockMvagEh, curBlockMvagFh) {
  const first = words[0].text

  // 1-Wort-Schluessel (Standard, Steyr) — in jedem Modus
  const m = DETAIL_RE.exec(first)
  if (m) {
    const typDigit = m[1]
    let ansatz = m[2]
    const sign = m[3]
    let konto = m[4]
    ansatz = ljust6(ansatz)
    konto = ljust6(konto)
    let richtung
    if (sign === "+") richtung = "einnahme"
    else if (sign === "-") richtung = "ausgabe"
    else richtung = richtungAusMittelherkunft(typDigit)
    const amounts = collectAmounts(buckets.amount, cfg)
    return buildPosten(seite, first, label, ansatz, konto, richtung, amounts, buckets, curGebarung)
  }

  // 2-Wort-Schluessel
  if (cfg.mode === "2wort" && words.length >= 2) {
    if (
      TWO_WORD_KEY_RE.test(first) && words[0].x0 < cfg.x_code_max &&
      TWO_WORD_KEY_RE.test(words[1].text) && words[1].x0 < cfg.x_konto_max &&
      buckets.amount.length > 0
    ) {
      const ansatz2w = ljust6(first)
      const konto2w = ljust6(words[1].text)
      const ersteziffer = konto2w[0]
      const zweiziffer = konto2w.slice(0, 2)
      const dreiziffer = konto2w.slice(0, 3)
      let richtung, typDigit
      if (dreiziffer === "803" || dreiziffer === "808") {
        richtung = "einnahme"; typDigit = "6"
      } else if (zweiziffer === "89") {
        richtung = "einnahme"; typDigit = "2"
      } else if (curGebarung === "investiv") {
        if (ersteziffer === "3" || ersteziffer === "8") {
          richtung = "einnahme"; typDigit = "6"
        } else { richtung = "ausgabe"; typDigit = "5" }
      } else if (curGebarung === "finanzierung") {
        if (ersteziffer === "3") { richtung = "einnahme"; typDigit = "6" }
        else { richtung = "ausgabe"; typDigit = "5" }
      } else {
        if (["4", "5", "6", "7"].includes(ersteziffer)) { richtung = "ausgabe"; typDigit = "1" }
        else if (ersteziffer === "8") { richtung = "einnahme"; typDigit = "2" }
        else if (ersteziffer === "0" || ersteziffer === "1") { richtung = "ausgabe"; typDigit = "5" }
        else if (ersteziffer === "3") { richtung = "einnahme"; typDigit = "6" }
        else { richtung = "ausgabe"; typDigit = "1" }
      }
      const amounts = collectAmounts(buckets.amount, cfg)
      const vrk = `${typDigit}/${ansatz2w}-${konto2w}`
      const posten = buildPosten(seite, vrk, label, ansatz2w, konto2w, richtung, amounts, buckets, curGebarung)
      // 89x → Ruecklage-MVAG setzen
      if (konto2w.startsWith("89")) {
        if (!posten.mvag_eh) posten.mvag_eh = "230"
        posten.gebarung = "ruecklage"
      }
      if (!posten.mvag_eh && curBlockMvagEh) posten.mvag_eh = curBlockMvagEh
      if (!posten.mvag_fh && curBlockMvagFh) posten.mvag_fh = curBlockMvagFh
      return posten
    }
  }

  // Salzburg-Modus: Mittelherkunft + Konto, Ansatz aus Header
  if (cfg.mode === "salzburg" && words.length >= 2 && curAnsatz) {
    if (
      ["1", "2", "5", "6"].includes(first) &&
      words[0].x0 < cfg.x_code_max &&
      TWO_WORD_KEY_RE.test(words[1].text) &&
      words[1].x0 < cfg.x_code_max &&
      buckets.amount.length > 0
    ) {
      const typDigit = first
      const kontoSb = words[1].text
      const richtung = richtungAusMittelherkunft(typDigit)
      const amounts = collectAmounts(buckets.amount, cfg)
      const vrk = `${typDigit}/${curAnsatz}-${kontoSb}`
      return buildPosten(seite, vrk, label, curAnsatz, kontoSb, richtung, amounts, buckets, curGebarung)
    }
  }

  return null
}

// Den Detailnachweis einer VRV-2015-PDF vollstaendig parsen.
export function parseDocument(doc) {
  const sections = sectionRanges(doc)

  let detailSection = null
  for (const [titel, rng] of Object.entries(sections)) {
    if (titel.includes("Detailnachweis")) {
      detailSection = rng
      break
    }
  }
  // TOC-Lesezeichen markieren bei einigen Gemeinden nur den ABSCHNITTS-
  // ANFANG; Text-Fallback ist dann der laengere Range.
  if (detailSection === null || detailSection[1] - detailSection[0] < 10) {
    const textRange = detailnachweisRangeByText(doc)
    if (textRange) {
      if (!detailSection ||
          textRange[1] - textRange[0] > detailSection[1] - detailSection[0]) {
        detailSection = textRange
      }
    }
  }
  if (detailSection === null) {
    throw new Error(
      "Kein Detailnachweis-Abschnitt gefunden — weder in den " +
        "PDF-Lesezeichen noch ueber die Seitenkopfzeilen.",
    )
  }
  const [start, end] = detailSection

  const cfg = detectLayout(doc, [start, end])

  const result = new ParseResult()
  let curAnsatz = null
  let curGebarung = null
  let curBlockMvagEh = ""
  let curBlockMvagFh = ""
  let lastDetail = null

  for (let page = start; page <= end; page++) {
    const pageHeight = doc.loadPage(page).getBounds()[3]
    const yFooter = pageHeight - cfg.y_footer_margin
    if (cfg.mode === "salzburg") {
      const ansatzAusHeader = salzburgHeaderAnsatz(doc, page)
      if (ansatzAusHeader) curAnsatz = ansatzAusHeader
    }
    for (const line of pageLines(doc, page)) {
      if (line.y < cfg.y_header || line.y > yFooter) continue
      if (line.words.length === 0) continue
      const text = line.text.trim()
      if (SEITE_RE.test(text)) continue

      const words = mergeNumberFragments(line.words)
      const first = words[0].text
      const buckets = splitColumns(words, cfg)
      const label = buckets.label.map((w) => w.text).join(" ").trim()

      // 0) Block-MVAG-Header (Aggregations-Zwischenzeile) -------------------
      if (istBlockMvag(words, cfg)) {
        const [eh, fh] = parseBlockMvag(words)
        if (lastDetail !== null) {
          if (eh && !lastDetail.mvag_eh) lastDetail.mvag_eh = eh
          if (fh && !lastDetail.mvag_fh) lastDetail.mvag_fh = fh
          // Richtung aus MVAG ableiten
          if (fh && fh[0] === "3" && fh.length >= 2) {
            if (["1", "3", "5"].includes(fh[1])) lastDetail.richtung = "einnahme"
            else if (["2", "4", "6"].includes(fh[1])) lastDetail.richtung = "ausgabe"
          } else if (eh && eh[0] === "2" && eh.length >= 2) {
            if (eh[1] === "1") lastDetail.richtung = "einnahme"
            else if (eh[1] === "2") lastDetail.richtung = "ausgabe"
          }
          if (lastDetail.mvag_eh && (lastDetail.mvag_eh.startsWith("230") ||
                                     lastDetail.mvag_eh.startsWith("240"))) {
            lastDetail.gebarung = "ruecklage"
          }
        }
        if (cfg.mode === "2wort") {
          if (eh) curBlockMvagEh = eh
          if (fh) curBlockMvagFh = fh
        }
        lastDetail = null
        continue
      }

      // 1) Detailposten -----------------------------------------------------
      const posten = tryParseDetail(words, buckets, label, cfg, curAnsatz, curGebarung,
                                    page + 1, curBlockMvagEh, curBlockMvagFh)
      if (posten !== null) {
        // Beim Ansatz-Wechsel im 2-Wort-Modus Block-MVAG-State zuruecksetzen
        if (cfg.mode === "2wort" && posten.ansatz && posten.ansatz !== curAnsatz) {
          curBlockMvagEh = ""
          curBlockMvagFh = ""
          if (["230", "240", "23", "24"].includes(posten.mvag_eh) &&
              posten.gebarung === "ruecklage") {
            posten.mvag_eh = ""
            posten.gebarung = "operativ"
          }
          if (["341", "342", "351", "361"].includes(posten.mvag_fh)) {
            posten.mvag_fh = ""
          }
        }
        result.posten.push(posten)
        lastDetail = posten
        if (cfg.mode === "2wort" && posten.ansatz) curAnsatz = posten.ansatz
        if (posten.konto && posten.bezeichnung) {
          if (!(posten.konto in result.konto_namen)) {
            result.konto_namen[posten.konto] = posten.bezeichnung
          }
          if (posten.ansatz && !(posten.ansatz in result.ansatz_namen)) {
            result.ansatz_namen[posten.ansatz] = ""
          }
        }
        continue
      }

      // 2) Summen- und Saldozeilen -----------------------------------------
      if (first.startsWith("SU") || first.startsWith("SA")) {
        const amounts = collectAmounts(buckets.amount, cfg)
        const code = buckets.code.map((w) => w.text).join(" ")
        const sp = new Posten(page + 1, first.startsWith("SU") ? "summe" : "saldo", label)
        sp.vrk = code
        sp.ansatz = curAnsatz
        sp.gruppe = curAnsatz ? curAnsatz.slice(0, 1) : null
        sp.gebarung = curGebarung
        sp.eh_wert = amounts[0]; sp.eh_vergleich = amounts[1]; sp.eh_dritte = amounts[2]
        sp.fh_wert = amounts[3]; sp.fh_vergleich = amounts[4]; sp.fh_dritte = amounts[5]
        result.posten.push(sp)
        lastDetail = null
        continue
      }

      // 3) Ansatz-/Gruppenkopf (reiner Zahlencode in der Codespalte) -------
      if (
        isDigitString(first) && first.length >= 1 && first.length <= 6 &&
        buckets.amount.length === 0 && words[0].x0 < cfg.x_code_max
      ) {
        if (first.length === 6) {
          curAnsatz = first
          curGebarung = null
          if (label) result.ansatz_namen[first] = label
        }
        lastDetail = null
        continue
      }

      // 4) Gebarungs-Kontext -----------------------------------------------
      const key = text.toLowerCase()
      if (key in GEBARUNG_LABELS) {
        curGebarung = GEBARUNG_LABELS[key]
        lastDetail = null
        continue
      }

      // 5) Fortsetzungszeile (umgebrochene Bezeichnung) --------------------
      if (
        lastDetail !== null && label &&
        buckets.code.length === 0 && buckets.amount.length === 0
      ) {
        lastDetail.bezeichnung = `${lastDetail.bezeichnung} ${label}`.trim()
        if (lastDetail.konto) {
          result.konto_namen[lastDetail.konto] = lastDetail.bezeichnung
        }
        continue
      }
    }
  }

  if (result.posten.length === 0) {
    result.warnungen.push("Keine Posten geparst — Geometrie pruefen.")
  }
  return result
}

// Bequemer Einstieg: PDF-Bytes -> ParseResult.
export function parseDocumentBytes(mupdf, data) {
  const doc = openDocument(mupdf, data)
  return parseDocument(doc)
}
