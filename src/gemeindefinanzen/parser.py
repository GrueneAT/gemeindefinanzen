"""VRV-2015-Parser fuer den Detailnachweis.

Der Detailnachweis ist das vollstaendige Kerndatenblatt: jede einzelne
Haushaltsstelle mit Ergebnis- und Finanzierungshaushalt. Alle anderen Tabellen
des Voranschlags (Ergebnishaushalt, Querschnitt ...) sind Aggregationen davon.
Deshalb parst dieses Modul nur den Detailnachweis — daraus laesst sich der Rest
nachrechnen (siehe ``validate``).

Robustheit: Die sechs Betragsspalten sind im PDF exakt rechtsbuendig
ausgerichtet (konstante rechte Kante x1). Jedes Zahlwort wird ueber seine
rechte Kante der richtigen Spalte zugeordnet — unabhaengig davon, wie viele
Spalten in einer Zeile befuellt sind.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from . import extract

# --- Geometrie (aus VA-2026-Auflage.pdf vermessen, A4 quer) -----------------
# Rechte Kante (x1) der sechs Betragsspalten: EH VA / EH VA-VJ / EH RA-VJ |
#                                             FH VA / FH VA-VJ / FH RA-VJ
AMOUNT_X1: tuple[float, ...] = (463.7, 526.1, 588.4, 662.1, 724.5, 786.9)
AMOUNT_TOL = 7.0

X_CODE_MAX = 130.0     # Konto-/Summencode
X_LABEL_MAX = 280.0    # Bezeichnung
X_MVAG_FH = 304.0      # Grenze MVAG-EH | MVAG-FH
X_MVAG_MAX = 326.0     # Grenze MVAG | VC/QU
Y_HEADER = 90.0        # darueber: Seitenkopf
Y_FOOTER = 558.0       # darunter: Seitenfuss

# Detailzeilen-Schluessel '<typ>/<ansatz>±<konto>'. Die fuehrende Ziffer ist die
# Mittelherkunft (1 operativer Aufwand, 2 operativer Ertrag, 5 investive
# Auszahlung, 6 investive Einzahlung). Massgeblich fuer die Richtung ist das
# Vorzeichen: '-' = Ausgabe, '+' = Einnahme; die Gebarung kommt aus dem Kontext.
DETAIL_RE = re.compile(r"^(\d)/(\d{6})([+-])(\d{6})$")
NUMBER_RE = re.compile(r"^-?\d{1,3}(?:\.\d{3})*,\d{2}$")
GEBARUNG_LABELS = {
    "operative gebarung": "operativ",
    "investive gebarung": "investiv",
    "finanzierungstaetigkeit": "finanzierung",
    "finanzierungstätigkeit": "finanzierung",
}


@dataclass(slots=True)
class Posten:
    """Eine Zeile des Detailnachweises (Detailposten, Summe oder Saldo)."""

    seite: int
    zeilentyp: str               # 'detail' | 'summe' | 'saldo'
    bezeichnung: str
    vrk: str = ""                # voller Schluessel '2/920000+833000' bzw. Summencode
    richtung: str | None = None  # 'einnahme' | 'ausgabe'
    ansatz: str | None = None
    konto: str | None = None
    gruppe: str | None = None
    gebarung: str | None = None
    eh_wert: float | None = None       # Detailnachweis-Spalte 1 (Ergebnishaushalt)
    eh_vergleich: float | None = None  # Spalte 2
    eh_dritte: float | None = None     # Spalte 3
    fh_wert: float | None = None       # Spalte 1 (Finanzierungshaushalt)
    fh_vergleich: float | None = None  # Spalte 2
    fh_dritte: float | None = None     # Spalte 3
    mvag_eh: str = ""
    mvag_fh: str = ""
    qu: str = ""


@dataclass(slots=True)
class ParseResult:
    posten: list[Posten] = field(default_factory=list)
    ansatz_namen: dict[str, str] = field(default_factory=dict)
    konto_namen: dict[str, str] = field(default_factory=dict)
    warnungen: list[str] = field(default_factory=list)


def _num(text: str) -> float | None:
    """Deutschen Betrag ('4.900.000,00', '-374.800,00') als float lesen."""
    if not NUMBER_RE.match(text):
        return None
    return float(text.replace(".", "").replace(",", "."))


def _amount_column(x1: float) -> int | None:
    """Betragswort ueber seine rechte Kante einer der sechs Spalten zuordnen."""
    for idx, anchor in enumerate(AMOUNT_X1):
        if abs(x1 - anchor) <= AMOUNT_TOL:
            return idx
    return None


def _collect_amounts(words: list[extract.Word]) -> list[float | None]:
    """Sechs Betragsspalten einer Zeile fuellen (None = leer)."""
    cols: list[float | None] = [None] * 6
    for w in words:
        value = _num(w.text)
        if value is None:
            continue
        col = _amount_column(w.x1)
        if col is not None:
            cols[col] = value
    return cols


def _split_columns(words: list[extract.Word]) -> dict[str, list[extract.Word]]:
    """Woerter einer Zeile nach x-Lage den logischen Spalten zuordnen."""
    buckets: dict[str, list[extract.Word]] = {"code": [], "label": [], "mvag_eh": [],
                                              "mvag_fh": [], "qu": [], "amount": []}
    for w in words:
        if _num(w.text) is not None and _amount_column(w.x1) is not None:
            buckets["amount"].append(w)
        elif w.x0 < X_CODE_MAX:
            buckets["code"].append(w)
        elif w.x0 < X_LABEL_MAX:
            buckets["label"].append(w)
        elif w.x0 < X_MVAG_FH:
            buckets["mvag_eh"].append(w)
        elif w.x0 < X_MVAG_MAX:
            buckets["mvag_fh"].append(w)
        else:
            buckets["qu"].append(w)
    return buckets


def _digits(words: list[extract.Word]) -> str:
    return "".join(w.text for w in words if w.text.isdigit())


def parse_document(path: str) -> ParseResult:
    """Den Detailnachweis einer VRV-2015-PDF vollstaendig parsen."""
    doc = extract.open_document(path)
    sections = extract.section_ranges(doc)

    detail_section = next(
        (rng for title, rng in sections.items() if "Detailnachweis" in title), None
    )
    if detail_section is None:
        raise ValueError("Kein Abschnitt 'Detailnachweis' im PDF-Inhaltsverzeichnis gefunden.")
    start, end = detail_section

    result = ParseResult()
    cur_ansatz: str | None = None
    cur_gebarung: str | None = None
    last_detail: Posten | None = None

    for page in range(start, end + 1):
        for line in extract.page_lines(doc, page):
            if line.y < Y_HEADER or line.y > Y_FOOTER:
                continue
            words = line.words
            if not words:
                continue
            text = line.text.strip()
            if re.fullmatch(r"Seite\s+\d+", text):
                continue

            first = words[0].text
            buckets = _split_columns(words)
            label = " ".join(w.text for w in buckets["label"]).strip()

            # 1) Detailposten -------------------------------------------------
            m = DETAIL_RE.match(first)
            if m:
                _typ, ansatz, sign, konto = m.groups()
                amounts = _collect_amounts(buckets["amount"])
                posten = Posten(
                    seite=page + 1,
                    zeilentyp="detail",
                    bezeichnung=label,
                    vrk=first,
                    richtung="einnahme" if sign == "+" else "ausgabe",
                    ansatz=ansatz,
                    konto=konto,
                    gruppe=ansatz[:1],
                    gebarung=cur_gebarung,
                    eh_wert=amounts[0], eh_vergleich=amounts[1], eh_dritte=amounts[2],
                    fh_wert=amounts[3], fh_vergleich=amounts[4], fh_dritte=amounts[5],
                    mvag_eh=_digits(buckets["mvag_eh"]),
                    mvag_fh=_digits(buckets["mvag_fh"]),
                    qu=_digits(buckets["qu"]),
                )
                # Haushaltsruecklagen-Bewegungen (MVAG 230 Entnahme / 240
                # Zufuehrung) stehen ausserhalb der operativen Gebarung — sie
                # speisen den Saldo (01) und gehoeren nicht in die SU-21/22-Summe.
                if posten.mvag_eh.startswith(("230", "240")):
                    posten.gebarung = "ruecklage"
                result.posten.append(posten)
                last_detail = posten
                if label:
                    result.konto_namen.setdefault(konto, label)
                continue

            # 2) Summen- und Saldozeilen -------------------------------------
            if first.startswith(("SU", "SA")):
                amounts = _collect_amounts(buckets["amount"])
                code = " ".join(w.text for w in buckets["code"])
                result.posten.append(Posten(
                    seite=page + 1,
                    zeilentyp="summe" if first.startswith("SU") else "saldo",
                    bezeichnung=label,
                    vrk=code,
                    ansatz=cur_ansatz,
                    gruppe=cur_ansatz[:1] if cur_ansatz else None,
                    gebarung=cur_gebarung,
                    eh_wert=amounts[0], eh_vergleich=amounts[1], eh_dritte=amounts[2],
                    fh_wert=amounts[3], fh_vergleich=amounts[4], fh_dritte=amounts[5],
                ))
                last_detail = None
                continue

            # 3) Ansatz-/Gruppenkopf (reiner Zahlencode in der Codespalte) ----
            if first.isdigit() and 1 <= len(first) <= 6 and not buckets["amount"]:
                if len(first) == 6:
                    cur_ansatz = first
                    cur_gebarung = None
                    if label:
                        result.ansatz_namen[first] = label
                last_detail = None
                continue

            # 4) Gebarungs-Kontext -------------------------------------------
            key = text.lower()
            if key in GEBARUNG_LABELS:
                cur_gebarung = GEBARUNG_LABELS[key]
                last_detail = None
                continue

            # 5) Fortsetzungszeile (umgebrochene Bezeichnung) -----------------
            if last_detail is not None and label and not buckets["code"] \
                    and not buckets["amount"]:
                last_detail.bezeichnung = f"{last_detail.bezeichnung} {label}".strip()
                if last_detail.konto:
                    result.konto_namen[last_detail.konto] = last_detail.bezeichnung
                continue

    doc.close()
    if not result.posten:
        result.warnungen.append("Keine Posten geparst — Geometrie pruefen.")
    return result
