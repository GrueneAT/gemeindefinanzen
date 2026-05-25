"""OH-CSV-Downloader: standardisierte Strukturdaten von offenerhaushalt.at.

Pro Gemeinde im Korpus-Manifest werden EHH (Ergebnishaushalt) und FHH
(Finanzierungshaushalt) CSVs gezogen — fuer jeden Voranschlag bzw.
Rechnungsabschluss separat. Die CSVs dienen als **Ground-Truth** fuer die
PDF-Parser-Validierung: jede Ansatz/Konto-Zeile ist exakt vergleichbar mit
dem PDF-geparsten Wert.

API-Mechanik (kein offizielles Endpoint, aber stabil):
  1. GET die Gemeinde-Download-Seite (CSRF-Token + GKZ holen)
  2. POST /downloads/get-token (Session vorbereiten)
  3. POST /downloads/ghdByParams (haushalt=ehh|fhh, rechnungsabschluss=va|ra,
     year, origin=gemeinde|statistik_at, gkz, _token)

Zieldateien:
  documents/korpus/<bundesland>/<gemeinde-slug>-<typ>-<jahr>-<ehh|fhh>.csv

Idempotent: vorhandene Dateien werden uebersprungen (ausser --force).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from http.cookiejar import CookieJar
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "documents" / "_korpus_manifest.json"
KORPUS = ROOT / "documents" / "korpus"
BASE = "https://www.offenerhaushalt.at"
UA = "Mozilla/5.0 (gemeindefinanzen-corpus; +grueneat/gemeindefinanzen)"
TIMEOUT_S = 60

CSRF_RE = re.compile(r'<meta name="csrf-token" content="([^"]+)"')
GKZ_RE = re.compile(r'name="gkz"\s+value="(\d+)"')


def _slugify(name: str) -> str:
    """Gemeindename in OH-URL-Slug verwandeln."""
    s = name.lower()
    s = (s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
         .replace("ß", "ss").replace("ä", "ae"))
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


# Manche Gemeinden im Manifest weichen vom OH-Slug ab — explizite Mappings.
SLUG_OVERRIDES = {
    "oberwart": "oberwart",
    "pinkafeld": "pinkafeld",
    "purbach am neusiedler see": "purbach-am-neusiedler-see",
    "steinbrunn": "steinbrunn",
    "grosspetersdorf": "gro%C3%9Fpetersdorf",
    "heiligenkreuz im lafnitztal": "heiligenkreuz-im-lafnitztal",
    "klagenfurt": "klagenfurt",
    "klagenfurt am wörthersee": "klagenfurt",
    "velden": "velden-am-w%C3%B6rthersee",
    "rennweg am katschberg": "rennweg-am-katschberg",
    "gitschtal": "gitschtal",
    "irschen": "irschen",
    "poertschach": "p%C3%B6rtschach-am-w%C3%B6rthersee",
    "diex": "diex",
    "paternion": "paternion",
    "ferlach": "ferlach",
    "wiener neustadt": "wiener-neustadt",
    "klosterneuburg": "klosterneuburg",
    "schwechat": "schwechat",
    "scheibbs": "scheibbs",
    "neunkirchen": "neunkirchen",
    "wolkersdorf": "wolkersdorf-im-weinviertel",
    "mistelbach": "mistelbach",
    "hollabrunn": "hollabrunn",
    "linz": "linz",
    "steyr": "steyr",
    "wels": "wels",
    "gmunden": "gmunden",
    "leonding": "leonding",
    "perg": "perg",
    "salzburg": "salzburg",
    "flachgau-nord": "regionalverband-flachgau-nord",
    "graz": "graz",
    "leoben": "leoben",
    "judenburg": "judenburg",
    "liezen": "liezen",
    "st lorenzen im muerztal": "st-lorenzen-im-m%C3%BCrztal",
    "hitzendorf": "hitzendorf",
    "vorau": "vorau",
    "grosswilfersdorf": "gro%C3%9Fwilfersdorf",
    "tieschen": "tieschen",
    "ligist": "ligist",
    "innsbruck": "innsbruck",
    "lienz": "lienz",
    "telfs": "telfs",
    "hall in tirol": "hall-in-tirol",
    "schwaz": "schwaz",
    "woergl": "w%C3%B6rgl",
    "matrei am brenner": "matrei-am-brenner",
    "bregenz": "bregenz",
    "dornbirn": "dornbirn",
    "feldkirch": "feldkirch",
    "bludenz": "bludenz",
    "hohenems": "hohenems",
    "lustenau": "lustenau",
    "lauterach": "lauterach",
    "bartholomaeberg": "bartholom%C3%A4berg",
}


class OHSession:
    """Eine Browser-Session gegen offenerhaushalt.at mit Cookies + CSRF.

    Pro Gemeinde wird die Download-Seite einmal geladen (CSRF + GKZ erfasst),
    dann beliebig viele CSVs ueber ``download_csv`` gezogen.
    """

    def __init__(self) -> None:
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar)
        )
        self.opener.addheaders = [("User-Agent", UA)]
        self.csrf_token: str = ""
        self.gkz: str = ""
        self.current_slug: str = ""

    def _request(self, url: str, *, method: str = "GET",
                 data: bytes | None = None,
                 extra_headers: dict[str, str] | None = None) -> bytes:
        req = urllib.request.Request(url, data=data, method=method)
        for k, v in (extra_headers or {}).items():
            req.add_header(k, v)
        with self.opener.open(req, timeout=TIMEOUT_S) as resp:
            return resp.read()

    def open_gemeinde(self, slug: str, year: int, rechnungsabschluss: bool) -> bool:
        """Download-Seite einer Gemeinde laden und CSRF+GKZ extrahieren.

        Liefert False wenn die Seite nicht erreichbar ist oder Form-Daten
        fehlen (z.B. Gemeinde existiert nicht bei OH).
        """
        if slug == self.current_slug and self.csrf_token and self.gkz:
            return True
        url = f"{BASE}/gemeinde/{slug}/download?year={year}&rechnungsabschluss={'1' if rechnungsabschluss else '0'}&origin=gemeinde"
        try:
            html = self._request(url).decode("utf-8", errors="replace")
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
            return False
        csrf_m = CSRF_RE.search(html)
        gkz_m = GKZ_RE.search(html)
        if not (csrf_m and gkz_m):
            return False
        self.csrf_token = csrf_m.group(1)
        self.gkz = gkz_m.group(1)
        self.current_slug = slug
        # get-token "warmup" — initialisiert die Session-Erwartung serverseitig
        try:
            self._request(
                f"{BASE}/downloads/get-token", method="POST",
                data=urllib.parse.urlencode(
                    {"foo": "bar", "_token": self.csrf_token}
                ).encode(),
                extra_headers={
                    "X-CSRF-TOKEN": self.csrf_token,
                    "X-Requested-With": "XMLHttpRequest",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
        except Exception:  # noqa: BLE001 — Warmup, nicht kritisch
            pass
        return True

    def download_csv(self, *, haushalt: str, va_oder_ra: str,
                     year: int, origin: str = "gemeinde") -> bytes | None:
        """CSV ueber den ghdByParams-Endpoint laden.

        Liefert die Roh-Bytes der CSV oder ``None`` bei Fehlern bzw. wenn
        offenerhaushalt.at keine Daten zur Kombination hat.
        """
        if not (self.csrf_token and self.gkz):
            return None
        data = urllib.parse.urlencode({
            "haushalt": haushalt,
            "rechnungsabschluss": va_oder_ra,
            "year": str(year),
            "origin": origin,
            "gkz": self.gkz,
            "_token": self.csrf_token,
        }).encode()
        try:
            body = self._request(
                f"{BASE}/downloads/ghdByParams", method="POST", data=data,
                extra_headers={
                    "X-CSRF-TOKEN": self.csrf_token,
                    "X-Requested-With": "XMLHttpRequest",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            return None
        # JSON-Fehlermeldung statt CSV-Header → kein Treffer
        if body.startswith(b"{"):
            return None
        if not body.startswith(b"Jahr;"):
            return None
        return body


def _ziel_dateien(eintrag: dict, kind: str) -> Path:
    """Pfad fuer die CSV: dieselbe Slug-Logik wie der PDF-Downloader."""
    bl = eintrag["bundesland"]
    name = eintrag["gemeinde"].lower()
    name_slug = re.sub(r"[^a-z0-9]+", "-", name).strip("-")
    typ = eintrag["typ"].lower()
    jahr = eintrag["jahr"]
    return KORPUS / bl / f"{name_slug}-{typ}-{jahr}-{kind}.csv"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", default=str(MANIFEST))
    ap.add_argument("--bundesland", help="nur dieses Bundesland verarbeiten")
    ap.add_argument("--force", action="store_true",
                    help="bestehende CSVs ueberschreiben")
    ap.add_argument("--delay", type=float, default=0.5,
                    help="Pause zwischen Requests in Sekunden (default 0.5)")
    args = ap.parse_args(argv)

    eintraege = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    if args.bundesland:
        eintraege = [e for e in eintraege if e["bundesland"] == args.bundesland]

    # Wien hat keine VRV-2015-CSV im OH-Format → uebergehen.
    eintraege = [e for e in eintraege if e["bundesland"] != "wien"]

    sess = OHSession()
    n_ok = n_skip = n_fail = n_kein = 0
    for e in eintraege:
        name = e["gemeinde"].lower()
        slug = SLUG_OVERRIDES.get(name)
        if not slug:
            slug = _slugify(e["gemeinde"])
        va_oder_ra = "ra" if e["typ"].upper() == "RA" else "va"
        # NVA wird in OH separat erfasst — wir probieren ihn als 'va' (zeigt
        # oft den naechsten Voranschlag) und melden bei Misserfolg.
        if e["typ"].upper() == "NVA":
            n_skip += 1
            print(f"  [SKIP] {e['bundesland']}/{e['gemeinde']} NVA {e['jahr']} "
                  f"(OH hat keinen separaten NVA-Eintrag)")
            continue

        if not sess.open_gemeinde(slug, e["jahr"], e["typ"].upper() == "RA"):
            n_fail += 1
            print(f"  [FAIL] {e['bundesland']}/{slug}: Download-Seite nicht ladbar")
            time.sleep(args.delay)
            continue

        for kind in ("ehh", "fhh"):
            ziel = _ziel_dateien(e, kind)
            if ziel.exists() and not args.force:
                n_skip += 1
                print(f"  [SKIP] {ziel.relative_to(ROOT)} ({ziel.stat().st_size // 1024} KB)")
                continue
            body = sess.download_csv(
                haushalt=kind, va_oder_ra=va_oder_ra, year=e["jahr"],
            )
            if body is None:
                n_kein += 1
                print(f"  [KEIN] {e['bundesland']}/{slug} {kind} {e['jahr']}: "
                      f"OH liefert keine Daten")
            else:
                ziel.parent.mkdir(parents=True, exist_ok=True)
                ziel.write_bytes(body)
                n_ok += 1
                print(f"  [OK  ] {ziel.relative_to(ROOT)} ({len(body) // 1024} KB)")
            time.sleep(args.delay)

    print(f"\nFertig: {n_ok} neu, {n_skip} vorhanden/uebersprungen, "
          f"{n_kein} keine Daten, {n_fail} Fehler.")
    return 0 if n_fail == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
