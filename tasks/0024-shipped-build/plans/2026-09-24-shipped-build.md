# Keep dev files out of the loaded extension

- **Issue:** #24
- **Branch:** `feature/0024-shipped-build`
- **Written:** 2026-09-24 06:23, on `main` at `d3aa3be`
- **Supersedes:** nothing

## Goal

A build produces a folder (and optionally a zip) that contains only the
files the extension ships, so loading it unpacked in Chrome does not carry
`node_modules/`, `test/`, `tasks/` or `reference/`. A test fails if any of
those end up in the build.

## Decisions

- **One shared shipped-file list, not two.** `test/wiring.test.js` already
  reads `manifest.json` to know which files it references, and
  `test/helpers/no-network-scan.js` already hardcodes a shipped-file list
  for the no-network guard. Both lists can drift from each other and from
  reality. A new `scripts/shipped-files.js` becomes the one place that
  defines the shipped set: every path `manifest.json` references (mirroring
  `manifestPaths()` from `wiring.test.js`), plus `manifest.json` itself and
  the three directories the issue names as not yet fully covered by the
  manifest (`dashboard/`, `src/`, `content/`, since the dashboard loads
  scripts by relative path outside the manifest and `src/core/` files are
  referenced by other `src/core/` and `content/` files, not the manifest
  directly). `test/helpers/no-network-scan.js` is rewritten to import
  `shippedFiles()` from there instead of keeping its own copy.
- **`content/` joins the no-network scan's shipped set.** It ships today
  (`content/bridge.js`, `content/page.js` are both in `manifest.json`) but
  was never in `SHIPPED_DIRS`, so a stray `fetch()` in a content script
  would not have been caught. Widening the scan is deliberate: a new test
  in `test/no-network.test.js` proves a violation planted in `content/` is
  caught, the way existing tests prove it for `dashboard/` and
  `background.js`.
- **Build script is a plain copy, no zip.** `scripts/build.js` calls
  `shippedFiles()` and copies each file into `dist/` (already gitignored),
  preserving relative paths. No zip: the issue's acceptance boxes ask for
  "a load-unpacked or zip build", and the folder alone satisfies both
  ("only shipped files", "a test fails if it contains dev directories").
  Chrome also loads a zip via drag-and-drop without a separate pack step
  when one is wanted, so skipping a hand-rolled zip writer removes a chunk
  of unreviewed binary-format code for no acceptance-box benefit.
- **Test proves the build excludes dev files, not just that it includes
  shipped ones.** `test/build.test.js` builds into a temp directory and
  asserts no top-level entry is `node_modules`, `test`, `tasks` or
  `reference`, plus that `manifest.json` and `background.js` are present.
- **README and CONTRIBUTING "Try it" / "Loading the extension" point at
  `npm run build` and `dist/`** instead of the repository root.
- **Browser specs keep loading the repo root.** Changing `test/browser/*`
  to load `dist/` would mean building before every browser test run; the
  issue allows keeping the root and showing the built folder loads
  separately, which is cheaper and just as convincing.

## Steps

### Step 1: Plan

This file and a seeded progress log, one commit.

### Step 2: Shared shipped-file list

Add `scripts/shipped-files.js`, exporting `shippedFiles(root)` derived from
`manifest.json` plus the three directories above. Point
`test/helpers/no-network-scan.js` at it instead of its own list. Add a new
test case to `test/no-network.test.js` proving the scan now covers
`content/`, planting a stray `fetch()` there and asserting it is caught.
Prove the case can fail: comment out `content` in `EXTRA_SHIPPED_DIRS`,
watch the new test go red, restore it. Run `npm test` to confirm the whole
suite, including the existing no-network and wiring tests, is unaffected by
the shared list.

### Step 3: Build script

Add `scripts/build.js` using `shippedFiles()` to populate `dist/`. Add the
`build` npm script.

### Step 4: Build test

Add `test/build.test.js`: shipped files present, forbidden top-level
directories absent, and a test that plants a forbidden directory in a
build output and confirms it is caught.

### Step 5: Exercise it

Run `npm run build`, inspect `dist/` size and contents, load it with
`test/browser/load.spec.js` pointed at `dist/` via an environment variable
or a one-off script, take the output as PR evidence.

### Step 6: Docs

Update README "Try it" and CONTRIBUTING "Loading the extension" to build
first and load `dist/`.

### Step 7: Review, PR, hand off

Self review against `GOAL.md`, push, open the PR with `Closes #24` and the
acceptance evidence.

## Acceptance, from the issue

| Box | How it is shown |
|---|---|
| a documented way to produce a load-unpacked build with only shipped files | `npm run build` writes `dist/`, README and CONTRIBUTING point at it |
| a test fails if the build contains `node_modules/`, `test/`, `tasks/` or `reference/` | `test/build.test.js` |

Also shown: the built folder loads in Playwright Chrome with no errors, and
its size, both pasted into the PR from a real run.

## Out of scope

Packing a zip (folder is sufficient), changing what `test/browser/*.spec.js`
loads, #6, #7.
