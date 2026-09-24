# ensureTab waits for the tab to answer, take 2: end-to-end readiness probe

- **Issue:** #33
- **Branch:** `fix/0033-ensuretab-ready`
- **Written:** 2026-09-24 05:47, on `fix/0033-ensuretab-ready` at `5d09448`
- **Supersedes:** `2026-09-24-ensuretab-ready.md`. Everything there stands
  except the readiness probe mechanism.

## Why this supersedes the first plan

The first plan's readiness probe sent an empty message
(`chromeApi.tabs.sendMessage(tabId, {})`) and treated any non-throwing
result as ready. That only proves `content/bridge.js`'s
`chrome.runtime.onMessage` listener is registered, which happens as soon as
the isolated-world content script attaches. It does not prove
`content/page.js` (MAIN world) has received the `hello` handshake and
stored the nonce. Until it has, `page.js` line 66
(`if (!nonce || data.nonce !== nonce) return;`) silently drops every real
request. A real `ensureTab()` using the empty-message probe could resolve
while the page world is still mid-injection, and the first real
`request()` call would then hang until its own 30 s timeout with no
`TimeoutError` from `ensureTab()` to explain why.

Caught before it shipped: an external review of the plan and code (not a
test failure) pointed at `page.js`'s nonce gate and asked for proof the
probe reaches all the way through both worlds, or a probe that does.

## What changes

The readiness probe is now a real `wlRequest` message
(`kind: '__wlReadyProbe'`) sent through the same `request`/`response`
plumbing as every other call. `content/page.js` needs no new code: an
unknown `kind` reaches `handleRequest`, throws
`unknown request kind: __wlReadyProbe`, and the existing error path posts a
`response` back through the bridge. That response is exactly the signal
`ensureTab()` needs, because it can only arrive once the page world has the
nonce and is running `handleRequest` at all. Before the nonce is set,
`page.js` returns from its message listener without posting anything, so
the probe times out and `waitUntilReady` polls again. No protocol change,
no new file in the manifest, `content/bridge.js` and `content/page.js`
untouched.

The test harness in `test/tabbridge.test.js` models the actual three-stage
state a real tab goes through, matched to the outcome
`chromeApi.tabs.sendMessage` produces at each stage:

- `contentState: 'none'`: nothing injected yet.
  `sendMessage` rejects with "Could not establish connection.".
- `contentState: 'listening'`: `bridge.js` has attached and its listener
  exists, but `page.js` has not taken the nonce yet.
  `sendMessage` resolves (a receiver exists) but no `wlResponse` message
  ever arrives, because `page.js` drops the request silently.
- `contentState: 'ready'`: both worlds are up.
  `sendMessage` resolves and, for a probe, a `wlResponse` follows on a
  microtask, standing in for the error response `page.js` would really
  send.

Two new tests specifically distinguish `listening` from `ready`, so a
regression back to the empty-message probe (which only cares whether
`sendMessage` throws) fails them immediately.

`test/browser/bridge.spec.js`'s new close-then-reconnect case exercises
the real `content/page.js` and proves the round trip for real: the
reconnect ping only resolves once the routed fake page has actually
loaded and `__wlPage`/`__wlReady` are true in that tab, driven through
Node's `page.goto()` rather than `chrome.tabs.create`'s own navigation
(see the harness note in that file: `chrome.tabs.create`'s first
navigation is not observed by Playwright's `context.route` on this host,
so it would otherwise escape to the real network and hit
`consent.youtube.com`).

## Steps

Step 1 (this plan) replaces the original step 1 in effect but is filed as
a new entry, per the frozen-plan rule. Steps 2 to 5 from the first plan
proceed as written, with the readiness mechanism above in place of the
original's.

## Acceptance, from the issue

Unchanged from the first plan's table. The end-to-end probe is required to
meet "`ensureTab()` resolves only once the tab's content script can
answer": the first plan's probe proved only that a script was attached,
not that it could answer.
