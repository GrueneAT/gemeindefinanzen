// Dashboard-Aufbau.
//
// baueDashboard(db) baut ueber dashboard-data.js/dashboard-charts.js dieselben
// DATA-/CFG-Objekte wie die Python-Pipeline, ergaenzt die dokumentabhaengigen
// Bedienelemente (Dokument-Umschalter, Filter-Auswahl) und laedt dann die
// unveraenderte Dashboard-Logik aus web/js/dashboard.js.
//
// Die Datenbank wird hereingereicht — dieses Modul oeffnet selbst keine DB.
// app.js oeffnet die DB einmal und ruft baueDashboard mit derselben Instanz
// auf, sodass Upload-Oberflaeche und Dashboard auf einer Seite dieselben
// Daten teilen.

import { collect, istPflichtumlage } from "./dashboard-data.js"
import { alleCharts } from "./dashboard-charts.js"
import { buildSankeyOption } from "./sankey-drill.js"

// Das Dashboard fuer eine bereits geoeffnete Datenbank aufbauen. Liefert
// true, wenn Dokumente vorhanden sind und das Dashboard sichtbar gemacht
// wurde; false, wenn keine Dokumente geladen sind.
export function baueDashboard(db) {
  const daten = collect(db)
  const inhalt = document.getElementById("dashboard-inhalt")

  if (daten.meta.dok_anzahl === 0) {
    inhalt.hidden = true
    return false
  }

  const cfg = alleCharts(daten)
  fuelleKopf(daten)
  baueSwitcher(daten)
  fuelleFilter(daten)
  inhalt.hidden = false

  // DATA und CFG global bereitstellen — dashboard.js liest diese Namen.
  window.DATA = daten
  window.CFG = cfg
  // Sankey-Drill-down-Builder global bereitstellen — dashboard.js ist ein
  // klassisches Skript und kann nicht importieren.
  window.buildSankeyOption = buildSankeyOption
  // R9 — Pflichtumlagen-Heuristik einmalig zentralisiert (statt inline
  // duplizierter Regex in dashboard.js).
  window.istPflichtumlage = istPflichtumlage
  ladeDashboardLogik()
  return true
}

function fuelleKopf(daten) {
  const m = daten.meta
  document.title = `Gemeindefinanzen — ${m.gemeinde}`
}

// Dokument-Umschalter — entspricht _switcher() aus html.py.
function baueSwitcher(daten) {
  const ziel = document.getElementById("switcher-buttons")
  ziel.innerHTML = ""
  for (const d of daten.dokumente) {
    const btn = document.createElement("button")
    // Doppel-Klasse: Funktionsklasse switch-btn fuer dashboard.js-Vendor,
    // gat-switch-btn fuer die DS-v2-Optik.
    btn.className = "switch-btn gat-switch-btn"
    btn.dataset.dok = String(d.id)
    btn.textContent = d.label
    ziel.appendChild(btn)
  }
}

// Dokument- und Aufgabengruppen-Auswahl im Suche-Tab fuellen.
function fuelleFilter(daten) {
  const dokSel = document.getElementById("f-dok")
  // Vorhandene Optionen ausser "alle" entfernen — baueDashboard kann nach
  // einem Upload erneut laufen.
  while (dokSel.options.length > 1) dokSel.remove(1)
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
  while (grpSel.options.length > 1) grpSel.remove(1)
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
  s.src = "./js/dashboard.js"
  document.body.appendChild(s)
}
