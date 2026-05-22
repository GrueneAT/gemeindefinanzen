// Dashboard-Bootstrap.
//
// Oeffnet die Browser-Datenbank, baut ueber dashboard-data.js/dashboard-
// charts.js dieselben DATA-/CFG-Objekte wie die Python-Pipeline, ergaenzt die
// dokumentabhaengigen Bedienelemente (Dokument-Umschalter, Filter-Auswahl)
// und laedt dann die unveraenderte Dashboard-Logik aus
// web/vendor/dashboard/dashboard.js.

import sqlite3InitModule from "../vendor/sqlite-wasm/sqlite3.mjs"
import { oeffneDb } from "./db.js"
import { collect } from "./dashboard-data.js"
import { alleCharts } from "./dashboard-charts.js"

async function start() {
  const schema = await fetch("./schema.sql").then((r) => r.text())
  const db = await oeffneDb(sqlite3InitModule)
  db.schemaAnwenden(schema)

  const daten = collect(db)
  const leer = document.getElementById("dashboard-leer")
  const inhalt = document.getElementById("dashboard-inhalt")

  if (daten.meta.dok_anzahl === 0) {
    leer.hidden = false
    return
  }

  const cfg = alleCharts(daten)
  fuelleKopf(daten)
  baueSwitcher(daten)
  fuelleFilter(daten)
  inhalt.hidden = false

  // DATA und CFG global bereitstellen — dashboard.js (unveraendert aus dem
  // Python-Report) liest diese beiden Namen.
  window.DATA = daten
  window.CFG = cfg
  ladeDashboardLogik()
}

function fuelleKopf(daten) {
  const m = daten.meta
  document.getElementById("kopf-note").textContent =
    `${m.posten_anzahl.toLocaleString("de-DE")} Haushaltsstellen aus ` +
    `${m.dok_anzahl} Dokument(en) — clientseitig erfasst und geprueft.`
  document.getElementById("kopf-sub").textContent =
    `${m.gemeinde} — Voranschlaege und Rechnungsabschluesse interaktiv. ` +
    "Tabs fuer die Themen, ein Umschalter fuer das Dokument, Volltextsuche " +
    "ueber alle Posten."
  document.getElementById("fuss-quelle").textContent =
    `Quelle: ${m.dok_anzahl} Dokument(e), ${m.gemeinde}`
  document.title = `Finanz-Dashboard — ${m.gemeinde}`
}

// Dokument-Umschalter — entspricht _switcher() aus html.py.
function baueSwitcher(daten) {
  const ziel = document.getElementById("switcher-buttons")
  ziel.innerHTML = ""
  for (const d of daten.dokumente) {
    const btn = document.createElement("button")
    btn.className = "switch-btn"
    btn.dataset.dok = String(d.id)
    btn.textContent = d.label
    ziel.appendChild(btn)
  }
}

// Dokument- und Aufgabengruppen-Auswahl im Suche-Tab fuellen.
function fuelleFilter(daten) {
  const dokSel = document.getElementById("f-dok")
  for (const d of daten.dokumente) {
    dokSel.appendChild(neueOption(String(d.id), d.label))
  }
  // Aufgabengruppen aus dem Default-Dokument (Gruppen 0-9 sind
  // dokumentuebergreifend gleich).
  const defaultAgg = daten.aggregate[String(daten.meta.default_dok)] || {}
  const gruppen = [...defaultAgg.gruppen]
    .filter((g) => g[0])
    .sort((a, b) => a[0].localeCompare(b[0]))
  const grpSel = document.getElementById("f-gruppe")
  for (const [code, text] of gruppen) {
    grpSel.appendChild(neueOption(code, `${code} — ${text}`))
  }
}

function neueOption(value, text) {
  const opt = document.createElement("option")
  opt.value = value
  opt.textContent = text
  return opt
}

// dashboard.js ist klassisches Skript (keine ESM-Datei) und liest DATA/CFG
// als globale Namen — daher als <script> nachladen, nicht importieren.
function ladeDashboardLogik() {
  const s = document.createElement("script")
  s.src = "./vendor/dashboard/dashboard.js"
  document.body.appendChild(s)
}

start().catch((e) => {
  document.getElementById("dashboard-leer").hidden = false
  document.getElementById("dashboard-leer").innerHTML =
    `<p>Dashboard konnte nicht geladen werden: ${
      (e && e.message) || String(e)
    }</p>`
})
