"""ECharts-Optionsbausteine fuer das Dashboard.

Jede Funktion liefert ein ECharts-Options-Dict. Die dokumentbezogenen
Diagramme erhalten das Aggregat eines Dokuments (``agg``) als Argument, die
Zeitreihen-Diagramme das ``trend``-Objekt. Formatter-Funktionen werden als
``(...)=>...``-Strings eingebettet und clientseitig per ``revive()`` in echte
Funktionen zurueckverwandelt.
"""

from __future__ import annotations

# Die vier Tinten des Design Systems — semantisch eingesetzt.
INK = {"red": "#8E2F2A", "blue": "#1F4A6D", "orange": "#9A4A1C",
       "green": "#2F6149", "soft": "#5b5650", "paper": "#F4EFE6"}


def _base_text() -> dict:
    return {"fontFamily": "Inter, sans-serif", "color": "#2b2825"}


def _cat_axis(data: list[str], fontsize: int = 11, rotate: int = 0) -> dict:
    return {"type": "category", "data": data,
            "axisLabel": {"fontFamily": "Inter, sans-serif",
                          "fontSize": fontsize, "color": "#2b2825",
                          "rotate": rotate, "interval": 0},
            "axisLine": {"lineStyle": {"color": "#cdc4b4"}}}


def _val_axis(formatter: str = "(v)=>(v/1000).toLocaleString('de')+'k'") -> dict:
    return {"type": "value",
            "axisLabel": {"fontFamily": "Inter, sans-serif", "fontSize": 10,
                          "color": "#5b5650", "formatter": formatter},
            "splitLine": {"lineStyle": {"color": "#e6dfd0"}}}


def _bar(categories: list[str], values: list[float], color: str,
         colors: list[str] | None = None) -> dict:
    data: list = ([{"value": round(v), "itemStyle": {"color": c}}
                   for v, c in zip(values, colors, strict=False)] if colors
                  else [round(v) for v in values])
    return {
        "textStyle": _base_text(),
        "grid": {"left": 8, "right": 22, "top": 12, "bottom": 8,
                 "containLabel": True},
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "xAxis": _val_axis(),
        "yAxis": _cat_axis(categories) | {"inverse": True},
        "series": [{"type": "bar", "data": data, "barWidth": "62%",
                    "itemStyle": {"color": color, "borderRadius": 2}}],
    }


# --------------------------------------------------------------------------
# Dokumentbezogene Diagramme — Argument ist das Aggregat eines Dokuments.
# --------------------------------------------------------------------------
def chart_sankey(agg: dict) -> dict:
    nodes: list[dict] = []
    links: list[dict] = []
    seen: set[str] = set()

    def node(name: str, color: str) -> None:
        if name not in seen:
            nodes.append({"name": name, "itemStyle": {"color": color}})
            seen.add(name)

    node("Gemeindehaushalt", INK["soft"])
    for name, betrag in agg["sankey"]["quellen"]:
        col = (INK["green"] if name in ("Kommunalsteuer",
                                        "Ertragsanteile (Bund)")
               else INK["blue"])
        node(name, col)
        links.append({"source": name, "target": "Gemeindehaushalt",
                      "value": betrag})
    for name, betrag in agg["sankey"]["gruppen"]:
        node(name, INK["orange"])
        links.append({"source": "Gemeindehaushalt", "target": name,
                      "value": betrag})
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "item"},
        "series": [{
            "type": "sankey", "left": 8, "right": 170, "top": 14,
            "bottom": 14, "nodeGap": 11, "nodeWidth": 13,
            "label": {"fontFamily": "Inter, sans-serif", "fontSize": 11,
                      "color": "#2b2825"},
            "lineStyle": {"color": "gradient", "opacity": 0.32,
                          "curveness": 0.5},
            "emphasis": {"focus": "adjacency"},
            "data": nodes, "links": links,
        }],
    }


def chart_einnahmen(agg: dict) -> dict:
    eintraege = agg["einnahmen"]
    cats = [b[:34] for b, _ in eintraege][::-1]
    vals = [v for _, v in eintraege][::-1]
    cols = [INK["green"] if "Kommunalsteuer" in b else INK["blue"]
            for b, _ in eintraege][::-1]
    return _bar(cats, vals, INK["blue"], colors=cols)


def chart_treiber(agg: dict) -> dict:
    cats = [b[:34] for b, _ in agg["treiber"]][::-1]
    vals = [delta for _, delta in agg["treiber"]][::-1]
    return _bar(cats, vals, INK["red"])


def chart_investitionen(agg: dict) -> dict:
    cats = [b[:36] for b, _, _ in agg["investitionen"]][::-1]
    vals = [v for _, _, v in agg["investitionen"]][::-1]
    return _bar(cats, vals, INK["orange"])


def chart_aufwandart(agg: dict) -> dict:
    palette = {"Personal": INK["blue"], "Sachaufwand": INK["orange"],
               "Transfers": INK["red"], "Finanz": INK["soft"],
               "Sonstige": "#b7ad99"}
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "item"},
        "legend": {"bottom": 0,
                   "textStyle": {"fontFamily": "Inter, sans-serif",
                                 "fontSize": 11}},
        "series": [{
            "type": "pie", "radius": ["42%", "70%"],
            "center": ["50%", "44%"], "padAngle": 2,
            "itemStyle": {"borderRadius": 3},
            "label": {"fontFamily": "Inter, sans-serif", "fontSize": 11,
                      "formatter": "{b}\\n{d}%"},
            "data": [{"name": c, "value": v,
                      "itemStyle": {"color": palette.get(c, INK["soft"])}}
                     for c, v in agg["aufwand_art"]],
        }],
    }


def chart_treemap(agg: dict) -> dict:
    gruppen: dict[str, list] = {}
    for g, a, betrag in agg["treemap"]:
        gruppen.setdefault(g, []).append({"name": a, "value": betrag})
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "item"},
        "series": [{
            "type": "treemap",
            "data": [{"name": g, "children": k}
                     for g, k in gruppen.items()],
            "top": 6, "bottom": 6, "left": 6, "right": 6,
            "roam": False, "nodeClick": "zoomToNode",
            "breadcrumb": {"show": True, "bottom": 0},
            "levels": [
                {"itemStyle": {"borderColor": "#F4EFE6", "borderWidth": 3,
                               "gapWidth": 3}},
                {"itemStyle": {"borderColor": "#F4EFE6", "borderWidth": 1,
                               "gapWidth": 1},
                 "colorSaturation": [0.32, 0.62]},
            ],
            "color": [INK["orange"], INK["blue"], INK["green"],
                      INK["red"], INK["soft"]],
            "label": {"fontFamily": "Inter, sans-serif", "fontSize": 11},
            "upperLabel": {"show": True, "height": 20,
                           "fontFamily": "Inter, sans-serif",
                           "fontSize": 11},
        }],
    }


def chart_wasserfall(agg: dict, jahr: int) -> dict:
    e = agg["eckwerte"]
    schritte = [
        ("Ertraege", e["ertraege"], INK["green"]),
        ("Aufwendungen", -e["aufwand"], INK["red"]),
        (f"Nettoergebnis {jahr}", e["netto"], INK["blue"]),
        ("Kommunalsteuer-Ausfall", -800000, INK["red"]),
        ("Ergebnis nach Ausfall", e["netto_nach_ausfall"], INK["orange"]),
    ]
    namen = [s[0] for s in schritte]
    sockel: list[float] = []
    sichtbar: list[dict] = []
    for name, wert, farbe in schritte:
        if any(t in name for t in ("Nettoergebnis", "Ergebnis")) or wert >= 0:
            sockel.append(0)
            sichtbar.append({"value": round(wert),
                             "itemStyle": {"color": farbe}})
        else:
            laufend = e["ertraege"] if "Aufwend" in name else e["netto"]
            sockel.append(round(laufend + wert))
            sichtbar.append({"value": round(-wert),
                             "itemStyle": {"color": farbe}})
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "grid": {"left": 8, "right": 18, "top": 16, "bottom": 8,
                 "containLabel": True},
        "xAxis": _cat_axis(namen, fontsize=10),
        "yAxis": _val_axis("(v)=>(v/1e6).toLocaleString('de')+' Mio'"),
        "series": [
            {"type": "bar", "stack": "w",
             "itemStyle": {"color": "transparent"},
             "data": sockel, "silent": True},
            {"type": "bar", "stack": "w", "data": sichtbar,
             "barWidth": "55%", "itemStyle": {"borderRadius": 2},
             "label": {"show": True, "position": "top",
                       "fontFamily": "Inter, sans-serif", "fontSize": 10,
                       "formatter":
                       "(p)=>(p.value/1000).toLocaleString('de')+'k'"}},
        ],
    }


def chart_korridor(agg: dict) -> dict:
    eintraege = agg["korridor"]
    cats = [b[:32] for b, _, _ in eintraege]
    einzeln = [v for _, v, _ in eintraege]
    kumuliert = [k for _, _, k in eintraege]
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "legend": {"bottom": 0,
                   "textStyle": {"fontFamily": "Inter, sans-serif",
                                 "fontSize": 11}},
        "grid": {"left": 8, "right": 18, "top": 12, "bottom": 48,
                 "containLabel": True},
        "xAxis": _cat_axis(cats, fontsize=9, rotate=38),
        "yAxis": _val_axis(),
        "series": [
            {"name": "Einzelposten", "type": "bar", "data": einzeln,
             "itemStyle": {"color": INK["orange"], "borderRadius": 2},
             "barWidth": "52%"},
            {"name": "kumuliert", "type": "line", "data": kumuliert,
             "smooth": True, "symbolSize": 5,
             "itemStyle": {"color": INK["red"]},
             "lineStyle": {"color": INK["red"]},
             "markLine": {"silent": True, "symbol": "none",
                          "label": {"formatter": "800.000 EUR",
                                    "fontSize": 10},
                          "lineStyle": {"color": INK["red"],
                                        "type": "dashed"},
                          "data": [{"yAxis": 800000}]}},
        ],
    }


# --------------------------------------------------------------------------
# Zeitreihen-Diagramme — Argument ist das ``trend``-Objekt.
# --------------------------------------------------------------------------
def chart_trend_eckwerte(trend: dict) -> dict:
    reihe = trend["eckwerte"]
    namen = [r[0] for r in reihe]
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "legend": {"bottom": 0,
                   "textStyle": {"fontFamily": "Inter, sans-serif",
                                 "fontSize": 11}},
        "grid": {"left": 8, "right": 18, "top": 14, "bottom": 40,
                 "containLabel": True},
        "xAxis": _cat_axis(namen),
        "yAxis": _val_axis("(v)=>(v/1e6).toLocaleString('de')+' Mio'"),
        "series": [
            {"name": "Ertraege", "type": "bar",
             "data": [r[1] for r in reihe],
             "itemStyle": {"color": INK["green"], "borderRadius": 2}},
            {"name": "Aufwendungen", "type": "bar",
             "data": [r[2] for r in reihe],
             "itemStyle": {"color": INK["red"], "borderRadius": 2}},
            {"name": "Nettoergebnis", "type": "line", "symbolSize": 7,
             "data": [r[3] for r in reihe],
             "itemStyle": {"color": INK["blue"]},
             "lineStyle": {"color": INK["blue"], "width": 2}},
        ],
    }


def chart_trend_komm(trend: dict) -> dict:
    reihe = trend["komm"]
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "axis"},
        "grid": {"left": 8, "right": 18, "top": 16, "bottom": 8,
                 "containLabel": True},
        "xAxis": _cat_axis([r[0] for r in reihe]),
        "yAxis": _val_axis(),
        "series": [{
            "type": "line", "smooth": True, "symbolSize": 8,
            "data": [r[1] for r in reihe],
            "itemStyle": {"color": INK["green"]},
            "lineStyle": {"color": INK["green"], "width": 2.5},
            "areaStyle": {"color": "rgba(47,97,73,0.10)"},
            "label": {"show": True, "position": "top",
                      "fontFamily": "Inter, sans-serif", "fontSize": 10,
                      "formatter":
                      "(p)=>(p.value/1e6).toLocaleString('de')+' Mio'"},
        }],
    }


def chart_trend_aufwand(trend: dict) -> dict:
    reihe = trend["aufwand"]
    namen = [r[0] for r in reihe]
    reihen = [("Personal", 1, INK["blue"]),
              ("Sachaufwand", 2, INK["orange"]),
              ("Transfers", 3, INK["red"]), ("Finanz", 4, INK["soft"])]
    return {
        "textStyle": _base_text(),
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "legend": {"bottom": 0,
                   "textStyle": {"fontFamily": "Inter, sans-serif",
                                 "fontSize": 11}},
        "grid": {"left": 8, "right": 18, "top": 14, "bottom": 40,
                 "containLabel": True},
        "xAxis": _cat_axis(namen),
        "yAxis": _val_axis("(v)=>(v/1e6).toLocaleString('de')+' Mio'"),
        "series": [{"name": name, "type": "bar", "stack": "a",
                    "data": [r[idx] for r in reihe],
                    "itemStyle": {"color": col}}
                   for name, idx, col in reihen],
    }


def alle_charts(daten: dict) -> dict:
    """Vorberechnete ECharts-Optionen je Dokument plus Zeitreihen.

    Liefert ``{dok_charts: {dok_id: {chart: option}}, trend_charts: {...}}``.
    Die dokumentbezogenen Charts liegen je Dokument vor, damit der
    Jahr-Umschalter ohne Server-Abfrage umschalten kann.
    """
    dok_charts: dict[str, dict] = {}
    for did, agg in daten["aggregate"].items():
        jahr = next((d["jahr"] for d in daten["dokumente"]
                     if str(d["id"]) == did), 0)
        dok_charts[did] = {
            "sankey": chart_sankey(agg),
            "einnahmen": chart_einnahmen(agg),
            "aufwandart": chart_aufwandart(agg),
            "treemap": chart_treemap(agg),
            "wasserfall": chart_wasserfall(agg, jahr),
            "korridor": chart_korridor(agg),
            "treiber": chart_treiber(agg),
            "investitionen": chart_investitionen(agg),
        }
    trend = daten["trend"]
    trend_charts = {
        "trend_eck": chart_trend_eckwerte(trend),
        "trend_komm": chart_trend_komm(trend),
        "trend_auf": chart_trend_aufwand(trend),
    }
    return {"dok_charts": dok_charts, "trend_charts": trend_charts}
