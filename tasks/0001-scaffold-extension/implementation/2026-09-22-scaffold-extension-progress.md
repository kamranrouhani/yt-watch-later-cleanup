# Progress: 2026-09-22-scaffold-extension

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

## 2026-09-22 23:09  Step 1: Branch

Worked: `feature/0001-scaffold-extension` from `main` at 7075347, which was
level with `origin/main`.
Verification: `git pull --ff-only` printed `Already up to date.`
Next: step 2, package.json and install.

## 2026-09-22 23:10  Step 2: package.json and install

Worked: package.json as planned, `npm install` added 2 packages, 0
vulnerabilities, lockfile written.
Found: the `^1.56.0` range resolved to Playwright 1.63.0, newer than the
scratch run. Its own default Chromium is not the installed one, which is
what the pinned `executablePath` in the browser test is for.
Verification: `npx playwright --version` printed `Version 1.63.0`.
Next: step 3, failing wrapper tests.

## 2026-09-22 23:11  Step 3: Failing tests for the core wrapper

Worked: `test/core-wrapper.test.js` as planned. It fails for the right
reason, `constants.js` does not exist.
Did not match the plan: the plan expected 4 failures with `Cannot find
module`. The top level `readFileSync` throws `ENOENT` while the file loads,
so node reports the whole file as one failure before any test registers.
Same cause, different shape. Test file left as planned.
Verification: `npm test` printed `not ok 1 - test/core-wrapper.test.js`,
`# tests 1`, `# fail 1`, error `ENOENT ... src/core/constants.js`.
Next: step 4, constants.js.

## 2026-09-22 23:12  Step 4: The first core module

Worked: `src/core/constants.js` with the WLCore wrapper, as planned.
Verification: `npm test` printed `# tests 4`, `# pass 4`, `# fail 0`.
Next: step 5, failing manifest tests.

## 2026-09-22 23:14  Step 5: Failing tests for the manifest and dashboard wiring

Worked: `test/manifest.test.js` as planned, failing on the missing manifest.
Same file level shape as step 3: the top level read throws, so node counts
one failed file rather than 5 failed tests.
Verification: `npm test` printed `Error: ENOENT ... manifest.json`,
`not ok 2 - test/manifest.test.js`, `# tests 5`, `# pass 4`, `# fail 1`.
Next: step 6, manifest, background, dashboard.

## 2026-09-22 23:15  Step 6: Manifest, background, dashboard

Worked: the five files as planned. Committed with the wrapper work in two
code commits, runner and wrapper first, manifest and dashboard second.
Verification: `npm test` printed `# tests 9`, `# pass 9`, `# fail 0`. The
issue's check `python3 -c "import json; json.load(open('manifest.json'))"`
printed nothing and exited 0.
Next: step 7, syntax check script.

## 2026-09-22 23:17  Step 7: Syntax check script

Worked: `scripts/check-syntax.js` as planned.
Verification: `npm run check` printed `all files parse`, exit 0. A stray `{`
appended to `dashboard/dashboard.js` gave `SYNTAX FAIL:
dashboard/dashboard.js`, exit 1, restored. Also truncated `manifest.json` to
`{"manifest_version": 3,` which gave `JSON FAIL: manifest.json: Expected
double-quoted property name in JSON at position 23`, restored. Clean again
after both.
Next: step 8, real browser load test.

## 2026-09-22 23:24  Step 8: Real browser load test

Worked: `test/browser/load.spec.js` as planned, in the pinned Chromium 1223.
Verification: `npm run test:browser` printed `ok extension
cbjglemamighafmpnnceliglkikndcpf loaded, dashboard rendered, no errors`.
Bites: `dashboard.js` replaced with `WLCore.nope.boom();` gave
`AssertionError [ERR_ASSERTION]: dashboard.js did not run`. Guarding the
`addListener` call behind `hasListeners() &&` so it never registers gave
`AssertionError [ERR_ASSERTION]: toolbar click listener is not registered`.
Both restored with `git checkout`.
Separation: `npm test` still `# tests 9`, `# pass 9`, and
`ps -eo comm | grep -c '^chrome$'` printed 0 after it.

Added beyond the plan: the plan's test only proves a listener is registered,
not that it opens the dashboard. Moved the handler into a named
`openDashboard` in `background.js` and made the test call it twice from the
service worker, then count dashboard tabs. First run failed with
`ReferenceError: openDashboard is not defined`, as it should. After the
change: `ok toolbar handler opens one dashboard tab and refocuses it`.
Replacing `if (existing)` with `if (false)` gave `actual: 2, expected: 1`,
restored.
Did not work: my first attempt to rewrite `background.js` was refused by the
editor as stale after the earlier sed and checkout, so that browser run was
still against the old file. Redid it as a patch and reran.

Also run: a scratch Playwright script (not committed) that read the
extension through `chrome.developerPrivate.getExtensionInfo`. It printed
`"state":"ENABLED","manifestErrors":[],"runtimeErrors":[],"warnings":[]`.
Screenshots of the dashboard and the chrome://extensions detail page look
right. Found: the detail page reports Size 17.9 MB because `node_modules/`
(Playwright, 17 MB) sits inside the unpacked root. It loads fine, but a
packaged build must exclude it. Not in scope for #1, noted for a follow-up.
Next: step 9, CI.

## 2026-09-22 23:12  Correction: timestamps

Did not work: the entries for steps 5, 6, 7 and 8 above carry times I
estimated instead of taking from `date`, and they run ahead of the clock
(23:14 to 23:24 against a real `date` of 23:12 at this point). The order of
the entries is right, the times are not. Left as written because the log is
append only. Every entry from here takes its time from `date`.

## 2026-09-22 23:12  Step 9: CI

Worked: `.github/workflows/ci.yml` as planned.
Verification: simulated the CI steps in a clean `git worktree` of HEAD
under the scratch dir: `npm ci` printed `found 0 vulnerabilities`,
`npm run check` printed `all files parse`, `npm test` printed `# tests 9`,
`# pass 9`, `# fail 0`. The real run is on the PR.
Next: step 10, docs.

## 2026-09-22 23:12  Step 10: Docs

Worked: CONTRIBUTING lists `npm run check`, describes the browser test as
what it does today, and says how `WL_CHROME` overrides the pinned binary.
README has a "Try it" section with the load unpacked steps and says the
dashboard is empty for now.
Verification: `npm run test:all` printed `all files parse`, `# pass 9`,
`# fail 0`, and both `ok` lines from the browser test, exit 0.
Next: step 11, manual checklist, review, push, PR.

## 2026-09-22 23:13  Step 11: Verify, push, PR, CI, review, merge

Worked: pre-push checks clean (identity, attribution, dashes, secrets,
comments, no `tasks/` in code commits). Pushed the branch, opened PR #23.
CI run 35796324136 passed in 7s, its log shows `all files parse`,
`# tests 9`, `# pass 9`, `# fail 0`. Manual checklist written to
`implementation/manual-check.md`. Review written to
`reviews/2026-09-22-2313-pre-merge.md`, nothing blocking.
Next: commit task files, merge with a merge commit, close out.
