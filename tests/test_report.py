"""Tests fuer die Dashboard-Erzeugung (report/-Paket).

Geprueft wird, dass `build_report` eine Datei erzeugt, das HTML alle sieben
Tab-Kennungen und den eingebetteten JSON-Datenblock enthaelt und das
eingebettete JavaScript mit node syntaktisch und ausfuehrungsseitig
fehlerfrei ist. Die Tests laufen gegen die echte Datenbank in `data/` und
werden uebersprungen, falls sie fehlt oder node nicht verfuegbar ist.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from gemeindefinanzen.report import build_report
from gemeindefinanzen.report.charts import alle_charts
from gemeindefinanzen.report.data import collect
from gemeindefinanzen.report.html import TABS

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "gemeindefinanzen.db"

db_vorhanden = pytest.mark.skipif(
    not DB.exists(), reason="data/gemeindefinanzen.db fehlt")
node_vorhanden = pytest.mark.skipif(
    shutil.which("node") is None, reason="node nicht verfuegbar")

# Stub-Umgebung, damit node das clientseitige Skript ausfuehren kann.
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


@db_vorhanden
def test_build_report_erzeugt_datei(tmp_path: Path) -> None:
    out = tmp_path / "dashboard.html"
    pfad = build_report(str(DB), str(out))
    assert Path(pfad) == out
    assert out.exists()
    assert out.stat().st_size > 10_000


@db_vorhanden
def test_html_enthaelt_alle_tab_kennungen(tmp_path: Path) -> None:
    out = tmp_path / "dashboard.html"
    build_report(str(DB), str(out))
    html = out.read_text(encoding="utf-8")
    for key, _ in TABS:
        assert f'data-tab="{key}"' in html, f"Tab-Button {key} fehlt"
        assert f'data-panel="{key}"' in html, f"Tab-Panel {key} fehlt"
    assert len(TABS) == 7


@db_vorhanden
def test_html_enthaelt_json_datenblock(tmp_path: Path) -> None:
    out = tmp_path / "dashboard.html"
    build_report(str(DB), str(out))
    html = out.read_text(encoding="utf-8")
    m = re.search(
        r'<script id="dashboard-data" type="application/json">(.*?)</script>',
        html, re.S)
    assert m, "eingebetteter JSON-Datenblock fehlt"
    daten = json.loads(m.group(1))
    assert {"meta", "dokumente", "posten", "aggregate", "trend"} <= set(daten)
    assert daten["posten"], "keine Posten eingebettet"
    assert daten["dokumente"], "keine Dokumente eingebettet"


@db_vorhanden
@node_vorhanden
def test_eingebettetes_js_ist_fehlerfrei(tmp_path: Path) -> None:
    out = tmp_path / "dashboard.html"
    build_report(str(DB), str(out))
    html = out.read_text(encoding="utf-8")

    scripts = [s for s in re.findall(
        r"<script(?:[^>]*)>(.*?)</script>", html, re.S) if s.strip()]
    assert len(scripts) >= 3, "erwartete mindestens drei <script>-Bloecke"
    data_json, glue, js_block = scripts[0], scripts[1], scripts[2]

    bundle = ("var DATA_TEXT = " + json.dumps(data_json) + ";\n"
              + _HARNESS + glue + "\n" + js_block)
    js_file = tmp_path / "bundle.js"
    js_file.write_text(bundle, encoding="utf-8")

    for args in (["--check"], []):
        res = subprocess.run(["node", *args, str(js_file)],
                             capture_output=True, text=True)
        assert res.returncode == 0, res.stderr


@db_vorhanden
def test_collect_struktur(tmp_path: Path) -> None:
    daten = collect(str(DB))
    assert daten["meta"]["dok_anzahl"] == len(daten["dokumente"])
    assert daten["meta"]["posten_anzahl"] == len(daten["posten"])
    # Jedes Dokument hat ein Aggregat mit Eckwerten.
    for d in daten["dokumente"]:
        agg = daten["aggregate"][str(d["id"])]
        assert "eckwerte" in agg
        assert agg["eckwerte"]["ertraege"] > 0


@db_vorhanden
def test_charts_je_dokument(tmp_path: Path) -> None:
    daten = collect(str(DB))
    cfg = alle_charts(daten)
    # Ein Chart-Satz je Dokument plus die dokumentuebergreifenden Trends.
    assert set(cfg["dok_charts"]) == {str(d["id"]) for d in daten["dokumente"]}
    for charts in cfg["dok_charts"].values():
        assert "wasserfall" in charts and "sankey" in charts
    assert {"trend_eck", "trend_komm", "trend_auf"} <= set(cfg["trend_charts"])


@db_vorhanden
def test_mehrjahr_konfiguration(tmp_path: Path) -> None:
    # Der Mehrjahres-Vergleich liefert eine leere Chart-Huelle, eine
    # Linienpalette und die Dokumente in chronologischer Reihenfolge.
    daten = collect(str(DB))
    cfg = alle_charts(daten)
    assert "mehrjahr" in cfg
    mj = cfg["mehrjahr"]
    assert mj["basis"]["series"] == [], "Basis-Huelle muss leer sein"
    assert mj["basis"]["xAxis"]["type"] == "category"
    assert len(mj["palette"]) >= 4, "mindestens vier Tinten fuer die Linien"
    # x-Achse und Dokument-Reihenfolge stimmen mit den Dokumenten ueberein.
    assert mj["basis"]["xAxis"]["data"] == [d["label"]
                                            for d in daten["dokumente"]]
    assert mj["dok_reihenfolge"] == [d["id"] for d in daten["dokumente"]]


@db_vorhanden
def test_html_enthaelt_mehrjahres_vergleich(tmp_path: Path) -> None:
    # Die Bedienelemente des Mehrjahres-Vergleichs sind im HTML vorhanden:
    # Auswahl-Spalte, beide Aktionsschaltflaechen und der Overlay-Dialog.
    out = tmp_path / "dashboard.html"
    build_report(str(DB), str(out))
    html = out.read_text(encoding="utf-8")
    assert 'id="such-pickall"' in html, "Auswahl-Kopfbox fehlt"
    assert 'id="mj-selected"' in html, "Aktion 'Posten ueber die Jahre' fehlt"
    assert 'id="mj-group"' in html, "Aktion 'Gruppe ueber die Jahre' fehlt"
    assert 'id="mj-overlay"' in html, "Mehrjahres-Overlay fehlt"
    assert 'id="mj-chart"' in html, "Mehrjahres-Chartflaeche fehlt"
    assert 'class="mj-drill"' in html, "Drill-down-Mehrjahres-Aktion fehlt"
