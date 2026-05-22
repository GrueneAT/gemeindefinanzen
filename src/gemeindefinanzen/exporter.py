"""Export der Datenbank nach CSV und Excel.

CSV ist immer verfuegbar (Standardbibliothek). Excel nur, wenn ``openpyxl``
installiert ist (``pip install '.[export]'``) — andernfalls wird es uebersprungen.
"""

from __future__ import annotations

import csv
import sqlite3
from pathlib import Path

# Tabellen/Views, die exportiert werden
_EXPORTS = ["v_detail", "v_ansatz_summe", "v_gruppe_summe", "v_eckwerte"]


def _dump_csv(conn: sqlite3.Connection, view: str, ziel: Path) -> Path:
    cur = conn.execute(f"SELECT * FROM {view}")
    spalten = [d[0] for d in cur.description]
    with ziel.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.writer(fh, delimiter=";")
        writer.writerow(spalten)
        writer.writerows(cur.fetchall())
    return ziel


def _dump_excel(conn: sqlite3.Connection, ziel: Path) -> Path | None:
    try:
        from openpyxl import Workbook
    except ImportError:
        return None
    wb = Workbook()
    wb.remove(wb.active)
    for view in _EXPORTS:
        cur = conn.execute(f"SELECT * FROM {view}")
        ws = wb.create_sheet(title=view[:31])
        ws.append([d[0] for d in cur.description])
        for zeile in cur.fetchall():
            ws.append(list(zeile))
        ws.freeze_panes = "A2"
    wb.save(ziel)
    return ziel


def export_all(db_path: str, out_dir: str) -> list[Path]:
    """Alle Views nach CSV und (falls moeglich) in eine Excel-Mappe schreiben."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    geschrieben: list[Path] = []
    try:
        for view in _EXPORTS:
            geschrieben.append(_dump_csv(conn, view, out / f"{view}.csv"))
        excel = _dump_excel(conn, out / "gemeindefinanzen.xlsx")
        if excel is not None:
            geschrieben.append(excel)
    finally:
        conn.close()
    return geschrieben
