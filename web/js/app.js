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
  window.__appBereit = true
  zeigeBuildStempel()
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

// --- Vollbild je Diagramm-Panel ------------------------------------------ //
// Jedes Diagramm-Panel bekommt im Kopf einen ruhigen "Vergroessern"-Knopf.
// Ein Klick legt das Panel ueber die native Fullscreen-API auf den ganzen
// Schirm — gerade fuer die interaktiven Diagramme und fuer aeltere
// Nutzer:innen eine deutlich bessere Lesbarkeit. Esc oder ein erneuter Klick
// fuehren zurueck. Im Vollbild ist der .dash-chart-Div nicht mehr an seine
// feste Inline-Hoehe gebunden (CSS .web-panel:fullscreen); damit ECharts die
// neue Flaeche fuellt, wird auf fullscreenchange ein window-resize-Event
// ausgeloest — dashboard.js hoert darauf (resizeVisibleCharts) und passt
// alle sichtbaren Diagramme an. dashboard.js bleibt unangetastet.
function verdrahteVollbild() {
  // Fehlt die Fullscreen-API, wird gar kein Knopf eingehaengt — die App
  // bleibt ohne ihn voll funktionsfaehig.
  if (!document.fullscreenEnabled) return

  // Nur Panels mit einem echten Diagramm (.dash-chart) — Tabellen-Panels
  // profitieren nicht von einer Vollbildansicht.
  const panels = document.querySelectorAll(
    ".web-panel:has(.dash-chart)",
  )
  for (const panel of panels) {
    const kopf = panel.querySelector(".web-panel__head")
    const titel = kopf && kopf.querySelector("h3")
    if (!kopf || !titel) continue

    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "web-panel__fs-btn"
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

    // Titel und Knopf in eine gemeinsame Kopfzeile setzen — der Knopf sitzt
    // rechts neben dem Titel, ueber einer etwaigen Notiz/Sankey-Leiste.
    const reihe = document.createElement("div")
    reihe.className = "web-panel__head-row"
    kopf.insertBefore(reihe, titel)
    reihe.appendChild(titel)
    reihe.appendChild(btn)
  }

  // Vollbildwechsel: Knopf-Label/aria umstellen und ECharts neu vermessen.
  document.addEventListener("fullscreenchange", () => {
    const aktiv = document.fullscreenElement
    for (const btn of document.querySelectorAll(".web-panel__fs-btn")) {
      const panel = btn.closest(".web-panel")
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
      "fehl",
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
  // Start verlief mit Fehler — gilt fuer den Waechter dennoch als erledigt,
  // damit nicht zusaetzlich die allgemeine Ausbleiben-Meldung erscheint.
  window.__appBereit = true
  document.getElementById("toast-box").innerHTML =
    `<div class="toast fehl">Initialisierung fehlgeschlagen: ${escapeHtml(
      e.message || String(e),
    )}</div>`
})
