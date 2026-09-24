# Progress: 2026-09-24-shipped-build

Append only. One entry at the end of every plan step. Never rewrite, reorder
or delete an entry, including the ones recording a mistake.

Entry shape:

    ## YYYY-MM-DD HH:MM  Step N: <step name as the plan writes it>

    Worked: <what landed>
    Did not work: <what was tried and failed, and why. Omit only if nothing failed>
    Verification: <command and what it actually printed>
    Next: <next step>

Take the timestamp from `date '+%Y-%m-%d %H:%M'`.

<!-- append entries below this line -->

## 2026-09-24 06:23  Step 1: Plan

Worked: plan and this log, from main at d3aa3be.
Next: step 2, shared shipped-file list.

## 2026-09-24 06:35  Step 2: Shared shipped-file list

Worked: added `scripts/shipped-files.js`, deriving the shipped set from
`manifest.json` plus `background.js`, `manifest.json` itself, and
`dashboard/`, `src/`, `content/`. Pointed `test/helpers/no-network-scan.js`
at it instead of its own hardcoded `SHIPPED`/`SHIPPED_DIRS`. Added a new
`test/no-network.test.js` case proving the scan now covers `content/`
(planted a stray `fetch()` in `content/bridge.js`, asserted it is caught).
Did not work: the shared module at first omitted `background.js` from
`EXTRA_SHIPPED`, since it looked reachable only through
`manifest.background.service_worker`, but the manifest fixtures the
existing no-network tests build often use `{}` or omit `background`, so
three tests that assert on `background.js` violations went from passing to
silently finding nothing. Added `background.js` to `EXTRA_SHIPPED`
explicitly, matching what the old hardcoded list already did.
Proved the new content test can fail: removed `content` from
`EXTRA_SHIPPED_DIRS`, the new test went red with an empty violations array
instead of the expected one, restored it and reran green.
Verification: `npm run check` -> `all files parse`; `npm test` ->
`# pass 149` `# fail 0`.
Next: step 3, build script.

## 2026-09-24 06:50  Step 3: Build script

Worked: added `scripts/build.js` with `buildDist()`, using
`shippedFiles()` to copy the shipped set into `dist/` (rebuilt fresh each
run). Added the `build` npm script.
Verification: `npm run build` -> `built 17 files into dist`; `du -sh dist`
-> `96K`; `find dist -type f` lists exactly `background.js`,
`manifest.json`, `content/{bridge,page}.js`, `dashboard/*`, `src/core/*`,
nothing from `test/`, `tasks/`, `reference/` or `node_modules/`.
Next: step 4, build test.

## 2026-09-24 07:00  Step 4: Build test

Worked: added `test/build.test.js`: one test asserting the build has no
top-level `node_modules`, `test`, `tasks` or `reference` entry and does
include `manifest.json` and `background.js`; one test planting both a
`node_modules/playwright/index.js` and a `tasks/0024-shipped-build/notes.md`
file directly in a build directory and asserting the forbidden-directory
check catches both.
Proved the first test can fail: temporarily added `test` to
`EXTRA_SHIPPED_DIRS` in `scripts/shipped-files.js`, `npm run build` then
copied `test/build.test.js` itself into `dist/`, and the "no dev
directories" test went red; restored the array and reran green.
Verification: `node --test test/build.test.js` -> `# pass 2` `# fail 0`;
full `npm run check && npm run build && npm test` -> `all files parse`,
`built 17 files into dist`, `# pass 151` `# fail 0` (one run showed the
known `test/remover.test.js:175` timing flake unrelated to this change,
already logged against #33; a rerun passed clean).
Next: step 5, exercise it.

## 2026-09-24 07:10  Step 5: Exercise it

Worked: ran a one-off Playwright script pointed at `dist/` (not committed,
matching the plan's "or a one-off run pasted into the PR"): loaded the
built extension in headless Chrome, confirmed the toolbar click listener is
registered, the dashboard renders with the right title, `WLCore` loaded,
and no page or console errors.
Verification: `ok dist/ loaded in Chrome, extension id
iaohagjnggkhbalmaeikehpnpdmokfen, dashboard rendered, no errors`.
Next: step 6, docs.

## 2026-09-24 07:15  Step 6: Docs

Worked: updated README "Try it" and CONTRIBUTING "Loading the extension" to
run `npm run build` first and load `dist/` instead of the repository root.
Next: step 7, review, PR, hand off.
