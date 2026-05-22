// Datenhaltung — sqlite-wasm mit IndexedDB-Persistenz.
//
// Das Schema (src/gemeindefinanzen/schema.sql) und die Analyse-Abfragen
// (sql/*.sql) laufen unveraendert. Die SQLite-DB liegt im Arbeitsspeicher
// (:memory:); ihr Inhalt wird als Byte-Array nach IndexedDB gesichert und
// beim naechsten Oeffnen ueber sqlite3_deserialize wiederhergestellt.
//
// IndexedDB ist in jedem Kontext verfuegbar — es braucht weder OPFS noch
// Cross-Origin-Isolation (COOP/COEP) noch einen besonderen sicheren Kontext.
// Damit funktioniert die Persistenz auch ueber http://localhost und auf
// GitHub Pages zuverlaessig. In Node (Testumgebung) ist `indexedDB`
// undefiniert — dann arbeitet die App als reine In-Memory-DB ohne Fehler.

const DB_NAME = "gemeindefinanzen.sqlite3"
const IDB_NAME = "gemeindefinanzen"
const IDB_STORE = "datenbank"
const IDB_KEY = "sqlite-bytes"

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

  // Den aktuellen Datenbank-Inhalt nach IndexedDB sichern. Steht IndexedDB
  // nicht zur Verfuegung (z. B. in Node), passiert nichts — die DB bleibt
  // eine reine In-Memory-DB. Liefert true, wenn gesichert wurde.
  async sichern() {
    if (!this.persistent) return false
    await idbSchreiben(this.exportBytes())
    return true
  }

  close() {
    this.handle.close()
  }
}

// Pruefen, ob IndexedDB im aktuellen Kontext verfuegbar ist.
function idbVerfuegbar() {
  return typeof indexedDB !== "undefined" && indexedDB !== null
}

// IndexedDB-Datenbank oeffnen (Promise). Legt den Object Store bei Bedarf an.
function idbOeffnen() {
  return new Promise((aufloesen, ablehnen) => {
    const anfrage = indexedDB.open(IDB_NAME, 1)
    anfrage.onupgradeneeded = () => {
      const idb = anfrage.result
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE)
      }
    }
    anfrage.onsuccess = () => aufloesen(anfrage.result)
    anfrage.onerror = () => ablehnen(anfrage.error)
  })
}

// Gesicherte Datenbank-Bytes aus IndexedDB lesen; null, wenn keine vorhanden.
async function idbLesen() {
  if (!idbVerfuegbar()) return null
  let idb
  try {
    idb = await idbOeffnen()
  } catch {
    return null
  }
  try {
    return await new Promise((aufloesen, ablehnen) => {
      const tx = idb.transaction(IDB_STORE, "readonly")
      const anfrage = tx.objectStore(IDB_STORE).get(IDB_KEY)
      anfrage.onsuccess = () => {
        const wert = anfrage.result
        aufloesen(wert ? new Uint8Array(wert) : null)
      }
      anfrage.onerror = () => ablehnen(anfrage.error)
    })
  } finally {
    idb.close()
  }
}

// Datenbank-Bytes nach IndexedDB schreiben (unter einem festen Schluessel).
async function idbSchreiben(bytes) {
  if (!idbVerfuegbar()) return
  const idb = await idbOeffnen()
  try {
    await new Promise((aufloesen, ablehnen) => {
      const tx = idb.transaction(IDB_STORE, "readwrite")
      // Eine Kopie der Bytes ablegen — der zugrunde liegende WASM-Speicher
      // kann nach dem Export wiederverwendet werden.
      tx.objectStore(IDB_STORE).put(bytes.slice(), IDB_KEY)
      tx.oncomplete = () => aufloesen()
      tx.onerror = () => ablehnen(tx.error)
      tx.onabort = () => ablehnen(tx.error)
    })
  } finally {
    idb.close()
  }
}

// Den gesamten gesicherten Stand aus IndexedDB entfernen. Nach einem Reload
// oeffnet oeffneDb damit eine leere Datenbank. Ohne IndexedDB folgenlos.
export async function persistenzLeeren() {
  if (!idbVerfuegbar()) return
  const idb = await idbOeffnen()
  try {
    await new Promise((aufloesen, ablehnen) => {
      const tx = idb.transaction(IDB_STORE, "readwrite")
      tx.objectStore(IDB_STORE).delete(IDB_KEY)
      tx.oncomplete = () => aufloesen()
      tx.onerror = () => ablehnen(tx.error)
      tx.onabort = () => ablehnen(tx.error)
    })
  } finally {
    idb.close()
  }
}

// Eine In-Memory-DB aus einem Byte-Array wiederherstellen.
function deserialisieren(sqlite3, bytes) {
  const handle = new sqlite3.oo1.DB(`/${DB_NAME}`, "c")
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
  return handle
}

// Datenbank oeffnen. Erzeugt eine In-Memory-SQLite-DB; liegt in IndexedDB
// ein zuvor gesicherter Stand, wird er per sqlite3_deserialize geladen.
// `persistent` ist true, sobald IndexedDB verfuegbar ist — dann sichert
// `sichern()` den Stand fuer den naechsten Besuch.
export async function oeffneDb(initModul) {
  const sqlite3 = await ladeSqlite(initModul)
  const persistent = idbVerfuegbar()

  let bytes = null
  try {
    bytes = await idbLesen()
  } catch (e) {
    console.warn("Gesicherte Datenbank konnte nicht gelesen werden:", e)
  }

  const handle = bytes
    ? deserialisieren(sqlite3, bytes)
    : new sqlite3.oo1.DB(`/${DB_NAME}`, "c")
  return new Datenbank(sqlite3, handle, persistent)
}

// Eine zuvor exportierte Datenbank (Byte-Array) als In-Memory-DB oeffnen.
export async function importBytes(initModul, bytes) {
  const sqlite3 = await ladeSqlite(initModul)
  return new Datenbank(sqlite3, deserialisieren(sqlite3, bytes), false)
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
