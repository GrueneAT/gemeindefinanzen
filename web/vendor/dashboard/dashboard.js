(function () {
  "use strict";

  // DATA und CFG werden im vorangehenden <script>-Block gesetzt.
  var docs   = DATA.dokumente;
  var posten = DATA.posten;
  var aggs   = DATA.aggregate;
  var meta   = DATA.meta;
  var dokChart   = CFG.dok_charts;
  var trendChart = CFG.trend_charts;
  var mehrjahrCfg = CFG.mehrjahr;

  var aktivDok = String(meta.default_dok);

  // Dokumente in chronologischer Reihenfolge — x-Achse des Mehrjahres-Charts.
  var jahrFolge = mehrjahrCfg.dok_reihenfolge.map(function (id) {
    return String(id);
  });

  // --- Hilfen --------------------------------------------------------------
  function euro(v, mio) {
    if (mio) return (v / 1e6).toLocaleString("de-AT",
      { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " Mio €";
    return Math.round(v).toLocaleString("de-AT") + " €";
  }
  function dokLabel(id) {
    var d = docs.find(function (x) { return String(x.id) === String(id); });
    return d ? d.label : id;
  }

  // ECharts-Formatterstrings "(...)=>..." in echte Funktionen zurueckwandeln.
  function revive(o) {
    if (Array.isArray(o)) return o.map(revive);
    if (o && typeof o === "object") {
      var r = {};
      for (var k in o) r[k] = revive(o[k]);
      return r;
    }
    if (typeof o === "string" && /^\(.*\)\s*=>/.test(o)) {
      try { return eval(o); } catch (e) { return o; }
    }
    return o;
  }

  // --- ECharts-Verwaltung --------------------------------------------------
  // charts[divId] = { inst, kind, src }
  //   kind "dok":   src ist der Chart-Schluessel im dokChart[aktivDok]
  //   kind "trend": src ist der Chart-Schluessel in trendChart
  var charts = {};

  function registerChart(divId, kind, src) {
    var el = document.getElementById(divId);
    if (!el) return;
    var inst = echarts.init(el);
    charts[divId] = { inst: inst, kind: kind, src: src };
  }

  function chartOption(entry) {
    if (entry.kind === "trend") return trendChart[entry.src];
    var byDok = dokChart[aktivDok] || {};
    return byDok[entry.src];
  }

  function renderChart(divId) {
    var entry = charts[divId];
    if (!entry) return;
    var opt = chartOption(entry);
    if (opt) entry.inst.setOption(revive(opt), true);
  }

  function renderAllCharts() {
    Object.keys(charts).forEach(renderChart);
  }

  function resizeVisibleCharts() {
    Object.keys(charts).forEach(function (divId) {
      var el = document.getElementById(divId);
      if (el && el.offsetParent !== null) charts[divId].inst.resize();
    });
  }

  // --- Tabs ----------------------------------------------------------------
  function activateTab(name) {
    document.querySelectorAll(".tab-btn").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.tab === name);
    });
    document.querySelectorAll(".tab-panel").forEach(function (p) {
      p.classList.toggle("is-active", p.dataset.panel === name);
    });
    // ECharts kennt die Groesse erst, wenn das Panel sichtbar ist.
    requestAnimationFrame(resizeVisibleCharts);
  }

  // --- Dokument-Umschalter -------------------------------------------------
  // rerenderHooks: zusaetzliche Aktualisierungen je Dokumentwechsel.
  var rerenderHooks = [];
  function onDocChange(fn) { rerenderHooks.push(fn); }

  function setDok(id) {
    aktivDok = String(id);
    document.querySelectorAll(".switch-btn").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.dok === aktivDok);
    });
    renderAllCharts();
    rerenderHooks.forEach(function (fn) { fn(aktivDok); });
    requestAnimationFrame(resizeVisibleCharts);
  }

  // --- Stat-Karten je Dokument --------------------------------------------
  function fillText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function rerenderStats(dokId) {
    var e = aggs[dokId].eckwerte;
    fillText("st-ertraege", euro(e.ertraege, true));
    fillText("st-aufwand", euro(e.aufwand, true));
    fillText("st-netto", euro(e.netto));
    fillText("st-komm-anteil", e.komm_anteil.toLocaleString("de-AT") + " %");
    var nettoEl = document.getElementById("st-netto");
    if (nettoEl) {
      nettoEl.classList.toggle("is-green", e.netto >= 0);
      nettoEl.classList.toggle("is-red", e.netto < 0);
    }
    fillText("kennzahl-dok", dokLabel(dokId));
    fillText("kennzahl-netto", euro(e.netto));
  }

  // --- Tabellen je Dokument ------------------------------------------------
  function tableRows(tbodyId, rows) {
    var tb = document.getElementById(tbodyId);
    if (!tb) return;
    tb.innerHTML = rows.map(function (cells) {
      return "<tr>" + cells.map(function (c) {
        return "<td" + (c.num ? ' class="num"' : "") + ">" + c.text + "</td>";
      }).join("") + "</tr>";
    }).join("");
  }
  function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }

  function rerenderTables(dokId) {
    var a = aggs[dokId];
    tableRows("tbl-einnahmen", a.einnahmen.map(function (r) {
      return [{ text: esc(r[0]) }, { text: euro(r[1]), num: true }];
    }));
    tableRows("tbl-ausgaben", a.treiber.map(function (r) {
      return [{ text: esc(r[0]) }, { text: euro(r[1]), num: true }];
    }));
    tableRows("tbl-investitionen", a.investitionen.map(function (r) {
      return [{ text: esc(r[0]) }, { text: esc(r[1]) },
              { text: euro(r[2]), num: true }];
    }));
    tableRows("tbl-transfers", a.transfers.map(function (r) {
      var pflicht = /umlage|nökas|nokas|sozialhilfe|krankenanstalt/i
        .test(r[0]);
      return [{ text: esc(r[0]) },
              { text: pflicht ? "Pflichtumlage" : "freiwillig/sonstige" },
              { text: euro(r[1]), num: true },
              { text: euro(r[2]), num: true }];
    }));
  }

  // --- Drill-down: Gruppe -> Ansatz -> Posten ------------------------------
  // Pfad: [] | [gruppe] | [gruppe, ansatz]
  var drillPfad = [];

  function ausgabePosten(dokId) {
    return posten.filter(function (p) {
      return String(p.dok) === String(dokId) &&
             p.richtung === "ausgabe" && p.ew > 0;
    });
  }

  function renderDrill() {
    var listEl = document.getElementById("drill-list");
    var crumbEl = document.getElementById("drill-crumbs");
    if (!listEl || !crumbEl) return;
    var rows = ausgabePosten(aktivDok);

    // Brotkrumen
    var crumbs = ['<button data-level="0"' +
      (drillPfad.length === 0 ? " disabled" : "") +
      ">Alle Aufgabengruppen</button>"];
    if (drillPfad.length >= 1) {
      crumbs.push('<span class="sep">/</span>');
      crumbs.push('<button data-level="1"' +
        (drillPfad.length === 1 ? " disabled" : "") + ">" +
        esc(drillPfad[0].text) + "</button>");
    }
    if (drillPfad.length >= 2) {
      crumbs.push('<span class="sep">/</span>');
      crumbs.push('<button data-level="2" disabled>' +
        esc(drillPfad[1].text) + "</button>");
    }
    crumbEl.innerHTML = crumbs.join("");

    var items;
    if (drillPfad.length === 0) {
      var byGruppe = {};
      rows.forEach(function (p) {
        var key = p.gruppe;
        if (!byGruppe[key]) {
          byGruppe[key] = { code: key, text: p.gruppe_text || "ohne Gruppe",
                            sum: 0 };
        }
        byGruppe[key].sum += p.ew;
      });
      items = Object.keys(byGruppe).sort().map(function (k) {
        var g = byGruppe[k];
        return { code: g.code, text: g.text, sum: g.sum,
                 next: { code: g.code, text: g.text } };
      });
    } else if (drillPfad.length === 1) {
      var g0 = drillPfad[0].code;
      var byAnsatz = {};
      rows.filter(function (p) { return p.gruppe === g0; })
          .forEach(function (p) {
        var key = p.ansatz;
        if (!byAnsatz[key]) {
          byAnsatz[key] = { code: key, text: p.ansatz_text || "ohne Ansatz",
                            sum: 0 };
        }
        byAnsatz[key].sum += p.ew;
      });
      items = Object.keys(byAnsatz).sort().map(function (k) {
        var a = byAnsatz[k];
        return { code: a.code, text: a.text, sum: a.sum,
                 next: { code: a.code, text: a.text } };
      });
    } else {
      var g1 = drillPfad[0].code, a1 = drillPfad[1].code;
      items = rows.filter(function (p) {
        return p.gruppe === g1 && p.ansatz === a1;
      }).sort(function (x, y) { return y.ew - x.ew; })
        .map(function (p) {
          return { code: p.konto, text: p.bezeichnung, sum: p.ew,
                   next: null };
        });
    }

    // Ebene fuer die Mehrjahres-Aktion: 0 = Gruppe, 1 = Ansatz.
    var mjEbene = drillPfad.length;

    var ges = items.reduce(function (s, i) { return s + i.sum; }, 0);
    listEl.innerHTML = items.map(function (i) {
      var clickable = i.next ? " is-clickable" : "";
      var dataAttr = i.next
        ? ' data-code="' + esc(i.next.code) + '" data-text="' +
          esc(i.next.text) + '"'
        : "";
      var chev = i.next ? '<span class="chev">&rsaquo;</span>' : "";
      // Gruppen- und Ansatz-Zeilen bekommen eine Mehrjahres-Aktion.
      var mjBtn = (mjEbene <= 1 && i.next)
        ? '<button class="mj-drill" data-mj-code="' + esc(i.code) +
          '" data-mj-text="' + esc(i.text) +
          '">über die Jahre</button>'
        : "";
      return '<li class="drill-row' + clickable + '"' + dataAttr + ">" +
        '<span class="label"><span class="code">' + esc(i.code) +
        "</span>" + esc(i.text) + "</span>" +
        '<span class="betrag">' + euro(i.sum) + "</span>" + mjBtn +
        chev + "</li>";
    }).join("");
    var sumEl = document.getElementById("drill-sum");
    if (sumEl) {
      sumEl.textContent = items.length + " Posten — Summe " + euro(ges);
    }
  }

  function setupDrill() {
    var listEl = document.getElementById("drill-list");
    var crumbEl = document.getElementById("drill-crumbs");
    if (!listEl || !crumbEl) return;
    listEl.addEventListener("click", function (ev) {
      // Mehrjahres-Aktion hat Vorrang vor der Drill-Navigation.
      var mjBtn = ev.target.closest(".mj-drill");
      if (mjBtn) {
        ev.stopPropagation();
        var code = mjBtn.dataset.mjCode;
        var text = mjBtn.dataset.mjText;
        if (drillPfad.length === 0) {
          // Gruppe ueber die Jahre: alle Ausgabe-Posten dieser Gruppe.
          openMehrjahr("Aufgabengruppe über die Jahre",
            code + " " + text + " — Ausgaben je Dokument aufsummiert.",
            gruppenLinie(code + " " + text, function (p) {
              return p.richtung === "ausgabe" && p.gruppe === code;
            }), "");
        } else {
          // Ansatz ueber die Jahre: alle Ausgabe-Posten dieses Ansatzes
          // innerhalb der aktuellen Gruppe.
          var g0 = drillPfad[0].code;
          openMehrjahr("Ansatz über die Jahre",
            code + " " + text + " — Ausgaben je Dokument aufsummiert.",
            gruppenLinie(code + " " + text, function (p) {
              return p.richtung === "ausgabe" && p.gruppe === g0 &&
                     p.ansatz === code;
            }), "");
        }
        return;
      }
      var row = ev.target.closest(".drill-row.is-clickable");
      if (!row) return;
      drillPfad.push({ code: row.dataset.code, text: row.dataset.text });
      renderDrill();
    });
    crumbEl.addEventListener("click", function (ev) {
      var btn = ev.target.closest("button[data-level]");
      if (!btn) return;
      drillPfad = drillPfad.slice(0, parseInt(btn.dataset.level, 10));
      renderDrill();
    });
    onDocChange(function () { drillPfad = []; renderDrill(); });
  }

  // --- Mehrjahres-Vergleich: Posten/Gruppen ueber die Jahre ----------------
  // Wert eines Postens: Ergebnishaushalt, ersatzweise Finanzierungshaushalt.
  function postenWert(p) {
    if (p.ew !== 0 && p.ew != null) return p.ew;
    return p.fw || 0;
  }

  var MJ_MAX = 10;          // Obergrenze sichtbarer Linien
  var mjChart = null;       // ECharts-Instanz im Overlay (lazy)

  // Eine Linie je Dokument: Werte aller passenden Posten je Dokument summiert.
  function reiheUeberJahre(filterFn) {
    return jahrFolge.map(function (dokId) {
      var summe = 0;
      var treffer = false;
      posten.forEach(function (p) {
        if (String(p.dok) !== dokId) return;
        if (!filterFn(p)) return;
        treffer = true;
        summe += postenWert(p);
      });
      return treffer ? Math.round(summe) : null;
    });
  }

  // Eine Linie je ausgewaehltem Posten — gematcht ueber ansatz+konto.
  function postenLinien(auswahl) {
    return auswahl.map(function (sel, idx) {
      var farbe = mehrjahrCfg.palette[idx % mehrjahrCfg.palette.length];
      var werte = reiheUeberJahre(function (p) {
        return p.ansatz === sel.ansatz && p.konto === sel.konto;
      });
      return {
        name: sel.name, type: "line", connectNulls: false,
        symbolSize: 7, data: werte,
        itemStyle: { color: farbe },
        lineStyle: { color: farbe, width: 2 },
      };
    });
  }

  // Eine einzelne aggregierte Linie fuer eine ganze gefilterte Menge.
  function gruppenLinie(name, filterFn) {
    var werte = reiheUeberJahre(filterFn);
    return [{
      name: name, type: "line", connectNulls: false,
      symbolSize: 8, data: werte,
      itemStyle: { color: mehrjahrCfg.palette[0] },
      lineStyle: { color: mehrjahrCfg.palette[0], width: 2.5 },
      areaStyle: { color: "rgba(31,74,109,0.10)" },
      label: { show: true, position: "top",
               fontFamily: "Inter, sans-serif", fontSize: 10,
               formatter: function (pt) {
                 return pt.value == null ? ""
                   : (pt.value / 1000).toLocaleString("de-AT") + "k";
               } },
    }];
  }

  function openMehrjahr(titel, sub, series, hinweis) {
    var ov = document.getElementById("mj-overlay");
    if (!ov) return;
    fillText("mj-titel", titel);
    fillText("mj-sub", sub || "");
    var hintEl = document.getElementById("mj-hint");
    if (hintEl) hintEl.textContent = hinweis || "";
    ov.classList.add("is-open");
    var el = document.getElementById("mj-chart");
    if (!el) return;
    if (!mjChart) mjChart = echarts.init(el);
    var hatDaten = series.some(function (s) {
      return s.data.some(function (v) { return v != null; });
    });
    var emptyEl = document.getElementById("mj-empty");
    if (emptyEl) {
      emptyEl.textContent = hatDaten ? ""
        : "Keine Werte fuer diese Auswahl in den geladenen Dokumenten.";
    }
    var opt = JSON.parse(JSON.stringify(mehrjahrCfg.basis));
    opt.series = series;
    mjChart.setOption(revive(opt), true);
    requestAnimationFrame(function () { mjChart.resize(); });
  }

  function closeMehrjahr() {
    var ov = document.getElementById("mj-overlay");
    if (ov) ov.classList.remove("is-open");
  }

  function setupMehrjahr() {
    var ov = document.getElementById("mj-overlay");
    if (!ov) return;
    var closeBtn = document.getElementById("mj-close");
    if (closeBtn) closeBtn.addEventListener("click", closeMehrjahr);
    ov.addEventListener("click", function (ev) {
      if (ev.target === ov) closeMehrjahr();
    });
    window.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeMehrjahr();
    });
  }

  // --- Tab 7: Suche & Daten ------------------------------------------------
  var LIMIT = 500;

  // Posten-Identitaet fuer den Mehrjahres-Vergleich (gleiche Stelle = gleiche
  // ansatz+konto-Kombination ueber alle Dokumente hinweg).
  function postenKey(p) { return p.ansatz + "|" + p.konto; }
  function postenName(p) {
    var bez = p.bezeichnung || p.konto || postenKey(p);
    return p.ansatz ? p.ansatz + " " + bez : bez;
  }

  function setupSearch() {
    var box = document.getElementById("such-box");
    if (!box) return;
    var qEl     = document.getElementById("f-such");
    var dokEl   = document.getElementById("f-dok");
    var grpEl   = document.getElementById("f-gruppe");
    var richtEl = document.getElementById("f-richtung");
    var gebEl   = document.getElementById("f-gebarung");
    var minEl   = document.getElementById("f-min");
    var maxEl   = document.getElementById("f-max");
    var tbody   = document.getElementById("such-tbody");
    var metaEl  = document.getElementById("such-meta");
    var hintEl  = document.getElementById("such-hint");
    var headEls = box.querySelectorAll("th.sortable");
    var pickAll = document.getElementById("such-pickall");
    var mjSel   = document.getElementById("mj-selected");
    var mjGroup = document.getElementById("mj-group");
    var mjCount = document.getElementById("mj-count");

    var sortKey = null, sortDir = 1;
    // Auswahl der Suchtabelle — Schluessel ansatz|konto -> Anzeigename.
    var auswahl = {};
    var letzteTreffer = [];   // zuletzt gefilterte (ungekuerzte) Menge

    function auswahlAnzahl() { return Object.keys(auswahl).length; }

    function syncAuswahl() {
      var n = auswahlAnzahl();
      if (mjCount) {
        mjCount.textContent = n === 0 ? "keine Zeile gewaehlt"
          : n + (n === 1 ? " Posten gewaehlt" : " Posten gewaehlt");
      }
      if (mjSel) mjSel.disabled = n === 0;
    }

    function matches() {
      var q = (qEl.value || "").trim().toLowerCase();
      var dok = dokEl.value, grp = grpEl.value, richt = richtEl.value;
      var geb = gebEl.value;
      var min = minEl.value === "" ? null : parseFloat(minEl.value);
      var max = maxEl.value === "" ? null : parseFloat(maxEl.value);
      return posten.filter(function (p) {
        if (dok && String(p.dok) !== dok) return false;
        if (grp && p.gruppe !== grp) return false;
        if (richt && p.richtung !== richt) return false;
        if (geb && p.gebarung !== geb) return false;
        if (min !== null && p.ew < min) return false;
        if (max !== null && p.ew > max) return false;
        if (q) {
          var hay = (p.bezeichnung + " " + p.konto + " " + p.ansatz + " " +
                     p.ansatz_text).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
    }

    function row(p) {
      var c = [
        dokLabel(p.dok), p.richtung,
        p.gruppe + " " + p.gruppe_text, p.ansatz, p.konto, p.bezeichnung,
        p.ew, p.ev, p.ed, p.fw, p.fv, p.fd, p.mvag, p.qu,
      ];
      var key = postenKey(p);
      var pick = '<td class="pick"><input type="checkbox" class="row-pick"' +
        ' data-key="' + esc(key) + '" data-name="' + esc(postenName(p)) +
        '"' + (auswahl[key] ? " checked" : "") + "></td>";
      return "<tr>" + pick + c.map(function (v, i) {
        var num = i >= 6 && i <= 11;
        var text = num ? Math.round(v).toLocaleString("de-AT") : esc(v);
        return "<td" + (num ? ' class="num"' : "") + ">" + text + "</td>";
      }).join("") + "</tr>";
    }

    function apply() {
      var rows = matches();
      if (sortKey) {
        rows = rows.slice().sort(function (a, b) {
          var x = a[sortKey], y = b[sortKey];
          if (typeof x === "number" && typeof y === "number") {
            return (x - y) * sortDir;
          }
          return String(x).localeCompare(String(y), "de") * sortDir;
        });
      }
      letzteTreffer = rows;
      var ges = rows.reduce(function (s, p) { return s + p.ew; }, 0);
      metaEl.innerHTML = "<strong>" + rows.length.toLocaleString("de-AT") +
        "</strong> Treffer — Summe Einnahmen/Ausgaben-Spalte " +
        "<strong>" + euro(ges) + "</strong>";
      var shown = rows.slice(0, LIMIT);
      tbody.innerHTML = shown.map(row).join("");
      hintEl.textContent = rows.length > LIMIT
        ? "Nur die ersten " + LIMIT + " von " +
          rows.length.toLocaleString("de-AT") +
          " Treffern angezeigt — Filter verfeinern."
        : "";
      if (mjGroup) mjGroup.disabled = rows.length === 0;
      if (pickAll) pickAll.checked = false;
      syncAuswahl();
    }

    var t = null;
    function debounced() {
      clearTimeout(t);
      t = setTimeout(apply, 180);
    }
    qEl.addEventListener("input", debounced);
    [dokEl, grpEl, richtEl, gebEl].forEach(function (el) {
      el.addEventListener("change", apply);
    });
    [minEl, maxEl].forEach(function (el) {
      el.addEventListener("input", debounced);
    });

    headEls.forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.dataset.key;
        if (sortKey === key) { sortDir = -sortDir; }
        else { sortKey = key; sortDir = 1; }
        headEls.forEach(function (h) {
          var a = h.querySelector(".arrow");
          if (a) a.textContent = "";
        });
        var arrow = th.querySelector(".arrow");
        if (arrow) arrow.textContent = sortDir > 0 ? "▲" : "▼";
        apply();
      });
    });

    // Einzelauswahl je Zeile.
    tbody.addEventListener("change", function (ev) {
      var cb = ev.target;
      if (!cb || !cb.classList || !cb.classList.contains("row-pick")) return;
      var key = cb.dataset.key;
      if (cb.checked) { auswahl[key] = cb.dataset.name; }
      else { delete auswahl[key]; }
      syncAuswahl();
    });

    // Kopf-Auswahl: alle sichtbaren (gekuerzten) Treffer waehlen/abwaehlen.
    if (pickAll) {
      pickAll.addEventListener("change", function () {
        var sichtbar = letzteTreffer.slice(0, LIMIT);
        if (pickAll.checked) {
          sichtbar.forEach(function (p) {
            auswahl[postenKey(p)] = postenName(p);
          });
        } else {
          sichtbar.forEach(function (p) { delete auswahl[postenKey(p)]; });
        }
        tbody.querySelectorAll(".row-pick").forEach(function (cb) {
          cb.checked = !!auswahl[cb.dataset.key];
        });
        syncAuswahl();
      });
    }

    // Aktion: ausgewaehlte Posten ueber die Jahre.
    if (mjSel) {
      mjSel.addEventListener("click", function () {
        var keys = Object.keys(auswahl);
        if (keys.length === 0) return;
        var hinweis = "";
        if (keys.length > MJ_MAX) {
          hinweis = "Auswahl auf die ersten " + MJ_MAX + " von " +
            keys.length + " Posten begrenzt — fuer mehr die Gruppen-Ansicht " +
            "nutzen.";
          keys = keys.slice(0, MJ_MAX);
        }
        var sel = keys.map(function (k) {
          var teil = k.split("|");
          return { ansatz: teil[0], konto: teil[1], name: auswahl[k] };
        });
        openMehrjahr("Ausgewaehlte Posten ueber die Jahre",
          sel.length + " Posten, gematcht ueber Ansatz und Konto. " +
          "Linie je Posten, fehlende Jahre als Luecke.",
          postenLinien(sel), hinweis);
      });
    }

    // Aktion: aktuelle Filtermenge als eine aggregierte Gruppe.
    if (mjGroup) {
      mjGroup.addEventListener("click", function () {
        if (letzteTreffer.length === 0) return;
        // Menge ueber ansatz+konto identifizieren — dokumentunabhaengig.
        var mengeKeys = {};
        letzteTreffer.forEach(function (p) { mengeKeys[postenKey(p)] = 1; });
        var q = (qEl.value || "").trim();
        var name = q ? 'Gefilterte Menge "' + q + '"'
                     : "Gefilterte Menge";
        openMehrjahr(name + " als Gruppe",
          Object.keys(mengeKeys).length + " unterschiedliche Posten, " +
          "je Dokument aufsummiert.",
          gruppenLinie(name, function (p) {
            return mengeKeys[postenKey(p)] === 1;
          }), "");
      });
    }

    apply();
  }

  // --- Verdrahtung ---------------------------------------------------------
  document.querySelector(".tabs").addEventListener("click", function (ev) {
    var btn = ev.target.closest(".tab-btn");
    if (btn) activateTab(btn.dataset.tab);
  });
  document.querySelector(".switcher").addEventListener("click",
    function (ev) {
      var btn = ev.target.closest(".switch-btn");
      if (btn) setDok(btn.dataset.dok);
    });
  window.addEventListener("resize", resizeVisibleCharts);

  // Charts registrieren (Trend-Charts unabhaengig vom Dokument).
  registerChart("c_sankey", "dok", "sankey");
  registerChart("c_einnahmen", "dok", "einnahmen");
  registerChart("c_aufwandart", "dok", "aufwandart");
  registerChart("c_treemap", "dok", "treemap");
  registerChart("c_wasserfall", "dok", "wasserfall");
  registerChart("c_korridor", "dok", "korridor");
  registerChart("c_treiber", "dok", "treiber");
  registerChart("c_investitionen", "dok", "investitionen");
  registerChart("c_trend_eck", "trend", "trend_eck");
  registerChart("c_trend_komm", "trend", "trend_komm");
  registerChart("c_trend_auf", "trend", "trend_auf");

  onDocChange(rerenderStats);
  onDocChange(rerenderTables);
  setupMehrjahr();
  setupDrill();
  setupSearch();

  // Initialdarstellung.
  setDok(aktivDok);
  activateTab("ueberblick");
})();
