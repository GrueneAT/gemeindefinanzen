// Aufbereitung des Parse-Ergebnisses fuer die Datenhaltung — JavaScript-Port
// der reinen Logik aus loader.py (Spaltenbedeutung, Referenz- und
// Posten-Datensaetze). Das eigentliche Schreiben in die SQLite-DB uebernimmt
// db.js.

import { kontenklasse, mvagName, GRUPPEN, MVAG } from "./reference.js"

// Bedeutung der drei Detailnachweis-Betragsspalten je Dokumenttyp.
// Verifiziert an den Seitenkoepfen der PDF:
//   Voranschlag:         VA Jahr            | VA Vorjahr | RA Vorvorjahr
//   Nachtragsvoranschl.: VA Jahr inkl. NVA  | VA Jahr    | 1. NVA (Aenderung)
//   Rechnungsabschluss:  RA Jahr (Ist)      | VA Jahr    | Abweichung RA-VA
export function spalten(typ, jahr) {
  if (jahr === null || jahr === undefined) {
    return ["Spalte 1", "Spalte 2", "Spalte 3"]
  }
  if (typ === "RA") {
    return [`RA ${jahr}`, `VA ${jahr}`, "Abweichung RA-VA"]
  }
  if (typ === "NVA") {
    return [`VA ${jahr} inkl. NVA`, `VA ${jahr}`, "1. NVA"]
  }
  return [`VA ${jahr}`, `VA ${jahr - 1}`, `RA ${jahr - 2}`]
}

// Dokument-Datensatz aus Meta und Dateiname bilden.
export function dokumentDatensatz(dateiname, meta) {
  const jahr = /^\d+$/.test(meta.finanzjahr) ? Number(meta.finanzjahr) : null
  const stem = dateiname.replace(/\.[^.]*$/, "").toLowerCase()
  const fassung = stem.includes("auflage") ? "Auflage" : ""
  const [sp_wert, sp_vergleich, sp_dritte] = spalten(meta.typ, jahr)
  return {
    gemeinde: meta.gemeinde || "",
    typ: meta.typ || "",
    finanzjahr: jahr,
    spalte_wert: sp_wert,
    spalte_vergleich: sp_vergleich,
    spalte_dritte: sp_dritte,
    fassung,
    quelldatei: dateiname,
    seiten: meta.seiten ?? null,
  }
}

// Referenztabellen-Inhalte aus VRV-Daten und dem Dokument zusammenstellen.
export function referenzDatensaetze(result) {
  const gruppen = Object.entries(GRUPPEN).map(([g, b]) => [g, b])
  const ansaetze = Object.keys(result.ansatz_namen)
    .sort()
    .map((a) => [a, result.ansatz_namen[a], a.slice(0, 1)])
  const konten = Object.keys(result.konto_namen)
    .sort()
    .map((k) => [k, result.konto_namen[k], kontenklasse(k)])

  // MVAG: VRV-Referenz plus die im Dokument vorkommenden Codes.
  const mvagMap = new Map(Object.entries(MVAG).map(([m, b]) => [m, b]))
  const gesehen = new Set()
  for (const p of result.posten) {
    if (p.mvag_eh) gesehen.add(p.mvag_eh)
    if (p.mvag_fh) gesehen.add(p.mvag_fh)
  }
  for (const m of [...gesehen].sort()) {
    if (!mvagMap.has(m)) mvagMap.set(m, mvagName(m))
  }
  const mvag = [...mvagMap.entries()]

  return { gruppen, ansaetze, konten, mvag }
}

// Posten-Datensaetze (alle Spaltenwerte) fuer den DB-Insert aufbereiten.
export function postenDatensaetze(result) {
  return result.posten.map((p) => ({
    seite: p.seite,
    zeilentyp: p.zeilentyp,
    richtung: p.richtung,
    vrk: p.vrk,
    ansatz: p.ansatz,
    konto: p.konto,
    gruppe: p.gruppe,
    bezeichnung: p.bezeichnung,
    gebarung: p.gebarung,
    eh_wert: p.eh_wert,
    eh_vergleich: p.eh_vergleich,
    eh_dritte: p.eh_dritte,
    fh_wert: p.fh_wert,
    fh_vergleich: p.fh_vergleich,
    fh_dritte: p.fh_dritte,
    mvag_eh: p.mvag_eh,
    mvag_fh: p.mvag_fh,
    qu: p.qu,
  }))
}
