# Dashboard to YouTube tab bridge

- **Issue:** #11
- **Branch:** `feature/0011-tab-bridge`
- **Written:** 2026-09-23 14:45, on `main` at `70d2315`
- **Supersedes:** nothing

## Goal

The dashboard connected to a Watch Later tab: `content/bridge.js` in the
isolated world relaying `chrome.runtime` messages to `content/page.js` in
the MAIN world, which runs the InnerTube client with the page's `ytcfg`
and cookies. Nonce-gated, double-injection safe, observable from the
dashboard, and honest when the tab goes away.

## Decisions

- **Message protocol**, both directions over `window.postMessage` with
  `event.source === window`:
  - bridge to page at startup: `{ wlBridge: true, type: 'hello', nonce }`
  - dashboard to page (relayed by bridge):
    `{ wlBridge: true, nonce, type: 'request', kind, id, payload }` where
    kind is `browseWatchLater`, `browseContinuation`, `editPlaylist`,
    `ping`
  - page to bridge (relayed back to the dashboard):
    `{ wlBridge: true, nonce, type: 'response', id, ok, result | error }`
  - The page ignores anything without its nonce. The bridge ignores
    anything that is not a `response` for a request it relayed.
- **The nonce** is random from `crypto.getRandomValues`, 128 bits, hex.
  The bridge generates it and hands it over in `hello`. It lives only in
  the tab's two worlds for the session; nothing persists it.
- **`content/bridge.js` (isolated world):** on load, if
  `window.__wlBridgeInstalled` is set, do nothing (double injection
  guard). Otherwise set it, generate the nonce, post `hello`, and listen
  for `chrome.runtime.onMessage` messages of the shape
  `{ wlRequest: true, kind, id, payload }` from the dashboard, forwarding
  them into the page with the nonce, and `response` messages from the
  page, forwarding them back with
  `chrome.runtime.sendMessage({ wlResponse: true, id, ok, result, error })`.
- **`content/page.js` (MAIN world):** on load, if `window.__wlPage` is
  set, do nothing. Otherwise install a listener that only acts on
  `wlBridge` messages with the right nonce. `ping` answers
  `{ clientVersion: ytcfg.get('INNERTUBE_CLIENT_VERSION'), signedIn:
  Boolean(SAPISID cookie) }`. The three call kinds build the client from
  `ytcfg` (`INNERTUBE_API_KEY`, `INNERTUBE_CLIENT_VERSION`, `HL`, `GL`,
  `VISITOR_DATA`), `auth.js` with `document.cookie`, and `net.js`, and
  run `innertube.js`. Errors are serialised as
  `{ name, message }` so the dashboard can see the error type.
- **`src/core/tabBridge.js` (dashboard side):**
  `createTabBridge(chromeTabs)` with `ensureTab()` (find
  `https://www.youtube.com/playlist?list=WL` among open tabs, else create
  it in the background), `connectedTabId`, `request(kind, payload)` with
  a per-call `id` and a timeout, and `onTabGone` handling through
  `chrome.tabs.onRemoved`. A request whose tab vanished rejects with a
  `TabGoneError` instead of hanging. The timeout default is 30 s and
  rejects with `TimeoutError`.
- **Manifest:** two content script entries on
  `https://www.youtube.com/*`, `bridge.js` in the default isolated world,
  `page.js` with `"world": "MAIN"`. `wiring.test.js` from #2 already
  enforces that every manifest-listed file exists, and #2's guard scans
  the shipped files; `content/` joins the scanned set.
- **`page.js` loads the core modules**: the manifest lists
  `src/core/*.js` files plus `content/page.js` in the MAIN world entry, in
  dependency order (constants, auth, net, innertube, page). The
  `wiring.test.js` check that "every src/core file a content script needs
  is listed" gets its teeth here: a test asserts the manifest's MAIN world
  js list matches exactly the modules `page.js` needs.
- **Integration test**, `test/browser/bridge.spec.js`, Playwright with
  routed fake `https://www.youtube.com/playlist?list=WL`: load the
  extension, open the dashboard, call the bridge's debug ping, assert the
  fake `ytcfg` client version comes back through both worlds; then a
  `browseWatchLater` request through the routed fake InnerTube endpoint,
  asserting the response arrives at the dashboard; then close the tab and
  assert the pending request rejects with `TabGoneError`, not a hang.
- **Manual, on the PR checklist:** the real ping against the real
  signed-in Watch Later tab, since no fake can prove the real `ytcfg` and
  cookies. Expected: the client version of the real page and
  `signedIn: true`.

## Steps

### Step 1: Plan

This file and a seeded progress log, one commit.

### Step 2: Unit tests first

`test/bridge.test.js`: nonce gate (wrong or missing nonce ignored, right
nonce answered), relay forwarding unchanged, double injection no-op, tab
bridge request/response pairing, `TabGoneError`, timeout. Expected:
missing modules.

### Step 3: `src/core/tabBridge.js`, `content/bridge.js`, `content/page.js`, manifest

Manifest update plus the wiring assertion for the MAIN world js list.
Bites: accept a wrong nonce; drop the double-injection guard; relay the
response with the wrong id; never fire TabGoneError.

### Step 4: `test/browser/bridge.spec.js`

The routed fake YouTube, the full round trip, the tab-closed rejection.
Bites: break the nonce in bridge.js and watch the request time out (fast
timeout injected); remove the guard and re-inject.

### Step 5: Review, PR, CI, merge, close out

## Acceptance, from the issue

| Box | How it is shown |
|---|---|
| unit: a message with a wrong or missing nonce is ignored | nonce gate tests |
| unit: the relay forwards a request and its response unchanged | relay tests, payload equality both ways |
| manual, recorded in the PR: signed-in ping returns the client version | manual-check.md, expected observation stated |
| closing the tab mid request produces a visible error, not a hang | unit `TabGoneError` plus the browser test closing the routed tab |

## Out of scope

The scan UI (#12), the parser (#6), the scanner (#7), the run UI (#15).
