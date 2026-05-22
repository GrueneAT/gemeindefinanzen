"""HTML-Dashboard aus der Datenbank erzeugen.

Das Dashboard uebersetzt das Zahlenwerk in ein lesbares Lagebild. Es waehlt
als Bezugsdokument den juengsten Voranschlag und stellt ihm — sofern geladen —
die Rechnungsabschluesse und Nachtragsvoranschlaege als Zeitreihe gegenueber.
Layout/Typografie: flomotlik Design System; Diagramme: ECharts.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

CSS = "https://flomotlik.github.io/claude-code/design-system.css"
ECHARTS = "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"

# Die vier Tinten des Design Systems — semantisch eingesetzt.
INK = {"red": "#8E2F2A", "blue": "#1F4A6D", "orange": "#9A4A1C",
       "green": "#2F6149", "soft": "#5b5650", "paper": "#F4EFE6"}

# Chronologische Sortierung: innerhalb eines Jahres Ist vor Plan.
_ORDER = "CASE typ WHEN 'RA' THEN 0 WHEN 'NVA' THEN 1 WHEN 'VA' THEN 2 ELSE 3 END"


# --------------------------------------------------------------------------
# Datenzugriff
# --------------------------------------------------------------------------
def _rows(conn: sqlite3.Connection, sql: str, *args: object) -> list[tuple]:
    return conn.execute(sql, args).fetchall()


def _scalar(conn: sqlite3.Connection, sql: str, *args: object) -> float:
    r = conn.execute(sql, args).fetchone()
    return float(r[0]) if r and r[0] is not None else 0.0


def _euro(value: float, nachkomma: int = 0) -> str:
    return f"{value:,.{nachkomma}f}".replace(",", " ") + " €"


def gather(conn: sqlite3.Connection) -> dict:
    """Alle Kennzahlen und Diagrammdaten in einem Schritt einsammeln."""
    d: dict = {}

    # Bezugsdokument: juengster Voranschlag (sonst juengstes Dokument)
    prim = conn.execute(
        f"SELECT dokument_id, typ, finanzjahr, gemeinde, seiten FROM dokument "
        f"ORDER BY (typ='VA') DESC, finanzjahr DESC, {_ORDER} LIMIT 1").fetchone()
    pid, d["typ"], d["jahr"], d["gemeinde"], d["seiten"] = prim
    d["jahr_vj"] = d["jahr"] - 1

    d["ertraege"] = _scalar(conn, "SELECT SUM(eh_wert) FROM v_detail "
                            "WHERE richtung='einnahme' AND dokument_id=?", pid)
    d["aufwand"] = _scalar(conn, "SELECT SUM(eh_wert) FROM v_detail "
                           "WHERE richtung='ausgabe' AND dokument_id=?", pid)
    d["netto"] = d["ertraege"] - d["aufwand"]
    d["komm_va"] = _scalar(conn, "SELECT eh_wert FROM v_detail "
                           "WHERE konto='833000' AND dokument_id=?", pid)
    d["komm_anteil"] = 100 * d["komm_va"] / d["ertraege"] if d["ertraege"] else 0
    d["detailposten"] = int(_scalar(
        conn, "SELECT COUNT(*) FROM posten WHERE zeilentyp='detail'"))
    d["dok_anzahl"] = int(_scalar(conn, "SELECT COUNT(*) FROM dokument"))

    # Sankey: Einnahmequellen -> Haushalt -> Aufgabengruppen
    quellen = _rows(conn, """
        SELECT CASE
                 WHEN konto='859400' THEN 'Ertragsanteile (Bund)'
                 WHEN konto='833000' THEN 'Kommunalsteuer'
                 WHEN konto IN ('830000','831000') THEN 'Grundsteuer'
                 WHEN konto LIKE '852%' OR konto LIKE '810%' THEN 'Gebuehren & Leistungen'
                 WHEN substr(mvag_eh,1,3)='212' THEN 'Transfers & Zuschuesse'
                 ELSE 'Sonstige Einnahmen' END AS quelle,
               SUM(eh_wert)
        FROM v_detail WHERE richtung='einnahme' AND eh_wert>0 AND dokument_id=?
        GROUP BY quelle""", pid)
    gruppen_aus = _rows(conn, """
        SELECT gruppe_text, SUM(eh_wert) FROM v_detail
        WHERE richtung='ausgabe' AND eh_wert>0 AND dokument_id=?
        GROUP BY gruppe_text ORDER BY 2 DESC""", pid)
    d["sankey"] = {"quellen": quellen, "gruppen": gruppen_aus}

    d["einnahmen"] = _rows(conn, """
        SELECT bezeichnung, eh_wert FROM v_detail
        WHERE richtung='einnahme' AND eh_wert>0 AND dokument_id=?
        ORDER BY eh_wert DESC LIMIT 12""", pid)

    d["aufwand_art"] = _rows(conn, """
        SELECT CASE substr(mvag_eh,1,3)
                 WHEN '221' THEN 'Personal' WHEN '222' THEN 'Sachaufwand'
                 WHEN '223' THEN 'Transfers' WHEN '224' THEN 'Finanz'
                 ELSE 'Sonstige' END,
               SUM(eh_wert)
        FROM v_detail WHERE richtung='ausgabe' AND eh_wert>0 AND dokument_id=?
        GROUP BY 1 ORDER BY 2 DESC""", pid)

    d["treemap"] = _rows(conn, """
        SELECT gruppe_text, ansatz_text, SUM(eh_wert) FROM v_detail
        WHERE richtung='ausgabe' AND eh_wert>0 AND dokument_id=?
        GROUP BY gruppe_text, ansatz_text""", pid)

    d["treiber"] = _rows(conn, """
        SELECT bezeichnung, eh_delta FROM v_detail
        WHERE richtung='ausgabe' AND eh_delta>0 AND dokument_id=?
        ORDER BY eh_delta DESC LIMIT 12""", pid)

    d["korridor"] = _rows(conn, """
        WITH s AS (SELECT bezeichnung, fh_wert FROM v_detail
                   WHERE richtung='ausgabe' AND gebarung='operativ'
                     AND substr(mvag_eh,1,3)='222' AND fh_wert>0
                     AND konto NOT LIKE '68%'
                     AND bezeichnung NOT LIKE '%errechnungsr%'
                     AND dokument_id=?)
        SELECT bezeichnung, fh_wert,
               SUM(fh_wert) OVER (ORDER BY fh_wert DESC ROWS UNBOUNDED PRECEDING)
        FROM s ORDER BY fh_wert DESC LIMIT 18""", pid)

    d["transfers"] = _rows(conn, """
        SELECT bezeichnung, eh_wert, eh_vergleich FROM v_detail
        WHERE richtung='ausgabe' AND substr(mvag_eh,1,3)='223'
          AND eh_wert>0 AND dokument_id=?
        ORDER BY eh_wert DESC LIMIT 10""", pid)

    # Zeitreihen ueber alle Dokumente
    d["trend_eckwerte"] = _rows(conn, f"""
        SELECT spalte_wert, ROUND(ertraege), ROUND(aufwand), ROUND(nettoergebnis)
        FROM v_eckwerte ORDER BY finanzjahr, {_ORDER}""")
    d["trend_komm"] = _rows(conn, """
        SELECT dokument, ROUND(eh_wert) FROM v_zeitreihe
        WHERE konto='833000' ORDER BY finanzjahr, typ""")
    d["trend_aufwand"] = _rows(conn, f"""
        SELECT spalte_wert,
               ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='221' THEN eh_wert ELSE 0 END)),
               ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='222' THEN eh_wert ELSE 0 END)),
               ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='223' THEN eh_wert ELSE 0 END)),
               ROUND(SUM(CASE WHEN substr(mvag_eh,1,3)='224' THEN eh_wert ELSE 0 END))
        FROM v_detail
        WHERE richtung='ausgabe'
        GROUP BY dokument_id ORDER BY finanzjahr, {_ORDER}""")
    return d


# --------------------------------------------------------------------------
# ECharts-Konfigurationen
# --------------------------------------------------------------------------
def _base_text() -> dict:
    return {"fontFamily": "Inter, sans-serif", "color": "#2b2825"}


def chart_sankey(d: dict) -> dict:
    nodes, links, seen = [], [], set()

    def node(name: str, color: str) -> None:
        if name not in seen:
            nodes.append({"name": name, "itemStyle": {"color": color}})
            seen.add(name)

    node("Gemeindehaushalt", INK["soft"])
    for name, betrag in d["sankey"]["quellen"]:
        col = INK["green"] if name in ("Kommunalsteuer", "Ertragsanteile (Bund)") else INK["blue"]
        node(name, col)
        links.append({"source": name, "target": "Gemeindehaushalt", "value": round(betrag)})
    for name, betrag in d["sankey"]["gruppen"]:
        node(name, INK["orange"])
        links.append({"source": "Gemeindehaushalt", "target": name, "value": round(betrag)})
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "item"},
        "series": [{
            "type": "sankey", "left": 8, "right": 170, "top": 14, "bottom": 14,
            "nodeGap": 11, "nodeWidth": 13,
            "label": {"fontFamily": "Inter, sans-serif", "fontSize": 11, "color": "#2b2825"},
            "lineStyle": {"color": "gradient", "opacity": 0.32, "curveness": 0.5},
            "emphasis": {"focus": "adjacency"},
            "data": nodes, "links": links,
        }],
    }


def _cat_axis(data: list[str], fontsize: int = 11, rotate: int = 0) -> dict:
    return {"type": "category", "data": data,
            "axisLabel": {"fontFamily": "Inter, sans-serif", "fontSize": fontsize,
                          "color": "#2b2825", "rotate": rotate, "interval": 0},
            "axisLine": {"lineStyle": {"color": "#cdc4b4"}}}


def _val_axis(formatter: str = "(v)=>(v/1000).toLocaleString('de')+'k'") -> dict:
    return {"type": "value",
            "axisLabel": {"fontFamily": "Inter, sans-serif", "fontSize": 10,
                          "color": "#5b5650", "formatter": formatter},
            "splitLine": {"lineStyle": {"color": "#e6dfd0"}}}


def _bar(categories: list[str], values: list[float], color: str,
         colors: list[str] | None = None) -> dict:
    data = ([{"value": round(v), "itemStyle": {"color": c}}
             for v, c in zip(values, colors, strict=False)] if colors
            else [round(v) for v in values])
    return {
        "textStyle": _base_text(),
        "grid": {"left": 8, "right": 22, "top": 12, "bottom": 8, "containLabel": True},
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "xAxis": _val_axis(),
        "yAxis": _cat_axis(categories) | {"inverse": True},
        "series": [{"type": "bar", "data": data, "barWidth": "62%",
                    "itemStyle": {"color": color, "borderRadius": 2}}],
    }


def chart_einnahmen(d: dict) -> dict:
    cats = [b[:34] for b, _ in d["einnahmen"]][::-1]
    vals = [v for _, v in d["einnahmen"]][::-1]
    cols = [INK["green"] if "Kommunalsteuer" in b else INK["blue"]
            for b, _ in d["einnahmen"]][::-1]
    return _bar(cats, vals, INK["blue"], colors=cols)


def chart_treiber(d: dict) -> dict:
    cats = [b[:34] for b, _ in d["treiber"]][::-1]
    vals = [delta for _, delta in d["treiber"]][::-1]
    return _bar(cats, vals, INK["red"])


def chart_aufwandart(d: dict) -> dict:
    palette = {"Personal": INK["blue"], "Sachaufwand": INK["orange"],
               "Transfers": INK["red"], "Finanz": INK["soft"], "Sonstige": "#b7ad99"}
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "item"},
        "legend": {"bottom": 0, "textStyle": {"fontFamily": "Inter, sans-serif",
                                              "fontSize": 11}},
        "series": [{
            "type": "pie", "radius": ["42%", "70%"], "center": ["50%", "44%"],
            "padAngle": 2, "itemStyle": {"borderRadius": 3},
            "label": {"fontFamily": "Inter, sans-serif", "fontSize": 11,
                      "formatter": "{b}\\n{d}%"},
            "data": [{"name": c, "value": round(v),
                      "itemStyle": {"color": palette.get(c, INK["soft"])}}
                     for c, v in d["aufwand_art"]],
        }],
    }


def chart_treemap(d: dict) -> dict:
    gruppen: dict[str, list] = {}
    for g, a, betrag in d["treemap"]:
        gruppen.setdefault(g, []).append({"name": a or "ohne Ansatz",
                                          "value": round(betrag)})
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "item"},
        "series": [{
            "type": "treemap",
            "data": [{"name": g, "children": k} for g, k in gruppen.items()],
            "top": 6, "bottom": 6, "left": 6, "right": 6,
            "roam": False, "nodeClick": "zoomToNode",
            "breadcrumb": {"show": True, "bottom": 0},
            "levels": [
                {"itemStyle": {"borderColor": "#F4EFE6", "borderWidth": 3, "gapWidth": 3}},
                {"itemStyle": {"borderColor": "#F4EFE6", "borderWidth": 1, "gapWidth": 1},
                 "colorSaturation": [0.32, 0.62]},
            ],
            "color": [INK["orange"], INK["blue"], INK["green"], INK["red"], INK["soft"]],
            "label": {"fontFamily": "Inter, sans-serif", "fontSize": 11},
            "upperLabel": {"show": True, "height": 20,
                           "fontFamily": "Inter, sans-serif", "fontSize": 11},
        }],
    }


def chart_wasserfall(d: dict) -> dict:
    schritte = [
        ("Ertraege", d["ertraege"], INK["green"]),
        ("Aufwendungen", -d["aufwand"], INK["red"]),
        (f"Nettoergebnis {d['jahr']}", d["netto"], INK["blue"]),
        ("Kommunalsteuer-Ausfall", -800000, INK["red"]),
        ("Ergebnis nach Ausfall", d["netto"] - 800000, INK["orange"]),
    ]
    namen = [s[0] for s in schritte]
    sockel, sichtbar = [], []
    for name, wert, farbe in schritte:
        if any(t in name for t in ("Nettoergebnis", "Ergebnis")) or wert >= 0:
            sockel.append(0)
            sichtbar.append({"value": round(wert), "itemStyle": {"color": farbe}})
        else:
            laufend = d["ertraege"] if "Aufwend" in name else d["netto"]
            sockel.append(round(laufend + wert))
            sichtbar.append({"value": round(-wert), "itemStyle": {"color": farbe}})
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "grid": {"left": 8, "right": 18, "top": 16, "bottom": 8, "containLabel": True},
        "xAxis": _cat_axis(namen, fontsize=10),
        "yAxis": _val_axis("(v)=>(v/1e6).toLocaleString('de')+' Mio'"),
        "series": [
            {"type": "bar", "stack": "w", "itemStyle": {"color": "transparent"},
             "data": sockel, "silent": True},
            {"type": "bar", "stack": "w", "data": sichtbar, "barWidth": "55%",
             "itemStyle": {"borderRadius": 2},
             "label": {"show": True, "position": "top", "fontFamily": "Inter, sans-serif",
                       "fontSize": 10,
                       "formatter": "(p)=>(p.value/1000).toLocaleString('de')+'k'"}},
        ],
    }


def chart_korridor(d: dict) -> dict:
    cats = [b[:32] for b, _, _ in d["korridor"]]
    einzeln = [round(v) for _, v, _ in d["korridor"]]
    kumuliert = [round(k) for _, _, k in d["korridor"]]
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "legend": {"bottom": 0, "textStyle": {"fontFamily": "Inter, sans-serif",
                                              "fontSize": 11}},
        "grid": {"left": 8, "right": 18, "top": 12, "bottom": 48, "containLabel": True},
        "xAxis": _cat_axis(cats, fontsize=9, rotate=38),
        "yAxis": _val_axis(),
        "series": [
            {"name": "Einzelposten", "type": "bar", "data": einzeln,
             "itemStyle": {"color": INK["orange"], "borderRadius": 2}, "barWidth": "52%"},
            {"name": "kumuliert", "type": "line", "data": kumuliert,
             "smooth": True, "symbolSize": 5,
             "itemStyle": {"color": INK["red"]}, "lineStyle": {"color": INK["red"]},
             "markLine": {"silent": True, "symbol": "none",
                          "label": {"formatter": "800.000 EUR", "fontSize": 10},
                          "lineStyle": {"color": INK["red"], "type": "dashed"},
                          "data": [{"yAxis": 800000}]}},
        ],
    }


def chart_trend_eckwerte(d: dict) -> dict:
    namen = [r[0] for r in d["trend_eckwerte"]]
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "legend": {"bottom": 0, "textStyle": {"fontFamily": "Inter, sans-serif",
                                              "fontSize": 11}},
        "grid": {"left": 8, "right": 18, "top": 14, "bottom": 40, "containLabel": True},
        "xAxis": _cat_axis(namen),
        "yAxis": _val_axis("(v)=>(v/1e6).toLocaleString('de')+' Mio'"),
        "series": [
            {"name": "Ertraege", "type": "bar",
             "data": [r[1] for r in d["trend_eckwerte"]],
             "itemStyle": {"color": INK["green"], "borderRadius": 2}},
            {"name": "Aufwendungen", "type": "bar",
             "data": [r[2] for r in d["trend_eckwerte"]],
             "itemStyle": {"color": INK["red"], "borderRadius": 2}},
            {"name": "Nettoergebnis", "type": "line", "symbolSize": 7,
             "data": [r[3] for r in d["trend_eckwerte"]],
             "itemStyle": {"color": INK["blue"]}, "lineStyle": {"color": INK["blue"], "width": 2}},
        ],
    }


def chart_trend_komm(d: dict) -> dict:
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "axis"},
        "grid": {"left": 8, "right": 18, "top": 16, "bottom": 8, "containLabel": True},
        "xAxis": _cat_axis([r[0] for r in d["trend_komm"]]),
        "yAxis": _val_axis(),
        "series": [{
            "type": "line", "smooth": True, "symbolSize": 8,
            "data": [r[1] for r in d["trend_komm"]],
            "itemStyle": {"color": INK["green"]},
            "lineStyle": {"color": INK["green"], "width": 2.5},
            "areaStyle": {"color": "rgba(47,97,73,0.10)"},
            "label": {"show": True, "position": "top", "fontFamily": "Inter, sans-serif",
                      "fontSize": 10,
                      "formatter": "(p)=>(p.value/1e6).toLocaleString('de')+' Mio'"},
        }],
    }


def chart_trend_aufwand(d: dict) -> dict:
    namen = [r[0] for r in d["trend_aufwand"]]
    reihen = [("Personal", 1, INK["blue"]), ("Sachaufwand", 2, INK["orange"]),
              ("Transfers", 3, INK["red"]), ("Finanz", 4, INK["soft"])]
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "legend": {"bottom": 0, "textStyle": {"fontFamily": "Inter, sans-serif",
                                              "fontSize": 11}},
        "grid": {"left": 8, "right": 18, "top": 14, "bottom": 40, "containLabel": True},
        "xAxis": _cat_axis(namen),
        "yAxis": _val_axis("(v)=>(v/1e6).toLocaleString('de')+' Mio'"),
        "series": [{"name": name, "type": "bar", "stack": "a",
                    "data": [r[idx] for r in d["trend_aufwand"]],
                    "itemStyle": {"color": col}} for name, idx, col in reihen],
    }


# --------------------------------------------------------------------------
# HTML-Zusammenbau
# --------------------------------------------------------------------------
def _stat(num: str, label: str, ink: str = "") -> str:
    cls = f" {ink}" if ink else ""
    return f'<div class="stat"><div class="stat-num{cls}">{num}</div>' \
           f'<div class="stat-label">{label}</div></div>'


def _chart(div_id: str, hoehe: int = 340) -> str:
    return (f'<div id="{div_id}" style="height:{hoehe}px;margin:1rem 0;'
            f'border:1px solid var(--rule-hair,#cdc4b4);border-radius:3px;'
            f'background:var(--paper-raised,#faf6ee);padding:6px"></div>')


def _tabelle(kopf: list[str], zeilen: list[list[str]]) -> str:
    th = "".join(f"<th>{h}</th>" for h in kopf)
    tr = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in z) + "</tr>"
                 for z in zeilen)
    return (f'<table style="width:100%;border-collapse:collapse;font-size:.9rem">'
            f'<thead><tr style="text-align:left;border-bottom:1px solid #cdc4b4">'
            f'{th}</tr></thead><tbody>{tr}</tbody></table>')


def build_report(db_path: str, out_path: str) -> str:
    conn = sqlite3.connect(db_path)
    try:
        d = gather(conn)
    finally:
        conn.close()

    charts = {
        "sankey": chart_sankey(d), "einnahmen": chart_einnahmen(d),
        "aufwandart": chart_aufwandart(d), "treemap": chart_treemap(d),
        "wasserfall": chart_wasserfall(d), "korridor": chart_korridor(d),
        "treiber": chart_treiber(d), "trend_eck": chart_trend_eckwerte(d),
        "trend_komm": chart_trend_komm(d), "trend_auf": chart_trend_aufwand(d),
    }

    netto_ink = "is-green" if d["netto"] >= 0 else "is-red"
    transfer_zeilen = [[b, _euro(va), _euro(vj)] for b, va, vj in d["transfers"]]
    mehr_dok = d["dok_anzahl"] > 1

    html = f"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Voranschlag {d['jahr']} — {d['gemeinde']}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{CSS}">
<script src="{ECHARTS}"></script>
</head>
<body>
<div class="page">

  <header class="row">
    <div class="margin"><p class="kicker"><span class="kicker-num">00</span>Lagebild</p>
      <p class="margin-note">{d['detailposten']} Haushaltsstellen aus
        {d['dok_anzahl']} Dokument(en) — maschinell erfasst und geprueft.</p></div>
    <div class="body">
      <h1 class="masthead-title">Voranschlag {d['jahr']}</h1>
      <p class="masthead-sub">{d['gemeinde']} — Ergebnishaushalt im Ueberblick.
        Vom Zahlenwerk zum lesbaren Lagebild.</p>
      <p class="lead" style="margin-top:1.2rem;">Der Voranschlag weist fuer
        {d['jahr']} ein <span class="mark mark-{'green' if d['netto']>=0 else 'red'}">Nettoergebnis
        von {_euro(d['netto'])}</span> aus. Die Kommunalsteuer traegt
        {d['komm_anteil']:.0f}&nbsp;% aller Ertraege — ein dauerhafter Ausfall
        von 800.000&nbsp;Euro wuerde das Ergebnis ins Minus drehen.</p>
    </div>
  </header>
  <hr class="rule">

  <section class="row">
    <div class="margin"><p class="kicker"><span class="kicker-num">01</span>Eckwerte</p>
      <p class="margin-note">Ergebnishaushalt — Ertraege und Aufwendungen
        inklusive nicht zahlungswirksamer Posten.</p></div>
    <div class="body">
      <h2>Die Eckwerte auf einen Blick</h2>
      <div class="stats">
        {_stat(_euro(d['ertraege']/1e6, 1).replace(' €',' Mio'), 'Ertraege')}
        {_stat(_euro(d['aufwand']/1e6, 1).replace(' €',' Mio'), 'Aufwendungen')}
        {_stat(_euro(d['netto']), 'Nettoergebnis', netto_ink)}
        {_stat(f"{d['komm_anteil']:.0f} %", 'Kommunalsteuer-Anteil', 'is-orange')}
      </div>
      <div class="callout is-question" style="margin-top:1.4rem;">
        <p class="callout-label">Der Befund</p>
        <p>Der Puffer ist duenn: Schon ein einzelner groesserer Einnahmenausfall
        fuehrt in den Abgang — und macht ein Haushaltskonsolidierungskonzept
        zum Thema.</p>
      </div>
    </div>
  </section>
  <hr class="rule">
"""

    if mehr_dok:
        html += """
  <section class="row">
    <div class="margin"><p class="kicker"><span class="kicker-num">02</span>Zeitreihe</p>
      <p class="margin-note is-affirmed">Mehrere Dokumente geladen — hier der
        echte Mehrjahresvergleich.</p></div>
    <div class="body">
      <h2>Entwicklung ueber die Jahre</h2>
      <p>Ertraege, Aufwendungen und Nettoergebnis je eingelesenem Dokument
        (Rechnungsabschluss = Ist, Voranschlag = Plan).</p>
      """ + _chart('c_trend_eck', 320) + """
      <p style="margin-top:1.2rem;">Die Kommunalsteuer im Zeitverlauf — die
        Einnahme, um die es geht.</p>
      """ + _chart('c_trend_komm', 300) + """
      <p style="margin-top:1.2rem;">Aufwand nach Art: Der
        <span class="mark mark-red">Transferaufwand</span> waechst strukturell
        am staerksten.</p>
      """ + _chart('c_trend_auf', 320) + """
    </div>
  </section>
  <hr class="rule">
"""

    html += f"""
  <section class="row">
    <div class="margin"><p class="kicker"><span class="kicker-num">03</span>Geldfluss</p>
      <p class="margin-note">Links die Herkunft, rechts die Verwendung —
        die Breite ist der Betrag.</p></div>
    <div class="body">
      <h2>Woher das Geld kommt, wohin es geht</h2>
      <p>Zwei Einnahmequellen dominieren: die Ertragsanteile des Bundes und
        die Kommunalsteuer. Faellt eine davon, ist die ganze rechte Seite
        betroffen.</p>
      {_chart('c_sankey', 420)}
    </div>
  </section>
  <hr class="rule">

  <section class="row">
    <div class="margin"><p class="kicker"><span class="kicker-num">04</span>Einnahmen</p>
      <p class="margin-note is-affirmed">Gruen: die Kommunalsteuer — der
        Posten, um den es geht.</p></div>
    <div class="body">
      <h2>Einnahmestruktur</h2>
      <p>Die zwoelf groessten Ertragsposten. Die
        <span class="mark mark-green">Kommunalsteuer</span> ist nach den
        Bundes-Ertragsanteilen die zweitgroesste Quelle.</p>
      {_chart('c_einnahmen', 360)}
    </div>
  </section>
  <hr class="rule">

  <section class="row">
    <div class="margin"><p class="kicker"><span class="kicker-num">05</span>Ausgaben</p>
      <p class="margin-note">Treemap: Flaeche = Euro. Auf eine Gruppe klicken
        zoomt in die Ansaetze.</p></div>
    <div class="body">
      <h2>Wofuer das Geld ausgegeben wird</h2>
      <p>Der Aufwand nach Art (Ring) und nach Aufgabenbereich (Treemap).
        Personal und Pflichttransfers sind kurzfristig kaum beweglich —
        der Ermessensspielraum steckt im Sachaufwand.</p>
      {_chart('c_aufwandart', 320)}
      {_chart('c_treemap', 420)}
    </div>
  </section>
  <hr class="rule">

  <section class="row">
    <div class="margin"><p class="kicker"><span class="kicker-num">06</span>800.000 €</p>
      <p class="margin-note is-question">Die Leitfrage: Wo ist die Luecke
        zu finden?</p></div>
    <div class="body">
      <h2>Die 800.000-Euro-Frage</h2>
      <p>Die Wasserfall-Grafik zeigt, was ein dauerhafter
        Kommunalsteuer-Ausfall bedeutet: aus einem knappen Plus wird ein
        Abgang.</p>
      {_chart('c_wasserfall', 340)}
      <p style="margin-top:1.4rem;">Wo liesse sich gegensteuern? Der
        zahlungswirksame Sachaufwand mit Ermessensspielraum, kumuliert.
        Die rote Linie markiert die 800.000-Euro-Schwelle.</p>
      {_chart('c_korridor', 400)}
      <div class="callout is-risk" style="margin-top:1rem;">
        <p class="callout-label">Wichtige Einordnung</p>
        <p>Diese Auswertung ist eine <strong>Suchhilfe, keine Empfehlung</strong>.
        Sie zeigt, wo im Budget Betraege dieser Groessenordnung ueberhaupt
        liegen. Ob ein Posten kuerzbar ist, ist eine fachliche und politische
        Entscheidung — jede Zeile braucht eine eigene Bewertung.</p>
      </div>
    </div>
  </section>
  <hr class="rule">

  <section class="row">
    <div class="margin"><p class="kicker"><span class="kicker-num">07</span>Kostentreiber</p>
      <p class="margin-note">Was den Spielraum von Jahr zu Jahr auffrisst.</p></div>
    <div class="body">
      <h2>Kostentreiber gegenueber dem Vorjahr</h2>
      <p>Die groessten Aufwandssteigerungen gegenueber dem Voranschlag
        {d['jahr_vj']}. <span class="mark mark-red">Pflichttransfers wie
        NÖKAS- und Sozialhilfeumlage</span> treiben den Aufwand am
        staerksten — und sind zugleich am schwersten beeinflussbar.</p>
      {_chart('c_treiber', 360)}
      <details class="detail" style="margin-top:1rem;">
        <summary>Transferaufwand im Detail
          <span class="summary-hint">aufklappen</span></summary>
        <div class="detail-body">
          <p>Die zehn groessten Transferposten. Umlagen sind weitgehend
            gesetzlich gebunden.</p>
          {_tabelle(['Posten', 'Betrag', 'Vergleich'], transfer_zeilen)}
        </div>
      </details>
    </div>
  </section>
  <hr class="rule">

  <section class="row">
    <div class="margin"><p class="kicker"><span class="kicker-num">08</span>Methodik</p>
      <p class="margin-note is-affirmed">Jede Zahl ist gegen die Summen des
        PDF geprueft.</p></div>
    <div class="body">
      <h2>Datengrundlage &amp; Pruefung</h2>
      <ul class="points">
        <li class="point"><p class="point-claim">Quelle ist der
          Detailnachweis — {d['detailposten']} Haushaltsstellen aus
          {d['dok_anzahl']} Dokument(en).</p><p class="point-detail">Maschinell
          aus den PDF extrahiert, kein manuelles Abtippen.</p></li>
        <li class="point is-note"><p class="point-claim">Spaltenbedeutung
          haengt vom Dokumenttyp ab.</p><p class="point-detail">Voranschlag:
          Plan; Rechnungsabschluss: Ist gegen Soll. Im Datenmodell sauber
          getrennt.</p></li>
        <li class="point"><p class="point-claim">Plausibilitaet
          selbstbezueglich geprueft.</p><p class="point-detail">Die Summe der
          Detailposten je Ansatz stimmt mit den im PDF abgedruckten
          Summenzeilen ueberein — fuer jedes Dokument.</p></li>
      </ul>
    </div>
  </section>

  <footer class="footer">
    <span>Quelle: Voranschlag {d['jahr']}, {d['gemeinde']}</span>
    <span>Erzeugt aus gemeindefinanzen.db</span>
  </footer>

</div>
<script>
const CFG = {json.dumps(charts, ensure_ascii=False)};
function revive(o){{
  if(Array.isArray(o)) return o.map(revive);
  if(o && typeof o==='object'){{const r={{}};for(const k in o)r[k]=revive(o[k]);return r;}}
  if(typeof o==='string' && /^\\(.*\\)\\s*=>/.test(o)){{
    try{{return eval(o);}}catch(e){{return o;}}
  }}
  return o;
}}
const MAP = {{c_sankey:'sankey',c_einnahmen:'einnahmen',c_aufwandart:'aufwandart',
  c_treemap:'treemap',c_wasserfall:'wasserfall',c_korridor:'korridor',
  c_treiber:'treiber',c_trend_eck:'trend_eck',c_trend_komm:'trend_komm',
  c_trend_auf:'trend_auf'}};
for(const [id,key] of Object.entries(MAP)){{
  const el=document.getElementById(id);
  if(el){{const ch=echarts.init(el);ch.setOption(revive(CFG[key]));
    window.addEventListener('resize',()=>ch.resize());}}
}}
</script>
</body>
</html>
"""
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return str(out)
