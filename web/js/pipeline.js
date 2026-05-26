// Verarbeitungspipeline — bindet Extraktion, Parsing, Validierung und
// Datenhaltung zusammen. Eine PDF -> Posten in der DB, mit Fortschrittsmeldung.
//
// Das Modul kennt die Umgebung nicht: die mupdf- und sqlite-Instanzen werden
// von der Anwendung hereingereicht. Dadurch laeuft dieselbe Pipeline in Node
// (Tests) wie im Browser.

import { openDocument, documentMeta } from "./extract.js"
import { parseDocument, ParseResult, Posten } from "./parser.js"
import { validate, pruefStatus } from "./validate.js"
import {
  dokumentDatensatz,
  referenzDatensaetze,
  postenDatensaetze,
  spalten,
} from "./loader.js"
import { dokumentSchreiben } from "./db.js"
import {
  parseCsvBytes,
  synthAggregate,
  mergeParseResults,
} from "./csv-parser.js"

// Eine PDF vollstaendig verarbeiten und in die DB schreiben.
//
//   mupdf      — geladene mupdf-Instanz
//   db         — geoeffnete Datenbank (db.js)
//   dateiname  — Anzeigename / Quelldatei-Schluessel
//   bytes      — Uint8Array der PDF
//   melde      — optionaler Callback (stufe) fuer den Fortschritt
//
// Liefert { dokId, meta, pruefung, status }.
export async function verarbeitePdf(mupdf, db, dateiname, bytes, melde) {
  const stufe = (s) => {
    if (melde) melde(s)
  }

  stufe("extraktion")
  const doc = openDocument(mupdf, bytes)
  const meta = documentMeta(doc)
  meta.seiten = doc.countPages()
  if (!meta.typ) {
    throw new Error(
      "Kein VRV-Dokument erkannt — Typ (VA/NVA/RA) nicht im Seitenkopf.",
    )
  }

  stufe("parsing")
  const result = parseDocument(doc)
  if (result.posten.length === 0) {
    throw new Error(
      "Kein Detailnachweis geparst — ist das eine VRV-2015-PDF?",
    )
  }

  stufe("validierung")
  const pruefung = validate(result)
  const status = pruefStatus(pruefung)

  stufe("speichern")
  const dok = dokumentDatensatz(dateiname, meta)
  const ref = referenzDatensaetze(result)
  const dokId = dokumentSchreiben(db, dok, ref, postenDatensaetze(result))

  stufe("fertig")
  return { dokId, meta, pruefung, status }
}

// --- CSV-Pfad ------------------------------------------------------------- //
//
// Eine OH-CSV von offenerhaushalt.at traegt nur eine Haushalts-Haelfte
// (EHH oder FHH). Fachlich gehoeren EHH+FHH derselben Gemeinde, des
// gleichen Jahres und Dokumenttyps zusammen — der User kann beide auf
// einmal ueber den Datei-Dialog auswaehlen oder einzeln nachreichen. Diese
// Funktion buendelt eine Liste CSV-Eingaben in Dokumente (Schluessel:
// Gemeinde+Jahr+Typ+Datenquelle), mergt EHH+FHH, fuegt synthetische
// SU/SA-Aggregate hinzu (damit validate.js durchlaeuft) und schreibt
// jedes Dokument in einem Stueck in die DB.
//
// Liegt zu einem Schluessel bereits ein Halb-Dokument in der DB (z.B.
// weil der User in einem ersten Upload nur EHH hochgeladen hat und jetzt
// FHH nachreicht), werden dessen Detail-Posten aus der DB geladen,
// gemerged und das Dokument wird vollstaendig neu geschrieben.
//
// Eingabe: dateien = [{name, bytes}, ...].
// Liefert: { dokumente: [{dokId, meta, pruefung, status, dateinamen,
//                         fassung}], warnungen }
//
// `melde` ist optional; ein Callback (gruppenName, stufe) — wird pro
// Gruppe einmal mit den ueblichen Stufen aus app.js befeuert.
export async function verarbeiteCsvDateien(db, dateien, melde) {
  const ergebnis = { dokumente: [], warnungen: [] }
  if (dateien.length === 0) return ergebnis

  // 1) Alle CSVs parsen (nur Detail-Posten, keine Aggregate).
  const teile = []
  for (const d of dateien) {
    let parsed
    try {
      parsed = parseCsvBytes(d.bytes)
    } catch (e) {
      throw new Error(`${d.name}: ${e.message || String(e)}`)
    }
    teile.push({ name: d.name, ...parsed })
  }

  // 2) Nach Dokumentschluessel buendeln. Schluessel ist GKZ + Jahr + Typ +
  //    Datenquelle — das macht ein Dokument im OH-Sinn eindeutig.
  const gruppen = new Map()
  for (const t of teile) {
    const m = t.meta
    const key = `${m.gkz}|${m.finanzjahr}|${m.typ}|${m.datenquelle}`
    if (!gruppen.has(key)) gruppen.set(key, { meta: m, teile: [] })
    gruppen.get(key).teile.push(t)
  }

  for (const [, gruppe] of gruppen) {
    const { meta, teile: gt } = gruppe
    // 3) Wenn EHH und FHH derselben Datei doppelt drin sind, gewinnt der
    //    letzte Eintrag. (Selten — wir warnen aber nicht; Filename-Konflikte
    //    sind nicht unser Job.)
    const ehh = gt.filter((t) => t.meta.haushalt === "EHH").pop()
    const fhh = gt.filter((t) => t.meta.haushalt === "FHH").pop()

    // 4) Existierendes Dokument in der DB? Suche per (gemeinde, typ,
    //    finanzjahr) + fassung muss mit 'CSV' beginnen — sonst koennten
    //    PDFs (Auflage) faelschlich als Partner erkannt werden.
    const jahr = /^\d+$/.test(meta.finanzjahr) ? Number(meta.finanzjahr) : null
    const vorhanden = db.abfrage(
      `SELECT dokument_id, fassung, quelldatei
       FROM dokument
       WHERE gemeinde=? AND typ=? AND finanzjahr=?
         AND fassung LIKE 'OH-CSV%'`,
      [meta.gemeinde, meta.typ, jahr],
    )

    if (melde) melde(meta, "parsing")

    // 5) Aus dem Vorhanden-Dokument die existierenden Detail-Posten
    //    nachladen und in ein ParseResult einfuegen, damit der Merge die
    //    bereits geladene Haelfte mit der frischen aus der CSV verbindet.
    let altesParseResult = null
    let alteDateinamen = ""
    if (vorhanden.length > 0) {
      const dokId = vorhanden[0].dokument_id
      alteDateinamen = vorhanden[0].quelldatei || ""
      altesParseResult = leseDetailsAusDb(db, dokId)
    }

    // 6) Alle relevanten ParseResults mergen.
    let merged = ehh ? ehh.result : null
    if (fhh) merged = mergeParseResults(merged, fhh.result)
    if (altesParseResult) {
      // Nur die Haelfte einbeziehen, die nicht in den frischen CSVs
      // ist — sonst doppeln wir Posten. Filter nach Haushalt:
      // Posten haben mvag_eh -> EHH, mvag_fh -> FHH.
      const behalten = new ParseResult()
      Object.assign(behalten.ansatz_namen, altesParseResult.ansatz_namen)
      Object.assign(behalten.konto_namen, altesParseResult.konto_namen)
      for (const p of altesParseResult.posten) {
        const istEhh = !!p.mvag_eh
        const istFhh = !!p.mvag_fh
        if (istEhh && ehh) continue       // neue EHH-Quelle vorhanden
        if (istFhh && fhh) continue       // neue FHH-Quelle vorhanden
        behalten.posten.push(p)
      }
      merged = mergeParseResults(merged, behalten)
    }

    if (!merged || merged.posten.length === 0) {
      ergebnis.warnungen.push(
        `Keine Detail-Posten geparst (${meta.gemeinde} ${meta.typ} ${meta.finanzjahr}).`,
      )
      continue
    }

    // 7) Synthetische SU/SA-Aggregate anhaengen.
    if (melde) melde(meta, "validierung")
    synthAggregate(merged)

    // 8) Welche Haelften sind im Endergebnis vertreten? Daraus
    //    bestimmen wir die Fassungs-Beschriftung.
    const hatEhh = merged.posten.some(
      (p) => p.zeilentyp === "detail" && p.mvag_eh,
    )
    const hatFhh = merged.posten.some(
      (p) => p.zeilentyp === "detail" && p.mvag_fh,
    )
    let fassung
    if (hatEhh && hatFhh) fassung = "OH-CSV"
    else if (hatEhh) fassung = "OH-CSV (nur EHH)"
    else fassung = "OH-CSV (nur FHH)"

    // 9) Dokument-Datensatz aufbauen.
    const dateinamen = []
    if (ehh) dateinamen.push(ehh.name)
    if (fhh) dateinamen.push(fhh.name)
    if (altesParseResult && alteDateinamen) {
      for (const teil of alteDateinamen.split(" + ")) {
        const t = teil.trim()
        if (t && !dateinamen.includes(t)) dateinamen.push(t)
      }
    }
    const quelldatei = dateinamen.join(" + ")
    const [sp_wert, sp_vergleich, sp_dritte] = spalten(meta.typ, jahr)
    const dok = {
      gemeinde: meta.gemeinde,
      typ: meta.typ,
      finanzjahr: jahr,
      spalte_wert: sp_wert,
      spalte_vergleich: sp_vergleich,
      spalte_dritte: sp_dritte,
      fassung,
      quelldatei,
      seiten: null,
    }

    // 10) Idempotenz: bestehendes Dokument loeschen (dokumentSchreiben
    //     macht das nur ueber quelldatei — bei einer FHH-Nachreichung
    //     hat sich die quelldatei aber geaendert, daher loeschen wir
    //     hier explizit das Vorgaenger-Dokument).
    if (vorhanden.length > 0) {
      const altId = vorhanden[0].dokument_id
      db.transaktion(() => {
        db.ausfuehren("DELETE FROM posten WHERE dokument_id=?", [altId])
        db.ausfuehren("DELETE FROM dokument WHERE dokument_id=?", [altId])
      })
    }

    if (melde) melde(meta, "speichern")
    const ref = referenzDatensaetze(merged)
    const dokId = dokumentSchreiben(db, dok, ref, postenDatensaetze(merged))
    const pruefung = validate(merged)
    const status = pruefStatus(pruefung)

    if (melde) melde(meta, "fertig")

    ergebnis.dokumente.push({
      dokId, meta, pruefung, status, dateinamen, fassung,
    })
  }

  return ergebnis
}

// Detailposten eines Dokuments aus der DB als ParseResult rekonstruieren
// — Grundlage fuer Nachreichungen von EHH oder FHH zu einem bereits
// geladenen Halb-Dokument. Aggregat-Zeilen (zeilentyp != 'detail') werden
// nicht uebernommen; sie werden ohnehin in synthAggregate neu gebaut.
function leseDetailsAusDb(db, dokId) {
  const rows = db.abfrage(
    `SELECT seite, zeilentyp, vrk, richtung, ansatz, konto, gruppe,
            bezeichnung, gebarung,
            eh_wert, eh_vergleich, eh_dritte,
            fh_wert, fh_vergleich, fh_dritte,
            mvag_eh, mvag_fh, qu
       FROM posten
      WHERE dokument_id=? AND zeilentyp='detail'`,
    [dokId],
  )
  const pr = new ParseResult()
  let i = 1
  for (const r of rows) {
    const p = new Posten(i++, "detail", r.bezeichnung || "")
    p.vrk = r.vrk || ""
    p.richtung = r.richtung || null
    p.ansatz = r.ansatz || null
    p.konto = r.konto || null
    p.gruppe = r.gruppe || null
    p.gebarung = r.gebarung || null
    p.eh_wert = r.eh_wert
    p.eh_vergleich = r.eh_vergleich
    p.eh_dritte = r.eh_dritte
    p.fh_wert = r.fh_wert
    p.fh_vergleich = r.fh_vergleich
    p.fh_dritte = r.fh_dritte
    p.mvag_eh = r.mvag_eh || ""
    p.mvag_fh = r.mvag_fh || ""
    p.qu = r.qu || ""
    pr.posten.push(p)
    if (p.ansatz && p.bezeichnung && !(p.ansatz in pr.ansatz_namen)) {
      pr.ansatz_namen[p.ansatz] = ""
    }
    if (p.konto && p.bezeichnung && !(p.konto in pr.konto_namen)) {
      pr.konto_namen[p.konto] = p.bezeichnung
    }
  }
  return pr
}
