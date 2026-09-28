// Diff-Engine fuer den Vergleich zweier Dokumente.
//
// Rein rechnend, ohne DOM und ohne ECharts — die Oberflaeche liegt in
// web/js/vergleich.js, die Diagrammoptionen in web/js/dashboard-charts.js.
// Grundlage ist ausschliesslich DATA.posten (alle Dokumente auf einmal), das
// dashboard-data.js ohnehin schon aufbaut; es braucht keine zweite Abfrage.
//
// Warum der Vergleich exakt ist und nicht geschaetzt:
//
//   Der VRV-Schluessel (Ansatz, Konto, Richtung) identifiziert eine
//   Haushaltsstelle eindeutig — im Detailnachweis eines PDF-Dokuments
//   kommt jede Kombination genau einmal vor. Zwei Dokumente lassen sich
//   deshalb ueber diesen Schluessel verlustfrei gegeneinanderstellen; es
//   braucht kein Namens-Matching und keine Heuristik.
//
//   Aggregiert wird trotzdem, aus einem Formatgrund: OH-CSV-Dokumente
//   halten Ergebnis- und Finanzierungshaushalt in **getrennten Zeilen**
//   (csv-parser.js/mergeParseResults konkateniert die beiden Haelften),
//   PDF-Dokumente tragen beide Haelften in **einer** Zeile. Die Summe je
//   Schluessel und Haushalt ist in beiden Faellen dieselbe Zahl — deshalb
//   wird summiert und nicht auf Eindeutigkeit vertraut.
//
// Selbstkontrolle: jedes Dokument druckt seine Vergleichszahl mit ab — ein
// Nachtragsvoranschlag den Voranschlag desselben Jahres, ein Voranschlag den
// des Vorjahres. Ist das Basisdokument genau dieses Dokument, rechnet
// `kontrolle` das Basisdokument gegen die abgedruckte Spalte nach. Damit ist
// der Diff belegt und nicht nur plausibel.

// Haushaltshaelften: Ergebnis- und Finanzierungshaushalt sind fachlich
// verschiedene Groessen und werden nie addiert.
export const HAUSHALTE = ["EHH", "FHH"]

// Statuswerte einer Diff-Zeile, in der Reihenfolge, in der die Oberflaeche
// sie anbietet.
export const STATUS = ["neu", "entfallen", "geaendert", "unveraendert"]

// Basis-Auswahl: dieser Wert steht nicht fuer ein Dokument, sondern fuer die
// im Vergleichsdokument abgedruckte Vergleichsspalte. Kollisionsfrei, weil
// dokument_id INTEGER PRIMARY KEY ist (web/schema.sql:19) und Ids ueberall
// per String(...) verglichen werden.
export const BASIS_INTERN = "intern"

// Eindeutiger VRV-Schluessel einer Haushaltsstelle.
export function schluessel(p) {
  return `${p.ansatz}|${p.konto}|${p.richtung}`
}

function wertVon(p, haushalt) {
  return (haushalt === "FHH" ? p.fw : p.ew) || 0
}

// Zweite Betragsspalte — die im Dokument abgedruckte Vergleichszahl. Beim
// NVA ist das der Voranschlag desselben Jahres, beim VA der Voranschlag des
// Vorjahres, beim RA das Soll.
function vergleichVon(p, haushalt) {
  return (haushalt === "FHH" ? p.fv : p.ev) || 0
}

// Ein Dokument auf den VRV-Schluessel aggregieren. Liefert eine Map
// key -> { ...Stammdaten, wert, vergleich }.
export function aggregiereDokument(posten, dokId, haushalt) {
  const map = new Map()
  const id = String(dokId)
  for (const p of posten) {
    if (String(p.dok) !== id) continue
    const k = schluessel(p)
    let e = map.get(k)
    if (!e) {
      e = {
        key: k,
        gruppe: p.gruppe,
        gruppe_text: p.gruppe_text,
        ansatz: p.ansatz,
        ansatz_text: p.ansatz_text,
        konto: p.konto,
        konto_text: p.konto_text,
        bezeichnung: p.bezeichnung,
        richtung: p.richtung,
        gebarung: p.gebarung,
        wert: 0,
        vergleich: 0,
      }
      map.set(k, e)
    }
    e.wert += wertVon(p, haushalt)
    e.vergleich += vergleichVon(p, haushalt)
    // Bezeichnung: die erste nicht-leere gewinnt. Bei CSV-Dokumenten traegt
    // die FHH-Haelfte gelegentlich einen anderen Kontotext als die EHH-
    // Haelfte; fuer die Anzeige genuegt einer davon.
    if (!e.bezeichnung && p.bezeichnung) e.bezeichnung = p.bezeichnung
  }
  return map
}

// Status einer Zeile aus den beiden Werten.
function statusVon(a, b) {
  if (a === b) return "unveraendert"
  if (a === 0) return "neu"
  if (b === 0) return "entfallen"
  return "geaendert"
}

// Rundung auf ganze Euro — die Quelldokumente sind auf Cent genau, die
// Anzeige und alle Summen laufen in Euro.
function euroRund(x) {
  return Math.round(x)
}

// Beitrag einer Zeile zum Saldo: eine Mehreinnahme hebt den Saldo, ein
// Mehraufwand senkt ihn.
function saldoBeitrag(zeile) {
  return zeile.richtung === "einnahme" ? zeile.delta : -zeile.delta
}

// Die abgedruckte Vergleichsspalte als Basis-Seite: dieselbe Map, auf dem
// Feld `vergleich` gelesen. Ein KLON — wuerde `aggB` in-place umgeschrieben
// (e.wert = e.vergleich), waeren Basis und Vergleich danach dasselbe Objekt
// und jedes delta 0. Das faellt in keinem bestehenden Test auf.
function interneBasis(aggB) {
  const m = new Map()
  for (const [k, e] of aggB) {
    m.set(k, { ...e, wert: e.vergleich, vergleich: 0 })
  }
  return m
}

// Der eigentliche Diff.
//
//   posten     — DATA.posten (alle Dokumente)
//   dokumente  — DATA.dokumente (fuer Typ/Jahr und die Selbstkontrolle)
//   a, b       — dokument_id der Basis und des Vergleichs; `a` kann
//                stattdessen BASIS_INTERN sein — dann ist die Basis-Seite
//                die im Vergleichsdokument abgedruckte Vergleichsspalte
//   haushalt   — 'EHH' | 'FHH'
//
// Liefert ein Objekt mit Zeilen, Kennzahlen, Aggregaten fuer die Diagramme
// und dem Ergebnis der Selbstkontrolle.
export function baueDiff(posten, dokumente, { a, b, haushalt = "EHH" }) {
  const hh = haushalt === "FHH" ? "FHH" : "EHH"
  // Die Reihenfolge ist gedreht: aggB ist im internen Modus die Quelle der
  // Basis-Seite und muss deshalb zuerst stehen.
  const intern = String(a) === BASIS_INTERN
  const aggB = aggregiereDokument(posten, b, hh)
  const aggA = intern ? interneBasis(aggB) : aggregiereDokument(posten, a, hh)

  const zeilen = []
  const keys = new Set([...aggA.keys(), ...aggB.keys()])
  for (const k of keys) {
    const ea = aggA.get(k)
    const eb = aggB.get(k)
    const wa = euroRund(ea ? ea.wert : 0)
    const wb = euroRund(eb ? eb.wert : 0)
    // Haushaltsstellen, die in dieser Haushaltshaelfte in beiden Dokumenten
    // null sind, sind keine Information — sie entstehen, weil ein Dokument
    // den Schluessel in der anderen Haelfte fuehrt (oder die OH-CSV eine
    // Nullzeile mitliefert).
    if (wa === 0 && wb === 0) continue
    const stamm = eb || ea
    zeilen.push({
      key: k,
      gruppe: stamm.gruppe,
      gruppe_text: stamm.gruppe_text,
      ansatz: stamm.ansatz,
      ansatz_text: stamm.ansatz_text,
      konto: stamm.konto,
      konto_text: stamm.konto_text,
      bezeichnung: stamm.bezeichnung,
      richtung: stamm.richtung,
      gebarung: stamm.gebarung,
      a: wa,
      b: wb,
      delta: wb - wa,
      // Prozent nur, wenn es eine Basis gibt — sonst ist "+unendlich"
      // die einzige richtige Antwort, und die schreibt man nicht in eine
      // Tabelle.
      prozent: wa === 0 ? null : (100 * (wb - wa)) / Math.abs(wa),
      status: statusVon(wa, wb),
    })
  }

  // Sortierung: groesste Veraenderung zuerst. Das ist die Frage, mit der
  // man diese Tabelle oeffnet.
  zeilen.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))

  return {
    haushalt: hh,
    a,
    b,
    zeilen,
    status: statusZaehlung(zeilen),
    eckwerte: eckwerte(zeilen, hh),
    gruppen: gruppenDelta(zeilen),
    treemap: treemapDelta(zeilen),
    wasserfall: wasserfall(zeilen),
    kontrolle: intern
      ? internHinweis(dokumente, b)
      : kontrolle(aggA, aggB, dokumente, a, b),
  }
}

// Beschriftung der dokumentinternen Basis (CONTEXT.md D3): Spaltenname plus
// kurze Herkunft. Beim Rechnungsabschluss tritt eine neutrale, zutreffende
// Form an die Stelle der abgedruckten (CONTEXT.md D2): sein "Soll" ist der
// Voranschlag INKLUSIVE Nachtrag, die abgedruckte Bezeichnung verschweigt
// das. Beim Voranschlag ist es umgekehrt — seine Spalte 2 ist der
// Vorjahres-VA im Original, ohne dessen Nachtrag.
export function interneBasisLabel(d) {
  if (!d) return "Basis"
  if (d.typ === "RA") return `Soll ${d.jahr} (laut RA)`
  return `${d.spalte_vergleich} (laut ${d.typ})`
}

// Traegt das Dokument in seiner zweiten Betragsspalte ueberhaupt Zahlen?
// Nicht am Typ entscheidbar: ein OH-CSV-Dokument traegt den Spaltennamen
// ("VA 2025", geschrieben in loader.js:31), aber keine Werte — der
// CSV-Parser setzt nur eh_wert/fh_wert (csv-parser.js:305,307; Kommentar
// 330-333). Ohne Werte entstuende ein Diff mit Basis 0 auf jeder Zeile.
// Ohne `haushalt` heisst das "eine der beiden Haelften".
export function hatVergleichsspalte(posten, dokId, haushalt) {
  const id = String(dokId)
  for (const p of posten || []) {
    if (String(p.dok) !== id) continue
    if (haushalt !== "FHH" && (p.ev || 0) !== 0) return true
    if (haushalt !== "EHH" && (p.fv || 0) !== 0) return true
  }
  return false
}

function statusZaehlung(zeilen) {
  const z = { neu: 0, entfallen: 0, geaendert: 0, unveraendert: 0 }
  for (const r of zeilen) z[r.status]++
  return { ...z, gesamt: zeilen.length, veraendert: zeilen.length - z.unveraendert }
}

// Kennzahlen je Haushaltshaelfte. Der Ergebnishaushalt kennt Ertraege,
// Aufwendungen und das Nettoergebnis; der Finanzierungshaushalt Ein- und
// Auszahlungen, den Saldo und — als eigene Zeile, weil politisch die
// interessanteste — die investiven Auszahlungen.
function eckwerte(zeilen, haushalt) {
  const summe = (fn) =>
    zeilen.reduce(
      (acc, r) => {
        if (!fn(r)) return acc
        acc.a += r.a
        acc.b += r.b
        return acc
      },
      { a: 0, b: 0 },
    )
  const ein = summe((r) => r.richtung === "einnahme")
  const aus = summe((r) => r.richtung === "ausgabe")
  const karte = (titel, s, guteRichtung) => ({
    titel,
    a: s.a,
    b: s.b,
    delta: s.b - s.a,
    prozent: s.a === 0 ? null : (100 * (s.b - s.a)) / Math.abs(s.a),
    // Welches Vorzeichen ist eine gute Nachricht? Bei Ertraegen ein Plus,
    // bei Aufwendungen ein Minus. Die Oberflaeche faerbt danach.
    gut: guteRichtung,
  })
  if (haushalt === "FHH") {
    const inv = summe((r) => r.richtung === "ausgabe" && r.gebarung === "investiv")
    return [
      karte("Einzahlungen", ein, "auf"),
      karte("Auszahlungen", aus, "ab"),
      karte("Saldo", { a: ein.a - aus.a, b: ein.b - aus.b }, "auf"),
      karte("davon investive Auszahlungen", inv, "neutral"),
    ]
  }
  return [
    karte("Ertraege", ein, "auf"),
    karte("Aufwendungen", aus, "ab"),
    karte("Nettoergebnis", { a: ein.a - aus.a, b: ein.b - aus.b }, "auf"),
  ]
}

// Veraenderung je Aufgabengruppe, getrennt nach Richtung — Grundlage des
// Gruppen-Diagramms.
function gruppenDelta(zeilen) {
  const map = new Map()
  for (const r of zeilen) {
    const g = r.gruppe || ""
    let e = map.get(g)
    if (!e) {
      e = { gruppe: g, gruppe_text: r.gruppe_text || "", einnahme: 0, ausgabe: 0 }
      map.set(g, e)
    }
    if (r.richtung === "einnahme") e.einnahme += r.delta
    else e.ausgabe += r.delta
  }
  return [...map.values()].sort((x, y) => x.gruppe.localeCompare(y.gruppe))
}

// Veraenderung je Ansatz, mit der Aufgabengruppe als Elternebene — Grundlage
// der Treemap. Unveraenderte Ansaetze fallen heraus: eine Flaeche von 0 ist
// nicht darstellbar und waere auch nichts, was man sehen will.
function treemapDelta(zeilen) {
  const map = new Map()
  for (const r of zeilen) {
    if (r.delta === 0) continue
    const k = `${r.gruppe}|${r.ansatz}`
    let e = map.get(k)
    if (!e) {
      e = {
        gruppe: r.gruppe || "",
        gruppe_text: r.gruppe_text || "",
        ansatz: r.ansatz || "",
        ansatz_text: r.ansatz_text || "",
        einnahme: 0,
        ausgabe: 0,
        delta: 0,
      }
      map.set(k, e)
    }
    if (r.richtung === "einnahme") e.einnahme += r.delta
    else e.ausgabe += r.delta
    e.delta += r.delta
  }
  return [...map.values()].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
}

// Wieviele Einzelschritte zeigt der Wasserfall, bevor der Rest zu
// "Sonstige" zusammenfaellt?
export const WASSERFALL_N = 10

// Brueckenrechnung vom Saldo der Basis zum Saldo des Vergleichs, aggregiert
// auf Ansatz-Ebene: ein Ansatz ist die Aufgabe, um die es politisch geht
// ("Bruecken ueber Wasserlaeufe"), nicht die einzelne Kontozeile.
function wasserfall(zeilen) {
  const von = zeilen.reduce(
    (s, r) => s + (r.richtung === "einnahme" ? r.a : -r.a),
    0,
  )
  const nach = zeilen.reduce(
    (s, r) => s + (r.richtung === "einnahme" ? r.b : -r.b),
    0,
  )
  const map = new Map()
  for (const r of zeilen) {
    const beitrag = saldoBeitrag(r)
    if (beitrag === 0) continue
    const k = r.ansatz || ""
    let e = map.get(k)
    if (!e) {
      // Der Ansatz-Code gehoert ins Label: mehrere Ansaetze tragen
      // aehnliche Texte ("Sonstige Einrichtungen und Massnahmen"), und im
      // gekuerzten Achsenlabel waeren sie sonst nicht zu unterscheiden.
      e = {
        ansatz: k,
        name: r.ansatz_text ? `${k} ${r.ansatz_text}` : k,
        beitrag: 0,
      }
      map.set(k, e)
    }
    e.beitrag += beitrag
  }
  const alle = [...map.values()]
    .filter((e) => e.beitrag !== 0)
    .sort((x, y) => Math.abs(y.beitrag) - Math.abs(x.beitrag))
  const schritte = alle.slice(0, WASSERFALL_N)
  const rest = alle.slice(WASSERFALL_N)
  if (rest.length) {
    schritte.push({
      ansatz: "",
      name: `Sonstige (${rest.length} Ansaetze)`,
      beitrag: rest.reduce((s, e) => s + e.beitrag, 0),
    })
  }
  return { von, nach, schritte }
}

// Welches geladene Dokument wuerde die Selbstkontrolle ausloesen?
//   dB = NVA -> der VA desselben Jahres
//   dB = VA  -> der VA des Vorjahres
//   dB = RA  -> der NVA desselben Jahres (sein Soll enthaelt den Nachtrag,
//               CONTEXT.md D2), sonst der VA desselben Jahres
function ausloeserFuer(docs, dB) {
  if (dB.typ === "NVA") {
    return docs.find((d) => d.typ === "VA" && d.jahr === dB.jahr) || null
  }
  if (dB.typ === "VA") {
    return docs.find((d) => d.typ === "VA" && d.jahr === dB.jahr - 1) || null
  }
  if (dB.typ === "RA") {
    return (
      docs.find((d) => d.typ === "NVA" && d.jahr === dB.jahr) ||
      docs.find((d) => d.typ === "VA" && d.jahr === dB.jahr) ||
      null
    )
  }
  return null
}

// Rueckgabe im internen Modus — keine Pruefung, sondern ihre Voraussetzung.
// `kontrolle()` darf hier nicht rechnen: `aggA.wert` ist im internen Modus
// per Konstruktion `aggB.vergleich`, die Pruefung faende immer 0
// Abweichungen und schriebe eine Tautologie, die wie ein Beweis aussieht
// (CONTEXT.md D1). Die Engine liefert stattdessen die Voraussetzung der
// Pruefung, damit vergleich.js keine Fachlogik traegt.
function internHinweis(dokumente, b) {
  const docs = dokumente || []
  const dB = docs.find((d) => String(d.id) === String(b))
  if (!dB) return null
  const gefunden = ausloeserFuer(docs, dB)
  const erwartetesLabel =
    dB.typ === "NVA"
      ? `VA ${dB.jahr}`
      : dB.typ === "VA"
        ? `VA ${dB.jahr - 1}`
        : `NVA ${dB.jahr}`
  return {
    modus: "intern",
    spalte: interneBasisLabel(dB),
    dokument: dB.label,
    ausloeser: {
      label: gefunden ? gefunden.label : erwartetesLabel,
      geladen: !!gefunden,
      id: gefunden ? gefunden.id : null,
    },
  }
}

// Selbstkontrolle gegen die abgedruckte Vergleichsspalte.
//
// Jedes VRV-Dokument druckt in seiner zweiten Betragsspalte eine
// Vergleichszahl mit ab: ein Nachtragsvoranschlag den Voranschlag desselben
// Jahres, ein Voranschlag den des Vorjahres. Ist das Basisdokument des
// Vergleichs genau dieses Dokument, dann muss seine Spalte 1 der abgedruckten
// Spalte 2 des Vergleichsdokuments entsprechen — Haushaltsstelle fuer
// Haushaltsstelle. Damit ist der Diff nicht plausibel, sondern belegt.
//
// Stimmt es nicht, ist das in der Praxis fast immer eine Fassungsfrage: die
// zur Auflage aufgelegte Version eines Voranschlags weicht von der
// beschlossenen ab, und der Nachtrag rechnet gegen die beschlossene. Deshalb
// heisst das Ergebnis "Abweichung", nicht "Fehler".
//
// Der Rechnungsabschluss bleibt bewusst aussen vor: seine Spalte 2 ist das
// Soll, und das kann den Nachtrag schon enthalten — welches Dokument gemeint
// ist, laesst sich aus dem Seitenkopf nicht entscheiden.
function kontrolle(aggA, aggB, dokumente, a, b) {
  const docs = dokumente || []
  const dA = docs.find((d) => String(d.id) === String(a))
  const dB = docs.find((d) => String(d.id) === String(b))
  if (!dA || !dB) return null
  const nva = dB.typ === "NVA" && dA.typ === "VA" && dA.jahr === dB.jahr
  const vaFolge = dB.typ === "VA" && dA.typ === "VA" && dA.jahr === dB.jahr - 1
  if (!nva && !vaFolge) return null

  const abweichungen = []
  let geprueft = 0
  let ohneBeleg = 0
  let summeAbweichung = 0
  for (const k of new Set([...aggA.keys(), ...aggB.keys()])) {
    const eb = aggB.get(k)
    const ea = aggA.get(k)
    const wa = euroRund(ea ? ea.wert : 0)
    // Eine Haushaltsstelle, die das Vergleichsdokument gar nicht fuehrt,
    // hat dort keine abgedruckte Vergleichszahl — nicht pruefbar. Das ist
    // kein Fehler, wird aber ausgewiesen.
    if (!eb) {
      if (wa !== 0) ohneBeleg++
      continue
    }
    const abgedruckt = euroRund(eb.vergleich)
    if (wa === 0 && abgedruckt === 0) continue
    geprueft++
    const abw = wa - abgedruckt
    if (abw !== 0) {
      summeAbweichung += Math.abs(abw)
      const stamm = ea || eb
      abweichungen.push({
        key: k,
        gruppe: stamm.gruppe,
        ansatz: stamm.ansatz,
        ansatz_text: stamm.ansatz_text,
        konto: stamm.konto,
        bezeichnung: stamm.bezeichnung,
        richtung: stamm.richtung,
        basis: wa,
        abgedruckt,
        abweichung: abw,
      })
    }
  }
  abweichungen.sort((x, y) => Math.abs(y.abweichung) - Math.abs(x.abweichung))
  return {
    spalte: dB.spalte_vergleich || "Vergleichsspalte",
    dokument: dB.label,
    fassung_a: dA.fassung || "",
    fassung_b: dB.fassung || "",
    geprueft,
    ohne_beleg: ohneBeleg,
    abweichungen,
    summeAbweichung,
    bestanden: abweichungen.length === 0,
  }
}

// Filter und Sortierung der Diff-Tabelle. Getrennt vom Diff, damit ein
// Filterwechsel nicht neu rechnet.
//
//   richtung  — '' | 'einnahme' | 'ausgabe'
//   gruppe    — '' | '0'..'9'
//   gebarung  — '' | 'operativ' | 'investiv' | 'finanzierung' | 'ruecklage'
//   status    — '' | 'veraendert' | einer aus STATUS
//   schwelle  — Mindestbetrag der absoluten Veraenderung in Euro
//   suche     — Volltext ueber Bezeichnung, Ansatz- und Kontotext, Ansatz,
//               Konto
export function filtereZeilen(zeilen, f = {}) {
  const q = String(f.suche || "").trim().toLowerCase()
  const schwelle = Number(f.schwelle) || 0
  return zeilen.filter((r) => {
    if (f.richtung && r.richtung !== f.richtung) return false
    if (f.gruppe && r.gruppe !== f.gruppe) return false
    if (f.gebarung && r.gebarung !== f.gebarung) return false
    if (f.status === "veraendert") {
      if (r.status === "unveraendert") return false
    } else if (f.status && r.status !== f.status) {
      return false
    }
    if (schwelle && Math.abs(r.delta) < schwelle) return false
    if (q) {
      const heu = `${r.bezeichnung} ${r.ansatz_text} ${r.konto_text} ${r.ansatz} ${r.konto} ${r.gruppe_text}`
      if (!heu.toLowerCase().includes(q)) return false
    }
    return true
  })
}

// Die gefilterte Tabelle als CSV — derselbe Aufbau wie die Anzeige, damit
// eine weitergegebene Datei zur Bildschirmansicht passt. Semikolon und
// deutsches Dezimalkomma, weil die Datei in Excel und LibreOffice mit
// oesterreichischem Gebietsschema geoeffnet wird.
export function alsCsv(zeilen, labelA, labelB) {
  const kopf = [
    "Gruppe",
    "Gruppe-Text",
    "Ansatz",
    "Ansatz-Text",
    "Konto",
    "Konto-Text",
    "Bezeichnung",
    "Richtung",
    "Gebarung",
    labelA || "Basis",
    labelB || "Vergleich",
    "Veraenderung",
    "Veraenderung-Prozent",
    "Status",
  ]
  const zahl = (v) =>
    v === null || v === undefined ? "" : String(v).replace(".", ",")
  const feld = (v) => {
    const s = String(v ?? "")
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const raus = [kopf.map(feld).join(";")]
  for (const r of zeilen) {
    raus.push(
      [
        feld(r.gruppe),
        feld(r.gruppe_text),
        feld(r.ansatz),
        feld(r.ansatz_text),
        feld(r.konto),
        feld(r.konto_text),
        feld(r.bezeichnung),
        feld(r.richtung),
        feld(r.gebarung || ""),
        zahl(r.a),
        zahl(r.b),
        zahl(r.delta),
        zahl(r.prozent === null ? "" : Math.round(r.prozent * 10) / 10),
        feld(r.status),
      ].join(";"),
    )
  }
  return raus.join("\n")
}
