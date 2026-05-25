"""Cross-Validator: PDF-Parser-Ergebnis gegen OH-CSV als Ground-Truth.

Pro PDF im Korpus, fuer das EHH und/oder FHH CSV vorliegen:

1. PDF mit ``parser.parse_document`` parsen → Detail-Posten.
2. CSV(s) einlesen → erwartete Werte je (Ansatz, Konto) und Haushalt (ehh/fhh).
3. PDF-Detail je (Ansatz, Konto) aggregieren (Summe der eh_wert / fh_wert).
4. Vergleich: Konten mit Abweichung > Toleranz → Diff-Eintrag.

Bericht: ``documents/_cross_validate_bericht.md`` + ``_cross_validate.json``.
Pro PDF eine Tabelle der Top-Abweichungen und eine Globalstatistik.

Aufrufe::
    PYTHONPATH=src python3 scripts/cross_validate.py
    PYTHONPATH=src python3 scripts/cross_validate.py --bundesland tirol
    PYTHONPATH=src python3 scripts/cross_validate.py --pdf <pfad>
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from gemeindefinanzen import parser  # noqa: E402

KORPUS = ROOT / "documents" / "korpus"
BERICHT_MD = ROOT / "documents" / "_cross_validate_bericht.md"
BERICHT_JSON = ROOT / "documents" / "_cross_validate.json"

# Vergleichs-Toleranz: 0.50 € deckt Rundungs-Drift aus Mehrfach-Posten
# je (Ansatz, Konto) ab. Bei Cent-genauem Match wird's wackelig wenn die
# CSV unterschiedliche MVAG-Varianten zusammenfasst.
TOLERANZ = 0.5


@dataclass(slots=True)
class Vergleich:
    pdf: str
    bundesland: str
    csv_ehh_zeilen: int = 0
    csv_fhh_zeilen: int = 0
    pdf_detail_zeilen: int = 0
    # Aggregat (Anzahl Ansatz/Konto-Schluessel mit Abweichung)
    konten_csv: int = 0
    konten_uebereinstimmend: int = 0
    konten_abweichend: int = 0
    konten_nur_csv: int = 0
    konten_nur_pdf: int = 0
    # Gesamt-Summen
    summe_csv_ehh: float = 0.0
    summe_csv_fhh: float = 0.0
    summe_pdf_ehh: float = 0.0
    summe_pdf_fhh: float = 0.0
    top_abweichungen: list[dict] = field(default_factory=list)
    fehler: str = ""


def _num_eu(s: str) -> float:
    """Deutschen Betragsstring lesen."""
    if not s:
        return 0.0
    s = s.strip().strip('"').replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def _csv_pfade(pdf: Path) -> tuple[Path, Path]:
    """Aus PDF-Pfad die passenden EHH/FHH-CSV-Pfade ableiten."""
    stem = pdf.stem  # z.B. 'oberwart-ra-2025'
    return (pdf.parent / f"{stem}-ehh.csv",
            pdf.parent / f"{stem}-fhh.csv")


def _lade_csv(pfad: Path) -> dict[tuple[str, str], float]:
    """CSV einlesen und auf (Ansatz, Konto) aggregieren."""
    daten: dict[tuple[str, str], float] = defaultdict(float)
    if not pfad.is_file():
        return daten
    with pfad.open(encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            # OH-Spalten: Ansatz-Uab+Ansatz-Ugl (jeweils 3-stellig) → 6-stelliger Ansatz
            # Konto-Grp+Konto-Ugl (jeweils 3-stellig) → 6-stelliger Konto
            uab = row.get("Ansatz-Uab", "").zfill(3)
            ugl = row.get("Ansatz-Ugl", "").zfill(3)
            kgrp = row.get("Konto-Grp", "").zfill(3)
            kugl = row.get("Konto-Ugl", "").zfill(3)
            ansatz = (uab + ugl)[-6:]
            konto = (kgrp + kugl)[-6:]
            wert = _num_eu(row.get("Wert", "0"))
            daten[(ansatz, konto)] += wert
    return daten


def _pdf_aggregat(pdf: Path) -> tuple[dict[tuple[str, str], float],
                                       dict[tuple[str, str], float], int]:
    """PDF parsen und Detail-Posten je (Ansatz, Konto) summieren.

    Liefert ``(ehh_sums, fhh_sums, anzahl_detailposten)``.
    """
    r = parser.parse_document(str(pdf))
    ehh: dict[tuple[str, str], float] = defaultdict(float)
    fhh: dict[tuple[str, str], float] = defaultdict(float)
    n = 0
    for p in r.posten:
        if p.zeilentyp != "detail" or not p.ansatz or not p.konto:
            continue
        n += 1
        key = (p.ansatz, p.konto)
        if p.eh_wert is not None:
            ehh[key] += p.eh_wert
        if p.fh_wert is not None:
            fhh[key] += p.fh_wert
    return ehh, fhh, n


def vergleiche_pdf(pdf: Path, bundesland: str) -> Vergleich:
    """Eine PDF voll gegen ihre CSVs validieren."""
    v = Vergleich(pdf=str(pdf.relative_to(ROOT)), bundesland=bundesland)
    ehh_csv_pfad, fhh_csv_pfad = _csv_pfade(pdf)
    if not (ehh_csv_pfad.exists() or fhh_csv_pfad.exists()):
        v.fehler = "Keine CSV verfuegbar"
        return v

    csv_ehh = _lade_csv(ehh_csv_pfad)
    csv_fhh = _lade_csv(fhh_csv_pfad)
    v.csv_ehh_zeilen = len(csv_ehh)
    v.csv_fhh_zeilen = len(csv_fhh)
    v.summe_csv_ehh = round(sum(csv_ehh.values()), 2)
    v.summe_csv_fhh = round(sum(csv_fhh.values()), 2)

    try:
        pdf_ehh, pdf_fhh, n_detail = _pdf_aggregat(pdf)
    except BaseException as e:  # noqa: BLE001
        v.fehler = f"PDF-Parse-Exception: {type(e).__name__}: {e}"
        return v

    v.pdf_detail_zeilen = n_detail
    v.summe_pdf_ehh = round(sum(pdf_ehh.values()), 2)
    v.summe_pdf_fhh = round(sum(pdf_fhh.values()), 2)

    # Vergleich: jedes (Ansatz, Konto)-Paar aus beiden Mengen
    # **0-Wert-Posten ignorieren**: CSV von offenerhaushalt.at und der PDF-
    # Parser behandeln "leere" Konten unterschiedlich (mal werden 0-Werte
    # explizit ausgegeben, mal nicht). Fuer den Werte-Vergleich uninteressant.
    def _hat_wert(d: dict[tuple[str, str], float], k: tuple[str, str]) -> bool:
        return abs(d.get(k, 0.0)) > TOLERANZ

    alle_keys = set(csv_ehh) | set(csv_fhh) | set(pdf_ehh) | set(pdf_fhh)
    diffs: list[dict] = []
    n_match = n_diff = n_only_csv = n_only_pdf = 0
    for key in alle_keys:
        ce = csv_ehh.get(key, 0.0)
        cf = csv_fhh.get(key, 0.0)
        pe = pdf_ehh.get(key, 0.0)
        pf = pdf_fhh.get(key, 0.0)
        d_ehh = pe - ce
        d_fhh = pf - cf

        in_csv = _hat_wert(csv_ehh, key) or _hat_wert(csv_fhh, key)
        in_pdf = _hat_wert(pdf_ehh, key) or _hat_wert(pdf_fhh, key)
        if not in_csv and not in_pdf:
            continue  # Beide-0-Posten: nicht zaehlen
        if in_csv and not in_pdf:
            n_only_csv += 1
        elif in_pdf and not in_csv:
            n_only_pdf += 1
        elif abs(d_ehh) > TOLERANZ or abs(d_fhh) > TOLERANZ:
            n_diff += 1
            diffs.append({
                "ansatz": key[0], "konto": key[1],
                "csv_ehh": round(ce, 2), "pdf_ehh": round(pe, 2),
                "diff_ehh": round(d_ehh, 2),
                "csv_fhh": round(cf, 2), "pdf_fhh": round(pf, 2),
                "diff_fhh": round(d_fhh, 2),
                "abs_diff_max": round(max(abs(d_ehh), abs(d_fhh)), 2),
            })
        else:
            n_match += 1

    v.konten_csv = len(set(csv_ehh) | set(csv_fhh))
    v.konten_uebereinstimmend = n_match
    v.konten_abweichend = n_diff
    v.konten_nur_csv = n_only_csv
    v.konten_nur_pdf = n_only_pdf
    diffs.sort(key=lambda d: -d["abs_diff_max"])
    v.top_abweichungen = diffs[:20]
    return v


def sammle_pdfs(bundesland: str | None, pdf_arg: str | None) -> list[tuple[Path, str]]:
    """Liefert (Pfad, Bundesland)-Paare mit verfuegbaren CSVs."""
    if pdf_arg:
        p = Path(pdf_arg).resolve()
        bl = p.parent.name
        return [(p, bl)]
    if not KORPUS.is_dir():
        return []
    paare: list[tuple[Path, str]] = []
    for bl_dir in sorted(KORPUS.iterdir()):
        if not bl_dir.is_dir():
            continue
        if bundesland and bl_dir.name != bundesland:
            continue
        for pdf_pfad in sorted(bl_dir.glob("*.pdf")):
            ehh, fhh = _csv_pfade(pdf_pfad)
            if ehh.exists() or fhh.exists():
                paare.append((pdf_pfad, bl_dir.name))
    return paare


def schreibe_md(vergleiche: list[Vergleich]) -> None:
    if not vergleiche:
        BERICHT_MD.write_text("# Cross-Validation\n\n(keine PDFs mit CSVs gefunden)\n",
                              encoding="utf-8")
        return

    n = len(vergleiche)
    perfekt = sum(1 for v in vergleiche if v.konten_abweichend == 0
                  and v.konten_nur_csv == 0 and v.konten_nur_pdf == 0 and not v.fehler)
    z: list[str] = ["# Cross-Validation PDF vs OH-CSV", ""]
    z += [
        f"- PDFs mit CSV-Vergleich: **{n}**",
        f"- Perfekt uebereinstimmend (0 Abweichungen): **{perfekt}** ({perfekt*100//n}%)",
        "",
        "## Pro PDF",
        "",
        "| PDF | CSV-Konten | OK | Abw. | Nur CSV | Nur PDF | EHH-Diff | FHH-Diff |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for v in sorted(vergleiche, key=lambda x: (x.bundesland, x.pdf)):
        ehh_diff = round(v.summe_pdf_ehh - v.summe_csv_ehh, 2)
        fhh_diff = round(v.summe_pdf_fhh - v.summe_csv_fhh, 2)
        z.append(
            f"| `{Path(v.pdf).name}` | {v.konten_csv} | {v.konten_uebereinstimmend} | "
            f"{v.konten_abweichend} | {v.konten_nur_csv} | {v.konten_nur_pdf} | "
            f"{ehh_diff:,.2f} | {fhh_diff:,.2f} |"
        )

    z += ["", "## Top-Abweichungen je PDF", ""]
    for v in sorted(vergleiche, key=lambda x: -(x.konten_abweichend
                                                or x.konten_nur_csv
                                                or x.konten_nur_pdf)):
        if v.konten_abweichend == 0 and v.konten_nur_csv == 0 and v.konten_nur_pdf == 0:
            continue
        z += [f"### {Path(v.pdf).name}",
              f"({v.konten_abweichend} Abw., {v.konten_nur_csv} nur CSV, "
              f"{v.konten_nur_pdf} nur PDF)", ""]
        if v.fehler:
            z.append(f"FEHLER: {v.fehler}")
            z.append("")
            continue
        z.append("| Ansatz | Konto | CSV EHH | PDF EHH | Diff EHH | CSV FHH | PDF FHH | Diff FHH |")
        z.append("|---|---|---:|---:|---:|---:|---:|---:|")
        for d in v.top_abweichungen[:8]:
            z.append(
                f"| {d['ansatz']} | {d['konto']} | "
                f"{d['csv_ehh']:,.2f} | {d['pdf_ehh']:,.2f} | {d['diff_ehh']:,.2f} | "
                f"{d['csv_fhh']:,.2f} | {d['pdf_fhh']:,.2f} | {d['diff_fhh']:,.2f} |"
            )
        z.append("")
    BERICHT_MD.write_text("\n".join(z), encoding="utf-8")


def schreibe_json(vergleiche: list[Vergleich]) -> None:
    BERICHT_JSON.write_text(json.dumps(
        [asdict(v) for v in vergleiche], indent=2, ensure_ascii=False
    ), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bundesland", help="nur dieses Bundesland")
    ap.add_argument("--pdf", help="eine einzelne PDF")
    args = ap.parse_args(argv)

    paare = sammle_pdfs(args.bundesland, args.pdf)
    if not paare:
        print("Kein PDF mit verfuegbarer CSV.", file=sys.stderr)
        return 1

    vergleiche: list[Vergleich] = []
    for i, (pdf, bl) in enumerate(paare, 1):
        v = vergleiche_pdf(pdf, bl)
        vergleiche.append(v)
        marke = "OK" if v.konten_abweichend == 0 and v.konten_nur_csv == 0 \
                       and v.konten_nur_pdf == 0 and not v.fehler else "DIFF"
        print(f"  [{i:>3}/{len(paare)}] {bl}/{pdf.name}: {marke} "
              f"(CSV={v.konten_csv}, ok={v.konten_uebereinstimmend}, "
              f"abw={v.konten_abweichend}, nur_csv={v.konten_nur_csv}, "
              f"nur_pdf={v.konten_nur_pdf})")

    schreibe_md(vergleiche)
    schreibe_json(vergleiche)
    n_perfekt = sum(1 for v in vergleiche if v.konten_abweichend == 0
                    and v.konten_nur_csv == 0 and v.konten_nur_pdf == 0
                    and not v.fehler)
    print(f"\n{n_perfekt}/{len(vergleiche)} PDFs perfekt uebereinstimmend. "
          f"Bericht: {BERICHT_MD.relative_to(ROOT)}")
    return 0 if n_perfekt == len(vergleiche) else 2


if __name__ == "__main__":
    raise SystemExit(main())
