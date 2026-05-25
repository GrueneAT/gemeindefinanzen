"""Parser-Robustheitspruefung gegen den Bundesland-Korpus.

Laeuft Parser, Loader und Plausibilitaetspruefung ueber jede PDF unter
``documents/korpus/<bundesland>/`` und schreibt einen Bericht.

Aufruf::

    PYTHONPATH=src python scripts/validate_corpus.py
    PYTHONPATH=src python scripts/validate_corpus.py --bundesland tirol
    PYTHONPATH=src python scripts/validate_corpus.py --pdf documents/korpus/tirol/innsbruck-va-2026.pdf

Schreibt nach ``documents/_korpus_bericht.md`` und ``_korpus_bericht.json``.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
import tempfile
import time
import traceback
from collections import Counter
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from gemeindefinanzen import extract, loader, parser, validate  # noqa: E402


KORPUS_DIR = ROOT / "documents" / "korpus"
BERICHT_MD = ROOT / "documents" / "_korpus_bericht.md"
BERICHT_JSON = ROOT / "documents" / "_korpus_bericht.json"


@dataclass(slots=True)
class Ergebnis:
    pdf: str
    bundesland: str
    status: str           # OK | FAIL_*
    fehlerklasse: str     # leere String wenn ok
    detail: str
    seiten: int = 0
    detailposten: int = 0
    summen: int = 0
    ansaetze: int = 0
    pruefungen_ok: int = 0
    pruefungen_gesamt: int = 0
    pruefungs_fehler: list[str] = field(default_factory=list)
    dauer_s: float = 0.0


def _classify_parse_failure(e: BaseException) -> tuple[str, str]:
    """Heuristisch eine Fehlerklasse aus der Exception ableiten."""
    msg = f"{type(e).__name__}: {e}"
    if isinstance(e, (FileNotFoundError, IsADirectoryError)):
        return "EXTRACT_IO", msg
    if "FileDataError" in type(e).__name__ or "Cannot open" in str(e):
        return "EXTRACT_CORRUPT", msg
    if "Detailnachweis" in str(e):
        return "PARSE_NO_DETAIL", msg
    return "PARSE_EXCEPTION", msg


def _classify_validate(pruefungen: list[validate.Pruefung]) -> tuple[str, str]:
    """Wenn Validierung fehlschlaegt: welche Cluster?

    Trennt nach Cluster:
    - VALIDATE_SUMMEN  — SU-Detail-Aggregate stimmen nicht (Spalten/Richtung/Gebarung)
    - VALIDATE_SALDO   — SU-Identitaeten (SA0..SA5) stimmen nicht
    - VALIDATE_STRUKTUR — Detailposten ohne Ansatz (Layout-Problem)
    """
    fehler = [p for p in pruefungen if not p.ok]
    if not fehler:
        return "", ""
    su_fehler = [p for p in fehler if p.name.startswith("SU ")]
    saldo_fehler = [p for p in fehler if "Saldo-Identitaet" in p.name]
    struktur = [p for p in fehler if p.name == "Detailposten mit Ansatz"]
    teile: list[str] = []
    if su_fehler:
        teile.append(f"SU-Pruefungen: {len(su_fehler)} fail (z.B. {su_fehler[0].name})")
    if saldo_fehler:
        teile.append(f"Saldo-Identitaeten: {len(saldo_fehler)} fail")
    if struktur:
        teile.append(f"Strukturpruefung: {struktur[0].detail}")
    if struktur and not (su_fehler or saldo_fehler):
        klasse = "VALIDATE_STRUKTUR"
    elif saldo_fehler and not su_fehler:
        klasse = "VALIDATE_SALDO"
    else:
        klasse = "VALIDATE_SUMMEN"
    return klasse, "; ".join(teile)


def _out_of_scope_klasse(pdf: Path) -> tuple[str, str] | None:
    """Erkennt PDFs deren Inhalt strukturell **keinen** VRV-Detailnachweis
    enthaelt — also nicht von diesem Parser bearbeitbar sind, ohne dass das
    ein Bug waere.

    Liefert ``(klasse, detail)`` oder ``None``. Klassen:

    - ``OUT_OF_SCOPE_WIEN``      — Stadt-Wien-Doppelhaushalt (Querschnitt
      statt Detailnachweis; Datenmodell anders)
    - ``OUT_OF_SCOPE_BEREICHSBUDGET`` — Klagenfurt-Familie: MVAG-aggregierte
      Bereichsbudgets statt VA-Stellen-Detailnachweis
    - ``OUT_OF_SCOPE_IMAGE``     — gescanntes PDF ohne Textlayer
    - ``OUT_OF_SCOPE_UNVOLLSTAENDIG`` — Kurzfassung/Beilage statt
      Vollvoranschlag (kein Detailnachweis enthalten)
    - ``OUT_OF_SCOPE_FREMDDOKUMENT`` — kein Voranschlag/Rechnungsabschluss,
      z.B. Gemeindezeitung mit Budget-Notiz
    """
    import fitz  # noqa: PLC0415

    try:
        doc = fitz.open(str(pdf))
    except Exception:
        return None

    try:
        n = doc.page_count
        # 1) Image-PDF: alle ersten 5 Seiten haben leeren Textlayer
        sample = list(range(min(5, n)))
        text_total = sum(len(doc[p].get_text().strip()) for p in sample)
        if text_total < 50:
            return ("OUT_OF_SCOPE_IMAGE",
                    f"Image-PDF ohne Textlayer (Sample-Text {text_total} Z.)")

        # 2) Wien: spezifisches Wien-Marker auf den ersten Seiten — Wortgrenze
        #    noetig, weil "stadt wien" sonst auch "stadt wiener neustadt" matcht.
        head = "\n".join(doc[p].get_text() for p in sample).lower()
        wien_markers = (
            re.compile(r"\bwienbibliothek\b"),
            re.compile(r"\bstadt\s+wien\b(?!er)"),
            re.compile(r"\bmagistrat\s+der\s+stadt\s+wien\b(?!er)"),
            re.compile(r"\bwiener\s+stadtwerke\b"),
            re.compile(r"\bbundeshauptstadt\s+wien\b(?!er)"),
            re.compile(r"\bland\s+wien\b(?!er)"),
        )
        if any(pat.search(head) for pat in wien_markers):
            return ("OUT_OF_SCOPE_WIEN",
                    "Stadt-Wien-Doppelhaushalt (Querschnitt statt Detailnachweis)")

        # 3) Klagenfurt-Bereichsbudget: TOC enthaelt "Bereichsbudget" aber
        #    nirgends "Detailnachweis"; das gesamte Dokument hat <= 5 Seiten
        #    mit dem Wort "Detailnachweis".
        toc = doc.get_toc()
        toc_titles = " ".join(title.lower() for _, title, _ in toc)
        if "bereichsbudget" in toc_titles and "detailnachweis" not in toc_titles:
            detail_hits = sum(1 for p in range(n)
                              if "Detailnachweis" in doc[p].get_text())
            if detail_hits <= 5:
                return ("OUT_OF_SCOPE_BEREICHSBUDGET",
                        "MVAG-aggregierte Bereichsbudgets, keine VA-Stellen")

        # 4) Unvollstaendig: <= 80 Seiten und kein "Detailnachweis"-Header
        if n <= 80:
            detail_hits = sum(1 for p in range(n)
                              if "Detailnachweis" in doc[p].get_text())
            if detail_hits == 0:
                return ("OUT_OF_SCOPE_UNVOLLSTAENDIG",
                        f"Nur {n} Seiten, kein Detailnachweis-Header")
    finally:
        doc.close()
    return None


def pruefe_pdf(pdf: Path, bundesland: str) -> Ergebnis:
    """Eine PDF voll durchpruefen. Faengt jede Exception, klassifiziert sie."""
    start = time.monotonic()
    erg = Ergebnis(pdf=str(pdf.relative_to(ROOT)), bundesland=bundesland,
                   status="OK", fehlerklasse="", detail="")

    # 0) Out-of-Scope-Vorab-Klassifikation: PDFs ohne VRV-Detailnachweis
    out_of_scope = _out_of_scope_klasse(pdf)
    if out_of_scope is not None:
        klasse, detail = out_of_scope
        erg.status = "OUT_OF_SCOPE"
        erg.fehlerklasse = klasse
        erg.detail = detail
        erg.dauer_s = round(time.monotonic() - start, 2)
        return erg

    # 1) Lowlevel-Extraktion (Metadaten + Seitenanzahl)
    try:
        doc = extract.open_document(str(pdf))
        erg.seiten = doc.page_count
        doc.close()
    except BaseException as e:  # noqa: BLE001 — wir wollen ALLES fangen
        erg.fehlerklasse, erg.detail = _classify_parse_failure(e)
        erg.status = "FAIL_EXTRACT"
        erg.dauer_s = round(time.monotonic() - start, 2)
        return erg

    # 2) Parser
    try:
        result = parser.parse_document(str(pdf))
    except BaseException as e:  # noqa: BLE001
        erg.fehlerklasse, erg.detail = _classify_parse_failure(e)
        erg.status = "FAIL_PARSE"
        erg.dauer_s = round(time.monotonic() - start, 2)
        return erg

    erg.detailposten = sum(1 for p in result.posten if p.zeilentyp == "detail")
    erg.summen = sum(1 for p in result.posten if p.zeilentyp == "summe")
    erg.ansaetze = len(result.ansatz_namen)

    if erg.detailposten == 0:
        erg.status = "FAIL_PARSE"
        erg.fehlerklasse = "PARSE_NO_POSTEN"
        erg.detail = f"0 Detailposten extrahiert (Seiten={erg.seiten})"
        erg.dauer_s = round(time.monotonic() - start, 2)
        return erg

    # 3) Loader + Validator: in temporaerer DB, damit der Lauf isoliert ist
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name
    try:
        try:
            loader.build_database(str(pdf), db_path)
        except BaseException as e:  # noqa: BLE001
            erg.status = "FAIL_LOAD"
            erg.fehlerklasse = "LOAD_EXCEPTION"
            erg.detail = f"{type(e).__name__}: {e}"
            erg.dauer_s = round(time.monotonic() - start, 2)
            return erg

        try:
            pruefungen = validate.run(db_path)
        except sqlite3.Error as e:
            erg.status = "FAIL_VALIDATE"
            erg.fehlerklasse = "VALIDATE_SQL"
            erg.detail = f"{type(e).__name__}: {e}"
            erg.dauer_s = round(time.monotonic() - start, 2)
            return erg

        erg.pruefungen_gesamt = len(pruefungen)
        erg.pruefungen_ok = sum(1 for p in pruefungen if p.ok)
        erg.pruefungs_fehler = [f"{p.name}: {p.detail}"
                                for p in pruefungen if not p.ok][:5]

        if erg.pruefungen_ok < erg.pruefungen_gesamt:
            klasse, detail = _classify_validate(pruefungen)
            erg.status = "FAIL_VALIDATE"
            erg.fehlerklasse = klasse
            erg.detail = detail
    finally:
        Path(db_path).unlink(missing_ok=True)

    erg.dauer_s = round(time.monotonic() - start, 2)
    return erg


def sammle_pdfs(bundesland: str | None, pdf: str | None) -> list[tuple[Path, str]]:
    """Liefert (Pfad, Bundesland)-Paare aus dem Korpus."""
    if pdf:
        p = Path(pdf).resolve()
        bl = p.parent.name if p.parent.parent.name == "korpus" else "manuell"
        return [(p, bl)]
    if not KORPUS_DIR.is_dir():
        return []
    paare: list[tuple[Path, str]] = []
    for bl_dir in sorted(KORPUS_DIR.iterdir()):
        if not bl_dir.is_dir():
            continue
        if bundesland and bl_dir.name != bundesland:
            continue
        for pdf_pfad in sorted(bl_dir.glob("*.pdf")):
            paare.append((pdf_pfad, bl_dir.name))
    return paare


def schreibe_md(ergebnisse: list[Ergebnis]) -> None:
    """Markdown-Bericht: Zusammenfassung + Detailtabellen je Bundesland."""
    if not ergebnisse:
        BERICHT_MD.write_text("# Korpus-Bericht\n\n(keine PDFs gefunden)\n",
                              encoding="utf-8")
        return

    zeilen: list[str] = ["# Korpus-Bericht", ""]
    klasse_zaehler: Counter[str] = Counter(e.fehlerklasse or "OK"
                                           for e in ergebnisse)
    n_ok = sum(1 for e in ergebnisse if e.status == "OK")
    n_oos = sum(1 for e in ergebnisse if e.status == "OUT_OF_SCOPE")
    n_fehler = len(ergebnisse) - n_ok - n_oos
    zeilen += [
        f"- PDFs gesamt: **{len(ergebnisse)}**",
        f"- OK: **{n_ok}** ({n_ok * 100 // len(ergebnisse)}%)",
        f"- Out-of-Scope: **{n_oos}** (kein VRV-Detailnachweis im PDF)",
        f"- Echte Fehler: **{n_fehler}**",
        "",
        "## Fehlerklassen", "",
    ]
    for klasse, anz in klasse_zaehler.most_common():
        zeilen.append(f"- `{klasse}`: {anz}")
    zeilen += ["", "## Je Bundesland", ""]

    nach_bl: dict[str, list[Ergebnis]] = {}
    for e in ergebnisse:
        nach_bl.setdefault(e.bundesland, []).append(e)

    for bl in sorted(nach_bl):
        gruppe = nach_bl[bl]
        n_bl_ok = sum(1 for e in gruppe if e.status == "OK")
        zeilen += [f"### {bl} ({n_bl_ok}/{len(gruppe)} OK)", ""]
        zeilen.append("| PDF | Seiten | Posten | Pruefungen | Status | Detail |")
        zeilen.append("|---|---:|---:|---:|---|---|")
        for e in gruppe:
            name = Path(e.pdf).name
            pruef = (f"{e.pruefungen_ok}/{e.pruefungen_gesamt}"
                     if e.pruefungen_gesamt else "—")
            detail = (e.detail or "").replace("|", "\\|")[:80]
            zeilen.append(f"| `{name}` | {e.seiten} | {e.detailposten} | "
                          f"{pruef} | {e.status} | {detail} |")
        zeilen.append("")

    BERICHT_MD.write_text("\n".join(zeilen), encoding="utf-8")


def schreibe_json(ergebnisse: list[Ergebnis]) -> None:
    daten: dict[str, Any] = {
        "anzahl": len(ergebnisse),
        "ok": sum(1 for e in ergebnisse if e.status == "OK"),
        "out_of_scope": sum(1 for e in ergebnisse if e.status == "OUT_OF_SCOPE"),
        "klassen": dict(Counter(e.fehlerklasse or "OK" for e in ergebnisse)),
        "ergebnisse": [asdict(e) for e in ergebnisse],
    }
    BERICHT_JSON.write_text(json.dumps(daten, indent=2, ensure_ascii=False),
                            encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bundesland", help="nur dieses Bundesland (Ordnername)")
    ap.add_argument("--pdf", help="eine einzelne PDF pruefen")
    ap.add_argument("--quiet", action="store_true", help="weniger Ausgabe")
    args = ap.parse_args(argv)

    paare = sammle_pdfs(args.bundesland, args.pdf)
    if not paare:
        print("Kein PDF gefunden — Korpus leer oder Filter zu eng.",
              file=sys.stderr)
        return 1

    ergebnisse: list[Ergebnis] = []
    for i, (pfad, bl) in enumerate(paare, 1):
        try:
            erg = pruefe_pdf(pfad, bl)
        except BaseException as e:  # noqa: BLE001 — letzte Sicherung
            erg = Ergebnis(pdf=str(pfad.relative_to(ROOT)), bundesland=bl,
                           status="FAIL_UNEXPECTED",
                           fehlerklasse="UNEXPECTED",
                           detail=f"{type(e).__name__}: {e}\n"
                                  + traceback.format_exc()[:500])
        ergebnisse.append(erg)
        if not args.quiet:
            marke = "OK" if erg.status == "OK" else erg.fehlerklasse
            print(f"  [{i:>3}/{len(paare)}] {bl}/{pfad.name}: "
                  f"{marke} ({erg.dauer_s}s, {erg.detailposten} Posten, "
                  f"{erg.pruefungen_ok}/{erg.pruefungen_gesamt} Pruefungen)")

    schreibe_md(ergebnisse)
    schreibe_json(ergebnisse)

    n_ok = sum(1 for e in ergebnisse if e.status == "OK")
    n_oos = sum(1 for e in ergebnisse if e.status == "OUT_OF_SCOPE")
    n_fail = len(ergebnisse) - n_ok - n_oos
    print(f"\n{n_ok}/{len(ergebnisse)} PDFs voll bestanden, "
          f"{n_oos} out-of-scope, {n_fail} Fehler. "
          f"Bericht: {BERICHT_MD.relative_to(ROOT)}")
    return 0 if n_fail == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
