// Headless-POC: belegt im echten Chromium, ob ein statischer Browser-Client
// offenerhaushalt.at cross-origin abrufen kann. Serviert index.html auf einer
// localhost-Origin (stellvertretend fuer GitHub Pages) und liest die im DOM
// abgelegten Ergebnisse + Browser-Konsole aus.
//
// Aufruf (aus dem Haupt-Checkout, wo node_modules liegt):
//   node poc/oh-direct-fetch/run.mjs <absoluter-pfad-zu-index.html>

import http from "node:http"
import { readFileSync } from "node:fs"
import { chromium } from "playwright"

const htmlPath = process.argv[2]
if (!htmlPath) { console.error("Pfad zu index.html fehlt"); process.exit(2) }
const html = readFileSync(htmlPath, "utf8")

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
  res.end(html)
})
await new Promise((r) => server.listen(0, "127.0.0.1", r))
const port = server.address().port
const url = `http://127.0.0.1:${port}/`

const browser = await chromium.launch()
const page = await browser.newPage()
const consoleErrors = []
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()) })

await page.goto(url, { waitUntil: "load" })
await page.waitForFunction("window.__POC_RESULTS__ !== undefined", { timeout: 20000 })
const results = await page.evaluate("window.__POC_RESULTS__")

console.log("ORIGIN:", url)
console.log("RESULTS:", JSON.stringify(results, null, 2))
console.log("CONSOLE_ERRORS:")
for (const e of consoleErrors) console.log("  -", e)

await browser.close()
server.close()
