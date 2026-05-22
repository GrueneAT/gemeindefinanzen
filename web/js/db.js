// Datenhaltung — sqlite-wasm mit OPFS-Persistenz.
//
// Das Schema (src/gemeindefinanzen/schema.sql) und die Analyse-Abfragen
// (sql/*.sql) laufen unveraendert. Persistenz ueber den OPFS-SAH-Pool-VFS:
// dieser arbeitet im Haupt-Thread und braucht KEINE Cross-Origin-Isolation
// (COOP/COEP) — entscheidend, weil GitHub Pages keine solchen Header setzt.
// Steht OPFS nicht zur Verfuegung, faellt die App auf eine In-Memory-DB
// zurueck; die Daten lassen sich dann ueber exportBytes/importBytes z. B.
// nach IndexedDB sichern.
//
// Begruendung der Architekturwahl (CONTEXT D3): Der SAH-Pool-VFS ist der
// pragmatische Mittelweg — echte Persistenz ohne den Aufwand einer
// Worker-/Promiser-Architektur und ohne Header-Anforderungen.

const DB_NAME = "gemeindefinanzen.sqlite3"
const POOL_VERZEICHNIS = "/gemeindefinanzen"

let _sqlite3 = null

// sqlite-wasm einmalig laden. `initModul` ist die Default-Export-Funktion des
// Pakets @sqlite.org/sqlite-wasm (im Browser) bzw. dessen node-Variante.
async function ladeSqlite(initModul) {
  if (_sqlite3) return _sqlite3
  _sqlite3 = await initModul()
  return _sqlite3
}

// Eine geoeffnete Datenbank samt Persistenzart.
export class Datenbank {
  constructor(sqlite3, handle, persistent) {
    this.sqlite3 = sqlite3
    this.handle = handle
    this.persistent = persistent
  }

  // Schema (mehrfach-aufrufbar, CREATE IF NOT EXISTS) anwenden.
  schemaAnwenden(schemaSql) {
    this.handle.exec(schemaSql)
  }

  // Eine Abfrage ausfuehren, Zeilen als Objekte zurueckgeben.
  abfrage(sql, bind = []) {
    const opt = { sql, returnValue: "resultRows", rowMode: "object" }
    if (bind.length) opt.bind = bind
    return this.handle.exec(opt)
  }

  // Einen Skalarwert abfragen.
  wert(sql, bind = []) {
    return bind.length
      ? this.handle.selectValue(sql, bind)
      : this.handle.selectValue(sql)
  }

  // Anweisung ohne Ergebnis (INSERT/UPDATE/DELETE) ausfuehren.
  ausfuehren(sql, bind = []) {
    const opt = { sql }
    if (bind.length) opt.bind = bind
    this.handle.exec(opt)
  }

  // Mehrere Anweisungen in einer Transaktion ausfuehren.
  transaktion(fn) {
    this.handle.exec("BEGIN")
    try {
      fn()
      this.handle.exec("COMMIT")
    } catch (e) {
      this.handle.exec("ROLLBACK")
      throw e
    }
  }

  // Datenbank-Inhalt als Byte-Array (zum Sichern, etwa nach IndexedDB).
  exportBytes() {
    return this.sqlite3.capi.sqlite3_js_db_export(this.handle)
  }

  close() {
    this.handle.close()
  }
}

// Datenbank oeffnen. Im Browser wird zuerst der OPFS-SAH-Pool-VFS versucht
// (persistent); klappt das nicht, eine In-Memory-DB.
export async function oeffneDb(initModul) {
  const sqlite3 = await ladeSqlite(initModul)

  if (typeof sqlite3.installOpfsSAHPoolVfs === "function") {
    try {
      const pool = await sqlite3.installOpfsSAHPoolVfs({
        directory: POOL_VERZEICHNIS,
      })
      const handle = new pool.OpfsSAHPoolDb(`/${DB_NAME}`)
      return new Datenbank(sqlite3, handle, true)
    } catch (e) {
      console.warn(
        "OPFS-Persistenz nicht verfuegbar — In-Memory-Datenbank:",
        e.message,
      )
    }
  }

  const handle = new sqlite3.oo1.DB(":memory:", "c")
  return new Datenbank(sqlite3, handle, false)
}

// Eine zuvor exportierte Datenbank (Byte-Array) als In-Memory-DB oeffnen.
export async function importBytes(initModul, bytes) {
  const sqlite3 = await ladeSqlite(initModul)
  const handle = new sqlite3.oo1.DB(":memory:", "c")
  const p = sqlite3.wasm.allocFromTypedArray(bytes)
  const rc = sqlite3.capi.sqlite3_deserialize(
    handle,
    "main",
    p,
    bytes.length,
    bytes.length,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
      sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
  )
  handle.checkRc(rc)
  return new Datenbank(sqlite3, handle, false)
}

// --- Dokument-Schreiblogik (Port der reinen loader.py-Schritte) -------------

// Ein geparstes Dokument in die DB schreiben. `dok` stammt aus
// loader.dokumentDatensatz, `ref` aus loader.referenzDatensaetze, `posten`
// aus loader.postenDatensaetze. Idempotent: vorhandene Zeilen derselben
// Quelldatei werden ersetzt. Liefert die dokument_id.
export function dokumentSchreiben(db, dok, ref, posten) {
  let dokId = 0
  db.transaktion(() => {
    // Erneutes Einlesen derselben Datei ist idempotent.
    const alt = db.abfrage(
      "SELECT dokument_id FROM dokument WHERE quelldatei=?",
      [dok.quelldatei],
    )
    for (const zeile of alt) {
      db.ausfuehren("DELETE FROM posten WHERE dokument_id=?", [
        zeile.dokument_id,
      ])
      db.ausfuehren("DELETE FROM dokument WHERE dokument_id=?", [
        zeile.dokument_id,
      ])
    }
    db.ausfuehren(
      `INSERT INTO dokument
         (gemeinde, typ, finanzjahr, spalte_wert, spalte_vergleich,
          spalte_dritte, fassung, quelldatei, seiten)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        dok.gemeinde,
        dok.typ,
        dok.finanzjahr,
        dok.spalte_wert,
        dok.spalte_vergleich,
        dok.spalte_dritte,
        dok.fassung,
        dok.quelldatei,
        dok.seiten,
      ],
    )
    dokId = db.wert("SELECT last_insert_rowid()")

    for (const [gruppe, bezeichnung] of ref.gruppen) {
      db.ausfuehren(
        "INSERT OR IGNORE INTO ref_gruppe(gruppe, bezeichnung) VALUES (?,?)",
        [gruppe, bezeichnung],
      )
    }
    for (const [mvag, bezeichnung] of ref.mvag) {
      db.ausfuehren(
        "INSERT OR IGNORE INTO ref_mvag(mvag, bezeichnung) VALUES (?,?)",
        [mvag, bezeichnung],
      )
    }
    for (const [ansatz, bezeichnung, gruppe] of ref.ansaetze) {
      db.ausfuehren(
        "INSERT OR REPLACE INTO ref_ansatz(ansatz, bezeichnung, gruppe)" +
          " VALUES (?,?,?)",
        [ansatz, bezeichnung, gruppe],
      )
    }
    for (const [konto, bezeichnung, klasse] of ref.konten) {
      db.ausfuehren(
        "INSERT OR REPLACE INTO ref_konto(konto, bezeichnung, kontenklasse)" +
          " VALUES (?,?,?)",
        [konto, bezeichnung, klasse],
      )
    }

    for (const p of posten) {
      db.ausfuehren(
        `INSERT INTO posten
           (dokument_id, seite, zeilentyp, richtung, vrk, ansatz, konto,
            gruppe, bezeichnung, gebarung, eh_wert, eh_vergleich, eh_dritte,
            fh_wert, fh_vergleich, fh_dritte, mvag_eh, mvag_fh, qu)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          dokId,
          p.seite,
          p.zeilentyp,
          p.richtung,
          p.vrk,
          p.ansatz,
          p.konto,
          p.gruppe,
          p.bezeichnung,
          p.gebarung,
          p.eh_wert,
          p.eh_vergleich,
          p.eh_dritte,
          p.fh_wert,
          p.fh_vergleich,
          p.fh_dritte,
          p.mvag_eh,
          p.mvag_fh,
          p.qu,
        ],
      )
    }
  })
  return dokId
}

// Ein Dokument samt Posten wieder entfernen.
export function dokumentEntfernen(db, dokId) {
  db.transaktion(() => {
    db.ausfuehren("DELETE FROM posten WHERE dokument_id=?", [dokId])
    db.ausfuehren("DELETE FROM dokument WHERE dokument_id=?", [dokId])
  })
}

// Liste der geladenen Dokumente.
export function dokumente(db) {
  return db.abfrage(
    `SELECT dokument_id, gemeinde, typ, finanzjahr, quelldatei, seiten,
            (SELECT COUNT(*) FROM posten
             WHERE posten.dokument_id = dokument.dokument_id
               AND zeilentyp='detail') AS detailposten
     FROM dokument ORDER BY finanzjahr, typ`,
  )
}
