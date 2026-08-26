# Research: Beta-Status prominent zeigen — Ueberschrift und grosser Hinweis beim Oeffnen

**Researched:** 2026-08-26
**Issue:** s290j-beta-status-prominent-zeigen-ueberschrift-und-grosser-hinweis-beim-oeffnen
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md found for this issue. No `issue:discuss` session ran before
research. All scoping comes from ISSUE.md directly — see "Was zu tun ist" /
"Akzeptanzkriterien" / "Constraints" there. Nothing here overrides ISSUE.md.
</user_constraints>

## Summary

This is a small, purely front-end change confined to `web/index.html` and
`web/css/app.css` (no JS logic needed). Both required visual pieces already
exist as DS v2.x components and are already used elsewhere in this exact
codebase, so nothing needs to be hand-rolled:

1. **H1 carries Beta.** Append the text `— Beta` directly inside the existing
   `<h1 class="gat-headline gat-hero__title">Gemeindebudget auswerten</h1>`.
   Plain text, no new markup or CSS — this is the simplest option the issue
   itself proposes, keeps the H1 a single accessible text node (good for
   screen readers and for any future Playwright assertion on `h1` text), and
   needs zero new interfaces.
2. **Big, unmissable hint.** Replace the small `<p class="... app-beta-hinweis">`
   paragraph with a DS `<aside class="gat-callout gat-callout--warn">` block,
   placed as a new sibling **between** `</header>` (end of `.gat-hero`) and
   `<div id="toast-box">` — i.e. still above `#doc-manager`, but *outside* of
   it. This placement matters for two independent reasons verified in code:
   it satisfies "bleibt sichtbar, wandert nicht weg" without any JS (the
   element is static page flow, not inside the `<details>` that
   `app.js:aktualisiereDokVerwaltung()` opens/closes based on document count),
   and it survives print (`@media print` in `app.css` only hides
   `.doc-manager` and a fixed list of control surfaces — a callout placed
   outside `.doc-manager` prints by default, and `.gat-callout--warn` already
   ships `break-inside:avoid` for print in the DS itself).
3. **Old small paragraph removed, not duplicated.** `.app-beta-hinweis` (the
   `<p>` at `web/index.html:75`) is deleted; its content (Beta explanation +
   `florian.motlik@gruene.at` mailto) moves into the new callout body. The
   now-unused `.app-beta-hinweis` / `.app-beta-hinweis strong` CSS rules in
   `web/css/app.css:585-591` are removed with it.
4. **Logo Stoerer stays untouched.** `.app-beta-marker` /
   `.gat-stoerer--magenta` at the header brand link is out of scope — the
   issue's "Was zu tun ist" list never asks to remove it, only the
   `.app-beta-hinweis` paragraph is explicitly named as "geht darin auf". The
   header is not `position: sticky`/`fixed` in this app, so the logo Stoerer
   is not a persistent while-scrolling indicator either way; keeping it is
   the lower-risk, lower-effort option and does not conflict with the new H1
   text or the new callout.

**Primary recommendation:** Use `<aside class="gat-callout gat-callout--warn">`
(DS v2.1) with a `.gat-callout__lead` prefix for the big hint, and a plain
`— Beta` text suffix in the existing H1. No new CSS classes, no JS changes,
no new dependencies. One open point genuinely needs a decision at plan time:
the AC's "beiden Farbmodi" does not map to any existing feature in this app —
see Pitfalls below.

## Codebase Analysis

### Relevant Code

| File | Purpose | Last Modified | Relevance |
|------|---------|---------------|-----------|
| `web/index.html` | Header Stoerer, hero H1 + intro + beta paragraph, doc-manager `<details>` | 2026-06-10 (`#33`) | Primary edit target |
| `web/css/app.css` | `.app-beta-marker`, `.app-beta-hinweis`, `@media print` block, `.doc-manager` | 2026-06-10 | Primary edit target (remove dead rules) |
| `web/js/app.js` | `aktualisiereDokVerwaltung(anzahl)` toggles `#doc-manager`'s `open` attribute by doc count; also forces `open = true` on a failed upload | 2026-06-10 | Read-only — confirms new callout must live outside `#doc-manager` to stay visible regardless of its open/closed state |
| `tests/e2e/*.spec.mjs` (20 files) | Playwright suite | various | None currently assert on H1 text, `.app-beta-hinweis`, or `.gat-callout` — confirmed via grep, zero hits |
| `tests/e2e/helpers.mjs` | `oeffneApp()`, `ladeFixturePdf()` | — | No selector conflicts with the change |

Not stale: most recently touched 2026-06-10 (~11 weeks before this research),
no pending/uncommitted changes to these files in this worktree.

### Interfaces

<interfaces>
// From web/index.html — header brand link (KEEP AS-IS, out of scope)
<a class="gat-header__brand" href=".">
  <img class="gat-header__logo" src="https://design-system.gruene.at/assets/gruene-logo.svg" alt="Die Gruenen" width="150" height="132">
  <span class="gat-header__wordmark">Gemeindefinanzen</span>
  <span class="gat-stoerer gat-stoerer--magenta app-beta-marker" aria-label="Beta-Version">BETA</span>
</a>

// From web/index.html — support mailto pattern already established, reuse verbatim
<a href="mailto:florian.motlik@gruene.at"
   class="gat-header__support"
   title="Bei Fragen oder Feedback an den Betreuer dieses Tools schreiben"
   aria-label="Support-E-Mail an florian.motlik@gruene.at">...</a>

// From web/index.html — hero block, CURRENT state (lines ~64-77)
<header class="gat-hero">
  <h1 class="gat-headline gat-hero__title">Gemeindebudget auswerten</h1>
  <p class="app-intro gat-fliesstext gat-hero__intro">VRV-2015-Voranschlaege, ...</p>
  <p class="app-intro gat-fliesstext gat-hero__intro app-beta-hinweis">
    Dieses Werkzeug ist in der <strong>Beta-Phase</strong>. Bei Problemen,
    Fehlern oder Wuenschen bitte direkt an
    <a href="mailto:florian.motlik@gruene.at">florian.motlik@gruene.at</a> melden.</p>
</header>
<div id="toast-box" class="gat-toaster" role="region" aria-live="polite" aria-label="Meldungen"></div>
<details class="doc-manager" id="doc-manager" open>
  <summary class="doc-manager-summary">
    <span class="doc-manager-title">Dokumente verwalten</span>
    <span class="doc-manager-count" id="doc-manager-count"></span>
  </summary>
  <div class="doc-manager-body">...</div>
</details>

// From web/js/app.js — doc-manager open/close is driven purely by these two
// call sites; a callout placed as a sibling (not a child) of #doc-manager is
// unaffected by either.
function aktualisiereDokVerwaltung(anzahl) {
  const manager = document.getElementById("doc-manager")
  const count = document.getElementById("doc-manager-count")
  if (count) count.textContent = anzahl > 0 ? `— ${anzahl} geladen` : "— noch keine geladen"
  if (manager) manager.open = anzahl === 0
}
// second call site (verarbeiteDateien-Pfad, ~line 2160): on partial upload
// failure, forces manager.open = true so error list stays visible.

// From web/css/app.css — rules to DELETE (dead after paragraph removal)
.app-beta-hinweis { margin-top: 0.7rem; font-size: 0.95em; color: var(--gat-web-text-soft); }
.app-beta-hinweis strong { color: var(--gat-color-accent); }
// .app-beta-marker (lines ~567-579) and its @media (max-width:420px) rule: KEEP, out of scope.

// From web/css/app.css — print stylesheet (lines 985-1035), current selector list to hide.
// A new callout placed OUTSIDE .doc-manager is NOT in this list and prints by default.
@media print {
  .doc-manager, .dashboard-leer, .dash-controls, #toast-box, .mj-overlay,
  .sankey-bar, .mj-actions, .footer { display: none !important; }
  .page { max-width: none; padding-inline: 0; }
  h1, h2, h3 { break-after: avoid; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}

// From https://design-system.gruene.at/design-system.css (DS v2.1+) — verified by fetching
// the live stylesheet directly (curl), not from training data.
.gat-callout {
  background: var(--gat-web-green-tint);
  border-left: 4px solid var(--gat-web-green-deep);
  border-radius: 0 var(--gat-web-radius-card) var(--gat-web-radius-card) 0;
  padding: var(--gat-space-3) var(--gat-space-4);
  margin: var(--gat-space-3) 0;
  max-width: 70rem;
  color: var(--gat-web-text);
}
.gat-callout--info    { background: var(--gat-web-callout-info-bg);    border-left-color: var(--gat-web-callout-info-border);    color: var(--gat-web-callout-info-text); }
.gat-callout--warn    { background: var(--gat-web-callout-warn-bg);    border-left-color: var(--gat-web-callout-warn-border);    color: var(--gat-web-callout-warn-text); }    /* #fdf3d2 bg / #b78a1c border / #5a4308 text */
.gat-callout--danger  { background: var(--gat-web-callout-error-bg);   border-left-color: var(--gat-web-callout-error-border);   color: var(--gat-web-callout-error-text); }
.gat-callout--success { background: var(--gat-web-callout-success-bg); border-left-color: var(--gat-web-callout-success-border); color: var(--gat-web-callout-success-text); }
.gat-callout--legal   { background: var(--gat-web-callout-legal-bg);   border-left-color: var(--gat-web-callout-legal-border);   color: var(--gat-web-callout-legal-text); }
.gat-callout__lead { margin-bottom: var(--gat-space-1); font-weight: 700; display: block; }
.gat-callout__icon { vertical-align: -.2em; flex: none; justify-content: center; align-items: center; width: 1.2em; height: 1.2em; margin-right: .45em; display: inline-flex; }
/* Inside @media print in the DS itself — applies automatically, no app-side work needed: */
.gat-callout, .gat-callout--info, .gat-callout--warn, .gat-callout--error,
.gat-callout--danger, .gat-callout--success, .gat-callout--legal { break-inside: avoid; }

.gat-stoerer { padding: var(--gat-space-2) var(--gat-space-4); border-radius: var(--gat-radius-sm); font-family: var(--gat-font-headline); font-weight: 900; line-height: var(--gat-leading-headline); text-align: center; display: inline-block; transform: rotate(-6deg); }
.gat-stoerer--magenta, .gat-stoerer--gelb  /* requires one modifier — Pflicht per DS docs */

.gat-hero { margin: var(--gat-space-5) 0; }
.gat-hero__title { margin: 0; }              /* no font-size set here — inherits .gat-headline's var(--gat-text-h1) */
.gat-hero__intro { margin: var(--gat-space-2) 0 0; font-size: var(--gat-text-subline); ... }
.gat-headline { font-family: var(--gat-font-headline); font-weight: 800; font-size: var(--gat-text-h1); ... }

// DS-canonical markup for a callout with a Hinweis:-style prefix (from the DS's own
// documentation page, design-system/design-system/index.html:1440-1459 — verified locally):
<aside class="gat-callout gat-callout--info">
  <span class="gat-callout__lead">Hinweis:</span>
  <p>Inhalt des Hinweises.</p>
</aside>
</interfaces>

### Reusable Components

- `.gat-callout` + `.gat-callout--warn` — exactly the block the issue text
  itself names ("DS-Callout, `gat-callout --warn` o. ae."). Already imported
  globally via the DS `<link>` in `<head>`; zero extra work to use it.
- `.gat-callout__lead` — DS v2.1.1 addition, purpose-built to replace a manual
  `<strong>Label:</strong>` prefix inside a callout (exactly what
  `.app-beta-hinweis` currently does with `<strong>Beta-Phase</strong>`).
- Existing `.gat-callout` usage already in this codebase at
  `web/index.html:689` (`<div class="gat-callout">` in the Ausgaben-Struktur
  tab, "Wichtige Einordnung") shows the local convention. It uses a plain
  `<div>` rather than the DS-documented `<aside>` and a raw `<strong>` rather
  than `.gat-callout__lead` — i.e. it predates the `__lead` slot. New markup
  should follow the current DS documentation (`<aside>` + `.gat-callout__lead`)
  since that is the officially recommended, most current pattern; this is a
  cosmetic divergence from the one existing in-app example, not a functional
  conflict.
- Existing `mailto:florian.motlik@gruene.at` markup (header nav and the old
  `.app-beta-hinweis` paragraph) — reuse verbatim for the callout's contact
  line.

### Potential Conflicts

- None found. No JS reads or queries `.app-beta-hinweis` or `#doc-manager`'s
  preceding siblings by selector; `app.js` only ever touches `#doc-manager`
  and `#doc-manager-count` directly (confirmed via grep across `web/js/app.js`).
- No Playwright test currently locates the H1 by exact text or the beta
  paragraph by class — confirmed via grep across all 20 spec files.
  No visual-regression/screenshot tests exist in the repo (`test:e2e` uses
  Playwright with no `toHaveScreenshot`/`toMatchSnapshot` calls anywhere).
  Text/markup changes described here cannot break an existing test.

## Standard Stack

| Library | Version | Purpose | Why Standard | Confidence |
|---------|---------|---------|---------------|------------|
| `design-system.css` (Die Gruenen DS) | latest (unpinned, loaded via `<link>` from `https://design-system.gruene.at/design-system.css`) | `.gat-callout`, `.gat-stoerer`, `.gat-headline`/`.gat-hero` | Already the app's only styling dependency for these component families; CLAUDE.md forbids vendoring/hand-rolling equivalents | HIGH (verified by fetching the live stylesheet) |

No new library, package, or CDN reference is needed for this issue.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `<aside class="gat-callout gat-callout--warn">` | `<div class="gat-callout">` (matches existing in-app usage at index.html:689) | `<div>` is what this app already has once; `<aside>` is what the DS's own docs currently recommend and is more semantically correct for an aside note. Prefer `<aside>` for the new addition — going forward, not retrofitting the older usage (out of scope for this issue). |
| `— Beta` text appended to the H1 | `<span class="gat-stoerer gat-stoerer--magenta">` next to the H1 (a second, larger Stoerer) | Plain text is simpler, has no sizing/rotation edge cases to get right next to a large `--gat-text-h1` heading, is trivially testable by string match, and is literally the first example the issue text gives ("Gemeindebudget auswerten — Beta"). A second large rotated Stoerer risks looking redundant with the existing header Stoerer and needs new local CSS to size correctly (base `.gat-stoerer` sets no `font-size`, it would inherit the H1's huge font-size unless capped) — that is exactly the kind of "Eigenbau" the constraints want to avoid. |
| Reusing `.gat-tag`/`.gat-tag--warn` for the H1 badge | — | `.gat-tag` is a small (`0.85rem`) status-pill built for table cells ("geprüft"/"offen"), not sized for "gross, nicht zu uebersehen" next to an H1 — rejected. |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prominent warning/notice block | Custom `.beta-banner` CSS component | `.gat-callout.gat-callout--warn` (+ `.gat-callout__lead`) | Already ships colors, border, radius, spacing, print `break-inside:avoid`; matches CLAUDE.md's "kein Eigenbau" and the issue's own "Constraints" section |
| Eye-catching small badge | Custom rotated/colored `<span>` | `.gat-stoerer--magenta` (already in use at the logo) | Already exists in this exact app; do not invent a second badge component |
| Print-specific hiding of the hint | Bespoke `@media print` rule for the new callout | Nothing needed — leave it outside `.doc-manager`; DS already ships `break-inside:avoid` for all `.gat-callout` variants inside its own `@media print` | Zero new print CSS required; AC "darf im Druck nicht stoeren, aber auch nicht luegen" is satisfied by *not* adding it to the existing hide-list |

## Architecture Patterns

### Recommended Approach

1. In `web/index.html`, change the H1 to
   `<h1 class="gat-headline gat-hero__title">Gemeindebudget auswerten — Beta</h1>`.
2. Delete the `<p class="... app-beta-hinweis">...</p>` block.
3. Insert a new `<aside class="gat-callout gat-callout--warn">` as a sibling
   between `</header>` (closing `.gat-hero`) and `<div id="toast-box">`
   (i.e. still before `#doc-manager`, but outside both `.gat-hero` and
   `.doc-manager`). Content: what Beta means here (Ergebnisse pruefen, Parser
   kann irren) + the `florian.motlik@gruene.at` mailto contact, reusing the
   existing wording from the removed paragraph as the base text.
4. In `web/css/app.css`, remove the now-dead `.app-beta-hinweis` /
   `.app-beta-hinweis strong` rules (lines ~585-591). Leave
   `.app-beta-marker` and its `@media (max-width: 420px)` rule untouched.
5. No `web/js/app.js` change needed — nothing there references the removed
   paragraph or needs to know about the new callout.

### Anti-Patterns to Avoid

- **Putting the new callout inside `#doc-manager`:** would make it disappear
  whenever `aktualisiereDokVerwaltung()` collapses the `<details>` (i.e. as
  soon as one document is loaded) and would also make it vanish entirely in
  print (`.doc-manager { display: none !important }`). Directly violates
  AC "bleibt beim Arbeiten sichtbar" and "im Druck ... nicht luegen".
- **Adding the callout to the existing print hide-list:** would hide the beta
  disclosure from printed reports entirely — AC explicitly forbids that
  ("aber auch nicht luegen").
- **Inventing a second Stoerer/badge component for the H1:** unnecessary
  Eigenbau; plain text suffix already satisfies the AC and the issue's own
  suggested wording.
- **Using `role="alert"`/`aria-live` on the callout:** it is static content
  present at page load, not a dynamically-injected notification — the
  existing `#toast-box` already owns that role for transient messages; do not
  conflate the two.

## Common Pitfalls

### "Beiden Farbmodi" does not map to an existing feature

**What goes wrong:** AC 4 says "Hinweis funktioniert in beiden Farbmodi ...
sinnvoll", implying two color modes exist app-wide (e.g. light/dark or a
contrast toggle) that the new callout must be verified against.

**Why it happens:** This app *used to* have a high-contrast mode
(`.gat-mode-hc`, `#hc-toggle`, `gat-header__a11y-toggle`) — confirmed via
`git log`: it was deliberately removed in commit `bc1da4b`
("chore(web): kontrast-system aus dem header entfernen (#24)"), which also
deleted `tests/e2e/hc-toggle.spec.mjs` and dropped the chart-theme picker from
four options to three (Standard/Druckfreundlich/Barrierefrei). There is no
`prefers-color-scheme` media query anywhere in the DS stylesheet either
(checked directly — zero matches). The app currently has exactly one page
color mode.

**How to avoid:** Treat "beiden Farbmodi" as **not currently actionable** —
there is nothing to verify beyond default rendering, because there is only
one mode. Do not resurrect the removed HC toggle to satisfy this AC; that
would be significant, unrequested scope creep and directly contradicts the
"chore: kontrast-system entfernen" decision already made in this repo. The
closest legitimate interpretation is the three chart-color themes
(Standard/Druckfreundlich/Barrierefrei via `#theme-picker`), but those only
affect ECharts canvases, never page-level callouts — `.gat-callout--warn`'s
colors are DS tokens unrelated to `chart-themes.js`. Recommended plan-time
resolution: verify the callout renders correctly (readable contrast) using
only the DS `--gat-web-callout-warn-*` tokens as-is (they already pass the
DS's own WCAG-AA color-pair auditing per `docs/web-design-system.md`), note
in the plan that this AC is satisfied by construction (single color mode, DS
tokens), and flag to the user that "beiden Farbmodi" may be stale text
carried over from before commit `bc1da4b`.

**Warning signs:** If a task in the plan proposes adding `prefers-color-scheme`
handling or reintroducing an HC toggle, that is scope creep beyond this issue
— flag for confirmation before implementing.

### Placement relative to `#doc-manager`'s dynamic `open` state

**What goes wrong:** If the new callout is placed as a child of
`.doc-manager-body` (which would be a natural-looking "oberhalb der
Dokumentenliste, aber innerhalb der Box" reading), it collapses out of view
the moment a document loads, because `aktualisiereDokVerwaltung()` sets
`manager.open = anzahl === 0`.

**Why it happens:** The issue says "Oberhalb der Dokumentverwaltung" which is
ambiguous between "above, outside the box" and "above, inside the box, above
the document list". Only the former satisfies AC 4 ("bleibt sichtbar,
wandert nicht aus dem Blick").

**How to avoid:** Place the `<aside>` as a page-level sibling *before* (not
inside) `<details id="doc-manager">` — confirmed correct by reading both the
markup and `app.js`'s two call sites that toggle `.open`.

**Warning signs:** A visual check with a fixture PDF loaded (`ladeFixturePdf`
in `tests/e2e/helpers.mjs`) — the callout must still be visible right after
`#doc-manager` auto-collapses.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| `design-system.css` (CDN) | `.gat-callout`, `.gat-stoerer`, `.gat-hero`/`.gat-headline` | Yes — already linked in `web/index.html:<head>`, fetched and verified live during this research | latest (unpinned) | None needed; app has no offline target per CLAUDE.md |
| Node/npm (Playwright) | `npm run test:e2e` | Not probed in this pass (no code changes require new tooling); repo's own CI/Makefile already runs these | — | — |

No new environment dependency is introduced by this issue.

## Project Constraints (from CLAUDE.md)

From `/Users/florianmotlik/Code/GrueneAT/web-apps/gemeindefinanzen/CLAUDE.md`
and the workspace-wide `/Users/florianmotlik/Code/GrueneAT/web-apps/CLAUDE.md`
(both apply; the app-specific file is stricter/more specific where they
overlap):

- **Worktree-only work.** All changes happen in this worktree
  (`.worktrees/s290j-...`), never on the shared `main` checkout. Already the
  case for this research session.
- **No vendoring, no offline target.** `design-system.css` stays a CDN
  `<link>`, never copied into the repo. This issue introduces nothing new to
  vendor.
- **Vanilla JS / ESM, no build step** for `web/`. This change touches only
  `.html`/`.css`, so this constraint isn't even exercised, but any executor
  touching `web/js/app.js` must keep that in mind (not needed for this issue
  per this research).
- **German UI text, English identifiers/commits.** The new callout copy and
  the H1 suffix stay German ("— Beta", Beta-Hinweis-Text); any new CSS class
  names (if ever needed — none are, per this research) would stay English.
- **No tool attribution** in commits, code, or comments — no "claude",
  "Generated with", `Co-Authored-By` tags anywhere.
- **Tests must stay green:** `npm run test:js`, `PYTHONPATH=src pytest -q`,
  `ruff check src tests`, `mypy src` — none of these are expected to be
  affected by an HTML/CSS-only change, but `npm run test:e2e` should be run
  to confirm (no existing test currently targets the changed markup, per
  research above, so a pass is the expected/likely outcome).
- **Conventional Commit format**, per the issue's own "Constraints" section
  (`DS-Callout statt Eigenbau; kein Vendoring` — both satisfied by the
  recommended approach above).

## Sources

### HIGH confidence
- Direct codebase reads: `web/index.html`, `web/css/app.css`, `web/js/app.js`,
  `playwright.config.mjs`, all 20 files under `tests/e2e/`, `tests/e2e/helpers.mjs`.
- `git log` on `web/index.html`, `web/css/app.css`, `web/js/app.js` (recency,
  and the `bc1da4b` HC-toggle-removal commit + its full diff).
- Live fetch of `https://design-system.gruene.at/design-system.css` via
  `curl` (72,909 bytes) — all `.gat-callout*`, `.gat-stoerer*`, `.gat-tag*`,
  `.gat-hero*`, `.gat-headline` rules and the `@media print` block quoted
  above were extracted directly from this fetched stylesheet, not from
  training-data recall.
- Local checkout of the design-system's own documentation page
  (`design-system/design-system/index.html` in the workspace, sibling repo)
  for canonical `<aside class="gat-callout ...">` markup examples and the
  `gat-stoerer`/`gat-callout` "requires" metadata.
- `issue-cli`'s own `validate_research_output()` (read directly from
  `/usr/local/lib/python3.13/dist-packages/issue/validation.py`) — confirms
  the exact gate this file must pass (`RESEARCH.md` exists, ≥500 bytes,
  contains `<interfaces>`; `RESEARCH.html` absence is WARN-only).

### MEDIUM confidence
- None — no claim in this document rests solely on a web search or a single
  unverified source.

### LOW confidence (needs validation)
- The intended meaning of "beiden Farbmodi" in AC 4 — see Pitfalls above.
  This is a genuine ambiguity in the issue text itself, not a research gap;
  flagging for the planner/user rather than guessing further.

## Metadata

**Confidence breakdown:**
- Codebase: HIGH — every claim traced to a direct file read, grep, or
  `git log` call in this exact worktree.
- Standard Stack / DS components: HIGH — verified against the live,
  currently-served `design-system.css`, not training-data assumptions.
- Architecture / placement recommendation: HIGH — derived directly from
  reading `aktualisiereDokVerwaltung()` and the print `@media` block, not
  inferred.
- "Beiden Farbmodi" AC: LOW / open question — the feature it would refer to
  was intentionally removed from this app; flagged rather than resolved.

**Research date:** 2026-08-26
**Sub-agents used:** None spawned as separate processes — the issue is a
single-surface HTML/CSS change (one page, two files, no new dependency), so
the orchestrator performed codebase, ecosystem (DS component verification
via live fetch), and pitfalls (print/test/doc-manager-state) research
directly in one pass rather than dispatching parallel specialists. All
findings above are HIGH confidence and independently source-tagged, so this
does not reduce research quality for this scope.
**Raw research files:** none written under `research/` — see note above; all
findings are inlined in this document with sources cited per section.
