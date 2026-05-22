"""Kommandozeile fuer die Gemeindefinanz-Analyse.

    gemfin build   <pdf> --db <db>      PDF parsen und in SQLite laden
    gemfin validate       --db <db>      Plausibilitaetspruefung
    gemfin query          --db <db>      gespeicherte Abfragen ausfuehren
    gemfin report         --db <db>      HTML-Dashboard erzeugen
    gemfin export         --db <db>      Daten nach CSV / Excel exportieren
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

from . import loader, validate

SQL_DIR = Path(__file__).resolve().parents[2] / "sql"


def _print_table(spalten: list[str], zeilen: list[tuple]) -> None:
    """Ergebnismenge als ausgerichtete Textspalten ausgeben."""
    if not zeilen:
        print("  (keine Zeilen)")
        return

    def fmt(v: object) -> str:
        if isinstance(v, float):
            return f"{v:,.2f}"
        return "" if v is None else str(v)

    text = [[fmt(v) for v in z] for z in zeilen]
    breite = [max(len(spalten[i]), *(len(r[i]) for r in text)) for i in range(len(spalten))]
    kopf = "  ".join(s.ljust(breite[i]) for i, s in enumerate(spalten))
    print("  " + kopf)
    print("  " + "  ".join("-" * b for b in breite))
    for r in text:
        print("  " + "  ".join(c.rjust(breite[i]) if c.replace(",", "").replace(".", "")
                               .replace("-", "").isdigit() else c.ljust(breite[i])
                               for i, c in enumerate(r)))


def _sammle_pdfs(pfade: list[str]) -> list[Path]:
    """Argumente zu einer PDF-Liste aufloesen (Dateien und Verzeichnisse)."""
    gefunden: list[Path] = []
    for p in pfade:
        pfad = Path(p)
        if pfad.is_dir():
            gefunden.extend(sorted(pfad.glob("*.pdf")))
        elif pfad.is_file():
            gefunden.append(pfad)
        else:
            print(f"Uebersprungen (nicht gefunden): {p}", file=sys.stderr)
    return gefunden


def cmd_build(args: argparse.Namespace) -> int:
    pdfs = _sammle_pdfs(args.pdf)
    if not pdfs:
        print("Keine PDF-Dateien gefunden.", file=sys.stderr)
        return 1
    # Frischer Aufbau: alte DB entfernen, damit das Schema aktuell ist.
    db = Path(args.db)
    if db.exists():
        db.unlink()
    for pdf in pdfs:
        stats = loader.build_database(str(pdf), args.db)
        print(f"[{stats['dokument_id']}] {pdf.name}: "
              f"{stats['detail']} Detailposten, "
              f"{stats['ansaetze']} Ansaetze, {stats['konten']} Konten")
    print(f"{len(pdfs)} Dokument(e) geladen in {args.db}")
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    ergebnisse = validate.run(args.db)
    print(validate.format_report(ergebnisse))
    return 0 if all(p.ok for p in ergebnisse) else 1


def cmd_query(args: argparse.Namespace) -> int:
    if not SQL_DIR.is_dir():
        print(f"Kein sql/-Verzeichnis: {SQL_DIR}", file=sys.stderr)
        return 1
    dateien = sorted(SQL_DIR.glob("*.sql"))
    if args.name:
        dateien = [f for f in dateien if args.name in f.stem]
    conn = sqlite3.connect(args.db)
    try:
        for sql_datei in dateien:
            sql = sql_datei.read_text(encoding="utf-8")
            titel = sql.splitlines()[0].lstrip("- ").strip()
            print(f"\n=== {sql_datei.stem} — {titel} ===")
            try:
                cur = conn.execute(sql)
                spalten = [d[0] for d in cur.description]
                _print_table(spalten, cur.fetchall())
            except sqlite3.Error as e:
                print(f"  SQL-Fehler: {e}", file=sys.stderr)
    finally:
        conn.close()
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    from . import report
    pfad = report.build_report(args.db, args.out)
    print(f"Dashboard erzeugt: {pfad}")
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    from . import exporter
    dateien = exporter.export_all(args.db, args.dir)
    for d in dateien:
        print(f"  geschrieben: {d}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="gemfin", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("build", help="PDF(s) parsen und in SQLite laden")
    sp.add_argument("pdf", nargs="+",
                    help="PDF-Dateien oder ein Verzeichnis mit PDFs")
    sp.add_argument("--db", default="data/gemeindefinanzen.db")
    sp.set_defaults(func=cmd_build)

    sp = sub.add_parser("validate", help="Plausibilitaetspruefung")
    sp.add_argument("--db", default="data/gemeindefinanzen.db")
    sp.set_defaults(func=cmd_validate)

    sp = sub.add_parser("query", help="gespeicherte Abfragen ausfuehren")
    sp.add_argument("--db", default="data/gemeindefinanzen.db")
    sp.add_argument("--name", help="nur Abfragen, deren Dateiname dies enthaelt")
    sp.add_argument("--all", action="store_true", help="alle Abfragen (Standard)")
    sp.set_defaults(func=cmd_query)

    sp = sub.add_parser("report", help="HTML-Dashboard erzeugen")
    sp.add_argument("--db", default="data/gemeindefinanzen.db")
    sp.add_argument("--out", default="reports/dashboard.html")
    sp.set_defaults(func=cmd_report)

    sp = sub.add_parser("export", help="Daten nach CSV / Excel exportieren")
    sp.add_argument("--db", default="data/gemeindefinanzen.db")
    sp.add_argument("--dir", default="data")
    sp.set_defaults(func=cmd_export)

    args = p.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
