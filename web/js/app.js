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
import {
  CHART_THEMES, holeAktivenThemeName, holeAktivesTheme,
  setzeTheme, aktualisiereThemeBeiHc, initChartTheme,
} from "./chart-themes.js"

// Chart-Theme global bereitstellen, bevor irgendein Chart-Builder laeuft.
initChartTheme()

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
  verdrahtePngExport()
  verdrahteBuilder()
  verdrahteHcToggle()
  verdrahteThemePicker()
  verdrahteAusgabenDrillSync()
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
  const set = (an, ausUserInteraktion) => {
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
    // HC-Auto-Switch: Chart-Theme an den HC-Modus koppeln. Nur bei einer
    // expliziten User-Interaktion, nicht beim Initial-Sync, damit eine
    // gespeicherte manuelle Theme-Wahl ueber Refreshes hinweg respektiert
    // bleibt.
    if (ausUserInteraktion) aktualisiereThemeBeiHc(an)
  }
  let aktiv = false
  try { aktiv = localStorage.getItem("gat-mode-hc") === "1" } catch (e) {}
  set(aktiv, false)
  btn.addEventListener("click", () =>
    set(!document.body.classList.contains("gat-mode-hc"), true))
}

// --- Chart-Theme-Picker --------------------------------------------------- //
// Header-Dropdown rechts neben dem Kontrast-Toggle. Wechsel des Themes
// schreibt in localStorage und dispatcht 'theme-change'; der Listener
// re-rendert alle ECharts-Instanzen.
function verdrahteThemePicker() {
  const sel = document.getElementById("theme-picker")
  if (!sel) return
  // Initialwert aus localStorage.
  const aktuell = holeAktivenThemeName()
  sel.value = aktuell
  sel.addEventListener("change", () => {
    setzeTheme(sel.value)
  })
  // Re-Render aller Charts bei Theme-Wechsel. dashboard.js exponiert
  // weder ein renderAll noch die Instanz-Sammlung — ueber den globalen
  // window-Resize lassen sich Layout-Aktualisierungen anstossen, aber
  // setOption mit neuer Palette geht nur ueber dashboard.js. Daher hier:
  // alle ECharts-Instanzen direkt ueber getInstanceByDom abrufen und die
  // aktuelle Option (inst.getOption()) mit der neuen color-Palette neu
  // setzen. ECharts respektiert 'color' als Array von Default-Farben.
  window.addEventListener("theme-change", () => {
    aktualisiereAlleChartFarben()
    // localStorage-Echo + data-Attribut auf <html> fuer CSS-Hooks.
    try {
      const name = holeAktivenThemeName()
      document.documentElement.setAttribute("data-chart-theme", name)
    } catch (e) {}
    // Picker-UI synchron halten (falls Theme programmatisch geaendert wurde).
    sel.value = holeAktivenThemeName()
  })
  // Globalen Picker-Pfad fuer Tests exponieren.
  if (typeof window !== "undefined") {
    window.__themePicker = {
      setzeTheme,
      holeAktivenThemeName,
      holeAktivesTheme,
      CHART_THEMES,
      aktualisiereAlleChartFarben,
    }
  }
}

// Alle sichtbaren ECharts-Instanzen mit der aktuellen Palette neu farben.
// ECharts ueber `setOption({ color: PALETTE })` ohne `notMerge=true`
// uebernimmt nur die Top-Level-color — und die wird bei vielen unserer
// Charts ueberschrieben durch series.itemStyle.color. Deshalb: zusaetzlich
// ein leichtes Repaint anstossen, indem wir die aktuelle Option um die
// color-Eigenschaft anreichern und neu setzen. Charts, die feste
// Semantik-Farben tragen (Gruen = Ertraege, Clay = Aufwand), bleiben
// dadurch unveraendert — das ist gewollt: die Semantik ueberlebt den
// Theme-Wechsel. Drill-Sync-Charts (Treemap, Pie) lesen `window.__chartTheme`
// und werden ueber `__ausgabenDrillSync.rendereBeide()` aktualisiert.
function aktualisiereAlleChartFarben() {
  const palette = (window.__chartTheme && window.__chartTheme.palette) ||
    holeAktivesTheme().palette
  for (const el of document.querySelectorAll(".dash-chart")) {
    const inst = window.echarts && window.echarts.getInstanceByDom
      ? window.echarts.getInstanceByDom(el)
      : null
    if (!inst) continue
    try {
      const opt = inst.getOption()
      // Top-level-color setzen — die kategorialen Charts (Treemap-Default,
      // Pie ohne explizite Slice-Farben, Mehrjahres-Linien) ziehen von hier.
      inst.setOption({ color: palette }, false)
      void opt
    } catch (e) {
      // ECharts-Instanz ohne setOption (frisch initialisiert) — egal.
    }
  }
  // Drill-Sync-Charts neu zeichnen, damit ihre per-Slice/per-Tile-
  // Palette das neue Theme spiegelt.
  if (window.__ausgabenDrillSync) {
    try { window.__ausgabenDrillSync.rendereBeide() } catch (e) {}
  }
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
// Native Fullscreen-Knopf: Label "Vollbild" — semantisch der echte
// Vollbildmodus (OS-Fullscreen, F11-aehnlich). Der Modal-Knopf nebenan
// traegt "Vergroessern" (siehe oeffneChartModal-Verdrahtung unten) und
// laesst den User in der App.
function setzeVollbildLabel(btn, imVollbild) {
  btn.textContent = imVollbild ? "Vollbild verlassen" : "Vollbild"
  btn.setAttribute(
    "aria-label",
    imVollbild
      ? "Vollbild verlassen"
      : "Diagramm im Vollbild oeffnen (Browser-Fullscreen)",
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
    btn.textContent = "Vergroessern"
    btn.setAttribute("aria-label",
      "Diagramm vergroessern (in einem Overlay)")
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
  const aktionen = document.getElementById("chart-modal-actions")
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

  // Aktionsleiste im Modal-Header neu aufbauen — PNG-Export und ein
  // "Verkleinern"-Knopf (sichtbares Pendant zum DS-Schliess-Kreuz, gleiche
  // Optik wie die Panel-Aktionen). Der PNG-Export operiert weiterhin auf
  // dem Panel — der Chart-Knoten ist nur temporaer ins Modal verschoben,
  // `chart.getDataURL` funktioniert dort genauso.
  if (aktionen) {
    aktionen.innerHTML = ""
    aktionen.appendChild(baueExportKnopf(panel, "modal"))
    const closeBtn = document.createElement("button")
    closeBtn.type = "button"
    closeBtn.className = "app-panel-act-btn app-modal-close-btn"
    closeBtn.textContent = "Verkleinern"
    closeBtn.setAttribute("aria-label", "Diagramm wieder verkleinern")
    closeBtn.addEventListener("click", () => dialog.close())
    aktionen.appendChild(closeBtn)
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
  // Modal-eigene Aktions-Knoepfe entfernen — sie werden bei `oeffneChartModal`
  // fuer das jeweils aktuelle Panel frisch aufgebaut.
  const aktionen = document.getElementById("chart-modal-actions")
  if (aktionen) aktionen.innerHTML = ""
  // ECharts neu vermessen — der Container hat jetzt wieder seine Panel-Hoehe.
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"))
  })
  setTimeout(() => window.dispatchEvent(new Event("resize")), 120)
}

// --- PNG-Export je Diagramm-Panel ---------------------------------------- //
// Ein zweiter Aktions-Knopf "Als PNG speichern" im Panel-Kopf. ECharts hat
// das eingebaut: `chart.getDataURL({ type: 'png', pixelRatio: 2,
// backgroundColor: '#fff' })` liefert eine Data-URL, die ueber den
// `<a download>`-Trick als Datei gespeichert wird.
//
// Dateinamen-Schema: `<panel-id>-<dokument>-<YYYY-MM-DD>.png`,
// z. B. `c_wasserfall-VA-2026-Auflage-2026-05-24.png`. Der aktive
// Dokumentname kommt aus dem Switcher (`.switch-btn.is-active`), den
// dashboard.js pflegt. Fehlt er, fallen wir auf `dokument` zurueck.
//
// Hintergrund **immer weiss** — auch im Hochkontrast-Modus. Das exportierte
// PNG ist fuer Berichte und Praesentationen gedacht (Druck-Default), und
// HC-spezifische Farben wuerden in einem PDF-Anhang nur irritieren.
function verdrahtePngExport() {
  for (const panel of holeDiagrammPanels()) {
    const actions = holeOderBaueAktionsleiste(panel)
    if (!actions) continue
    actions.appendChild(baueExportKnopf(panel, "panel"))
  }
}

function baueExportKnopf(panel, herkunft) {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "app-panel-act-btn app-panel-export-btn"
  btn.textContent = "Als PNG speichern"
  btn.setAttribute("aria-label", "Diagramm als PNG-Datei speichern")
  btn.dataset.appExportHerkunft = herkunft
  btn.addEventListener("click", () => exportierePanelAlsPng(panel))
  return btn
}

async function exportierePanelAlsPng(panel) {
  const chart = panel.querySelector(".dash-chart")
  if (!chart) {
    toast("Diagramm nicht gefunden — Export abgebrochen.", "error")
    return
  }
  // ECharts ist global ueber das CDN-Script eingebunden. Die Instanz holt
  // sich `getInstanceByDom`, ohne dashboard.js antasten zu muessen.
  const echartsRef = window.echarts
  const inst = echartsRef && echartsRef.getInstanceByDom
    ? echartsRef.getInstanceByDom(chart)
    : null
  if (!inst) {
    // Builder ist erst nach Klick auf "Diagramm erstellen" gerendert —
    // dort hilft der generische "noch nicht bereit"-Hinweis nicht weiter,
    // weil das Diagramm gar nicht bereitstehen kann, solange der User
    // nicht auf den Render-Knopf geklickt hat. Klarer Hinweis statt
    // dem irrefuehrenden "gleich nochmal versuchen".
    if (panel && panel.id === "builder-panel") {
      toast(
        "Bitte zuerst auf „Diagramm erstellen“ klicken — " +
          "danach kann das Diagramm als PNG gespeichert werden.",
        "warn",
      )
    } else {
      toast("Diagramm noch nicht bereit — bitte gleich nochmal versuchen.",
        "warn")
    }
    return
  }
  let dataUrl = ""
  try {
    dataUrl = inst.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#fff",
    })
  } catch (e) {
    toast(`Export fehlgeschlagen: ${e.message || String(e)}`, "error")
    return
  }
  // Branding-Footer ueber Off-Screen-Canvas montieren — Titel, Dokument
  // und Datum unter dem Diagramm, URL rechts. Das exportierte Bild ist
  // damit eigenstaendig brauchbar (Social-Media-tauglich), das nackte
  // Diagramm wird nicht mehr ausgegeben.
  let finalUrl = dataUrl
  try {
    finalUrl = await brandePngMitFooter(dataUrl, panel)
  } catch (e) {
    // Footer-Komposition scheitert (z. B. CSP, Canvas-Tainting): das
    // nackte ECharts-PNG bleibt als Fallback erhalten — der Export geht
    // immer noch durch, nur ohne Beschriftung.
    if (typeof console !== "undefined" && console.warn) {
      console.warn("Branding-Footer fehlgeschlagen — exportiere ohne Footer:",
        e && e.message)
    }
  }
  const dateiname = baueExportDateiname(panel)
  const a = document.createElement("a")
  a.href = finalUrl
  a.download = dateiname
  document.body.appendChild(a)
  a.click()
  a.remove()
  toast(`PNG gespeichert: ${dateiname}`, "success")
}

// --- PNG-Branding-Footer ------------------------------------------------- //
// Das nackte ECharts-PNG ueber ein Off-Screen-Canvas montieren und einen
// Branding-Footer (Titel, Dokument/Jahr, Datum, URL) unter dem Diagramm
// einziehen. Pixel-Ratio 2 fuer Retina/Social-Media-Aufloesung; Hintergrund
// weiss, Schrift Barlow (Design-System), Farben aus den DS-Tokens.
//
// Layout (skaliert mit dem PixelRatio 2):
//   - Footer-Hoehe ~96px (Logischpixel ~48), zweispaltig
//   - Links: Diagrammtitel (Barlow Semi Condensed, kraeftig)
//           + Dokument-Label und Datum daruntersitzend (weicher Ton)
//   - Rechts: URL `gemeindefinanzen.gruene.at` (zurueckhaltend)
//   - Trennlinie als duenner Strich oben am Footer
const FOOTER_PIXEL_RATIO = 2

function ladeBild(src) {
  return new Promise((aufloesen, ablehnen) => {
    const img = new Image()
    img.onload = () => aufloesen(img)
    img.onerror = () => ablehnen(new Error("Bild konnte nicht geladen werden"))
    img.src = src
  })
}

async function brandePngMitFooter(dataUrl, panel) {
  const bild = await ladeBild(dataUrl)
  const titel = leseTitelAusPanel(panel)
  const dokLabel = leseAktivesDokLabel()
  const datum = formatHeute()
  const url = "gemeindefinanzen.gruene.at"

  // Footer-Geometrie in Bild-Pixeln (das Diagramm hat bereits Pixel-Ratio 2).
  const FOOTER_H = 96     // px (footer height at pixelRatio=2)
  const PAD_X = 36
  const PAD_Y = 22
  const titelSize = 28
  const metaSize = 18
  const urlSize = 18

  const canvas = document.createElement("canvas")
  canvas.width = bild.width
  canvas.height = bild.height + FOOTER_H
  const ctx = canvas.getContext("2d")

  // Hintergrund weiss (Diagramm-Hintergrund + Footer-Hintergrund).
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Diagramm einzeichnen.
  ctx.drawImage(bild, 0, 0)

  // Trennlinie zwischen Diagramm und Footer.
  ctx.fillStyle = "#d7e0d3"
  ctx.fillRect(0, bild.height, canvas.width, 1)

  // Footer-Text: Barlow Semi Condensed (Headline-Schrift des DS) fuer den
  // Titel, Inter/System fuer Meta und URL — Fonts vom DS bereits geladen.
  // CanvasContext kennt keine generischen DS-Tokens; die Werte sind
  // konsistent mit den DS-Variablen (--gat-web-text / --gat-web-text-soft /
  // --gat-web-green-deep).
  const TEXT = "#1f261c"
  const TEXT_SOFT = "#4a5a3f"
  const GREEN_DEEP = "#2c6e40"
  const FONT_HEAD = "'Barlow Semi Condensed', 'Barlow', sans-serif"
  const FONT_COPY = "'Barlow', 'Inter', system-ui, sans-serif"

  const footerTop = bild.height

  // Linke Spalte: Titel + Meta-Zeile darunter.
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = TEXT
  ctx.font = `700 ${titelSize}px ${FONT_HEAD}`
  const titelText = kuerzeText(ctx, titel, canvas.width - PAD_X * 2 - 280)
  ctx.fillText(titelText, PAD_X, footerTop + PAD_Y + titelSize - 4)

  ctx.fillStyle = TEXT_SOFT
  ctx.font = `400 ${metaSize}px ${FONT_COPY}`
  const metaText = dokLabel
    ? `${dokLabel} · ${datum}`
    : datum
  ctx.fillText(metaText, PAD_X, footerTop + PAD_Y + titelSize + metaSize + 4)

  // Rechte Spalte: URL, rechtsbuendig.
  ctx.fillStyle = GREEN_DEEP
  ctx.font = `600 ${urlSize}px ${FONT_HEAD}`
  ctx.textAlign = "right"
  ctx.fillText(url, canvas.width - PAD_X,
    footerTop + PAD_Y + titelSize + metaSize + 4)
  ctx.textAlign = "left"

  return canvas.toDataURL("image/png")
}

function kuerzeText(ctx, text, maxBreite) {
  if (!text) return ""
  if (ctx.measureText(text).width <= maxBreite) return text
  const ellipsis = "…"
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    const kandidat = text.slice(0, mid) + ellipsis
    if (ctx.measureText(kandidat).width <= maxBreite) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }
  return text.slice(0, lo) + ellipsis
}

function leseTitelAusPanel(panel) {
  const h3 = panel.querySelector(".gat-panel__head h3")
  const basis = h3
    ? (h3.textContent || "").trim().replace(/\s+/g, " ")
    : "Diagramm"
  // Beim Diagramm-Builder ist der statische h3-Text „Diagramm-Builder" —
  // er sagt nichts ueber das tatsaechlich gebaute Diagramm aus. Den Titel
  // mit der aktuellen Builder-Konfiguration ergaenzen (Gruppierung,
  // Wertspalte, Aggregation), damit der PNG-Footer aussagekraeftig ist.
  if (panel && panel.id === "builder-panel") {
    const zusatz = leseBuilderKonfigBezeichnung()
    if (zusatz) return `${basis} · ${zusatz}`
  }
  return basis
}

// Eine kompakte Bezeichnung des aktuell konfigurierten Builder-Diagramms —
// fuer den PNG-Footer und Diagnose-Zwecke. Liefert z. B.
// „Aufgabengruppe — EH wert (Summe)" oder mit Sekundaer-Gruppierung
// „Aufgabengruppe × Richtung — EH wert (Summe)".
function leseBuilderKonfigBezeichnung() {
  const dimEl = document.getElementById("builder-dim")
  const wertEl = document.getElementById("builder-wert")
  const aggEl = document.getElementById("builder-agg")
  const stackEl = document.getElementById("builder-stack")
  const stackWrap = document.getElementById("builder-stack-wrap")
  if (!dimEl || !wertEl || !aggEl) return ""
  const dim = BUILDER_DIM_LABELS[dimEl.value] || dimEl.value
  const wert = BUILDER_WERT_LABELS[wertEl.value] || wertEl.value
  const agg = aggEl.value
  const aggLabel = agg.charAt(0).toUpperCase() + agg.slice(1)
  // Sekundaere Gruppierung nur einbeziehen, wenn das Feld aktuell sichtbar
  // ist und einen Wert traegt (sonst hat es keine Wirkung auf das Diagramm).
  const stack = stackEl && stackWrap && !stackWrap.hidden && stackEl.value
    ? (BUILDER_DIM_LABELS[stackEl.value] || stackEl.value)
    : ""
  const dimTeil = stack ? `${dim} × ${stack}` : dim
  if (agg === "anzahl") return `${dimTeil} — Anzahl Posten`
  return `${dimTeil} — ${wert} (${aggLabel})`
}

function leseAktivesDokLabel() {
  const switcherBtn = document.querySelector(".switch-btn.is-active")
  return switcherBtn && switcherBtn.textContent
    ? switcherBtn.textContent.trim()
    : ""
}

function formatHeute() {
  const heute = new Date()
  return [
    heute.getFullYear(),
    String(heute.getMonth() + 1).padStart(2, "0"),
    String(heute.getDate()).padStart(2, "0"),
  ].join("-")
}

// Werte fuer Tests/Diagnose ueber `window.__brandFooter` exponieren — der
// E2E-Test kann so den Branding-Anteil pruefen, ohne den PNG-Inhalt zu
// dekodieren.
if (typeof window !== "undefined") {
  window.__brandFooter = {
    brandePngMitFooter,
    leseTitelAusPanel,
    leseBuilderKonfigBezeichnung,
    leseAktivesDokLabel,
    formatHeute,
    FOOTER_PIXEL_RATIO,
  }
}

// Dateinamen-Schema fuer den PNG-Export: `<panel-id>-<dokument>-<YYYY-MM-DD>.png`.
// `panel-id` ist die `id` des `.dash-chart`-Containers (panel-stabile
// Kennung, wie sie auch dashboard.js nutzt). `dokument` ist die Beschriftung
// des aktiven Switcher-Knopfs (`.switch-btn.is-active`); fehlt er,
// fallen wir auf `dokument` zurueck (z. B. wenn nur ein Dokument geladen
// ist und der Switcher keinen aktiven Eintrag hat).
function baueExportDateiname(panel) {
  const chart = panel.querySelector(".dash-chart")
  const panelId = (chart && chart.id) ? chart.id : "diagramm"
  const switcherBtn = document.querySelector(".switch-btn.is-active")
  const dokName = switcherBtn && switcherBtn.textContent
    ? switcherBtn.textContent.trim()
    : "dokument"
  const heute = new Date()
  const datum = [
    heute.getFullYear(),
    String(heute.getMonth() + 1).padStart(2, "0"),
    String(heute.getDate()).padStart(2, "0"),
  ].join("-")
  // Sicheres Dateinamens-Sanitizing: alles ausser ASCII-Buchstaben/Ziffern,
  // Bindestrich, Punkt, Unterstrich auf `-` mappen. Mehrfach-Trennzeichen
  // zusammenziehen. Das Ergebnis bleibt cross-OS-tauglich.
  return saeubereDateiname(`${panelId}-${dokName}-${datum}.png`)
}

function saeubereDateiname(roh) {
  return String(roh)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// --- Diagramm-Builder ---------------------------------------------------- //
// Im "Suche & Daten"-Tab sitzt unter der Detailposten-Tabelle ein Builder,
// der aus der aktuellen Filtermenge (denselben Filter-Inputs wie die
// Suchtabelle) ein eigenes Diagramm aufbaut. Diagrammtyp, Gruppierung,
// Wertspalte und Aggregation werden ueber vier Dropdowns gewaehlt;
// "Diagramm erstellen" rendert das Ergebnis in `#c_builder`.
//
// Daten kommen aus `window.DATA.posten` (dashboard-data.js stellt sie
// global bereit, sobald baueDashboard durchgelaufen ist). Die Filter
// werden direkt aus dem DOM gelesen — wir duplizieren dabei die Logik
// aus dashboard.js (setupSearch.matches), ohne den Vendor anzufassen.
// Das ist bewusst eine Kopie statt eines Hooks: dashboard.js ist tabu,
// und der Builder soll auch dann funktionieren, wenn der Vendor
// irgendwann anders gebaut wird. Bei einer Aenderung der Filter-Felder
// muessen beide Stellen synchron bleiben — der Test prueft die
// Filtermenge per Vergleich gegen die Anzahl-Anzeige der Suchtabelle.

const BUILDER_DIM_LABELS = {
  gruppe: "Aufgabengruppe",
  ansatz: "Ansatz",
  bezeichnung: "Bezeichnung",
  dok: "Dokument",
  richtung: "Richtung",
  gebarung: "Gebarung",
}

const BUILDER_WERT_LABELS = {
  ew: "EH wert",
  ev: "EH vergleich",
  ed: "EH dritte",
  fw: "FH wert",
  fv: "FH vergleich",
  fd: "FH dritte",
}

function builderFiltereMatch(p) {
  // Spiegelt setupSearch.matches() aus dashboard.js — exakt dieselben
  // Filter-Inputs, dieselbe Semantik. Bei Aenderung der Filter-Felder im
  // Markup muessen beide Stellen synchron bleiben.
  const qEl = document.getElementById("f-such")
  const dokEl = document.getElementById("f-dok")
  const grpEl = document.getElementById("f-gruppe")
  const richtEl = document.getElementById("f-richtung")
  const gebEl = document.getElementById("f-gebarung")
  const minEl = document.getElementById("f-min")
  const maxEl = document.getElementById("f-max")
  if (!qEl) return true
  const q = (qEl.value || "").trim().toLowerCase()
  const dok = dokEl ? dokEl.value : ""
  const grp = grpEl ? grpEl.value : ""
  const richt = richtEl ? richtEl.value : ""
  const geb = gebEl ? gebEl.value : ""
  const min = minEl && minEl.value !== "" ? parseFloat(minEl.value) : null
  const max = maxEl && maxEl.value !== "" ? parseFloat(maxEl.value) : null
  if (dok && String(p.dok) !== dok) return false
  if (grp && p.gruppe !== grp) return false
  if (richt && p.richtung !== richt) return false
  if (geb && p.gebarung !== geb) return false
  if (min !== null && p.ew < min) return false
  if (max !== null && p.ew > max) return false
  if (q) {
    const hay = (p.bezeichnung + " " + p.konto + " " + p.ansatz + " " +
                 (p.ansatz_text || "")).toLowerCase()
    if (hay.indexOf(q) === -1) return false
  }
  return true
}

function builderKategorieLabel(p, dim) {
  // Label fuer die x-Achse je Gruppierung. Fuer Codes (gruppe/ansatz)
  // zusaetzlich den Klartext einblenden, soweit vorhanden — sonst nur
  // der Code.
  if (dim === "gruppe") {
    return p.gruppe + (p.gruppe_text ? " " + p.gruppe_text : "")
  }
  if (dim === "ansatz") {
    return p.ansatz + (p.ansatz_text ? " " + p.ansatz_text : "")
  }
  if (dim === "dok") {
    // p.dok ist eine ID; das Switcher-Label kennt den Klartext.
    const docs = (window.DATA && window.DATA.dokumente) || []
    const d = docs.find((x) => String(x.id) === String(p.dok))
    return d ? d.label : String(p.dok)
  }
  return String(p[dim] || "")
}

function builderAggregiere(posten, dim, wertfeld, agg) {
  // Gruppieren nach Kategorie, dann aggregieren. Liefert ein Array
  // [{ name, wert, anzahl }] absteigend nach wert sortiert.
  // Aggregationen: summe, durchschnitt, anzahl, median, min, max.
  // Fuer median/min/max wird die Wertliste pro Kategorie gesammelt.
  const eimer = new Map()
  const brauchListe = agg === "median" || agg === "min" || agg === "max"
  for (const p of posten) {
    const name = builderKategorieLabel(p, dim)
    if (!name) continue
    const v = Number(p[wertfeld]) || 0
    const e = eimer.get(name)
    if (e) {
      e.summe += v
      e.anzahl += 1
      if (brauchListe) e.werte.push(v)
    } else {
      eimer.set(name, {
        summe: v,
        anzahl: 1,
        werte: brauchListe ? [v] : null,
      })
    }
  }
  const ergebnis = []
  for (const [name, e] of eimer.entries()) {
    let wert
    if (agg === "summe") wert = e.summe
    else if (agg === "durchschnitt") {
      wert = e.anzahl > 0 ? e.summe / e.anzahl : 0
    } else if (agg === "anzahl") wert = e.anzahl
    else if (agg === "median") wert = berechneMedian(e.werte)
    else if (agg === "min") wert = e.werte.length ? Math.min(...e.werte) : 0
    else if (agg === "max") wert = e.werte.length ? Math.max(...e.werte) : 0
    else wert = e.summe
    ergebnis.push({ name, wert, anzahl: e.anzahl })
  }
  ergebnis.sort((a, b) => b.wert - a.wert)
  return ergebnis
}

function berechneMedian(werte) {
  // Median ueber eine Werteliste — bei gerader Laenge der Mittelwert der
  // beiden mittleren Werte, sonst der mittlere Wert. Liefert 0 fuer leere
  // Liste.
  if (!werte || werte.length === 0) return 0
  const sortiert = werte.slice().sort((a, b) => a - b)
  const m = Math.floor(sortiert.length / 2)
  if (sortiert.length % 2 === 0) {
    return (sortiert[m - 1] + sortiert[m]) / 2
  }
  return sortiert[m]
}

function builderBerechneAgg(werte, agg) {
  // Aggregiert eine flache Werteliste analog zu builderAggregiere, aber
  // ohne Gruppen-Buckets — fuer Pivot-Zellen in Stacked/Treemap/Heatmap.
  if (!werte || werte.length === 0) return 0
  if (agg === "summe") {
    let s = 0
    for (const v of werte) s += v
    return s
  }
  if (agg === "durchschnitt") {
    let s = 0
    for (const v of werte) s += v
    return s / werte.length
  }
  if (agg === "anzahl") return werte.length
  if (agg === "median") return berechneMedian(werte)
  if (agg === "min") return Math.min(...werte)
  if (agg === "max") return Math.max(...werte)
  let s = 0
  for (const v of werte) s += v
  return s
}

function builderPivot(posten, dim, dim2, wertfeld, agg) {
  // Erzeugt eine Pivot-Matrix: primaere Gruppierung als Zeilen
  // (rowLabels), sekundaere Gruppierung als Spalten (colLabels), und je
  // Zelle den aggregierten Wert. Liefert { rowLabels, colLabels, matrix }
  // mit matrix[rowIdx][colIdx] = wert. Die Werte je Zelle stammen aus
  // allen Posten, die in dieser Zeile/Spalte landen.
  const zellen = new Map()  // "row col" -> werte[]
  const zeilenSummen = new Map()  // row -> summe (fuer Sortierung)
  const spaltenSummen = new Map()  // col -> summe
  for (const p of posten) {
    const row = builderKategorieLabel(p, dim)
    const col = builderKategorieLabel(p, dim2)
    if (!row || !col) continue
    const v = Number(p[wertfeld]) || 0
    const schluessel = row + " " + col
    const liste = zellen.get(schluessel)
    if (liste) liste.push(v)
    else zellen.set(schluessel, [v])
    zeilenSummen.set(row, (zeilenSummen.get(row) || 0) + Math.abs(v))
    spaltenSummen.set(col, (spaltenSummen.get(col) || 0) + Math.abs(v))
  }
  // Top-N Zeilen und Spalten — Pivot-Matrizen explodieren sonst schnell
  // bei vielen Kategorien (z. B. Bezeichnung x Bezeichnung).
  const TOPN_ROW = 20
  const TOPN_COL = 15
  const rowLabels = Array.from(zeilenSummen.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOPN_ROW)
    .map(([k]) => k)
  const colLabels = Array.from(spaltenSummen.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOPN_COL)
    .map(([k]) => k)
  const matrix = rowLabels.map((row) =>
    colLabels.map((col) => {
      const liste = zellen.get(row + " " + col)
      return builderBerechneAgg(liste, agg)
    }),
  )
  return { rowLabels, colLabels, matrix }
}

// Chart-Palette aus dem DS-CSS lesen — die Tokens --gat-web-chart-1..8 sind
// die Diagramm-Farben des Org-DS. Fallback auf einen festen Grueneton, wenn
// CSS-Vars (noch) nicht greifbar sind (z. B. im Headless-Test).
function builderChartPalette() {
  const root = document.documentElement
  const palette = []
  if (root && typeof getComputedStyle === "function") {
    const stil = getComputedStyle(root)
    for (let i = 1; i <= 8; i++) {
      const wert = stil.getPropertyValue(`--gat-web-chart-${i}`).trim()
      if (wert) palette.push(wert)
    }
  }
  if (palette.length === 0) {
    // Fallback-Palette: Grueneton-Verlauf, falls DS-Tokens fehlen.
    return ["#2c6e40", "#4a8c5e", "#6b9f7e", "#8db59c", "#aacbb5",
      "#c6dcca", "#7a9c87", "#4d6e58"]
  }
  return palette
}

function builderEchartsOption(typ, daten, achsTitel, wertTitel, extras) {
  // extras: { pivot, dim2Titel } — wird fuer Diagrammtypen mit
  // sekundaerer Gruppierungsachse genutzt (bar-stacked, treemap, heatmap).
  extras = extras || {}
  if (typ === "bar-stacked") {
    return builderEchartsOptionStacked(daten, achsTitel, wertTitel, extras)
  }
  if (typ === "treemap") {
    return builderEchartsOptionTreemap(daten, achsTitel, wertTitel, extras)
  }
  if (typ === "heatmap") {
    return builderEchartsOptionHeatmap(daten, achsTitel, wertTitel, extras)
  }
  // Top 30 Kategorien — bei mehr Treffern den Rest unter "Sonstige"
  // buendeln. Vermeidet unleserliche Charts mit hunderten Zeilen.
  const TOPN = 30
  let zeigen = daten
  if (daten.length > TOPN) {
    const top = daten.slice(0, TOPN)
    const rest = daten.slice(TOPN)
    const restSumme = rest.reduce((s, r) => s + r.wert, 0)
    zeigen = top.concat([{ name: `Sonstige (${rest.length})`,
      wert: restSumme, anzahl: rest.reduce((s, r) => s + r.anzahl, 0) }])
  }
  const labels = zeigen.map((r) => r.name)
  const werte = zeigen.map((r) => r.wert)
  const baseTooltip = {
    trigger: typ === "pie" ? "item" : "axis",
    valueFormatter: (v) =>
      typeof v === "number"
        ? Math.round(v).toLocaleString("de-AT") + " €"
        : String(v),
  }
  if (typ === "pie") {
    return {
      title: { text: `${wertTitel} nach ${achsTitel}`, left: "center" },
      tooltip: baseTooltip,
      legend: { type: "scroll", bottom: 0 },
      series: [{
        type: "pie",
        radius: ["35%", "65%"],
        center: ["50%", "50%"],
        data: zeigen.map((r) => ({ name: r.name, value: r.wert })),
        label: { formatter: "{b}: {d}%" },
      }],
    }
  }
  if (typ === "line") {
    return {
      title: { text: `${wertTitel} nach ${achsTitel}`, left: "center" },
      tooltip: baseTooltip,
      grid: { left: 60, right: 24, top: 56, bottom: 80, containLabel: true },
      xAxis: { type: "category", data: labels,
        axisLabel: { rotate: 35, fontSize: 11 } },
      yAxis: { type: "value",
        axisLabel: { formatter: (v) =>
          Math.round(v).toLocaleString("de-AT") } },
      series: [{ type: "line", data: werte, smooth: true,
        areaStyle: { opacity: 0.18 } }],
    }
  }
  // bar-h | bar-v
  const horiz = typ === "bar-h"
  return {
    title: { text: `${wertTitel} nach ${achsTitel}`, left: "center" },
    tooltip: baseTooltip,
    grid: { left: horiz ? 220 : 56, right: 24, top: 56, bottom: horiz ? 40 : 100,
      containLabel: true },
    xAxis: horiz
      ? { type: "value",
          axisLabel: { formatter: (v) =>
            Math.round(v).toLocaleString("de-AT") } }
      : { type: "category", data: labels,
          axisLabel: { rotate: 35, fontSize: 11 } },
    yAxis: horiz
      ? { type: "category",
          data: labels.slice().reverse(),
          axisLabel: { fontSize: 11 } }
      : { type: "value",
          axisLabel: { formatter: (v) =>
            Math.round(v).toLocaleString("de-AT") } },
    series: [{
      type: "bar",
      data: horiz ? werte.slice().reverse() : werte,
      itemStyle: { color: "#2c6e40" },
    }],
  }
}

// Diagrammtypen, die eine sekundaere Gruppierung brauchen — wird vom UI
// genutzt, um das passende Dropdown zu zeigen oder zu verstecken. Treemap
// nutzt dim2 optional (ohne Sekundaer flacher Top-N-Treemap, mit dim2
// hierarchisch). Heatmap braucht dim2 zwingend (sonst Hinweis-Chart).
const BUILDER_TYPEN_MIT_DIM2 = new Set(["bar-stacked", "treemap", "heatmap"])

function builderEchartsOptionStacked(daten, achsTitel, wertTitel, extras) {
  // Gestapelte Balken (vertikal): primaere Gruppierung als x-Achse,
  // sekundaere Gruppierung als Stack-Serien. Erwartet extras.pivot.
  // Ohne pivot (kein dim2): Fallback auf einen einfachen vertikalen
  // Balken-Look — so bleibt die UI auch ohne dim2 funktional.
  const palette = builderChartPalette()
  const baseTooltip = {
    trigger: "axis",
    axisPointer: { type: "shadow" },
    valueFormatter: (v) =>
      typeof v === "number"
        ? Math.round(v).toLocaleString("de-AT") + " €"
        : String(v),
  }
  if (!extras.pivot) {
    // Kein dim2 gewaehlt — wie ein einfacher vertikaler Balken.
    const TOPN = 30
    let zeigen = daten
    if (daten.length > TOPN) {
      const top = daten.slice(0, TOPN)
      const rest = daten.slice(TOPN)
      const restSumme = rest.reduce((s, r) => s + r.wert, 0)
      zeigen = top.concat([{ name: `Sonstige (${rest.length})`,
        wert: restSumme }])
    }
    return {
      title: { text: `${wertTitel} nach ${achsTitel}`, left: "center" },
      tooltip: baseTooltip,
      grid: { left: 56, right: 24, top: 56, bottom: 100, containLabel: true },
      xAxis: { type: "category", data: zeigen.map((r) => r.name),
        axisLabel: { rotate: 35, fontSize: 11 } },
      yAxis: { type: "value",
        axisLabel: { formatter: (v) =>
          Math.round(v).toLocaleString("de-AT") } },
      series: [{ type: "bar", data: zeigen.map((r) => r.wert),
        itemStyle: { color: palette[0] } }],
    }
  }
  const { rowLabels, colLabels, matrix } = extras.pivot
  const series = colLabels.map((col, ci) => ({
    name: col,
    type: "bar",
    stack: "gesamt",
    emphasis: { focus: "series" },
    data: matrix.map((row) => row[ci]),
    itemStyle: { color: palette[ci % palette.length] },
  }))
  return {
    title: { text: `${wertTitel} nach ${achsTitel} (gestapelt nach ` +
      `${extras.dim2Titel || "Sekundaer"})`, left: "center" },
    tooltip: baseTooltip,
    legend: { type: "scroll", bottom: 0 },
    grid: { left: 56, right: 24, top: 56, bottom: 120, containLabel: true },
    xAxis: { type: "category", data: rowLabels,
      axisLabel: { rotate: 35, fontSize: 11 } },
    yAxis: { type: "value",
      axisLabel: { formatter: (v) =>
        Math.round(v).toLocaleString("de-AT") } },
    series,
  }
}

function builderEchartsOptionTreemap(daten, achsTitel, wertTitel, extras) {
  // Treemap: bei vorhandenem dim2 hierarchisch (primaere Gruppierung als
  // Eltern, sekundaere als Kinder). Ohne dim2: flach — Top-N Posten direkt
  // als Leaves. Treemap-Werte sind immer Math.abs, weil negative Flaechen
  // in einem Treemap nicht sinnvoll dargestellt werden koennen.
  const palette = builderChartPalette()
  const TOPN_FLAT = 30
  if (!extras.pivot) {
    const zeigen = daten.slice(0, TOPN_FLAT)
    return {
      title: { text: `${wertTitel} nach ${achsTitel}`, left: "center" },
      tooltip: {
        formatter: (info) => {
          const v = typeof info.value === "number" ? info.value : 0
          return `${info.name}<br/>` +
            `<strong>${Math.round(v).toLocaleString("de-AT")} €</strong>`
        },
      },
      series: [{
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        data: zeigen.map((r, i) => ({
          name: r.name,
          value: Math.abs(r.wert),
          itemStyle: { color: palette[i % palette.length] },
        })),
        label: { show: true, formatter: "{b}" },
      }],
    }
  }
  const { rowLabels, colLabels, matrix } = extras.pivot
  const wurzeln = rowLabels.map((row, ri) => {
    const kinder = colLabels.map((col, ci) => ({
      name: col,
      value: Math.abs(matrix[ri][ci]),
    })).filter((k) => k.value > 0)
    const summe = kinder.reduce((s, k) => s + k.value, 0)
    return {
      name: row,
      value: summe,
      itemStyle: { color: palette[ri % palette.length] },
      children: kinder,
    }
  }).filter((w) => w.value > 0)
  return {
    title: { text: `${wertTitel} nach ${achsTitel} → ` +
      `${extras.dim2Titel || "Sekundaer"}`, left: "center" },
    tooltip: {
      formatter: (info) => {
        const v = typeof info.value === "number" ? info.value : 0
        return `${info.name}<br/>` +
          `<strong>${Math.round(v).toLocaleString("de-AT")} €</strong>`
      },
    },
    series: [{
      type: "treemap",
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      data: wurzeln,
      levels: [
        { itemStyle: { gapWidth: 2 } },
        { itemStyle: { gapWidth: 1, borderWidth: 0 },
          colorSaturation: [0.3, 0.6] },
      ],
      label: { show: true, formatter: "{b}" },
      upperLabel: { show: true, height: 22, color: "#fff" },
    }],
  }
}

function builderEchartsOptionHeatmap(daten, achsTitel, wertTitel, extras) {
  // Heatmap: Matrix-Ansicht (primaere Gruppierung als y-Achse, sekundaere
  // als x-Achse, Zellwerte als Farbintensitaet). Braucht zwingend einen
  // Pivot mit zwei Dimensionen — ohne dim2 zeigt das Diagramm einen
  // erklaerenden Hinweis statt einer leeren Flaeche.
  if (!extras.pivot) {
    return {
      title: {
        text: "Heatmap benoetigt sekundaere Gruppierung",
        subtext: "Bitte ein Feld unter „Sekundaere Gruppierung“ waehlen.",
        left: "center",
        top: "center",
      },
    }
  }
  const { rowLabels, colLabels, matrix } = extras.pivot
  const daten2 = []
  let maxAbs = 0
  for (let r = 0; r < rowLabels.length; r++) {
    for (let c = 0; c < colLabels.length; c++) {
      const v = matrix[r][c]
      daten2.push([c, r, Math.round(v)])
      if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v)
    }
  }
  // Farbskala aus DS-Tokens: entsaettigte Oberflaeche -> Dunkelgruen.
  // Liefert eine ruhige, DS-konforme Skala statt der ECharts-Defaults.
  const root = document.documentElement
  const stil = root && typeof getComputedStyle === "function"
    ? getComputedStyle(root)
    : null
  const niedrig = (stil &&
    stil.getPropertyValue("--gat-web-surface-sunk").trim()) ||
    (stil && stil.getPropertyValue("--gat-web-surface").trim()) ||
    "#f4f1ec"
  const hoch = (stil &&
    stil.getPropertyValue("--gat-color-dunkelgruen").trim()) ||
    (stil && stil.getPropertyValue("--gat-web-chart-1").trim()) ||
    "#2c6e40"
  return {
    title: { text: `${wertTitel}: ${achsTitel} × ` +
      `${extras.dim2Titel || "Sekundaer"}`, left: "center" },
    tooltip: {
      position: "top",
      formatter: (info) => {
        const c = info.value[0]
        const r = info.value[1]
        const v = info.value[2]
        return `${rowLabels[r]}<br/>${colLabels[c]}<br/>` +
          `<strong>${Math.round(v).toLocaleString("de-AT")} €</strong>`
      },
    },
    grid: { left: 180, right: 24, top: 60, bottom: 120, containLabel: true },
    xAxis: { type: "category", data: colLabels,
      axisLabel: { rotate: 35, fontSize: 11 },
      splitArea: { show: true } },
    yAxis: { type: "category", data: rowLabels,
      axisLabel: { fontSize: 11 },
      splitArea: { show: true } },
    visualMap: {
      min: 0,
      max: maxAbs || 1,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 30,
      inRange: { color: [niedrig, hoch] },
      formatter: (v) =>
        typeof v === "number"
          ? Math.round(v).toLocaleString("de-AT")
          : String(v),
    },
    series: [{
      name: wertTitel,
      type: "heatmap",
      data: daten2,
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.3)" } },
    }],
  }
}

// --- Ausgaben-Drill: Treemap und Pie an den Text-Drill koppeln ----------- //
// Im Ausgaben-Tab existiert eine Text-Drill-Liste (`.drill-list` mit
// `.drill-crumbs`), die der Vendor (dashboard.js) ueber drei Ebenen pflegt:
// Aufgabengruppe -> Ansatz -> Posten. Treemap und Pie (`c_treemap`,
// `c_aufwandart`) sind heute statisch — die Treemap auf zwei Ebenen
// (gruppe -> ansatz aus agg.treemap), die Pie auf der Aufwandsart-
// Klassifikation (Personal/Sachaufwand/...).
//
// Dieser Sync koppelt beide Charts bidirektional an die Text-Drill:
//   - Klick auf Treemap-Zelle / Pie-Slice -> die passende `.drill-row`
//     wird programmatisch geklickt (Vendor pflegt den State).
//   - MutationObserver auf `.drill-crumbs` -> bei jeder Aenderung des
//     Crumbs-Markups re-rendert dieser Code beide Charts aus dem
//     aktuellen Drill-Scope (sichtbare drill-list-Rows).
//
// Damit ist die Verbindung in beide Richtungen tragend, ohne den
// Vendor-Code anzufassen. Die Drill-Tiefe spiegelt exakt die Text-Drill:
// Ebene 0 = Aufgabengruppen, Ebene 1 = Ansaetze, Ebene 2 = einzelne
// Posten (Konto/Bezeichnung).
function verdrahteAusgabenDrillSync() {
  if (!("MutationObserver" in window)) return
  const crumbsEl = document.getElementById("drill-crumbs")
  const listEl = document.getElementById("drill-list")
  if (!crumbsEl || !listEl) return

  function leseDrillTiefe() {
    // Anzahl `<button data-level="X" disabled>`-Eintraege mit X > 0 + 1
    // entspricht NICHT exakt — stattdessen: das hoechste data-level eines
    // disabled-Buttons gibt die Tiefe an. Wenn nur "data-level=0" disabled
    // ist, sind wir auf Ebene 0 (keine Drill-Auswahl); ist auch
    // data-level=1 disabled, dann auf Ebene 1; etc.
    const buttons = crumbsEl.querySelectorAll("button[data-level]")
    let tiefe = 0
    for (const b of buttons) {
      if (b.disabled) {
        const lvl = parseInt(b.dataset.level || "0", 10)
        if (lvl > tiefe) tiefe = lvl
      }
    }
    return tiefe
  }

  function leseDrillRows() {
    // Sichtbare Drill-Zeilen mit code/text/sum. sum ist im DOM nur
    // formatiert (Euro-String) verfuegbar — wir aggregieren neu aus
    // window.DATA.posten, weil die exakten Werte fuer das Chart noetig
    // sind. Die DOM-Rows definieren das Label-Set (code/text); die
    // Summen kommen aus den Posten, die zur aktuellen Drill-Auswahl
    // passen.
    return [...listEl.querySelectorAll("li.drill-row")].map((row) => {
      const codeEl = row.querySelector(".code")
      const labelEl = row.querySelector(".label")
      const code = row.dataset.code ||
        (codeEl ? codeEl.textContent.trim() : "") ||
        (labelEl ? labelEl.textContent.trim() : "")
      const text = row.dataset.text ||
        (labelEl
          ? labelEl.textContent.replace(/^\S+\s*/, "").trim()
          : "")
      return { code, text, row, klickbar: row.classList.contains("is-clickable") }
    })
  }

  function leseAktivesDok() {
    // dashboard.js setzt .switch-btn.is-active je Dokument; der Datawert
    // ist die Dokument-ID, mit der window.DATA.aggregate indexiert ist.
    const aktiv = document.querySelector(".switch-btn.is-active")
    return aktiv ? aktiv.dataset.dok : null
  }

  function sammlePostenAusgaben(dokId) {
    const alle = (window.DATA && window.DATA.posten) || []
    return alle.filter(
      (p) => String(p.dok) === String(dokId) &&
        p.richtung === "ausgabe" && p.ew > 0,
    )
  }

  function baueChartDaten() {
    const tiefe = leseDrillTiefe()
    const dokId = leseAktivesDok()
    if (!dokId) return null
    const rows = sammlePostenAusgaben(dokId)
    if (rows.length === 0) return null
    // Crumbs auslesen: bei Tiefe >= 1 ist drillPfad[0].code = aktive Gruppe.
    // Wir lesen den Code aus dem disabled-Button am Crumb-Index direkt.
    const crumbBtns = crumbsEl.querySelectorAll("button[data-level]")
    let aktiveGruppe = null
    let aktiverAnsatz = null
    if (tiefe >= 1 && crumbBtns[1]) {
      // Crumb auf Ebene 1 traegt den Text der gewaehlten Gruppe.
      // Code ist nicht direkt im Crumb, aber: alle Posten mit gruppe_text
      // = label finden den Code; einfacher den Code aus den .drill-row-
      // data-Attributen ziehen, falls die Auswahl auf Ebene 1 = Ansaetze
      // einer Gruppe gerendert ist.
      // Fallback: ueber den Text-Vergleich mit gruppe_text.
      const text = crumbBtns[1].textContent.trim()
      for (const p of rows) {
        if (p.gruppe_text === text) { aktiveGruppe = p.gruppe; break }
      }
    }
    if (tiefe >= 2 && crumbBtns[2]) {
      const text = crumbBtns[2].textContent.trim()
      for (const p of rows) {
        if (p.ansatz_text === text) { aktiverAnsatz = p.ansatz; break }
      }
    }
    // Filter auf den aktuellen Scope einschraenken.
    let scope = rows
    if (aktiveGruppe) scope = scope.filter((p) => p.gruppe === aktiveGruppe)
    if (aktiverAnsatz) scope = scope.filter((p) => p.ansatz === aktiverAnsatz)
    // Aggregation je Ebene.
    const eimer = new Map()
    for (const p of scope) {
      let key, label
      if (tiefe === 0) {
        key = p.gruppe
        label = p.gruppe_text || ("Gruppe " + p.gruppe)
      } else if (tiefe === 1) {
        key = p.ansatz
        label = p.ansatz_text || ("Ansatz " + p.ansatz)
      } else {
        // Auf Ebene 2 = einzelne Posten; Bezeichnung als Schluessel
        // (gleichnamige Bezeichnung waere ungewoehnlich; konto waere
        // technischer, aber Klick muss zur Drill-Row matchen — Vendor
        // erzeugt die letzte Ebene auf Basis von p.konto als code und
        // p.bezeichnung als text).
        key = p.konto
        label = p.bezeichnung || ("Konto " + p.konto)
      }
      if (!key) continue
      const e = eimer.get(key)
      if (e) e.wert += p.ew
      else eimer.set(key, { code: key, label, wert: p.ew })
    }
    const liste = [...eimer.values()].sort((a, b) => b.wert - a.wert)
    return { tiefe, items: liste }
  }

  // Aktive Theme-Palette lesen (Themes werden in einem spaeteren Commit
  // eingefuehrt). Hier defensiv: Fallback auf entsaettigte Defaults, falls
  // window.__chartTheme noch nicht existiert.
  function holePalette() {
    const t = (typeof window !== "undefined") && window.__chartTheme
    if (t && Array.isArray(t.palette) && t.palette.length) return t.palette
    return ["#3f7d4f", "#c9a24b", "#4f93a0", "#b9744f", "#6ba368",
      "#9c5b7d", "#5d6b8a", "#8a8f7d", "#a7c4a3", "#c9a98c"]
  }

  function rendereTreemap(daten) {
    const el = document.getElementById("c_treemap")
    if (!el || !window.echarts) return
    const inst = window.echarts.getInstanceByDom(el)
    if (!inst) return
    const palette = holePalette()
    const knoten = daten.items.map((it, i) => ({
      name: it.label,
      value: Math.abs(it.wert),
      itemStyle: { color: palette[i % palette.length] },
    }))
    inst.setOption({
      tooltip: {
        trigger: "item",
        formatter: (info) =>
          `${info.name}<br/><strong>${
            Math.round(info.value).toLocaleString("de-AT")} €</strong>`,
      },
      series: [{
        type: "treemap",
        data: knoten,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        top: 6, bottom: 6, left: 6, right: 6,
        label: { show: true, formatter: "{b}" },
      }],
    }, true)
  }

  function renderePie(daten) {
    const el = document.getElementById("c_aufwandart")
    if (!el || !window.echarts) return
    const inst = window.echarts.getInstanceByDom(el)
    if (!inst) return
    const palette = holePalette()
    // Top-N + Sonstige, damit ein Pie mit 60 Konten nicht zu einem
    // Konfetti-Stern wird. Bei tiefer Drill-Ebene helfen Top 10.
    const TOPN = 10
    const top = daten.items.slice(0, TOPN)
    const rest = daten.items.slice(TOPN)
    const restSumme = rest.reduce((s, r) => s + r.wert, 0)
    const slices = top.map((it, i) => ({
      name: it.label,
      value: Math.abs(it.wert),
      itemStyle: { color: palette[i % palette.length] },
    }))
    if (restSumme > 0) {
      slices.push({
        name: `Sonstige (${rest.length})`,
        value: Math.abs(restSumme),
        itemStyle: { color: palette[TOPN % palette.length] },
      })
    }
    inst.setOption({
      tooltip: {
        trigger: "item",
        formatter: (info) =>
          `${info.name}<br/><strong>${
            Math.round(info.value).toLocaleString("de-AT")} €</strong> ` +
          `(${info.percent} %)`,
      },
      legend: { type: "scroll", bottom: 0 },
      series: [{
        type: "pie",
        radius: ["42%", "70%"],
        center: ["50%", "44%"],
        padAngle: 2,
        itemStyle: { borderRadius: 3 },
        data: slices,
        label: { formatter: "{b}: {d}%" },
      }],
    }, true)
  }

  function rendereBeide() {
    const daten = baueChartDaten()
    if (!daten) return
    rendereTreemap(daten)
    renderePie(daten)
  }

  function triggereDrillRowKlick(code) {
    // Vendor reagiert auf clicks auf `.drill-row.is-clickable`; setzt das
    // drillPfad-Array und re-rendered drill-list/drill-crumbs. Wir suchen
    // die passende Zeile per data-code (=`p.gruppe` auf Ebene 0,
    // `p.ansatz` auf Ebene 1). Auf Ebene 2 sind die Zeilen nicht klickbar
    // (letzte Drill-Ebene).
    const row = listEl.querySelector(
      `li.drill-row.is-clickable[data-code="${cssEscape(code)}"]`,
    )
    if (row) row.click()
  }

  function cssEscape(s) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(s)
    }
    return String(s).replace(/(["\\\]\[])/g, "\\$1")
  }

  function haengeChartKlickHandler(elId, baueItemsCallback) {
    const el = document.getElementById(elId)
    if (!el || !window.echarts) return
    const inst = window.echarts.getInstanceByDom(el)
    if (!inst) return
    inst.off("click")
    inst.on("click", (param) => {
      const items = baueItemsCallback()
      if (!items) return
      // Param.name traegt das Label; mit dem Label finden wir den Code
      // (Items werden parallel im DOM gerendert, gleicher Order).
      const treffer = items.items.find((it) => it.label === param.name)
      if (treffer) triggereDrillRowKlick(treffer.code)
    })
  }

  // Initial-Render und Observer; aber erst nachdem das Dashboard
  // aufgebaut ist und die Charts ECharts-Instanzen haben. dashboard.js
  // setzt setupSankeyDrill am Ende — `__sankeyDrill` als Bereitschafts-
  // Signal nutzen.
  function starte() {
    rendereBeide()
    haengeChartKlickHandler("c_treemap", baueChartDaten)
    haengeChartKlickHandler("c_aufwandart", baueChartDaten)
    const beobachter = new MutationObserver(() => {
      // Bei jeder Aenderung der Crumbs (drill-Tiefe gewechselt) oder
      // der Liste (Inhalte gewechselt) beide Charts neu zeichnen.
      rendereBeide()
      // Click-Handler nach setOption neu registrieren — ECharts haengt
      // bei einigen Versionen Handler beim setOption(true) ab.
      haengeChartKlickHandler("c_treemap", baueChartDaten)
      haengeChartKlickHandler("c_aufwandart", baueChartDaten)
    })
    beobachter.observe(crumbsEl, { childList: true, subtree: true })
    beobachter.observe(listEl, { childList: true })
  }

  // Auf das fertige Dashboard warten — dashboard.js expose `__sankeyDrill`
  // ganz am Ende. Helpers.mjs der E2E-Tests nutzt dasselbe Signal.
  // Wenn nach 30 s kein Dashboard aufgebaut ist (kein PDF geladen), still
  // aufhoeren — der Drill-Sync ist nur im geladenen Dashboard relevant.
  let warteSekunden = 0
  function wartenAufBereit() {
    if (typeof window.__sankeyDrill === "function") {
      starte()
      return
    }
    warteSekunden += 0.05
    if (warteSekunden > 30) return
    setTimeout(wartenAufBereit, 50)
  }
  wartenAufBereit()

  if (typeof window !== "undefined") {
    window.__ausgabenDrillSync = {
      rendereBeide,
      baueChartDaten,
      leseDrillTiefe,
    }
  }
}

function verdrahteBuilder() {
  const btn = document.getElementById("builder-render")
  if (!btn) return
  const meta = document.getElementById("builder-meta")
  const host = document.getElementById("builder-chart-host")
  const chartEl = document.getElementById("c_builder")
  const typEl = document.getElementById("builder-typ")
  const dimEl = document.getElementById("builder-dim")
  const wertEl = document.getElementById("builder-wert")
  const aggEl = document.getElementById("builder-agg")
  const stackEl = document.getElementById("builder-stack")
  const stackWrap = document.getElementById("builder-stack-wrap")
  if (!chartEl || !typEl) return

  // Sekundaere Gruppierung nur fuer Diagrammtypen sichtbar, die sie
  // brauchen (gestapelte Balken, Treemap, Heatmap). Bei den uebrigen
  // Typen bleibt das Feld per [hidden]-Attribut ausgeblendet, damit der
  // Builder schlank bleibt.
  function toggleStackSichtbar() {
    if (!stackWrap) return
    stackWrap.hidden = !BUILDER_TYPEN_MIT_DIM2.has(typEl.value)
  }
  toggleStackSichtbar()

  // ECharts-Instanz erst beim ersten Render anlegen, damit das Layout
  // korrekte Pixel-Werte hat. Spaetere Renders nutzen dieselbe Instanz.
  let inst = null

  function render() {
    const echartsRef = window.echarts
    if (!echartsRef) {
      toast("ECharts noch nicht geladen — bitte gleich nochmal versuchen.",
        "warn")
      return
    }
    const alle = (window.DATA && window.DATA.posten) || []
    if (alle.length === 0) {
      toast("Keine Daten — bitte zuerst ein Dokument hochladen.", "warn")
      return
    }
    const gefiltert = alle.filter(builderFiltereMatch)
    if (gefiltert.length === 0) {
      meta.textContent = "Keine Posten in der aktuellen Filtermenge — " +
        "Filter im Suche-Tab anpassen."
      return
    }
    const dim = dimEl.value
    const wert = wertEl.value
    const agg = aggEl.value
    const typ = typEl.value
    const dim2 = stackEl ? stackEl.value : ""
    const daten = builderAggregiere(gefiltert, dim, wert, agg)
    if (daten.length === 0) {
      meta.textContent = "Keine Kategorien in der Filtermenge — " +
        "andere Gruppierung waehlen."
      return
    }
    // Pivot nur dann bauen, wenn der Diagrammtyp dim2 nutzt und der User
    // ein Feld ausgewaehlt hat. Pivot kann teuer sein bei vielen Posten.
    let pivot = null
    if (BUILDER_TYPEN_MIT_DIM2.has(typ) && dim2 && dim2 !== dim) {
      pivot = builderPivot(gefiltert, dim, dim2, wert, agg)
    }
    host.hidden = false
    if (!inst) {
      inst = echartsRef.init(chartEl)
    }
    const wertTitel = agg === "anzahl"
      ? "Anzahl Posten"
      : `${BUILDER_WERT_LABELS[wert] || wert} (${agg})`
    const achsTitel = BUILDER_DIM_LABELS[dim] || dim
    const dim2Titel = dim2 ? (BUILDER_DIM_LABELS[dim2] || dim2) : ""
    inst.setOption(builderEchartsOption(typ, daten, achsTitel, wertTitel,
      { pivot, dim2Titel }), true)
    inst.resize()
    const dim2Hinweis = pivot
      ? ` × ${pivot.colLabels.length} ${dim2Titel}-Kategorien`
      : ""
    meta.innerHTML = "<strong>" + gefiltert.length + "</strong> Posten in " +
      daten.length + " " + achsTitel + "-Kategorien" + dim2Hinweis
  }

  btn.addEventListener("click", render)
  // Bei Aenderung der Dropdowns automatisch neu rendern, sobald die
  // Instanz schon existiert (nicht beim ersten Laden, bevor der User
  // bewusst auf "Erstellen" geklickt hat).
  const inputs = [typEl, dimEl, wertEl, aggEl]
  if (stackEl) inputs.push(stackEl)
  for (const el of inputs) {
    el.addEventListener("change", () => {
      if (el === typEl) toggleStackSichtbar()
      if (inst) render()
    })
  }

  // Resize-Forwarding: bei Tab-Wechseln triggert dashboard.js ein resize,
  // aber unsere Instanz haengt erst beim ersten Render. Ein eigener
  // Resize-Hoerer faengt Layoutaenderungen.
  window.addEventListener("resize", () => {
    if (inst) inst.resize()
  })

  if (typeof window !== "undefined") {
    window.__builder = {
      builderAggregiere,
      builderFiltereMatch,
      builderPivot,
      builderBerechneAgg,
      berechneMedian,
      render,
      getInstance: () => inst,
    }
  }
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
