# Ecosystem Research: Lokale Browser-Test-Infrastruktur (oh4sz)

**Researched:** 2026-05-22
**Mandate:** ECOSYSTEM / standard stack
**Overall confidence:** HIGH

## Summary

For a small static vanilla-JS web app (`web/`, no build step, ESM modules,
WASM via mupdf.js + sqlite-wasm, IndexedDB, ECharts canvas charts),
**Playwright Test (`@playwright/test`) is the correct, near-unanimous
recommendation** for headless browser e2e testing. It is the only mainstream
tool that bundles a test runner, a browser, an auto-start/stop static-server
mechanism (`webServer`), file-upload support (`setInputFiles`), and
auto-retrying web-first assertions in one dependency — and it is the official
recommendation for GitHub Actions CI. No alternative (Puppeteer, Cypress,
WebdriverIO) wins on any axis that matters here.

**Primary recommendation:** Add `@playwright/test@^1.60.0` as a devDependency,
install only Chromium (`npx playwright install --with-deps chromium`),
configure `webServer` to run the existing `scripts/serve.mjs`, write ~6 e2e
specs using locators + web-first assertions, and gate readiness on the app's
existing `window.__appBereit` flag (set by `app.js`) rather than sleeps.

## Standard Stack

| Library | Version | Purpose | Why Standard | Confidence |
|---------|---------|---------|--------------|------------|
| `@playwright/test` | `1.60.0` (latest, verified `npm view`) | Headless browser e2e test runner + assertions + webServer | Industry default for cross-browser e2e; single dependency covers runner, browser, server orchestration, file upload | HIGH (npm registry) |
| Chromium (Playwright-managed) | bundled with 1.60.0 | The one browser to drive | Issue explicitly scopes "headless Chromium"; app deploys to GitHub Pages (Chrome-class) | HIGH |
| `node:http` static server | existing `scripts/serve.mjs` | Serve `web/` over HTTP for tests | Already in repo; reused via Playwright `webServer.command` — no new dep | HIGH (codebase) |

### Verified version detail

`npm view @playwright/test` on 2026-05-22 returns:
- `latest`: **1.60.0**
- `next`: `1.61.0-alpha-2026-05-22` (do NOT use — pre-release)

Playwright 1.60.0 was released ~2026-05-11/18. Notable in this line:
- Playwright now runs on **Chrome for Testing** builds instead of plain
  Chromium (headed → `chrome`, headless → `chrome-headless-shell`). **On
  Arm64 Linux it still uses Chromium** — relevant because this dev container
  is `aarch64`. Behaviour is equivalent; just note the binary differs by arch.
- `testConfig.webServer` gained a `wait` field: pass a regex and Playwright
  waits until the server's stdout/stderr matches it. Useful as an alternative
  to `url` polling, but `url` polling is simpler here and recommended.
- New `locator.drop()` simulates external file drag-and-drop onto an element.

**Pin guidance:** use a caret range `^1.60.0` in `package.json`. The browser
binary version is tied to the npm package version, so CI must run
`npx playwright install` against the *installed* package version (never a
hardcoded older browser).

### Exact install commands

```bash
# devDependency (project root — package.json already has "type":"module")
npm install -D @playwright/test@^1.60.0

# Browser binary — install ONLY Chromium, not Firefox/WebKit
npx playwright install chromium
# In CI (Linux), also pull OS-level libs:
npx playwright install --with-deps chromium

# Run the tests (after playwright.config + specs exist)
npx playwright test
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Driving a real browser | A custom CDP/WebDriver wrapper | Playwright's `page` API | Playwright owns the browser protocol; hand-rolling is the classic time sink |
| Starting/stopping the static server around tests | A bash `&` + `kill` / `trap` dance, or a custom Node spawn helper | Playwright `webServer` config block | `webServer` auto-starts, waits for the `url` to return 2xx-403, and tears down on exit — including on failure |
| Waiting for async readiness (WASM init, sqlite-wasm, mupdf load) | `await page.waitForTimeout(3000)` / `sleep` | Web-first assertions: `await expect(locator).toBeVisible()`, or `page.waitForFunction(() => window.__appBereit)` | Sleeps are the #1 source of flaky e2e; the app already exposes `window.__appBereit` — gate on it |
| File upload simulation | Synthesising drag-drop `DataTransfer` events by hand | `locator.setInputFiles(path)` on `#file-input` | First-class API; sets real `File` objects on the `<input type=file>` |
| Element selection | Brittle XPath / nth-child chains | `getByRole` / `getByText` / `getByTestId`, or `locator('[data-tab="..."]')` | Auto-waiting, auto-retrying locators; the app already has stable `id`s and `data-tab`/`data-panel` attributes |
| Asserting the build stamp | Parsing HTML with regex in a Node script | `expect(page.locator('#build-stamp')).toContainText(sha)` | Test runs in the real DOM where the stamp is rendered |
| Test reporting / parallelism / retries | A custom harness | `@playwright/test` runner (`playwright.config.ts`) | The runner ships HTML reporter, retries, parallelism, trace-on-failure |

## Tool Choice: Playwright vs. Alternatives

**Recommendation: Playwright Test. Clear winner for this issue.**

| Tool | Test runner included | Bundled browser | Auto-start server | File upload | WASM/canvas friendly | Verdict for this app |
|------|---------------------|-----------------|-------------------|-------------|----------------------|----------------------|
| **Playwright Test** | Yes (`@playwright/test`) | Yes (Chromium/Chrome-for-Testing, FF, WebKit) | Yes (`webServer`) | Yes (`setInputFiles`) | Good — runs real Chromium, canvas works, `waitForFunction` for WASM | **Recommended** |
| Puppeteer | No (bring your own — Jest/Mocha) | Yes (Chromium only) | No (DIY) | Yes | Good | More wiring, no runner, no server orchestration — strictly more work than Playwright |
| Cypress | Yes | Chrome/Electron via system | Partial (`start-server-and-test` add-on) | Yes (plugin-ish) | Weak around WASM/cross-origin; heavier; opinionated runtime inside the page | Overkill + friction for a tiny static app; in-browser execution model fights WASM workers |
| WebdriverIO | Yes | No (manages drivers) | No (DIY/plugins) | Yes | OK | Selenium-heritage config sprawl; nothing gained over Playwright here |

**Reasoning for a small static vanilla-JS app:**
- Single devDependency gives runner + browser + server orchestration. Puppeteer
  and WebdriverIO need a separate runner and a separate server-lifecycle
  solution — more moving parts for a project that values "extremely solid yet
  simple".
- The issue explicitly scopes headless Chromium and one-command local runs;
  `webServer` + `npx playwright test` is exactly that.
- Playwright is Microsoft's officially documented choice for GitHub Actions CI,
  with a documented caching/`--with-deps` story.
- Cypress's in-page execution model and historical weakness with WASM
  workers / cross-origin make it a poor fit for an app whose core is
  mupdf-wasm + sqlite-wasm.
- "Working over theoretically better": Playwright is the lowest-friction path
  that fully satisfies every acceptance criterion.

## Architecture Patterns

### Recommended approach

1. **`playwright.config.ts`** (or `.mjs` — repo is already `"type":"module"`,
   TS optional) at repo root:
   - `testDir: 'tests/e2e'` (keep separate from existing `tests/js/run.mjs`).
   - `use: { baseURL: 'http://localhost:8080' }` so specs use relative paths.
   - `projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }]` — one
     project, Chromium only.
   - `webServer` block:
     ```js
     webServer: {
       command: 'node scripts/serve.mjs 8080',
       url: 'http://localhost:8080/web/',
       reuseExistingServer: !process.env.CI,
       timeout: 30_000,
     }
     ```
     `serve.mjs` serves from `process.cwd()`, so the test must hit
     `/web/index.html`. `reuseExistingServer: !CI` reuses a dev server locally,
     always starts fresh in CI.
   - `reporter: process.env.CI ? 'github' : 'list'` (+ optionally `'html'`).
   - `retries: process.env.CI ? 1 : 0`, `trace: 'on-first-retry'`.

2. **Test structure** — a handful of specs, grouped by user journey, not one
   giant file:
   - `tests/e2e/smoke.spec.ts` — page loads, no boot-error banner
     (`expect(page.locator('#boot-banner')).toHaveCount(0)`).
   - `tests/e2e/upload.spec.ts` — `setInputFiles` a real PDF from
     `documents/`, assert the doc list row appears with a green check status.
   - `tests/e2e/dashboard.spec.ts` — dashboard appears
     (`#dashboard-inhalt` not `hidden`), tab switching via
     `locator('[data-tab="einnahmen"]')` → `[data-panel="einnahmen"]` visible,
     charts render.
   - `tests/e2e/sankey.spec.ts` — Sankey drill-down (the trigger case).
   - `tests/e2e/persistence.spec.ts` — `page.reload()`, data still present.
   - `tests/e2e/build-stamp.spec.ts` — footer shows the expected commit.
   - A shared `tests/e2e/fixtures.ts` / helper for the common "upload a PDF and
     wait for `__appBereit`" preamble (Playwright fixtures keep this DRY).
   - Add an npm script `"test:e2e": "playwright test"` and a Makefile target
     `web-e2e` mirroring the existing `web-test` style.

3. **Waiting for async app readiness without flaky sleeps:**
   - The app sets `window.__appBereit = true` in `app.js` once wired up — gate
     the initial load on `await page.waitForFunction(() => window.__appBereit)`.
   - For everything after an action, use **web-first assertions**:
     `await expect(locator).toBeVisible()` / `.toHaveText()` /
     `.toContainText()` auto-retry until the condition holds or times out. No
     manual polling.
   - For PDF processing completion (mupdf-wasm parse): assert on a *visible
     result* — e.g. the doc-table row with green status — not on a timer.
   - Never use `page.waitForTimeout`.

### Testing the ECharts Sankey canvas (the trigger case)

ECharts renders the Sankey to a `<canvas>`, so there are no DOM nodes per
Sankey node — a plain `locator.click()` on a node is impossible. Two robust
options, in order of preference:

1. **Programmatic dispatch via the chart instance (most reliable).** Have the
   app expose the ECharts instance on `window` in a test/debug-friendly way
   (e.g. `window.__charts.sankey`), then in the test:
   `page.evaluate(() => window.__charts.sankey.dispatchAction({ type: 'click', seriesIndex: 0, dataIndex: N }))`.
   This drives the exact same click handler the UI uses, with zero coordinate
   guesswork. Requires a small app-side hook (coordinate with codebase
   research / planner).
2. **Coordinate click on the canvas.** `canvas.click({ position: { x, y } })`
   at a computed node centre. Works but is brittle to layout changes; only use
   if exposing the instance is rejected.

Either way, **assert the drill-down result, not the click**: after the action,
`expect` that the next-level nodes/labels appear — e.g. read the rendered
ECharts option back via `page.evaluate` and assert the expanded series, or
assert a visible side-effect (the `#sankey-reset` "Übersicht" button becoming
relevant / an updated caption). Web-first `expect.poll(() => page.evaluate(...))`
retries the evaluate until the option reflects the expanded state.

### Anti-patterns to avoid

- **`waitForTimeout` / `sleep` for WASM init** — flaky; gate on
  `window.__appBereit` and visible results.
- **Clicking ECharts canvas by hardcoded pixel coordinates** without a
  fallback — layout-fragile; prefer `dispatchAction`.
- **Installing all three browser engines in CI** — wastes minutes; install
  `chromium` only.
- **Re-implementing server lifecycle** in a Makefile target with `&`/`kill` —
  let `webServer` own it; a stray `&` server leaks between runs.
- **Hardcoding the browser binary version in CI** — always
  `npx playwright install` against the resolved package version.
- **Asserting on `networkidle`** for a WASM app — `networkidle` is discouraged
  by Playwright; assert on app state instead.

## Playwright in GitHub Actions

Microsoft's official, documented approach (and the current 2026 recommendation)
is the **CLI inside a standard `ubuntu-latest` runner**, not the prebuilt
marketplace action and not necessarily the Docker container:

```yaml
# .github/workflows/e2e.yml (new — separate from pages.yml)
name: Browser-Tests
on:
  push: { branches: [main] }
  pull_request:
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version: 22          # repo uses Node 26 locally; LTS in CI is fine
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

Key points (confidence HIGH — Playwright official CI docs):
- `npx playwright install --with-deps chromium` installs the browser **and**
  the Linux OS libraries it needs. The `--with-deps` flag (since Playwright
  v1.8) is why the dedicated GitHub Action is no longer recommended — the CLI
  does it all.
- **`mcr.microsoft.com/playwright:v1.60.0-noble` container** is the alternative
  when you want the browser + OS deps pre-baked (faster, no `--with-deps` step).
  For this small project the plain runner is simpler and recommended; mention
  the container only as a "if install time becomes a problem" note. The
  container tag MUST match the installed Playwright version.
- **Caching:** `actions/setup-node` with `cache: npm` caches the npm modules.
  The *browser binaries* can additionally be cached with `actions/cache` keyed
  on the Playwright version (`~/.cache/ms-playwright`), but this is an
  optimisation — for one Chromium download it is optional and often skipped.
- This is a **separate workflow** from the existing `pages.yml`; do not bolt
  e2e onto the deploy job. Run e2e on `pull_request` + `push:main`.

## Build-Stamp / Version-Stempel

Goal: the static site visibly shows the git commit it was built from, so a
stale GitHub Pages deployment is instantly recognisable, and a Playwright test
can assert it.

The site currently has **no build step** — `pages.yml` uploads `web/`
verbatim. There are two standard patterns; recommend **Pattern A**:

### Pattern A — `version.json` written by the Pages workflow (recommended)

In `pages.yml`, before `upload-pages-artifact`, write a small JSON file into
`web/`:

```yaml
- name: Build-Stempel schreiben
  run: |
    cat > web/version.json <<EOF
    { "commit": "${GITHUB_SHA}", "shortCommit": "${GITHUB_SHA:0:7}", "builtAt": "$(date -u +%FT%TZ)" }
    EOF
```

Then `app.js` (or a tiny inline script) does
`fetch('./version.json').then(r => r.json())` and renders
`shortCommit` + `builtAt` into the existing `<footer class="footer">`
(give the span a stable id, e.g. `#build-stamp`).

- **Pros:** keeps `web/` byte-identical in git (no committed stamp churn);
  no build tooling; the JSON is also machine-readable for monitoring.
- **Local dev:** ship a committed fallback `web/version.json` with
  `{"commit":"dev","shortCommit":"dev"}` (or have the fetch fail gracefully)
  so the page works when served via `scripts/serve.mjs`.

### Pattern B — placeholder substitution at deploy time

Put a literal token in `index.html`, e.g.
`<span id="build-stamp">__BUILD_COMMIT__</span>`, and in `pages.yml` run a
`sed -i "s/__BUILD_COMMIT__/${GITHUB_SHA:0:7}/" web/index.html` before upload.

- **Pros:** no runtime `fetch`; stamp is in the HTML.
- **Cons:** the committed source contains a placeholder, not a real value;
  locally the page literally shows `__BUILD_COMMIT__` unless the dev server
  also substitutes. Slightly worse DX. Use only if a runtime fetch is undesired.

### How the Playwright test asserts it

```js
test('footer shows build commit', async ({ page }) => {
  await page.goto('/web/');
  // local run: the committed fallback ("dev") — assert non-empty / matches env
  const expected = process.env.EXPECTED_COMMIT;   // set in CI from github.sha
  const stamp = page.locator('#build-stamp');
  await expect(stamp).toBeVisible();
  if (expected) await expect(stamp).toContainText(expected.slice(0, 7));
  else await expect(stamp).not.toBeEmpty();
});
```

In CI, pass `EXPECTED_COMMIT: ${{ github.sha }}` as an env var to the e2e job
so the test verifies the deployed/served stamp matches the commit under test.
Note `${GITHUB_SHA:0:7}` substitution only works in a `run:` shell step, not
in arbitrary YAML contexts — keep the slicing inside the `run:` block.

## Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright Test | Puppeteer + Jest | No bundled runner/server orchestration; strictly more wiring for zero benefit on a static app |
| Playwright Test | Cypress | Heavier, in-page runtime fights WASM workers / cross-origin; overkill for ~6 specs |
| Playwright Test | WebdriverIO | Selenium-heritage config sprawl; no advantage here |
| `version.json` fetch (Pattern A) | `sed` placeholder (Pattern B) | B avoids a runtime fetch but leaves an ugly placeholder in committed source and worse local DX |
| Plain `ubuntu-latest` + `--with-deps` | `mcr.microsoft.com/playwright` container | Container pre-bakes deps (faster) but adds image-version pinning overhead; not worth it for one Chromium |
| Install all browsers | Chromium only | Multi-browser wastes CI minutes; issue scopes Chromium |

## Environment Notes (for Pitfalls cross-ref)

- Dev container is **`aarch64` / Linux** — on Arm64 Linux Playwright 1.60 uses
  Chromium (not Chrome-for-Testing). Functionally fine; just don't be surprised
  by the binary name.
- Node `v26.1.0`, npm `11.13.0` locally — well above Playwright's minimum.
- The app uses **IndexedDB**, not OPFS-with-COOP/COEP — `serve.mjs` deliberately
  sets no cross-origin-isolation headers, matching GitHub Pages. Playwright's
  default Chromium context supports IndexedDB; persistence-across-reload tests
  work because `page.reload()` keeps the same browsing context. Do NOT create a
  fresh `browser.newContext()` between the write and the reload assertion or
  IndexedDB state is lost.

## Sources

### HIGH confidence
- `npm view @playwright/test version` / `dist-tags` / `time` — run 2026-05-22:
  `latest = 1.60.0`, `next = 1.61.0-alpha-2026-05-22`.
- [Playwright — Web server (`webServer`) docs](https://playwright.dev/docs/test-webserver)
- [Playwright — Setting up CI](https://playwright.dev/docs/ci-intro)
- [Playwright — Assertions (web-first)](https://playwright.dev/docs/test-assertions)
- [Playwright — TestConfig API](https://playwright.dev/docs/api/class-testconfig)
- [Playwright — Release notes](https://playwright.dev/docs/release-notes)
- Codebase: `scripts/serve.mjs`, `web/index.html`, `web/js/app.js`
  (`window.__appBereit`, `#file-input`, `#dropzone`, `data-tab`/`data-panel`,
  `#sankey-reset`), `web/js/boot-guard.js` (`#boot-banner`),
  `web/js/sankey-drill.js` / `dashboard-charts.js` (ECharts Sankey),
  `.github/workflows/pages.yml`, `package.json`, `Makefile`.

### MEDIUM confidence
- [Playwright 1.60.0 Release Updates — currents.dev](https://currents.dev/posts/pw-1.60.0)
  — Chrome-for-Testing switch, `webServer.wait` regex field, `locator.drop()`.
  Corroborated by official release notes.
- [Releases · microsoft/playwright (GitHub)](https://github.com/microsoft/playwright/releases)
- [microsoft/playwright-github-action](https://github.com/microsoft/playwright-github-action)
  — confirms CLI `--with-deps` is the recommended path over the action.
- [Playwright CI/CD Integration 2026 — goGreenlit](https://www.gogreenlit.com/blog/playwright-cicd-integration/)
  — browser caching, sharding, HTML report artifacts (general practice).

### LOW confidence (needs validation by planner/executor)
- Exact tag of the `mcr.microsoft.com/playwright` container for 1.60.0
  (likely `v1.60.0-noble`) — verify against Docker Hub / MS docs before use;
  only matters if the container route is chosen (it is NOT the recommendation).
- Whether `app.js` already exposes the ECharts instance on `window` — codebase
  research must confirm; if not, a small app-side hook is needed for the
  reliable Sankey `dispatchAction` test path.
