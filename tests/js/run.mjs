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
import { oeffneDb, importBytes, Datenbank } from "../../web/js/db.js"
import { verarbeitePdf, verarbeiteCsvDateien } from "../../web/js/pipeline.js"
import {
  parseCsvBytes, synthAggregate, mergeParseResults,
} from "../../web/js/csv-parser.js"
import { collect, standardVergleich } from "../../web/js/dashboard-data.js"
import {
  baueDiff,
  filtereZeilen,
  aggregiereDokument,
  alsCsv,
  schluessel,
  BASIS_INTERN,
  interneBasisLabel,
  hatVergleichsspalte,
} from "../../web/js/vergleich-daten.js"
import { typRang, vergleicheDokumente } from "../../web/js/reference.js"
import {
  alleCharts,
  chartDiffWasserfall,
  chartDiffGruppen,
  chartDiffTreemap,
} from "../../web/js/dashboard-charts.js"
import {
  buildSankeyOption,
  quelleVonPosten,
  kappen,
  TOP_N,
} from "../../web/js/sankey-drill.js"
import {
  normalisiere,
  sucheGemeinden,
  baueDownloadLink,
  baueDownloadLinks,
  OH_BASIS,
} from "../../web/js/oh-deeplink.js"

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
  "NVA-2026-Auflage.pdf": { detail: 1114, summe: 696, saldo: 812 },
  "RA 2024-Auflage.pdf": { detail: 1395, summe: 798, saldo: 684 },
  "RA-2025-Auflage.pdf": { detail: 1358, summe: 777, saldo: 666 },
  "VA-2026-Auflage.pdf": { detail: 1408, summe: 690, saldo: 805 },
}

// Fest gepinnte Herzogenburg-Fixtures: der Test darf NICHT den ganzen
// documents/-Ordner globben, sonst verschieben zusaetzliche PDFs anderer
// Gemeinden die Erwartungswerte (5 Dokumente, 5 x 52 Pruefungen,
// 6529 Posten).
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

  console.log("\nvalidate — Plausibilitaetspruefung (Referenz: 52/52 je Dokument)")
  let valideGesamt = 0
  let valideTotal = 0
  for (const f of pdfs) {
    const r = parseDocumentBytes(mupdf, pdfBytes(f))
    const status = pruefStatus(validate(r))
    valideGesamt += status.ok
    valideTotal += status.gesamt
    pruefe(
      `${f} — ${status.ok}/${status.gesamt}`,
      status.bestanden,
      JSON.stringify(status),
    )
  }
  pruefe(`Gesamt ${valideTotal}/${valideTotal} Pruefungen`,
    valideGesamt === valideTotal, `${valideGesamt}/${valideTotal}`)

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
    "sql/01-eckwerte.sql liefert 5 Zeilen",
    eckwerte.length === 5,
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
  pruefe("DATA: 5 Dokumente", daten.meta.dok_anzahl === 5)
  pruefe("DATA: 6529 Posten", daten.meta.posten_anzahl === 6529,
    String(daten.meta.posten_anzahl))
  const cfg = alleCharts(daten)
  pruefe(
    "CFG: dok_charts je Dokument",
    Object.keys(cfg.dok_charts).length === 5,
  )
  pruefe("CFG: trend_charts vorhanden", "trend_eck" in cfg.trend_charts)

  // R5 — dokumente() liefert einwohner-Feld (Default null bei Fixtures).
  pruefe(
    "DATA: dokumente[0] hat einwohner-Feld",
    daten.dokumente.length > 0 && "einwohner" in daten.dokumente[0],
    JSON.stringify(Object.keys(daten.dokumente[0] || {})),
  )
  pruefe(
    "DATA: einwohner ist null bei frisch importierten Fixtures",
    daten.dokumente.every((d) => d.einwohner === null),
  )

  // R10 — agg.einnahmen[i] ist ein 3-Tuple [bezeichnung, betrag, anteil].
  const ersterAgg = daten.aggregate[String(daten.meta.default_dok)]
  const ersteEinnahme = ersterAgg && ersterAgg.einnahmen[0]
  pruefe(
    "agg.einnahmen[0] ist 3-Tuple",
    Array.isArray(ersteEinnahme) && ersteEinnahme.length === 3,
    JSON.stringify(ersteEinnahme),
  )
  pruefe(
    "agg.einnahmen[0][2] ist eine Zahl (Prozent)",
    typeof ersteEinnahme[2] === "number" && ersteEinnahme[2] >= 0,
    String(ersteEinnahme && ersteEinnahme[2]),
  )

  // R5 — migrationenAnwenden ist idempotent: zweimaliger Aufruf wirft nicht.
  let migrationOk = true
  try {
    const { migrationenAnwenden } = await import("../../web/js/db.js")
    migrationenAnwenden(db)
    migrationenAnwenden(db)
  } catch (e) {
    migrationOk = false
  }
  pruefe("migrationenAnwenden ist idempotent (doppelter Aufruf wirft nicht)",
    migrationOk)

  // R5 — Pro-Kopf-Felder kommen aus aggregateDok, sobald einwohner gesetzt.
  // einwohner direkt setzen und collect() erneut aufrufen.
  db.ausfuehren(
    `UPDATE dokument SET einwohner=9000 WHERE dokument_id=?`,
    [Number(daten.meta.default_dok)],
  )
  const datenPK = collect(db)
  const dokMitEW = datenPK.dokumente.find(
    (d) => String(d.id) === String(datenPK.meta.default_dok),
  )
  pruefe("DATA: einwohner persistent gesetzt", dokMitEW.einwohner === 9000,
    String(dokMitEW.einwohner))

  // R1 — Vergleichssummen und Prozent-Delta sind im eckwerte-Block.
  const eckMitEW = datenPK.aggregate[String(datenPK.meta.default_dok)]
    .eckwerte
  pruefe(
    "agg.eckwerte.ertraege_vgl ist eine Zahl",
    typeof eckMitEW.ertraege_vgl === "number",
    String(eckMitEW.ertraege_vgl),
  )
  pruefe(
    "agg.eckwerte.aufwand_vgl ist eine Zahl",
    typeof eckMitEW.aufwand_vgl === "number",
    String(eckMitEW.aufwand_vgl),
  )
  pruefe(
    "agg.eckwerte.delta_ertraege_proz ist eine Zahl",
    typeof eckMitEW.delta_ertraege_proz === "number",
    String(eckMitEW.delta_ertraege_proz),
  )
  pruefe(
    "agg.eckwerte.delta_aufwand_proz ist eine Zahl",
    typeof eckMitEW.delta_aufwand_proz === "number",
    String(eckMitEW.delta_aufwand_proz),
  )

  // R5 — Pro-Kopf-Felder erscheinen, sobald einwohner > 0.
  pruefe(
    "agg.eckwerte.ertraege_pk ist eine Zahl bei gesetzter Einwohnerzahl",
    typeof eckMitEW.ertraege_pk === "number",
    String(eckMitEW.ertraege_pk),
  )
  pruefe(
    "agg.eckwerte.aufwand_pk ist eine Zahl bei gesetzter Einwohnerzahl",
    typeof eckMitEW.aufwand_pk === "number",
    String(eckMitEW.aufwand_pk),
  )
  pruefe(
    "agg.eckwerte.netto_pk ist eine Zahl bei gesetzter Einwohnerzahl",
    typeof eckMitEW.netto_pk === "number",
    String(eckMitEW.netto_pk),
  )
  // R5 — Pro-Kopf bleibt null bei Dokumenten ohne einwohner.
  const andereDokId = datenPK.dokumente.find(
    (d) => String(d.id) !== String(datenPK.meta.default_dok),
  ).id
  const eckOhneEW = datenPK.aggregate[String(andereDokId)].eckwerte
  pruefe(
    "agg.eckwerte.ertraege_pk ist null ohne Einwohnerzahl",
    eckOhneEW.ertraege_pk === null,
    String(eckOhneEW.ertraege_pk),
  )

  // R2 — Finanzierung-Block und Schuldendienst.
  const fin = datenPK.aggregate[String(datenPK.meta.default_dok)]
    .finanzierung
  pruefe(
    "agg.finanzierung hat Aufnahme/Tilgung/Schuldendienst",
    fin && typeof fin.aufnahme === "number" &&
      typeof fin.tilgung === "number" &&
      typeof fin.schuldendienst === "number",
    JSON.stringify(fin),
  )
  pruefe(
    "agg.eckwerte.schuldendienst ist eine Zahl",
    typeof eckMitEW.schuldendienst === "number",
    String(eckMitEW.schuldendienst),
  )
  // R2 — trend.schuldenstand: Array, kumulativ konsistent.
  const stand = datenPK.trend.schuldenstand
  pruefe(
    "trend.schuldenstand ist ein Array",
    Array.isArray(stand) && stand.length > 0,
    String(stand && stand.length),
  )
  let kumOk = true
  let kum = 0
  for (const [, auf, til, st] of stand) {
    kum += (auf || 0) - (til || 0)
    if (Math.abs(kum - st) > 1) { kumOk = false; break }
  }
  pruefe(
    "trend.schuldenstand: kumulierter Stand entspricht Aufnahme - Tilgung",
    kumOk, "Drift in einer Zeile",
  )

  // R12 — Investitions-Finanzierung: Foerderung + Darlehen + Eigen >= 0.
  const invFin = datenPK.aggregate[String(datenPK.meta.default_dok)]
    .investFinanzierung
  pruefe(
    "agg.investFinanzierung hat Foerderung/Darlehen/Eigen",
    invFin && typeof invFin.foerderung === "number" &&
      typeof invFin.darlehen === "number" &&
      typeof invFin.eigen === "number",
    JSON.stringify(invFin),
  )
  pruefe(
    "agg.investFinanzierung: alle Komponenten >= 0",
    invFin.foerderung >= 0 && invFin.darlehen >= 0 && invFin.eigen >= 0,
    JSON.stringify(invFin),
  )

  // Neue Charts sind in alleCharts() registriert.
  const cfg2 = alleCharts(datenPK)
  const ersterDokSchluessel = Object.keys(cfg2.dok_charts)[0]
  const ersterDok = cfg2.dok_charts[ersterDokSchluessel]
  pruefe(
    "CFG: dok_charts hat fin_saeulen + investfin_b (sankey)",
    "fin_saeulen" in ersterDok && "investfin_b" in ersterDok,
  )
  pruefe(
    "CFG: fin_combo wurde entfernt (Schulden-Combo raus)",
    !("fin_combo" in ersterDok),
  )
  pruefe(
    "CFG: trend_charts hat schuldenstand",
    "schuldenstand" in cfg2.trend_charts,
  )

  // R3 — sollIst befuellt bei RA, undefined bei VA.
  const raDok = datenPK.dokumente.find((d) => d.typ === "RA")
  const vaDok = datenPK.dokumente.find((d) => d.typ === "VA")
  if (raDok) {
    const ag = datenPK.aggregate[String(raDok.id)]
    pruefe(
      "agg.sollIst ist Array bei RA-Dokument",
      Array.isArray(ag.sollIst),
      typeof ag.sollIst,
    )
  }
  if (vaDok) {
    const ag = datenPK.aggregate[String(vaDok.id)]
    pruefe(
      "agg.sollIst ist undefined bei VA-Dokument",
      ag.sollIst === undefined,
      String(ag.sollIst),
    )
  }
  // R4 — polster befuellt bei VA, undefined bei RA.
  if (vaDok) {
    const ag = datenPK.aggregate[String(vaDok.id)]
    pruefe(
      "agg.polster ist Array bei VA-Dokument",
      Array.isArray(ag.polster),
      typeof ag.polster,
    )
  }
  if (raDok) {
    const ag = datenPK.aggregate[String(raDok.id)]
    pruefe(
      "agg.polster ist undefined bei RA-Dokument",
      ag.polster === undefined,
      String(ag.polster),
    )
  }
  // CFG enthaelt die vier neuen Variante-Keys je Dokument.
  pruefe(
    "CFG: dok_charts hat sollist_a, sollist_b, polster_a, polster_b",
    "sollist_a" in ersterDok && "sollist_b" in ersterDok &&
      "polster_a" in ersterDok && "polster_b" in ersterDok,
  )

  // R6/R7 — gruppen + gruppenSaldo
  const aggBase = datenPK.aggregate[String(datenPK.meta.default_dok)]
  pruefe(
    "agg.gruppen ist nicht leer",
    Array.isArray(aggBase.gruppen) && aggBase.gruppen.length > 0,
    String(aggBase.gruppen && aggBase.gruppen.length),
  )
  pruefe(
    "agg.gruppenSaldo ist Array mit 5-Tuples [gr,gr_text,ein,aus,saldo]",
    Array.isArray(aggBase.gruppenSaldo) &&
      aggBase.gruppenSaldo.every((r) => r.length === 5),
    JSON.stringify(aggBase.gruppenSaldo && aggBase.gruppenSaldo[0]),
  )

  // R8 — einEuroAuf und einEuroEin summieren sich auf 100 +/- 1.
  pruefe(
    "agg.einEuroAuf ist Array",
    Array.isArray(aggBase.einEuroAuf) && aggBase.einEuroAuf.length > 0,
  )
  const sumAus = aggBase.einEuroAuf.reduce((s, [, c]) => s + c, 0)
  pruefe(
    "agg.einEuroAuf: Summe = 100 +/- 1 (Rundung)",
    Math.abs(sumAus - 100) <= 1,
    String(sumAus),
  )
  const sumEin = aggBase.einEuroEin.reduce((s, [, c]) => s + c, 0)
  pruefe(
    "agg.einEuroEin: Summe = 100 +/- 1 (Rundung)",
    Math.abs(sumEin - 100) <= 1,
    String(sumEin),
  )

  // CFG enthaelt die neuen Variante-Keys.
  pruefe(
    "CFG: dok_charts hat gruppen_balken, gruppen_saldo",
    "gruppen_balken" in ersterDok && "gruppen_saldo" in ersterDok,
  )
  pruefe(
    "CFG: dok_charts hat eineuro_aus_a/b und eineuro_ein_a/b",
    "eineuro_aus_a" in ersterDok && "eineuro_aus_b" in ersterDok &&
      "eineuro_ein_a" in ersterDok && "eineuro_ein_b" in ersterDok,
  )

  // R9 — Bindungs-Aggregation und Pflichtumlagen-Helper.
  const { istPflichtumlage } = await import(
    "../../web/js/dashboard-data.js"
  )
  pruefe(
    "istPflichtumlage('Sozialhilfeumlage') -> true",
    istPflichtumlage("Sozialhilfeumlage") === true,
  )
  pruefe(
    "istPflichtumlage('NOEKAS-Beitrag') -> true (Umlaut-variante)",
    istPflichtumlage("NÖKAS-Beitrag") === true ||
      istPflichtumlage("Nokas-Beitrag") === true,
  )
  pruefe(
    "istPflichtumlage('Sachaufwand') -> false",
    istPflichtumlage("Sachaufwand") === false,
  )
  pruefe(
    "istPflichtumlage(null) -> false (defensive)",
    istPflichtumlage(null) === false,
  )

  const bindung = aggBase.bindung
  const erwarteteSchluessel = [
    "personal", "pflichtumlagen", "finanz",
    "freiwilligeTransfers", "freieSachaus", "unklar",
  ]
  pruefe(
    "agg.bindung hat alle sechs Schluessel",
    bindung && erwarteteSchluessel.every((k) => k in bindung),
    JSON.stringify(bindung && Object.keys(bindung)),
  )
  pruefe(
    "agg.bindung: alle Komponenten >= 0",
    bindung && erwarteteSchluessel.every((k) => bindung[k] >= 0),
    JSON.stringify(bindung),
  )

  pruefe(
    "CFG: dok_charts hat bindung_a, bindung_b",
    "bindung_a" in ersterDok && "bindung_b" in ersterDok,
  )

  // R11 — Sankey-Abschlussknoten: bei Ueberschuss "Ueberschuss /
  // Ruecklagenzufuhr" als Knoten, bei Abgang "Abgangsdeckung".
  const { chartSankey } = await import("../../web/js/dashboard-charts.js")
  const sankeyMitUeberschuss = chartSankey({
    eckwerte: { ertraege: 1000, aufwand: 600, netto: 400, komm: 0 },
    sankey: { quellen: [], gruppen: [] },
  })
  pruefe(
    "chartSankey: Ueberschuss-Knoten bei netto > 0",
    sankeyMitUeberschuss.series[0].data.some(
      (n) => n.name === "Ueberschuss / Ruecklagenzufuhr",
    ),
  )
  const sankeyMitAbgang = chartSankey({
    eckwerte: { ertraege: 600, aufwand: 1000, netto: -400, komm: 0 },
    sankey: { quellen: [], gruppen: [] },
  })
  pruefe(
    "chartSankey: Abgangsdeckung-Knoten bei netto < 0",
    sankeyMitAbgang.series[0].data.some((n) => n.name === "Abgangsdeckung"),
  )

  // R11 — Sankey-Drill-down hat ebenfalls den Abschlussknoten.
  const defaultDokId = String(datenPK.meta.default_dok)
  const sUebersichtNeu = buildSankeyOption(datenPK.posten, defaultDokId, null)
  const sSerieNeu = sUebersichtNeu.series[0]
  const istAbschluss = sSerieNeu.data.some(
    (n) =>
      n.name === "Ueberschuss / Ruecklagenzufuhr" ||
      n.name === "Abgangsdeckung",
  )
  pruefe(
    "buildSankeyOption: Abschlussknoten (Ueberschuss/Abgang) ist vorhanden",
    istAbschluss,
    JSON.stringify(sSerieNeu.data.map((n) => n.name)),
  )

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
    // Auf der gedrillten Seite (gruppe) keine ANDEREN Gruppen-Knoten — nur
    // die Kinder der gewaehlten Gruppe. Die Einnahmeseite bleibt erhalten.
    gSerie.data.length >= 2 &&
      gSerie.data
        .filter((n) => n.drillSeite === "gruppe")
        .every((n) => n.drillKey === eineGruppe.drillKey),
  )
  // Die Gegenseite (Einnahmen) bleibt im Gruppen-Drill-down in
  // Uebersichtsform erhalten — gleiche Knoten wie ohne Drill-down.
  const gEinnahmeseite = gSerie.data.filter((n) => n.drillSeite === "quelle")
  pruefe(
    "buildSankeyOption: Gruppen-Drill-down erhaelt die Einnahmeseite in Uebersichtsform",
    gEinnahmeseite.length === quelleKnoten.length &&
      gEinnahmeseite.every((n) => n.drillExpandbar) &&
      gEinnahmeseite.every((n) =>
        quelleKnoten.some((q) => q.name === n.name)),
    gEinnahmeseite.length + " vs " + quelleKnoten.length,
  )
  // Betragstreue: die Kinder-Links summieren sich zum Betrag der Gruppe.
  // R11 fuegt ggf. einen "Ueberschuss / Ruecklagenzufuhr"-Link vom
  // Gemeindehaushalt hinzu — der gehoert nicht zu den Aufgabengruppen
  // und wird hier ausgeschlossen.
  const ABSCHLUSS_NAMEN = new Set([
    "Ueberschuss / Ruecklagenzufuhr",
    "Abgangsdeckung",
  ])
  function gruppenSumme(serie) {
    return Math.round(
      serie.links
        .filter((l) =>
          l.source === "Gemeindehaushalt" &&
          !ABSCHLUSS_NAMEN.has(l.target),
        )
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
    // R11: "Abgangsdeckung" zaehlt nicht als Einnahmequelle.
    return Math.round(
      serie.links
        .filter((l) =>
          l.target === "Gemeindehaushalt" &&
          !ABSCHLUSS_NAMEN.has(l.source),
        )
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
    // Auf der gedrillten Seite (quelle) keine ANDEREN Quellen-Knoten — nur
    // die Kinder der gewaehlten Quelle. Die Ausgabeseite bleibt erhalten.
    qSerie.data.length >= 2 &&
      qSerie.data
        .filter((n) => n.drillSeite === "quelle")
        .every((n) => n.drillKey === eineQuelle.drillKey),
  )
  // Die Gegenseite (Ausgaben) bleibt im Quellen-Drill-down in
  // Uebersichtsform erhalten — gleiche Knoten wie ohne Drill-down.
  const qAusgabeseite = qSerie.data.filter((n) => n.drillSeite === "gruppe")
  pruefe(
    "buildSankeyOption: Quellen-Drill-down erhaelt die Ausgabeseite in Uebersichtsform",
    qAusgabeseite.length === gruppeKnoten.length &&
      qAusgabeseite.every((n) => n.drillExpandbar) &&
      qAusgabeseite.every((n) =>
        gruppeKnoten.some((g) => g.name === n.name)),
    qAusgabeseite.length + " vs " + gruppeKnoten.length,
  )
  const quelleBetrag = sSerie.links.find(
    (l) => l.target === "Gemeindehaushalt" && l.source === eineQuelle.name,
  ).value
  pruefe(
    "buildSankeyOption: Drill-down erhaelt den Betrag der gewaehlten Quelle",
    quellenSumme(qSerie) === Math.round(quelleBetrag),
    quellenSumme(qSerie) + " vs " + Math.round(quelleBetrag),
  )

  console.log("\ncsv-parser — OH-CSV Parsing, MVAG-Klassifikation, synth Aggregate")
  const csvEhhBytes = new Uint8Array(readFileSync(
    join(DOCS, "offenerhaushalt_30201_2026_va_ehh.csv")))
  const csvFhhBytes = new Uint8Array(readFileSync(
    join(DOCS, "offenerhaushalt_30201_2026_va_fhh.csv")))
  const ehh = parseCsvBytes(csvEhhBytes)
  pruefe("CSV EHH: Gemeinde 'St. Poelten' erkannt",
    ehh.meta.gemeinde.includes("Poelten") || ehh.meta.gemeinde.includes("Pölten"),
    ehh.meta.gemeinde)
  pruefe("CSV EHH: Typ VA", ehh.meta.typ === "VA", ehh.meta.typ)
  pruefe("CSV EHH: Finanzjahr 2026",
    ehh.meta.finanzjahr === "2026", ehh.meta.finanzjahr)
  pruefe("CSV EHH: Haushalt EHH",
    ehh.meta.haushalt === "EHH", ehh.meta.haushalt)
  pruefe("CSV EHH: GKZ 30201", ehh.meta.gkz === "30201", ehh.meta.gkz)
  pruefe("CSV EHH: Detail-Posten geparst",
    ehh.result.posten.length > 1000, String(ehh.result.posten.length))
  // Alle EHH-Posten haben mvag_eh gesetzt, keinen mvag_fh.
  const ehhPosten = ehh.result.posten.filter((p) => p.zeilentyp === "detail")
  pruefe("CSV EHH: alle Detail-Posten haben mvag_eh, keinen mvag_fh",
    ehhPosten.every((p) => p.mvag_eh && !p.mvag_fh))
  // Die Klassifikation des MVAG 2222 (das ist im VRV-Schluessel 222x =
  // Sachaufwand, Praefix 22 -> ausgabe/operativ EHH).
  const ehhAus = ehhPosten.find((p) => p.mvag_eh && p.mvag_eh.startsWith("22"))
  pruefe("CSV EHH: 22xx-Posten ist ausgabe/operativ",
    ehhAus && ehhAus.richtung === "ausgabe" && ehhAus.gebarung === "operativ",
    ehhAus && `${ehhAus.richtung}/${ehhAus.gebarung}`)
  const ehhEin = ehhPosten.find((p) => p.mvag_eh && p.mvag_eh.startsWith("21"))
  pruefe("CSV EHH: 21xx-Posten ist einnahme/operativ",
    ehhEin && ehhEin.richtung === "einnahme" && ehhEin.gebarung === "operativ",
    ehhEin && `${ehhEin.richtung}/${ehhEin.gebarung}`)

  const fhh = parseCsvBytes(csvFhhBytes)
  pruefe("CSV FHH: Haushalt FHH",
    fhh.meta.haushalt === "FHH", fhh.meta.haushalt)
  const fhhPosten = fhh.result.posten.filter((p) => p.zeilentyp === "detail")
  pruefe("CSV FHH: Detail-Posten geparst",
    fhhPosten.length > 1000, String(fhhPosten.length))

  // Investiv-Klassifikation: 33xx-Posten ist einnahme/investiv,
  // 34xx-Posten ist ausgabe/investiv.
  const fhhInv = fhhPosten.find((p) => p.mvag_fh && p.mvag_fh.startsWith("34"))
  pruefe("CSV FHH: 34xx-Posten ist ausgabe/investiv",
    fhhInv && fhhInv.richtung === "ausgabe" && fhhInv.gebarung === "investiv",
    fhhInv && `${fhhInv.richtung}/${fhhInv.gebarung}`)

  // Merge + synthetische Aggregate -> validate.js akzeptiert das Ergebnis.
  const merged = mergeParseResults(ehh.result, fhh.result)
  const detailVorSynth = merged.posten.filter(
    (p) => p.zeilentyp === "detail").length
  synthAggregate(merged)
  const summeNachSynth = merged.posten.filter(
    (p) => p.zeilentyp === "summe").length
  const saldoNachSynth = merged.posten.filter(
    (p) => p.zeilentyp === "saldo").length
  pruefe("CSV merge: Detail-Posten erhalten",
    merged.posten.filter((p) => p.zeilentyp === "detail").length === detailVorSynth,
    String(detailVorSynth))
  pruefe("CSV synth: summe-Zeilen je Ansatz x 10 SU-Codes",
    summeNachSynth > 0 && summeNachSynth % 10 === 0,
    String(summeNachSynth))
  pruefe("CSV synth: saldo-Zeilen je Ansatz x 7 SA-Codes",
    saldoNachSynth > 0 && saldoNachSynth % 7 === 0,
    String(saldoNachSynth))
  const statusCsv = pruefStatus(validate(merged))
  pruefe(`CSV: validate ergibt ${statusCsv.ok}/${statusCsv.gesamt} OK`,
    statusCsv.bestanden, JSON.stringify(statusCsv))

  // Pipeline-Pfad: verarbeiteCsvDateien legt das Dokument in der DB an.
  // **Wichtig:** oeffneDb oeffnet eine feste Datei im wasm-In-Memory-FS.
  // Die Haupt-`db` haelt diese Datei mit den PDF-Daten offen — fuer
  // unsere CSV-Tests brauchen wir eine isolierte ":memory:"-DB.
  console.log("\npipeline — CSV-Pfad in die DB")
  const sqlite3Raw = await sqlite3InitModule()
  const neueLeereDb = () => new Datenbank(
    sqlite3Raw, new sqlite3Raw.oo1.DB(":memory:", "c"), false)
  const dbCsv = neueLeereDb()
  dbCsv.schemaAnwenden(readFileSync(join(WURZEL, "web/schema.sql"), "utf8"))
  const csvRes = await verarbeiteCsvDateien(dbCsv, [
    { name: "offenerhaushalt_30201_2026_va_ehh.csv", bytes: csvEhhBytes },
    { name: "offenerhaushalt_30201_2026_va_fhh.csv", bytes: csvFhhBytes },
  ])
  pruefe("CSV-Pipeline: ein Dokument geschrieben",
    csvRes.dokumente.length === 1, String(csvRes.dokumente.length))
  pruefe("CSV-Pipeline: Dokument ist EHH+FHH komplett",
    csvRes.dokumente[0] && csvRes.dokumente[0].fassung === "OH-CSV",
    csvRes.dokumente[0] && csvRes.dokumente[0].fassung)
  pruefe("CSV-Pipeline: Pruefstatus 52/52",
    csvRes.dokumente[0] && csvRes.dokumente[0].status.bestanden &&
      csvRes.dokumente[0].status.gesamt === 52,
    csvRes.dokumente[0]
      ? `${csvRes.dokumente[0].status.ok}/${csvRes.dokumente[0].status.gesamt}`
      : "kein Dok")
  // Spaeteres Hinzufuegen derselben CSV ist idempotent (kein zweites Dokument).
  const csvRes2 = await verarbeiteCsvDateien(dbCsv, [
    { name: "offenerhaushalt_30201_2026_va_fhh.csv", bytes: csvFhhBytes },
  ])
  const dokCount = dbCsv.wert("SELECT COUNT(*) FROM dokument")
  pruefe("CSV-Pipeline: erneutes Hochladen erzeugt kein zweites Dokument",
    dokCount === 1, String(dokCount))
  pruefe("CSV-Pipeline: erneutes Hochladen liefert dasselbe Dokument zurueck",
    csvRes2.dokumente.length === 1 &&
      csvRes2.dokumente[0].fassung === "OH-CSV",
    csvRes2.dokumente[0] && csvRes2.dokumente[0].fassung)
  // Ein OH-CSV-Dokument traegt den Spaltennamen ("VA 2025", loader.js:31),
  // aber keine Werte in Spalte 2 — hatVergleichsspalte muss das datenbasiert
  // erkennen, nicht am Typ.
  const datenCsv = collect(dbCsv)
  pruefe(
    "hatVergleichsspalte ist false fuer das gemergte OH-CSV-Dokument",
    hatVergleichsspalte(datenCsv.posten, datenCsv.dokumente[0].id) === false,
  )
  dbCsv.close()

  // Nachreichungs-Pfad: zuerst nur EHH, dann FHH separat.
  console.log("\npipeline — CSV Nachreichung (EHH zuerst, FHH spaeter)")
  const dbNach = neueLeereDb()
  dbNach.schemaAnwenden(readFileSync(join(WURZEL, "web/schema.sql"), "utf8"))
  const stufe1 = await verarbeiteCsvDateien(dbNach, [
    { name: "offenerhaushalt_30201_2026_va_ehh.csv", bytes: csvEhhBytes },
  ])
  pruefe("Nachreichung Stufe 1: Halb-Dokument 'nur EHH'",
    stufe1.dokumente.length === 1 &&
      stufe1.dokumente[0].fassung === "OH-CSV (nur EHH)",
    stufe1.dokumente[0] && stufe1.dokumente[0].fassung)
  const stufe2 = await verarbeiteCsvDateien(dbNach, [
    { name: "offenerhaushalt_30201_2026_va_fhh.csv", bytes: csvFhhBytes },
  ])
  pruefe("Nachreichung Stufe 2: Dokument komplettiert auf 'OH-CSV'",
    stufe2.dokumente.length === 1 &&
      stufe2.dokumente[0].fassung === "OH-CSV",
    stufe2.dokumente[0] && stufe2.dokumente[0].fassung)
  const nachCount = dbNach.wert("SELECT COUNT(*) FROM dokument")
  pruefe("Nachreichung: insgesamt nur ein Dokument in der DB",
    nachCount === 1, String(nachCount))
  // Quelldatei sollte beide CSV-Dateinamen enthalten.
  const nachQuelle = dbNach.wert("SELECT quelldatei FROM dokument")
  pruefe("Nachreichung: quelldatei listet beide CSV-Dateien",
    nachQuelle.includes("ehh.csv") && nachQuelle.includes("fhh.csv"),
    nachQuelle)
  dbNach.close()

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
    postenVor === postenNach && dokVor === dokNach && dokNach === 5,
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

  // -------------------------------------------------------------------------
  // OH-Deeplink: Gemeindesuche + Bau der Download-Links (oh-deeplink.js)
  // -------------------------------------------------------------------------
  pruefe(
    "normalisiere entfernt Diakritika und Grossschreibung",
    normalisiere("Wörgl") === "woergl" && normalisiere("ST. PÖLTEN") === "st. poelten",
  )

  // URL-Bau: exakt das verifizierte OH-Muster, Slug URL-kodiert.
  const linkHb = baueDownloadLink({ slug: "herzogenburg", jahr: 2023, typ: "ra", haushalt: "ehh" })
  pruefe(
    "baueDownloadLink: korrektes OH-Muster",
    linkHb ===
      `${OH_BASIS}/gemeinde/herzogenburg/download?haushalt=ehh&rechnungsabschluss=ra&year=2023`,
    linkHb,
  )
  const linkWoergl = baueDownloadLink({ slug: "wörgl", jahr: 2024, typ: "va", haushalt: "fhh" })
  pruefe(
    "baueDownloadLink: Slug mit Umlaut wird URL-kodiert (w%C3%B6rgl)",
    linkWoergl.includes("/gemeinde/w%C3%B6rgl/download") &&
      linkWoergl.includes("haushalt=fhh") &&
      linkWoergl.includes("rechnungsabschluss=va") &&
      linkWoergl.includes("year=2024"),
    linkWoergl,
  )
  const paar = baueDownloadLinks({ slug: "herzogenburg", jahr: 2022, typ: "va" })
  pruefe(
    "baueDownloadLinks liefert EHH+FHH-Paar",
    paar.ehh.includes("haushalt=ehh") && paar.fhh.includes("haushalt=fhh") &&
      paar.ehh.includes("year=2022") && paar.fhh.includes("rechnungsabschluss=va"),
  )
  let warf = false
  try { baueDownloadLink({ slug: "x", jahr: 2023, typ: "xx", haushalt: "ehh" }) }
  catch { warf = true }
  pruefe("baueDownloadLink wirft bei ungueltigem Typ", warf)
  warf = false
  try { baueDownloadLink({ slug: "x", jahr: "23", typ: "ra", haushalt: "ehh" }) }
  catch { warf = true }
  pruefe("baueDownloadLink wirft bei ungueltigem Jahr", warf)

  // Suche gegen den erzeugten Index (sofern vorhanden).
  const idxPfad = join(WURZEL, "web/gemeinden-index.json")
  if (existsSync(idxPfad)) {
    const idx = JSON.parse(readFileSync(idxPfad, "utf8"))
    pruefe("Gemeinde-Index enthaelt >2000 Gemeinden", idx.length > 2000, `${idx.length}`)

    const hb = sucheGemeinden(idx, "Herzogenburg")
    pruefe(
      "Suche 'Herzogenburg' findet slug=herzogenburg, gkz=31912",
      hb[0] && hb[0].slug === "herzogenburg" && hb[0].gkz === "31912",
      JSON.stringify(hb[0]),
    )
    const ascii = sucheGemeinden(idx, "woergl")
    pruefe(
      "Diakritika-tolerante Suche 'woergl' findet Wörgl (slug=wörgl)",
      ascii.some((g) => g.slug === "wörgl"),
    )
    const perGkz = sucheGemeinden(idx, "31912")
    pruefe(
      "GKZ-Suche '31912' findet Herzogenburg",
      perGkz.some((g) => g.gkz === "31912" && g.name === "Herzogenburg"),
    )
    const sp = sucheGemeinden(idx, "pölten").find((g) => g.name === "St. Pölten")
    pruefe(
      "St. Pölten hat den nicht-ableitbaren Slug 'sankt-pölten'",
      sp && sp.slug === "sankt-pölten",
      sp && sp.slug,
    )
    pruefe("Leere Suche liefert nichts", sucheGemeinden(idx, "  ").length === 0)
  } else {
    console.log("  SKIP web/gemeinden-index.json fehlt — `node scripts/oh-gemeinde-index.mjs`")
  }

  // ======================================================================
  // Entwicklungsreihenfolge der Dokumenttypen
  // ======================================================================
  console.log("\nreference — Entwicklungsreihenfolge VA -> NVA -> RA")
  pruefe(
    "typRang: VA vor NVA vor RA",
    typRang("VA") < typRang("NVA") && typRang("NVA") < typRang("RA"),
    `${typRang("VA")}/${typRang("NVA")}/${typRang("RA")}`,
  )
  pruefe("typRang: unbekannter Typ hinten", typRang("XX") === 3)
  pruefe(
    "vergleicheDokumente sortiert Jahr vor Typ",
    JSON.stringify(
      [
        { typ: "RA", jahr: 2026 },
        { typ: "VA", jahr: 2026 },
        { typ: "NVA", jahr: 2025 },
        { typ: "NVA", jahr: 2026 },
      ]
        .sort(vergleicheDokumente)
        .map((d) => `${d.typ}${d.jahr}`),
    ) === JSON.stringify(["NVA2025", "VA2026", "NVA2026", "RA2026"]),
  )
  // DATA.dokumente kommt aus SQL und muss dieselbe Reihenfolge liefern.
  pruefe(
    "DATA.dokumente in Entwicklungsreihenfolge",
    JSON.stringify(datenPK.dokumente.map((d) => d.label)) ===
      JSON.stringify([
        "RA 2024",
        "NVA 2025",
        "RA 2025",
        "VA 2026",
        "NVA 2026",
      ]),
    JSON.stringify(datenPK.dokumente.map((d) => d.label)),
  )
  // Der Nachtragsvoranschlag ist das gueltige Planungsdokument und damit die
  // Vorbelegung — nicht der davon ueberholte Voranschlag.
  const defDok = datenPK.dokumente.find(
    (d) => String(d.id) === String(datenPK.meta.default_dok),
  )
  pruefe(
    "default_dok ist der juengste NVA, nicht der VA desselben Jahres",
    defDok.typ === "NVA" && defDok.jahr === 2026,
    `${defDok.typ} ${defDok.jahr}`,
  )
  // Der Nachtragsvoranschlag ist ein Planungsdokument — das
  // Budgetierungspolster gilt fuer ihn genauso wie fuer den Voranschlag.
  pruefe(
    "agg.polster ist Array auch bei NVA-Dokument",
    Array.isArray(datenPK.aggregate[String(defDok.id)].polster),
    typeof datenPK.aggregate[String(defDok.id)].polster,
  )
  // Die Vorbelegung des Vergleichs ist das VA/NVA-Paar desselben Jahres.
  const stdV = datenPK.meta.default_vergleich
  const stdA = datenPK.dokumente.find((d) => String(d.id) === String(stdV.a))
  const stdB = datenPK.dokumente.find((d) => String(d.id) === String(stdV.b))
  pruefe(
    "default_vergleich ist VA 2026 -> NVA 2026",
    stdA.label === "VA 2026" && stdB.label === "NVA 2026",
    `${stdA && stdA.label} -> ${stdB && stdB.label}`,
  )
  pruefe(
    "standardVergleich mit einem Dokument liefert null",
    standardVergleich([{ id: 1, typ: "VA", jahr: 2026 }]) === null,
  )
  pruefe(
    "standardVergleich ohne NVA nimmt die zwei juengsten",
    JSON.stringify(
      standardVergleich([
        { id: 7, typ: "RA", jahr: 2024 },
        { id: 8, typ: "VA", jahr: 2025 },
        { id: 9, typ: "VA", jahr: 2026 },
      ]),
    ) === JSON.stringify({ a: 8, b: 9 }),
  )

  // ======================================================================
  // Diff-Engine — Vergleich VA 2026 gegen NVA 2026
  // ======================================================================
  console.log("\nvergleich-daten — Diff zweier Dokumente")
  const dVa = datenPK.dokumente.find((d) => d.label === "VA 2026")
  const dNva = datenPK.dokumente.find((d) => d.label === "NVA 2026")

  // Der VRV-Schluessel (Ansatz, Konto, Richtung) ist im Detailnachweis
  // eindeutig — das ist die Voraussetzung dafuer, dass der Diff exakt ist.
  const aggNva = aggregiereDokument(datenPK.posten, dNva.id, "EHH")
  const postenNva = datenPK.posten.filter(
    (p) => String(p.dok) === String(dNva.id),
  )
  pruefe(
    "VRV-Schluessel ist im Dokument eindeutig (1114 Posten, 1114 Schluessel)",
    postenNva.length === 1114 && aggNva.size === 1114,
    `${postenNva.length} Posten / ${aggNva.size} Schluessel`,
  )

  const dEhh = baueDiff(datenPK.posten, datenPK.dokumente, {
    a: dVa.id,
    b: dNva.id,
    haushalt: "EHH",
  })
  // Referenz: die Summenzeilen der Anlage 1a des NVA 2026 (Seite 19)
  // weisen 23.330.800 Ertraege und 22.569.100 Aufwendungen aus.
  const kEin = dEhh.eckwerte.find((k) => k.titel === "Ertraege")
  const kAus = dEhh.eckwerte.find((k) => k.titel === "Aufwendungen")
  const kNet = dEhh.eckwerte.find((k) => k.titel === "Nettoergebnis")
  pruefe(
    "EHH: Ertraege des NVA == 23330800 (Anlage 1a)",
    kEin.b === 23330800,
    String(kEin.b),
  )
  pruefe(
    "EHH: Aufwendungen des NVA == 22569100 (Anlage 1a)",
    kAus.b === 22569100,
    String(kAus.b),
  )
  pruefe(
    "EHH: Nettoergebnis des NVA == 761700 (Anlage 1a)",
    kNet.b === 761700,
    String(kNet.b),
  )
  pruefe(
    "EHH: Nettoergebnis-Delta == Ertrags- minus Aufwands-Delta",
    kNet.delta === kEin.delta - kAus.delta,
    `${kNet.delta} vs ${kEin.delta - kAus.delta}`,
  )
  // Der Wasserfall muss aufgehen: die Summe aller Stufen ist genau die
  // Differenz der beiden Saldi, sonst fehlt oder doppelt ein Beitrag.
  const wSumme = dEhh.wasserfall.schritte.reduce((x, e) => x + e.beitrag, 0)
  pruefe(
    "EHH: Wasserfall-Stufen summieren sich auf die Saldo-Differenz",
    wSumme === dEhh.wasserfall.nach - dEhh.wasserfall.von,
    `${wSumme} vs ${dEhh.wasserfall.nach - dEhh.wasserfall.von}`,
  )
  pruefe(
    "EHH: Statuszaehlung summiert sich auf die Zeilenzahl",
    dEhh.status.neu +
      dEhh.status.entfallen +
      dEhh.status.geaendert +
      dEhh.status.unveraendert ===
      dEhh.zeilen.length,
  )
  pruefe(
    "EHH: Zeilen nach Betrag der Veraenderung sortiert",
    dEhh.zeilen.every(
      (r, i) =>
        i === 0 || Math.abs(dEhh.zeilen[i - 1].delta) >= Math.abs(r.delta),
    ),
  )
  pruefe(
    "EHH: keine Zeile mit Null in beiden Dokumenten",
    dEhh.zeilen.every((r) => r.a !== 0 || r.b !== 0),
  )
  // Die Gruppen-Aggregation darf nichts verlieren.
  const gSumme = dEhh.gruppen.reduce((x, g) => x + g.einnahme + g.ausgabe, 0)
  const zSumme = dEhh.zeilen.reduce((x, r) => x + r.delta, 0)
  pruefe(
    "EHH: Gruppen-Aggregation erhaelt die Summe der Veraenderungen",
    gSumme === zSumme,
    `${gSumme} vs ${zSumme}`,
  )

  // Finanzierungshaushalt: eigene Kennzahlen, investive Auszahlungen dabei.
  const dFhh = baueDiff(datenPK.posten, datenPK.dokumente, {
    a: dVa.id,
    b: dNva.id,
    haushalt: "FHH",
  })
  pruefe(
    "FHH: vier Kennzahlen inkl. investiver Auszahlungen",
    dFhh.eckwerte.length === 4 &&
      dFhh.eckwerte[3].titel.includes("investive"),
    JSON.stringify(dFhh.eckwerte.map((k) => k.titel)),
  )
  pruefe(
    "FHH: investive Auszahlungen 13361100 -> 11556900",
    dFhh.eckwerte[3].a === 13361100 && dFhh.eckwerte[3].b === 11556900,
    `${dFhh.eckwerte[3].a} -> ${dFhh.eckwerte[3].b}`,
  )
  pruefe(
    "EHH und FHH werden getrennt gerechnet (verschiedene Summen)",
    dEhh.eckwerte[0].b !== dFhh.eckwerte[0].b,
  )

  // Richtungstausch spiegelt jede Veraenderung.
  const dTausch = baueDiff(datenPK.posten, datenPK.dokumente, {
    a: dNva.id,
    b: dVa.id,
    haushalt: "EHH",
  })
  pruefe(
    "Tausch der Richtung spiegelt die Veraenderung",
    dTausch.zeilen.length === dEhh.zeilen.length &&
      dTausch.zeilen.reduce((x, r) => x + r.delta, 0) === -zSumme,
  )

  // Selbstkontrolle: der NVA druckt den Voranschlag in seiner zweiten Spalte
  // mit ab. Die aufgelegte Fassung des VA 2026 weicht davon in genau einer
  // Sache ab — die Community Nurse fehlt ihr (Aufwand 100.600, Ertrag
  // 100.000). Genau das soll die Kontrolle finden.
  pruefe(
    "Kontrolle laeuft fuer das Paar VA -> NVA desselben Jahres",
    dEhh.kontrolle !== null && dEhh.kontrolle.spalte === "VA 2026",
    dEhh.kontrolle && dEhh.kontrolle.spalte,
  )
  pruefe(
    "Kontrolle findet die Fassungsdifferenz (2 Stellen, 200600 EUR)",
    dEhh.kontrolle.abweichungen.length === 2 &&
      dEhh.kontrolle.summeAbweichung === 200600,
    JSON.stringify({
      n: dEhh.kontrolle.abweichungen.length,
      summe: dEhh.kontrolle.summeAbweichung,
    }),
  )
  pruefe(
    "Kontrolle benennt die betroffene Haushaltsstelle (Community Nurse)",
    dEhh.kontrolle.abweichungen.every((r) => r.ansatz === "429000"),
    JSON.stringify(dEhh.kontrolle.abweichungen.map((r) => r.ansatz)),
  )
  pruefe(
    "Kontrolle entfaellt fuer ein Paar, das sie nicht belegen kann",
    baueDiff(datenPK.posten, datenPK.dokumente, {
      a: datenPK.dokumente.find((d) => d.label === "RA 2024").id,
      b: dNva.id,
      haushalt: "EHH",
    }).kontrolle === null,
  )

  // RA-Soll (CONTEXT.md D2): der NVA 2025 druckt in seiner Spalte 1 den Plan
  // inklusive Nachtrag ab — genau das Soll, das der RA 2025 in seiner
  // Spalte 2 abdruckt. Die widerlegte Ausschlussbegruendung ist weg, der
  // RA-Fall ist jetzt pruefbar.
  const dNva2025 = datenPK.dokumente.find((d) => d.label === "NVA 2025")
  const dRa2025 = datenPK.dokumente.find((d) => d.label === "RA 2025")
  const raKEhh = baueDiff(datenPK.posten, datenPK.dokumente, {
    a: dNva2025.id,
    b: dRa2025.id,
    haushalt: "EHH",
  }).kontrolle
  pruefe(
    "Kontrolle NVA 2025 -> RA 2025 EHH: 1156 geprueft, 0 Abweichungen, bestanden",
    raKEhh !== null &&
      raKEhh.geprueft === 1156 &&
      raKEhh.abweichungen.length === 0 &&
      raKEhh.bestanden === true,
    JSON.stringify(raKEhh),
  )
  pruefe(
    "Kontrolle NVA 2025 -> RA 2025 EHH: spalte ist 'Soll 2025 (laut RA)'",
    raKEhh.spalte === "Soll 2025 (laut RA)",
    raKEhh.spalte,
  )
  const raKFhh = baueDiff(datenPK.posten, datenPK.dokumente, {
    a: dNva2025.id,
    b: dRa2025.id,
    haushalt: "FHH",
  }).kontrolle
  pruefe(
    "Kontrolle NVA 2025 -> RA 2025 FHH: 1160 geprueft, 0 Abweichungen, bestanden",
    raKFhh !== null &&
      raKFhh.geprueft === 1160 &&
      raKFhh.abweichungen.length === 0 &&
      raKFhh.bestanden === true,
    JSON.stringify(raKFhh),
  )
  pruefe(
    "Kontrolle laeuft weiter fuer das Paar VA -> NVA desselben Jahres (spalte 'VA 2026')",
    dEhh.kontrolle !== null && dEhh.kontrolle.spalte === "VA 2026",
    dEhh.kontrolle && dEhh.kontrolle.spalte,
  )

  // ======================================================================
  // Diff-Engine — interner Vergleich: die abgedruckte Vergleichsspalte als
  // Basis (BASIS_INTERN)
  // ======================================================================
  console.log(
    "\nvergleich-daten — interner Vergleich (abgedruckte Spalte als Basis)",
  )

  // Summe der abgedruckten Differenz (Spalte 3, "1. NVA" bzw. "Abweichung
  // RA-VA") je VRV-Schluessel — die unabhaengige Referenz, gegen die der
  // interne Diff Zeile fuer Zeile geprueft wird.
  function spalte3Summen(posten, dokId, feld) {
    const map = new Map()
    for (const p of posten) {
      if (String(p.dok) !== String(dokId)) continue
      const k = schluessel(p)
      map.set(k, (map.get(k) || 0) + (p[feld] || 0))
    }
    return map
  }

  const iEhh = baueDiff(datenPK.posten, datenPK.dokumente, {
    a: BASIS_INTERN,
    b: dNva.id,
    haushalt: "EHH",
  })
  pruefe(
    "Interner Diff NVA 2026 EHH: 1048 Zeilen",
    iEhh.zeilen.length === 1048,
    String(iEhh.zeilen.length),
  )
  pruefe(
    "Interner Diff NVA 2026 EHH: Status 32/6/122/888",
    JSON.stringify(iEhh.status) ===
      JSON.stringify({
        neu: 32,
        entfallen: 6,
        geaendert: 122,
        unveraendert: 888,
        gesamt: 1048,
        veraendert: 160,
      }),
    JSON.stringify(iEhh.status),
  )
  const iEin = iEhh.eckwerte.find((k) => k.titel === "Ertraege")
  const iAus = iEhh.eckwerte.find((k) => k.titel === "Aufwendungen")
  const iNet = iEhh.eckwerte.find((k) => k.titel === "Nettoergebnis")
  pruefe(
    "Interner Diff: Ertraege-Delta +790300 (Anlage 1a)",
    iEin.delta === 790300,
    String(iEin.delta),
  )
  pruefe(
    "Interner Diff: Aufwendungen-Delta +502200 (Anlage 1a)",
    iAus.delta === 502200,
    String(iAus.delta),
  )
  pruefe(
    "Interner Diff: Nettoergebnis-Delta +288100 (Anlage 1a)",
    iNet.delta === 288100,
    String(iNet.delta),
  )
  pruefe(
    "Interner Diff: Wasserfall 473600 -> 761700",
    iEhh.wasserfall.von === 473600 && iEhh.wasserfall.nach === 761700,
    `${iEhh.wasserfall.von} -> ${iEhh.wasserfall.nach}`,
  )

  // Zeile fuer Zeile gegen die abgedruckte Spalte 3.
  const spalte3NvaEhh = spalte3Summen(datenPK.posten, dNva.id, "ed")
  let abwEhh = 0
  let bewegteEhh = 0
  for (const z of iEhh.zeilen) {
    const erwartet = Math.round(spalte3NvaEhh.get(z.key) || 0)
    if (z.delta !== erwartet) abwEhh++
    if (erwartet !== 0) bewegteEhh++
  }
  pruefe(
    "Interner Diff EHH: 0 Abweichungen gegen die abgedruckte Spalte 3",
    abwEhh === 0,
    String(abwEhh),
  )
  pruefe(
    "Interner Diff EHH: 160 Schluessel mit Bewegung gegen Spalte 3",
    bewegteEhh === 160,
    String(bewegteEhh),
  )

  const iFhh = baueDiff(datenPK.posten, datenPK.dokumente, {
    a: BASIS_INTERN,
    b: dNva.id,
    haushalt: "FHH",
  })
  const spalte3NvaFhh = spalte3Summen(datenPK.posten, dNva.id, "fd")
  let abwFhh = 0
  let bewegteFhh = 0
  for (const z of iFhh.zeilen) {
    const erwartet = Math.round(spalte3NvaFhh.get(z.key) || 0)
    if (z.delta !== erwartet) abwFhh++
    if (erwartet !== 0) bewegteFhh++
  }
  pruefe(
    "Interner Diff FHH: 0 Abweichungen gegen die abgedruckte Spalte 3",
    abwFhh === 0,
    String(abwFhh),
  )
  pruefe(
    "Interner Diff FHH: 178 Schluessel mit Bewegung gegen Spalte 3",
    bewegteFhh === 178,
    String(bewegteFhh),
  )

  // Derselbe Vergleich fuer RA 2025 als Vergleichsdokument (Spalte 3 dort
  // "Abweichung RA-VA"). Keine belastbare Zahl bewegter Schluessel in der
  // Recherche — nur "0 Abweichungen" und "mehr als 0 geprueft" gepinnt.
  // (dRa2025 ist bereits oben im Kontroll-Block definiert.)
  const iRaEhh = baueDiff(datenPK.posten, datenPK.dokumente, {
    a: BASIS_INTERN,
    b: dRa2025.id,
    haushalt: "EHH",
  })
  const spalte3RaEhh = spalte3Summen(datenPK.posten, dRa2025.id, "ed")
  let abwRa = 0
  for (const z of iRaEhh.zeilen) {
    const erwartet = Math.round(spalte3RaEhh.get(z.key) || 0)
    if (z.delta !== erwartet) abwRa++
  }
  pruefe(
    "Interner Diff RA 2025 EHH: 0 Abweichungen gegen die abgedruckte Spalte 3",
    abwRa === 0,
    String(abwRa),
  )
  pruefe(
    "Interner Diff RA 2025 EHH: mehr als 0 Schluessel geprueft",
    iRaEhh.zeilen.length > 0,
    String(iRaEhh.zeilen.length),
  )

  // Kein Mutations-Leck: ohne Klon wuerde jedes delta 0, von === nach.
  pruefe(
    "Interner Diff: kein Mutations-Leck (von !== nach, unveraendert < gesamt)",
    iEhh.wasserfall.von !== iEhh.wasserfall.nach &&
      iEhh.status.unveraendert < iEhh.status.gesamt,
    `von=${iEhh.wasserfall.von} nach=${iEhh.wasserfall.nach} ` +
      `unveraendert=${iEhh.status.unveraendert}/${iEhh.status.gesamt}`,
  )
  const dEhhNochmal = baueDiff(datenPK.posten, datenPK.dokumente, {
    a: dVa.id,
    b: dNva.id,
    haushalt: "EHH",
  })
  pruefe(
    "Zwei-Dokumente-Diff bleibt unveraendert nach dem internen Diff",
    dEhhNochmal.wasserfall.von === dEhh.wasserfall.von &&
      dEhhNochmal.wasserfall.nach === dEhh.wasserfall.nach &&
      JSON.stringify(dEhhNochmal.status) === JSON.stringify(dEhh.status),
  )

  // Keine Tautologie-Kontrolle: kontrolle() darf im internen Modus nicht
  // rechnen, nur die Voraussetzung der Pruefung nennen.
  pruefe(
    "Interner Diff: kontrolle.modus ist 'intern', kein bestanden-Feld",
    iEhh.kontrolle.modus === "intern" && iEhh.kontrolle.bestanden === undefined,
    JSON.stringify(iEhh.kontrolle),
  )
  pruefe(
    "Interner Diff: kontrolle.spalte ist 'VA 2026 (laut NVA)'",
    iEhh.kontrolle.spalte === "VA 2026 (laut NVA)",
    iEhh.kontrolle.spalte,
  )
  pruefe(
    "Interner Diff: kontrolle.ausloeser nennt VA 2026, geladen",
    iEhh.kontrolle.ausloeser.label === "VA 2026" &&
      iEhh.kontrolle.ausloeser.geladen === true,
    JSON.stringify(iEhh.kontrolle.ausloeser),
  )

  // interneBasisLabel
  pruefe(
    "interneBasisLabel NVA 2026: 'VA 2026 (laut NVA)'",
    interneBasisLabel(dNva) === "VA 2026 (laut NVA)",
    interneBasisLabel(dNva),
  )
  pruefe(
    "interneBasisLabel RA 2025: 'Soll 2025 (laut RA)'",
    interneBasisLabel(dRa2025) === "Soll 2025 (laut RA)",
    interneBasisLabel(dRa2025),
  )
  pruefe(
    "interneBasisLabel VA 2026: 'VA 2025 (laut VA)'",
    interneBasisLabel(dVa) === "VA 2025 (laut VA)",
    interneBasisLabel(dVa),
  )

  // hatVergleichsspalte: alle fuenf PDF-Dokumente fuehren Zahlen in Spalte 2,
  // in beiden Haushaltshaelften.
  for (const d of datenPK.dokumente) {
    pruefe(
      `hatVergleichsspalte(EHH) === true fuer ${d.label}`,
      hatVergleichsspalte(datenPK.posten, d.id, "EHH") === true,
    )
    pruefe(
      `hatVergleichsspalte(FHH) === true fuer ${d.label}`,
      hatVergleichsspalte(datenPK.posten, d.id, "FHH") === true,
    )
  }

  // CSV-Kopfzeile mit der internen Basis als Label.
  const csvInternZeilen = alsCsv(
    iEhh.zeilen.slice(0, 3),
    "VA 2026 (laut NVA)",
    "NVA 2026",
  ).split("\n")
  const csvInternFelder = csvInternZeilen[0].split(";")
  pruefe(
    "CSV-Export interner Basis: 14 Felder, Feld 10 ist 'VA 2026 (laut NVA)'",
    csvInternFelder.length === 14 &&
      csvInternFelder[9] === "VA 2026 (laut NVA)",
    csvInternZeilen[0],
  )

  // Wasserfall-Achse mit der internen Basis als erste Kategorie.
  const cWIntern = chartDiffWasserfall(iEhh, "VA 2026 (laut NVA)", "NVA 2026")
  pruefe(
    "chartDiffWasserfall interner Modus: erste/letzte Kategorie",
    cWIntern.xAxis.data[0] === "VA 2026 (laut NVA)" &&
      cWIntern.xAxis.data[cWIntern.xAxis.data.length - 1] === "NVA 2026",
    JSON.stringify([
      cWIntern.xAxis.data[0],
      cWIntern.xAxis.data[cWIntern.xAxis.data.length - 1],
    ]),
  )

  // Filter
  console.log("\nvergleich-daten — Filter und Export")
  pruefe(
    "Filter 'nur Veraenderungen' entfernt die unveraenderten Zeilen",
    filtereZeilen(dEhh.zeilen, { status: "veraendert" }).length ===
      dEhh.zeilen.length - dEhh.status.unveraendert,
  )
  pruefe(
    "Filter Richtung wirkt",
    filtereZeilen(dEhh.zeilen, { richtung: "ausgabe" }).every(
      (r) => r.richtung === "ausgabe",
    ),
  )
  pruefe(
    "Filter Schwelle laesst nur grosse Veraenderungen durch",
    filtereZeilen(dEhh.zeilen, { schwelle: 50000 }).every(
      (r) => Math.abs(r.delta) >= 50000,
    ),
  )
  pruefe(
    "Filter Volltext findet die Kommunalsteuer",
    filtereZeilen(dEhh.zeilen, { suche: "kommunalsteuer" }).length > 0,
  )
  pruefe(
    "Filter kombiniert (Gruppe + Status + Schwelle)",
    filtereZeilen(dEhh.zeilen, {
      gruppe: "6",
      status: "veraendert",
      schwelle: 10000,
    }).every(
      (r) =>
        r.gruppe === "6" &&
        r.status !== "unveraendert" &&
        Math.abs(r.delta) >= 10000,
    ),
  )
  const csv = alsCsv(dEhh.zeilen.slice(0, 3), "VA 2026", "NVA 2026")
  const csvZeilen = csv.split("\n")
  pruefe(
    "CSV-Export: Kopfzeile traegt die Dokumentlabels",
    csvZeilen[0].includes("VA 2026") && csvZeilen[0].includes("NVA 2026"),
    csvZeilen[0],
  )
  pruefe(
    "CSV-Export: eine Zeile je Posten, gleiche Spaltenzahl",
    csvZeilen.length === 4 &&
      csvZeilen.every((z) => z.split(";").length === 14),
  )

  // Diagramm-Vorlagen der Diff-Ansicht
  console.log("\ndashboard-charts — Diagramme der Vergleichsansicht")
  const cW = chartDiffWasserfall(dEhh, "VA 2026", "NVA 2026")
  pruefe(
    "chartDiffWasserfall: Sockel- und Wertreihe gleich lang",
    cW.series[0].data.length === cW.series[1].data.length &&
      cW.series[0].data.length === cW.xAxis.data.length,
  )
  pruefe(
    "chartDiffWasserfall: erste und letzte Kategorie sind die Dokumente",
    cW.xAxis.data[0] === "VA 2026" &&
      cW.xAxis.data[cW.xAxis.data.length - 1] === "NVA 2026",
  )
  const cG = chartDiffGruppen(dEhh)
  pruefe(
    "chartDiffGruppen: zwei Reihen (Ertraege, Aufwendungen)",
    cG.series.length === 2 &&
      cG.series[0].name.includes("Ertraege") &&
      cG.series[1].name.includes("Aufwendungen"),
    JSON.stringify(cG.series.map((r) => r.name)),
  )
  pruefe(
    "chartDiffGruppen: FHH benennt Ein- und Auszahlungen",
    chartDiffGruppen(dFhh).series[0].name.includes("Einzahlungen"),
  )
  const cT = chartDiffTreemap(dEhh)
  pruefe(
    "chartDiffTreemap: Knoten tragen Betrag und Vorzeichen",
    cT.series[0].data.length > 0 &&
      cT.series[0].data.every((g) =>
        g.children.every(
          (k) => k.value >= 0 && typeof k.delta === "number" &&
            k.itemStyle.color.startsWith("#"),
        ),
      ),
  )

  console.log(
    `\n${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`,
  )
  process.exit(fehlgeschlagen === 0 ? 0 : 1)
}

teste().catch((e) => {
  console.error("Testlauf abgebrochen:", e)
  process.exit(1)
})
