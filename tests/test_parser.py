"""Tests fuer Parser, Loader und Plausibilitaetspruefung.

Die integrativen Tests laufen gegen die echten PDF in documents/ und werden
uebersprungen, falls sie fehlen.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from gemeindefinanzen import loader, parser, validate
from gemeindefinanzen.loader import _spalten
from gemeindefinanzen.parser import _amount_column, _num

DOCS = Path(__file__).resolve().parents[1] / "documents"
VA_PDF = DOCS / "VA-2026-Auflage.pdf"
va_vorhanden = pytest.mark.skipif(not VA_PDF.exists(), reason="VA-2026-Auflage.pdf fehlt")
docs_vorhanden = pytest.mark.skipif(
    not DOCS.is_dir() or not list(DOCS.glob("*.pdf")), reason="documents/ leer")


# --- Einheitstests: Betragsformat -----------------------------------------
@pytest.mark.parametrize("text,erwartet", [
    ("4.900.000,00", 4_900_000.0),
    ("-374.800,00", -374_800.0),
    ("0,00", 0.0),
    ("69,80", 69.8),
])
def test_num_parst_deutsche_betraege(text: str, erwartet: float) -> None:
    assert _num(text) == erwartet


@pytest.mark.parametrize("text", ["", "abc", "12", "1.2", "Seite 7"])
def test_num_lehnt_nichtbetraege_ab(text: str) -> None:
    assert _num(text) is None


def test_amount_column_ordnet_ueber_rechte_kante_zu() -> None:
    assert _amount_column(463.7) == 0
    assert _amount_column(588.4) == 2
    assert _amount_column(786.9) == 5
    assert _amount_column(500.0) is None


# --- Einheitstests: Spaltenbedeutung je Dokumenttyp -----------------------
def test_spalten_voranschlag() -> None:
    assert _spalten("VA", 2026) == ("VA 2026", "VA 2025", "RA 2024")


def test_spalten_rechnungsabschluss() -> None:
    assert _spalten("RA", 2025) == ("RA 2025", "VA 2025", "Abweichung RA-VA")


def test_spalten_nachtragsvoranschlag() -> None:
    assert _spalten("NVA", 2025) == ("VA 2025 inkl. NVA", "VA 2025", "1. NVA")


# --- Integrationstests: echte PDF -----------------------------------------
@pytest.fixture(scope="module")
def ergebnis() -> parser.ParseResult:
    return parser.parse_document(str(VA_PDF))


@va_vorhanden
def test_parst_alle_detailzeilen(ergebnis: parser.ParseResult) -> None:
    detail = [p for p in ergebnis.posten if p.zeilentyp == "detail"]
    assert len(detail) == 1408
    assert not ergebnis.warnungen


@va_vorhanden
def test_kommunalsteuer_korrekt(ergebnis: parser.ParseResult) -> None:
    komm = [p for p in ergebnis.posten if p.konto == "833000"
            and p.zeilentyp == "detail"]
    assert len(komm) == 1
    p = komm[0]
    assert p.richtung == "einnahme"
    assert p.eh_wert == 4_900_000.0
    assert p.eh_vergleich == 4_800_000.0
    assert p.eh_dritte == 4_548_999.20
    assert p.gruppe == "9"


@va_vorhanden
def test_richtung_folgt_dem_vorzeichen(ergebnis: parser.ParseResult) -> None:
    for p in ergebnis.posten:
        if p.zeilentyp != "detail":
            continue
        zeichen = p.vrk.split("/")[1]
        if "+" in zeichen:
            assert p.richtung == "einnahme"
        elif "-" in zeichen:
            assert p.richtung == "ausgabe"


@va_vorhanden
def test_jeder_detailposten_hat_ansatz_und_konto(ergebnis: parser.ParseResult) -> None:
    for p in ergebnis.posten:
        if p.zeilentyp == "detail":
            assert p.ansatz and len(p.ansatz) == 6
            assert p.konto and len(p.konto) == 6


@docs_vorhanden
def test_alle_dokumente_laden_und_validieren(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    pdfs = sorted(DOCS.glob("*.pdf"))
    for pdf in pdfs:
        loader.build_database(str(pdf), str(db))

    conn = sqlite3.connect(db)
    try:
        anzahl = conn.execute("SELECT COUNT(*) FROM dokument").fetchone()[0]
    finally:
        conn.close()
    assert anzahl == len(pdfs)

    # Plausibilitaet: alle Detailsummen stimmen mit den PDF-Summen — je Dokument
    ergebnisse = validate.run(str(db))
    assert ergebnisse
    assert all(p.ok for p in ergebnisse), [p.name for p in ergebnisse if not p.ok]


@docs_vorhanden
def test_wiederholtes_laden_ist_idempotent(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    loader.build_database(str(VA_PDF), str(db))
    loader.build_database(str(VA_PDF), str(db))  # zweites Mal
    conn = sqlite3.connect(db)
    try:
        anzahl = conn.execute("SELECT COUNT(*) FROM dokument").fetchone()[0]
    finally:
        conn.close()
    assert anzahl == 1  # kein Duplikat


@va_vorhanden
def test_views_liefern_eckwerte(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    loader.build_database(str(VA_PDF), str(db))
    conn = sqlite3.connect(db)
    try:
        ertraege, aufwand, netto = conn.execute(
            "SELECT ertraege, aufwand, nettoergebnis FROM v_eckwerte"
        ).fetchone()
    finally:
        conn.close()
    assert ertraege > aufwand
    assert round(netto, 2) == round(ertraege - aufwand, 2)
