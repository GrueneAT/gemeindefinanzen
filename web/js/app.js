// Browser-App — Upload-Oberflaeche und Dokumentverwaltung.
//
// Drag & Drop bzw. Dateiauswahl, Mehrfach-Upload, Fortschritt je PDF,
// persistente Dokumentliste. Extraktion, Parsing, Validierung und
// Datenhaltung laufen vollstaendig clientseitig.

import * as mupdf from "../vendor/mupdf/mupdf.js"
import sqlite3InitModule from "../vendor/sqlite-wasm/sqlite3.mjs"
import { oeffneDb, dokumente, dokumentEntfernen } from "./db.js"
import { verarbeitePdf } from "./pipeline.js"

const STUFEN = {
  extraktion: "Text wird extrahiert",
  parsing: "Detailnachweis wird geparst",
  validierung: "Plausibilitaet wird geprueft",
  speichern: "Daten werden gespeichert",
  fertig: "fertig",
}
const STUFEN_FORTSCHRITT = {
  extraktion: 30,
  parsing: 65,
  validierung: 80,
  speichern: 95,
  fertig: 100,
}

let db = null

// Schema laden und Datenbank oeffnen.
async function init() {
  // schema.sql liegt als Kopie in web/ (von 'make web' aus der Python-Quelle
  // synchronisiert) — so ist die Browser-App ohne das Repo-Wurzelverzeichnis
  // deploybar.
  const schema = await fetch("./schema.sql").then((r) => r.text())
  db = await oeffneDb(sqlite3InitModule)
  db.schemaAnwenden(schema)

  const note = document.getElementById("persist-note")
  note.textContent = db.persistent
    ? "Daten werden lokal im Browser gespeichert (OPFS) — beim naechsten " +
      "Besuch ist der Stand wieder da."
    : "Hinweis: persistente Speicherung (OPFS) ist in diesem Browser nicht " +
      "verfuegbar — die Daten gelten nur fuer diese Sitzung."

  verdrahteUpload()
  zeichneDokumentliste()
}

// --- Dokumentliste -------------------------------------------------------- //
function zeichneDokumentliste() {
  const tbody = document.getElementById("doc-tbody")
  const leer = document.getElementById("doc-empty")
  const rows = dokumente(db)
  tbody.innerHTML = ""
  leer.hidden = rows.length > 0

  for (const d of rows) {
    const tr = document.createElement("tr")
    const status = leseStatus(d.dokument_id)
    tr.innerHTML = `
      <td>${escapeHtml(d.typ)} ${d.finanzjahr ?? ""}</td>
      <td>${escapeHtml(d.quelldatei)}</td>
      <td class="num">${d.detailposten.toLocaleString("de-DE")}</td>
      <td>${statusBadge(status)}</td>
      <td><button class="doc-remove" data-id="${d.dokument_id}">
        entfernen</button></td>`
    tbody.appendChild(tr)
  }
  for (const btn of tbody.querySelectorAll(".doc-remove")) {
    btn.addEventListener("click", () => {
      dokumentEntfernen(db, Number(btn.dataset.id))
      zeichneDokumentliste()
    })
  }
  aktualisiereDashboardLink(rows.length)
}

// Pruefstatus eines Dokuments aus der DB rekonstruieren (SU-21/22/33/34).
function leseStatus(dokId) {
  const checks = [
    ["SU 21", "einnahme", "operativ", "eh_wert"],
    ["SU 22", "ausgabe", "operativ", "eh_wert"],
    ["SU 33", "einnahme", "investiv", "fh_wert"],
    ["SU 34", "ausgabe", "investiv", "fh_wert"],
  ]
  let ok = 0
  const gesamt = checks.length + 1
  for (const [su, richtung, gebarung, spalte] of checks) {
    const detail = db.abfrage(
      `SELECT ansatz, ROUND(SUM(COALESCE(${spalte},0)),2) AS s
       FROM posten WHERE dokument_id=? AND zeilentyp='detail'
         AND richtung=? AND gebarung=? GROUP BY ansatz`,
      [dokId, richtung, gebarung],
    )
    const summen = {}
    for (const r of db.abfrage(
      `SELECT ansatz, ROUND(SUM(COALESCE(${spalte},0)),2) AS s
       FROM posten WHERE dokument_id=? AND zeilentyp='summe'
         AND vrk LIKE ? GROUP BY ansatz`,
      [dokId, su + "%"],
    )) {
      summen[r.ansatz] = r.s || 0
    }
    let abw = false
    for (const r of detail) {
      if (Math.abs((r.s || 0) - (summen[r.ansatz] || 0)) > 0.05) abw = true
    }
    if (!abw) ok++
  }
  const verwaist = db.wert(
    "SELECT COUNT(*) FROM posten WHERE dokument_id=? AND zeilentyp='detail'" +
      " AND (ansatz IS NULL OR ansatz='')",
    [dokId],
  )
  if (verwaist === 0) ok++
  return { ok, gesamt, bestanden: ok === gesamt }
}

function statusBadge(status) {
  const cls = status.bestanden ? "ok" : "fehl"
  const text = `${status.ok}/${status.gesamt} Pruefungen`
  return `<span class="doc-status ${cls}">${text}</span>`
}

// --- Upload --------------------------------------------------------------- //
function verdrahteUpload() {
  const zone = document.getElementById("dropzone")
  const input = document.getElementById("file-input")
  const btn = document.getElementById("pick-btn")

  btn.addEventListener("click", () => input.click())
  input.addEventListener("change", () => {
    verarbeiteDateien([...input.files])
    input.value = ""
  })

  for (const ev of ["dragenter", "dragover"]) {
    zone.addEventListener(ev, (e) => {
      e.preventDefault()
      zone.classList.add("is-over")
    })
  }
  for (const ev of ["dragleave", "drop"]) {
    zone.addEventListener(ev, (e) => {
      e.preventDefault()
      if (ev === "dragleave" && zone.contains(e.relatedTarget)) return
      zone.classList.remove("is-over")
    })
  }
  zone.addEventListener("drop", (e) => {
    const dateien = [...(e.dataTransfer?.files || [])]
    verarbeiteDateien(dateien)
  })
}

async function verarbeiteDateien(dateien) {
  const pdfs = dateien.filter(
    (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name),
  )
  const verworfen = dateien.length - pdfs.length
  if (verworfen > 0) {
    toast(`${verworfen} Datei(en) uebersprungen — nur PDF wird verarbeitet.`,
      "fehl")
  }
  for (const datei of pdfs) {
    await verarbeiteEine(datei)
  }
  zeichneDokumentliste()
}

async function verarbeiteEine(datei) {
  const item = neuerFortschritt(datei.name)
  try {
    const bytes = new Uint8Array(await datei.arrayBuffer())
    // dem Browser eine Zeichengelegenheit geben, bevor die CPU-Arbeit beginnt
    await naechsterFrame()
    const res = await verarbeitePdf(
      mupdf,
      db,
      datei.name,
      bytes,
      (s) => setzeStufe(item, s),
    )
    abschliessen(item, res.status)
  } catch (e) {
    fehler(item, e.message || String(e))
  }
}

function naechsterFrame() {
  return new Promise((aufloesen) => requestAnimationFrame(() => aufloesen()))
}

// --- Fortschrittsanzeige -------------------------------------------------- //
function neuerFortschritt(name) {
  const liste = document.getElementById("progress-list")
  const li = document.createElement("li")
  li.className = "progress-item"
  li.innerHTML = `
    <div class="progress-head">
      <span class="progress-name">${escapeHtml(name)}</span>
      <span class="progress-stage">wird geladen</span>
    </div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <p class="progress-error" hidden></p>`
  liste.appendChild(li)
  return li
}

function setzeStufe(item, stufe) {
  item.querySelector(".progress-stage").textContent =
    STUFEN[stufe] || stufe
  item.querySelector(".progress-fill").style.width =
    (STUFEN_FORTSCHRITT[stufe] || 0) + "%"
}

function abschliessen(item, status) {
  item.classList.add("is-done")
  item.querySelector(".progress-fill").style.width = "100%"
  item.querySelector(".progress-stage").textContent = status.bestanden
    ? `geprueft — ${status.ok}/${status.gesamt} bestanden`
    : `geladen — Pruefung ${status.ok}/${status.gesamt}`
}

function fehler(item, nachricht) {
  item.classList.add("is-error")
  item.querySelector(".progress-stage").textContent = "Fehler"
  item.querySelector(".progress-fill").style.width = "100%"
  const p = item.querySelector(".progress-error")
  p.textContent = nachricht
  p.hidden = false
}

// --- Hilfen --------------------------------------------------------------- //
function aktualisiereDashboardLink(anzahl) {
  const link = document.getElementById("dashboard-link")
  if (link) link.hidden = anzahl === 0
}

function toast(text, art) {
  const box = document.getElementById("toast-box")
  const div = document.createElement("div")
  div.className = `toast ${art}`
  div.textContent = text
  box.appendChild(div)
  setTimeout(() => div.remove(), 6000)
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  )
}

init().catch((e) => {
  document.getElementById("toast-box").innerHTML =
    `<div class="toast fehl">Initialisierung fehlgeschlagen: ${escapeHtml(
      e.message || String(e),
    )}</div>`
})
