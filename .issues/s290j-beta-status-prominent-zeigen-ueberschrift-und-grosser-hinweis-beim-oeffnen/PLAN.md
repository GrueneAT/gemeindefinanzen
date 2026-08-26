# Plan: Beta-Status prominent zeigen — Ueberschrift und grosser Hinweis beim Oeffnen

<objective>
What this plan accomplishes: The Beta status of the Gemeindefinanzen web app becomes
impossible to miss. The hero H1 carries the Beta state as visible text, and a large DS
warn-callout sits directly under the hero — above and *outside* the document manager —
explaining what Beta means here (check every result, the PDF parser can be wrong) and
where feedback goes (florian.motlik@gruene.at). The old small `.app-beta-hinweis`
paragraph is absorbed into that callout, not kept alongside it.

Why it matters: User feedback says the current disclosure (one small sentence under the
hero plus a tiny BETA Stoerer at the logo) is too easy to overlook. People act on numbers
this tool produces; a parser mistake that goes unnoticed is a real-world risk.

Scope — IN: `web/index.html` (H1 text, new `<aside>` callout, removal of the old
paragraph), `web/css/app.css` (removal of the now-dead `.app-beta-hinweis` rules),
one new Playwright spec `tests/e2e/beta-hinweis.spec.mjs`.

Scope — OUT (do not touch):
- `.app-beta-marker` / `.gat-stoerer--magenta` at the logo — stays exactly as-is
  (markup in `web/index.html`, CSS at `web/css/app.css:567-580` incl. its
  `@media (max-width: 420px)` rule).
- `web/js/app.js` — no JS change is needed anywhere in this issue.
- The existing `@media print` hide-list in `web/css/app.css` — it stays byte-identical.
  The new callout must NOT be added to it (see decision below).
- The removed high-contrast toggle (`bc1da4b`) — NOT resurrected (see decision below).
- The older `<div class="gat-callout">` at `web/index.html:~689` — not retrofitted.

No CONTEXT.md exists for this issue (no `issue:discuss` ran). Decisions below come from
RESEARCH.md plus the two explicit user rulings recorded in `<strategy>`.
</objective>

<strategy>
Direction: pure markup + stylesheet change. Both visual pieces already exist as
Design-System components that this app already loads via CDN, so nothing is hand-rolled
and no dependency, build step or JS change is introduced.

Option A (chosen) — plain `— Beta` text suffix in the existing H1.
Option B (rejected) — a second, large `<span class="gat-stoerer gat-stoerer--magenta">`
next to the H1. Rejected because base `.gat-stoerer` sets no `font-size`, so next to a
`--gat-text-h1` heading it would inherit a huge size and need new local sizing/rotation
CSS — exactly the "Eigenbau" the issue's own Constraints forbid — and it would look
redundant next to the Stoerer already sitting at the logo. Option A keeps the H1 a single
accessible text node and is trivially assertable.

Option A (chosen) — the big hint is `<aside class="gat-callout gat-callout--warn">` with a
`.gat-callout__lead`, placed as a page-level sibling AFTER `</header>` (end of `.gat-hero`)
and BEFORE `<div id="toast-box">`, i.e. above but strictly outside `<details id="doc-manager">`.
Option B (rejected) — the same callout inside `.doc-manager-body` ("above the document
list"). Rejected for two independently verified reasons: `app.js:aktualisiereDokVerwaltung()`
sets `manager.open = anzahl === 0`, so the hint would collapse out of view the moment the
first document is loaded (violating AC "bleibt beim Arbeiten sichtbar"); and `@media print`
in `web/css/app.css` sets `.doc-manager { display: none !important }`, so the hint would
vanish entirely from printed reports (violating AC "im Druck ... nicht luegen").

Option A (chosen) — add nothing to the print hide-list. The callout prints by default, and
the DS itself already ships `break-inside: avoid` for all `.gat-callout` variants inside its
own `@media print`. Option B (rejected) — hide the callout in print: the AC explicitly
forbids a printed report that omits the Beta disclosure ("aber auch nicht luegen").

DECISION — AC "funktioniert in beiden Farbmodi" is satisfied by construction, nothing to
build. This app has exactly one page colour mode: the high-contrast system (`.gat-mode-hc`,
`#hc-toggle`) was deliberately removed in commit `bc1da4b`, which also deleted
`tests/e2e/hc-toggle.spec.mjs`. The AC text is stale, carried over from before that commit
(confirmed by the user at plan time). Resolution: use the DS's own
`--gat-web-callout-warn-*` tokens as-is and hard-code no colour anywhere. Do NOT resurrect
the toggle, do NOT add `prefers-color-scheme` handling — either would be unrequested scope
creep contradicting a decision this repo already made. The three chart themes
(`#theme-picker`) only recolour ECharts canvases and never touch page-level callouts.

DECISION — the logo Stoerer stays. The issue names only the `.app-beta-hinweis` paragraph
as "geht darin auf"; removing the Stoerer was never asked for and is the higher-risk option.

Verification strategy: no existing Playwright spec asserts on the H1, `.app-beta-hinweis`
or `.gat-callout`, and the repo has zero screenshot/snapshot tests — so nothing can catch a
regression here today. The plan therefore adds one new spec that asserts the rendered
markup directly (H1 text, callout visible on open, callout still visible after the doc
manager auto-collapses with a real fixture PDF, callout not hidden under
`emulateMedia({ media: 'print' })` with `#doc-manager` as the control probe proving the
print rules actually applied), and then runs the whole existing suite as the regression net.
</strategy>

<skills>
No `.claude/skills/` directory exists in this repo — there are no workspace skills to load.
The binding conventions come from the two CLAUDE.md files instead; follow them:
- @CLAUDE.md (repo) — Vanilla JS/ESM, no build step for `web/`, German UI text, English
  identifiers, no vendoring (DS stays a CDN `<link>`), no tool attribution in commits/code/
  comments, tests stay green.
- Workspace CLAUDE.md — work only in this worktree, never in the shared main checkout.
</skills>

<context>
Issue: @.issues/s290j-beta-status-prominent-zeigen-ueberschrift-und-grosser-hinweis-beim-oeffnen/ISSUE.md
Research: @.issues/s290j-beta-status-prominent-zeigen-ueberschrift-und-grosser-hinweis-beim-oeffnen/RESEARCH.md

Key files:
@web/index.html — hero block (H1 + intro + old beta paragraph), `#toast-box`,
  `<details id="doc-manager">`; also the logo Stoerer (out of scope) and an older
  `<div class="gat-callout">` in the Ausgaben tab (out of scope).
@web/css/app.css — `.app-beta-marker` (KEEP, ~567-580), `.app-beta-hinweis` (DELETE,
  ~582-592), `@media print` hide-list (~985-1030, leave byte-identical).
@web/js/app.js — read-only context: `aktualisiereDokVerwaltung()` drives the doc manager's
  open state. Nothing to change here.
@tests/e2e/helpers.mjs — `oeffneApp(page)` and `ladeFixturePdf(page)` used by the new spec.

Text convention (IMPORTANT): UI text in this codebase uses ASCII transliteration —
`ae/oe/ue/ss`, not `ä/ö/ü/ß` (`Voranschlaege`, `Rechnungsabschluesse`, `Wuensche`). The
em dash `—` is used and is fine. All new German copy below already follows this.

<interfaces>
<!-- Executor: use these contracts directly. Do not explore the codebase for them. -->

// From web/index.html — CURRENT hero block. Lines to change are marked.
  <header class="gat-hero">
    <h1 class="gat-headline gat-hero__title">Gemeindebudget auswerten</h1>   <!-- CHANGE: append " — Beta" -->
    <p class="app-intro gat-fliesstext gat-hero__intro">VRV-2015-Voranschlaege,
      ... </p>                                                               <!-- KEEP unchanged -->
    <p class="app-intro gat-fliesstext gat-hero__intro app-beta-hinweis">    <!-- DELETE this whole <p> -->
      Dieses Werkzeug ist in der <strong>Beta-Phase</strong>. Bei Problemen,
      Fehlern oder Wuenschen bitte direkt an
      <a href="mailto:florian.motlik@gruene.at"
         >florian.motlik@gruene.at</a> melden.</p>
  </header>
                                                                             <!-- INSERT new <aside> HERE -->
  <div id="toast-box" class="gat-toaster" role="region"
       aria-live="polite" aria-label="Meldungen"></div>

  <details class="doc-manager" id="doc-manager" open>                        <!-- must stay AFTER the aside -->

// From web/js/app.js — read-only. Why the aside must be a sibling, not a child:
function aktualisiereDokVerwaltung(anzahl) {
  const manager = document.getElementById("doc-manager")
  if (manager) manager.open = anzahl === 0          // collapses as soon as 1 doc is loaded
}
// second call site forces manager.open = true on partial upload failure.

// From web/css/app.css — rules to DELETE together with the paragraph (~582-592,
// including the 3-line German comment block directly above them):
/* Beta-Hinweis-Absatz unter dem Hero-Intro — ... */
.app-beta-hinweis { margin-top: 0.7rem; font-size: 0.95em; color: var(--gat-web-text-soft); }
.app-beta-hinweis strong { color: var(--gat-color-accent); }

// From web/css/app.css — KEEP untouched (~562-580):
.app-beta-marker { font-size: 0.7rem; ... }
@media (max-width: 420px) { .app-beta-marker { display: none; } }

// From web/css/app.css — KEEP byte-identical. The new aside is NOT in this list,
// so it prints by default. Do not add it.
@media print {
  .doc-manager, .dashboard-leer, .dash-controls, #toast-box, .mj-overlay,
  .sankey-bar, .mj-actions, .footer { display: none !important; }
  ...
}

// From https://design-system.gruene.at/design-system.css — already linked in <head>.
// No new CSS needed; these ship ready to use.
.gat-callout { background/border-left/radius/padding/margin/max-width:70rem; }
.gat-callout--warn { background: var(--gat-web-callout-warn-bg);
                     border-left-color: var(--gat-web-callout-warn-border);
                     color: var(--gat-web-callout-warn-text); }
.gat-callout__lead { margin-bottom: var(--gat-space-1); font-weight: 700; display: block; }
@media print { .gat-callout, .gat-callout--warn, ... { break-inside: avoid; } }

// DS-canonical callout markup (from the design-system's own docs page):
<aside class="gat-callout gat-callout--info">
  <span class="gat-callout__lead">Hinweis:</span>
  <p>Inhalt des Hinweises.</p>
</aside>

// From tests/e2e/helpers.mjs — the two helpers the new spec imports:
export async function oeffneApp(page)      // goto /web/ + wait for window.__appBereit
export async function ladeFixturePdf(page) // oeffneApp + upload documents/VA-2026-Auflage.pdf
                                           // + wait through the reload + dashboard ready
</interfaces>

<call_sites>
Searched: no CLI flag, command, script entry point or subcommand is introduced or changed
by this plan. Surfaces checked anyway: `.github/workflows/`, `Makefile`, `package.json`
scripts, `tools/`, `scripts/`, `README*`.

Found: No CLI call sites to update. The change is HTML/CSS plus one new Playwright spec;
`npm run test:e2e` picks the new spec up automatically via `testDir: 'tests/e2e'` in
`playwright.config.mjs` — no runner, workflow or Makefile edit is required.
</call_sites>
</context>

<commit_format>
Format: conventional with issue prefix (per `.issues/config.yaml`: `format: conventional`,
`prefix: true`).
Pattern: `{issue-id}: {type}({scope}): {description}`
Example: `s290j: feat(web): beta-hinweis als DS-callout ueber der dokumentverwaltung`
Types: feat, fix, test, refactor, docs, chore. Scope for this issue: `web` (markup/CSS) or
`test` (the new spec).
NO tool attribution anywhere — no "claude", no "Generated with", no `Co-Authored-By`.
</commit_format>

<tasks>

<task type="auto">
  <name>Task 1: H1 traegt Beta, grosser DS-Callout ersetzt den kleinen Absatz</name>
  <files>web/index.html, web/css/app.css</files>
  <action>
  Three edits in `web/index.html`, one edit in `web/css/app.css`. No other file changes.

  1. H1 — append the Beta state as plain text (no new markup, no new class):
     `<h1 class="gat-headline gat-hero__title">Gemeindebudget auswerten — Beta</h1>`
     Use the em dash `—` exactly as written (the file already uses it elsewhere).

  2. Delete the entire `<p class="app-intro gat-fliesstext gat-hero__intro app-beta-hinweis">
     ...</p>` block from inside `<header class="gat-hero">`, including the German comment
     above it if one is attached to it. The first intro paragraph
     (`<p class="app-intro gat-fliesstext gat-hero__intro">VRV-2015-Voranschlaege ...`)
     stays exactly as it is.

  3. Insert this block as a page-level sibling: directly AFTER the `</header>` that closes
     `.gat-hero` and directly BEFORE `<div id="toast-box" ...>`. It must NOT be inside
     `<header class="gat-hero">`, and it must NOT be inside `<details id="doc-manager">` —
     placement is the whole point of this task (see the two reasons in `<strategy>`).
     Indentation is two spaces, matching the surrounding children of `<div class="page">`.
     Use this German copy VERBATIM — do not rewrite, shorten or re-translate it, and do not
     introduce `ä/ö/ü/ß` (this codebase transliterates):

  <!-- Beta-Hinweis — bewusst ausserhalb von #doc-manager: app.js klappt die
       Dokumentverwaltung zu, sobald ein Dokument geladen ist, und im Druck ist
       .doc-manager ausgeblendet. Hier bleibt der Hinweis beim Arbeiten sichtbar
       und steht auch im ausgedruckten Bericht. -->
  <aside id="beta-hinweis" class="gat-callout gat-callout--warn">
    <span class="gat-callout__lead">Beta-Version: Ergebnisse bitte gegenpruefen</span>
    <p class="gat-fliesstext">Dieses Werkzeug ist in der <strong>Beta-Phase</strong>. Die
      Auswertung entsteht aus einer automatischen Erkennung der hochgeladenen Dokumente —
      der PDF-Parser kann Zahlen falsch zuordnen oder uebersehen. Bitte jedes Ergebnis
      gegen den Voranschlag beziehungsweise den Rechnungsabschluss pruefen, bevor es
      weitergegeben oder veroeffentlicht wird.</p>
    <p class="gat-fliesstext">Fehler, unstimmige Zahlen und Wuensche bitte direkt an
      <a href="mailto:florian.motlik@gruene.at">florian.motlik@gruene.at</a> melden —
      jede Rueckmeldung verbessert das Werkzeug.</p>
  </aside>

     The `id="beta-hinweis"` is a test/selector hook only — it gets NO CSS rule. It is
     needed because a second, unrelated `.gat-callout` already exists further down in the
     Ausgaben-Struktur tab, so a bare `.gat-callout` selector would be ambiguous.
     Do NOT add `role="alert"` or `aria-live` — this is static content present at page
     load; `#toast-box` already owns the live-region role for transient messages.

  4. In `web/css/app.css`, delete the now-dead `.app-beta-hinweis` and
     `.app-beta-hinweis strong` rules together with the German comment block that
     introduces them (~lines 582-592). Delete NOTHING else: `.app-beta-marker` and its
     `@media (max-width: 420px)` rule directly above stay, and the `@media print` block
     stays byte-identical — the new callout is deliberately NOT added to its hide-list.

  Add no new CSS class and no new CSS rule. The DS already supplies the callout's colours
  (`--gat-web-callout-warn-*` tokens), spacing, border and its print `break-inside: avoid`.
  Hard-code no colour value — that is exactly what keeps the "Farbmodi" AC satisfied by
  construction (see `<strategy>`). Touch no `web/js/*` file.
  </action>
  <verify>
  <automated>
python3 - <<'PY'
import re, sys
html = open('web/index.html', encoding='utf-8').read()
css  = open('web/css/app.css', encoding='utf-8').read()
lines = html.splitlines()
fail = []

def line_of(needle, label):
    for i, l in enumerate(lines, 1):
        if needle in l:
            return i
    fail.append(f"nicht gefunden: {label}")
    return None

# 1. H1 traegt Beta
if not re.search(r'<h1 class="gat-headline gat-hero__title">Gemeindebudget auswerten\s+—\s+Beta</h1>', html):
    fail.append("H1 traegt den Beta-Stand nicht")

# 2. alter kleiner Absatz weg — in Markup UND CSS
if 'app-beta-hinweis' in html: fail.append(".app-beta-hinweis noch in index.html")
if 'app-beta-hinweis' in css:  fail.append(".app-beta-hinweis-Regeln noch in app.css")

# 3. Stoerer unangetastet
if 'app-beta-marker' not in html: fail.append("Logo-Stoerer aus index.html entfernt")
if 'app-beta-marker' not in css:  fail.append("Logo-Stoerer-CSS aus app.css entfernt")

# 4. Callout vorhanden, DS-konform, mit Kontakt
if 'id="beta-hinweis"' not in html: fail.append("#beta-hinweis fehlt")
m = re.search(r'<aside id="beta-hinweis" class="gat-callout gat-callout--warn">(.*?)</aside>', html, re.S)
if not m:
    fail.append("<aside> mit gat-callout gat-callout--warn fehlt")
else:
    body = m.group(1)
    if 'gat-callout__lead' not in body: fail.append(".gat-callout__lead fehlt im Callout")
    if 'mailto:florian.motlik@gruene.at' not in body: fail.append("Kontakt-mailto fehlt im Callout")
    if re.search(r'role="alert"|aria-live', body): fail.append("Callout darf keine Live-Region sein")
    if re.search(r'[äöüÄÖÜß]', body): fail.append("Umlaut im Callout — Codebasis transliteriert (ae/oe/ue)")

# 5. Platzierung: Geschwister VOR #toast-box und VOR #doc-manager, ausserhalb .gat-hero
a = line_of('id="beta-hinweis"', 'aside')
t = line_of('id="toast-box"', 'toast-box')
d = line_of('<details class="doc-manager"', 'doc-manager')
h = line_of('<header class="gat-hero">', 'gat-hero')
if None not in (a, t, d, h):
    if not (h < a < t < d):
        fail.append(f"falsche Reihenfolge: hero={h} aside={a} toast={t} doc-manager={d}")
    hero_close = html.index('</header>', html.index('<header class="gat-hero">'))
    if html.index('id="beta-hinweis"') < hero_close:
        fail.append("Callout steht INNERHALB von .gat-hero")
    if re.search(r'<details class="doc-manager".*?id="beta-hinweis"', html, re.S):
        fail.append("Callout steht INNERHALB von #doc-manager")

# 6. Print-Hide-Liste unveraendert — Callout darf dort nicht auftauchen
pm = re.search(r'@media print\s*\{(.*?)\n\}', css, re.S)
if pm and ('beta-hinweis' in pm.group(1) or 'gat-callout' in pm.group(1)):
    fail.append("Callout in der Print-Hide-Liste — AC verbietet das")

# 7. kein neues lokales CSS fuer den Callout, keine Hex-Farben dafuer
if 'beta-hinweis' in css:
    fail.append("neue CSS-Regel fuer #beta-hinweis — DS-Tokens reichen")

if fail:
    print("MARKUP-CHECK FEHLGESCHLAGEN:")
    for f in fail: print("  -", f)
    sys.exit(1)
print("MARKUP-CHECK OK")
PY
git diff --stat -- web/js/ | grep . && { echo "FEHLER: web/js darf nicht geaendert werden"; exit 1; } || echo "web/js unveraendert — ok"
  </automated>
  </verify>
  <done>
  - `web/index.html` H1 reads `Gemeindebudget auswerten — Beta`
  - `<aside id="beta-hinweis" class="gat-callout gat-callout--warn">` exists with a
    `.gat-callout__lead`, the verbatim German copy and the
    `mailto:florian.motlik@gruene.at` link
  - The aside sits after `</header>` of `.gat-hero`, before `#toast-box`, and outside
    `<details id="doc-manager">`
  - The string `app-beta-hinweis` no longer appears in `web/index.html` or `web/css/app.css`
  - `app-beta-marker` markup and CSS are unchanged; the `@media print` hide-list is unchanged
  - No new CSS rule and no hard-coded colour was added; `web/js/` is untouched
  - The check script above prints `MARKUP-CHECK OK` and exits 0
  </done>
</task>

<task type="auto">
  <name>Task 2: Playwright-Spec fuer H1, Sichtbarkeit, Zuklapp-Fall und Druck</name>
  <files>tests/e2e/beta-hinweis.spec.mjs</files>
  <action>
  Create the new spec file `tests/e2e/beta-hinweis.spec.mjs`. No existing spec touches the
  H1, `.app-beta-hinweis` or `.gat-callout`, so this file is the only regression guard for
  this issue. Follow the house style of the existing specs: ESM imports from
  `@playwright/test`, helpers from `./helpers.mjs`, German test names and German comments,
  ASCII transliteration (`ae/oe/ue`), no semicolons at line ends (match `smoke.spec.mjs`
  and `upload.spec.mjs`).

  Write exactly these four tests:

  ```js
  import { test, expect } from '@playwright/test'
  import { oeffneApp, ladeFixturePdf } from './helpers.mjs'

  test('H1 traegt den Beta-Stand sichtbar mit', async ({ page }) => {
    await oeffneApp(page)
    await expect(page.locator('h1.gat-hero__title')).toContainText('Beta')
  })

  test('Beta-Hinweis ist beim Oeffnen sichtbar und nennt den Kontakt',
    async ({ page }) => {
      await oeffneApp(page)
      const hinweis = page.locator('#beta-hinweis')
      await expect(hinweis).toBeVisible()
      await expect(hinweis).toHaveClass(/gat-callout--warn/)
      await expect(hinweis.locator('.gat-callout__lead')).toBeVisible()
      await expect(
        hinweis.locator('a[href="mailto:florian.motlik@gruene.at"]'),
      ).toHaveCount(1)
      // Der Hinweis steht ausserhalb der Dokumentverwaltung ...
      await expect(page.locator('#doc-manager #beta-hinweis')).toHaveCount(0)
      // ... und der alte kleine Absatz existiert nicht mehr daneben.
      await expect(page.locator('.app-beta-hinweis')).toHaveCount(0)
    })

  test('Beta-Hinweis bleibt sichtbar, wenn die Dokumentverwaltung zuklappt',
    async ({ page }) => {
      await ladeFixturePdf(page)
      // app.js setzt manager.open = (anzahl === 0) — mit einem Dokument zu.
      await expect
        .poll(() => page.locator('#doc-manager').evaluate((el) => el.open),
          { timeout: 30000 })
        .toBe(false)
      await expect(page.locator('#beta-hinweis')).toBeVisible()
    })

  test('Beta-Hinweis verschwindet im Druck nicht', async ({ page }) => {
    await oeffneApp(page)
    await page.emulateMedia({ media: 'print' })
    // Kontrollprobe: die Druck-Regeln greifen wirklich (.doc-manager ist
    // in @media print ausgeblendet) — sonst waere der Test unten wertlos.
    await expect(page.locator('#doc-manager')).toBeHidden()
    await expect(page.locator('#beta-hinweis')).toBeVisible()
  })
  ```

  Notes for the executor:
  - The control probe on `#doc-manager` in the print test is deliberate. Without it, a
    broken `emulateMedia` call would let the print assertion pass vacuously.
  - The third test uses the real fixture (`documents/VA-2026-Auflage.pdf` via
    `ladeFixturePdf`) because that is the only honest way to reach the auto-collapsed state;
    mupdf parsing takes seconds, hence the 30s poll timeout, matching `upload.spec.mjs`.
  - Do not add screenshot/snapshot assertions — this repo has none and does not want them.
  - Do not modify `playwright.config.mjs`; `testDir: 'tests/e2e'` picks the file up.
  </action>
  <verify>
  <automated>npx playwright test tests/e2e/beta-hinweis.spec.mjs --reporter=list</automated>
  </verify>
  <done>
  - `tests/e2e/beta-hinweis.spec.mjs` exists with exactly the four tests above
  - All four pass against the Task 1 markup
  - The print test's control probe confirms `#doc-manager` IS hidden in print while
    `#beta-hinweis` is NOT
  - `playwright.config.mjs` is unchanged
  </done>
</task>

<task type="auto">
  <name>Task 3: Regressionsnetz — vollstaendige Suite gruen</name>
  <files>(keine Aenderungen erwartet — reiner Verifikationslauf)</files>
  <action>
  Run the full existing test suites as the regression net for the markup change. Expect a
  clean pass: research confirmed that no existing spec asserts on the H1, the removed
  paragraph or any callout, and that there are no screenshot/snapshot tests in the repo.

  Run, in this order:
  1. `npm run test:e2e` — all 21 spec files (80 tests + the 4 new ones), Chromium only,
     the static server is started automatically by `playwright.config.mjs`.
  2. `npm run test:js` — the Node-side unit tests.

  If a test fails, fix the CAUSE in `web/index.html` / `web/css/app.css` /
  `tests/e2e/beta-hinweis.spec.mjs` — never weaken or skip an existing assertion, and never
  add the callout to the print hide-list to make something pass. If a failure is clearly
  pre-existing and unrelated to this change, confirm it by stashing the change and re-running
  that single spec, then record it in the execution notes rather than papering over it.

  The Python gates (`PYTHONPATH=src pytest -q`, `ruff check src tests`, `mypy src`) cover
  `src/` only and are untouched by an HTML/CSS change; run them once as a final sanity
  check per CLAUDE.md, but do not modify anything under `src/` in this issue.

  Do NOT commit — the orchestrator handles commits.
  </action>
  <verify>
  <automated>npm run test:e2e && npm run test:js</automated>
  </verify>
  <done>
  - `npm run test:e2e` passes, including the four new `beta-hinweis` tests
  - `npm run test:js` passes
  - `git status` shows changes only in `web/index.html`, `web/css/app.css` and
    `tests/e2e/beta-hinweis.spec.mjs` (plus issue artefacts)
  - No existing assertion was weakened, skipped or deleted
  </done>
</task>

</tasks>

<verification>
After all tasks, run the final checks from the worktree root:
- `npm run test:e2e` — full Playwright suite incl. the new `beta-hinweis` spec
- `npm run test:js` — Node unit tests
- `PYTHONPATH=src pytest -q` — Python reference pipeline (untouched, must stay green)
- `ruff check src tests` and `mypy src` — Python lint/type gates (untouched)
- `git diff --stat` — must list only `web/index.html`, `web/css/app.css`,
  `tests/e2e/beta-hinweis.spec.mjs`
- `grep -rn "app-beta-hinweis" web/ ; grep -rn "claude\|Generated with\|Co-Authored-By" web/ tests/e2e/beta-hinweis.spec.mjs`
  — both must return nothing (old paragraph fully gone, zero tool attribution)
</verification>

<success_criteria>
Maps 1:1 to the acceptance criteria in ISSUE.md:
- AC1 "Beta-Stand in der H1 bzw. unmittelbar daneben sichtbar" — the H1 renders
  `Gemeindebudget auswerten — Beta`; asserted by `beta-hinweis.spec.mjs` test 1.
- AC2 "beim Oeffnen ein grosser, nicht zu uebersehender Beta-Hinweis inkl. Kontakt" — a
  `gat-callout--warn` aside with a `.gat-callout__lead` and the
  `florian.motlik@gruene.at` mailto is visible immediately on page load, directly under the
  hero and above the document manager; asserted by test 2. No blocker dialog, nothing to
  click away, and it stays visible while working (asserted by test 3, with a real fixture
  PDF loaded and the document manager auto-collapsed).
- AC3 "der alte kleine Beta-Satz existiert nicht mehr doppelt" — `app-beta-hinweis` appears
  in neither `web/index.html` nor `web/css/app.css`; asserted by the Task 1 check and by
  `toHaveCount(0)` in test 2.
- AC4 "funktioniert in beiden Farbmodi und im Print-Stylesheet sinnvoll" — Farbmodi part is
  satisfied by construction (single colour mode since `bc1da4b`; only DS
  `--gat-web-callout-warn-*` tokens used, no hard-coded colour, HC toggle NOT resurrected —
  user decision recorded in `<strategy>`). Print part: the callout is not in the
  `@media print` hide-list and stays visible in print, while `.doc-manager` correctly does
  not — asserted by test 4; the DS's own `break-inside: avoid` keeps it from splitting.
- AC5 "Playwright-Tests laufen durch" — `npm run test:e2e` green (Task 3).
Constraints: DS callout instead of Eigenbau (no new CSS class, no new rule, DS stays a CDN
`<link>` — no vendoring); conventional commit with issue prefix; no tool attribution.
</success_criteria>
