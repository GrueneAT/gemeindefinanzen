// Einfacher statischer Server fuer die lokale Vorschau der Browser-App.
//
// Lauf:  node scripts/serve.mjs [port]
// Dann:  http://localhost:8080/web/
//
// Setzt KEINE COOP/COEP-Header — die App speichert ueber IndexedDB, das
// ohne Cross-Origin-Isolation auskommt (genau wie GitHub Pages).

import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { extname, join, normalize } from "node:path"

const PORT = Number(process.argv[2]) || 8080
const WURZEL = process.cwd()

const TYPEN = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".sql": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
}

const server = createServer(async (req, res) => {
  try {
    let pfad = decodeURIComponent(new URL(req.url, "http://x").pathname)
    if (pfad.endsWith("/")) pfad += "index.html"
    const datei = join(WURZEL, normalize(pfad))
    if (!datei.startsWith(WURZEL)) {
      res.writeHead(403).end("verboten")
      return
    }
    const inhalt = await readFile(datei)
    res.writeHead(200, {
      "Content-Type": TYPEN[extname(datei)] || "application/octet-stream",
    })
    res.end(inhalt)
  } catch {
    res.writeHead(404).end("nicht gefunden")
  }
})

server.listen(PORT, () => {
  console.log(`Statischer Server: http://localhost:${PORT}/web/`)
})
