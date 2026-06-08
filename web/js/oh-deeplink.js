// OH-Deeplink: Gemeindesuche + Bau der Download-Links auf offenerhaushalt.at.
//
// Warum kein automatischer Import? offenerhaushalt.at sendet keine CORS-Header
// und schuetzt den CSV-Download per CSRF/Session — ein fremder Origin (unsere
// statische Seite) kann die Datei also nicht selbst laden (im echten Chromium
// belegt, siehe Issue h3ukx / RESEARCH-oh-feasibility.md). Statt eines Servers
// /Proxys fuehrt die App den Nutzer **zielgenau** zur richtigen OH-Seite: die
// OH-Download-Seite waehlt `haushalt`, `rechnungsabschluss` und `year` aus
// Query-Parametern vor. Der Nutzer klickt dort nur noch „Download" (EHH + FHH)
// und zieht die zwei CSVs in die Dropzone — die EHH+FHH-Zusammenfuehrung in
// pipeline.js macht daraus unveraendert ein Dokument.
//
// Der Gemeinde-Index (Name ↔ slug ↔ GKZ) liegt als statisches
// `web/gemeinden-index.json` und wird per `scripts/oh-gemeinde-index.mjs` aus
// OHs eigener Suchdatengrundlage erzeugt. OH-Slugs sind NICHT aus dem Namen
// ableitbar (z. B. „St. Pölten" → `sankt-pölten`), deshalb der explizite Index.

export const OH_BASIS = "https://www.offenerhaushalt.at"

// Fuer die Suche: Kleinschreibung + Diakritika entfernen, damit „woergl",
// „wörgl" und „Wörgl" gleich treffen.
export function normalisiere(text) {
  return String(text)
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

// Gemeinden im Index suchen. Rein numerische Eingabe → Treffer auf der
// Gemeindekennziffer (GKZ, Praefix); sonst Namenssuche (Praefix-Treffer vor
// Teil-Treffern, alphabetisch innerhalb der Gruppe).
export function sucheGemeinden(index, query, limit = 20) {
  const q = String(query || "").trim()
  if (!q) return []

  if (/^\d+$/.test(q)) {
    return index
      .filter((g) => g.gkz.startsWith(q))
      .slice(0, limit)
  }

  const nq = normalisiere(q)
  const praefix = []
  const enthalten = []
  for (const g of index) {
    const ng = normalisiere(g.name)
    if (ng.startsWith(nq)) praefix.push(g)
    else if (ng.includes(nq)) enthalten.push(g)
  }
  return [...praefix, ...enthalten].slice(0, limit)
}

const TYPEN = new Set(["va", "ra"])

// Eine einzelne OH-Download-URL bauen. `haushalt` ist „ehh" oder „fhh".
export function baueDownloadLink({ slug, jahr, typ, haushalt }) {
  if (!slug) throw new Error("slug fehlt")
  if (!TYPEN.has(typ)) throw new Error(`typ muss 'va' oder 'ra' sein, war '${typ}'`)
  if (!/^\d{4}$/.test(String(jahr))) throw new Error(`jahr ungueltig: '${jahr}'`)
  if (haushalt !== "ehh" && haushalt !== "fhh") {
    throw new Error(`haushalt muss 'ehh' oder 'fhh' sein, war '${haushalt}'`)
  }
  const params = new URLSearchParams({
    haushalt,
    rechnungsabschluss: typ,
    year: String(jahr),
  })
  return `${OH_BASIS}/gemeinde/${encodeURIComponent(slug)}/download?${params}`
}

// Das fuer den Import benoetigte EHH+FHH-Paar als zwei Deep-Links.
export function baueDownloadLinks({ slug, jahr, typ }) {
  return {
    ehh: baueDownloadLink({ slug, jahr, typ, haushalt: "ehh" }),
    fhh: baueDownloadLink({ slug, jahr, typ, haushalt: "fhh" }),
  }
}

// Gemeinde-Index laden (gleicher Origin wie die App → kein CORS-Problem).
export async function ladeGemeindeIndex(url = "./gemeinden-index.json") {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Gemeinde-Index HTTP ${res.status}`)
  return res.json()
}
