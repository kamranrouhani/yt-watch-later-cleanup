# Progress: 2026-09-24-1-ensuretab-ready-e2e-probe

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

## 2026-09-24 05:32  Step 1: end-to-end readiness probe

Worked: replaced the empty-message probe with a real `wlRequest`
(`kind: '__wlReadyProbe'`), which only gets a `wlResponse` once
`content/page.js` is running `handleRequest`, which requires the nonce.
`content/bridge.js` and `content/page.js` need no changes: an unknown
`kind` already produces an error response through the existing path.
Rewrote the `test/tabbridge.test.js` fake chrome to a three-stage
`contentState` (`none`, `listening`, `ready`) matching what
`sendMessage` actually does at each real stage, and added two tests that
specifically catch a probe that only checks whether `sendMessage` throws.
Fixed a busy-loop bug in the new `probeOnce()`: the pending-map delete
raced against the timer over the same promise settlement without a
`settled` guard, so a probe against a tab with `contentState: 'none'`
resolved (falsely) as soon as `sendMessage` rejected, without pacing by
`readyPollMs`, starving the event loop before the test's own timer flip
ran.
Verification: `node --test test/tabbridge.test.js` 5 consecutive runs,
`# pass 14` `# fail 0` each time; `npm test` 5 consecutive runs, `# pass
147` `# fail 0` each time; `npm run check` `all files parse`. Bit the real
probe back down to the empty-message version and reran:
`# pass 3` `# fail 11`, confirming the new tests do distinguish the two.
Next: step 2, browser spec close-then-reconnect case.

## 2026-09-24 05:45  Step 2: `test/browser/bridge.spec.js`

Did not work, twice: first attempt called `bridge.request('ping', null)`
right after `chrome.tabs.create` inside the dashboard's own
`page.evaluate`, closing the earlier tab first. It timed out at 30 s.
Second attempt tried `context.setOffline(true)` and a `CONSENT` cookie to
force the extension's own tab creation through the routed fake page; still
timed out. Debugging with `chrome.tabs.query({})` mid-failure showed the
new tab had navigated to `consent.youtube.com` on this host's real egress,
meaning Playwright's `context.route` never saw the tab's own first
navigation from `chrome.tabs.create` at all: it went straight to the real
network. This matches the known consent-redirect limit from the #11
capture work, but here it is the extension-initiated tab specifically that
escapes routing, not the routed dashboard-driven navigations used
elsewhere in this spec.
Worked: caught the new tab in Node with `context.waitForEvent('page')`
before awaiting `ensureTab()`, then drove that same tab's navigation with
`newPage.goto('https://www.youtube.com/playlist?list=WL')` from Node,
which Playwright does route through the fake page. `ensureTab()`'s
readiness polling then sees the injected content scripts once that
navigation completes, and the ping resolves. Added the case with a
comment stating why the harness needs the extra hop, since it is a real
constraint of this host, not a design choice.
Verification: `node test/browser/bridge.spec.js` five assertions all `ok`,
including "closing the tab then calling ensureTab again opens a fresh one
and ping succeeds"; `npm run test:browser` full run green, 8 `ok` lines
across `load.spec.js`, `bridge.spec.js`, `capture.spec.js`.
Next: step 3, manual checklist, review, PR.

## 2026-09-24 05:56  Step 3: manual checklist, self review

Worked: wrote `implementation/manual-check.md` rerunning #11's step 5
scenario plus the new query-parameter reuse case. Wrote the pre-merge
review to `reviews/2026-09-24-0555-pre-merge.md`: every acceptance box
mapped to its test, attribution check clean, no dashes, task files
committed separately from code (`41ea4ae` code, `a2666d7` tasks so far),
identity confirmed as Kamran Rouhani, plan freeze confirmed with
`git diff 5d09448 HEAD` on the original plan file (empty).
Verification: `npm test` and `npm run test:browser` both green, per the
review file's own verification section.
Next: push, open the PR, hand off for review.

## 2026-09-24 06:05  Round 1 review fix: closed tab no longer counts as ready

Did not work: review round 1 found that `probeOnce`'s pending entry
resolved `true` on any `reject`, meant to handle page.js's error reply to
an unknown probe kind. But `tabs.onRemoved` also calls `reject` on every
pending entry with a `TabGoneError`, so a tab closed while `ensureTab()`
is still waiting on readiness was reported as ready, with `connectedTabId`
already null. Added a test that closes the tab mid `waitUntilReady`: it
failed as expected against the unfixed code
(`AssertionError: Missing expected rejection (TabGoneError)`).
Worked: `probeOnce`'s `reject` now checks whether the error is a
`TabGoneError` and re-throws it through the outer promise instead of
resolving `true`; only a real page reply (an empty-arg `reject()` from the
message handler, or the probe's own timeout) counts toward readiness.
Removed the mock-narrating comment in `test/tabbridge.test.js`'s fake
`sendMessage`; the three content states are already documented in the
superseding plan.
Verification: `node --test test/tabbridge.test.js` `# pass 15` `# fail 0`
(new test included); `npm test` `# pass 148` `# fail 0`; `npm run check`
`all files parse`.
Next: push, request review round 2.
