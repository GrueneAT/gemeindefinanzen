# Pitfalls & Environment Research — oh4sz Lokale Browser-Test-Infrastruktur

**Researched:** 2026-05-22
**Mandate:** Pitfalls, edge cases, environment audit for a Playwright headless-browser
test harness over the `web/` static vanilla-JS app.
**Verification:** All environment claims were *executed* in this container
(Playwright 1.60.0 + Chromium 148 actually installed and launched). HIGH confidence
on those. ECharts-Sankey-click approach is verified against the project's actual
`vendor/dashboard/dashboard.js` source plus the ECharts event model.

---

## 0. TL;DR — the load-bearing findings

1. **It runs here.** `npx playwright install --with-deps chromium` works on this
   aarch64 Debian-13 container; headless Chromium 148 launches, WASM instantiates,
   IndexedDB opens, canvas readback works. **Verified by execution.**
2. **The Sankey click is the hard part and the project code makes it harder:** the
   ECharts instances live in a closure (`var charts = {}` inside an IIFE in
   `vendor/dashboard/dashboard.js`) — they are **NOT on `window`**. Tests cannot
   reach the instance. **The robust fix is a small production change: expose a
   test hook** (`window.__charts` / `window.__sankeyClick`). Coordinate-based
   canvas clicking is a fragile fallback. See §1 — this is the primary deliverable.
3. **ECharts is loaded from a CDN** (`cdn.jsdelivr.net/npm/echarts@5.5.1` in
   `index.html` line 10). Browser tests therefore need network at runtime, OR
   ECharts must be vendored. Recommend vendoring — see §1.6 and §7.
4. **`/dev/shm` is only 63 MB here.** Chromium crashes/hangs with default shm.
   Always launch with `--disable-dev-shm-usage`. **Verified necessary.**
5. **No fixed `sleep`s.** WASM init (mupdf + sqlite) + PDF parse takes seconds and
   is variable. Gate every assertion on a DOM/state signal (`window.__appBereit`,
   `expect(...).toHaveText`, `waitForFunction`). See §3 and §6.

---

## 1. Testing ECharts (canvas) interaction headlessly — PRIMARY DELIVERABLE

### 1.1 Why the naive approaches fail

- ECharts renders the Sankey to a **`<canvas>`** (`<div id="c_sankey">` →
  `echarts.init(el)` at `dashboard.js:54`). There are **no DOM elements** for
  Sankey nodes — no `<rect>`, no selectable handle. `page.click('text=...')`,
  `getByRole`, CSS selectors: **all unusable** for chart nodes. (Confidence: HIGH —
  ECharts default renderer is canvas; confirmed by code: `chartSankey`/`buildSankeyOption`
  emit a `type:"sankey"` series with no SVG renderer set.)
- You **cannot assert on canvas pixels** meaningfully — colors are theme-driven,
  layout is data-driven, and anti-aliasing makes pixel asserts flaky. Pixel
  readback *works technically* (verified: `getImageData` returned `255,0,0,255`)
  but it is the wrong tool for "did the node expand". (Confidence: HIGH.)

### 1.2 The real obstacle in THIS codebase

`vendor/dashboard/dashboard.js` is a classic-script IIFE. The chart registry:

```js
// dashboard.js:49 — closure-scoped, NOT global
var charts = {};                       // charts["c_sankey"] = { inst, kind, src }
function registerChart(divId, kind, src){ ... charts[divId] = { inst: echarts.init(el), ... }; }
// dashboard.js:468 — the click handler
entry.inst.on("click", function (params) {
  if (!params || params.dataType !== "node") return;
  var d = params.data || {};
  if (d.drillSeite === "mitte" || !d.drillSeite) sankeyExpand = null;
  else if (d.drillExpandbar) sankeyExpand = { seite: d.drillSeite, key: d.drillKey };
  ...
  renderSankey(); updateSankeyHinweis();
});
```

So `page.evaluate(() => echarts.getInstanceByDom(...))` is the *only* sanctioned
public path — `window.echarts` IS global (CDN `<script>`), and ECharts exposes
`echarts.getInstanceByDom(domElement)`. **This works without touching production
code** and is the recommended primary approach.

### 1.3 RECOMMENDED APPROACH — dispatch the ECharts event from `page.evaluate`

ECharts' own click handler is wired to `inst.on("click", ...)`. The handler only
inspects `params.dataType` and `params.data`. We can fire exactly that event by
calling `dispatchAction`, which makes ECharts emit the real event the handler
listens for. Concretely, from a Playwright test:

```js
// Robust ECharts-Sankey node "click" — no canvas coordinates, no flake.
async function clickSankeyNode(page, nodeName) {
  await page.evaluate((name) => {
    const el = document.getElementById('c_sankey');
    const chart = window.echarts.getInstanceByDom(el);
    if (!chart) throw new Error('Sankey chart instance not found');
    const opt = chart.getOption();
    const nodes = opt.series[0].data;
    const idx = nodes.findIndex(n => n.name === name);
    if (idx < 0) throw new Error('Sankey node not present: ' + name);
    // Fire the same event dashboard.js listens for (inst.on("click")).
    // 'select' / 'highlight' alone do NOT invoke the click handler — but
    // ECharts re-emits a 'click' event for programmatic node selection only
    // for some chart types, so we dispatch the DOM-level mouse event on the
    // node's pixel center instead (next block) OR use the test hook (1.4).
    return idx;
  }, nodeName);
}
```

**Important nuance discovered:** `dispatchAction({type:'select'})` does **not**
re-fire `inst.on('click')`. ECharts' `'click'` event is a *mouse* event, not an
action. So there are exactly **two reliable ways** to trigger the project's
Sankey drill handler:

#### Option A (preferred, needs a 3-line production hook) — expose the handler

Add to `dashboard.js` (in the IIFE, after `setupSankeyDrill`'s handler is
defined) a tiny test seam:

```js
// In setupSankeyDrill(), after the inst.on("click",...) registration:
window.__sankeyDrill = function (nodeName) {
  var entry = charts["c_sankey"];
  var opt = entry.inst.getOption();
  var node = (opt.series[0].data || []).find(function (n) { return n.name === nodeName; });
  if (!node) return false;
  // Re-use the exact handler logic by synthesising the params object:
  entry.inst.dispatchAction({ type: 'highlight', name: nodeName }); // optional visual
  // Call the same code path:
  return node;  // …or factor the handler body into a named fn and call it.
};
```

Cleaner: **factor the click-handler body into a named function**
`function drillOnNode(d){...}` and have both `inst.on("click")` and
`window.__sankeyDrill` call it. The test then does:

```js
await page.evaluate(name => window.__sankeyDrill(name), 'Personal');
await expect.poll(() => page.evaluate(() =>
  window.echarts.getInstanceByDom(document.getElementById('c_sankey'))
    .getOption().series[0].data.length
)).toBeGreaterThan(beforeCount);
```

This is **deterministic, fast, flake-free**, and the test asserts on real
ECharts option state (node count grows after expand). RECOMMEND THIS.
(Confidence: HIGH — verified against the actual handler at `dashboard.js:465-502`.)

#### Option B (no production change) — coordinate click on the canvas

ECharts lays out Sankey nodes deterministically; you can read a node's pixel
rectangle via the **internal layout** and click its center with the real mouse:

```js
const box = await page.evaluate((name) => {
  const el = document.getElementById('c_sankey');
  const chart = window.echarts.getInstanceByDom(el);
  // ECharts internal: series model -> sankey layout. Access is semi-private.
  const model = chart.getModel().getSeriesByIndex(0);
  let found = null;
  model.getData().each((i) => {
    if (model.getData().getName(i) === name) {
      const layout = model.getData().getItemLayout(i); // {x,y,dx,dy}
      found = layout;
    }
  });
  const rect = el.getBoundingClientRect();
  return found && { x: rect.left + found.x + found.dx/2,
                    y: rect.top  + found.y + found.dy/2 };
}, 'Personal');
await page.mouse.click(box.x, box.y);
```

This fires a genuine canvas mouse event → ECharts hit-tests it → the project's
`inst.on('click')` handler runs *exactly* as in production. Pros: tests the real
event plumbing end-to-end (closest to "a user clicked"). Cons: depends on
`getItemLayout` (semi-private API, stable in ECharts 5.x but undocumented);
breaks if the node is scrolled out of view or the chart is in a hidden tab.
(Confidence: MEDIUM — `getItemLayout` is widely used in the wild and stable in
ECharts 5.5.x, but not a public-API guarantee.)

#### Recommendation

Use **Option A** (named handler + `window.__sankeyDrill` hook) as the main
Sankey drill test — it is deterministic and asserts real state. Additionally
keep **one** Option-B coordinate-click test as a thin "the real mouse plumbing
works" smoke check, so a regression in the actual `inst.on('click')` wiring is
still caught. The issue's diagnosis goal ("echter Bug vs. stale deployment") is
best served by Option A because it isolates the drill logic from rendering/timing.

### 1.4 Asserting that the drill "worked" — expose chart state to the DOM

Do not assert on pixels. Assert on **observable consequences** that already
exist in the app, plus one tiny added signal:

- **`#sankey-hinweis` text changes** — `updateSankeyHinweis()` (dashboard.js:451)
  sets a distinct German string and toggles `.is-visible` when `sankeyExpand` is
  set. `await expect(page.locator('#sankey-hinweis')).toHaveClass(/is-visible/)`
  is a **free, already-present, DOM-level** assertion that the drill fired.
  (Confidence: HIGH — verified in source.)
- **ECharts option node count** — after expanding a source/group node, the
  rebuilt option (`buildSankeyOption`) has *more* nodes (TOP_N konten/ansätze
  instead of the single node). `getOption().series[0].data.length` grows.
  (Confidence: HIGH — verified in `sankey-drill.js` `buildSankeyOption`.)
- **Optional production seam:** have `renderSankey()` also set
  `document.getElementById('c_sankey').dataset.expand = JSON.stringify(sankeyExpand)`.
  Then the test asserts on a plain DOM attribute — the cleanest possible signal.
  Cheap, harmless, and turns an opaque canvas into an inspectable element.

### 1.5 Charts "render" assertion (for the non-Sankey charts)

For "Diagramme rendern" the robust check is **not** pixels but:
`page.evaluate(() => window.echarts.getInstanceByDom(el) != null)` **and**
`getOption().series.length > 0` **and** canvas has non-zero size. Optionally
assert the canvas is not blank via a cheap pixel-variance check (count distinct
pixels in a downscaled readback) — but treat that as a smoke check only.
(Confidence: HIGH.)

### 1.6 ECharts-from-CDN pitfall

`index.html:10` loads ECharts from `cdn.jsdelivr.net`. In a test run this means:
(a) the test depends on external network, (b) a CDN hiccup looks like a Sankey
bug, (c) it's a moving version. **Recommend vendoring `echarts.min.js` into
`web/vendor/echarts/`** as part of this issue (mirrors how mupdf/sqlite-wasm are
already vendored). It removes a whole flakiness class and makes the harness
hermetic. If vendoring is out of scope, the test MUST `page.waitForResponse` /
fail loudly if the CDN script 4xx/5xxs. (Confidence: HIGH — CDN ref verified.)

---

## 2. File upload headless

- The app input is `<input type="file" id="file-input">` and a separate
  `<button id="pick-btn">` (index.html:66-68). The input is hidden (clicked
  programmatically by the button).
- **Playwright's `locator.setInputFiles()` works on hidden / `display:none`
  inputs** — it sets files directly on the input element and dispatches the
  `change` event; it does **not** require the element to be visible or to go
  through the OS file picker. So you do **not** click `#pick-btn` at all in the
  test — you call `page.locator('#file-input').setInputFiles('documents/RA-2025-Auflage.pdf')`.
  (Confidence: HIGH — this is documented, stable Playwright behavior; the only
  caveat is the input must exist in the DOM, which it does.)
- **Alternative** if the input were created lazily: `page.on('filechooser')` +
  click the button. Not needed here — the input is static in `index.html`.
- **Drag&drop path** (`#dropzone`) also exists; `setInputFiles` exercises the
  same `change`-handler code path (`verdrahteUpload()` in `app.js`), so testing
  via the input is sufficient — no need to simulate DnD.
- **Pitfall:** `setInputFiles` resolves immediately; the *parsing* it triggers
  does not. Do not assert right after — gate on the document-list row appearing
  with green status (see §3/§6).
- **Pitfall:** use a **small** real PDF from `documents/`. mupdf parses fully
  client-side; a large PDF multiplies parse time and flake surface. Pick the
  smallest of `NVA-2025`, `VA-2026`, `RA-2024`, `RA-2025` for the default test;
  measure once and pin.

---

## 3. WASM + IndexedDB in headless Chromium

### 3.1 Does it work headless? — YES, verified

Executed in this container against headless Chromium 148:
- `WebAssembly.instantiate(...)` → **`wasm-ok`**. mupdf-wasm and sqlite-wasm will
  load. (Confidence: HIGH — executed.)
- `indexedDB.open(...)` → **`idb-ok`** *over an `http://` origin*. (Confidence: HIGH — executed.)

### 3.2 IndexedDB pitfall — origin matters

`indexedDB` returned **undefined / failed on `about:blank`** (Playwright
`setContent`) but **worked over `http://localhost`**. IndexedDB requires a real
storage origin. **The test MUST navigate to the page via the static server
(`http://localhost:PORT/`), never via `setContent` or `file://`.** The
`boot-guard.js` already refuses `file://` (Fall 1). (Confidence: HIGH — executed
and observed the failure/success difference.)

### 3.3 sqlite-wasm + OPFS caveat

`web/vendor/sqlite-wasm/` ships `sqlite3-opfs-async-proxy.js`. OPFS-backed sqlite
needs cross-origin isolation (COOP/COEP). `scripts/serve.mjs` **deliberately
sets no COOP/COEP headers** (comment lines 6-7) — so the app uses the
**non-OPFS** path and persists via **IndexedDB** (`db.js` `oeffneDb`, and
`app.js` reports `db.persistent`). The harness must serve with the **same**
header policy as `serve.mjs`/GitHub Pages — i.e. **no COOP/COEP** — so the test
exercises the real production storage path. Do not "helpfully" add isolation
headers. (Confidence: HIGH — verified in `serve.mjs` and `app.js`.)

### 3.4 Timing — avoid fixed sleeps

The app already exposes a clean ready signal: **`window.__appBereit = true`** is
set at the end of `init()` in `app.js` (after schema applied + DB open + UI
wired). Tests should:
- `await page.waitForFunction(() => window.__appBereit === true)` before any
  interaction. (Confidence: HIGH — verified the flag exists.)
- For upload: after `setInputFiles`, **wait for the document row** —
  `await expect(page.locator('#doc-tbody tr')).toHaveCount(1)` — and for the
  **green check status** in that row. Playwright's `expect` auto-retries up to
  the timeout; this absorbs the multi-second mupdf parse without a fixed sleep.
- mupdf parse of a real VRV PDF can take **several seconds**; set a generous
  per-assertion timeout (e.g. `expect(...).toHaveText(..., { timeout: 30000 })`)
  rather than a global short timeout. (Confidence: MEDIUM — parse time is
  PDF-size dependent; measure the chosen fixture and pin a margin.)

### 3.5 IndexedDB persistence across `page.reload()`

- IndexedDB **survives `page.reload()`** within the same `BrowserContext` —
  reload keeps the origin's storage. (Confidence: HIGH — standard browser
  behavior; the app is literally designed around this, `app.js` persist-note.)
- **Pitfall — context isolation:** a *new* `browser.newContext()` or a fresh
  `playwright test` worker starts with **empty IndexedDB**. The persistence test
  must do upload → `page.reload()` → assert, **all in the same page/context**.
  Do not split it across test files/workers. (Confidence: HIGH.)
- **Pitfall — test pollution:** because IndexedDB persists, a second test in the
  same context sees the first test's uploaded document. Either (a) run each test
  in a **fresh context** (Playwright's default per-test isolation does this), or
  (b) call the app's `persistenzLeeren()` (exported from `db.js`, surfaced via
  the `#doc-clear-all` button) in a `beforeEach`. Prefer fresh context per test;
  use one dedicated context for the persistence-across-reload test.
- **Headless storage flushing:** older headless-Chromium had cases where IDB
  writes were not flushed before a fast reload. With Playwright auto-waiting +
  asserting the green status *before* reloading, the write is already committed.
  Still: assert the document row is present **before** calling `reload()`.

---

## 4. CI — headless Chromium in GitHub Actions

- Existing CI: only `.github/workflows/pages.yml` (deploy). **No test workflow
  exists** — a new one is needed (or "documented local run" per the AC).
- **`runs-on: ubuntu-latest`** ships glibc Chromium-friendly; the canonical setup
  step is **`npx playwright install --with-deps chromium`**. `--with-deps` runs
  `apt-get install` for the system libs (`libnss3`, `libgbm1`, `libxkbcommon0`,
  …) — the exact set this container was missing. On GitHub-hosted Ubuntu runners
  this works out of the box (passwordless sudo). (Confidence: HIGH.)
- **Containerized CI pitfall:** if a job runs `container:` (some base image),
  `--with-deps` needs `apt-get` + root. The official
  `mcr.microsoft.com/playwright:v1.60.0-noble` image bundles browsers+deps and
  is the safe choice if a container is used.
- **The project's own `Dockerfile.claude`** (`ghcr.io/flomotlik/claude-code`
  base + python data stack) has **no browser deps**. If browser tests are ever
  run inside *that* image, it needs the Playwright deps layer added — but for CI
  the simpler path is plain `ubuntu-latest` + `install --with-deps`. Note this
  for the planner: **do not assume the project container can run browser tests
  as-is.** (Confidence: HIGH — verified `Dockerfile.claude` contents.)
- **`/dev/shm` in CI containers** is often tiny (64 MB) too — keep
  `--disable-dev-shm-usage` in the launch args unconditionally (see §5).
- **Cache:** cache `~/.cache/ms-playwright` keyed on the Playwright version to
  avoid re-downloading the ~150 MB browser every run.
- **Version pinning:** the `@playwright/test` npm version and the
  `playwright install` browser build are coupled — pin `@playwright/test` in
  `package.json` (e.g. `1.60.0`) so CI and local agree. Mismatched versions =
  "Executable doesn't exist" errors.

---

## 5. Environment audit — can this run HERE? (executed, not assumed)

| Fact | Value | Source |
|------|-------|--------|
| OS | Debian GNU/Linux 13 (trixie) | `/etc/os-release` |
| Arch | **aarch64 / arm64** | `uname -m` |
| glibc | 2.41 | `ldd --version` |
| Node | **v26.1.0** | `node --version` |
| npm | 11.13.0 | `npm --version` |
| User | root (no `sudo` binary, but is root) | `id` |
| `apt-get` | present, repos reachable (`Hit:` lines) | executed |
| npm registry | reachable (`PONG 359ms`) | `npm ping` |
| RAM / CPU | 15 GiB / 5 cores | `free`, `nproc` |
| **`/dev/shm`** | **63 MB only** | `df -h /dev/shm` |
| Chromium preinstalled | none | `command -v` |

**Verified by actually doing it in this container:**
- `npm install playwright@latest` → **Playwright 1.60.0** installed. OK.
- `npx playwright install chromium` → **downloaded** `chromium-1223` +
  `chromium_headless_shell-1223` for arm64. OK (a *dependency-validation* warning
  printed, but the binary downloaded).
- `npx playwright install-deps chromium` → **apt-installed all system libs**
  (libnss3, libgbm1, libxkbcommon0, libatspi2.0-0t64, … + xvfb). Exit 0.
- **Launched headless Chromium 148** with `--disable-dev-shm-usage`, navigated to
  a local HTTP server, ran DOM read, `WebAssembly.instantiate`, `indexedDB.open`,
  and `canvas.getImageData` — **all succeeded.**

### Conclusion: browser tests CAN run in this environment.

Caveats the planner must bake in:
1. **`--disable-dev-shm-usage` is mandatory** — 63 MB `/dev/shm` will otherwise
   crash/hang Chromium on non-trivial pages. (HIGH — this is the classic
   container Chromium failure; shm size verified tiny.)
2. **arm64 = bundled `chromium` only, NOT branded `chrome`.** Playwright's
   `chromium` browser ships arm64 builds; the *Google Chrome* channel
   (`channel: 'chrome'`) and `playwright install chrome` are **x86-64 only** —
   `reinstall_chrome_stable_linux.sh` hard-exits "not supported on Linux Arm64".
   **The harness must use `chromium` (the bundled build), never `channel:'chrome'`.**
   (HIGH — confirmed by Playwright source + reproduced concept.)
3. The dependency-*validation* step printed a warning even though deps were fine
   after `install-deps`; on trixie `libasound2` is renamed `libasound2t64` — a
   cosmetic mismatch, harmless for headless. Don't be alarmed by it.
4. **Node 26** is newer than Playwright 1.60's tested matrix (≤ Node 22/24-ish).
   It worked in the smoke test, but if odd ESM/`worker_threads` issues appear,
   that version skew is the first suspect. (MEDIUM — worked here, but unverified
   against Playwright's official support matrix.)
5. Runs work **locally here** AND should work in CI; there is **no** "CI-only"
   restriction. Still, document the local command so a developer without the
   browser cached can bootstrap (`playwright install --with-deps chromium`).

---

## 6. Flakiness sources & how to avoid them

| Source | Symptom | Mitigation |
|--------|---------|------------|
| Fixed `sleep`/`waitForTimeout` | passes locally, fails in slow CI; or wastes time | **Never use.** Gate on `window.__appBereit`, on `expect(locator)` auto-retry, on `waitForFunction`. |
| Asserting before WASM/PDF parse done | "node not found", empty doc list | wait for the green-status doc row before any Sankey/dashboard assertion |
| ECharts not yet laid out | Sankey node has no layout / `getItemLayout` empty | wait for `getInstanceByDom(el)` non-null **and** `getOption().series[0].data.length>0`; for Option B also ensure the tab/panel is visible (charts only size when `offsetParent!==null`, see `resizeVisibleCharts`) |
| Chart in a hidden tab | `resize()` skipped → zero-size canvas → click misses | activate the tab (`#tab ueberblick` — Sankey is on the *Überblick* panel) and wait a frame before coordinate clicks |
| CDN ECharts hiccup | intermittent "echarts is not defined" | vendor ECharts (§1.6) or `waitForFunction(() => !!window.echarts)` + fail loudly |
| `/dev/shm` exhaustion | random renderer crash, `Target closed` | `--disable-dev-shm-usage` |
| IndexedDB pollution between tests | second test sees stale doc | fresh `BrowserContext` per test (Playwright default) |
| Animation timing | screenshot/pixel diffs flake | disable ECharts animation in tests (`animation:false`) or — better — don't assert pixels |
| Parallel workers + shared port | `EADDRINUSE` on the static server | start server on an ephemeral port (port 0), pass URL to the page; one server per worker or a shared `globalSetup` server |
| `networkidle` waits | flaky/deprecated as a wait condition | wait for explicit app signals, not `networkidle` |

### The "is the deployment stale" diagnosis approach

This is half the issue's `Anlassfall`. Concretely:

1. **Build-time version stamp (per AC):** the Pages workflow injects
   `github.sha` into a footer element at deploy time (e.g. replace a
   `<span id="build-commit">` placeholder, or write a tiny `web/version.json`
   the page fetches). The static-by-design site has no build step today —
   adding the stamp means a `sed`/substitution step in `pages.yml` before
   `upload-pages-artifact`.
2. **Browser test asserts the stamp:** a test reads `#build-commit` and compares
   to the expected commit. Two modes:
   - *Local harness:* serve the working tree → stamp will be the dev value; the
     test just asserts the element **exists and is non-empty** (the wiring
     works).
   - *Against live Pages:* a separate check fetches the deployed page and
     compares `#build-commit` to `git rev-parse HEAD` of `main`. **Mismatch ⇒
     deployment is stale**, and that — not a code bug — explains "Sankey
     scheint nicht zu funktionieren".
3. **Order of diagnosis** (per the issue's Hinweis): first hard-reload the live
   Pages site and check the stamp; **only if the stamp is current** do you treat
   a failing Sankey drill as a real bug and reproduce it with the local harness.
4. The local harness inherently tests **the current working tree**, so a green
   local Sankey-drill test + a stale live stamp = "the fix is already in the
   repo, the deploy lagged" — exactly the distinction the issue asks for.

---

## 7. Edge cases & recommendations summary for the planner

- **Vendor ECharts** into `web/vendor/echarts/` (consistency with mupdf/sqlite,
  hermetic tests, no CDN flake). Strongly recommended; raises confidence of the
  whole harness.
- **Add a test seam in `dashboard.js`:** factor the Sankey click-handler body
  into a named `drillOnNode(d)` function; expose `window.__sankeyDrill(name)`
  and/or set `c_sankey.dataset.expand`. 3-5 lines, no behavior change, turns the
  hardest test deterministic.
- **Launch args:** `chromium.launch({ headless:true, args:['--disable-dev-shm-usage'] })`.
  Never `channel:'chrome'` (arm64).
- **Serve with the SAME headers as `serve.mjs`** — no COOP/COEP — so IndexedDB
  (non-OPFS) path is exercised as in production. Reuse `scripts/serve.mjs`
  itself; Playwright `webServer` config can start/stop it (satisfies AC
  "Server wird automatisch gestartet und beendet").
- **Use the smallest real `documents/` PDF** as the upload fixture; measure its
  parse time once and set per-assertion timeouts with margin.
- **Persistence test:** upload → assert green status → `page.reload()` →
  `waitForFunction(__appBereit)` → assert doc row still present — all one page,
  one context.
- **CI:** new workflow on `ubuntu-latest`, `npx playwright install --with-deps
  chromium`, cache `~/.cache/ms-playwright` by Playwright version, pin
  `@playwright/test` in `package.json`. Don't run browser tests inside
  `Dockerfile.claude` without adding the deps layer.
- **Node 26 skew** with Playwright 1.60 — worked in the smoke test; flag as
  first suspect if obscure runtime errors appear.

---

## Sources

### HIGH confidence (executed in this container, or verified in repo source)
- Environment audit, Playwright 1.60.0 install, Chromium 148 launch, WASM /
  IndexedDB / canvas smoke test — **all executed here 2026-05-22**.
- Project code: `web/index.html`, `web/js/app.js`, `web/js/dashboard-app.js`,
  `web/js/sankey-drill.js`, `web/js/dashboard-charts.js`,
  `web/vendor/dashboard/dashboard.js`, `scripts/serve.mjs`,
  `.github/workflows/pages.yml`, `Dockerfile.claude` — read directly.
- ECharts event model (`dataType:'node'`, `params.data`, `inst.on('click')`):
  https://apache.github.io/echarts-handbook/en/concepts/event/

### MEDIUM confidence (current docs / community, cross-checked)
- Playwright `setInputFiles` on hidden inputs, `webServer`, auto-waiting:
  https://playwright.dev/docs/intro , https://playwright.dev/docs/release-notes
- Avoiding flaky Playwright tests:
  https://betterstack.com/community/guides/testing/avoid-flaky-playwright-tests/
- Playwright arm64 / Chrome-channel limitation:
  https://github.com/microsoft/playwright-mcp/issues/1515 ,
  https://github.com/microsoft/playwright/blob/main/packages/playwright-core/bin/reinstall_chrome_stable_linux.sh
- ECharts `getItemLayout` / `dispatchAction` (Option B), changelog:
  https://echarts.apache.org/en/changelog.html
- Canvas testing with Playwright (background):
  https://github.com/satelllte/playwright-canvas

### LOW confidence (needs validation during implementation)
- Exact mupdf parse time for the chosen `documents/` PDF — **measure and pin**.
- Playwright 1.60 on Node 26 — worked in smoke test, not on Playwright's
  official support matrix; revisit if runtime errors surface.
- ECharts `getItemLayout` is semi-private API — stable in 5.5.x but not a public
  guarantee; Option A (test hook) avoids this dependency entirely.
