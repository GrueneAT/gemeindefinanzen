"""HTML-Zusammenbau des interaktiven Dashboards.

`build_report(db_path, out_path)` ist der oeffentliche Einstieg (von der CLI
aufgerufen). Er sammelt die Daten ueber `data.collect`, baut die ECharts-
Optionen ueber `charts.alle_charts`, setzt das HTML-Geruest zusammen und
schreibt die Datei.

Das Geruest: Masthead, sticky Bedienleiste (Jahr-/Dokument-Umschalter und
Tab-Leiste), sieben Tab-Panels. Sechs Panels sind dokumentbezogen und
reagieren auf den Umschalter; das siebte (Suche & Daten) ist
dokumentuebergreifend. Saemtliche Daten liegen als ein eingebetteter
JSON-Block vor; die gesamte Interaktion laeuft clientseitig.
"""

from __future__ import annotations

import json
from pathlib import Path

from .assets import CSS, JS
from .charts import alle_charts
from .data import collect

CSS_CDN = "https://flomotlik.github.io/claude-code/design-system.css"
ECHARTS_CDN = "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"

# Tab-Kennungen und Beschriftungen — Reihenfolge gemaess CONTEXT D3.
TABS: list[tuple[str, str]] = [
    ("ueberblick", "Ueberblick"),
    ("einnahmen", "Einnahmen"),
    ("ausgaben", "Ausgaben"),
    ("investitionen", "Investitionen"),
    ("transfers", "Transfers & Umlagen"),
    ("achthundert", "800k-Analyse"),
    ("suche", "Suche & Daten"),
]


def _chart_div(div_id: str, hoehe: int = 340) -> str:
    return (f'<div id="{div_id}" style="height:{hoehe}px;margin:.8rem 0;'
            f'border:1px solid var(--rule-hair,#cdc4b4);border-radius:3px;'
            f'background:var(--paper-raised,#faf6ee);padding:6px"></div>')


def _switcher(dokumente: list[dict]) -> str:
    """Schaltflaechenleiste fuer den Jahr-/Dokument-Umschalter."""
    btns = "".join(
        f'<button class="switch-btn" data-dok="{d["id"]}">{d["label"]}</button>'
        for d in dokumente)
    return ('<div class="switcher"><span class="switcher-label">'
            f'Dokument</span>{btns}</div>')


def _tabbar() -> str:
    btns = "".join(
        f'<button class="tab-btn" data-tab="{key}">{label}</button>'
        for key, label in TABS)
    return f'<div class="tabs">{btns}</div>'


def _table(table_id: str, kopf: list[tuple[str, bool]],
           tbody_id: str) -> str:
    """Leere Tabelle; der Koerper wird clientseitig je Dokument gefuellt."""
    th = "".join(
        f'<th class="{"num" if num else ""}">{titel}</th>'
        for titel, num in kopf)
    return (f'<table class="dtable" id="{table_id}">'
            f'<thead><tr>{th}</tr></thead>'
            f'<tbody id="{tbody_id}"></tbody></table>')


def _panel_ueberblick() -> str:
    return f"""
<section class="tab-panel" data-panel="ueberblick">
  <h2>Lagebild — <span id="kennzahl-dok"></span></h2>
  <p class="lead">Das gewaehlte Dokument weist ein Nettoergebnis von
    <span class="mark mark-blue" id="kennzahl-netto"></span> aus. Die
    Kommunalsteuer traegt einen erheblichen Teil aller Ertraege — ein
    dauerhafter Ausfall von 800.000&nbsp;Euro wuerde das Ergebnis ins Minus
    drehen.</p>
  <div class="stats">
    <div class="stat"><div class="stat-num" id="st-ertraege"></div>
      <div class="stat-label">Ertraege</div></div>
    <div class="stat"><div class="stat-num" id="st-aufwand"></div>
      <div class="stat-label">Aufwendungen</div></div>
    <div class="stat"><div class="stat-num" id="st-netto"></div>
      <div class="stat-label">Nettoergebnis</div></div>
    <div class="stat"><div class="stat-num is-orange" id="st-komm-anteil">
      </div><div class="stat-label">Kommunalsteuer-Anteil</div></div>
  </div>
  <div class="dash-grid" style="margin-top:1.2rem">
    <div><h3>Ergebnis als Wasserfall</h3>{_chart_div('c_wasserfall')}</div>
    <div><h3>Geldfluss</h3>{_chart_div('c_sankey', 420)}</div>
  </div>
  <h3>Entwicklung ueber alle Dokumente</h3>
  <p>Ertraege, Aufwendungen und Nettoergebnis je eingelesenem Dokument —
    dieser Vergleich ist dokumentuebergreifend und aendert sich nicht mit
    dem Umschalter.</p>
  {_chart_div('c_trend_eck', 320)}
</section>"""


def _panel_einnahmen() -> str:
    return f"""
<section class="tab-panel" data-panel="einnahmen">
  <h2>Einnahmestruktur</h2>
  <p>Die groessten Ertragsposten des gewaehlten Dokuments. Die
    <span class="mark mark-green">Kommunalsteuer</span> ist nach den
    Bundes-Ertragsanteilen die zweitgroesste Quelle.</p>
  <div class="dash-grid">
    <div><h3>Groesste Ertragsposten</h3>{_chart_div('c_einnahmen', 360)}</div>
    <div><h3>Kommunalsteuer im Zeitverlauf</h3>
      {_chart_div('c_trend_komm', 360)}</div>
  </div>
  <h3>Tabelle der groessten Ertragsposten</h3>
  {_table('t-einnahmen', [('Posten', False), ('Betrag', True)],
          'tbl-einnahmen')}
</section>"""


def _panel_ausgaben() -> str:
    return f"""
<section class="tab-panel" data-panel="ausgaben">
  <h2>Wofuer das Geld ausgegeben wird</h2>
  <p>Der Aufwand nach Art (Ring) und nach Aufgabenbereich (Treemap).
    Personal und Pflichttransfers sind kurzfristig kaum beweglich — der
    Ermessensspielraum steckt im Sachaufwand.</p>
  <div class="dash-grid">
    <div><h3>Aufwand nach Art</h3>{_chart_div('c_aufwandart', 340)}</div>
    <div><h3>Aufwand nach Aufgabenbereich</h3>
      {_chart_div('c_treemap', 340)}</div>
  </div>
  <h3>Drill-down: Aufgabengruppe &rsaquo; Ansatz &rsaquo; Posten</h3>
  <p>Klick auf eine Zeile blendet die naechste Ebene auf; ueber die
    Brotkrumen geht es wieder zurueck.</p>
  <div class="crumbs" id="drill-crumbs"></div>
  <p class="result-meta" id="drill-sum"></p>
  <ul class="drill-list" id="drill-list"></ul>
  <h3 style="margin-top:1.4rem">Groesste Aufwandssteigerungen</h3>
  {_table('t-ausgaben', [('Posten', False), ('Steigerung', True)],
          'tbl-ausgaben')}
</section>"""


def _panel_investitionen() -> str:
    return f"""
<section class="tab-panel" data-panel="investitionen">
  <h2>Investive Vorhaben</h2>
  <p>Die groessten investiven Auszahlungen des gewaehlten Dokuments —
    Vorhaben ausserhalb des laufenden Betriebs.</p>
  {_chart_div('c_investitionen', 380)}
  <h3>Tabelle der groessten Investitionen</h3>
  {_table('t-investitionen',
          [('Posten', False), ('Ansatz', False), ('Betrag', True)],
          'tbl-investitionen')}
</section>"""


def _panel_transfers() -> str:
    return f"""
<section class="tab-panel" data-panel="transfers">
  <h2>Transfers &amp; Umlagen</h2>
  <p>Der Transferaufwand mit Kennzeichnung, ob es sich um eine weitgehend
    gesetzlich gebundene <span class="mark mark-red">Pflichtumlage</span>
    oder um freiwillige bzw. sonstige Transfers handelt.</p>
  <h3>Transferaufwand im Detail</h3>
  {_table('t-transfers',
          [('Posten', False), ('Art', False),
           ('Betrag', True), ('Vergleich', True)],
          'tbl-transfers')}
  <h3 style="margin-top:1.4rem">Aufwand nach Art im Zeitverlauf</h3>
  <p>Der <span class="mark mark-red">Transferaufwand</span> waechst
    strukturell am staerksten — dokumentuebergreifend.</p>
  {_chart_div('c_trend_auf', 340)}
</section>"""


def _panel_achthundert() -> str:
    return f"""
<section class="tab-panel" data-panel="achthundert">
  <h2>Die 800.000-Euro-Frage</h2>
  <p>Der Wasserfall zeigt, was ein dauerhafter Kommunalsteuer-Ausfall
    bedeutet: aus einem knappen Plus wird ein Abgang.</p>
  {_chart_div('c_wasserfall', 340)}
  <h3>Wo liesse sich gegensteuern?</h3>
  <p>Der zahlungswirksame Sachaufwand mit Ermessensspielraum, kumuliert.
    Die rote Linie markiert die 800.000-Euro-Schwelle.</p>
  {_chart_div('c_korridor', 400)}
  <h3>Kostentreiber gegenueber dem Vergleichswert</h3>
  {_chart_div('c_treiber', 360)}
  <div class="callout is-risk" style="margin-top:1rem;">
    <p class="callout-label">Wichtige Einordnung</p>
    <p>Diese Auswertung ist eine <strong>Suchhilfe, keine Empfehlung</strong>.
    Sie zeigt, wo im Budget Betraege dieser Groessenordnung ueberhaupt
    liegen. Ob ein Posten kuerzbar ist, ist eine fachliche und politische
    Entscheidung — jede Zeile braucht eine eigene Bewertung.</p>
  </div>
</section>"""


def _panel_suche(dokumente: list[dict], gruppen: list[tuple[str, str]]) -> str:
    dok_opts = "".join(f'<option value="{d["id"]}">{d["label"]}</option>'
                       for d in dokumente)
    grp_opts = "".join(
        f'<option value="{code}">{code} — {text}</option>'
        for code, text in gruppen)
    spalten = [
        ("dok", "Dokument"), ("richtung", "Richtung"),
        ("gruppe", "Gruppe"), ("ansatz", "Ansatz"), ("konto", "Konto"),
        ("bezeichnung", "Bezeichnung"),
        ("ew", "EH wert"), ("ev", "EH vergl."), ("ed", "EH dritte"),
        ("fw", "FH wert"), ("fv", "FH vergl."), ("fd", "FH dritte"),
        ("mvag", "MVAG"), ("qu", "QU"),
    ]
    th = "".join(
        f'<th class="sortable{" num" if key in ("ew","ev","ed","fw","fv","fd") else ""}"'
        f' data-key="{key}">{titel} <span class="arrow"></span></th>'
        for key, titel in spalten)
    return f"""
<section class="tab-panel" data-panel="suche" id="such-box">
  <h2>Suche &amp; Daten</h2>
  <p>Alle Detailposten aller Dokumente — durchsuchbar, filterbar, sortierbar.
    Suche und Filter laufen vollstaendig im Browser.</p>
  <div class="filterbar">
    <label>Volltextsuche
      <input type="search" class="search" id="f-such"
        placeholder="Bezeichnung, Konto, Ansatz ..."></label>
    <label>Dokument
      <select id="f-dok"><option value="">alle</option>{dok_opts}</select>
    </label>
    <label>Aufgabengruppe
      <select id="f-gruppe"><option value="">alle</option>{grp_opts}</select>
    </label>
    <label>Richtung
      <select id="f-richtung"><option value="">alle</option>
        <option value="einnahme">Einnahme</option>
        <option value="ausgabe">Ausgabe</option></select></label>
    <label>Gebarung
      <select id="f-gebarung"><option value="">alle</option>
        <option value="operativ">operativ</option>
        <option value="investiv">investiv</option>
        <option value="finanzierung">finanzierung</option>
        <option value="ruecklage">ruecklage</option></select></label>
    <label>Betrag ab
      <input type="number" class="betrag" id="f-min" placeholder="min"></label>
    <label>Betrag bis
      <input type="number" class="betrag" id="f-max" placeholder="max"></label>
  </div>
  <p class="result-meta" id="such-meta"></p>
  <div class="table-scroll">
    <table class="dtable">
      <thead><tr>{th}</tr></thead>
      <tbody id="such-tbody"></tbody>
    </table>
  </div>
  <p class="table-hint" id="such-hint"></p>
</section>"""


def _build_html(daten: dict, cfg: dict) -> str:
    meta = daten["meta"]
    dokumente = daten["dokumente"]
    gemeinde = meta["gemeinde"]

    # Aufgabengruppen fuer den Filter — aus dem Default-Dokument abgeleitet,
    # die Gruppen 0-9 sind dokumentuebergreifend gleich.
    default_agg = daten["aggregate"].get(str(meta["default_dok"]), {})
    gruppen = sorted({(g[0], g[1])
                      for g in default_agg.get("gruppen", []) if g[0]})

    panels = "".join([
        _panel_ueberblick(), _panel_einnahmen(), _panel_ausgaben(),
        _panel_investitionen(), _panel_transfers(), _panel_achthundert(),
        _panel_suche(dokumente, gruppen),
    ])

    payload = json.dumps(daten, ensure_ascii=False)
    charts_json = json.dumps(cfg, ensure_ascii=False)

    return f"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Finanz-Dashboard — {gemeinde}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{CSS_CDN}">
<script src="{ECHARTS_CDN}"></script>
<style>{CSS}</style>
</head>
<body>
<div class="page">

  <header class="row">
    <div class="margin"><p class="kicker">
      <span class="kicker-num">00</span>Lagebild</p>
      <p class="margin-note">{meta['posten_anzahl']} Haushaltsstellen aus
        {meta['dok_anzahl']} Dokument(en) — maschinell erfasst und
        geprueft.</p></div>
    <div class="body">
      <h1 class="masthead-title">Finanz-Dashboard</h1>
      <p class="masthead-sub">{gemeinde} — Voranschlaege und
        Rechnungsabschluesse interaktiv. Tabs fuer die Themen, ein
        Umschalter fuer das Dokument, Volltextsuche ueber alle Posten.</p>
    </div>
  </header>

  <div class="dash-controls">
    {_switcher(dokumente)}
    {_tabbar()}
  </div>

  {panels}

  <footer class="footer">
    <span>Quelle: {meta['dok_anzahl']} Dokument(e), {gemeinde}</span>
    <span>Erzeugt aus gemeindefinanzen.db</span>
  </footer>

</div>
<script id="dashboard-data" type="application/json">{payload}</script>
<script>
const DATA = JSON.parse(
  document.getElementById("dashboard-data").textContent);
const CFG = {charts_json};
</script>
<script>{JS}</script>
</body>
</html>
"""


def build_report(db_path: str, out_path: str) -> str:
    """Interaktives Dashboard erzeugen und an `out_path` schreiben.

    Oeffentlicher Einstieg — Signatur darf nicht veraendert werden, die CLI
    haengt daran.
    """
    daten = collect(db_path)
    cfg = alle_charts(daten)
    html = _build_html(daten, cfg)

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return str(out)
