# ensureTab waits for the tab to answer

- **Issue:** #33
- **Branch:** `fix/0033-ensuretab-ready`
- **Written:** 2026-09-24 04:55, on `main` at `6acc848`
- **Supersedes:** nothing

## Goal

`ensureTab()` in `src/core/tabBridge.js` resolves only once the tab's content
script is actually listening, and finds an already-open Watch Later tab even
when its URL carries extra query parameters.

## Decisions

- **Readiness probe, not a protocol change.** `content/bridge.js` already
  registers a `chrome.runtime.onMessage` listener that returns `false` for
  any message without `wlRequest: true`. In the real extension messaging
  model, `chrome.tabs.sendMessage` rejects with "Could not establish
  connection. Receiving end does not exist." only when no listener is
  registered at all, and resolves once one is, regardless of what that
  listener does with the message. So `ensureTab()` can probe readiness with
  an empty message (`{}`) that the existing listener silently ignores, and
  use success or failure of that call as the signal. No change needed to
  `content/bridge.js` or `content/page.js`.
- **Poll until ready or timeout.** `ensureTab()` finds or creates the tab,
  sets `connectedTabId`, then polls the probe on an interval (`readyPollMs`,
  default 50 ms, configurable like `timeoutMs`) until it succeeds or the
  overall `timeoutMs` deadline passes. On timeout it clears
  `connectedTabId` and rejects with `TimeoutError`. Same wait applies
  whether the tab was found or just created.
- **Watch Later matching by parsed URL, not exact string.** Query
  `chrome.tabs.query({ url: 'https://www.youtube.com/playlist*' })` to stay
  within the existing `tabs` permission scope, then filter with `new URL()`:
  hostname `www.youtube.com`, pathname `/playlist`, `list` search param
  exactly `WL`. This reuses an existing tab with extra parameters
  (`&index=`, `&pp=`) and never matches another playlist or the home page.
- **Test harness change.** `test/tabbridge.test.js`'s fake chrome gains a
  per-tab `ready` flag (default `true` for tabs passed in directly, so
  existing tests are unaffected) and a `createReady` option for
  `tabs.create` (default `true`). `sendMessage` throws the real Chrome
  wording when the target tab is missing or not ready. `markReady(id)` flips
  a tab ready after the fact, to simulate a content script attaching once
  the page finishes loading. `query` gains simple `*`-suffix pattern
  matching so the new query pattern works the same way it would in Chrome.
- **Browser spec.** After the existing "tab closed mid request" case,
  `ensureTab()` is called again against no open Watch Later tab; assert a
  fresh tab is created and a ping through it succeeds.

## Steps

### Step 1: Plan

This file and a seeded progress log, one commit.

### Step 2: Unit tests first

New tests in `test/tabbridge.test.js` for: a freshly created tab has no
receiver until it loads and today's `ensureTab()` would hand `request()` a
tab that immediately fails; a reused tab that is not yet ready is waited on
the same way; `ensureTab()` rejects `TimeoutError` when the tab never
answers; a Watch Later tab with extra query parameters is reused with no
second tab opened; a tab that is not Watch Later (another playlist, the
home page) is never picked. Expect these tests to fail against the current
`ensureTab()`.

### Step 3: `src/core/tabBridge.js`

Add the readiness probe and poll loop, and the parsed-URL match. Bites to
check: probe messages counted as real requests would break the existing
message-count assertions; not resetting `connectedTabId` on timeout would
leave `request()` pointed at a tab that never answered.

### Step 4: `test/browser/bridge.spec.js`

Add the close-then-reconnect case: close the tab, `ensureTab()` again,
`ping` succeeds against the freshly created tab.

### Step 5: Manual checklist, review, PR, merge, close out

Rerun step 5 of the #11 manual checklist (with the tab closed, `ensureTab()`
opens a new one and the ping works), written as a step in this task's
`implementation/manual-check.md` for Kamran to run signed in.

## Acceptance, from the issue

| Box | How it is shown |
|---|---|
| unit test reproduces the reported failure first | new tabbridge.test.js case with a not-yet-ready freshly created tab |
| `ensureTab()` resolves only once the content script can answer, reused and new | readiness-wait tests for both paths |
| rejects `TimeoutError` if it never answers | timeout test with a tab that never becomes ready |
| a Watch Later tab with extra query parameters is reused | query-parameter test |
| a tab that is not Watch Later is never picked | other-playlist and home-page test |
| browser spec: close the tab, `ensureTab()` again, ping succeeds | new block in bridge.spec.js |
| #11 manual checklist step 5 rerun or a new manual step | implementation/manual-check.md |

## Out of scope

`content/bridge.js`, `content/page.js` (no protocol change needed), #24, #6.
