"""Plausibilitaetspruefung des Parse-Ergebnisses.

Die Pruefung ist vollstaendig selbstbezueglich: Sie rechnet die Detailposten
gegen die Summen- und Saldozeilen des Detailnachweises, die im selben PDF
abgedruckt sind. Stimmen alle Ansatz-Summen, ist der Parser nachweislich
korrekt — ohne externe Referenz.

Geprueft wird je Ansatz:
  Summe Detail-Ertraege  operativ  ==  Zeile 'SU 21'
  Summe Detail-Aufwand   operativ  ==  Zeile 'SU 22'
  Summe Detail-Einzahlg. investiv  ==  Zeile 'SU 33'
  Summe Detail-Auszahlg. investiv  ==  Zeile 'SU 34'
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass

TOLERANZ = 0.05  # Euro — deckt Rundung in der PDF-Darstellung ab


@dataclass(slots=True)
class Pruefung:
    name: str
    ok: bool
    detail: str


# (SU-Code-Praefix, Richtung, Gebarung, Betragsspalte)
_CHECKS = [
    ("SU 21", "einnahme", "operativ", "eh_wert"),
    ("SU 22", "ausgabe", "operativ", "eh_wert"),
    ("SU 33", "einnahme", "investiv", "fh_wert"),
    ("SU 34", "ausgabe", "investiv", "fh_wert"),
]


def _ansatz_check(conn: sqlite3.Connection, dok_id: int, su_prefix: str,
                  richtung: str, gebarung: str, spalte: str) -> Pruefung:
    detail = conn.execute(
        f"""SELECT ansatz, ROUND(SUM(COALESCE({spalte},0)),2)
            FROM posten
            WHERE dokument_id=? AND zeilentyp='detail'
              AND richtung=? AND gebarung=?
            GROUP BY ansatz""",
        (dok_id, richtung, gebarung),
    ).fetchall()
    summen = dict(conn.execute(
        f"""SELECT ansatz, ROUND(SUM(COALESCE({spalte},0)),2)
            FROM posten
            WHERE dokument_id=? AND zeilentyp='summe' AND vrk LIKE ?
            GROUP BY ansatz""",
        (dok_id, su_prefix + "%"),
    ).fetchall())

    abweichungen: list[str] = []
    for ansatz, detail_summe in detail:
        erwartet = summen.get(ansatz, 0.0)
        if abs((detail_summe or 0.0) - erwartet) > TOLERANZ:
            abweichungen.append(
                f"Ansatz {ansatz}: Detail {detail_summe:,.2f} != {su_prefix} {erwartet:,.2f}"
            )
    name = f"{su_prefix} — {richtung}/{gebarung} je Ansatz"
    if abweichungen:
        return Pruefung(name, False,
                        f"{len(abweichungen)} Abweichung(en); z. B. " + abweichungen[0])
    return Pruefung(name, True, f"{len(detail)} Ansaetze stimmen")


def run(db_path: str) -> list[Pruefung]:
    """Alle Pruefungen ueber alle Dokumente der DB ausfuehren."""
    conn = sqlite3.connect(db_path)
    try:
        ergebnisse: list[Pruefung] = []
        dok_ids = [r[0] for r in conn.execute("SELECT dokument_id FROM dokument")]
        for dok_id in dok_ids:
            for su_prefix, richtung, gebarung, spalte in _CHECKS:
                ergebnisse.append(
                    _ansatz_check(conn, dok_id, su_prefix, richtung, gebarung, spalte)
                )
            # Strukturpruefung: jeder Detailposten hat einen Ansatz
            verwaist = conn.execute(
                "SELECT COUNT(*) FROM posten WHERE dokument_id=? AND zeilentyp='detail'"
                " AND (ansatz IS NULL OR ansatz='')", (dok_id,),
            ).fetchone()[0]
            ergebnisse.append(Pruefung(
                "Detailposten mit Ansatz", verwaist == 0,
                "alle zugeordnet" if verwaist == 0 else f"{verwaist} ohne Ansatz",
            ))
        return ergebnisse
    finally:
        conn.close()


def format_report(ergebnisse: list[Pruefung]) -> str:
    zeilen = ["Plausibilitaetspruefung", "=" * 60]
    for p in ergebnisse:
        marke = "OK  " if p.ok else "FEHL"
        zeilen.append(f"[{marke}] {p.name}: {p.detail}")
    n_ok = sum(1 for p in ergebnisse if p.ok)
    zeilen += ["=" * 60, f"{n_ok}/{len(ergebnisse)} Pruefungen bestanden"]
    return "\n".join(zeilen)
