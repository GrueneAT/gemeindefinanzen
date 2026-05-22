"""Datensammlung fuer das interaktive Dashboard.

`collect(db_path)` liest alle geladenen Dokumente in einem Schritt aus und
liefert ein einziges, JSON-serialisierbares Datenobjekt. Suche, Filter,
Tabwechsel und Drill-down arbeiten clientseitig auf dieser Struktur — es gibt
keine Server-Abfragen im Browser.

Struktur des Rueckgabewerts:

- ``dokumente``  — Liste der Dokumente (id, typ, jahr, label, Spaltentexte).
- ``posten``    — kompaktes Array ALLER ``v_detail``-Zeilen aller Dokumente
                  mit kurzen Feldnamen.
- ``aggregate`` — je Dokument vorberechnete Werte fuer die Tabs 1-6.
- ``trend``     — Zeitreihen ueber alle Dokumente.
- ``meta``      — Gemeinde, Zaehlwerte, Default-Dokument.
"""

from __future__ import annotations

import sqlite3

# Chronologische Sortierung: innerhalb eines Jahres Ist vor Plan.
_ORDER = "CASE typ WHEN 'RA' THEN 0 WHEN 'NVA' THEN 1 WHEN 'VA' THEN 2 ELSE 3 END"

# Kommunalsteuer-Konto — eine der groessten Ertragsquellen einer Gemeinde.
_KOMM = "833000"


def _rows(conn: sqlite3.Connection, sql: str, *args: object) -> list[tuple]:
    return conn.execute(sql, args).fetchall()


def _scalar(conn: sqlite3.Connection, sql: str, *args: object) -> float:
    r = conn.execute(sql, args).fetchone()
    return float(r[0]) if r and r[0] is not None else 0.0


def _aufwand_art(mvag: str | None) -> str:
    """MVAG-Praefix auf eine Aufwandsart abbilden."""
    prefix = (mvag or "")[:3]
    return {"221": "Personal", "222": "Sachaufwand",
            "223": "Transfers", "224": "Finanz"}.get(prefix, "Sonstige")


def _dokumente(conn: sqlite3.Connection) -> list[dict]:
    """Alle Dokumente in chronologischer Reihenfolge."""
    zeilen = _rows(conn, f"""
        SELECT dokument_id, typ, finanzjahr, spalte_wert,
               spalte_vergleich, spalte_dritte
        FROM dokument ORDER BY finanzjahr, {_ORDER}""")
    return [{"id": did, "typ": typ, "jahr": jahr, "label": sw,
             "spalte_wert": sw, "spalte_vergleich": sv, "spalte_dritte": sd}
            for did, typ, jahr, sw, sv, sd in zeilen]


def _posten(conn: sqlite3.Connection) -> list[dict]:
    """Alle Detailposten aller Dokumente als kompaktes Array."""
    zeilen = _rows(conn, f"""
        SELECT dokument_id, typ, finanzjahr, richtung, gebarung,
               gruppe, gruppe_text, ansatz, ansatz_text, konto,
               konto_text, bezeichnung, mvag_eh, qu,
               eh_wert, eh_vergleich, eh_dritte,
               fh_wert, fh_vergleich, fh_dritte
        FROM v_detail ORDER BY dokument_id, gruppe, ansatz, {_ORDER}""")
    out: list[dict] = []
    for (dok, typ, jahr, richtung, gebarung, gruppe, gruppe_text, ansatz,
         ansatz_text, konto, konto_text, bezeichnung, mvag_eh, qu,
         eh_wert, eh_vergleich, eh_dritte,
         fh_wert, fh_vergleich, fh_dritte) in zeilen:
        out.append({
            "dok": dok, "typ": typ, "jahr": jahr, "richtung": richtung,
            "gebarung": gebarung, "gruppe": gruppe or "",
            "gruppe_text": gruppe_text or "", "ansatz": ansatz or "",
            "ansatz_text": ansatz_text or "", "konto": konto or "",
            "konto_text": konto_text or "", "bezeichnung": bezeichnung or "",
            "mvag": mvag_eh or "", "qu": qu or "",
            "ew": round(eh_wert or 0.0, 2),
            "ev": round(eh_vergleich or 0.0, 2),
            "ed": round(eh_dritte or 0.0, 2),
            "fw": round(fh_wert or 0.0, 2),
            "fv": round(fh_vergleich or 0.0, 2),
            "fd": round(fh_dritte or 0.0, 2),
        })
    return out


def _sankey(conn: sqlite3.Connection, did: int) -> dict:
    """Geldfluss-Knoten/-Kanten: Einnahmequellen -> Haushalt -> Gruppen."""
    quellen = _rows(conn, """
        SELECT CASE
                 WHEN konto='859400' THEN 'Ertragsanteile (Bund)'
                 WHEN konto='833000' THEN 'Kommunalsteuer'
                 WHEN konto IN ('830000','831000') THEN 'Grundsteuer'
                 WHEN konto LIKE '852%' OR konto LIKE '810%'
                   THEN 'Gebuehren & Leistungen'
                 WHEN substr(mvag_eh,1,3)='212'
                   THEN 'Transfers & Zuschuesse'
                 ELSE 'Sonstige Einnahmen' END AS quelle,
               SUM(eh_wert)
        FROM v_detail WHERE richtung='einnahme' AND eh_wert>0 AND dokument_id=?
        GROUP BY quelle""", did)
    gruppen = _rows(conn, """
        SELECT gruppe_text, SUM(eh_wert) FROM v_detail
        WHERE richtung='ausgabe' AND eh_wert>0 AND dokument_id=?
        GROUP BY gruppe_text ORDER BY 2 DESC""", did)
    return {"quellen": [[q, round(v)] for q, v in quellen],
            "gruppen": [[g or "ohne Gruppe", round(v)] for g, v in gruppen]}


def _aggregate_dok(conn: sqlite3.Connection, did: int) -> dict:
    """Alle vorberechneten Werte fuer die Tabs 1-6 eines Dokuments."""
    ertraege = _scalar(conn, "SELECT SUM(eh_wert) FROM v_detail "
                       "WHERE richtung='einnahme' AND dokument_id=?", did)
    aufwand = _scalar(conn, "SELECT SUM(eh_wert) FROM v_detail "
                      "WHERE richtung='ausgabe' AND dokument_id=?", did)
    komm = _scalar(conn, "SELECT eh_wert FROM v_detail "
                   f"WHERE konto='{_KOMM}' AND dokument_id=?", did)
    netto = ertraege - aufwand

    einnahmen = _rows(conn, """
        SELECT bezeichnung, eh_wert FROM v_detail
        WHERE richtung='einnahme' AND eh_wert>0 AND dokument_id=?
        ORDER BY eh_wert DESC LIMIT 12""", did)

    aufwand_art = _rows(conn, """
        SELECT CASE substr(mvag_eh,1,3)
                 WHEN '221' THEN 'Personal' WHEN '222' THEN 'Sachaufwand'
                 WHEN '223' THEN 'Transfers' WHEN '224' THEN 'Finanz'
                 ELSE 'Sonstige' END,
               SUM(eh_wert)
        FROM v_detail WHERE richtung='ausgabe' AND eh_wert>0 AND dokument_id=?
        GROUP BY 1 ORDER BY 2 DESC""", did)

    treemap = _rows(conn, """
        SELECT gruppe_text, ansatz_text, SUM(eh_wert) FROM v_detail
        WHERE richtung='ausgabe' AND eh_wert>0 AND dokument_id=?
        GROUP BY gruppe_text, ansatz_text""", did)

    treiber = _rows(conn, """
        SELECT bezeichnung, eh_delta FROM v_detail
        WHERE richtung='ausgabe' AND eh_delta>0 AND dokument_id=?
        ORDER BY eh_delta DESC LIMIT 12""", did)

    korridor = _rows(conn, """
        WITH s AS (SELECT bezeichnung, fh_wert FROM v_detail
                   WHERE richtung='ausgabe' AND gebarung='operativ'
                     AND substr(mvag_eh,1,3)='222' AND fh_wert>0
                     AND konto NOT LIKE '68%'
                     AND bezeichnung NOT LIKE '%errechnungsr%'
                     AND dokument_id=?)
        SELECT bezeichnung, fh_wert,
               SUM(fh_wert) OVER (ORDER BY fh_wert DESC
                                  ROWS UNBOUNDED PRECEDING)
        FROM s ORDER BY fh_wert DESC LIMIT 18""", did)

    transfers = _rows(conn, """
        SELECT bezeichnung, eh_wert, eh_vergleich FROM v_detail
        WHERE richtung='ausgabe' AND substr(mvag_eh,1,3)='223'
          AND eh_wert>0 AND dokument_id=?
        ORDER BY eh_wert DESC LIMIT 14""", did)

    # Investive Auszahlungen stehen im Finanzierungshaushalt (fh_wert),
    # nicht im Ergebnishaushalt — siehe docs/SCHEMA.md.
    investitionen = _rows(conn, """
        SELECT bezeichnung, ansatz_text, fh_wert FROM v_detail
        WHERE richtung='ausgabe' AND gebarung='investiv'
          AND fh_wert>0 AND dokument_id=?
        ORDER BY fh_wert DESC LIMIT 14""", did)

    gruppen = _rows(conn, """
        SELECT gruppe, gruppe_text, SUM(eh_wert) FROM v_detail
        WHERE richtung='ausgabe' AND eh_wert>0 AND dokument_id=?
        GROUP BY gruppe, gruppe_text ORDER BY gruppe""", did)

    return {
        "eckwerte": {"ertraege": round(ertraege), "aufwand": round(aufwand),
                     "netto": round(netto), "komm": round(komm),
                     "komm_anteil": round(100 * komm / ertraege, 1)
                     if ertraege else 0.0},
        "einnahmen": [[b, round(v)] for b, v in einnahmen],
        "aufwand_art": [[a, round(v)] for a, v in aufwand_art],
        "treemap": [[g or "ohne Gruppe", a or "ohne Ansatz", round(v)]
                    for g, a, v in treemap],
        "treiber": [[b, round(v)] for b, v in treiber],
        "korridor": [[b, round(v), round(k)] for b, v, k in korridor],
        "transfers": [[b, round(v), round(vg or 0)]
                      for b, v, vg in transfers],
        "investitionen": [[b, a or "", round(v)]
                          for b, a, v in investitionen],
        "gruppen": [[g or "", gt or "", round(v)] for g, gt, v in gruppen],
        "sankey": _sankey(conn, did),
    }


def _trend(conn: sqlite3.Connection) -> dict:
    """Zeitreihen ueber alle Dokumente."""
    eckwerte = _rows(conn, f"""
        SELECT spalte_wert, ROUND(ertraege), ROUND(aufwand),
               ROUND(nettoergebnis)
        FROM v_eckwerte ORDER BY finanzjahr, {_ORDER}""")
    komm = _rows(conn, """
        SELECT dokument, ROUND(eh_wert) FROM v_zeitreihe
        WHERE konto='833000' ORDER BY finanzjahr, typ""")
    aufwand = _rows(conn, f"""
        SELECT spalte_wert,
               ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='221'
                         THEN eh_wert ELSE 0 END)),
               ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='222'
                         THEN eh_wert ELSE 0 END)),
               ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='223'
                         THEN eh_wert ELSE 0 END)),
               ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='224'
                         THEN eh_wert ELSE 0 END))
        FROM v_detail WHERE richtung='ausgabe'
        GROUP BY dokument_id ORDER BY finanzjahr, {_ORDER}""")
    return {
        "eckwerte": [[r[0], r[1], r[2], r[3]] for r in eckwerte],
        "komm": [[r[0], r[1]] for r in komm],
        "aufwand": [[r[0], r[1], r[2], r[3], r[4]] for r in aufwand],
    }


def collect(db_path: str) -> dict:
    """Alle Dashboard-Daten in einem JSON-serialisierbaren Objekt einsammeln."""
    conn = sqlite3.connect(db_path)
    try:
        dokumente = _dokumente(conn)
        gemeinde = conn.execute(
            "SELECT gemeinde FROM dokument LIMIT 1").fetchone()
        posten = _posten(conn)
        aggregate = {str(d["id"]): _aggregate_dok(conn, d["id"])
                     for d in dokumente}
        trend = _trend(conn)
    finally:
        conn.close()

    # Default-Dokument: juengster Voranschlag, sonst juengstes Dokument.
    va = [d for d in dokumente if d["typ"] == "VA"]
    default = (va[-1] if va else dokumente[-1])["id"] if dokumente else 0

    return {
        "meta": {
            "gemeinde": gemeinde[0] if gemeinde else "",
            "dok_anzahl": len(dokumente),
            "posten_anzahl": len(posten),
            "default_dok": default,
        },
        "dokumente": dokumente,
        "posten": posten,
        "aggregate": aggregate,
        "trend": trend,
    }
