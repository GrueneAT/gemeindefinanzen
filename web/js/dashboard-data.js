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

// Pflichtumlagen-Heuristik (R9). Bislang stand der Regex inline in
// dashboard.js (Zeilen 160-161); fuer die Bindungs-Aggregation (R9) wird
// dieselbe Logik in dashboard-data.js gebraucht. Zentraler Helfer, der
// von beiden Stellen genutzt wird (window.istPflichtumlage in
// dashboard-app.js fuer den klassischen Skript-Pfad).
export function istPflichtumlage(bezeichnung) {
  return /umlage|nökas|nokas|sozialhilfe|krankenanstalt/i.test(
    String(bezeichnung || ""),
  )
}

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
            spalte_vergleich, spalte_dritte, einwohner
     FROM dokument ORDER BY finanzjahr, ${ORDER}`,
  )
  return zeilen.map(([did, typ, jahr, sw, sv, sd, einw]) => ({
    id: did,
    typ,
    jahr,
    label: sw,
    spalte_wert: sw,
    spalte_vergleich: sv,
    spalte_dritte: sd,
    // R5: optionale Einwohnerzahl — null wenn nicht erfasst.
    einwohner: einw == null ? null : Number(einw),
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

  // R1 — Vergleichssummen aus eh_vergleich-Spalte. Bei VA = Vorjahresplan,
  // bei RA = Soll laut VA (siehe Schema-Kommentar). Daraus Delta-Prozent.
  const ertraegeVgl = scalar(
    db,
    `SELECT SUM(eh_vergleich) FROM v_detail
     WHERE richtung='einnahme' AND dokument_id=${did}`,
  )
  const aufwandVgl = scalar(
    db,
    `SELECT SUM(eh_vergleich) FROM v_detail
     WHERE richtung='ausgabe' AND dokument_id=${did}`,
  )
  const kommVgl = scalar(
    db,
    `SELECT eh_vergleich FROM v_detail
     WHERE konto='${KOMM}' AND dokument_id=${did}`,
  )
  const nettoVgl = ertraegeVgl - aufwandVgl
  // Hilfsfunktion: Prozent-Delta gegenueber Vergleichswert. Bei 0 = null
  // (keine sinnvolle Prozent-Aussage).
  const deltaProz = (jetzt, vgl) =>
    vgl !== 0 ? roundHalfEven((100 * (jetzt - vgl)) / Math.abs(vgl), 1) : null

  // R5 — Pro-Kopf-Werte (nur wenn Einwohnerzahl gesetzt).
  const einwohner = db.wert(
    `SELECT einwohner FROM dokument WHERE dokument_id=${did}`,
  )
  const ew = (n) =>
    einwohner != null && Number(einwohner) > 0
      ? round(n / Number(einwohner))
      : null

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

  // R2 — Finanzierungstaetigkeit (gebarung='finanzierung'): Aufnahme und
  // Tilgung als Skalare. Zinsen aus operativem Aufwand MVAG-224 separat —
  // Schuldendienst = Tilgung + Zinsen.
  const finAufnahme = scalar(
    db,
    `SELECT SUM(fh_wert) FROM v_detail
     WHERE gebarung='finanzierung' AND richtung='einnahme'
       AND dokument_id=${did}`,
  )
  const finTilgung = scalar(
    db,
    `SELECT SUM(fh_wert) FROM v_detail
     WHERE gebarung='finanzierung' AND richtung='ausgabe'
       AND dokument_id=${did}`,
  )
  const finZinsen = scalar(
    db,
    `SELECT SUM(eh_wert) FROM v_detail
     WHERE richtung='ausgabe' AND gebarung='operativ'
       AND substr(mvag_eh,1,3)='224' AND dokument_id=${did}`,
  )
  const schuldendienst = finTilgung + finZinsen

  // R12 — Investitions-Finanzierung. Foerderung = investive Einnahmen,
  // Darlehen = Netto-Neuverschuldung (Aufnahme - Tilgung, gedeckelt auf 0),
  // Eigen = Rest des Investitionsvolumens. Heuristische Aufteilung; im
  // Panel mit Disclaimer kommuniziert.
  const foerderung = scalar(
    db,
    `SELECT SUM(fh_wert) FROM v_detail
     WHERE gebarung='investiv' AND richtung='einnahme'
       AND dokument_id=${did}`,
  )
  const investAus = scalar(
    db,
    `SELECT SUM(fh_wert) FROM v_detail
     WHERE gebarung='investiv' AND richtung='ausgabe'
       AND dokument_id=${did}`,
  )
  const investDarlehen = Math.max(0, finAufnahme - finTilgung)
  const investEigen = Math.max(0, investAus - foerderung - investDarlehen)

  // R9 — Gebunden vs. gestaltbar. Klassifikation der operativen Ausgaben
  // in Personal (MVAG 221), Pflichtumlagen (MVAG 223 + Regex), Finanz
  // (MVAG 224), freiwillige Transfers (Rest MVAG 223), freie Sachaus
  // (MVAG 222 ausserhalb der nicht-zahlungswirksamen). Kategorie "unklar"
  // sammelt nicht zugeordnete oder nicht zahlungswirksame Posten.
  const bindungsZeilen = rows(
    db,
    `SELECT bezeichnung, mvag_eh, konto, eh_wert FROM v_detail
     WHERE richtung='ausgabe' AND gebarung='operativ'
       AND eh_wert > 0 AND dokument_id=${did}`,
  )
  const bindung = {
    personal: 0,
    pflichtumlagen: 0,
    finanz: 0,
    freiwilligeTransfers: 0,
    freieSachaus: 0,
    unklar: 0,
  }
  for (const [bez, mvag, konto, wert] of bindungsZeilen) {
    const m3 = String(mvag || "").slice(0, 3)
    if (m3 === "221") {
      bindung.personal += wert
    } else if (m3 === "224") {
      bindung.finanz += wert
    } else if (m3 === "223") {
      if (istPflichtumlage(bez)) bindung.pflichtumlagen += wert
      else bindung.freiwilligeTransfers += wert
    } else if (m3 === "222") {
      // Korridor-Filter spiegeln: nicht zahlungswirksame Posten ausnehmen
      // (Abschreibungen u.ae. — Konten 68* und "errechnungsr*").
      const nichtZahlung =
        String(konto || "").startsWith("68") ||
        /errechnungsr/i.test(String(bez || ""))
      if (!nichtZahlung) bindung.freieSachaus += wert
      else bindung.unklar += wert
    } else {
      bindung.unklar += wert
    }
  }
  for (const k of Object.keys(bindung)) bindung[k] = round(bindung[k])

  // R7 — Saldo je Aufgabenbereich. Einnahmen und Ausgaben je Gruppe;
  // Saldo = Einnahmen - Ausgaben. Portierung von web/sql/02-gruppen-
  // uebersicht.sql, parametriert auf dokument_id.
  const gruppenSaldoRows = rows(
    db,
    `SELECT gruppe, gruppe_text,
            ROUND(SUM(CASE WHEN richtung='einnahme' THEN eh_wert ELSE 0 END), 0),
            ROUND(SUM(CASE WHEN richtung='ausgabe'  THEN eh_wert ELSE 0 END), 0),
            ROUND(SUM(CASE WHEN richtung='einnahme' THEN eh_wert
                           ELSE -eh_wert END), 0)
     FROM v_detail WHERE dokument_id=${did}
     GROUP BY gruppe, gruppe_text ORDER BY gruppe`,
  )

  // R8 — "Wofuer geht 1 Euro?" / "Wofuer kommen 100 Euro herein?".
  // Aufwand auf 100 Cent normalisieren (aus aufwand_art), Einnahmen
  // ebenso (aus sankey.quellen). Cent-Werte summieren sich auf 100 +/- 1
  // (Rundung). Werden weiter unten nach Aggregation der Quellen befuellt.

  // R3 — Soll-Ist-Abweichung (nur fuer Rechnungsabschluesse). Direkt aus
  // v_detail.eh_delta abgeleitet, parametriert auf dokument_id; analog zu
  // web/sql/14-soll-ist-abweichung.sql, aber je Dokument.
  const dokTyp = db.wert(
    `SELECT typ FROM dokument WHERE dokument_id=${did}`,
  )
  let sollIst
  if (dokTyp === "RA") {
    sollIst = rows(
      db,
      `SELECT bezeichnung, gruppe_text, richtung,
              ROUND(eh_vergleich,0),
              ROUND(eh_wert,0),
              ROUND(eh_wert - eh_vergleich, 0)
       FROM v_detail
       WHERE dokument_id=${did}
         AND ABS(eh_wert - eh_vergleich) > 20000
       ORDER BY ABS(eh_wert - eh_vergleich) DESC LIMIT 20`,
    ).map((r) => [
      r[0] || "",
      r[1] || "",
      r[2] || "",
      round(r[3] || 0),
      round(r[4] || 0),
      round(r[5] || 0),
    ])
  }

  // R4 — Budgetierungspolster (nur fuer Voranschlaege). Wo liegt VA
  // spuerbar ueber dem letzten Ist (eh_dritte)? Analog
  // web/sql/08-budgetierungspolster.sql, parametriert.
  let polster
  if (dokTyp === "VA") {
    polster = rows(
      db,
      `SELECT bezeichnung, gruppe_text,
              ROUND(eh_dritte,0),
              ROUND(eh_wert,0),
              ROUND(eh_wert - eh_dritte,0),
              CASE WHEN eh_dritte > 0
                THEN ROUND(100.0*(eh_wert-eh_dritte)/eh_dritte,0)
                ELSE NULL END
       FROM v_detail
       WHERE richtung='ausgabe' AND eh_dritte > 2000
         AND eh_wert - eh_dritte > 5000
         AND dokument_id=${did}
       ORDER BY (eh_wert - eh_dritte) DESC LIMIT 20`,
    ).map((r) => [
      r[0] || "",
      r[1] || "",
      round(r[2] || 0),
      round(r[3] || 0),
      round(r[4] || 0),
      r[5] == null ? null : Math.round(Number(r[5])),
    ])
  }

  return {
    eckwerte: {
      ertraege: round(ertraege),
      aufwand: round(aufwand),
      netto: round(netto),
      komm: round(komm),
      komm_anteil: ertraege
        ? roundHalfEven((100 * komm) / ertraege, 1)
        : 0.0,
      // R1 — Vergleichssummen + Prozent-Delta. Labeling im UI greift
      // dokument.spalte_vergleich ab (VA=Vorjahr, RA=Soll laut VA).
      ertraege_vgl: round(ertraegeVgl),
      aufwand_vgl: round(aufwandVgl),
      netto_vgl: round(nettoVgl),
      komm_vgl: round(kommVgl),
      delta_ertraege_proz: deltaProz(ertraege, ertraegeVgl),
      delta_aufwand_proz: deltaProz(aufwand, aufwandVgl),
      delta_netto_proz: deltaProz(netto, nettoVgl),
      delta_komm_proz: deltaProz(komm, kommVgl),
      // Komm-Anteil: Differenz in Prozentpunkten (nicht Prozent), wenn
      // sich Komm-Anteil-Wert messbar veraendert hat.
      delta_komm_anteil_pp: ertraegeVgl
        ? roundHalfEven(
            (100 * komm) / (ertraege || 1) - (100 * kommVgl) / ertraegeVgl,
            1,
          )
        : null,
      // R5 — Pro-Kopf-Werte, null wenn keine Einwohnerzahl gesetzt.
      ertraege_pk: ew(ertraege),
      aufwand_pk: ew(aufwand),
      netto_pk: ew(netto),
      komm_pk: ew(komm),
      // R2 — Schuldendienst (Tilgung + Zinsen) inkl. Pro-Kopf.
      schuldendienst: round(schuldendienst),
      schuldendienst_pk: ew(schuldendienst),
    },
    einnahmen: (() => {
      // R10: Anteil am Gesamtertrag mitgeben. Gesamtertrag = Summe ALLER
      // operativen Einnahmen (nicht nur der Top-12 — sonst summieren sich
      // die angezeigten Anteile auf >100 %).
      const total = ertraege || 1
      return einnahmen.map(([b, v]) => [
        b,
        round(v),
        Math.round((100 * v) / total),
      ])
    })(),
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
    // R2 — Aufnahme/Tilgung/Schuldendienst je Dokument.
    finanzierung: {
      aufnahme: round(finAufnahme),
      tilgung: round(finTilgung),
      schuldendienst: round(schuldendienst),
    },
    // R12 — Investitions-Finanzierung. Eigen = Rest, mit Disclaimer.
    investFinanzierung: {
      foerderung: round(foerderung),
      darlehen: round(investDarlehen),
      eigen: round(investEigen),
    },
    // R3 — Soll-Ist-Liste (nur RA). Bei VA bleibt das Feld undefined,
    // damit die Chart-Builder defensiv `?? []` zurueckfallen.
    sollIst,
    // R4 — Polster-Liste (nur VA). Bei RA undefined.
    polster,
    // R7 — Saldo je Aufgabenbereich: [gruppe, gruppe_text, einnahmen,
    // ausgaben, saldo].
    gruppenSaldo: gruppenSaldoRows.map((r) => [
      r[0] || "",
      r[1] || "",
      round(r[2] || 0),
      round(r[3] || 0),
      round(r[4] || 0),
    ]),
    // R9 — Bindungs-Aggregation (gebunden vs. gestaltbar).
    bindung,
    // R8 — auf 100 normalisiert. einEuroAuf aus aufwand_art (Personal,
    // Sachaufwand, Transfers, Finanz, Sonstige); einEuroEin aus den
    // aggregierten sankey.quellen.
    einEuroAuf: (() => {
      const total = aufwandArt.reduce((s, [, v]) => s + (v || 0), 0) || 1
      return aufwandArt.map(([cat, v]) => [
        cat,
        Math.round((100 * (v || 0)) / total),
      ])
    })(),
    // Einnahmen-Klassifikation analog Sankey: 833000 Kommunalsteuer usw.
    // Auf der Einnahmenseite normalisiert auf 100.
    einEuroEin: (() => {
      // sankey-Quellen sind schon aggregiert — sie verwendet round() je
      // Eintrag, also lieber direkt aus DB lesen, um konsistente Summen
      // zu erhalten.
      const ein = sankey(db, did).quellen
      const total = ein.reduce((s, [, v]) => s + (v || 0), 0) || 1
      return ein.map(([q, v]) => [q, Math.round((100 * v) / total)])
    })(),
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
  // R2 — Schuldenstand-Trend: pro Dokument die Bewegung aus Aufnahme und
  // Tilgung (gebarung='finanzierung'), zusammen mit dem KUMULATIVEN Stand
  // ueber alle Dokumente in chronologischer Reihenfolge. Der absolute
  // Stand zum Bilanzstichtag ist NICHT modelliert — nur die kumulative
  // Bewegung aus den eingelesenen Dokumenten.
  const finPro = rows(
    db,
    `SELECT spalte_wert,
            SUM(CASE WHEN richtung='einnahme' THEN fh_wert ELSE 0 END),
            SUM(CASE WHEN richtung='ausgabe'  THEN fh_wert ELSE 0 END),
            typ
     FROM v_detail WHERE gebarung='finanzierung'
     GROUP BY dokument_id ORDER BY finanzjahr, ${ORDER}`,
  )
  let schuldenKum = 0
  const schuldenstand = finPro.map(([label, auf, til, typ]) => {
    const a = auf || 0
    const t = til || 0
    schuldenKum += a - t
    return [label, round(a), round(t), round(schuldenKum), typ]
  })

  return {
    // [label, ertraege, aufwand, netto, typ]
    eckwerte: eckwerte.map((r) => [r[0], r[1], r[2], r[3], r[4]]),
    // [label, betrag, typ]
    komm: komm.map((r) => [r[0], r[1], r[2]]),
    // [label, personal, sach, transfer, finanz, typ]
    aufwand: aufwand.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5]]),
    // R2 — [label, aufnahme, tilgung, kum_stand, typ]
    schuldenstand,
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
