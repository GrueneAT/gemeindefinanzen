import * as mupdf from "mupdf"
import { readFileSync } from "fs"
const doc = mupdf.Document.openDocument(readFileSync("/workspace/documents/VA-2026-Auflage.pdf"), "application/pdf")
const page = doc.loadPage(205)

// Zeichen einsammeln, zu Woertern gruppieren (wie PyMuPDF 'words')
const chars = []
page.toStructuredText().walk({
  onChar(c, origin, font, size, quad) {
    // quad: [ulx,uly, urx,ury, llx,lly, lrx,lry]
    chars.push({ c, x0: quad[0], y0: quad[1], x1: quad[2], y1: quad[5] })
  }
})
// nach Zeile (y) gruppieren, dann Woerter per Luecke/Leerzeichen trennen
chars.sort((a,b)=> a.y0-b.y0 || a.x0-b.x0)
const words = []
let cur = null, lastY = null
for (const ch of chars) {
  const newLine = lastY===null || Math.abs(ch.y0-lastY) > 3
  const gap = cur && (ch.x0 - cur.x1) > 1.2
  if (ch.c === " " || newLine || gap) { if (cur) words.push(cur); cur=null }
  if (ch.c === " ") { lastY=ch.y0; continue }
  if (!cur) cur = { text:"", x0:ch.x0, y0:ch.y0, x1:ch.x1, y1:ch.y1 }
  cur.text += ch.c; cur.x1=ch.x1; cur.y1=ch.y1
  lastY = ch.y0
}
if (cur) words.push(cur)

// Kommunalsteuer-Zeile finden
const kw = words.find(w => w.text==="Kommunalsteuer")
const row = words.filter(w => Math.abs(w.y0-kw.y0) < 3).sort((a,b)=>a.x0-b.x0)
console.log("Kommunalsteuer-Zeile, Woerter (text @ x0..x1):")
for (const w of row) console.log(`  ${w.text.padEnd(18)} x0=${w.x0.toFixed(1)} x1=${w.x1.toFixed(1)}`)
console.log()
console.log("PyMuPDF-Referenz Spalten-x1: 463.7 526.1 588.4 662.1 724.5 786.9")
const nums = row.filter(w => /^[\d.]+,\d\d$/.test(w.text))
console.log("mupdf.js Betrags-x1:        " + nums.map(w=>w.x1.toFixed(1)).join(" "))
