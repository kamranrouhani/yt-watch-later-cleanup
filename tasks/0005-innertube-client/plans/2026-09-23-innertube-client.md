# Port the InnerTube client

- **Issue:** #5
- **Branch:** `feature/0005-innertube-client`
- **Written:** 2026-09-23 14:13, on `main` at `f1df0e7`
- **Supersedes:** nothing

## Goal

`src/core/innertube.js` with one client for the three calls the extension
needs: `browseWatchLater()`, `browseContinuation(token)`,
`editPlaylist(actions)`. Config passed in, requests through `net.js`,
errors a caller can act on.

## Decisions

- **`createInnertube(config, deps)`** where config is
  `{ apiKey, clientVersion, hl, gl, visitorData? }` and deps is
  `{ fetch, authHeader }`. Nothing is read from `window`, per the issue.
  `deps.fetch` is a net instance's fetch; `deps.authHeader` is async
  `(origin) => header string`, so #11 wires the page's cookies without this
  module knowing about them.
- **The client calls `deps.authHeader(origin)` itself**, upstream's
  `youtubeiRequest` does, and passes `authorization` in headers. A default
  `authHeader` of `() => ''`... no: upstream always signs. The client
  requires `authHeader` in deps and throws a `TypeError` if missing. Tests
  supply a stub.
- **URL shape, upstream exactly:**
  `${origin}/youtubei/v1/${path}?prettyPrint=false&key=${encodeURIComponent(apiKey)}`,
  POST, headers `content-type`, `x-youtube-client-name: '1'`,
  `x-youtube-client-version: clientVersion`, `x-origin`, `authorization`.
  Body is JSON.
- **Context built from config**, upstream's `getClientContext` shape:
  `{ client: { clientName: 'WEB', clientVersion, hl, gl, visitorData? } }`,
  visitorData omitted when absent, exactly upstream.
- **`browseWatchLater(browseParams)`** sends `{ context, browseId: 'VLWL',
  params? }`, params omitted when null, upstream's
  `buildWatchLaterBrowseBody`.
- **`browseContinuation(token)`** sends `{ context, continuation: token }`.
- **`editPlaylist(actions)`** sends `{ context, playlistId: 'WL', actions,
  params: 'CAFAAQ%3D%3D' }`. The `params` value keeps upstream's name
  `WL_PARAMS` and the one comment this repo allows: where the value came
  from. The action objects themselves are built by callers (#9), this
  method only wraps.
- **Typed errors, all with `name` set:**
  - `RateLimitedError` on 429
  - `AuthError` on 401 and 403
  - `EditRejectedError` when parsed JSON `status` is present and not
    `STATUS_SUCCEEDED` (upstream's `assertEditPlaylistSucceeded`, which
    treats an absent status as success)
  - `HttpError` otherwise, carrying `status` and `responseText`
- **A non-JSON response body raises `HttpError`** with the status, rather
  than a parse crash.
- **`net.js` origin check happens first.** The client is built on a net
  instance whose allowlist is `https://www.youtube.com`, so a misconfigured
  origin throws before any request.

## Steps

### Step 1: Plan

This file and a seeded progress log, one commit.

### Step 2: Test first

`test/innertube.test.js`, all against a fake `deps.fetch` that records
calls and returns scripted responses:

- each call sends the exact URL, headers and body, asserted field by field
  against upstream's shape
- `browseWatchLater` omits `params` when given null, includes it when given
- `visitorData` omitted when absent in config
- 429 -> `RateLimitedError`, 401 -> `AuthError`, 403 -> `AuthError`,
  500 -> `HttpError`, non-JSON body -> `HttpError`
- `status: 'STATUS_SUCCEEDED'` returns the json; a different status ->
  `EditRejectedError`; absent status passes (upstream semantics)
- missing `authHeader` in deps throws `TypeError`
- the client never reads `window` or `document`

Expected: `Cannot find module '../src/core/innertube.js'`.

### Step 3: Implement

Bites: swap `x-youtube-client-name` to `'2'`; drop the `prettyPrint=false`
query param; make `EditRejectedError` throw on absent status; return 200
with `status: 'FAILED'` and check `EditRejectedError`.

### Step 4: Review, PR, CI, merge, close out

## Acceptance, from the issue

| Box | How it is shown |
|---|---|
| with a fake `fetch`, each call sends the same URL, headers and body upstream sends, asserted field by field | the three field-by-field tests, output pasted |
| each error type is raised by the matching fake response | the error matrix test, output pasted |
| `npm test` green, including the no-network guard | full suite output |

## Out of scope

The parser (#6), the scanner (#7), the remover (#9), the bridge (#11).
