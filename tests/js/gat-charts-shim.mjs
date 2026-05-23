// Node-Loader-Shim fuer Tests.
//
// dashboard-charts.js und sankey-drill.js importieren ECharts-Helfer aus
// https://grueneat.github.io/design-system/gat-charts.js — im Browser wird
// das per CDN aufgeloest. Node unterstuetzt keinen HTTPS-Import; dieser
// Custom-Loader haengt die Test-Stub-Datei lokal an, ohne dass die
// Produktiv-Quelle (web/js/*) sich aendern muss oder das Modul ins Repo
// vendorisiert wird.
//
// Aufruf:
//   node --import ./tests/js/gat-charts-shim.mjs tests/js/run.mjs

import { register } from "node:module"
import { pathToFileURL } from "node:url"

const HOSTED = "https://grueneat.github.io/design-system/gat-charts.js"
const LOCAL = new URL("./gat-charts-stub.mjs", import.meta.url).href

register(
  "data:text/javascript," +
    encodeURIComponent(`
      const HOSTED = ${JSON.stringify(HOSTED)};
      const LOCAL  = ${JSON.stringify(LOCAL)};
      export async function resolve(specifier, context, nextResolve) {
        if (specifier === HOSTED) {
          return { url: LOCAL, shortCircuit: true, format: "module" };
        }
        return nextResolve(specifier, context);
      }
    `),
  pathToFileURL(import.meta.url),
)
