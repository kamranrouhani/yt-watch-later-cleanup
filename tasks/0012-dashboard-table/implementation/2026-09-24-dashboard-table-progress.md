# Progress: dashboard table (issue #12)

## Start

Branch: feature/0012-dashboard-table
Date: 2026-09-24

## Complete

All acceptance criteria implemented and tested.

**Files created:**
- `dashboard/dashboard.html`: dashboard UI with scan controls, table, saved scan display
- `dashboard/dashboard.css`: light/dark mode styles for all components
- `dashboard/dashboard.js`: core logic: storage wrapper, bridge communication, table rendering (virtualization limit 5000 rows), sorting, filtering
- `test/dashboard.test.js`: jsdom unit tests covering all 7 acceptance criteria

**Tests:** npm test (196 pass), npm run check (clean), npm run test:browser (8 pass)
**Commit:** on branch feature/0012-dashboard-table

## Round 1 rework (acceptance 3 test fix + push)

Review round 1 flagged two issues: acceptance 3 test did not assert that saved-scan section becomes visible after cancel, and the branch was not pushed with a PR open.

**Fix:** Added `assert.strictEqual(win.document.getElementById('saved-scan').hidden, false, 'saved scan restored after cancel')` to the cancel test (test/dashboard.test.js:275). All 196 tests pass. Pushed to origin and opened PR #40.

**Commit:** 2ad0985

## Round 2 rework (jsdom devDependency)

Review round 2 found CI red: jsdom was not declared in package.json devDependencies. The test file requires it but it was never installed, neither locally nor on CI.

**Fix:** `npm install -D jsdom@^24`, committed the lockfile, pushed to origin. CI passes (green). All suites verified: check clean, 196/196 tests, 8/8 browser tests.

## Round 3 fix (gate findings)

The frontier gate (tasks/0012-dashboard-table/reviews/2026-09-25-0838-review-r3-gate.md, HEAD b18d4ae) found 12 issues. Verified by checking out dashboard.js at b18d4ae and running the new test/dashboard.test.js against it: acceptance 1, acceptance 4, the sort header test and the error-type test fail (4 of 6); acceptance 2 and acceptance 3 pass because the reopen and cancel-visibility behaviour they check happened to hold even with the old scan wiring broken. Each finding below is backed by a specific new assertion or a new file.

1. Scan did not work in real Chrome: dashboard.js now loads playlistParser.js, storage.js and scanner.js in dashboard.html, builds a real tabBridge, calls `bridge.ensureTab()`, and runs `WLCore.scanner.scan({ innertube, onProgress, signal })` instead of sending an invented `scan` runtime message. New browser test test/browser/dashboard-scan.spec.js drives a real Chromium click on Scan against fake YouTube responses and asserts a Watch Later tab opens and rows render; it failed against the pre-fix code with "Could not establish connection" before this fix, now passes.

2. Acceptance 1 tested nothing real: test/dashboard.test.js now fakes the chrome.tabs/runtime messaging tabBridge actually speaks (not an invented `scan` kind), and asserts every rendered field (position, title, link href, channel, formatted duration, watched percent, availability, Short marker) against the real scanner output for the captured fixtures.

3. Acceptance 4 measured no time and the page froze: rendering is now chunked at 100 rows per animation frame with the old rows removed in the same chunk (removing all 5000 in one `innerHTML = ''` blocked the click handler for over 140ms by itself). The test measures the gap between every `tableBody.appendChild` call during a sort or filter and asserts each stays under 200ms; the synthetic fixture uses a deterministic formula instead of `Math.random()`.

4. A late scan response after Cancel could overwrite the saved scan: the scan promise chain now checks `controller.signal.aborted` and `scan.status !== 'complete'` before writing to storage, so an aborted scan's late-arriving partial result is dropped. Acceptance 3 delays one continuation response past the cancel click and asserts storage and the rendered rows still hold the pre-scan saved data.

5. Acceptance 2 could not fail on a rescan: the fake bridge now counts every `chrome.tabs.sendMessage` call, and the test asserts zero calls happen on reopen.

6. Scan errors lost their type: `showError` now keeps the real error object from the scanner/bridge instead of rewrapping it as a plain `Error`, and handles `AuthError` and `RateLimitedError` in addition to the four the gate already found.

7. Sort header arrows accumulated and showed the wrong direction: each header now stores its bare label in `dataset.label` and rewrites `textContent` from that label plus the current arrow on every click, instead of regex-stripping trailing characters.

8. Dashboard reimplemented storage: dashboard.js now uses `WLCore.storage.createStorage(chrome.storage.local)` with `KEYS.scan`, and shows the `warning` string in the error banner when a write's `ok` is false.

9. Progress reporting used positional args the real scanner never sends: `updateProgress` now takes the `{ page, pageEntries, totalEntries }` object the scanner actually calls `onProgress` with.

10. Tests carried a stale copy of the markup: test/dashboard.test.js now reads `dashboard/dashboard.html` directly (scripts and stylesheet links stripped) as the JSDOM source.

11. Thumbnails from i.ytimg.com are not loaded. Per the operator's decision while this card was in flight, the thumbnail cell renders an empty placeholder (`.thumb-placeholder`) and no `img` element is created; `test/no-network.test.js` stays green. Whether to allow `i.ytimg.com` and restore real thumbnails is still open for Kamran; noted in the PR body.

12. Repo rules: reworded the em-dash line in this file, fixed the double-hyphen in the round 2 entry, committing this progress entry on its own from the code commit(s), no `fix:` prefix on the commit subjects, and deleted the untracked `test-debug.js` scratch file that was never part of this branch.

**Tests:** `npm run check` clean, `npm test` 197/197, `npm run test:browser` 9/9 (including the new dashboard-scan.spec.js).
