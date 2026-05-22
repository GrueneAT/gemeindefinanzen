// Referenzskript: belegt, dass mupdf.js dieselbe Wort-Geometrie liefert wie
// PyMuPDF. Aus den Zeichen einer Seite werden Woerter rekonstruiert und die
// rechten Kanten der sechs Betragsspalten gegen die in parser.py vermessenen
// Konstanten geprueft.
//
// Lauf: node scripts/mupdf-geometrie.mjs
//
// mupdf ist ein ESM-Modul mit Top-Level-await — nur per import nutzbar.

import * as mupdf from "mupdf"
import { readFileSync } from "node:fs"

const PDF = "documents/VA-2026-Auflage.pdf"
const SEITE = 205
const REFERENZ = [463.7, 526.1, 588.4, 662.1, 724.5, 786.9]

const doc = mupdf.Document.openDocument(readFileSync(PDF), "application/pdf")
console.log(`${PDF}: ${doc.countPages()} Seiten erkannt`)

const page = doc.loadPage(SEITE)

// Zeichen einsammeln, zu Woertern gruppieren (wie PyMuPDF 'words').
const chars = []
page.toStructuredText().walk({
  onChar(c, origin, font, size, quad) {
    // quad: [ulx,uly, urx,ury, llx,lly, lrx,lry]
    chars.push({ c, x0: quad[0], y0: quad[1], x1: quad[2], y1: quad[5] })
  },
})

chars.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
const words = []
let cur = null
let lastY = null
for (const ch of chars) {
  const neueZeile = lastY === null || Math.abs(ch.y0 - lastY) > 3
  const luecke = cur && ch.x0 - cur.x1 > 1.2
  if (ch.c === " " || neueZeile || luecke) {
    if (cur) words.push(cur)
    cur = null
  }
  if (ch.c === " ") { lastY = ch.y0; continue }
  if (!cur) cur = { text: "", x0: ch.x0, y0: ch.y0, x1: ch.x1, y1: ch.y1 }
  cur.text += ch.c
  cur.x1 = ch.x1
  cur.y1 = ch.y1
  lastY = ch.y0
}
if (cur) words.push(cur)

const kw = words.find((w) => w.text === "Kommunalsteuer")
if (!kw) { console.error("Kommunalsteuer-Zeile nicht gefunden"); process.exit(1) }
const zeile = words
  .filter((w) => Math.abs(w.y0 - kw.y0) < 3)
  .sort((a, b) => a.x0 - b.x0)

console.log("\nKommunalsteuer-Zeile, Woerter (text @ x0..x1):")
for (const w of zeile) {
  console.log(`  ${w.text.padEnd(18)} x0=${w.x0.toFixed(1)} x1=${w.x1.toFixed(1)}`)
}

const betraege = zeile.filter((w) => /^[\d.]+,\d\d$/.test(w.text))
const x1 = betraege.map((w) => Number(w.x1.toFixed(1)))
console.log("\nPyMuPDF-Referenz Spalten-x1:", REFERENZ.join(" "))
console.log("mupdf.js Betrags-x1:       ", x1.join(" "))

const passt = x1.length === REFERENZ.length &&
  x1.every((v, i) => Math.abs(v - REFERENZ[i]) <= 0.15)
console.log(passt ? "\nOK — Geometrie identisch zu PyMuPDF" : "\nFEHLER — Abweichung")
process.exit(passt ? 0 : 1)
