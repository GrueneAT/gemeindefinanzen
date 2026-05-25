"""Korpus-Downloader: liest documents/_korpus_manifest.json und holt die PDFs.

Das Manifest ist eine JSON-Liste mit Eintraegen::

    {
      "bundesland": "tirol",
      "gemeinde": "Innsbruck",
      "typ": "VA",
      "jahr": 2026,
      "url": "https://...pdf",
      "quelle": "offenerhaushalt|gemeinde-website|sonstiges"
    }

PDFs landen unter ``documents/korpus/<bundesland>/<gemeinde>-<typ>-<jahr>.pdf``.
Der Downloader ist idempotent: vorhandene Dateien werden uebersprungen, ausser
``--force`` ist gesetzt. Bei Fehlschlag wird die Ziel-Datei nicht angelegt.
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "documents" / "_korpus_manifest.json"
KORPUS = ROOT / "documents" / "korpus"

UA = "Mozilla/5.0 (gemeindefinanzen-corpus; +https://github.com/GrueneAT/gemeindefinanzen)"
TIMEOUT_S = 60
MAX_PARALLEL = 6


@dataclass(slots=True)
class Eintrag:
    bundesland: str
    gemeinde: str
    typ: str
    jahr: int
    url: str
    quelle: str = ""

    @property
    def dateiname(self) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", self.gemeinde.lower()).strip("-")
        return f"{slug}-{self.typ.lower()}-{self.jahr}.pdf"

    @property
    def ziel(self) -> Path:
        return KORPUS / self.bundesland / self.dateiname


def _lade(eintrag: Eintrag, force: bool) -> tuple[Eintrag, str, str]:
    """Holt eine PDF; gibt (eintrag, status, detail) zurueck.

    Status: 'ok' | 'skip' | 'fail'. 'detail' ist Dateigroesse bzw. Fehlertext.
    """
    ziel = eintrag.ziel
    if ziel.exists() and not force:
        return eintrag, "skip", f"vorhanden ({ziel.stat().st_size // 1024} KB)"
    ziel.parent.mkdir(parents=True, exist_ok=True)
    tmp = ziel.with_suffix(ziel.suffix + ".part")
    req = urllib.request.Request(eintrag.url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            ct = resp.headers.get("Content-Type", "")
            daten = resp.read()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
        return eintrag, "fail", f"{type(e).__name__}: {e}"
    except Exception as e:  # noqa: BLE001
        return eintrag, "fail", f"{type(e).__name__}: {e}"

    # Saniere: PDF-Magic-Bytes pruefen, falls Server falschen Content-Type schickt.
    if not daten.startswith(b"%PDF-"):
        return eintrag, "fail", f"keine PDF (CT={ct!r}, head={daten[:20]!r})"
    tmp.write_bytes(daten)
    tmp.rename(ziel)
    return eintrag, "ok", f"{len(daten) // 1024} KB"


def lade_manifest(pfad: Path) -> list[Eintrag]:
    """Manifest-JSON in Eintraege parsen. Tolerant gegenueber Extra-Feldern.

    Normalisiert HTML-escapte URLs (`&amp;` -> `&`), wie sie aus
    offenerhaushalt.at-Crawls gerne auftauchen.
    """
    daten = json.loads(pfad.read_text(encoding="utf-8"))
    eintraege: list[Eintrag] = []
    for r in daten:
        url = str(r["url"]).replace("&amp;", "&")
        eintraege.append(Eintrag(
            bundesland=r["bundesland"],
            gemeinde=r["gemeinde"],
            typ=r["typ"].upper(),
            jahr=int(r["jahr"]),
            url=url,
            quelle=r.get("quelle", ""),
        ))
    return eintraege


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", default=str(MANIFEST),
                    help="Pfad zum Manifest (Default: documents/_korpus_manifest.json)")
    ap.add_argument("--bundesland", help="nur dieses Bundesland herunterladen")
    ap.add_argument("--force", action="store_true",
                    help="bestehende Dateien ueberschreiben")
    ap.add_argument("--parallel", type=int, default=MAX_PARALLEL,
                    help=f"max parallele Downloads (Default {MAX_PARALLEL})")
    args = ap.parse_args(argv)

    manifest_pfad = Path(args.manifest)
    if not manifest_pfad.is_file():
        print(f"Manifest fehlt: {manifest_pfad}", file=sys.stderr)
        return 1

    eintraege = lade_manifest(manifest_pfad)
    if args.bundesland:
        eintraege = [e for e in eintraege if e.bundesland == args.bundesland]
    if not eintraege:
        print("Keine passenden Eintraege im Manifest.", file=sys.stderr)
        return 1

    print(f"Lade {len(eintraege)} PDF(s) mit max {args.parallel} parallelen Downloads ...")
    n_ok = n_skip = n_fail = 0
    with cf.ThreadPoolExecutor(max_workers=args.parallel) as pool:
        for eintrag, status, detail in pool.map(
            lambda e: _lade(e, args.force), eintraege
        ):
            marke = {"ok": "OK  ", "skip": "SKIP", "fail": "FAIL"}[status]
            print(f"  [{marke}] {eintrag.bundesland}/{eintrag.dateiname} — {detail}")
            if status == "ok":
                n_ok += 1
            elif status == "skip":
                n_skip += 1
            else:
                n_fail += 1
    print(f"\nFertig: {n_ok} neu, {n_skip} schon da, {n_fail} fehlgeschlagen.")
    return 0 if n_fail == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
