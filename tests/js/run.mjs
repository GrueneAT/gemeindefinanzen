// JS-Testlauf der Browser-App — gegen die Python-Pipeline als Referenz.
//
// Die Tests fahren die vollstaendige Verarbeitung (Extraktion, Parsing,
// Validierung, Datenhaltung, Dashboard-Daten) in Node ueber die vier echten
// PDFs in documents/ und pruefen die Ergebnisse gegen Erwartungswerte, die
// aus dem Python-Parser/-Validator/-Report stammen.
//
// Lauf:  npm run test:js   bzw.   node tests/js/run.mjs

import sqlite3InitModule from "@sqlite.org/sqlite-wasm"
import * as mupdf from "mupdf"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { openDocument, documentMeta, sectionRanges } from "../../web/js/extract.js"
import { parseDocumentBytes } from "../../web/js/parser.js"
import { validate, pruefStatus } from "../../web/js/validate.js"
import { spalten } from "../../web/js/loader.js"
import { oeffneDb } from "../../web/js/db.js"
import { verarbeitePdf } from "../../web/js/pipeline.js"
import { collect } from "../../web/js/dashboard-data.js"
import { alleCharts } from "../../web/js/dashboard-charts.js"

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const DOCS = join(WURZEL, "documents")

let bestanden = 0
let fehlgeschlagen = 0

function pruefe(name, bedingung, detail = "") {
  if (bedingung) {
    bestanden++
    console.log(`  OK   ${name}`)
  } else {
    fehlgeschlagen++
    console.log(`  FEHL ${name}${detail ? " — " + detail : ""}`)
  }
}

// Erwartungswerte aus der Python-Pipeline (parser.py / validate.py).
// Anzahl Detail-/Summe-/Saldoposten je Dokument.
const ERWARTET = {
  "NVA-2025-Auflage.pdf": { detail: 1254, summe: 702, saldo: 819 },
  "RA 2024-Auflage.pdf": { detail: 1395, summe: 798, saldo: 684 },
  "RA-2025-Auflage.pdf": { detail: 1358, summe: 777, saldo: 666 },
  "VA-2026-Auflage.pdf": { detail: 1408, summe: 690, saldo: 805 },
}

function pdfBytes(name) {
  return new Uint8Array(readFileSync(join(DOCS, name)))
}

async function teste() {
  const pdfs = readdirSync(DOCS)
    .filter((f) => f.endsWith(".pdf"))
    .sort()

  console.log("loader.spalten — Spaltenbedeutung je Dokumenttyp")
  pruefe(
    "VA",
    JSON.stringify(spalten("VA", 2026)) ===
      JSON.stringify(["VA 2026", "VA 2025", "RA 2024"]),
  )
  pruefe(
    "RA",
    JSON.stringify(spalten("RA", 2025)) ===
      JSON.stringify(["RA 2025", "VA 2025", "Abweichung RA-VA"]),
  )
  pruefe(
    "NVA",
    JSON.stringify(spalten("NVA", 2025)) ===
      JSON.stringify(["VA 2025 inkl. NVA", "VA 2025", "1. NVA"]),
  )

  console.log("\nextract — Metadaten und Abschnittsgrenzen")
  const va = openDocument(mupdf, pdfBytes("VA-2026-Auflage.pdf"))
  const meta = documentMeta(va)
  pruefe("Gemeinde erkannt", meta.gemeinde.includes("Herzogenburg"), meta.gemeinde)
  pruefe("Typ VA", meta.typ === "VA", meta.typ)
  pruefe("Finanzjahr 2026", meta.finanzjahr === "2026", meta.finanzjahr)
  const sections = sectionRanges(va)
  const detail = Object.entries(sections).find(([t]) =>
    t.includes("Detailnachweis"),
  )
  pruefe("Detailnachweis-Abschnitt gefunden", detail !== undefined)

  console.log("\nparser — Posten je Dokument (Referenz: Python-Parser)")
  for (const f of pdfs) {
    const erw = ERWARTET[f]
    if (!erw) continue
    const r = parseDocumentBytes(mupdf, pdfBytes(f))
    const ist = {
      detail: r.posten.filter((p) => p.zeilentyp === "detail").length,
      summe: r.posten.filter((p) => p.zeilentyp === "summe").length,
      saldo: r.posten.filter((p) => p.zeilentyp === "saldo").length,
    }
    pruefe(
      `${f}`,
      ist.detail === erw.detail &&
        ist.summe === erw.summe &&
        ist.saldo === erw.saldo,
      `erwartet ${JSON.stringify(erw)}, ist ${JSON.stringify(ist)}`,
    )
  }

  console.log("\nvalidate — Plausibilitaetspruefung (Referenz: 5/5 je Dokument)")
  let valideGesamt = 0
  for (const f of pdfs) {
    const r = parseDocumentBytes(mupdf, pdfBytes(f))
    const status = pruefStatus(validate(r))
    valideGesamt += status.ok
    pruefe(
      `${f} — ${status.ok}/${status.gesamt}`,
      status.bestanden,
      JSON.stringify(status),
    )
  }
  pruefe("Gesamt 20/20 Pruefungen", valideGesamt === 20, `${valideGesamt}/20`)

  console.log("\npipeline + db — Verarbeitung in die SQLite-DB")
  const db = await oeffneDb(sqlite3InitModule)
  db.schemaAnwenden(readFileSync(join(WURZEL, "web/schema.sql"), "utf8"))
  for (const f of pdfs) {
    const res = await verarbeitePdf(mupdf, db, f, pdfBytes(f))
    pruefe(`${f} verarbeitet`, res.status.bestanden, JSON.stringify(res.status))
  }
  // sql/-Abfrage unveraendert ausfuehrbar
  const eckwerte = db.abfrage(
    readFileSync(join(WURZEL, "web/sql/01-eckwerte.sql"), "utf8"),
  )
  pruefe(
    "sql/01-eckwerte.sql liefert 4 Zeilen",
    eckwerte.length === 4,
    `${eckwerte.length}`,
  )
  // VA 2026: Nettoergebnis 474200 (Referenz: Python-Pipeline)
  const va2026 = eckwerte.find((r) => r.dokument === "VA 2026")
  pruefe(
    "VA 2026 Nettoergebnis == 474200",
    va2026 && Math.round(va2026.nettoergebnis) === 474200,
    va2026 ? String(va2026.nettoergebnis) : "fehlt",
  )

  console.log("\ndashboard — DATA/CFG-Aufbau")
  const daten = collect(db)
  pruefe("DATA: 4 Dokumente", daten.meta.dok_anzahl === 4)
  pruefe("DATA: 5415 Posten", daten.meta.posten_anzahl === 5415,
    String(daten.meta.posten_anzahl))
  const cfg = alleCharts(daten)
  pruefe(
    "CFG: dok_charts je Dokument",
    Object.keys(cfg.dok_charts).length === 4,
  )
  pruefe("CFG: trend_charts vorhanden", "trend_eck" in cfg.trend_charts)

  console.log("\ndb — Persistenz-Guard ohne IndexedDB (Node-Umgebung)")
  // In Node ist `indexedDB` undefiniert; oeffneDb muss dann eine reine
  // In-Memory-DB liefern (persistent=false) und sichern() darf nicht werfen.
  pruefe("oeffneDb ohne IndexedDB: persistent=false", db.persistent === false)
  const gesichert = await db.sichern()
  pruefe("sichern() ohne IndexedDB ist folgenlos", gesichert === false)
  db.close()

  // Optionaler Abgleich mit einer Python-Referenzdatei, falls vorhanden.
  const refData = join(WURZEL, "tests/js/referenz-data.json")
  if (existsSync(refData)) {
    const py = JSON.parse(readFileSync(refData, "utf8"))
    pruefe(
      "DATA gleich Python-Referenz",
      JSON.stringify(daten) === JSON.stringify(py),
    )
  }

  console.log(
    `\n${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`,
  )
  process.exit(fehlgeschlagen === 0 ? 0 : 1)
}

teste().catch((e) => {
  console.error("Testlauf abgebrochen:", e)
  process.exit(1)
})
