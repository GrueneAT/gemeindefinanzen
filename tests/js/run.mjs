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
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import {
  openDocument,
  documentMeta,
  sectionRanges,
  laengsterLauf,
} from "../../web/js/extract.js"
import { parseDocumentBytes, mergeNumberFragments } from "../../web/js/parser.js"
import { validate, pruefStatus } from "../../web/js/validate.js"
import { spalten } from "../../web/js/loader.js"
import { oeffneDb, importBytes } from "../../web/js/db.js"
import { verarbeitePdf } from "../../web/js/pipeline.js"
import { collect } from "../../web/js/dashboard-data.js"
import { alleCharts } from "../../web/js/dashboard-charts.js"
import {
  buildSankeyOption,
  quelleVonPosten,
  kappen,
  TOP_N,
} from "../../web/js/sankey-drill.js"

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

// Fest gepinnte Herzogenburg-Fixtures: der Test darf NICHT den ganzen
// documents/-Ordner globben, sonst verschieben zusaetzliche PDFs anderer
// Gemeinden die Erwartungswerte (4 Dokumente, 20/20, 5415 Posten).
const FIXTURES = Object.keys(ERWARTET).sort()

function pdfBytes(name) {
  return new Uint8Array(readFileSync(join(DOCS, name)))
}

// Hilfswort mit gegebener Lage; x1 ergibt sich aus einer fixen Zeichenbreite.
function wort(text, x0) {
  return { text, x0, y0: 0.0, x1: x0 + 4.0 * text.length, y1: 8.0 }
}

// Einheitstests fuer das Zusammenfuehren aufgeteilter Zahlfragmente.
function testeFragmentMerge() {
  // Zwei Fragmente: '47' + '800,00' -> '47800,00'.
  const zwei = mergeNumberFragments([wort("47", 430.0), wort("800,00", 440.0)])
  pruefe(
    "zwei Fragmente -> 47800,00",
    zwei.length === 1 && zwei[0].text === "47800,00",
    JSON.stringify(zwei.map((w) => w.text)),
  )
  // Drei Fragmente: '1' + '234' + '567,00' -> '1234567,00'.
  const drei = mergeNumberFragments([
    wort("1", 400.0),
    wort("234", 406.0),
    wort("567,00", 420.0),
  ])
  pruefe(
    "drei Fragmente -> 1234567,00",
    drei.length === 1 && drei[0].text === "1234567,00",
    JSON.stringify(drei.map((w) => w.text)),
  )
  // Negatives Fragment: '-5' + '100,00' -> '-5100,00'.
  const neg = mergeNumberFragments([wort("-5", 400.0), wort("100,00", 410.0)])
  pruefe(
    "negatives Fragment -> -5100,00",
    neg.length === 1 && neg[0].text === "-5100,00",
    JSON.stringify(neg.map((w) => w.text)),
  )
  // Ganzes Zahlwort bleibt unveraendert.
  const ganz = mergeNumberFragments([wort("4.900.000,00", 400.0)])
  pruefe(
    "ganzes Zahlwort unveraendert",
    ganz.length === 1 && ganz[0].text === "4.900.000,00",
    JSON.stringify(ganz.map((w) => w.text)),
  )
  // Kleine ungeteilte Zahl bleibt unveraendert.
  const klein = mergeNumberFragments([wort("300,00", 440.0)])
  pruefe(
    "kleine ungeteilte Zahl unveraendert",
    klein.length === 1 && klein[0].text === "300,00",
    JSON.stringify(klein.map((w) => w.text)),
  )
  // Spaltengrenze: zwei Betraege mit Luecke ~18 pt bleiben getrennt.
  const grenze = mergeNumberFragments([
    { text: "800,00", x0: 440.0, y0: 0.0, x1: 463.7, y1: 8.0 },
    { text: "100,00", x0: 502.7, y0: 0.0, x1: 526.1, y1: 8.0 },
  ])
  pruefe(
    "Spaltengrenze trennt zwei Betraege",
    grenze.length === 2 &&
      grenze[0].text === "800,00" &&
      grenze[1].text === "100,00",
    JSON.stringify(grenze.map((w) => w.text)),
  )
}

// Einheitstests fuer laengsterLauf — Grundlage des Abschnitts-Fallbacks fuer
// PDFs ohne Lesezeichen.
function testeLaengsterLauf() {
  const faelle = [
    [[], null, "leere Liste -> null"],
    [[5], [5, 5], "einzelne Seite"],
    [[3, 4, 5], [3, 5], "ein zusammenhaengender Lauf"],
    [[1, 5, 6, 7, 8, 20], [5, 8], "vereinzelte Erwaehnungen fallen heraus"],
    [[10, 11, 13, 14, 15], [13, 15], "der laengere Lauf gewinnt"],
    [[1, 2, 4, 5], [1, 2], "bei Gleichstand gewinnt der erste Lauf"],
  ]
  for (const [eingabe, erwartet, name] of faelle) {
    const ist = laengsterLauf(eingabe)
    pruefe(
      name,
      JSON.stringify(ist) === JSON.stringify(erwartet),
      `erwartet ${JSON.stringify(erwartet)}, ist ${JSON.stringify(ist)}`,
    )
  }
}

async function teste() {
  const pdfs = FIXTURES

  console.log("parser.mergeNumberFragments — aufgeteilte Betraege zusammenfuehren")
  testeFragmentMerge()

  console.log("\nextract.laengsterLauf — laengsten zusammenhaengenden Seitenlauf")
  testeLaengsterLauf()

  console.log("\nloader.spalten — Spaltenbedeutung je Dokumenttyp")
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

  console.log("\nsankey-drill — Geldfluss-Drill-down")
  // quelleVonPosten — Portierung der CASE-Logik aus dashboard-data.js.
  pruefe(
    "quelleVonPosten: 833000 -> Kommunalsteuer",
    quelleVonPosten({ konto: "833000", mvag: "" }) === "Kommunalsteuer",
  )
  pruefe(
    "quelleVonPosten: 859400 -> Ertragsanteile (Bund)",
    quelleVonPosten({ konto: "859400", mvag: "" }) ===
      "Ertragsanteile (Bund)",
  )
  pruefe(
    "quelleVonPosten: 852xxx -> Gebuehren & Leistungen",
    quelleVonPosten({ konto: "852100", mvag: "" }) ===
      "Gebuehren & Leistungen",
  )
  pruefe(
    "quelleVonPosten: mvag 212 -> Transfers & Zuschuesse",
    quelleVonPosten({ konto: "999999", mvag: "212010" }) ===
      "Transfers & Zuschuesse",
  )
  pruefe(
    "quelleVonPosten: unbekannt -> Sonstige Einnahmen",
    quelleVonPosten({ konto: "999999", mvag: "" }) === "Sonstige Einnahmen",
  )
  // kappen — lange Listen auf TOP_N kuerzen, Rest in Sonstige-Knoten.
  const langeMap = new Map()
  for (let i = 0; i < TOP_N + 5; i++) langeMap.set("K" + i, 100 - i)
  const gekappt = kappen(langeMap, "Sonstige Konten")
  pruefe(
    "kappen: TOP_N Knoten plus Sonstige-Buendel",
    gekappt.length === TOP_N + 1 &&
      gekappt[gekappt.length - 1][0] === "Sonstige Konten",
    JSON.stringify(gekappt.map((e) => e[0])),
  )
  const restBetrag = gekappt[gekappt.length - 1][1]
  pruefe(
    "kappen: Sonstige-Betrag ist die Summe der gebuendelten Posten",
    restBetrag ===
      [...langeMap.values()].slice(TOP_N).reduce((s, v) => s + v, 0),
    String(restBetrag),
  )
  const kurzeMap = new Map([["A", 3], ["B", 1], ["C", 2]])
  const ungekappt = kappen(kurzeMap, "Sonstige Konten")
  pruefe(
    "kappen: kurze Liste bleibt ungekappt, absteigend sortiert",
    ungekappt.length === 3 &&
      ungekappt[0][0] === "A" &&
      ungekappt[2][0] === "B",
    JSON.stringify(ungekappt.map((e) => e[0])),
  )
  // buildSankeyOption — gegen die echten Posten des Default-Dokuments.
  const sDok = String(daten.meta.default_dok)
  const sUebersicht = buildSankeyOption(daten.posten, sDok, null)
  const sSerie = sUebersicht.series[0]
  pruefe(
    "buildSankeyOption: Uebersicht ist ein Sankey mit Gemeindehaushalt-Knoten",
    sSerie.type === "sankey" &&
      sSerie.data.some((n) => n.name === "Gemeindehaushalt"),
  )
  const mitte = sSerie.data.find((n) => n.name === "Gemeindehaushalt")
  pruefe(
    "buildSankeyOption: zentraler Knoten ist nicht aufklappbar",
    mitte.drillSeite === "mitte" && mitte.drillExpandbar === false,
  )
  const quelleKnoten = sSerie.data.filter((n) => n.drillSeite === "quelle")
  const gruppeKnoten = sSerie.data.filter((n) => n.drillSeite === "gruppe")
  pruefe(
    "buildSankeyOption: Uebersicht hat aufklappbare Quellen und Gruppen",
    quelleKnoten.length > 0 &&
      gruppeKnoten.length > 0 &&
      quelleKnoten.every((n) => n.drillExpandbar) &&
      gruppeKnoten.every((n) => n.drillExpandbar),
  )
  // Uebersicht: jede Verbindung beruehrt den zentralen Knoten.
  pruefe(
    "buildSankeyOption: Uebersicht — alle Links ueber Gemeindehaushalt",
    sSerie.links.every(
      (l) => l.source === "Gemeindehaushalt" || l.target === "Gemeindehaushalt",
    ),
  )
  // Drill-down in eine Aufgabengruppe -> nur ihre Ansatz-Knoten plus Mitte.
  const eineGruppe = gruppeKnoten[0]
  const sGruppe = buildSankeyOption(daten.posten, sDok, {
    seite: "gruppe",
    key: eineGruppe.drillKey,
  })
  const gSerie = sGruppe.series[0]
  pruefe(
    "buildSankeyOption: aufgeklappte Gruppe verschwindet als Einzelknoten",
    !gSerie.data.some(
      (n) => n.name === eineGruppe.name && n.drillExpandbar,
    ),
  )
  pruefe(
    "buildSankeyOption: Drill-down einer Gruppe zeigt nur den gewaehlten Zweig",
    // Nur der Mittelknoten und die Kinder der gewaehlten Gruppe — keine
    // anderen Gruppen, keine Einnahmeseite.
    gSerie.data.length >= 2 &&
      gSerie.data.every(
        (n) => n.drillSeite === "mitte" || n.drillKey === eineGruppe.drillKey,
      ),
  )
  // Betragstreue: die Kinder-Links summieren sich zum Betrag der Gruppe.
  function gruppenSumme(serie) {
    return Math.round(
      serie.links
        .filter((l) => l.source === "Gemeindehaushalt")
        .reduce((s, l) => s + l.value, 0),
    )
  }
  const gruppeBetrag = sSerie.links.find(
    (l) => l.source === "Gemeindehaushalt" && l.target === eineGruppe.name,
  ).value
  pruefe(
    "buildSankeyOption: Drill-down erhaelt den Betrag der gewaehlten Gruppe",
    gruppenSumme(gSerie) === Math.round(gruppeBetrag),
    gruppenSumme(gSerie) + " vs " + Math.round(gruppeBetrag),
  )
  // Drill-down in eine Einnahmequelle -> nur ihre Konten-Knoten plus Mitte.
  const eineQuelle = quelleKnoten[0]
  const sQuelle = buildSankeyOption(daten.posten, sDok, {
    seite: "quelle",
    key: eineQuelle.drillKey,
  })
  const qSerie = sQuelle.series[0]
  function quellenSumme(serie) {
    return Math.round(
      serie.links
        .filter((l) => l.target === "Gemeindehaushalt")
        .reduce((s, l) => s + l.value, 0),
    )
  }
  pruefe(
    "buildSankeyOption: aufgeklappte Quelle verschwindet als Einzelknoten",
    !qSerie.data.some(
      (n) => n.name === eineQuelle.name && n.drillExpandbar,
    ),
  )
  pruefe(
    "buildSankeyOption: Drill-down einer Quelle zeigt nur den gewaehlten Zweig",
    // Nur der Mittelknoten und die Kinder der gewaehlten Quelle — keine
    // anderen Quellen, keine Ausgabeseite.
    qSerie.data.length >= 2 &&
      qSerie.data.every(
        (n) => n.drillSeite === "mitte" || n.drillKey === eineQuelle.drillKey,
      ),
  )
  const quelleBetrag = sSerie.links.find(
    (l) => l.target === "Gemeindehaushalt" && l.source === eineQuelle.name,
  ).value
  pruefe(
    "buildSankeyOption: Drill-down erhaelt den Betrag der gewaehlten Quelle",
    quellenSumme(qSerie) === Math.round(quelleBetrag),
    quellenSumme(qSerie) + " vs " + Math.round(quelleBetrag),
  )

  console.log("\ndb — Persistenz-Guard ohne IndexedDB (Node-Umgebung)")
  // In Node ist `indexedDB` undefiniert; oeffneDb muss dann eine reine
  // In-Memory-DB liefern (persistent=false) und sichern() darf nicht werfen.
  pruefe("oeffneDb ohne IndexedDB: persistent=false", db.persistent === false)
  const gesichert = await db.sichern()
  pruefe("sichern() ohne IndexedDB ist folgenlos", gesichert === false)

  // Persistenz-Round-Trip: exportBytes -> deserialisieren muss den Stand
  // exakt wiederherstellen. Genau dieser Pfad traegt die IndexedDB-Persistenz
  // (sichern() exportiert, oeffneDb deserialisiert beim naechsten Besuch).
  const postenVor = db.wert("SELECT COUNT(*) FROM posten")
  const dokVor = db.wert("SELECT COUNT(*) FROM dokument")
  const db2 = await importBytes(sqlite3InitModule, db.exportBytes())
  const postenNach = db2.wert("SELECT COUNT(*) FROM posten")
  const dokNach = db2.wert("SELECT COUNT(*) FROM dokument")
  pruefe(
    "Persistenz-Round-Trip stellt Dokumente und Posten exakt wieder her",
    postenVor === postenNach && dokVor === dokNach && dokNach === 4,
    `${dokVor}/${postenVor} -> ${dokNach}/${postenNach}`,
  )
  db2.close()
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
