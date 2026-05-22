"""SQLite-Loader: Parse-Ergebnis in eine abfragbare Datenbank schreiben.

Das Schema (``schema.sql``) ist mehrjahr- und mehrdokumentfaehig — jeder
Aufruf von :func:`build_database` legt ein weiteres ``dokument`` an, sodass
Voranschlaege, Nachtragsvoranschlaege und Rechnungsabschluesse mehrerer Jahre
in derselben Datei nebeneinander liegen und vergleichbar werden.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from . import extract, reference
from .parser import ParseResult, parse_document

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def _connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


def _spalten(typ: str, jahr: int | None) -> tuple[str, str, str]:
    """Bedeutung der drei Detailnachweis-Betragsspalten je Dokumenttyp.

    Diese Zuordnung wurde an den Seitenkoepfen der PDF verifiziert:
      Voranschlag:        VA Jahr            | VA Vorjahr | RA Vorvorjahr
      Nachtragsvoranschl.: VA Jahr inkl. NVA | VA Jahr    | 1. NVA (Aenderung)
      Rechnungsabschluss: RA Jahr (Ist)      | VA Jahr    | Abweichung RA-VA
    """
    if jahr is None:
        return ("Spalte 1", "Spalte 2", "Spalte 3")
    if typ == "RA":
        return (f"RA {jahr}", f"VA {jahr}", "Abweichung RA-VA")
    if typ == "NVA":
        return (f"VA {jahr} inkl. NVA", f"VA {jahr}", "1. NVA")
    return (f"VA {jahr}", f"VA {jahr - 1}", f"RA {jahr - 2}")


def _insert_dokument(conn: sqlite3.Connection, path: str, meta: dict[str, str]) -> int:
    jahr = int(meta["finanzjahr"]) if meta["finanzjahr"].isdigit() else None
    fassung = "Auflage" if "auflage" in Path(path).stem.lower() else ""
    quelle = Path(path).name
    # Erneutes Einlesen derselben Datei ist idempotent: alte Zeilen entfernen.
    alt = conn.execute("SELECT dokument_id FROM dokument WHERE quelldatei=?",
                       (quelle,)).fetchall()
    for (dok_id,) in alt:
        conn.execute("DELETE FROM posten WHERE dokument_id=?", (dok_id,))
        conn.execute("DELETE FROM dokument WHERE dokument_id=?", (dok_id,))
    sp_wert, sp_vgl, sp_dritte = _spalten(meta["typ"], jahr)
    cur = conn.execute(
        """INSERT INTO dokument
           (gemeinde, typ, finanzjahr, spalte_wert, spalte_vergleich,
            spalte_dritte, fassung, quelldatei, seiten)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (meta["gemeinde"], meta["typ"], jahr, sp_wert, sp_vgl, sp_dritte,
         fassung, quelle, meta.get("seiten")),
    )
    return int(cur.lastrowid or 0)


def _load_reference(conn: sqlite3.Connection, result: ParseResult) -> None:
    conn.executemany(
        "INSERT OR IGNORE INTO ref_gruppe(gruppe, bezeichnung) VALUES (?,?)",
        reference.GRUPPEN.items(),
    )
    conn.executemany(
        "INSERT OR IGNORE INTO ref_mvag(mvag, bezeichnung) VALUES (?,?)",
        reference.MVAG.items(),
    )
    # Ansaetze und Konten stammen aus dem Dokument selbst (vollstaendig + korrekt).
    conn.executemany(
        "INSERT OR REPLACE INTO ref_ansatz(ansatz, bezeichnung, gruppe) VALUES (?,?,?)",
        [(a, name, a[:1]) for a, name in sorted(result.ansatz_namen.items())],
    )
    conn.executemany(
        "INSERT OR REPLACE INTO ref_konto(konto, bezeichnung, kontenklasse) VALUES (?,?,?)",
        [(k, name, reference.kontenklasse(k))
         for k, name in sorted(result.konto_namen.items())],
    )
    # MVAG-Codes, die im Dokument vorkommen, aber nicht in der Referenz stehen.
    seen = {p.mvag_eh for p in result.posten} | {p.mvag_fh for p in result.posten}
    conn.executemany(
        "INSERT OR IGNORE INTO ref_mvag(mvag, bezeichnung) VALUES (?,?)",
        [(m, reference.mvag_name(m)) for m in sorted(seen) if m],
    )


def _load_posten(conn: sqlite3.Connection, dok_id: int, result: ParseResult) -> None:
    conn.executemany(
        """INSERT INTO posten
           (dokument_id, seite, zeilentyp, richtung, vrk, ansatz, konto, gruppe,
            bezeichnung, gebarung, eh_wert, eh_vergleich, eh_dritte,
            fh_wert, fh_vergleich, fh_dritte, mvag_eh, mvag_fh, qu)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [(dok_id, p.seite, p.zeilentyp, p.richtung, p.vrk, p.ansatz, p.konto,
          p.gruppe, p.bezeichnung, p.gebarung, p.eh_wert, p.eh_vergleich,
          p.eh_dritte, p.fh_wert, p.fh_vergleich, p.fh_dritte,
          p.mvag_eh, p.mvag_fh, p.qu)
         for p in result.posten],
    )


def build_database(pdf_path: str, db_path: str) -> dict[str, int]:
    """PDF parsen und in eine (neue oder bestehende) SQLite-DB laden.

    Liefert eine kleine Statistik (dokument_id, Anzahl Posten je Typ).
    """
    doc = extract.open_document(pdf_path)
    meta = extract.document_meta(doc)
    meta["seiten"] = doc.page_count  # type: ignore[assignment]
    doc.close()

    result = parse_document(pdf_path)

    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = _connect(db_path)
    try:
        init_schema(conn)
        dok_id = _insert_dokument(conn, pdf_path, meta)
        _load_reference(conn, result)
        _load_posten(conn, dok_id, result)
        conn.commit()
    finally:
        conn.close()

    typen = {t: sum(1 for p in result.posten if p.zeilentyp == t)
             for t in ("detail", "summe", "saldo")}
    return {"dokument_id": dok_id, **typen,
            "ansaetze": len(result.ansatz_namen), "konten": len(result.konto_namen)}
