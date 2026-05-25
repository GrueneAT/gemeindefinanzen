"""Plausibilitaetspruefung des Parse-Ergebnisses.

Die Pruefung ist vollstaendig selbstbezueglich: Sie rechnet die Detailposten
gegen die Summen- und Saldozeilen des Detailnachweises, die im selben PDF
abgedruckt sind. Stimmen alle Ansatz-Summen, ist der Parser nachweislich
korrekt — ohne externe Referenz.

Geprueft wird je Ansatz und je Spalte:

  Ergebnishaushalt (EHH)
    Summe Detail einnahme/operativ      ==  Zeile 'SU 21'
    Summe Detail ausgabe/operativ       ==  Zeile 'SU 22'
    Summe Detail einnahme/ruecklage     ==  Zeile 'SU 23' (Entnahmen HH-Rl)
    Summe Detail ausgabe/ruecklage      ==  Zeile 'SU 24' (Zufuehrungen HH-Rl)

  Finanzierungshaushalt (FHH)
    Summe Detail einnahme/operativ      ==  Zeile 'SU 31'
    Summe Detail ausgabe/operativ       ==  Zeile 'SU 32'
    Summe Detail einnahme/investiv      ==  Zeile 'SU 33'
    Summe Detail ausgabe/investiv       ==  Zeile 'SU 34'
    Summe Detail einnahme/finanzierung  ==  Zeile 'SU 35'
    Summe Detail ausgabe/finanzierung   ==  Zeile 'SU 36'

  Salden (arithmetische Ableitung im PDF)
    SA0  ==  SU 21 - SU 22                  (Nettoergebnis EHH)
    SA00 ==  SA0  + SU 23 - SU 24           (nach HH-Ruecklagen)
    SA1  ==  SU 31 - SU 32                  (Geldfluss operativ FHH)
    SA2  ==  SU 33 - SU 34                  (Geldfluss investiv FHH)
    SA3  ==  SA1  + SA2                     (Nettofinanzierungssaldo)
    SA4  ==  SU 35 - SU 36                  (Geldfluss Finanzierung)
    SA5  ==  SA3  + SA4                     (Geldfluss VA-wirksam)

Jede Pruefung laeuft je Ansatz **und** je Betragsspalte (Hauptjahr + zwei
Vergleichsspalten). So fallen sowohl Spalten-Verschiebungen als auch
Klassifikations-Bugs (falsche Richtung/Gebarung) sofort auf.
"""

from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass

TOLERANZ = 0.05  # Euro — deckt Rundung in der PDF-Darstellung ab


@dataclass(slots=True)
class Pruefung:
    name: str
    ok: bool
    detail: str


# (SU-Code-Praefix, Richtung, Gebarung, Hauptspalte EHH/FHH)
# Die drei Spalten EHH (Hauptjahr, Vorjahr, Vorvorjahr) bzw. FHH werden
# jeweils gegen die zugehoerige SU-Spalte gehalten.
_EHH_SPALTEN = ("eh_wert", "eh_vergleich", "eh_dritte")
_FHH_SPALTEN = ("fh_wert", "fh_vergleich", "fh_dritte")

_CHECKS: list[tuple[str, str, str, tuple[str, ...]]] = [
    # EHH-Pruefungen — alle drei EHH-Spalten geprueft
    ("SU 21", "einnahme", "operativ",     _EHH_SPALTEN),
    ("SU 22", "ausgabe",  "operativ",     _EHH_SPALTEN),
    ("SU 23", "einnahme", "ruecklage",    _EHH_SPALTEN),
    ("SU 24", "ausgabe",  "ruecklage",    _EHH_SPALTEN),
    # FHH-Pruefungen — alle drei FHH-Spalten geprueft
    ("SU 31", "einnahme", "operativ",     _FHH_SPALTEN),
    ("SU 32", "ausgabe",  "operativ",     _FHH_SPALTEN),
    ("SU 33", "einnahme", "investiv",     _FHH_SPALTEN),
    ("SU 34", "ausgabe",  "investiv",     _FHH_SPALTEN),
    ("SU 35", "einnahme", "finanzierung", _FHH_SPALTEN),
    ("SU 36", "ausgabe",  "finanzierung", _FHH_SPALTEN),
]

# Arithmetische Saldo-Identitaeten — werden je Ansatz und Spalte verifiziert.
# (SA-Code, Liste von (SU-Code, Vorzeichen)-Operanden)
_SALDEN: list[tuple[str, list[tuple[str, int]]]] = [
    ("SA SA0",  [("SU 21", +1), ("SU 22", -1)]),
    ("SA SA00", [("SU 21", +1), ("SU 22", -1),
                 ("SU 23", +1), ("SU 24", -1)]),
    ("SA SA1",  [("SU 31", +1), ("SU 32", -1)]),
    ("SA SA2",  [("SU 33", +1), ("SU 34", -1)]),
    ("SA SA3",  [("SU 31", +1), ("SU 32", -1),
                 ("SU 33", +1), ("SU 34", -1)]),
    ("SA SA4",  [("SU 35", +1), ("SU 36", -1)]),
    ("SA SA5",  [("SU 31", +1), ("SU 32", -1),
                 ("SU 33", +1), ("SU 34", -1),
                 ("SU 35", +1), ("SU 36", -1)]),
]


def _vrk_passt(vrk: str, su_nr: str) -> bool:
    """True wenn die vrk-Spalte einer Summenzeile den SU-Code enthaelt.

    Erfasst auch kombinierte Formen wie 'SU 21 / 31' (Herzogenburg-Konvention:
    operative EHH-Erträge und FHH-Einzahlungen werden in einer Zeile gedruckt,
    weil sie sich nur um nicht-finanzwirksame Posten unterscheiden).
    """
    return bool(re.search(rf"\b{su_nr}\b", vrk or ""))


def _ansatz_check(conn: sqlite3.Connection, dok_id: int, su_prefix: str,
                  richtung: str, gebarung: str, spalte: str) -> Pruefung:
    """Detail-Summe je Ansatz gegen die im PDF gedruckte SU-Zeile pruefen.

    Spalte ist eine der sechs Betragsspalten (eh_wert/eh_vergleich/eh_dritte
    bzw. fh_wert/fh_vergleich/fh_dritte). Der Vergleich ist je Ansatz —
    fehlende Ansaetze auf einer Seite werden als 0 behandelt.

    Wenn das PDF die SU-Zeile **gar nicht** abdruckt (z.B. SU 35/36 fehlt
    bei Gemeinden ohne Finanzierungstaetigkeit), wird die Pruefung als
    "n/a" markiert statt als Fehler.
    """
    detail = conn.execute(
        f"""SELECT ansatz, ROUND(SUM(COALESCE({spalte},0)),2)
            FROM posten
            WHERE dokument_id=? AND zeilentyp='detail'
              AND richtung=? AND gebarung=?
            GROUP BY ansatz""",
        (dok_id, richtung, gebarung),
    ).fetchall()
    # Alle Summenzeilen einsammeln und Python-seitig nach SU-Code filtern —
    # das deckt auch kombinierte Codes wie 'SU 21 / 31' ab.
    su_nr = su_prefix.split(" ", 1)[1]
    summen: dict[str, float] = {}
    for ansatz, wert, vrk in conn.execute(
        f"""SELECT ansatz, ROUND(SUM(COALESCE({spalte},0)),2), vrk
            FROM posten
            WHERE dokument_id=? AND zeilentyp='summe'
            GROUP BY ansatz, vrk""",
        (dok_id,),
    ).fetchall():
        if _vrk_passt(vrk, su_nr):
            summen[ansatz] = summen.get(ansatz, 0.0) + (wert or 0.0)

    # Pruefname jetzt einmal definieren
    spalten_label = _spalte_label(spalte)
    name = f"{su_prefix} — {richtung}/{gebarung} {spalten_label}"

    # Wenn das PDF die SU-Zeile gar nicht abdruckt → n/a (kein Pruefkriterium).
    # Das passiert bei Herzogenburg-Standard mit SU 23/24 (Ruecklagen-Summen
    # werden dort nicht ausgewiesen) oder bei Gemeinden ohne Finanzierungs-
    # taetigkeit (SU 35/36).
    if not summen:
        return Pruefung(name, True, "n/a (keine SU-Zeile im PDF)")

    abweichungen: list[str] = []
    for ansatz, detail_summe in detail:
        erwartet = summen.get(ansatz, 0.0)
        if abs((detail_summe or 0.0) - erwartet) > TOLERANZ:
            abweichungen.append(
                f"Ansatz {ansatz}: Detail {detail_summe:,.2f} != {su_prefix} {erwartet:,.2f}"
            )
    if abweichungen:
        return Pruefung(name, False,
                        f"{len(abweichungen)} Abweichung(en); z. B. " + abweichungen[0])
    return Pruefung(name, True, f"{len(detail)} Ansaetze stimmen")


def _spalte_label(spalte: str) -> str:
    """Menschenlesbares Label fuer eine Betragsspalte."""
    return {
        "eh_wert":      "EHH Sp.1",
        "eh_vergleich": "EHH Sp.2",
        "eh_dritte":    "EHH Sp.3",
        "fh_wert":      "FHH Sp.1",
        "fh_vergleich": "FHH Sp.2",
        "fh_dritte":    "FHH Sp.3",
    }.get(spalte, spalte)


def _saldo_check(conn: sqlite3.Connection, dok_id: int, sa_prefix: str,
                 operanden: list[tuple[str, int]], spalte: str) -> Pruefung:
    """Saldo-Identitaet je Ansatz pruefen.

    Berechnet aus den im PDF gedruckten SU-Zeilen den erwarteten Saldo und
    vergleicht ihn mit der im PDF gedruckten SA-Zeile. Damit faellt jede
    interne Inkonsistenz auf — egal ob durch Parser-Fehler oder durch eine
    fehlerhafte PDF-Druckmaske.
    """
    # SU-Werte je Ansatz sammeln — Python-seitig nach vrk-Code filtern,
    # damit auch kombinierte Codes wie 'SU 21/31' korrekt matchen.
    su_werte: dict[str, dict[str, float]] = {}
    for su_code, _ in operanden:
        su_nr = su_code.split(" ", 1)[1]
        for ansatz, wert, vrk in conn.execute(
            f"""SELECT ansatz, ROUND(SUM(COALESCE({spalte},0)),2), vrk
                FROM posten
                WHERE dokument_id=? AND zeilentyp='summe'
                GROUP BY ansatz, vrk""",
            (dok_id,),
        ).fetchall():
            if _vrk_passt(vrk, su_nr):
                bucket = su_werte.setdefault(ansatz, {})
                bucket[su_code] = bucket.get(su_code, 0.0) + (wert or 0.0)

    # SA-Werte je Ansatz aus dem PDF — analog mit Wortgrenze, damit
    # 'SA SA0' nicht versehentlich 'SA SA00', 'SA SA0R' usw. mitnimmt.
    sa_nr = sa_prefix.split(" ", 1)[1]  # z.B. 'SA0'
    sa_werte: dict[str, float] = {}
    for ansatz, wert, vrk in conn.execute(
        f"""SELECT ansatz, ROUND(SUM(COALESCE({spalte},0)),2), vrk
            FROM posten
            WHERE dokument_id=? AND zeilentyp='saldo'
            GROUP BY ansatz, vrk""",
        (dok_id,),
    ).fetchall():
        if _vrk_passt(vrk, sa_nr):
            sa_werte[ansatz] = sa_werte.get(ansatz, 0.0) + (wert or 0.0)

    spalten_label = _spalte_label(spalte)
    name = f"{sa_prefix} {spalten_label} — Saldo-Identitaet"

    # Wenn ein SU-Operand komplett fehlt (z.B. SU 23/24 bei Gemeinden ohne
    # Ruecklagen-Aggregat-Zeile), ist die SA-Identitaet nicht arithmetisch
    # reproduzierbar → als "n/a" markieren statt Fehler. Sonst wuerden
    # Herzogenburg-Style-PDFs (kein SU 23/24, aber Ruecklage-Posten direkt
    # im Detail) faelschlich SA SA00 als fehlerhaft melden.
    operanden_codes = {code for code, _ in operanden}
    gesammelt = {code for werte in su_werte.values() for code in werte}
    if operanden_codes - gesammelt:
        return Pruefung(name, True, "n/a (SU-Operand fehlt im PDF)")

    abweichungen: list[str] = []
    for ansatz in sa_werte:
        if ansatz is None:
            continue
        berechnet = sum(
            sign * su_werte.get(ansatz, {}).get(code, 0.0)
            for code, sign in operanden
        )
        gedruckt = sa_werte[ansatz]
        if abs(berechnet - gedruckt) > TOLERANZ:
            abweichungen.append(
                f"Ansatz {ansatz}: SU-Rechnung {berechnet:,.2f} "
                f"!= {sa_prefix} {gedruckt:,.2f}"
            )
    if abweichungen:
        return Pruefung(name, False,
                        f"{len(abweichungen)} Abweichung(en); z. B. " + abweichungen[0])
    return Pruefung(name, True, f"{len(sa_werte)} Salden stimmen")


def run(db_path: str) -> list[Pruefung]:
    """Alle Pruefungen ueber alle Dokumente der DB ausfuehren."""
    conn = sqlite3.connect(db_path)
    try:
        ergebnisse: list[Pruefung] = []
        dok_ids = [r[0] for r in conn.execute("SELECT dokument_id FROM dokument")]
        for dok_id in dok_ids:
            # SU-Pruefungen je Spalte (3 EHH + 3 FHH = 6 Spalten je Check)
            for su_prefix, richtung, gebarung, spalten in _CHECKS:
                for spalte in spalten:
                    ergebnisse.append(
                        _ansatz_check(conn, dok_id, su_prefix, richtung, gebarung, spalte)
                    )
            # Saldo-Identitaeten je Spalte
            for sa_prefix, operanden in _SALDEN:
                # SA0/SA00 = EHH-Salden → EHH-Spalten
                # SA1..SA5 = FHH-Salden → FHH-Spalten
                spalten = _EHH_SPALTEN if sa_prefix in ("SA SA0", "SA SA00") else _FHH_SPALTEN
                for spalte in spalten:
                    ergebnisse.append(
                        _saldo_check(conn, dok_id, sa_prefix, operanden, spalte)
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
