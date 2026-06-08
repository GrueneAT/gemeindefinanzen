# Research: Ist der OH-Direktimport technisch möglich?

**Datum:** 2026-06-08 · **Methode:** echte HTTP-Header-Inspektion (curl) +
End-to-End-Download-Flow + Browser-POC in echtem Chromium (Playwright).

## Kurzfassung

| Ansatz | Strikt statisch? | Machbar? |
| :-- | :-- | :-- |
| **A** CSV automatisch im Browser laden (echter „Direktimport") | ✅ | ❌ **Nein** — kein CORS + CSRF/Session |
| **B** Kleiner Proxy/Backend lädt CSV, App holt vom Proxy | ❌ (Server nötig) | ✅ ginge technisch — vom User ausgeschlossen |
| **C** Suche + Deep-Link auf die exakte OH-Download-Seite | ✅ | ✅ **Ja — empfohlen** |

**Fazit:** Der ursprünglich gedachte „lädt die Datei direkt rein"-Import ist
unter der Strikt-statisch-Vorgabe **nicht möglich**. Die von dir genannte
Variante — **Gemeinde suchen und auf die richtige OH-Seite verlinken** — ist
machbar und reduziert die Reibung deutlich (kein Suchen mehr nach Gemeinde,
Jahr, Typ). Der eigentliche Klick „Download" bleibt beim Nutzer.

---

## Wie der OH-Download wirklich funktioniert

offenerhaushalt.at ist eine **Laravel-App** (LiteSpeed). Der Download ist ein
mehrstufiger, **CSRF-/Session-geschützter** Ablauf — kein simpler CSV-Link:

1. `GET /gemeinde/<slug>/download` → HTML-Seite, setzt `XSRF-TOKEN` +
   `offener_haushalt_session`-Cookie, enthält `<meta name="csrf-token">`.
2. `POST /downloads/get-token` (mit `_token`) → liefert
   `{"action":".../downloads/ghdByParams","method":"POST"}`.
3. `POST /downloads/ghdByParams` mit Feldern
   `gkz, haushalt(ehh|fhh|vhh), rechnungsabschluss(ra|va), year, origin(statistik_at|gemeinde), _token`
   → **`text/csv`** mit `Content-Disposition: attachment; filename=offenerhaushalt_<gkz>_<year>_<typ>_<haushalt>.csv`.

Serverseitig (curl) **funktioniert das** — Beispiel Fohnsdorf (GKZ 62007), RA
2023, EHH: HTTP 200, `text/csv`, ~302 KB, Header exakt
`Jahr;Bundesland;Voranschlag/Rechnungsabschluss;Datenquelle;Gemeindekennziffer;…`
— also **genau das Format, das `web/js/csv-parser.js` schon parst**. Die Daten
sind erreichbar; nur eben nicht *cross-origin aus dem Browser*.

## Warum Ansatz A (Direktimport) nicht geht

Zwei unabhängige Blocker:

1. **Kein CORS.** Keine der OH-Antworten (GET-Seite, `get-token`,
   `data-availability`, `ghdByParams`) sendet einen
   `Access-Control-Allow-Origin`-Header. Der Browser **verbietet** damit jedem
   fremden Origin (z. B. `*.github.io`) das Lesen der Antwort.
2. **CSRF/Session.** Der Download braucht ein an Cookie+Session gebundenes
   `_token`. Ein fremder Origin bekommt diese Session nicht.

**Empirischer Beleg (echtes Chromium, POC unter `poc/oh-direct-fetch/`):**

```
Access to fetch at 'https://www.offenerhaushalt.at/gemeinde/fohnsdorf/download?haushalt=ehh'
from origin 'http://127.0.0.1:XXXXX' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

- `fetch(..., {mode:'cors'})` → `TypeError: Failed to fetch`.
- `fetch(..., {mode:'no-cors'})` → `type:"opaque"`, `status:0`, **0 lesbare
  Bytes** → die CSV-Daten kommen nicht in den JS-Code.
- `POST /downloads/ghdByParams` (cors) → ebenfalls CORS-blockiert.

POC ausführen (aus dem Haupt-Checkout mit `node_modules`):

```sh
node poc/oh-direct-fetch/run.mjs poc/oh-direct-fetch/index.html
```

Oder `poc/oh-direct-fetch/index.html` einfach im eigenen Browser öffnen — die
drei Fälle zeigen den CORS-Block live.

## Ansatz B (Proxy) — nur zur Vollständigkeit

Ein schlanker Proxy (z. B. Cloudflare Worker) könnte den CSRF-Flow
serverseitig fahren und CSV mit CORS-Headern ausliefern — dann wäre der echte
Direktimport möglich. **Vom User ausgeschlossen** (kein Server/Proxy). Hier nur
dokumentiert, damit die Option bekannt ist, falls sich die Vorgabe ändert.

## Ansatz C (empfohlen): Suche + Deep-Link

Kein Datenabruf im Browser → **kein CORS-Problem**. Die App hilft nur, die
richtige Stelle zu finden, und verlinkt direkt dorthin.

**Schlüsselfund:** Die OH-Download-Seite **liest Query-Parameter und wählt die
Felder vor**. Getestet:

```
/gemeinde/fohnsdorf/download?haushalt=ehh&rechnungsabschluss=ra&year=2023
→ im HTML sind haushalt=ehh, rechnungsabschluss=ra UND year=2023 als
  <option ... selected> markiert.
```

Der Nutzer landet also auf der exakten Seite mit **allem vorausgewählt** und
muss nur „Download" klicken (einmal EHH, einmal FHH; die bestehende
EHH+FHH-Auto-Zusammenführung beim Drag&Drop greift danach unverändert).

**Was die App dafür braucht:**

- **Gemeinde-Index** (Name ↔ OH-`slug` ↔ GKZ) als kleiner statischer Datensatz
  für die Suche/Autocomplete. ~2.100 österreichische Gemeinden; einmalig
  generieren und als JSON ausliefern (eigene Daten, kein Vendoring einer
  Fremdbibliothek). Der OH-`slug` ist i. d. R. der kleingeschriebene
  Gemeindename (z. B. `fohnsdorf`, `bregenz`, `wien`) — muss aber verifiziert
  und als Mapping gepflegt werden, da Sonderfälle (Umlaute, gleichnamige
  Gemeinden) existieren.
- **Deep-Link-Bauer:** aus (slug, year, ra|va) zwei Links erzeugen
  (`haushalt=ehh` + `haushalt=fhh`), in neuem Tab öffnen.
- Hinweistext „Datei herunterladen und hier hineinziehen" — der Import-Pfad
  selbst bleibt der heutige.

**Grenzen von C (ehrlich):**

- Der Download-Klick + Drag&Drop bleibt manuell — der Zwischenschritt
  „runterladen" verschwindet **nicht ganz**, wird aber zielgenau geführt.
- **Verfügbarkeit** (welche Jahre/Typen eine Gemeinde freigeschaltet hat) kann
  die App nicht vorab prüfen (`data-availability` ist cross-origin blockiert) —
  sie bietet alle Jahre an; fehlt etwas, zeigt OH es auf der Zielseite.
- Slug-Pflege ist laufender Aufwand bei Gemeinde-Umbenennungen/-Fusionen.

## Empfehlung

Issue auf **Ansatz C** umstellen: „Gemeinde-Suche + geführter Deep-Link auf die
korrekte OH-Download-Seite (Felder vorausgewählt)". Das ist der maximale
Komfortgewinn, der ohne Server/Proxy und ohne CORS erreichbar ist. Ein echter
Auto-Import bleibt explizit Proxy-abhängig und damit außerhalb der aktuellen
Vorgabe.
