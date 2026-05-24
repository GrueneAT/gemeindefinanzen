// Browser-App — einseitige App: Dokumentverwaltung und Dashboard.
//
// Drag & Drop bzw. Dateiauswahl, Mehrfach-Upload, Fortschritt je PDF,
// persistente Dokumentliste. Extraktion, Parsing, Validierung und
// Datenhaltung laufen vollstaendig clientseitig. Unterhalb der
// Dokumentverwaltung baut diese Seite das Finanz-Dashboard direkt auf
// derselben geoeffneten Datenbank auf — kein Seitenwechsel noetig.

import * as mupdf from "../vendor/mupdf/mupdf.js"
import sqlite3InitModule from "../vendor/sqlite-wasm/sqlite3.mjs"
import {
  oeffneDb, dokumente, dokumentEntfernen, persistenzLeeren,
  migrationenAnwenden,
} from "./db.js"
import { verarbeitePdf } from "./pipeline.js"
import { baueDashboard } from "./dashboard-app.js"

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
  // Migrationen, die `CREATE IF NOT EXISTS` nicht abdeckt (z. B. ALTER TABLE
  // bei einer bereits gefuellten IndexedDB-DB): siehe migrationenAnwenden().
  migrationenAnwenden(db)

  const note = document.getElementById("persist-note")
  note.textContent = db.persistent
    ? "Daten werden lokal im Browser gespeichert (IndexedDB) — beim " +
      "naechsten Besuch ist der Stand wieder da."
    : "Hinweis: dauerhafte Speicherung ist hier nicht aktiv — die Daten " +
      "gelten nur fuer diese Sitzung. Die Analyse funktioniert dennoch " +
      "uneingeschraenkt."

  verdrahteUpload()
  verdrahteOverlayFokus()
  zeichneDokumentliste()
  zeichneDashboard()
  verdrahteVollbild()
  verdrahteModal()
  verdrahteHcToggle()
  window.__appBereit = true
  zeigeBuildStempel()
}

// --- A11y: .gat-mode-hc-Toggle ------------------------------------------- //
// Knopf in der Brandbar schaltet den Hochkontrast-Modus ein/aus. Der DS
// definiert die Variant (body.gat-mode-hc), die App pflegt nur den
// Toggle-Knopf und persistiert den Zustand in localStorage. Ein
// Inline-Skript im <head> setzt die Klasse VOR dem ersten Paint (FOWT-
// Prevention) auf <html>; dieser Toggle spiegelt die Klasse zusaetzlich
// auf <body>, damit die DS-Selektoren (body.gat-mode-hc ...) greifen.
function verdrahteHcToggle() {
  const btn = document.getElementById("hc-toggle")
  if (!btn) return
  const set = (an) => {
    document.body.classList.toggle("gat-mode-hc", an)
    document.documentElement.classList.toggle("gat-mode-hc", an)
    btn.setAttribute("aria-pressed", an ? "true" : "false")
    btn.setAttribute(
      "aria-label",
      an ? "Hohen Kontrast ausschalten" : "Hohen Kontrast einschalten",
    )
    try {
      localStorage.setItem("gat-mode-hc", an ? "1" : "")
    } catch (e) { /* gesperrt (Privatmodus) — egal */ }
  }
  let aktiv = false
  try { aktiv = localStorage.getItem("gat-mode-hc") === "1" } catch (e) {}
  set(aktiv)
  btn.addEventListener("click", () =>
    set(!document.body.classList.contains("gat-mode-hc")))
}

// --- Mehrjahres-Overlay: Fokusverwaltung --------------------------------- //
// Das Overlay traegt role="dialog"/aria-modal; Schliessen per Esc und
// Klick auf den Hintergrund regelt dashboard.js. Was dort fehlt, ist die
// Tastatur-Fokusfuehrung: Fokus beim Oeffnen in den Dialog setzen, Tab im
// Dialog fangen (Fokusfalle) und beim Schliessen auf das ausloesende
// Element zuruecksetzen. Das wird hier ergaenzt, ohne dashboard.js
// anzufassen — beobachtet wird allein die is-open-Klasse des Overlays.
function verdrahteOverlayFokus() {
  const overlay = document.getElementById("mj-overlay")
  if (!overlay || !("MutationObserver" in window)) return
  let zuletztFokussiert = null

  const fokussierbar = () =>
    [...overlay.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )].filter((el) => !el.disabled && el.offsetParent !== null)

  // Tab innerhalb des Dialogs halten, solange er offen ist.
  overlay.addEventListener("keydown", (ev) => {
    if (ev.key !== "Tab") return
    const ziele = fokussierbar()
    if (ziele.length === 0) return
    const erstes = ziele[0]
    const letztes = ziele[ziele.length - 1]
    if (ev.shiftKey && document.activeElement === erstes) {
      ev.preventDefault()
      letztes.focus()
    } else if (!ev.shiftKey && document.activeElement === letztes) {
      ev.preventDefault()
      erstes.focus()
    }
  })

  const beobachter = new MutationObserver(() => {
    const offen = overlay.classList.contains("is-open")
    if (offen && document.activeElement !== overlay
        && !overlay.contains(document.activeElement)) {
      // Frisch geoeffnet — Ausloeser merken, Fokus in den Dialog setzen.
      zuletztFokussiert = document.activeElement
      const schliessen = document.getElementById("mj-close")
      const ziel = schliessen || fokussierbar()[0]
      if (ziel) ziel.focus()
    } else if (!offen && zuletztFokussiert) {
      // Geschlossen — Fokus auf das ausloesende Element zuruecksetzen.
      if (typeof zuletztFokussiert.focus === "function") {
        zuletztFokussiert.focus()
      }
      zuletztFokussiert = null
    }
  })
  beobachter.observe(overlay, {
    attributes: true,
    attributeFilter: ["class"],
  })
}

// --- Diagramm-Panels: Aktionsleiste im Kopf ------------------------------ //
// Im Kopf jedes Diagramm-Panels sitzt rechts vom Titel eine Aktionsleiste
// (`.app-panel-actions`), in die `verdrahteVollbild` und `verdrahteModal`
// jeweils ihre Knoepfe einhaengen. Sie wird genau einmal je Panel angelegt
// — Tabellen-Panels (ohne `.dash-chart`) bleiben aussen vor.
function holeDiagrammPanels() {
  return document.querySelectorAll(".gat-panel:has(.dash-chart)")
}

function holeOderBaueAktionsleiste(panel) {
  const kopf = panel.querySelector(".gat-panel__head")
  const titel = kopf && kopf.querySelector("h3")
  if (!kopf || !titel) return null
  // Vorhandene Reihe (aus einem frueheren Verdrahtungsdurchlauf) wiederfinden.
  let reihe = kopf.querySelector(":scope > .gat-panel__head-row")
  let actions = reihe && reihe.querySelector(":scope > .app-panel-actions")
  if (reihe && actions) return actions
  if (!reihe) {
    reihe = document.createElement("div")
    reihe.className = "gat-panel__head-row"
    kopf.insertBefore(reihe, titel)
    reihe.appendChild(titel)
  }
  if (!actions) {
    actions = document.createElement("div")
    actions.className = "app-panel-actions"
    reihe.appendChild(actions)
  }
  return actions
}

// --- Vollbild je Diagramm-Panel (Native Fullscreen-API) ------------------ //
// Ein ruhiger "Vergroessern"-Knopf rechts im Panel-Kopf; ein Klick legt das
// Panel ueber die native Fullscreen-API auf den ganzen Schirm. Esc oder ein
// erneuter Klick fuehren zurueck. Im Vollbild ist der .dash-chart-Div nicht
// mehr an seine feste Inline-Hoehe gebunden (CSS .gat-panel:fullscreen);
// damit ECharts die neue Flaeche fuellt, wird auf fullscreenchange ein
// window-resize-Event ausgeloest — dashboard.js hoert darauf
// (resizeVisibleCharts) und passt alle sichtbaren Diagramme an. dashboard.js
// bleibt unangetastet.
//
// Wo die Native-Fullscreen-API nicht verfuegbar ist (vor allem auf iPhone
// Safari, `document.fullscreenEnabled === false`), wird hier gar kein Knopf
// eingehaengt — die Modal-Variante (`verdrahteModal`) deckt dort ab.
function verdrahteVollbild() {
  if (!document.fullscreenEnabled) return

  for (const panel of holeDiagrammPanels()) {
    const actions = holeOderBaueAktionsleiste(panel)
    if (!actions) continue

    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "app-panel-fs-btn"
    btn.textContent = "Vergroessern"
    setzeVollbildLabel(btn, false)
    btn.addEventListener("click", () => {
      if (document.fullscreenElement === panel) {
        document.exitFullscreen()
      } else {
        // Etwaiges anderes Vollbild-Panel wird vom Browser automatisch
        // ersetzt, wenn requestFullscreen auf einem neuen Element laeuft.
        panel.requestFullscreen().catch(() => {})
      }
    })
    actions.appendChild(btn)
  }

  // Vollbildwechsel: Knopf-Label/aria umstellen und ECharts neu vermessen.
  document.addEventListener("fullscreenchange", () => {
    const aktiv = document.fullscreenElement
    for (const btn of document.querySelectorAll(".app-panel-fs-btn")) {
      const panel = btn.closest(".gat-panel")
      setzeVollbildLabel(btn, panel != null && panel === aktiv)
    }
    // ECharts kennt die neue Flaeche erst nach dem Layout — ein
    // window-resize loest das in dashboard.js bereits gebuendelte
    // resizeVisibleCharts aus. Ein zusaetzlicher verzoegerter Stoss faengt
    // Browser ab, die die Vollbild-Geometrie erst spaet melden.
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"))
    })
    setTimeout(() => window.dispatchEvent(new Event("resize")), 120)
  })
}

// Knopfbeschriftung und Hilfstext je nach Vollbildzustand setzen.
function setzeVollbildLabel(btn, imVollbild) {
  btn.textContent = imVollbild ? "Verkleinern" : "Vergroessern"
  btn.setAttribute(
    "aria-label",
    imVollbild
      ? "Diagramm wieder verkleinern"
      : "Diagramm auf Vollbild vergroessern",
  )
}

// --- Modal-Vollbild je Diagramm-Panel ------------------------------------ //
// Diagramm-Vollbild ueber ein `<dialog class="gat-modal">` — funktioniert
// auch auf iPhone Safari (wo `document.fullscreenEnabled === false` ist und
// die Native-Variante deshalb gar nicht erst eingehaengt wird). Auf Desktop
// und iPad sitzt der Knopf neben dem Native-Fullscreen-Knopf — beide
// Varianten parallel verfuegbar, User entscheidet pro Klick.
//
// Strategie: der eigentliche `.dash-chart`-Knoten wird beim Oeffnen aus dem
// Panel-Body in den Modal-Body verschoben (`appendChild`) und beim
// Schliessen an seinen Ursprungsort zurueckgesetzt. Damit bleiben
// ECharts-Instanz, Tooltips, Sankey-Drill-down und Treemap-Drill-Handler
// vollstaendig erhalten — dashboard.js sieht nur eine Reihe
// resize()-Events. Ein `data-app-modal-host`-Marker auf einem Platzhalter
// merkt sich den Ursprungsort, damit das Zuruecksetzen unabhaengig vom
// urspruenglichen Panel-Layout funktioniert.
let aktivesModalChart = null

function verdrahteModal() {
  const dialog = document.getElementById("chart-modal")
  if (!dialog) return
  // Browser ohne HTML5-`<dialog>`-Unterstuetzung haben kein showModal().
  // Dann bleibt nur die Native-Fullscreen-Variante (sofern verfuegbar)
  // — ohne Modal-Knopf eingehaengt.
  if (typeof dialog.showModal !== "function") return

  const titel = document.getElementById("chart-modal-titel")
  const close = document.getElementById("chart-modal-close")

  // Knoepfe je Panel einhaengen.
  for (const panel of holeDiagrammPanels()) {
    const actions = holeOderBaueAktionsleiste(panel)
    if (!actions) continue
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "app-panel-act-btn app-panel-modal-btn"
    btn.textContent = "Im Vollbild oeffnen"
    btn.setAttribute("aria-label", "Diagramm im Modal-Vollbild oeffnen")
    btn.addEventListener("click", () => oeffneChartModal(panel))
    actions.appendChild(btn)
  }

  // Schliessen-Knopf, Backdrop-Klick und das Standard-Esc-Verhalten des
  // <dialog>-Elements werden zusammen ueber den `close`-Event abgewickelt.
  close.addEventListener("click", () => dialog.close())
  // Backdrop-Klick: klick liegt ausserhalb des Dialog-Rechtecks.
  dialog.addEventListener("click", (ev) => {
    if (ev.target !== dialog) return
    const r = dialog.getBoundingClientRect()
    if (ev.clientX < r.left || ev.clientX > r.right ||
        ev.clientY < r.top || ev.clientY > r.bottom) {
      dialog.close()
    }
  })
  // Auf jeden Schliess-Vorgang reagieren (Esc, Knopf, Backdrop, .close()).
  dialog.addEventListener("close", () => schliesseChartModal())
}

function oeffneChartModal(panel) {
  const dialog = document.getElementById("chart-modal")
  const body = document.getElementById("chart-modal-body")
  const titelEl = document.getElementById("chart-modal-titel")
  const chart = panel.querySelector(".dash-chart")
  if (!dialog || !body || !chart) return

  // Eventuell ein anderes Diagramm noch offen — sauber zurueckraeumen,
  // bevor das neue eingehaengt wird.
  if (aktivesModalChart) schliesseChartModal()

  // Titel aus dem Panel uebernehmen (h3) — der Modal-Header zeigt
  // dieselbe Beschriftung wie das Panel.
  const titelQuelle = panel.querySelector(".gat-panel__head h3")
  if (titelEl && titelQuelle) {
    titelEl.textContent = titelQuelle.textContent || "Diagramm"
  }

  // Platzhalter merkt sich den Ursprungsort des Chart-Knotens.
  const platzhalter = document.createElement("div")
  platzhalter.setAttribute("data-app-modal-host", "1")
  platzhalter.hidden = true
  chart.parentNode.insertBefore(platzhalter, chart)
  body.innerHTML = ""
  body.appendChild(chart)
  // Inline-Hoehe waehrend des Modal-Aufenthalts loesen, damit der Container
  // die Flex-Hoehe annehmen kann. Wert wird beim Schliessen wiederhergestellt.
  const inlineHoehe = chart.style.height
  chart.style.height = ""
  aktivesModalChart = { chart, platzhalter, inlineHoehe, panel }

  dialog.showModal()
  // ECharts neu vermessen, sobald der Dialog Geometrie hat.
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"))
  })
  setTimeout(() => window.dispatchEvent(new Event("resize")), 120)
}

function schliesseChartModal() {
  if (!aktivesModalChart) return
  const { chart, platzhalter, inlineHoehe } = aktivesModalChart
  aktivesModalChart = null
  // Inline-Hoehe wiederherstellen, dann den Chart-Knoten zurueck an seinen
  // Ursprungsort verschieben.
  chart.style.height = inlineHoehe || ""
  if (platzhalter && platzhalter.parentNode) {
    platzhalter.parentNode.insertBefore(chart, platzhalter)
    platzhalter.remove()
  }
  // ECharts neu vermessen — der Container hat jetzt wieder seine Panel-Hoehe.
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"))
  })
  setTimeout(() => window.dispatchEvent(new Event("resize")), 120)
}

// Build-Commit aus version.json in die Fusszeile schreiben. Fehlt die Datei
// oder schlaegt der Fetch fehl, faellt der Text sauber auf "Build dev" zurueck.
function zeigeBuildStempel() {
  fetch("./version.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((v) => {
      const el = document.getElementById("build-stamp")
      if (!el) return
      el.textContent = v && v.shortCommit
        ? "Build " + v.shortCommit
        : "Build dev"
    })
    .catch(() => {})
}

// Dashboard aufbauen, wenn Dokumente vorhanden sind; sonst Empty-State.
function zeichneDashboard() {
  const leer = document.getElementById("dashboard-leer")
  const hatDokumente = dokumente(db).length > 0
  if (hatDokumente) {
    leer.hidden = true
    baueDashboard(db)
  } else {
    leer.hidden = false
    document.getElementById("dashboard-inhalt").hidden = true
  }
}

// --- Dokumentliste -------------------------------------------------------- //
function zeichneDokumentliste() {
  const tbody = document.getElementById("doc-tbody")
  const leer = document.getElementById("doc-empty")
  const rows = dokumente(db)
  tbody.innerHTML = ""
  leer.hidden = rows.length > 0
  aktualisiereDokVerwaltung(rows.length)
  const clearBtn = document.getElementById("doc-clear-all")
  if (clearBtn) clearBtn.hidden = rows.length === 0

  for (const d of rows) {
    const tr = document.createElement("tr")
    const status = leseStatus(d.dokument_id)
    const einwohnerWert = d.einwohner == null ? "" : String(d.einwohner)
    const dokLabel = `${escapeHtml(d.typ)} ${d.finanzjahr ?? ""}`
    tr.innerHTML = `
      <td>${dokLabel}</td>
      <td>${escapeHtml(d.quelldatei)}</td>
      <td class="num">${d.detailposten.toLocaleString("de-DE")}</td>
      <td><input type="number" class="doc-einwohner-input"
            data-id="${d.dokument_id}" value="${escapeHtml(einwohnerWert)}"
            min="0" step="1"
            aria-label="Einwohnerzahl (Variante A — Inline)"></td>
      <td>${statusBadge(status)}</td>
      <td>
        <button class="doc-edit-btn" data-id="${d.dokument_id}"
          data-doklabel="${dokLabel}"
          data-einwohner="${escapeHtml(einwohnerWert)}"
          aria-label="Einwohnerzahl bearbeiten (Variante B — Dialog)">
          bearbeiten</button>
        <button class="doc-remove" data-id="${d.dokument_id}">
          entfernen</button>
      </td>`
    tbody.appendChild(tr)
  }
  for (const btn of tbody.querySelectorAll(".doc-remove")) {
    btn.addEventListener("click", async () => {
      btn.disabled = true
      dokumentEntfernen(db, Number(btn.dataset.id))
      // Stand sichern, dann die Seite frisch aufbauen. Die Daten liegen
      // sicher in IndexedDB — ein Reload ist der robusteste Weg, das
      // Dashboard sauber neu zu rendern (dashboard.js laeuft nur einmal).
      await db.sichern()
      location.reload()
    })
  }
  // Variante A (Inline-Eingabe): change schreibt den Wert direkt und
  // re-rendert das Dashboard, damit Pro-Kopf-Zeilen sofort erscheinen.
  for (const input of tbody.querySelectorAll(".doc-einwohner-input")) {
    input.addEventListener("change", async () => {
      await speichereEinwohner(Number(input.dataset.id), input.value)
      // Den daneben sitzenden Edit-Knopf auch aktualisieren, damit beim
      // spaeteren Oeffnen des Dialogs der jetzt gesetzte Wert vorbelegt ist.
      const editBtn = tbody.querySelector(
        `.doc-edit-btn[data-id="${input.dataset.id}"]`,
      )
      if (editBtn) editBtn.dataset.einwohner = input.value
    })
  }
  // Variante B (Dialog): Klick auf Bearbeiten oeffnet den Dialog mit dem
  // aktuellen Wert vorbelegt; Speichern schreibt und schliesst.
  for (const btn of tbody.querySelectorAll(".doc-edit-btn")) {
    btn.addEventListener("click", () => oeffneEinwohnerDialog(btn))
  }
}

// Den Einwohner-Wert eines Dokuments in die DB schreiben (oder loeschen,
// wenn das Feld leer ist), sichern, und das Dashboard neu zeichnen.
async function speichereEinwohner(dokId, rohwert) {
  const text = String(rohwert ?? "").trim()
  const wert = text === "" ? null : Math.max(0, Math.round(Number(text)))
  if (text !== "" && (!Number.isFinite(wert) || wert < 0)) return
  db.ausfuehren(
    "UPDATE dokument SET einwohner=? WHERE dokument_id=?",
    [wert, dokId],
  )
  await db.sichern()
  // Inline-Felder und Edit-Buttons in der Dokumentliste aktualisieren,
  // damit der neue Wert nach dem Dialog-Save auch im Inline-Feld erscheint.
  // Auf gezielte DOM-Updates statt rebuild der Liste setzen — das laesst
  // Inline-Fokus und Tab-Zustand erhalten.
  const input = document.querySelector(
    `.doc-einwohner-input[data-id="${dokId}"]`,
  )
  if (input && document.activeElement !== input) {
    input.value = wert == null ? "" : String(wert)
  }
  const editBtn = document.querySelector(
    `.doc-edit-btn[data-id="${dokId}"]`,
  )
  if (editBtn) editBtn.dataset.einwohner = wert == null ? "" : String(wert)
  zeichneDashboard()
}

// Den Einwohner-Dialog (Variante B) mit dem aktuellen Wert eines Dokuments
// oeffnen. Submit speichert; "Abbrechen" verwirft.
function oeffneEinwohnerDialog(btn) {
  const dialog = document.getElementById("doc-einwohner-dialog")
  const input = document.getElementById("dlg-einwohner")
  const sub = document.getElementById("doc-einwohner-sub")
  if (!dialog || !input || typeof dialog.showModal !== "function") return
  const dokId = Number(btn.dataset.id)
  const aktuell = btn.dataset.einwohner || ""
  input.value = aktuell
  if (sub) sub.textContent = btn.dataset.doklabel || ""
  // Etwaige vorhergehende Bindung aufloesen, bevor neu gebunden wird.
  const form = document.getElementById("doc-einwohner-form")
  const abbrechenBtn = document.getElementById("doc-einwohner-cancel")
  if (form && form.__a7handler) {
    form.removeEventListener("submit", form.__a7handler)
  }
  if (abbrechenBtn && abbrechenBtn.__a7handler) {
    abbrechenBtn.removeEventListener("click", abbrechenBtn.__a7handler)
  }
  const onSubmit = async (ev) => {
    ev.preventDefault()
    await speichereEinwohner(dokId, input.value)
    dialog.close("confirm")
  }
  const onCancel = () => dialog.close("cancel")
  if (form) {
    form.addEventListener("submit", onSubmit)
    form.__a7handler = onSubmit
  }
  if (abbrechenBtn) {
    abbrechenBtn.addEventListener("click", onCancel)
    abbrechenBtn.__a7handler = onCancel
  }
  dialog.showModal()
  // Den Fokus in das Eingabefeld setzen, damit der Wert direkt editierbar ist.
  requestAnimationFrame(() => input.focus())
}

// Einklappbare Dokumentverwaltung: Offen-/Zu-Zustand und Summenzeile.
// Ohne geladene Dokumente offen (Upload-Aufforderung sichtbar), mit
// geladenen Dokumenten zugeklappt — das Dashboard bekommt den Platz.
function aktualisiereDokVerwaltung(anzahl) {
  const manager = document.getElementById("doc-manager")
  const count = document.getElementById("doc-manager-count")
  if (count) {
    count.textContent = anzahl > 0
      ? `— ${anzahl} geladen`
      : "— noch keine geladen"
  }
  if (manager) manager.open = anzahl === 0
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

  // Alle geladenen Dokumente verwerfen: Persistenz leeren, dann die Seite
  // frisch aufbauen — oeffneDb oeffnet danach eine leere Datenbank.
  const clearBtn = document.getElementById("doc-clear-all")
  clearBtn.addEventListener("click", async () => {
    if (!confirm("Wirklich alle geladenen Dokumente entfernen? " +
                 "Dieser Schritt kann nicht rueckgaengig gemacht werden.")) {
      return
    }
    clearBtn.disabled = true
    await persistenzLeeren()
    location.reload()
  })

  // DS v2.2 verlangt `.is-dragover` (statt des frueher lokalen `.is-over`)
  // als Drag-Hervorhebung; der Klassen-Name ist Vertrag mit der DS-CSS.
  for (const ev of ["dragenter", "dragover"]) {
    zone.addEventListener(ev, (e) => {
      e.preventDefault()
      zone.classList.add("is-dragover")
    })
  }
  for (const ev of ["dragleave", "drop"]) {
    zone.addEventListener(ev, (e) => {
      e.preventDefault()
      if (ev === "dragleave" && zone.contains(e.relatedTarget)) return
      zone.classList.remove("is-dragover")
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
      "warn")
  }
  let erfolg = 0
  for (const datei of pdfs) {
    if (await verarbeiteEine(datei)) erfolg++
  }
  zeichneDokumentliste()
  const gescheitert = pdfs.length - erfolg
  if (erfolg > 0) await db.sichern()

  if (gescheitert > 0) {
    // Mindestens eine PDF ist gescheitert. NICHT neu laden — der Reload
    // wuerde die Fehlermeldungen in der Fortschrittsliste loeschen, bevor
    // sie gelesen werden koennen. Die Dokumentverwaltung offen halten,
    // damit die Liste mit den Meldungen sichtbar bleibt.
    const manager = document.getElementById("doc-manager")
    if (manager) manager.open = true
    toast(
      erfolg > 0
        ? `${gescheitert} Dokument(e) konnten nicht geladen werden — ` +
          `Grund siehe unten in der Liste. Die ${erfolg} erfolgreich ` +
          `geladenen erscheinen im Dashboard nach dem Neuladen der Seite.`
        : `${gescheitert} Dokument(e) konnten nicht geladen werden — ` +
          `Grund siehe unten in der Liste.`,
      "error",
    )
  } else if (erfolg > 0) {
    // Alle PDFs erfolgreich verarbeitet — die Seite frisch aufbauen, damit
    // das Dashboard mit dem aktuellen Stand arbeitet (dashboard.js laeuft
    // nur einmal je Seitenaufbau).
    location.reload()
  }
}

// Eine PDF verarbeiten. Liefert true bei Erfolg, false bei einem Fehler.
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
    return true
  } catch (e) {
    fehler(item, e.message || String(e))
    return false
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
// Toast — duenne Bruecke ueber das DS-v2.2-`.gat-toast`. Das Markup folgt
// dem DS-Schema (`__body` + `__close`), der Container `#toast-box` traegt
// die `.gat-toaster`-Klasse und richtet die Toasts unten-rechts aus. Das
// Schliess-Kreuz erlaubt es, die Meldung vor dem Auto-Ablauf wegzuklicken.
function toast(text, art) {
  const variants = { info: "info", success: "success", warn: "warn", error: "error" }
  const variant = variants[art] || "info"
  const box = document.getElementById("toast-box")
  const wrap = document.createElement("div")
  wrap.className = `gat-toast gat-toast--${variant}`
  wrap.setAttribute("role", variant === "error" || variant === "warn" ? "alert" : "status")
  const body = document.createElement("div")
  body.className = "gat-toast__body"
  body.textContent = text
  const close = document.createElement("button")
  close.type = "button"
  close.className = "gat-toast__close"
  close.setAttribute("aria-label", "Meldung schliessen")
  close.textContent = "×"
  close.addEventListener("click", () => wrap.remove())
  wrap.appendChild(body)
  wrap.appendChild(close)
  box.appendChild(wrap)
  setTimeout(() => wrap.remove(), 6000)
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
  // Start verlief mit Fehler — gilt fuer den Waechter dennoch als erledigt,
  // damit nicht zusaetzlich die allgemeine Ausbleiben-Meldung erscheint.
  window.__appBereit = true
  toast(`Initialisierung fehlgeschlagen: ${e.message || String(e)}`, "error")
})
