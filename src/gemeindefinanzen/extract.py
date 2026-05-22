"""Tiefebene PDF-Extraktion.

Kapselt PyMuPDF (``fitz``). Liefert je Seite die Woerter mit Koordinaten und
gruppiert sie zu Zeilen. Die fachliche Interpretation passiert in ``parser``.

Warum PyMuPDF und nicht pypdf: pypdf bricht auf den VRV-Tabellenseiten mit
``unsupported operand`` ab; PyMuPDF extrahiert den eingebetteten Text sauber.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import fitz  # PyMuPDF


@dataclass(frozen=True, slots=True)
class Word:
    """Ein Textwort mit Bounding-Box (PDF-Koordinaten, Ursprung oben links)."""

    text: str
    x0: float
    y0: float
    x1: float
    y1: float


@dataclass(slots=True)
class Line:
    """Eine visuelle Tabellenzeile: nach x sortierte Woerter mit gemeinsamer y-Lage."""

    y: float
    words: list[Word]

    @property
    def text(self) -> str:
        return " ".join(w.text for w in self.words)


def open_document(path: str) -> fitz.Document:
    return fitz.open(path)


def section_ranges(doc: fitz.Document) -> dict[str, tuple[int, int]]:
    """Abschnittsgrenzen aus den PDF-Lesezeichen.

    Ergebnis: ``{abschnittstitel: (erste_seite, letzte_seite)}`` (0-basiert,
    letzte_seite exklusiv-artig als Index der letzten zugehoerigen Seite).
    """
    toc = doc.get_toc(simple=True)  # [[level, title, pageno-1based], ...]
    tops = [(title.strip(), page - 1) for level, title, page in toc if level == 1]
    ranges: dict[str, tuple[int, int]] = {}
    for i, (title, start) in enumerate(tops):
        end = tops[i + 1][1] - 1 if i + 1 < len(tops) else doc.page_count - 1
        ranges[title] = (start, end)
    return ranges


def _laengster_lauf(seiten: list[int]) -> tuple[int, int] | None:
    """Laengsten zusammenhaengenden Lauf aus aufsteigenden Seitenindizes.

    Eine vereinzelte Erwaehnung (Inhaltsverzeichnis, Vorbericht) bildet keinen
    Lauf und faellt so heraus. Ergebnis ``(erste, letzte)`` oder ``None``.
    """
    if not seiten:
        return None
    best = cur = (seiten[0], seiten[0])
    for p in seiten[1:]:
        cur = (cur[0], p) if p == cur[1] + 1 else (p, p)
        if cur[1] - cur[0] > best[1] - best[0]:
            best = cur
    return best


def detailnachweis_range_by_text(doc: fitz.Document) -> tuple[int, int] | None:
    """Fallback, wenn ein PDF keine Lesezeichen hat.

    Den Detailnachweis-Abschnitt ueber die laufende Seitenkopfzeile finden:
    jede Seite des Abschnitts traegt im Kopf den Text ``Detailnachweis``.
    Ergebnis ``(erste, letzte)`` (0-basiert) oder ``None``.
    """
    treffer = [p for p in range(doc.page_count) if "Detailnachweis" in doc[p].get_text()]
    return _laengster_lauf(treffer)


def page_lines(doc: fitz.Document, page_index: int, y_tol: float = 3.0) -> list[Line]:
    """Woerter einer Seite zu Zeilen gruppieren (gleiche y-Lage = gleiche Zeile)."""
    raw = doc[page_index].get_text("words")  # (x0,y0,x1,y1,text,block,line,word)
    words = [Word(w[4], w[0], w[1], w[2], w[3]) for w in raw if w[4].strip()]
    words.sort(key=lambda w: (w.y0, w.x0))

    lines: list[Line] = []
    for w in words:
        if lines and abs(w.y0 - lines[-1].y) <= y_tol:
            lines[-1].words.append(w)
        else:
            lines.append(Line(y=w.y0, words=[w]))
    for ln in lines:
        ln.words.sort(key=lambda w: w.x0)
    return lines


def document_meta(doc: fitz.Document) -> dict[str, str]:
    """Gemeinde, Dokumenttyp, Finanzjahr aus dem Seitenkopf ableiten."""
    text = "\n".join(doc[p].get_text() for p in range(min(6, doc.page_count)))
    meta: dict[str, str] = {"gemeinde": "", "typ": "", "finanzjahr": "", "fassung": ""}

    jahr_re = re.compile(r"\b(20\d{2})\b")
    for line in text.splitlines():
        s = line.strip()
        ist_gemeinde = ("Stadtgemeinde" in s or "Marktgemeinde" in s
                        or s.startswith("Gemeinde "))
        if not meta["gemeinde"] and ist_gemeinde:
            meta["gemeinde"] = s
        if not meta["typ"]:
            low = s.lower()
            # NVA und RA zuerst pruefen — "Voranschlag" ist Teil von
            # "Nachtragsvoranschlag".
            if "nachtragsvoranschlag" in low:
                typ = "NVA"
            elif "rechnungsabschluss" in low:
                typ = "RA"
            elif "voranschlag" in low:
                typ = "VA"
            else:
                typ = ""
            jahr = jahr_re.search(s)
            if typ and jahr:
                meta["typ"], meta["finanzjahr"] = typ, jahr.group(1)
    return meta
