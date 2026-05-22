// Tiefebene PDF-Extraktion — JavaScript-Port von src/gemeindefinanzen/extract.py.
//
// Kapselt mupdf.js. Liefert je Seite die Woerter mit Koordinaten und gruppiert
// sie zu Zeilen. Die fachliche Interpretation passiert in parser.js.
//
// mupdf.js liefert dieselbe Wort-Geometrie wie PyMuPDF (siehe web/POC.md).
// Aus toStructuredText().walk() gewonnene Zeichen werden zu Woertern
// rekonstruiert — das asJSON()-Format liefert nur grobe Zeilen-bboxes.
//
// Das Modul ist umgebungsneutral: die mupdf-Instanz wird hereingereicht, damit
// derselbe Code in Node (Tests) und im Browser laeuft.

const JAHR_RE = /\b(20\d{2})\b/
const SEITE_RE = /^Seite\s+\d+$/

// Wort-Rekonstruktion: PoC-Werte (web/POC.md). Zeichen mit y-Abstand <= Y_TOL
// liegen in derselben Zeile; ein x-Abstand > GAP_TOL trennt zwei Woerter.
const Y_TOL = 3.0
const GAP_TOL = 1.2

// Ein Textwort mit Bounding-Box (PDF-Koordinaten, Ursprung oben links).
export class Word {
  constructor(text, x0, y0, x1, y1) {
    this.text = text
    this.x0 = x0
    this.y0 = y0
    this.x1 = x1
    this.y1 = y1
  }
}

// Eine visuelle Tabellenzeile: nach x sortierte Woerter mit gemeinsamer y-Lage.
export class Line {
  constructor(y, words) {
    this.y = y
    this.words = words
  }

  get text() {
    return this.words.map((w) => w.text).join(" ")
  }
}

// PDF aus einem Uint8Array/ArrayBuffer oeffnen.
export function openDocument(mupdf, data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  return mupdf.Document.openDocument(bytes, "application/pdf")
}

// Abschnittsgrenzen aus den PDF-Lesezeichen.
// Ergebnis: { abschnittstitel: [erste_seite, letzte_seite] } (0-basiert,
// letzte_seite als Index der letzten zugehoerigen Seite).
export function sectionRanges(doc) {
  let outline
  try {
    outline = doc.loadOutline()
  } catch {
    outline = null
  }
  const tops = []
  if (Array.isArray(outline)) {
    for (const node of outline) {
      const titel = (node.title || "").trim()
      if (titel && typeof node.page === "number") {
        tops.push([titel, node.page])
      }
    }
  }
  const ranges = {}
  const last = doc.countPages() - 1
  for (let i = 0; i < tops.length; i++) {
    const [titel, start] = tops[i]
    const end = i + 1 < tops.length ? tops[i + 1][1] - 1 : last
    ranges[titel] = [start, end]
  }
  return ranges
}

// Laengsten zusammenhaengenden Lauf aus einer aufsteigenden Indexliste.
// Eine vereinzelte Erwaehnung (Inhaltsverzeichnis, Vorbericht) bildet keinen
// Lauf und faellt so heraus. Ergebnis: [erste, letzte] oder null.
export function laengsterLauf(seiten) {
  if (seiten.length === 0) return null
  let bestStart = seiten[0]
  let bestEnd = seiten[0]
  let curStart = seiten[0]
  let curEnd = seiten[0]
  for (let i = 1; i < seiten.length; i++) {
    if (seiten[i] === curEnd + 1) {
      curEnd = seiten[i]
    } else {
      curStart = seiten[i]
      curEnd = seiten[i]
    }
    if (curEnd - curStart > bestEnd - bestStart) {
      bestStart = curStart
      bestEnd = curEnd
    }
  }
  return [bestStart, bestEnd]
}

// Ist `nadel` im Volltext einer Seite enthalten? Billiger Test ohne Wort-
// und Zeilenrekonstruktion — fuer den Abschnitts-Fallback gedacht.
function pageEnthaelt(doc, pageIndex, nadel) {
  let buf = ""
  doc.loadPage(pageIndex).toStructuredText().walk({
    onChar(c) {
      buf += c
    },
  })
  return buf.includes(nadel)
}

// Fallback, wenn ein PDF keine Lesezeichen hat: den Detailnachweis-Abschnitt
// ueber die laufende Seitenkopfzeile finden. Jede Seite des Abschnitts traegt
// im Kopf den Text "Detailnachweis". Ergebnis: [erste, letzte] (0-basiert)
// oder null, wenn keine solche Seite existiert.
export function detailnachweisRangeByText(doc) {
  const treffer = []
  const n = doc.countPages()
  for (let p = 0; p < n; p++) {
    if (pageEnthaelt(doc, p, "Detailnachweis")) treffer.push(p)
  }
  return laengsterLauf(treffer)
}

// Zeichen einer Seite einsammeln und zu Woertern rekonstruieren.
//
// mupdf strukturiert den Text als Baum Block -> Zeile -> Zeichen. Die
// Wort-Rekonstruktion respektiert die Zeilengrenzen aus walk() — ein globales
// Sortieren der Zeichen wuerde Spalten mit leicht versetzter Grundlinie
// (Grundlinien-Jitter im PDF) ineinanderschieben. Innerhalb einer mupdf-Zeile
// kommen die Zeichen in Lesereihenfolge; getrennt wird bei Leerzeichen oder
// einer x-Luecke > GAP_TOL.
function pageWords(page) {
  const words = []
  let cur = null

  const wortAbschliessen = () => {
    if (cur) {
      words.push(cur)
      cur = null
    }
  }

  page.toStructuredText().walk({
    beginLine() {
      wortAbschliessen()
    },
    endLine() {
      wortAbschliessen()
    },
    onChar(c, origin, font, size, quad) {
      // quad: [ulx,uly, urx,ury, llx,lly, lrx,lry]
      const x0 = quad[0]
      const y0 = quad[1]
      const x1 = quad[2]
      const y1 = quad[5]
      const luecke = cur && x0 - cur.x1 > GAP_TOL
      if (c === " " || luecke) {
        wortAbschliessen()
      }
      if (c === " ") return
      if (!cur) cur = new Word("", x0, y0, x1, y1)
      cur.text += c
      cur.x1 = x1
      cur.y1 = y1
    },
  })
  wortAbschliessen()
  return words.filter((w) => w.text.trim() !== "")
}

// Woerter einer Seite zu Zeilen gruppieren (gleiche y-Lage = gleiche Zeile).
export function pageLines(doc, pageIndex, yTol = Y_TOL) {
  const page = doc.loadPage(pageIndex)
  const words = pageWords(page)
  words.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)

  const lines = []
  for (const w of words) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(w.y0 - last.y) <= yTol) {
      last.words.push(w)
    } else {
      lines.push(new Line(w.y0, [w]))
    }
  }
  for (const ln of lines) {
    ln.words.sort((a, b) => a.x0 - b.x0)
  }
  return lines
}

// Reinen Text einer Seite zeilenweise gewinnen (fuer document_meta).
function pageText(doc, pageIndex) {
  return pageLines(doc, pageIndex).map((ln) => ln.text)
}

// Gemeinde, Dokumenttyp, Finanzjahr aus dem Seitenkopf ableiten.
export function documentMeta(doc) {
  const meta = { gemeinde: "", typ: "", finanzjahr: "", fassung: "" }
  const grenze = Math.min(6, doc.countPages())
  const zeilen = []
  for (let p = 0; p < grenze; p++) {
    zeilen.push(...pageText(doc, p))
  }

  for (const roh of zeilen) {
    const s = roh.trim()
    const istGemeinde =
      s.includes("Stadtgemeinde") ||
      s.includes("Marktgemeinde") ||
      s.startsWith("Gemeinde ")
    if (!meta.gemeinde && istGemeinde) {
      meta.gemeinde = s
    }
    if (!meta.typ) {
      const low = s.toLowerCase()
      // NVA und RA zuerst pruefen — "Voranschlag" ist Teil von
      // "Nachtragsvoranschlag".
      let typ = ""
      if (low.includes("nachtragsvoranschlag")) typ = "NVA"
      else if (low.includes("rechnungsabschluss")) typ = "RA"
      else if (low.includes("voranschlag")) typ = "VA"
      const jahr = JAHR_RE.exec(s)
      if (typ && jahr) {
        meta.typ = typ
        meta.finanzjahr = jahr[1]
      }
    }
  }
  return meta
}

export { SEITE_RE }
