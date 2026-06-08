// Erzeugt den statischen Gemeinde-Index fuer die OH-Suche in der Browser-App.
//
// offenerhaushalt.at bettet auf der Startseite ein Objekt `__ives.gemeinden`
// ein — die Datengrundlage seiner eigenen Gemeindesuche. Jeder Eintrag traegt
// `name`, `slug` (der OH-URL-Slug, NICHT aus dem Namen ableitbar), `id`
// (Gemeindekennziffer/GKZ), `type` und `published_at`. Dieses Skript holt die
// Startseite einmalig, extrahiert die Gemeinden (type === "GEM") und schreibt
// `web/gemeinden-index.json`.
//
// Das ist kein Vendoring einer Fremdbibliothek, sondern ein einmal abgeleiteter
// Datensatz (Name ↔ slug ↔ GKZ), den die statische App fuer Deep-Links auf die
// korrekte OH-Download-Seite braucht. Bei Gemeinde-Umbenennungen/-Fusionen neu
// laufen lassen:
//
//   node scripts/oh-gemeinde-index.mjs
//
// Hintergrund und CORS-/Format-Belege: siehe das Issue h3ukx
// (.issues/.../RESEARCH-oh-feasibility.md).

import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const QUELLE = "https://www.offenerhaushalt.at/"
const ZIEL = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "web",
  "gemeinden-index.json",
)

// Das eingebettete Objektliteral nach `__ives.gemeinden =` per Klammer-Matching
// herausschneiden (kein vollstaendiger JS-Parser noetig — es ist gueltiges JSON).
function extrahiereGemeindenObjekt(html) {
  const marke = "__ives.gemeinden"
  const i = html.indexOf(marke)
  if (i < 0) throw new Error("__ives.gemeinden nicht in der OH-Startseite gefunden")
  const start = html.indexOf("{", i)
  let tiefe = 0
  for (let j = start; j < html.length; j++) {
    const c = html[j]
    if (c === "{") tiefe++
    else if (c === "}") {
      tiefe--
      if (tiefe === 0) return JSON.parse(html.slice(start, j + 1))
    }
  }
  throw new Error("Objektliteral __ives.gemeinden nicht sauber geschlossen")
}

async function main() {
  const res = await fetch(QUELLE, { headers: { "user-agent": "gemeindefinanzen-index-builder" } })
  if (!res.ok) throw new Error(`OH-Startseite HTTP ${res.status}`)
  const html = await res.text()
  const alle = extrahiereGemeindenObjekt(html)

  const gemeinden = Object.values(alle)
    .filter((g) => g.type === "GEM")
    .map((g) => ({
      name: g.name,
      slug: g.slug,
      gkz: String(g.id),
      // published_at != null ⇒ OH hat fuer diese Gemeinde Daten freigeschaltet.
      published: g.published_at != null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"))

  if (gemeinden.length < 2000) {
    throw new Error(`Nur ${gemeinden.length} Gemeinden extrahiert — Format geaendert?`)
  }

  writeFileSync(ZIEL, JSON.stringify(gemeinden), "utf-8")
  const veroeffentlicht = gemeinden.filter((g) => g.published).length
  console.log(
    `${gemeinden.length} Gemeinden geschrieben (${veroeffentlicht} mit Daten) → ${ZIEL}`,
  )
}

main().catch((e) => {
  console.error("Fehler:", e.message)
  process.exit(1)
})
