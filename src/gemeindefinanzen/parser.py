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

**Mehrere Layout-Familien:** Verschiedene Software-Anbieter und Bundeslaender
emittieren den VRV-Detailnachweis mit leicht unterschiedlicher Geometrie und
Schluessel-Syntax. ``LayoutCfg`` parametrisiert die Geometrie pro Dokument,
``detect_layout(doc, range)`` waehlt die richtige Variante:

- ``LAYOUT_STANDARD`` (Herzogenburg-Familie): 1-Wort-Schluessel `1/210000-728100`.
- ``LAYOUT_SLASH`` (Steyr-Familie): 1-Wort `1/000000/452000`, `/` statt +/-.
- ``LAYOUT_2WORT`` (Innsbruck/Graz/Bregenz/Vorau/Burgenland): Ansatz und Konto
  als zwei getrennte Wortspalten; Richtung aus Mittelherkunft-Ziffer.
- ``LAYOUT_SALZBURG`` (Stadt Salzburg): 5-stelliger Ansatz im Seitenheader,
  Detailzeile beginnt mit Mittelherkunft-Indikator + 6-stelligem Konto.

Die Spalten-x1 werden ausserdem **pro Dokument auto-kalibriert** — wenn das
Standard-Tupel nicht passt, wird ein Histogram der Zahl-x1 auf den ersten
Detailseiten ausgewertet und die sechs dominanten x1 als Anker uebernommen.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field

from . import extract

# --- Standard-Geometrie (aus VA-2026-Auflage.pdf vermessen, A4 quer) --------
# Rechte Kante (x1) der sechs Betragsspalten: EH VA / EH VA-VJ / EH RA-VJ |
#                                             FH VA / FH VA-VJ / FH RA-VJ
AMOUNT_X1: tuple[float, ...] = (463.7, 526.1, 588.4, 662.1, 724.5, 786.9)
AMOUNT_TOL = 7.0

X_CODE_MAX = 130.0     # Konto-/Summencode
X_LABEL_MAX = 280.0    # Bezeichnung
X_MVAG_FH = 304.0      # Grenze MVAG-EH | MVAG-FH
X_MVAG_MAX = 326.0     # Grenze MVAG | VC/QU
Y_HEADER = 90.0        # darueber: Seitenkopf
# Y_FOOTER wird je Seite dynamisch als (page_height - Y_FOOTER_MARGIN) berechnet,
# weil A4 quer (Hoehe 595) und A4 hoch (Hoehe 842) unterschiedliche Fussbereiche
# haben. Bei Herzogenburg (A4 quer): 595 - 37 = 558 — wie zuvor.
Y_FOOTER_MARGIN = 37.0


@dataclass(slots=True)
class LayoutCfg:
    """Geometrie- und Syntax-Parameter eines PDF-Layouts.

    Werte werden pro Dokument aus den Modul-Defaults gestartet und ggf. durch
    ``detect_layout`` und ``_calibrate_columns`` ueberschrieben.

    Im 2-Wort-Modus liegt das **Konto** in einer zweiten Codespalte, weiter
    rechts als der Ansatz. ``x_konto_max`` deckt diese Spalte ab und ist im
    Standard-Modus = ``x_code_max``.
    """

    name: str = "standard"
    amount_x1: tuple[float, ...] = AMOUNT_X1
    amount_tol: float = AMOUNT_TOL
    x_code_max: float = X_CODE_MAX
    x_konto_max: float = X_CODE_MAX  # 2-Wort-Modus: rechte Grenze der Konto-Spalte
    x_label_max: float = X_LABEL_MAX
    x_mvag_fh: float = X_MVAG_FH
    x_mvag_max: float = X_MVAG_MAX
    y_header: float = Y_HEADER
    y_footer_margin: float = Y_FOOTER_MARGIN
    # Layout-Modus: bestimmt wie eine Detailzeile gelesen wird.
    #   'standard' — 1-Wort-Schluessel (Herzogenburg, Steyr)
    #   '2wort'    — Ansatz/Konto in zwei getrennten Codespalten
    #   'salzburg' — Ansatz aus Seitenheader, Detailzeile = Mittelh + Konto
    mode: str = "standard"

# Detailzeilen-Schluessel '<typ>/<ansatz><sep><konto>'. Die fuehrende Ziffer
# ist die Mittelherkunft (1 operativer Aufwand, 2 operativer Ertrag, 5
# investive Auszahlung, 6 investive Einzahlung). Der Trenner '<sep>' kennzeichnet
# die Richtung:
#   '+' = Einnahme, '-' = Ausgabe (Herzogenburg/NÖ/Burgenland/Tirol-Standard).
#   '/' = neutral (Steyr/OÖ-Variante) — Richtung wird dann aus der
#         Mittelherkunft-Ziffer abgeleitet.
# Das Konto ist sechsstellig; manche Gemeinden fassen die Personalkonten je
# Ansatz zu einer verdichteten Zeile mit verkuerztem Konto zusammen (z.B.
# '1/439000-5' = Personalkonten verdichtet), daher 1-6 Stellen zugelassen.
# Optionaler '/N'-Suffix (z.B. '2/011000+816300/1'): VRV-konforme Variante des
# Kontos je Ansatz — wird ueber den vollen vrk-String mitgefuehrt, nicht in
# Ansatz/Konto getrennt gehalten.
DETAIL_RE = re.compile(r"^(\d)/(\d{4,6})([+\-/])(\d{1,6})(?:/\d+)?$")
# Vollstaendiger Betrag: gepunktet ('47.800,00') oder bereits zusammengezogen
# ('47800,00') — letzteres entsteht beim Zusammenfuehren aufgeteilter Fragmente.
NUMBER_RE = re.compile(r"^-?\d{1,3}(?:\.\d{3})*,\d{2}$|^-?\d+,\d{2}$")

# Zahlfragmente fuer die Vor-Aufbereitung aufgeteilter Betraege. Manche PDFs
# rendern eine tausendergetrennte Zahl als mehrere Textfragmente statt als ein
# Wort (z.B. '47' + '800,00'). Fragmente sind reine Ziffernbloecke ('-?\d{1,3}')
# oder ein abschliessender Block mit Nachkommastellen ('\d{3},\d{2}').
_FRAG_HEAD = re.compile(r"^-?\d{1,3}$")        # fuehrender/mittlerer Block
_FRAG_TAIL = re.compile(r"^\d{3},\d{2}$")      # abschliessender Block mit Cent
# Maximaler horizontaler Abstand (pt) zwischen zwei Fragmenten derselben Zahl.
# Gemessen: zahlinterne Luecken ~2 pt, Luecken zwischen Betragsspalten >=17 pt.
FRAG_GAP_MAX = 6.0
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


def _ist_fragment(text: str) -> bool:
    """Ist der Text ein moegliches Fragment einer aufgeteilten Zahl?"""
    return (
        _FRAG_HEAD.match(text) is not None
        or _FRAG_TAIL.match(text) is not None
        or NUMBER_RE.match(text) is not None
    )


def _merge_number_fragments(words: list[extract.Word]) -> list[extract.Word]:
    """Aufgeteilte Betraege vor der Spaltenzuordnung wieder zusammenfuehren.

    Manche PDFs rendern '47.800,00' als zwei Woerter '47' und '800,00'. Liegen
    zwei Zahlfragmente horizontal dicht beieinander (Abstand <= FRAG_GAP_MAX),
    gehoeren sie zur selben Zahl. Die Fragmenttexte werden direkt verkettet
    ('47' + '800,00' -> '47800,00'); ``_num`` liest die zusammengezogene Form.
    Das synthetische Wort behaelt x0 des ersten und x1 des letzten Fragments,
    sodass die rechtskantige Spaltenzuordnung unveraendert weiterfunktioniert.

    Die Eingabe ist nach x0 sortiert (siehe ``extract.page_lines``).
    """
    if len(words) < 2:
        return words
    merged: list[extract.Word] = []
    i = 0
    while i < len(words):
        cluster = [words[i]]
        j = i + 1
        while j < len(words):
            vorgaenger = cluster[-1]
            kandidat = words[j]
            gap = kandidat.x0 - vorgaenger.x1
            # Ein abgeschlossenes Fragment (Nachkommastellen) beendet den Cluster.
            if _FRAG_TAIL.match(vorgaenger.text) or NUMBER_RE.match(vorgaenger.text):
                break
            if 0 <= gap <= FRAG_GAP_MAX and _ist_fragment(vorgaenger.text) \
                    and _ist_fragment(kandidat.text):
                cluster.append(kandidat)
                j += 1
            else:
                break
        if len(cluster) > 1:
            text = "".join(w.text for w in cluster)
            merged.append(extract.Word(
                text=text,
                x0=cluster[0].x0, y0=cluster[0].y0,
                x1=cluster[-1].x1, y1=cluster[-1].y1,
            ))
        else:
            merged.append(cluster[0])
        i = j if j > i + 1 else i + 1
    return merged


def _amount_column(x1: float, cfg: LayoutCfg = LayoutCfg()) -> int | None:
    """Betragswort ueber seine rechte Kante einer der sechs Spalten zuordnen."""
    for idx, anchor in enumerate(cfg.amount_x1):
        if abs(x1 - anchor) <= cfg.amount_tol:
            return idx
    return None


def _collect_amounts(words: list[extract.Word],
                     cfg: LayoutCfg = LayoutCfg()) -> list[float | None]:
    """Sechs Betragsspalten einer Zeile fuellen (None = leer)."""
    cols: list[float | None] = [None] * 6
    for w in words:
        value = _num(w.text)
        if value is None:
            continue
        col = _amount_column(w.x1, cfg)
        if col is not None:
            cols[col] = value
    return cols


def _split_columns(words: list[extract.Word],
                   cfg: LayoutCfg = LayoutCfg()) -> dict[str, list[extract.Word]]:
    """Woerter einer Zeile nach x-Lage den logischen Spalten zuordnen.

    Im 2-Wort-Modus liegt die Konto-Spalte zwischen x_code_max und x_konto_max
    (z.B. Vorau: Ansatz x0~45, Konto x0~215). Beide Codespalten landen im
    ``code``-Bucket, damit ``_try_parse_detail`` sie als ``code[0]/code[1]``
    auslesen kann.
    """
    buckets: dict[str, list[extract.Word]] = {"code": [], "label": [], "mvag_eh": [],
                                              "mvag_fh": [], "qu": [], "amount": []}
    for w in words:
        if _num(w.text) is not None and _amount_column(w.x1, cfg) is not None:
            buckets["amount"].append(w)
        elif w.x0 < cfg.x_code_max:
            buckets["code"].append(w)
        elif cfg.mode == "2wort" and w.x0 < cfg.x_konto_max and w.text.isdigit():
            # Konto-Spalte im 2-Wort-Modus: nur reine Ziffernblöcke aufnehmen
            buckets["code"].append(w)
        elif w.x0 < cfg.x_label_max:
            buckets["label"].append(w)
        elif w.x0 < cfg.x_mvag_fh:
            buckets["mvag_eh"].append(w)
        elif w.x0 < cfg.x_mvag_max:
            buckets["mvag_fh"].append(w)
        else:
            buckets["qu"].append(w)
    return buckets


# --- Auto-Kalibrierung / Layout-Detection -----------------------------------

# 2-Wort-Detail-Pattern: zwei aufeinanderfolgende 5- oder 6-stellige Tokens
# als Ansatz und Konto. Manche Gemeinden (Schwechat, Wörgl-Familie) drucken
# den Ansatz nur 5-stellig, andere voll 6-stellig. Beim Speichern in der DB
# wird auf 6 Stellen vorne mit '0' gepadded, damit Cross-Validation funktioniert.
TWO_WORD_KEY_RE = re.compile(r"^\d{5,6}$")


def _calibrate_columns(doc: extract.fitz.Document, page_range: tuple[int, int],
                       cfg: LayoutCfg) -> tuple[float, ...] | None:
    """Sechs Spalten-x1 aus einem Histogram der Zahl-x1 auf 5 Detailseiten.

    Wenn das Default-Tupel nicht passt — d.h. wenige Zahlen treffen die Anker
    in Toleranz —, sammeln wir alle x1 von Betrags-Worten ueber eine Stich-
    probe von Seiten und identifizieren die sechs dominanten Cluster.
    Liefert ``None`` wenn weniger als sechs Cluster eindeutig erkennbar sind
    (Aufrufer soll dann das Default-Tupel beibehalten).
    """
    start, end = page_range
    if end <= start:
        return None
    # Stichprobe: 5 Seiten gleichmaessig verteilt
    n_samples = min(5, end - start)
    if n_samples <= 0:
        return None
    sample_pages = [start + 1 + (end - start - 1) * i // max(n_samples, 1)
                    for i in range(n_samples)]
    sample_pages = sorted(set(sample_pages))

    # 0.5-pt-Bins fuer Robustheit gegen leichte Streuung
    bins: Counter[float] = Counter()
    for pg in sample_pages:
        page_height = doc[pg].rect.height
        y_footer = page_height - cfg.y_footer_margin
        for line in extract.page_lines(doc, pg):
            if line.y < cfg.y_header or line.y > y_footer:
                continue
            for w in line.words:
                if _num(w.text) is not None:
                    bins[round(w.x1 * 2) / 2] += 1

    # Cluster bilden: ähnliche x1-Werte zusammenfassen (Abstand <= 1.5 pt)
    sorted_bins = sorted(bins.items(), key=lambda kv: -kv[1])
    clusters: list[tuple[float, int]] = []  # (mittelwert, count)
    for x, n in sorted_bins:
        merged = False
        for i, (cx, cn) in enumerate(clusters):
            if abs(x - cx) <= 1.5:
                new_mean = (cx * cn + x * n) / (cn + n)
                clusters[i] = (new_mean, cn + n)
                merged = True
                break
        if not merged:
            clusters.append((x, n))

    # Top 6 nach Count, dann links->rechts sortieren
    if len(clusters) < 6:
        return None
    clusters.sort(key=lambda c: -c[1])
    top6 = sorted(c[0] for c in clusters[:6])
    # Sanity: Spalten muessen mind. 30 pt auseinander liegen
    if any(top6[i + 1] - top6[i] < 30 for i in range(5)):
        return None
    return tuple(round(x, 1) for x in top6)


def _detect_two_word_mode(doc: extract.fitz.Document,
                          page_range: tuple[int, int],
                          cfg: LayoutCfg) -> bool:
    """Stichprobe auf bis zu 8 Seiten: ueberwiegt das 2-Wort-Schluessel-Muster?

    Im 2-Wort-Modus stehen in der Codespalte (x0 < x_code_max) regelmaessig
    **zwei** aufeinanderfolgende 6-stellige Tokens je Detailzeile, statt
    eines verbundenen ``1/210000-728100``-Tokens.

    Wir samplen relativ breit (8 Seiten), weil bei manchen Gemeinden die
    ersten Detailseiten reine Uebersichts-/Saldotabellen sind und der
    eigentliche 2-Wort-Detailblock erst weiter hinten beginnt.
    """
    start, end = page_range
    n_samples = min(8, end - start)
    if n_samples <= 1:
        return False
    sample_pages = [start + 1 + (end - start - 1) * i // n_samples
                    for i in range(n_samples)]
    sample_pages = sorted(set(sample_pages))

    one_word_hits = 0   # Treffer fuer Herzogenburg/Steyr-Schluessel
    two_word_hits = 0   # Treffer fuer 2-Wort-Schluessel
    konto_x0s: list[float] = []   # gemessene x0 der Konto-Spalte (zweite Codespalte)
    for pg in sample_pages:
        page_height = doc[pg].rect.height
        y_footer = page_height - cfg.y_footer_margin
        for line in extract.page_lines(doc, pg):
            if line.y < cfg.y_header or line.y > y_footer:
                continue
            if not line.words:
                continue
            first = line.words[0]
            if first.x0 >= cfg.x_code_max:
                continue
            if DETAIL_RE.match(first.text):
                one_word_hits += 1
            elif (TWO_WORD_KEY_RE.match(first.text) and len(line.words) >= 2
                  and TWO_WORD_KEY_RE.match(line.words[1].text)
                  and line.words[1].x0 < cfg.x_label_max):
                two_word_hits += 1
                konto_x0s.append(line.words[1].x0)
    # 2-Wort-Modus wenn dominanter; rechte Grenze der Konto-Spalte zurueckgeben.
    # Schwelle bewusst niedrig, weil Sample-Seiten teilweise reine Uebersichts-
    # tabellen erwischen und der Detail-Block nur partiell auftaucht.
    if two_word_hits > one_word_hits and two_word_hits >= 3 and konto_x0s:
        # Konto-Spalte: median(x0) + 25 pt als rechte Grenze
        konto_x0s.sort()
        median = konto_x0s[len(konto_x0s) // 2]
        cfg.x_konto_max = median + 25.0
        return True
    return False


def _detect_salzburg_mode(doc: extract.fitz.Document,
                          page_range: tuple[int, int],
                          cfg: LayoutCfg) -> bool:
    """Salzburg-Stadt: 5-stelliger Ansatz im Seitenheader, Detailzeile beginnt
    mit ``1``/``2`` (Mittelherkunft) und 6-stelligem Konto.

    Wir detektieren das, indem wir auf einer Stichprobe pruefen ob die Mehrheit
    der Codespalten-Erstzeilen aus einem ``1``/``2``/``5``/``6`` und einem
    6-stelligen Token besteht.
    """
    start, end = page_range
    n_samples = min(3, end - start)
    if n_samples <= 0:
        return False
    sample_pages = [start + 1 + (end - start - 1) * i // max(n_samples, 1)
                    for i in range(n_samples)]
    sample_pages = sorted(set(sample_pages))

    salzburg_hits = 0
    for pg in sample_pages:
        page_height = doc[pg].rect.height
        y_footer = page_height - cfg.y_footer_margin
        for line in extract.page_lines(doc, pg):
            if line.y < cfg.y_header or line.y > y_footer:
                continue
            ws = line.words
            if len(ws) < 2:
                continue
            if (ws[0].text in ("1", "2", "5", "6") and ws[0].x0 < cfg.x_code_max
                    and TWO_WORD_KEY_RE.match(ws[1].text)
                    and ws[1].x0 < cfg.x_code_max):
                salzburg_hits += 1
    return salzburg_hits >= 8


def detect_layout(doc: extract.fitz.Document,
                  page_range: tuple[int, int]) -> LayoutCfg:
    """Layout-Variante bestimmen und ggf. Spalten auto-kalibrieren.

    Vorgehen:
    1. Default-Cfg klonen.
    2. Salzburg-Modus pruefen (sehr spezifisch — eigene Detailzeilen-Form).
    3. Sonst: 2-Wort-Modus pruefen (Innsbruck/Graz/Bregenz/Burgenland).
    4. Spaltengeometrie auto-kalibrieren (alle Modi profitieren).
    """
    cfg = LayoutCfg()
    if _detect_salzburg_mode(doc, page_range, cfg):
        cfg.mode = "salzburg"
    elif _detect_two_word_mode(doc, page_range, cfg):
        cfg.mode = "2wort"
    kalibriert = _calibrate_columns(doc, page_range, cfg)
    if kalibriert is not None:
        cfg.amount_x1 = kalibriert
    return cfg


def _digits(words: list[extract.Word]) -> str:
    return "".join(w.text for w in words if w.text.isdigit())


def _richtung_aus_mittelherkunft(typ_digit: str) -> str:
    """VRV-2015 Konvention: 1/5 = Ausgabe, 2/6 = Einnahme.

    1 = operativer Aufwand, 2 = operativer Ertrag,
    5 = investive Auszahlung, 6 = investive Einzahlung.
    """
    return "einnahme" if typ_digit in ("2", "6") else "ausgabe"


def _build_posten(seite: int, vrk: str, label: str, typ_digit: str,
                  ansatz: str, konto: str, richtung: str,
                  amounts: list[float | None],
                  buckets: dict[str, list[extract.Word]],
                  cur_gebarung: str | None) -> Posten:
    """Detailposten aus zerlegten Bestandteilen zusammenbauen."""
    posten = Posten(
        seite=seite,
        zeilentyp="detail",
        bezeichnung=label,
        vrk=vrk,
        richtung=richtung,
        ansatz=ansatz,
        konto=konto,
        gruppe=ansatz[:1] if ansatz else None,
        gebarung=cur_gebarung,
        eh_wert=amounts[0], eh_vergleich=amounts[1], eh_dritte=amounts[2],
        fh_wert=amounts[3], fh_vergleich=amounts[4], fh_dritte=amounts[5],
        mvag_eh=_digits(buckets["mvag_eh"]),
        mvag_fh=_digits(buckets["mvag_fh"]),
        qu=_digits(buckets["qu"]),
    )
    # Haushaltsruecklagen-Bewegungen (MVAG 230 Entnahme / 240 Zufuehrung)
    # stehen ausserhalb der operativen Gebarung — sie speisen den Saldo (01)
    # und gehoeren nicht in die SU-21/22-Summe.
    if posten.mvag_eh.startswith(("230", "240")):
        posten.gebarung = "ruecklage"
    return posten


def _ist_block_mvag(words: list[extract.Word], cfg: LayoutCfg) -> bool:
    """Erkennt MVAG-Aggregations-Zwischenzeilen.

    Format 1 (Oberwart):  ``2  2224/3224  Instandhaltung ...``  (gepaart EH/FH)
    Format 2 (Vorau):     ``2  2224  3224  Instandhaltung ...`` (zwei Spalten)
    Format 3 (Steinbrunn):``2  3325  Einzahlungen ...``         (nur FH, EHH leer)

    Erstes Wort ist ein Ebene-Indikator (1/2/5/6) in der Code-Spalte.
    """
    if len(words) < 2 or words[0].x0 >= cfg.x_code_max:
        return False
    if words[0].text not in ("1", "2", "5", "6"):
        return False
    second = words[1].text
    if re.fullmatch(r"\d{3,4}/\d{3,4}", second):
        return True
    if re.fullmatch(r"\d{3,4}", second):
        # Variante "2 3325 3225" (Vorau) ODER "2 3325 Bezeichnung" (Steinbrunn).
        # Beide Varianten zaehlen — die Bezeichnung folgt jedenfalls.
        return True
    return False


def _parse_block_mvag(words: list[extract.Word]) -> tuple[str, str]:
    """MVAG-EH und MVAG-FH aus einer Block-Header-Zeile lesen.

    Liefert ``("", fh)`` wenn nur eine MVAG da ist und sie mit '3' beginnt
    (= FHH-Indikator). Sonst ``(eh, fh)`` als getrennte Spalten oder beides
    aus dem Slash-Format.
    """
    second = words[1].text
    if "/" in second:
        eh, fh = second.split("/", 1)
        return eh, fh
    if len(words) > 2 and re.fullmatch(r"\d{3,4}", words[2].text):
        return second, words[2].text
    # Nur eine MVAG vorhanden — anhand des Praefix den Haushalt zuordnen
    if second.startswith("3"):
        return "", second
    return second, ""


def _try_parse_detail(words: list[extract.Word],
                      buckets: dict[str, list[extract.Word]],
                      label: str, cfg: LayoutCfg,
                      cur_ansatz: str | None,
                      cur_gebarung: str | None,
                      seite: int,
                      cur_block_mvag_eh: str = "",
                      cur_block_mvag_fh: str = "") -> Posten | None:
    """Detailzeile gemaess Layout-Modus parsen. Liefert ``None`` wenn die
    Zeile keine Detailzeile im aktiven Modus ist.

    Standard-Modus erkennt zuerst den 1-Wort-Schluessel (Herzogenburg/Steyr);
    im 2-Wort- und Salzburg-Modus kommt die jeweilige Spezialform dazu.
    """
    first = words[0].text

    # 1-Wort-Schluessel (Standard, Steyr) — funktioniert in jedem Modus,
    # damit gemischte PDFs (Detail-Seiten mit beiden Formen) korrekt geparst werden.
    m = DETAIL_RE.match(first)
    if m:
        typ_digit, ansatz, sign, konto = m.groups()
        # 4-5 stellige Ansaetze/Konten auf 6 Stellen padden (Bregenz/Hohenems-
        # Variante). VRV-2015 ist hierarchisch links→rechts (Bereich-Funktion-
        # Untergliederung), Verkuerzungen entstehen durch Weglassen der
        # rechten Untergliederungs-Stellen. Padding ergaenzt diese mit '0'.
        ansatz = ansatz.ljust(6, "0")
        konto = konto.ljust(6, "0")
        if sign == "+":
            richtung = "einnahme"
        elif sign == "-":
            richtung = "ausgabe"
        else:  # '/' — Trenner ohne Vorzeichen (Steyr)
            richtung = _richtung_aus_mittelherkunft(typ_digit)
        amounts = _collect_amounts(buckets["amount"], cfg)
        return _build_posten(seite, first, label, typ_digit, ansatz, konto,
                             richtung, amounts, buckets, cur_gebarung)

    # 2-Wort-Schluessel: erstes Wort = Ansatz (6-stellig in Codespalte),
    # zweites Wort = Konto (6-stellig, in der breiteren Konto-Spalte).
    if cfg.mode == "2wort" and len(words) >= 2:
        if (TWO_WORD_KEY_RE.match(first)
                and words[0].x0 < cfg.x_code_max
                and TWO_WORD_KEY_RE.match(words[1].text)
                and words[1].x0 < cfg.x_konto_max
                and buckets["amount"]):
            # 5-stellige Schluessel auf 6 Stellen padden — VRV-2015 ist
            # hierarchisch links→rechts (Bereich-Funktion-Untergliederung),
            # daher Padding mit '0' am Ende.
            ansatz_2w = first.ljust(6, "0")
            konto_2w = words[1].text.ljust(6, "0")
            # Richtung & Mittelherkunft aus Gebarungs-Kontext + Kontenrahmen:
            # ``cur_gebarung`` ist 'operativ' / 'investiv' / 'finanzierung' und
            # wird aus dem Block-Header in der Hauptschleife gesetzt.
            #
            # VRV-2015 Anlage 3:
            #   operativ:  4xx-7xx Aufwand   (typ=1), 8xx Ertrag    (typ=2)
            #   investiv:  0xx-2xx Auszahl.  (typ=5), 3xx-8xx Einz.  (typ=6)
            #              (Konto 8xx in inv. Gebarung = Veraeusserung)
            #   finanz.:   ueberwiegend nicht in SU 21/22/33/34 — defaultet auf '1'
            # Konten-Spezialfaelle (unabhaengig vom Block-Kontext):
            # 803, 808 = Veraeusserung von Anlagen → IMMER investive Einnahme
            # 89x      = HH-Ruecklagen-Bewegung → Sonderbehandlung via MVAG 230/240
            # 91x      = Investitionszuschuesse erhalten → investive Einnahme
            ersteziffer = konto_2w[0]
            zweiziffer = konto_2w[:2]
            dreiziffer = konto_2w[:3]
            if dreiziffer in ("803", "808"):
                richtung, typ_digit = "einnahme", "6"
            elif zweiziffer == "89":
                richtung, typ_digit = "einnahme", "2"  # spaeter ruecklage
            elif cur_gebarung == "investiv":
                if ersteziffer in ("3", "8"):
                    richtung, typ_digit = "einnahme", "6"
                else:
                    richtung, typ_digit = "ausgabe", "5"
            elif cur_gebarung == "finanzierung":
                if ersteziffer in ("3",):
                    richtung, typ_digit = "einnahme", "6"
                else:
                    richtung, typ_digit = "ausgabe", "5"
            else:  # operativ oder unbekannt
                if ersteziffer in ("4", "5", "6", "7"):
                    richtung, typ_digit = "ausgabe", "1"
                elif ersteziffer == "8":
                    richtung, typ_digit = "einnahme", "2"
                elif ersteziffer in ("0", "1"):
                    richtung, typ_digit = "ausgabe", "5"
                elif ersteziffer == "3":
                    richtung, typ_digit = "einnahme", "6"
                else:  # '2', '9'
                    richtung, typ_digit = "ausgabe", "1"
            amounts = _collect_amounts(buckets["amount"], cfg)
            vrk = f"{typ_digit}/{ansatz_2w}-{konto_2w}"
            posten = _build_posten(seite, vrk, label, typ_digit, ansatz_2w,
                                   konto_2w, richtung, amounts, buckets,
                                   cur_gebarung)
            # Konten 89x = HH-Ruecklagen-Bewegung → MVAG 230 (Zufuehrung) /
            # 240 (Entnahme) setzen, damit die Ruecklage-Sonderbehandlung
            # in ``_build_posten`` (gebarung="ruecklage") greift.
            if posten.konto and posten.konto.startswith("89"):
                # 894x typisch = Zufuehrung, 895x = Entnahme — wir setzen
                # konservativ 230 (Zufuehrung), wodurch die Posten aus den
                # SU 21/22-Summen rausgenommen werden.
                if not posten.mvag_eh:
                    posten.mvag_eh = "230"
                posten.gebarung = "ruecklage"
            # Block-MVAG (nachgestellte Aggregation) als Metadatum mitfuehren,
            # falls in der Detailzeile selbst keine MVAG erkannt wurde.
            if not posten.mvag_eh and cur_block_mvag_eh:
                posten.mvag_eh = cur_block_mvag_eh
            if not posten.mvag_fh and cur_block_mvag_fh:
                posten.mvag_fh = cur_block_mvag_fh
            return posten

    # Salzburg-Modus: erstes Wort = Mittelherkunft (1/2/5/6), zweites Wort
    # = Konto (6-stellig). Ansatz kommt aus dem Seitenheader (cur_ansatz).
    if cfg.mode == "salzburg" and len(words) >= 2 and cur_ansatz:
        if (first in ("1", "2", "5", "6")
                and words[0].x0 < cfg.x_code_max
                and TWO_WORD_KEY_RE.match(words[1].text)
                and words[1].x0 < cfg.x_code_max
                and buckets["amount"]):
            typ_digit = first
            konto_sb = words[1].text
            richtung = _richtung_aus_mittelherkunft(typ_digit)
            amounts = _collect_amounts(buckets["amount"], cfg)
            vrk = f"{typ_digit}/{cur_ansatz}-{konto_sb}"
            return _build_posten(seite, vrk, label, typ_digit, cur_ansatz,
                                 konto_sb, richtung, amounts, buckets,
                                 cur_gebarung)
    return None


# Salzburg-/Wels-Header: 3-5 stellige Ansatznummer im Seitenkopf, gefolgt
# von Ansatz-Bezeichnung. Beispiele:
#   "00000 Gemeinderat"            (Stadt Salzburg, 5-stellig)
#   "0500 Bezirksverwaltung"        (Wels, 4-stellig)
#   "3801 Medien Kultur Haus"       (Wels, 4-stellig)
SALZBURG_ANSATZ_RE = re.compile(r"^(\d{3,5})$")


def _salzburg_header_ansatz(doc: extract.fitz.Document, page: int) -> str | None:
    """Salzburg-/Wels-Seitenheader: Ansatz-Nummer (3-5 Stellen) als Block-
    Titel im oberen Seitenbereich.

    Der Ansatz wird auf 6 Stellen vorne mit '0' gepadded, damit die
    SU-Pruefungen und die Cross-Validation gegen die OH-CSV (immer 6-stellig)
    matchen. Wir nehmen den **kleinsten** plausiblen Match — das vermeidet,
    dass ein 4-stelliger Jahresanteil wie "2024" faelschlich als Ansatz
    interpretiert wird.
    """
    kandidaten: list[str] = []
    for line in extract.page_lines(doc, page):
        if line.y >= Y_HEADER:
            break
        for w in line.words:
            m = SALZBURG_ANSATZ_RE.match(w.text)
            if m:
                code = m.group(1)
                # Jahreszahlen 19xx/20xx ausschliessen
                if not (code.startswith(("19", "20")) and len(code) == 4):
                    kandidaten.append(code)
    if not kandidaten:
        return None
    return kandidaten[0].zfill(6)


def parse_document(path: str) -> ParseResult:
    """Den Detailnachweis einer VRV-2015-PDF vollstaendig parsen."""
    doc = extract.open_document(path)
    sections = extract.section_ranges(doc)

    detail_section = next(
        (rng for title, rng in sections.items() if "Detailnachweis" in title), None
    )
    # TOC-Lesezeichen markieren bei einigen Gemeinden nur den ABSCHNITTS-
    # ANFANG (z.B. Bregenz: Detailnachweis-Bookmark auf S.74, aber der
    # eigentliche Detailblock geht bis ~S.194). Erst der Text-Fallback
    # liefert dort den vollstaendigen Lauf. Daher: wenn der TOC-Range zu
    # kurz ist (<10 Seiten), Text-Fallback nutzen.
    if detail_section is None or detail_section[1] - detail_section[0] < 10:
        text_range = extract.detailnachweis_range_by_text(doc)
        if text_range and (detail_section is None
                           or text_range[1] - text_range[0]
                           > detail_section[1] - detail_section[0]):
            detail_section = text_range
    if detail_section is None:
        raise ValueError(
            "Kein Detailnachweis-Abschnitt gefunden — weder in den "
            "PDF-Lesezeichen noch ueber die Seitenkopfzeilen."
        )
    start, end = detail_section

    # Layout-Variante + Spaltengeometrie pro Dokument bestimmen
    cfg = detect_layout(doc, (start, end))

    result = ParseResult()
    cur_ansatz: str | None = None
    cur_gebarung: str | None = None
    # Im 2-Wort-Modus tragen Detailzeilen keine MVAG-Codes. Die MVAG steht
    # stattdessen in einer **Block-Header-Zeile** vor jedem Detail-Block:
    #   '2 2224/3224 Instandhaltung ...'   (Oberwart-Variante, eine MVAG-Spalte)
    #   '2 2224 3224 Instandhaltung ...'  (Vorau-Variante, zwei MVAG-Spalten)
    # Wir tracken den letzten Block-MVAG und nutzen ihn als Richtungs-Hinweis.
    cur_block_mvag_eh: str = ""
    cur_block_mvag_fh: str = ""
    last_detail: Posten | None = None

    for page in range(start, end + 1):
        page_height = doc[page].rect.height
        y_footer = page_height - cfg.y_footer_margin
        # Im Salzburg-Modus wird der Ansatz aus dem Seitenheader gezogen,
        # also pro Seite neu ermittelt.
        if cfg.mode == "salzburg":
            ansatz_aus_header = _salzburg_header_ansatz(doc, page)
            if ansatz_aus_header:
                cur_ansatz = ansatz_aus_header
        for line in extract.page_lines(doc, page):
            if line.y < cfg.y_header or line.y > y_footer:
                continue
            if not line.words:
                continue
            text = line.text.strip()
            if re.fullmatch(r"Seite\s+\d+", text):
                continue

            # Aufgeteilte Betraege ('47' + '800,00') wieder zusammenfuehren,
            # bevor die Spaltenzuordnung greift.
            words = _merge_number_fragments(line.words)
            first = words[0].text
            buckets = _split_columns(words, cfg)
            label = " ".join(w.text for w in buckets["label"]).strip()

            # 0) Block-MVAG-Header (Aggregations-Zwischenzeile) ---------------
            # Format: ``2 3325 Einzahlungen aus Vorschüssen ... <Werte>``
            # Wirkt RUECKWIRKEND auf den letzten Detail-Posten — die MVAG des
            # Postens wird gesetzt, und falls die Heuristik die Richtung falsch
            # geraten hat, wird sie aus der echten MVAG korrigiert. So
            # vermeiden wir z.B. dass Konto 273000 (Bezugsvorschuesse) in der
            # investiven Gebarung als Ausgabe klassifiziert wird, obwohl
            # MVAG 3325 (Einzahlungen aus Vorschuessen) klar Einnahme bedeutet.
            if _ist_block_mvag(words, cfg):
                eh, fh = _parse_block_mvag(words)
                if last_detail is not None:
                    if eh and not last_detail.mvag_eh:
                        last_detail.mvag_eh = eh
                    if fh and not last_detail.mvag_fh:
                        last_detail.mvag_fh = fh
                    # Richtung aus MVAG-FH ableiten (33xx/35xx = Einzahlung,
                    # 34xx/36xx = Auszahlung). Im EHH analog 211x = Ertrag,
                    # 221x-224x = Aufwand. Nur korrigieren wenn klar zuordbar.
                    fh_klar = fh and fh[0] == "3"
                    eh_klar = eh and eh[0] == "2"
                    if fh_klar and len(fh) >= 2:
                        if fh[1] in ("1", "3", "5"):  # Einzahlung-Gruppen
                            last_detail.richtung = "einnahme"
                        elif fh[1] in ("2", "4", "6"):  # Auszahlung-Gruppen
                            last_detail.richtung = "ausgabe"
                    elif eh_klar and len(eh) >= 2:
                        if eh[1] == "1":  # Ertrag (211/212/213)
                            last_detail.richtung = "einnahme"
                        elif eh[1] == "2":  # Aufwand (221-224)
                            last_detail.richtung = "ausgabe"
                    # Bei MVAG 230/240 (HH-Ruecklage) auf "ruecklage" markieren
                    if last_detail.mvag_eh.startswith(("230", "240")):
                        last_detail.gebarung = "ruecklage"
                # Im 2-Wort-Modus zusaetzlich als Block-State fuehren — bei
                # diesem Layout fehlt die MVAG-Spalte komplett am Detailposten.
                if cfg.mode == "2wort":
                    if eh:
                        cur_block_mvag_eh = eh
                    if fh:
                        cur_block_mvag_fh = fh
                last_detail = None
                continue

            # 1) Detailposten -------------------------------------------------
            posten = _try_parse_detail(
                words, buckets, label, cfg, cur_ansatz, cur_gebarung,
                page + 1, cur_block_mvag_eh, cur_block_mvag_fh
            )
            if posten is not None:
                # Beim Ansatz-Wechsel den Block-MVAG-State zuruecksetzen.
                # Block-MVAG-Aggregator-Zeilen gelten je Ansatz; ohne Reset
                # leakt z.B. 'cur_block_mvag_eh="230"' (HH-Ruecklagen-Aggregator
                # des vorigen Ansatzes) in die ersten Detail-Posten des
                # neuen Ansatzes und macht sie faelschlich zu "ruecklage".
                if cfg.mode == "2wort" and posten.ansatz and posten.ansatz != cur_ansatz:
                    cur_block_mvag_eh = ""
                    cur_block_mvag_fh = ""
                    # Posten wurde mit alten cur_block_mvag-Werten gebaut → korrigieren
                    if posten.mvag_eh and posten.mvag_eh in ("230", "240", "23", "24") \
                            and posten.gebarung == "ruecklage":
                        posten.mvag_eh = ""
                        posten.gebarung = "operativ"
                    if posten.mvag_fh in ("341", "342", "351", "361"):
                        posten.mvag_fh = ""
                result.posten.append(posten)
                last_detail = posten
                # Im 2-Wort-Modus repetiert sich der Ansatz in jeder Detailzeile —
                # damit Summenzeilen darunter den korrekten Ansatz mitfuehren,
                # propagieren wir ihn aus dem aktuellsten Detailposten.
                if cfg.mode == "2wort" and posten.ansatz:
                    cur_ansatz = posten.ansatz
                if posten.konto and posten.bezeichnung:
                    result.konto_namen.setdefault(posten.konto, posten.bezeichnung)
                    result.ansatz_namen.setdefault(posten.ansatz or "", "")
                continue

            # 2) Summen- und Saldozeilen -------------------------------------
            if first.startswith(("SU", "SA")):
                amounts = _collect_amounts(buckets["amount"], cfg)
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
            # x0-Check verhindert dass freistehende 6-stellige Querverweis-
            # Tokens (z.B. x0 ~ 137 in Neunkirchen/Lienz, ausserhalb der Code-
            # spalte) faelschlich als Ansatz-Wechsel interpretiert werden und
            # alle folgenden Posten auf den Phantom-Ansatz wandern lassen.
            if (first.isdigit() and 1 <= len(first) <= 6
                    and not buckets["amount"]
                    and words[0].x0 < cfg.x_code_max):
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
