// Oberflaeche des Vergleichs-Tabs — Auswahl, Kennzahlen, Diagramme, Tabelle.
//
// Die Rechnung liegt vollstaendig in vergleich-daten.js, die Diagrammoptionen
// in dashboard-charts.js. Dieses Modul haelt nur den Zustand der Bedienung
// (Basis, Vergleich, Haushaltshaelfte, Filter, Sortierung) und schreibt ins
// DOM.
//
// baueVergleich(daten) ist mehrfach aufrufbar: nach jedem Upload und bei jedem
// Palettenwechsel baut app.js das ganze Dashboard neu. Die Auswahl des Users
// bleibt dabei erhalten, solange die gewaehlten Dokumente noch existieren.
//
// Der Tab arbeitet absichtlich **unabhaengig** vom globalen Dokument-
// Umschalter: dieser steuert die uebrigen Tabs, hier stehen zwei Dokumente
// gleichzeitig zur Wahl. Ein Umschalter mit zwei Bedeutungen waere in beiden
// Rollen unklar.

import {
  baueDiff,
  filtereZeilen,
  alsCsv,
  BASIS_INTERN,
  interneBasisLabel,
  hatVergleichsspalte,
} from "./vergleich-daten.js"
import {
  chartDiffWasserfall,
  chartDiffGruppen,
  chartDiffTreemap,
} from "./dashboard-charts.js"

// Mehr Zeilen als das nuetzt keiner mehr — wie im Suche-Tab.
const LIMIT = 500

// Zustand der Bedienung. Ueberlebt einen Neuaufbau des Dashboards.
// `a` traegt entweder eine Dokument-Id ODER den Sentinel BASIS_INTERN —
// kein zweites Zustandsfeld, sonst gibt es zwei Quellen fuer einen Zustand.
const zustand = {
  a: null,
  b: null,
  haushalt: "EHH",
  sortKey: "delta",
  sortAbsteigend: true,
  verdrahtet: false,
}

let daten = null
let diff = null
// ECharts-Instanzen je Div — nicht neu initialisieren, sonst haengen nach
// einem Neuaufbau zwei Instanzen am selben Element.
const charts = {}

const STATUS_TEXT = {
  neu: "neu",
  entfallen: "entfallen",
  geaendert: "betragsgeaendert",
  unveraendert: "unveraendert",
}

// --- Formatierung --------------------------------------------------------- //
function euro(v) {
  return `${Math.round(v).toLocaleString("de-AT")} €`
}

function euroVz(v) {
  const g = Math.round(v)
  return `${g > 0 ? "+" : ""}${g.toLocaleString("de-AT")} €`
}

function prozentVz(p) {
  if (p === null || p === undefined || !isFinite(p)) return ""
  const g = Math.round(p * 10) / 10
  return `${g > 0 ? "+" : ""}${g.toLocaleString("de-AT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`
}

function el(id) {
  return document.getElementById(id)
}

function text(id, wert) {
  const e = el(id)
  if (e) e.textContent = wert
}

function dokument(id) {
  return (daten.dokumente || []).find((d) => String(d.id) === String(id))
}

// Klartext eines Dokuments fuer Auswahllisten und Kopfzeilen: Kurzlabel und,
// wenn vermerkt, die Fassung. Die Bedeutung der Betragsspalte steht nicht
// hier, sondern einmal in der Kopfzeile — "NVA 2026 · VA 2026 inkl. NVA"
// liest sich sonst wie zwei Dokumente.
function dokLang(d) {
  if (!d) return ""
  return d.fassung ? `${d.label} (${d.fassung})` : d.label
}

// Beschriftung der Basis-Seite — eine Regel, ein Ort. `lang` haengt im
// Zwei-Dokumente-Fall die Fassung an (Kopfzeile); ueberall sonst bleibt es
// beim Kurzlabel (Tabellenkopf, Karten, Achse, CSV). Laufen diese Stellen
// auseinander, ist genau der Unterschied verdeckt, den das Issue sichtbar
// machen will: "VA 2026 (laut NVA)" gegen ein separat geladenes "VA 2026".
function basisLabel(lang = false) {
  if (String(zustand.a) === BASIS_INTERN) {
    return interneBasisLabel(dokument(zustand.b))
  }
  const dA = dokument(zustand.a)
  if (!dA) return "Basis"
  return lang ? dokLang(dA) : dA.label
}

// Die Betragsspalte der Basis fuer den Erklaersatz der Kopfzeile.
function basisSpalte() {
  const dB = dokument(zustand.b)
  if (String(zustand.a) === BASIS_INTERN) {
    return dB ? `${dB.spalte_vergleich} (abgedruckt im ${dB.label})` : ""
  }
  const dA = dokument(zustand.a)
  return dA ? dA.spalte_wert : ""
}

// --- Aufbau --------------------------------------------------------------- //
export function baueVergleich(datenNeu) {
  daten = datenNeu
  const wrap = el("vgl-a")
  if (!wrap) return

  // Vergleichbar ist: zwei Dokumente gegeneinander — oder ein Dokument, das
  // seine Vergleichszahl selbst abdruckt. Die Pruefung geht ueber die DATEN
  // (ev/fv), nicht ueber den Typ: ein OH-CSV-Dokument traegt den
  // Spaltennamen, aber keine Werte (csv-parser.js:330-333). Am Typ gemessen
  // entstuenden dort still ueber 1000 Zeilen "neu" gegen eine Basis von 0.
  const docs = daten.dokumente || []
  const vergleichbar =
    docs.length >= 2 ||
    docs.some((d) => hatVergleichsspalte(daten.posten, d.id))
  const panel = document.querySelector('[data-panel="vergleich"]')
  const tabBtn = document.querySelector('.tab-btn[data-tab="vergleich"]')
  if (tabBtn) tabBtn.hidden = !vergleichbar
  if (panel) {
    panel.querySelectorAll(".gat-panel, .stats, .gat-callout").forEach((n) => {
      n.hidden = !vergleichbar
    })
    const hinweis = panel.querySelector(".vgl-leer")
    if (!vergleichbar && !hinweis) {
      const p = document.createElement("p")
      p.className = "vgl-leer"
      p.textContent =
        "Fuer einen Vergleich braucht es entweder ein zweites Dokument " +
        "oder eines, das seine Vergleichszahl selbst abdruckt — eine " +
        "OH-CSV traegt zwar den Spaltennamen, aber keine Vergleichszahl."
      panel.appendChild(p)
    } else if (vergleichbar && hinweis) {
      hinweis.remove()
    }
  }
  if (!vergleichbar) return

  fuelleAuswahl()
  fuelleGruppenFilter()
  if (!zustand.verdrahtet) {
    verdrahte()
    zustand.verdrahtet = true
  }
  rechneUndZeichne()
}

// Basis und Vergleich mit allen Dokumenten fuellen; Vorbelegung aus
// meta.default_vergleich, sofern der User noch nichts gewaehlt hat. `#vgl-a`
// bekommt zusaetzlich einen internen Eintrag, solange das gewaehlte `b`
// eine gefuellte Vergleichsspalte fuehrt; `#vgl-b` bleibt eine reine
// Dokumentliste.
function fuelleAuswahl() {
  const docs = daten.dokumente
  const istDok = (id) => docs.some((d) => String(d.id) === String(id))
  // Der interne Eintrag gehoert zum gewaehlten Vergleichsdokument: gueltig
  // nur, solange dieses ueberhaupt Zahlen in seiner zweiten Spalte fuehrt.
  const internMoeglich = () =>
    istDok(zustand.b) && hatVergleichsspalte(daten.posten, zustand.b)
  const gueltigA = (id) => (id === BASIS_INTERN ? internMoeglich() : istDok(id))

  if (!gueltigA(zustand.a) || !istDok(zustand.b) || zustand.a === zustand.b) {
    const v = daten.meta.default_vergleich
    if (v) {
      zustand.a = v.a
      zustand.b = v.b
    } else if (docs.length >= 2) {
      zustand.a = docs[docs.length - 2].id
      zustand.b = docs[docs.length - 1].id
    } else {
      // Nur ein Dokument, keine Vorbelegung aus den Daten (theoretisch nur
      // moeglich, wenn es weder ein Paar noch eine gefuellte Spalte 2 hat) —
      // ohne diesen Zweig griffe docs[docs.length - 2] ins Leere.
      zustand.b = docs[docs.length - 1].id
      zustand.a = BASIS_INTERN
    }
  }

  const selA = el("vgl-a")
  selA.innerHTML = ""
  if (internMoeglich()) {
    const o = document.createElement("option")
    o.value = BASIS_INTERN
    o.textContent = interneBasisLabel(dokument(zustand.b))
    o.title =
      "Die im Vergleichsdokument selbst abgedruckte Vergleichsspalte — " +
      "keine separat geladene Datei."
    selA.appendChild(o)
  }
  for (const d of docs) {
    const o = document.createElement("option")
    o.value = String(d.id)
    o.textContent = d.label
    o.title = dokLang(d)
    selA.appendChild(o)
  }
  selA.value = String(zustand.a)

  const selB = el("vgl-b")
  selB.innerHTML = ""
  for (const d of docs) {
    const o = document.createElement("option")
    o.value = String(d.id)
    o.textContent = d.label
    o.title = dokLang(d)
    selB.appendChild(o)
  }
  selB.value = String(zustand.b)

  el("vgl-hh").value = zustand.haushalt
}

function fuelleGruppenFilter() {
  const sel = el("vgl-f-gruppe")
  if (!sel) return
  const vorher = sel.value
  const gruppen = new Map()
  for (const p of daten.posten) {
    if (p.gruppe && !gruppen.has(p.gruppe)) gruppen.set(p.gruppe, p.gruppe_text)
  }
  sel.innerHTML = '<option value="">alle</option>'
  for (const g of [...gruppen.keys()].sort()) {
    const o = document.createElement("option")
    o.value = g
    o.textContent = `${g} — ${gruppen.get(g)}`
    sel.appendChild(o)
  }
  sel.value = vorher
}

function verdrahte() {
  el("vgl-a").addEventListener("change", (ev) => {
    zustand.a = ev.target.value
    rechneUndZeichne()
  })
  el("vgl-b").addEventListener("change", (ev) => {
    zustand.b = ev.target.value
    // Das Label des internen Eintrags haengt an b, und bei einem b ohne
    // Vergleichsspalte muss der Eintrag verschwinden — die Auswahl also
    // neu bauen, bevor gerechnet wird.
    fuelleAuswahl()
    rechneUndZeichne()
  })
  el("vgl-hh").addEventListener("change", (ev) => {
    zustand.haushalt = ev.target.value
    rechneUndZeichne()
  })
  el("vgl-tausch").addEventListener("click", () => {
    const a = zustand.a
    zustand.a = zustand.b
    zustand.b = a
    el("vgl-a").value = String(zustand.a)
    el("vgl-b").value = String(zustand.b)
    rechneUndZeichne()
  })

  // Filter aendern nur die Tabelle — der Diff bleibt stehen.
  for (const id of [
    "vgl-f-such",
    "vgl-f-gruppe",
    "vgl-f-richtung",
    "vgl-f-gebarung",
    "vgl-f-status",
    "vgl-f-schwelle",
  ]) {
    const e = el(id)
    if (!e) continue
    e.addEventListener(e.tagName === "SELECT" ? "change" : "input", zeichneTabelle)
  }

  // Sortierung ueber die Kopfzeilen.
  const kopf = document.querySelector('[data-panel="vergleich"] thead')
  if (kopf) {
    kopf.addEventListener("click", (ev) => {
      const th = ev.target.closest("th[data-vkey]")
      if (!th) return
      const key = th.dataset.vkey
      if (zustand.sortKey === key) {
        zustand.sortAbsteigend = !zustand.sortAbsteigend
      } else {
        zustand.sortKey = key
        // Zahlen absteigend zuerst (das Grosse interessiert), Text aufsteigend.
        zustand.sortAbsteigend = ["a", "b", "delta", "prozent"].includes(key)
      }
      zeichneTabelle()
    })
  }

  el("vgl-csv").addEventListener("click", ladeCsv)

  // ECharts kennt die Groesse eines Diagramms erst, wenn das Panel sichtbar
  // ist — beim Wechsel auf diesen Tab neu vermessen. dashboard.js kuemmert
  // sich nur um die dort registrierten Charts.
  const tabs = document.querySelector(".tabs")
  if (tabs) {
    tabs.addEventListener("click", (ev) => {
      const btn = ev.target.closest('.tab-btn[data-tab="vergleich"]')
      if (btn) requestAnimationFrame(passeGroesseAn)
    })
  }
  window.addEventListener("resize", passeGroesseAn)
}

function passeGroesseAn() {
  for (const k of Object.keys(charts)) {
    const e = document.getElementById(k)
    if (e && e.offsetParent !== null) charts[k].resize()
  }
}

// Diff rechnen und alles zeichnen. Laeuft bei jeder Aenderung der Auswahl.
function rechneUndZeichne() {
  // Der Sentinel ist nie ein Dokument und braucht die Ausweichlogik nicht —
  // docs[i > 0 ? ... ] faende dort ohnehin kein "gleiches" Dokument.
  if (
    String(zustand.a) !== BASIS_INTERN &&
    String(zustand.a) === String(zustand.b)
  ) {
    const docs = daten.dokumente
    // Gleiche Auswahl auf beiden Seiten ergibt einen leeren Diff — auf das
    // Nachbardokument ausweichen, statt eine leere Ansicht zu zeigen.
    const i = docs.findIndex((d) => String(d.id) === String(zustand.b))
    const ersatz = docs[i > 0 ? i - 1 : Math.min(1, docs.length - 1)]
    zustand.a = ersatz.id
    el("vgl-a").value = String(zustand.a)
  }
  diff = baueDiff(daten.posten, daten.dokumente, {
    a: zustand.a,
    b: zustand.b,
    haushalt: zustand.haushalt,
  })
  zeichneKopf()
  zeichneKennzahlen()
  zeichneKontrolle()
  zeichneCharts()
  zeichneTabelle()

  // Der Sentinel darf nie in b landen: aggregiereDokument(posten, "intern",
  // hh) liefert sonst still eine leere Ansicht, ohne Fehlermeldung.
  const tausch = el("vgl-tausch")
  if (tausch) {
    const intern = String(zustand.a) === BASIS_INTERN
    tausch.disabled = intern
    tausch.title = intern
      ? "Im dokumentinternen Vergleich nicht moeglich — die abgedruckte " +
        "Spalte ist immer die Basis."
      : ""
  }
}

function zeichneKopf() {
  const dB = dokument(zustand.b)
  const hh =
    diff.haushalt === "FHH" ? "Finanzierungshaushalt" : "Ergebnishaushalt"
  const kopf = el("vgl-kopf")
  if (kopf) {
    kopf.innerHTML =
      `<strong>Basis ${escapeHtml(basisLabel(true))}</strong> → ` +
      `<strong>Vergleich ${escapeHtml(dokLang(dB))}</strong> · ${hh} · ` +
      `${diff.status.gesamt.toLocaleString("de-AT")} Haushaltsstellen<br>` +
      `Gegenuebergestellt werden die Betragsspalten ` +
      `„${escapeHtml(basisSpalte())}" und ` +
      `„${escapeHtml(dB ? dB.spalte_wert : "")}".`
  }
  const thA = el("vgl-th-a")
  const thB = el("vgl-th-b")
  if (thA) thA.firstChild.textContent = basisLabel()
  if (thB) thB.firstChild.textContent = dB ? dB.label : "Vergleich"

  const s = diff.status
  text(
    "vgl-statuszeile",
    `${s.veraendert.toLocaleString("de-AT")} von ` +
      `${s.gesamt.toLocaleString("de-AT")} Haushaltsstellen veraendert — ` +
      `${s.neu} neu, ${s.entfallen} entfallen, ` +
      `${s.geaendert} betragsgeaendert, ` +
      `${s.unveraendert.toLocaleString("de-AT")} unveraendert.`,
  )
}

// Kennzahlen-Karten. Die Karten baut dieses Modul, weil ihre Anzahl von der
// Haushaltshaelfte abhaengt (Ergebnishaushalt drei, Finanzierungshaushalt
// vier).
function zeichneKennzahlen() {
  const ziel = el("vgl-stats")
  if (!ziel) return
  const dB = dokument(zustand.b)
  ziel.innerHTML = ""
  for (const k of diff.eckwerte) {
    // Faerbung nach fachlicher Bedeutung: bei Ertraegen ist ein Plus eine
    // gute Nachricht, bei Aufwendungen ein Minus. Wo das nicht eindeutig
    // ist (investive Auszahlungen), bleibt die Zeile neutral.
    let klasse = "vgl-karte__delta"
    if (k.gut !== "neutral" && k.delta !== 0) {
      const gut = k.gut === "auf" ? k.delta > 0 : k.delta < 0
      klasse += gut ? " is-up" : " is-down"
    }
    const karte = document.createElement("div")
    karte.className = "stat gat-metric-card vgl-karte"
    karte.innerHTML =
      `<div class="gat-metric-card__label">${k.titel}</div>` +
      `<div class="gat-metric-card__num">${euroVz(k.delta)}</div>` +
      `<div class="${klasse}">${prozentVz(k.prozent)}</div>` +
      `<div class="vgl-karte__basis">` +
      `${basisLabel()}: ${euro(k.a)}<br>` +
      `${dB ? dB.label : "Vergleich"}: ${euro(k.b)}</div>`
    ziel.appendChild(karte)
  }
}

function zeichneKontrolle() {
  const panel = el("vgl-kontrolle-panel")
  const body = el("vgl-kontrolle")
  if (!panel || !body) return
  const k = diff.kontrolle
  if (!k) {
    panel.hidden = true
    return
  }
  panel.hidden = false
  // Interner Modus (CONTEXT.md D1): die Basis IST die abgedruckte Spalte —
  // eine Gegenprobe gegen sich selbst belegt nichts. Statt "Geprueft" nennt
  // das Panel, wodurch die Kontrolle ausgeloest wird.
  if (k.modus === "intern") {
    const a = k.ausloeser
    body.innerHTML =
      `<p class="vgl-pruef">` +
      `Die Basis <strong>ist</strong> die im ${escapeHtml(k.dokument)} ` +
      `selbst abgedruckte Spalte „${escapeHtml(k.spalte)}" — eine ` +
      `Gegenprobe gegen sich selbst belegt nichts. Die Kontrolle laeuft, ` +
      `sobald oben als Basis das geladene Dokument ` +
      `„${escapeHtml(a.label)}" gewaehlt wird` +
      (a.geladen
        ? "; es ist bereits geladen."
        : ` — dafuer muesste „${escapeHtml(a.label)}" erst geladen werden.`) +
      `</p>`
    return
  }
  const dA = dokument(zustand.a)
  if (k.bestanden) {
    body.innerHTML =
      `<p class="vgl-pruef is-ok"><strong>Geprueft.</strong> ` +
      `Alle ${k.geprueft.toLocaleString("de-AT")} belegbaren ` +
      `Haushaltsstellen der Basis stimmen mit der Spalte ` +
      `„${escapeHtml(k.spalte)}" des Vergleichsdokuments ueberein` +
      (k.ohne_beleg
        ? `; ${k.ohne_beleg} Stellen fuehrt das Vergleichsdokument nicht und ` +
          "sind deshalb nicht belegbar."
        : ".") +
      `</p>`
    return
  }
  const zeilen = k.abweichungen
    .slice(0, 12)
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.gruppe)}</td>` +
        `<td>${escapeHtml(r.ansatz)}</td>` +
        `<td>${escapeHtml(r.konto)}</td>` +
        `<td>${escapeHtml(r.bezeichnung)}</td>` +
        `<td>${escapeHtml(r.richtung)}</td>` +
        `<td class="num gat-table__num">${euro(r.basis)}</td>` +
        `<td class="num gat-table__num">${euro(r.abgedruckt)}</td>` +
        `<td class="num gat-table__num">${euroVz(r.abweichung)}</td></tr>`,
    )
    .join("")
  body.innerHTML =
    `<p class="vgl-pruef is-warn"><strong>` +
    `${k.abweichungen.length.toLocaleString("de-AT")} Abweichung` +
    `${k.abweichungen.length === 1 ? "" : "en"} ` +
    `(${euro(k.summeAbweichung)} absolut)</strong> zwischen dem geladenen ` +
    `Basisdokument und der Spalte „${escapeHtml(k.spalte)}" des Vergleichsdokuments — ` +
    `${k.geprueft.toLocaleString("de-AT")} Stellen geprueft. ` +
    `Das geladene Basisdokument ist damit nicht die Fassung, gegen die das ` +
    `Vergleichsdokument rechnet` +
    (dA && dA.fassung ? ` (geladen: ${escapeHtml(dA.fassung)})` : "") +
    `. Der Diff unten rechnet gegen das <em>geladene</em> Dokument; fuer ` +
    `die Sicht des Vergleichsdokuments waere die andere Fassung der Basis ` +
    `zu laden.</p>` +
    `<div class="table-scroll gat-table-scroll">` +
    `<table class="dtable gat-table gat-table--zebra gat-table--dense">` +
    `<thead><tr><th>Gruppe</th><th>Ansatz</th><th>Konto</th>` +
    `<th>Bezeichnung</th><th>Richtung</th>` +
    `<th class="num gat-table__num">geladene Basis</th>` +
    `<th class="num gat-table__num">abgedruckt</th>` +
    `<th class="num gat-table__num">Abweichung</th></tr></thead>` +
    `<tbody>${zeilen}</tbody></table></div>` +
    (k.abweichungen.length > 12
      ? `<p class="table-hint">Nur die ${12} groessten von ` +
        `${k.abweichungen.length} Abweichungen gezeigt.</p>`
      : "")
}

function zeichneCharts() {
  const dB = dokument(zustand.b)
  zeichneChart(
    "c_vgl_wasserfall",
    chartDiffWasserfall(diff, basisLabel(), dB ? dB.label : "Vergleich"),
  )
  zeichneChart("c_vgl_treemap", chartDiffTreemap(diff))
  zeichneChart("c_vgl_gruppen", chartDiffGruppen(diff))
}

// Ein Diagramm setzen. Die Optionen enthalten Formatter als
// "(...)=>..."-Strings (wie im uebrigen Dashboard) — die werden hier
// zurueckverwandelt.
function zeichneChart(divId, option) {
  const e = document.getElementById(divId)
  if (!e || typeof echarts === "undefined") return
  let inst = charts[divId]
  if (!inst) {
    inst = echarts.getInstanceByDom(e) || echarts.init(e)
    charts[divId] = inst
  }
  try {
    inst.setOption(revive(option), true)
  } catch (err) {
    // Ein einzelnes Diagramm darf die Tabelle und die Kennzahlen nicht
    // mitnehmen — wie im uebrigen Dashboard nur in die Konsole.
    if (typeof console !== "undefined" && console.error) {
      console.error(`Diagramm '${divId}' konnte nicht gerendert werden:`, err)
    }
  }
}

// Formatter-Strings in echte Funktionen zurueckwandeln — dieselbe Konvention
// wie revive() in dashboard.js.
function revive(o) {
  if (Array.isArray(o)) return o.map(revive)
  if (o && typeof o === "object") {
    const r = {}
    for (const k in o) r[k] = revive(o[k])
    return r
  }
  if (typeof o === "string" && /^\(.*\)\s*=>/.test(o)) {
    try {
      // eslint-disable-next-line no-eval
      return eval(o)
    } catch (e) {
      return o
    }
  }
  return o
}

// --- Tabelle -------------------------------------------------------------- //
function aktuelleFilter() {
  return {
    suche: el("vgl-f-such") ? el("vgl-f-such").value : "",
    gruppe: el("vgl-f-gruppe") ? el("vgl-f-gruppe").value : "",
    richtung: el("vgl-f-richtung") ? el("vgl-f-richtung").value : "",
    gebarung: el("vgl-f-gebarung") ? el("vgl-f-gebarung").value : "",
    status: el("vgl-f-status") ? el("vgl-f-status").value : "veraendert",
    schwelle: el("vgl-f-schwelle") ? el("vgl-f-schwelle").value : 0,
  }
}

function sortiere(zeilen) {
  const key = zustand.sortKey
  const zahl = ["a", "b", "delta", "prozent"].includes(key)
  const vz = zustand.sortAbsteigend ? -1 : 1
  return [...zeilen].sort((x, y) => {
    if (zahl) {
      // Die Veraenderung wird nach Betrag sortiert: ein Rueckgang von
      // 170.000 ist so gross wie ein Anstieg von 170.000.
      const a = key === "delta" ? Math.abs(x.delta) : (x[key] ?? 0)
      const b = key === "delta" ? Math.abs(y.delta) : (y[key] ?? 0)
      return (a - b) * vz
    }
    return String(x[key] ?? "").localeCompare(String(y[key] ?? ""), "de") * vz
  })
}

function zeichneTabelle() {
  if (!diff) return
  const gefiltert = sortiere(filtereZeilen(diff.zeilen, aktuelleFilter()))
  const tbody = el("vgl-tbody")
  if (!tbody) return
  const sichtbar = gefiltert.slice(0, LIMIT)
  // Einnahmen- und Ausgabenaenderungen duerfen nicht in eine Summe fallen:
  // ein Mehrertrag von 100.000 und ein Mehraufwand von 100.000 ergeben
  // zusammen nicht 200.000, sondern heben sich im Saldo auf.
  const summeEin = gefiltert.reduce(
    (s, r) => s + (r.richtung === "einnahme" ? r.delta : 0),
    0,
  )
  const summeAus = gefiltert.reduce(
    (s, r) => s + (r.richtung === "ausgabe" ? r.delta : 0),
    0,
  )
  tbody.innerHTML = sichtbar
    .map((r) => {
      const klasse =
        r.delta > 0 ? "is-hoch" : r.delta < 0 ? "is-nieder" : ""
      return (
        `<tr class="vgl-zeile ${klasse}">` +
        `<td title="${escapeHtml(r.gruppe_text)}">${escapeHtml(r.gruppe)}</td>` +
        `<td title="${escapeHtml(r.ansatz_text)}">${escapeHtml(r.ansatz)}</td>` +
        `<td title="${escapeHtml(r.konto_text)}">${escapeHtml(r.konto)}</td>` +
        `<td>${escapeHtml(r.bezeichnung)}</td>` +
        `<td>${escapeHtml(r.richtung)}</td>` +
        `<td class="num gat-table__num">${euro(r.a)}</td>` +
        `<td class="num gat-table__num">${euro(r.b)}</td>` +
        `<td class="num gat-table__num vgl-delta">${euroVz(r.delta)}</td>` +
        `<td class="num gat-table__num">${prozentVz(r.prozent)}</td>` +
        `<td><span class="vgl-status-${r.status}">` +
        `${STATUS_TEXT[r.status]}</span></td>` +
        `</tr>`
      )
    })
    .join("")
  const einLabel = diff.haushalt === "FHH" ? "Einzahlungen" : "Ertraege"
  const ausLabel = diff.haushalt === "FHH" ? "Auszahlungen" : "Aufwendungen"
  const teile = [
    `${gefiltert.length.toLocaleString("de-AT")} von ` +
      `${diff.zeilen.length.toLocaleString("de-AT")} Haushaltsstellen`,
  ]
  if (summeEin !== 0) teile.push(`${einLabel} ${euroVz(summeEin)}`)
  if (summeAus !== 0) teile.push(`${ausLabel} ${euroVz(summeAus)}`)
  if (summeEin !== 0 && summeAus !== 0) {
    teile.push(`Saldoeffekt ${euroVz(summeEin - summeAus)}`)
  }
  text("vgl-meta", teile.join(" · "))
  text(
    "vgl-hint",
    gefiltert.length > LIMIT
      ? `Nur die ersten ${LIMIT} von ${gefiltert.length} Zeilen gezeigt — ` +
        "Filter enger stellen oder als CSV exportieren."
      : "",
  )
  markiereSortierung()
}

function markiereSortierung() {
  const ths = document.querySelectorAll(
    '[data-panel="vergleich"] th[data-vkey]',
  )
  ths.forEach((th) => {
    const pfeil = th.querySelector(".arrow")
    const aktiv = th.dataset.vkey === zustand.sortKey
    th.classList.toggle("is-sorted", aktiv)
    if (pfeil) pfeil.textContent = aktiv ? (zustand.sortAbsteigend ? "▼" : "▲") : ""
  })
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function ladeCsv() {
  if (!diff) return
  const dB = dokument(zustand.b)
  const zeilen = sortiere(filtereZeilen(diff.zeilen, aktuelleFilter()))
  const csv = alsCsv(zeilen, basisLabel(), dB ? dB.label : "Vergleich")
  // BOM, damit Excel die Umlaute in UTF-8 erkennt.
  const blob = new Blob([`﻿${csv}`], {
    type: "text/csv;charset=utf-8",
  })
  // Klammern raus, sonst wuerde "VA 2026 (laut NVA)" zu
  // "va-2026-(laut-nva)" — die Herkunft soll trotzdem lesbar bleiben
  // ("va-2026-laut-nva").
  const teil = (s) => s.replace(/[()]/g, "").replace(/\s+/g, "-")
  const name =
    `vergleich_${teil(basisLabel())}_` +
    `${teil(dB ? dB.label : "vergleich")}_` +
    `${diff.haushalt}.csv`
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name.toLowerCase()
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
