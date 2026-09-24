# Progress: 2026-09-24-ensuretab-ready

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

## 2026-09-24 04:55  Step 1: Plan

Worked: plan and this log, from main at 6acc848.
Next: step 2, unit tests first.

## 2026-09-24 05:05  Step 2: Unit tests first

Worked: added `test/tabbridge.test.js` cases for a freshly created tab
with no receiver yet, a reused tab not yet ready, a Watch Later tab with
extra query parameters, and a non-Watch-Later tab never picked. Ran them
against the unmodified `ensureTab()`: 4 of 12 failed for the expected
reasons (no wait on readiness, exact-URL match missing the query-parameter
case).
Verification: `node --test test/tabbridge.test.js` `# pass 8` `# fail 4`.
Next: step 3, implement the fix in `src/core/tabBridge.js`.

## 2026-09-24 05:20  Step 3: `src/core/tabBridge.js`, readiness probe v1

Worked: added `isWatchLaterUrl()` (parsed `URL`, matches hostname,
pathname, `list=WL`) and a poll loop that sent an empty message
(`chromeApi.tabs.sendMessage(tabId, {})`) and treated a non-throwing
result as ready. All 12 unit tests passed; bit the readiness wait (skipped
it) and 3 tests correctly went red; bit the URL match (`&& false`) and 5
went red.
Verification: `npm test` `# pass 145` `# fail 0`; `npm run check`
`all files parse`.
Next: step 4, browser spec.

## 2026-09-24 05:32  External review: probe does not reach page.js

Did not work: an external review of the plan and code found that the
empty-message probe only proves `content/bridge.js`'s
`chrome.runtime.onMessage` listener is registered, not that
`content/page.js` has the nonce from the `hello` handshake yet. Before the
nonce is set, `page.js` line 66 silently drops every real request, so
`ensureTab()` could resolve before a real call would actually get an
answer. Confirmed by reading `content/page.js`: the nonce check gates
`handleRequest` entirely, and there is no separate "listener attached"
signal from that world.
Wrote a superseding plan,
`plans/2026-09-24-1-ensuretab-ready-e2e-probe.md`, replacing the probe
with a real `wlRequest` (`kind: '__wlReadyProbe'`) that only gets a
`wlResponse` once `page.js` is actually running `handleRequest`, which
requires the nonce. `content/bridge.js` and `content/page.js` need no
changes: an unknown `kind` already produces an error response through the
existing path.
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
Next: step 4, browser spec close-then-reconnect case.

## 2026-09-24 05:45  Step 4: `test/browser/bridge.spec.js`

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
Next: step 5, manual checklist, review, PR.

