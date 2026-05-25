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

    Mehrstufige Suche:
    1. Primaer: Seitenkopf-Header ``Detailnachweis`` (Herzogenburg/NÖ-Standard).
       Wenn der zusammenhaengende Lauf mind. 10 Seiten umfasst, wird er genutzt.
    2. Fallback: Seitenkopf-Header ``Voranschlagsstellen`` (manche Software).
    3. Letzter Fallback: Detail-Block-Indikator ``Ansatz \\d{6}`` als laufender
       Header — wird von Software-Anbietern verwendet, die "Detailnachweis"
       nicht als Header drucken (Vorau, Burgenland-Kleingemeinden).

    Ergebnis ``(erste, letzte)`` (0-basiert) oder ``None``.
    """
    treffer = [p for p in range(doc.page_count)
               if "Detailnachweis" in doc[p].get_text()]
    lauf = _laengster_lauf(treffer)
    if lauf and lauf[1] - lauf[0] >= 10:
        return lauf

    treffer = [p for p in range(doc.page_count)
               if "Voranschlagsstellen" in doc[p].get_text()]
    lauf2 = _laengster_lauf(treffer)
    if lauf2 and lauf2[1] - lauf2[0] >= 10:
        return lauf2

    # Detail-Block-Indikator: "Ansatz" + 6-stellige Zahl als laufender Header.
    # Bei einigen Burgenland-PDFs (Grafenschachen, Neudorf b. Parndorf) ist der
    # Detail-Block ueber das gesamte PDF verstreut mit Luecken durch Uebersichts-
    # tabellen — der laengste zusammenhaengende Lauf ist nur ~9 Seiten. Wenn
    # aber **mind. 20 Seiten** den Marker tragen, nehmen wir den **Hull-Range**
    # [first_treffer, last_treffer] und lassen den Parser-Loop Seiten ohne
    # Detail-Zeilen ueberspringen (kostet etwas Laufzeit, aber liefert Daten).
    ansatz_pat = re.compile(r"Ansatz\s+\d{6}")
    treffer = [p for p in range(doc.page_count)
               if ansatz_pat.search(doc[p].get_text())]
    lauf3 = _laengster_lauf(treffer)
    # Bei vielen Treffern (>50) nehmen wir den **Hull-Range** [min, max]
    # auch wenn unzusammenhaengend — bei Murau-Style ist der Detail-Block
    # ueber das ganze PDF mit Luecken durch Saldo-/Aggregat-Seiten verstreut,
    # und der laengste zusammenhaengende Lauf ist nur ein kleiner Ausschnitt.
    # Der Parser-Loop ueberspringt Seiten ohne Detail-Posten automatisch.
    if len(treffer) >= 50:
        return (min(treffer), max(treffer))
    if lauf3 and lauf3[1] - lauf3[0] >= 10:
        return lauf3
    if len(treffer) >= 20:
        return (min(treffer), max(treffer))

    # Letzter Ausweg: ein kurzer "Detailnachweis"-Lauf ist besser als nichts.
    return lauf or lauf2 or lauf3


def page_lines(doc: fitz.Document, page_index: int, y_tol: float = 3.0) -> list[Line]:
    """Woerter einer Seite zu Zeilen gruppieren (gleiche y-Lage = gleiche Zeile).

    Manche PDFs setzen Seiten mit ``/Rotate`` (90/180/270) — z.B. Vorau-RA,
    eingebettete Querformat-Tabellen in Wien-VAs. PyMuPDF liefert die Wort-
    koordinaten in solchen Faellen im **un-rotierten** Mediabox-System, was
    den Spalten-x1-Anker des Parsers unterlaeuft. Hier rotieren wir die
    Koordinaten manuell so, dass das logische Lese-Layout immer derselben
    Konvention folgt (Ursprung oben links, rechtsbuendige Spalten via x1).
    """
    pg = doc[page_index]
    raw = pg.get_text("words")  # (x0,y0,x1,y1,text,block,line,word)
    rot = pg.rotation % 360
    if rot == 0:
        words = [Word(w[4], w[0], w[1], w[2], w[3]) for w in raw if w[4].strip()]
    else:
        mb = pg.mediabox  # Originalgroesse vor Rotation
        mw, mh = mb.width, mb.height
        words = []
        for w in raw:
            txt = w[4]
            if not txt.strip():
                continue
            x0, y0, x1, y1 = w[0], w[1], w[2], w[3]
            if rot == 90:    # PDF CW 90°: (x,y) -> (mh - y, x)
                nx0, ny0, nx1, ny1 = mh - y1, x0, mh - y0, x1
            elif rot == 180:
                nx0, ny0, nx1, ny1 = mw - x1, mh - y1, mw - x0, mh - y0
            elif rot == 270:  # PDF CCW 90°: (x,y) -> (y, mw - x)
                nx0, ny0, nx1, ny1 = y0, mw - x1, y1, mw - x0
            else:
                nx0, ny0, nx1, ny1 = x0, y0, x1, y1
            words.append(Word(txt, nx0, ny0, nx1, ny1))
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
