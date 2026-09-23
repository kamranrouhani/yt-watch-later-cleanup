# Port SAPISIDHASH request signing

- **Issue:** #4
- **Branch:** `feature/0004-sapisidhash-signing`
- **Written:** 2026-09-23 14:01, on `main` at `5673b43`
- **Supersedes:** nothing

## Goal

`src/core/auth.js` producing the `SAPISIDHASH <ts>_<sha1>` authorization
header, ported from upstream's `buildAuthHeader`, `sha1Hex` and `getCookie`,
pure and testable under Node.

## Decisions

- **Two functions.** `pickSapisid(cookies)` resolves the fallback order, and
  `buildAuthHeader({ sapisid, origin, nowSeconds })` builds the header. Cookie
  reading takes a cookie string, not `document.cookie`, so the module stays
  pure and the browser side stays trivial later.
- **The hash is SHA-1 of `<ts> <sapisid> <origin>`**, exactly upstream's
  input and order. SHA-1 is fine here: it is a request authenticator YouTube
  specifies, not a confidentiality primitive.
- **`NotSignedInError`** with `name` set to the class name and the message
  from upstream, so a caller can distinguish it from other errors.
- **`nowSeconds` is a parameter, not `Date.now()` inside.** Upstream divides
  milliseconds by 1000. Tests pin known vectors; #5 calls it with
  `Math.floor(Date.now() / 1000)`.
- **SubtleCrypto is unavailable in Node.** The module uses Web Crypto when it
  exists and falls back to a Node `crypto` import for `node --test`. In the
  browser both exist, so `WLCore.auth` is identical.
- **Upstream behaviour first, restructure second, per CONTRIBUTING.** The
  first commit ports the functions inside the WLCore wrapper unchanged,
  including the cookie fallback, the error message and the ten second floor
  behaviour. The second commit restructures into the two pure functions, and
  the tests move from upstream-shaped calls to the final API.

## Steps

### Step 1: Plan

This file and a seeded progress log, one commit, no code.

### Step 2: Test first, upstream shape

`test/auth.test.js`:

- a known `{ nowSeconds, sapisid, origin }` vector, expected hash computed
  independently in the test with Node `crypto`, header format
  `SAPISIDHASH <ts>_<hex>`
- the fallback order `SAPISID`, `__Secure-3PAPISID`, `__Secure-1PAPISID`,
  tested by feeding a cookie string and asserting which value is used
- URL-decoding of the cookie value, upstream's `decodeURIComponent`
- missing cookies raise `NotSignedInError`
- seconds, not milliseconds: `nowSeconds` in the vector is used as given, and
  a test asserts the header timestamp equals `nowSeconds` exactly

Expected first run: `Cannot find module '../src/core/auth.js'`.

### Step 3: Port

`src/core/auth.js`, upstream behaviour first inside the WLCore wrapper.
`npm run check && npm test` green.

Bite: swap `<ts> <sapisid> <origin>` to `<ts> <origin> <sapisid>`, watch the
vector test fail, restore.

### Step 4: Restructure

Second commit: `pickSapisid(cookieString)` and
`buildAuthHeader({ sapisid, origin, nowSeconds })`, `NotSignedInError`
exported, `getCookie` logic moved into `pickSapisid` without behaviour
change. Tests updated to the final API in the same commit.

Bites: drop the `__Secure-3PAPISID` fallback, watch the order test fail;
remove the decode, watch a test with a percent-encoded cookie fail.

### Step 5: Review, PR, CI, merge

Self review to `reviews/`, PR with `Closes #4`, every acceptance box shown
with real output, `gh pr checks --watch`, merge with `gh pr merge --merge`.

## Acceptance, from the issue

| Box | How it is shown |
|---|---|
| known input produces the expected hash, computed independently in the test with Node `crypto` | the vector test, output pasted |
| the fallback order is tested | the order test, output pasted |
| missing cookies raise `NotSignedInError` | the error test, output pasted |

## Out of scope

Calling YouTube (#5). Cookie access in the page world (#11, the bridge).
`net.js` and the guard tests (#2).
