// Verarbeitungspipeline — bindet Extraktion, Parsing, Validierung und
// Datenhaltung zusammen. Eine PDF -> Posten in der DB, mit Fortschrittsmeldung.
//
// Das Modul kennt die Umgebung nicht: die mupdf- und sqlite-Instanzen werden
// von der Anwendung hereingereicht. Dadurch laeuft dieselbe Pipeline in Node
// (Tests) wie im Browser.

import { openDocument, documentMeta } from "./extract.js"
import { parseDocument } from "./parser.js"
import { validate, pruefStatus } from "./validate.js"
import {
  dokumentDatensatz,
  referenzDatensaetze,
  postenDatensaetze,
} from "./loader.js"
import { dokumentSchreiben } from "./db.js"

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
