// VRV-2015-Parser fuer den Detailnachweis — JavaScript-Port von parser.py.
//
// Der Detailnachweis ist das vollstaendige Kerndatenblatt: jede einzelne
// Haushaltsstelle mit Ergebnis- und Finanzierungshaushalt. Alle anderen
// Tabellen sind Aggregationen davon. Deshalb parst dieses Modul nur den
// Detailnachweis — daraus laesst sich der Rest nachrechnen (siehe validate.js).
//
// Robustheit: Die sechs Betragsspalten sind im PDF exakt rechtsbuendig
// ausgerichtet (konstante rechte Kante x1). Jedes Zahlwort wird ueber seine
// rechte Kante der richtigen Spalte zugeordnet — unabhaengig davon, wie viele
// Spalten in einer Zeile befuellt sind.

import { openDocument, sectionRanges, pageLines, Word } from "./extract.js"

// --- Geometrie (aus VA-2026-Auflage.pdf vermessen, A4 quer) -----------------
// Rechte Kante (x1) der sechs Betragsspalten: EH VA / EH VA-VJ / EH RA-VJ |
//                                             FH VA / FH VA-VJ / FH RA-VJ
export const AMOUNT_X1 = [463.7, 526.1, 588.4, 662.1, 724.5, 786.9]
const AMOUNT_TOL = 7.0

const X_CODE_MAX = 130.0 // Konto-/Summencode
const X_LABEL_MAX = 280.0 // Bezeichnung
const X_MVAG_FH = 304.0 // Grenze MVAG-EH | MVAG-FH
const X_MVAG_MAX = 326.0 // Grenze MVAG | VC/QU
const Y_HEADER = 90.0 // darueber: Seitenkopf
const Y_FOOTER = 558.0 // darunter: Seitenfuss

// Detailzeilen-Schluessel '<typ>/<ansatz>±<konto>'.
// Das Konto ist sechsstellig; manche Gemeinden fassen die Personalkonten je
// Ansatz zu einer verdichteten Zeile mit verkuerztem Konto zusammen (z.B.
// '1/439000-5' = Personalkonten verdichtet), daher 1-6 Stellen zugelassen.
const DETAIL_RE = /^(\d)\/(\d{6})([+-])(\d{1,6})$/
// Vollstaendiger Betrag: gepunktet ('47.800,00') oder bereits zusammengezogen
// ('47800,00') — letzteres entsteht beim Zusammenfuehren aufgeteilter Fragmente.
const NUMBER_RE = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$|^-?\d+,\d{2}$/
const SEITE_RE = /^Seite\s+\d+$/

// Zahlfragmente fuer die Vor-Aufbereitung aufgeteilter Betraege. Manche PDFs
// rendern eine tausendergetrennte Zahl als mehrere Textfragmente statt als ein
// Wort (z.B. '47' + '800,00'). Fragmente sind reine Ziffernbloecke
// ('-?\d{1,3}') oder ein abschliessender Block mit Nachkommastellen.
const FRAG_HEAD_RE = /^-?\d{1,3}$/
const FRAG_TAIL_RE = /^\d{3},\d{2}$/
// Maximaler horizontaler Abstand (pt) zwischen zwei Fragmenten derselben Zahl.
// Gemessen: zahlinterne Luecken ~2 pt, Luecken zwischen Betragsspalten >=17 pt.
const FRAG_GAP_MAX = 6.0
const GEBARUNG_LABELS = {
  "operative gebarung": "operativ",
  "investive gebarung": "investiv",
  finanzierungstaetigkeit: "finanzierung",
  "finanzierungstätigkeit": "finanzierung",
}

// Eine Zeile des Detailnachweises (Detailposten, Summe oder Saldo).
export class Posten {
  constructor(seite, zeilentyp, bezeichnung) {
    this.seite = seite
    this.zeilentyp = zeilentyp // 'detail' | 'summe' | 'saldo'
    this.bezeichnung = bezeichnung
    this.vrk = "" // voller Schluessel '2/920000+833000' bzw. Summencode
    this.richtung = null // 'einnahme' | 'ausgabe'
    this.ansatz = null
    this.konto = null
    this.gruppe = null
    this.gebarung = null
    this.eh_wert = null // Spalte 1 (Ergebnishaushalt)
    this.eh_vergleich = null // Spalte 2
    this.eh_dritte = null // Spalte 3
    this.fh_wert = null // Spalte 1 (Finanzierungshaushalt)
    this.fh_vergleich = null // Spalte 2
    this.fh_dritte = null // Spalte 3
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

// Deutschen Betrag ('4.900.000,00', '-374.800,00') als Zahl lesen.
function num(text) {
  if (!NUMBER_RE.test(text)) return null
  return Number(text.replace(/\./g, "").replace(",", "."))
}

// Ist der Text ein moegliches Fragment einer aufgeteilten Zahl?
function istFragment(text) {
  return FRAG_HEAD_RE.test(text) || FRAG_TAIL_RE.test(text) || NUMBER_RE.test(text)
}

// Aufgeteilte Betraege vor der Spaltenzuordnung wieder zusammenfuehren.
//
// Manche PDFs rendern '47.800,00' als zwei Woerter '47' und '800,00'. Liegen
// zwei Zahlfragmente horizontal dicht beieinander (Abstand <= FRAG_GAP_MAX),
// gehoeren sie zur selben Zahl. Die Fragmenttexte werden direkt verkettet
// ('47' + '800,00' -> '47800,00'); num() liest die zusammengezogene Form.
// Das synthetische Wort behaelt x0 des ersten und x1 des letzten Fragments,
// sodass die rechtskantige Spaltenzuordnung unveraendert weiterfunktioniert.
//
// Die Eingabe ist nach x0 sortiert (siehe extract.pageLines).
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
      // Ein abgeschlossenes Fragment (Nachkommastellen) beendet den Cluster.
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

// Betragswort ueber seine rechte Kante einer der sechs Spalten zuordnen.
function amountColumn(x1) {
  for (let idx = 0; idx < AMOUNT_X1.length; idx++) {
    if (Math.abs(x1 - AMOUNT_X1[idx]) <= AMOUNT_TOL) return idx
  }
  return null
}

// Sechs Betragsspalten einer Zeile fuellen (null = leer).
function collectAmounts(words) {
  const cols = [null, null, null, null, null, null]
  for (const w of words) {
    const value = num(w.text)
    if (value === null) continue
    const col = amountColumn(w.x1)
    if (col !== null) cols[col] = value
  }
  return cols
}

// Woerter einer Zeile nach x-Lage den logischen Spalten zuordnen.
function splitColumns(words) {
  const buckets = {
    code: [],
    label: [],
    mvag_eh: [],
    mvag_fh: [],
    qu: [],
    amount: [],
  }
  for (const w of words) {
    if (num(w.text) !== null && amountColumn(w.x1) !== null) {
      buckets.amount.push(w)
    } else if (w.x0 < X_CODE_MAX) {
      buckets.code.push(w)
    } else if (w.x0 < X_LABEL_MAX) {
      buckets.label.push(w)
    } else if (w.x0 < X_MVAG_FH) {
      buckets.mvag_eh.push(w)
    } else if (w.x0 < X_MVAG_MAX) {
      buckets.mvag_fh.push(w)
    } else {
      buckets.qu.push(w)
    }
  }
  return buckets
}

// Reine Ziffern aus einer Wortgruppe zusammenziehen.
function digits(words) {
  return words
    .filter((w) => /^\d+$/.test(w.text))
    .map((w) => w.text)
    .join("")
}

// Ist der String eine reine, nicht leere Ziffernfolge? (Pendant zu str.isdigit)
function isDigitString(s) {
  return s.length > 0 && /^\d+$/.test(s)
}

// Den Detailnachweis einer VRV-2015-PDF vollstaendig parsen.
// `doc` ist ein mit extract.openDocument geoeffnetes mupdf-Dokument.
export function parseDocument(doc) {
  const sections = sectionRanges(doc)

  let detailSection = null
  for (const [titel, rng] of Object.entries(sections)) {
    if (titel.includes("Detailnachweis")) {
      detailSection = rng
      break
    }
  }
  if (detailSection === null) {
    throw new Error(
      "Kein Abschnitt 'Detailnachweis' im PDF-Inhaltsverzeichnis gefunden.",
    )
  }
  const [start, end] = detailSection

  const result = new ParseResult()
  let curAnsatz = null
  let curGebarung = null
  let lastDetail = null

  for (let page = start; page <= end; page++) {
    for (const line of pageLines(doc, page)) {
      if (line.y < Y_HEADER || line.y > Y_FOOTER) continue
      if (line.words.length === 0) continue
      const text = line.text.trim()
      if (SEITE_RE.test(text)) continue

      // Aufgeteilte Betraege ('47' + '800,00') wieder zusammenfuehren,
      // bevor die Spaltenzuordnung greift.
      const words = mergeNumberFragments(line.words)
      const first = words[0].text
      const buckets = splitColumns(words)
      const label = buckets.label
        .map((w) => w.text)
        .join(" ")
        .trim()

      // 1) Detailposten -----------------------------------------------------
      const m = DETAIL_RE.exec(first)
      if (m) {
        const ansatz = m[2]
        const sign = m[3]
        const konto = m[4]
        const amounts = collectAmounts(buckets.amount)
        const posten = new Posten(page + 1, "detail", label)
        posten.vrk = first
        posten.richtung = sign === "+" ? "einnahme" : "ausgabe"
        posten.ansatz = ansatz
        posten.konto = konto
        posten.gruppe = ansatz.slice(0, 1)
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
        // Haushaltsruecklagen-Bewegungen (MVAG 230 Entnahme / 240 Zufuehrung)
        // stehen ausserhalb der operativen Gebarung — sie speisen den Saldo
        // (01) und gehoeren nicht in die SU-21/22-Summe.
        if (
          posten.mvag_eh.startsWith("230") ||
          posten.mvag_eh.startsWith("240")
        ) {
          posten.gebarung = "ruecklage"
        }
        result.posten.push(posten)
        lastDetail = posten
        if (label && !(konto in result.konto_namen)) {
          result.konto_namen[konto] = label
        }
        continue
      }

      // 2) Summen- und Saldozeilen -----------------------------------------
      if (first.startsWith("SU") || first.startsWith("SA")) {
        const amounts = collectAmounts(buckets.amount)
        const code = buckets.code.map((w) => w.text).join(" ")
        const posten = new Posten(
          page + 1,
          first.startsWith("SU") ? "summe" : "saldo",
          label,
        )
        posten.vrk = code
        posten.ansatz = curAnsatz
        posten.gruppe = curAnsatz ? curAnsatz.slice(0, 1) : null
        posten.gebarung = curGebarung
        posten.eh_wert = amounts[0]
        posten.eh_vergleich = amounts[1]
        posten.eh_dritte = amounts[2]
        posten.fh_wert = amounts[3]
        posten.fh_vergleich = amounts[4]
        posten.fh_dritte = amounts[5]
        result.posten.push(posten)
        lastDetail = null
        continue
      }

      // 3) Ansatz-/Gruppenkopf (reiner Zahlencode in der Codespalte) -------
      if (
        isDigitString(first) &&
        first.length >= 1 &&
        first.length <= 6 &&
        buckets.amount.length === 0
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
        lastDetail !== null &&
        label &&
        buckets.code.length === 0 &&
        buckets.amount.length === 0
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
