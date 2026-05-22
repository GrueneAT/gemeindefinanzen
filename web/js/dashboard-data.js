// Datensammlung fuer das interaktive Dashboard — JavaScript-Port von
// report/data.py.
//
// collect(db) liest alle geladenen Dokumente in einem Schritt aus und liefert
// dasselbe JSON-serialisierbare Datenobjekt wie die Python-Pipeline. Die
// Dashboard-Oberflaeche (web/vendor/dashboard/dashboard.js, unveraendert aus
// dem Python-Report uebernommen) arbeitet ausschliesslich auf dieser Struktur.

// Chronologische Sortierung: innerhalb eines Jahres Ist vor Plan.
const ORDER =
  "CASE typ WHEN 'RA' THEN 0 WHEN 'NVA' THEN 1 WHEN 'VA' THEN 2 ELSE 3 END"

const KOMM = "833000"

function rows(db, sql) {
  return db.abfrage(sql).map((r) => Object.values(r))
}

function scalar(db, sql) {
  const v = db.wert(sql)
  return v === null || v === undefined ? 0.0 : Number(v)
}

// Pythons round() rundet zur naechsten geraden Zahl ("banker's rounding") —
// fuer byte-gleiche DATA muss der JS-Port das nachbilden.
function roundHalfEven(x, ndigits = 0) {
  const f = 10 ** ndigits
  const skaliert = x * f
  const ab = Math.floor(skaliert)
  const rest = skaliert - ab
  let ganz
  if (rest < 0.5) {
    ganz = ab
  } else if (rest > 0.5) {
    ganz = ab + 1
  } else {
    ganz = ab % 2 === 0 ? ab : ab + 1
  }
  return ganz / f
}

function round(x) {
  return roundHalfEven(x, 0)
}
function round2(x) {
  return roundHalfEven(x, 2)
}

function dokumente(db) {
  const zeilen = rows(
    db,
    `SELECT dokument_id, typ, finanzjahr, spalte_wert,
            spalte_vergleich, spalte_dritte
     FROM dokument ORDER BY finanzjahr, ${ORDER}`,
  )
  return zeilen.map(([did, typ, jahr, sw, sv, sd]) => ({
    id: did,
    typ,
    jahr,
    label: sw,
    spalte_wert: sw,
    spalte_vergleich: sv,
    spalte_dritte: sd,
  }))
}

function posten(db) {
  const zeilen = rows(
    db,
    `SELECT dokument_id, typ, finanzjahr, richtung, gebarung,
            gruppe, gruppe_text, ansatz, ansatz_text, konto,
            konto_text, bezeichnung, mvag_eh, qu,
            eh_wert, eh_vergleich, eh_dritte,
            fh_wert, fh_vergleich, fh_dritte
     FROM v_detail ORDER BY dokument_id, gruppe, ansatz, ${ORDER}`,
  )
  return zeilen.map(
    ([
      dok,
      typ,
      jahr,
      richtung,
      gebarung,
      gruppe,
      gruppe_text,
      ansatz,
      ansatz_text,
      konto,
      konto_text,
      bezeichnung,
      mvag_eh,
      qu,
      eh_wert,
      eh_vergleich,
      eh_dritte,
      fh_wert,
      fh_vergleich,
      fh_dritte,
    ]) => ({
      dok,
      typ,
      jahr,
      richtung,
      gebarung,
      gruppe: gruppe || "",
      gruppe_text: gruppe_text || "",
      ansatz: ansatz || "",
      ansatz_text: ansatz_text || "",
      konto: konto || "",
      konto_text: konto_text || "",
      bezeichnung: bezeichnung || "",
      mvag: mvag_eh || "",
      qu: qu || "",
      ew: round2(eh_wert || 0.0),
      ev: round2(eh_vergleich || 0.0),
      ed: round2(eh_dritte || 0.0),
      fw: round2(fh_wert || 0.0),
      fv: round2(fh_vergleich || 0.0),
      fd: round2(fh_dritte || 0.0),
    }),
  )
}

function sankey(db, did) {
  const quellen = rows(
    db,
    `SELECT CASE
              WHEN konto='859400' THEN 'Ertragsanteile (Bund)'
              WHEN konto='833000' THEN 'Kommunalsteuer'
              WHEN konto IN ('830000','831000') THEN 'Grundsteuer'
              WHEN konto LIKE '852%' OR konto LIKE '810%'
                THEN 'Gebuehren & Leistungen'
              WHEN substr(mvag_eh,1,3)='212'
                THEN 'Transfers & Zuschuesse'
              ELSE 'Sonstige Einnahmen' END AS quelle,
            SUM(eh_wert)
     FROM v_detail WHERE richtung='einnahme' AND eh_wert>0
       AND dokument_id=${did}
     GROUP BY quelle`,
  )
  const gruppen = rows(
    db,
    `SELECT gruppe_text, SUM(eh_wert) FROM v_detail
     WHERE richtung='ausgabe' AND eh_wert>0 AND dokument_id=${did}
     GROUP BY gruppe_text ORDER BY 2 DESC`,
  )
  return {
    quellen: quellen.map(([q, v]) => [q, round(v)]),
    gruppen: gruppen.map(([g, v]) => [g || "ohne Gruppe", round(v)]),
  }
}

function aggregateDok(db, did) {
  const ertraege = scalar(
    db,
    `SELECT SUM(eh_wert) FROM v_detail
     WHERE richtung='einnahme' AND dokument_id=${did}`,
  )
  const aufwand = scalar(
    db,
    `SELECT SUM(eh_wert) FROM v_detail
     WHERE richtung='ausgabe' AND dokument_id=${did}`,
  )
  const komm = scalar(
    db,
    `SELECT eh_wert FROM v_detail
     WHERE konto='${KOMM}' AND dokument_id=${did}`,
  )
  const netto = ertraege - aufwand

  const einnahmen = rows(
    db,
    `SELECT bezeichnung, eh_wert FROM v_detail
     WHERE richtung='einnahme' AND eh_wert>0 AND dokument_id=${did}
     ORDER BY eh_wert DESC LIMIT 12`,
  )
  const aufwandArt = rows(
    db,
    `SELECT CASE substr(mvag_eh,1,3)
              WHEN '221' THEN 'Personal' WHEN '222' THEN 'Sachaufwand'
              WHEN '223' THEN 'Transfers' WHEN '224' THEN 'Finanz'
              ELSE 'Sonstige' END,
            SUM(eh_wert)
     FROM v_detail WHERE richtung='ausgabe' AND eh_wert>0
       AND dokument_id=${did}
     GROUP BY 1 ORDER BY 2 DESC`,
  )
  const treemap = rows(
    db,
    `SELECT gruppe_text, ansatz_text, SUM(eh_wert) FROM v_detail
     WHERE richtung='ausgabe' AND eh_wert>0 AND dokument_id=${did}
     GROUP BY gruppe_text, ansatz_text`,
  )
  // Zweiseitig (diverging): die groessten Anstiege UND die groessten
  // Rueckgaenge. Frueher nur eh_delta>0 — Einsparungen blieben unsichtbar.
  const treiberAnstieg = rows(
    db,
    `SELECT bezeichnung, eh_delta FROM v_detail
     WHERE richtung='ausgabe' AND eh_delta>0 AND dokument_id=${did}
     ORDER BY eh_delta DESC LIMIT 8`,
  )
  const treiberRueckgang = rows(
    db,
    `SELECT bezeichnung, eh_delta FROM v_detail
     WHERE richtung='ausgabe' AND eh_delta<0 AND dokument_id=${did}
     ORDER BY eh_delta ASC LIMIT 8`,
  )
  const korridor = rows(
    db,
    `WITH s AS (SELECT bezeichnung, fh_wert FROM v_detail
                WHERE richtung='ausgabe' AND gebarung='operativ'
                  AND substr(mvag_eh,1,3)='222' AND fh_wert>0
                  AND konto NOT LIKE '68%'
                  AND bezeichnung NOT LIKE '%errechnungsr%'
                  AND dokument_id=${did})
     SELECT bezeichnung, fh_wert,
            SUM(fh_wert) OVER (ORDER BY fh_wert DESC
                               ROWS UNBOUNDED PRECEDING)
     FROM s ORDER BY fh_wert DESC LIMIT 18`,
  )
  const transfers = rows(
    db,
    `SELECT bezeichnung, eh_wert, eh_vergleich FROM v_detail
     WHERE richtung='ausgabe' AND substr(mvag_eh,1,3)='223'
       AND eh_wert>0 AND dokument_id=${did}
     ORDER BY eh_wert DESC LIMIT 14`,
  )
  const investitionen = rows(
    db,
    `SELECT bezeichnung, ansatz_text, fh_wert FROM v_detail
     WHERE richtung='ausgabe' AND gebarung='investiv'
       AND fh_wert>0 AND dokument_id=${did}
     ORDER BY fh_wert DESC LIMIT 14`,
  )
  const gruppen = rows(
    db,
    `SELECT gruppe, gruppe_text, SUM(eh_wert) FROM v_detail
     WHERE richtung='ausgabe' AND eh_wert>0 AND dokument_id=${did}
     GROUP BY gruppe, gruppe_text ORDER BY gruppe`,
  )

  return {
    eckwerte: {
      ertraege: round(ertraege),
      aufwand: round(aufwand),
      netto: round(netto),
      komm: round(komm),
      komm_anteil: ertraege
        ? roundHalfEven((100 * komm) / ertraege, 1)
        : 0.0,
    },
    einnahmen: einnahmen.map(([b, v]) => [b, round(v)]),
    aufwand_art: aufwandArt.map(([a, v]) => [a, round(v)]),
    treemap: treemap.map(([g, a, v]) => [
      g || "ohne Gruppe",
      a || "ohne Ansatz",
      round(v),
    ]),
    // Anstiege absteigend, danach Rueckgaenge (bereits aufsteigend, also
    // vom staerksten Minus zum schwaechsten) — eine durchgehend nach
    // eh_delta absteigend sortierte Liste fuer das zweiseitige Diagramm.
    treiber: [...treiberAnstieg, ...treiberRueckgang].map(([b, v]) => [
      b,
      round(v),
    ]),
    korridor: korridor.map(([b, v, k]) => [b, round(v), round(k)]),
    transfers: transfers.map(([b, v, vg]) => [b, round(v), round(vg || 0)]),
    investitionen: investitionen.map(([b, a, v]) => [b, a || "", round(v)]),
    gruppen: gruppen.map(([g, gt, v]) => [g || "", gt || "", round(v)]),
    sankey: sankey(db, did),
  }
}

function trend(db) {
  // Der Dokumenttyp (RA = Ist, VA/NVA = Plan) wird je Datenpunkt
  // mitgefuehrt, damit die Trend-Diagramme Plan und Ist optisch
  // unterscheiden koennen (siehe dashboard-charts.js).
  const eckwerte = rows(
    db,
    `SELECT spalte_wert, ROUND(ertraege), ROUND(aufwand),
            ROUND(nettoergebnis), typ
     FROM v_eckwerte ORDER BY finanzjahr, ${ORDER}`,
  )
  const komm = rows(
    db,
    `SELECT dokument, ROUND(eh_wert), typ FROM v_zeitreihe
     WHERE konto='833000' ORDER BY finanzjahr, typ`,
  )
  const aufwand = rows(
    db,
    `SELECT spalte_wert,
            ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='221'
                      THEN eh_wert ELSE 0 END)),
            ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='222'
                      THEN eh_wert ELSE 0 END)),
            ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='223'
                      THEN eh_wert ELSE 0 END)),
            ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='224'
                      THEN eh_wert ELSE 0 END)),
            typ
     FROM v_detail WHERE richtung='ausgabe'
     GROUP BY dokument_id ORDER BY finanzjahr, ${ORDER}`,
  )
  return {
    // [label, ertraege, aufwand, netto, typ]
    eckwerte: eckwerte.map((r) => [r[0], r[1], r[2], r[3], r[4]]),
    // [label, betrag, typ]
    komm: komm.map((r) => [r[0], r[1], r[2]]),
    // [label, personal, sach, transfer, finanz, typ]
    aufwand: aufwand.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5]]),
  }
}

// Alle Dashboard-Daten in einem JSON-serialisierbaren Objekt einsammeln.
export function collect(db) {
  const dok = dokumente(db)
  const gemeindeRow = db.abfrage("SELECT gemeinde FROM dokument LIMIT 1")
  const post = posten(db)
  const aggregate = {}
  for (const d of dok) {
    aggregate[String(d.id)] = aggregateDok(db, d.id)
  }
  const trendData = trend(db)

  // Default-Dokument: juengster Voranschlag, sonst juengstes Dokument.
  const va = dok.filter((d) => d.typ === "VA")
  let defaultDok = 0
  if (dok.length > 0) {
    defaultDok = (va.length ? va[va.length - 1] : dok[dok.length - 1]).id
  }

  return {
    meta: {
      gemeinde: gemeindeRow.length ? gemeindeRow[0].gemeinde : "",
      dok_anzahl: dok.length,
      posten_anzahl: post.length,
      default_dok: defaultDok,
    },
    dokumente: dok,
    posten: post,
    aggregate,
    trend: trendData,
  }
}
