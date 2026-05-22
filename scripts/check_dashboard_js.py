#!/usr/bin/env python3
"""Eingebettetes Dashboard-JavaScript mit node pruefen.

Extrahiert die `<script>`-Bloecke aus einer erzeugten Dashboard-HTML-Datei,
baut eine Stub-Umgebung (window/document/echarts) und laesst node die
Syntax pruefen sowie das Skript ausfuehren. So faellt fehlerhaftes JS bereits
beim Build auf, nicht erst im Browser.

Aufruf:  python scripts/check_dashboard_js.py reports/dashboard.html
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

_HARNESS = r"""
var window = { addEventListener: function () {},
               requestAnimationFrame: function (f) {} };
var requestAnimationFrame = function (f) {};
function _el() {
  return {
    classList: { toggle: function () {}, add: function () {} },
    addEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    dataset: {}, textContent: DATA_TEXT, innerHTML: "",
    offsetParent: null, closest: function () { return null; },
  };
}
var document = {
  getElementById: function () { return _el(); },
  querySelector: function () { return _el(); },
  querySelectorAll: function () { return []; },
};
var echarts = {
  init: function () {
    return { setOption: function () {}, resize: function () {} };
  },
};
"""


def check(html_path: str) -> int:
    html = Path(html_path).read_text(encoding="utf-8")
    scripts = re.findall(r"<script(?:[^>]*)>(.*?)</script>", html, re.S)
    # Bloecke: [echarts-CDN (leer)], [JSON-Daten], [DATA/CFG-Glue], [Dashboard-JS]
    blocks = [s for s in scripts if s.strip()]
    if len(blocks) < 3:
        print("Erwartete mindestens drei nichtleere <script>-Bloecke.",
              file=sys.stderr)
        return 1
    data_json, glue, js_block = blocks[0], blocks[1], blocks[2]

    bundle = ("var DATA_TEXT = " + json.dumps(data_json) + ";\n"
              + _HARNESS + glue + "\n" + js_block)

    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False,
                                     encoding="utf-8") as fh:
        fh.write(bundle)
        tmp = fh.name

    try:
        for args, label in (("--check", "Syntaxpruefung"),
                             (None, "Ausfuehrung")):
            cmd = ["node"] + ([args] if args else []) + [tmp]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode != 0:
                print(f"node {label} fehlgeschlagen:", file=sys.stderr)
                print(res.stderr, file=sys.stderr)
                return 1
            print(f"node {label}: OK")
    finally:
        Path(tmp).unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Aufruf: check_dashboard_js.py <dashboard.html>",
              file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(check(sys.argv[1]))
