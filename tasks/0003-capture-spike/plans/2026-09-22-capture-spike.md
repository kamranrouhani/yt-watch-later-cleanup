# Capture real Watch Later responses

- **Issue:** #3
- **Branch:** `feature/0003-capture-spike`
- **Written:** 2026-09-22 23:20, on `main` at `30ebe45`
- **Supersedes:** nothing

## Goal

Real, scrubbed InnerTube responses for Watch Later committed as fixtures, and
the five open questions in `docs/RESEARCH.md` answered with the JSON path that
proves each one. The parser (#6) is written against these, not against
guesses.

## Shape of the work

Two halves with Kamran in the middle.

1. **Before the capture, on this host:** the snippet, its instructions, the
   scrubber, and the fixture guard test. All of it is exercised here against a
   fake Watch Later page in real Chrome and against a synthetic raw capture.
2. **Kamran runs the snippet once** in his signed-in browser and copies the
   file to this host. Logged in `tasks/0022-sprint-1/implementation/BLOCKED.md`.
3. **After the capture:** scrub, commit fixtures, answer the questions, update
   RESEARCH.md, merge.

The branch stays open while waiting. A draft PR goes up after half 1 so CI
runs on it. #4, #8 and #10 are worked from `main` meanwhile.

## Decisions

- **The snippet only calls `youtubei/v1/browse`.** No `edit_playlist` string
  exists in the file, and a test asserts that. It cannot remove anything.
- **Request code is copied from upstream, not imported.** `getCookie`,
  `sha1Hex`, `buildAuthHeader`, `getYtcfgValue`, `getApiKey`,
  `getClientContext`, `getWatchLaterBrowseParamsFromInitialData`,
  `buildWatchLaterBrowseBody` and `youtubeiRequest` keep upstream behaviour so
  the capture is made exactly the way the port will make requests. `src/core`
  has none of these yet (#4, #5), and a paste snippet cannot load modules.
- **Continuation tokens are found the way upstream's fallback does it:** any
  `nextContinuationData.continuation` or `continuationCommand.token` in the
  response. This avoids writing a parser before the capture that the parser
  depends on.
- **Pages:** the first browse page and up to two continuations, as the issue
  says. That is about 300 items.
- **The file holds responses only.** No cookie, no API key, no auth header,
  no `ytcfg` dump. It adds `capturedAt`, `clientVersion`, `hl`, `gl`, the
  browse `params` used, and a summary the snippet prints to the console so
  Kamran can see what the capture covers before sending it.
- **The coverage summary** counts renderer kinds (`playlistVideoRenderer`,
  `lockupViewModel`, other), resume overlays and their percentages, items
  with `unplayableText` or `isPlayable: false`, and items that look like
  Shorts (`/shorts/` URLs or a `SHORTS` overlay style). If a category the
  questions need is empty, the instructions say so and ask for a second run
  with a known example added.
- **Scrubbing is two passes.** Pass one collects real values from known
  places: titles, channel names, handles, `videoId`, `setVideoId`, channel
  `browseId`s, the account and owner names, `visitorData`, `datasyncId`,
  continuation tokens. Pass two walks every string and replaces each real
  value, longest first, with a stable placeholder (`Video title 7`,
  `Channel 3`, `vid00000007`), so a title quoted inside an accessibility
  label is caught too. Keys that are pure tracking (`trackingParams`,
  `clickTrackingParams`, `serviceTrackingParams`, `serializedShareEntity`)
  get a fixed placeholder. Image URLs are replaced with
  `https://i.ytimg.com/placeholder.jpg`.
- **The scrubber refuses to write** if any collected real value, or an `@`,
  is still present in its output.
- **The denylist is committed as SHA-256 hashes,** never plaintext.
  `test/fixtures/captured/denylist.sha256` holds one hash per real value.
  The guard test hashes every string leaf in every fixture and every run of
  up to 20 consecutive words inside it, and fails on a hit. It also fails on
  `@` and on `SAPISID` in plaintext.
- **Raw captures live in `test/fixtures/captured/raw/`,** which the existing
  `test/fixtures/captured/**/raw/` rule already ignores. Checked with
  `git check-ignore` before Kamran is asked.
- **`tools/` is not shipped.** It is not referenced by the manifest. The
  no-network guard in #2 will scope to shipped files.

## Steps

### Step 1: Plan

This file and a seeded progress log, committed on their own.

### Step 2: Snippet test first

`test/browser/capture.spec.js`, a Playwright script run with
`node test/browser/capture.spec.js`. It routes
`https://www.youtube.com/playlist?list=WL` to a fake HTML page that defines
`ytcfg` and `ytInitialData`, sets a fake `SAPISID` cookie, and routes
`/youtubei/v1/browse` to three synthetic pages chained by continuation
tokens. It evaluates `tools/capture.js`, catches the download, and asserts:

- exactly three browse requests were made, each POST with a
  `SAPISIDHASH <ts>_<40 hex>` authorization header, and nothing else was
  requested after page load
- the second and third bodies carry the tokens from the previous page
- the downloaded JSON holds the three responses unchanged, and none of the
  fake cookie value, the fake API key or the auth header appear in it

Plus a unit assertion in `test/capture-tool.test.js` that `tools/capture.js`
contains no `edit_playlist`.

Expected first run: both fail because `tools/capture.js` does not exist.

### Step 3: `tools/capture.js`

Write it. Run both tests green. Break it (drop the continuation loop), see the
request count assertion fail, restore.

### Step 4: `docs/CAPTURE.md`

How to run it, in numbered steps, what it touches, what the file contains,
where to put it. `package.json` gets `test:capture` for the new spec, and
`test:all` runs it.

### Step 5: Scrubber test first

`test/fixtures/synthetic/raw-capture.json`: a hand-written raw capture with an
account name, a handle, an email-like string, `visitorData`, `datasyncId`,
tracking params, avatar URLs, and three items whose titles appear again in
accessibility labels and watch URLs. `test/scrub.test.js` runs the scrubber on
it and asserts none of the planted values survive, the structure (keys,
array lengths, overlay percentages, `isPlayable`, `lengthText`) is unchanged,
placeholders are stable across pages, and the scrubber throws when told to
keep a value it cannot remove.

Expected: fails on the missing `tools/scrub.js`.

### Step 6: `tools/scrub.js`

CLI: `node tools/scrub.js <raw.json> <out-dir>`. Writes one file per response,
the denylist hashes, and a plaintext mapping file into the raw folder only.

### Step 7: Fixture guard test first

`test/fixtures-guard.test.js` over every JSON under
`test/fixtures/captured/`, skipping `raw/`. Prove it bites by planting a
fixture with an `@`, one with `SAPISID`, and one containing a string whose hash
is in a temporary denylist. Remove the plants.

### Step 8: Draft PR, ask Kamran

Push, open a draft PR titled for the capture tooling, `Refs #3`. Append the
request to `BLOCKED.md` with the steps from `docs/CAPTURE.md`. Update
`STATE.md`. Move to #4.

### Step 9: Scrub the real capture

Run the scrubber, read the output by eye for anything personal the rules
missed, extend the rules if so (test first, with a synthetic plant), commit
fixtures with a README saying what the capture covers.

### Step 10: Findings

`implementation/findings.md` answers the five questions with JSON paths
into the committed fixtures. `docs/RESEARCH.md` gets the answers in place of
the open questions for 1, 2, 3 and whatever else the capture settles, marked
with the capture date.

### Step 11: Review, ready, merge

Review to `reviews/`, PR out of draft, `Closes #3`, merge commit.

## Acceptance

| Box | How it is shown |
|---|---|
| fixtures committed, scrubbed, with a README | the fixture directory in the PR, its README, the scrubber's own refusal check passing |
| a test fails on `@`, `SAPISID`, or a denylisted value | `npm test` output with each plant, then clean |
| five answers in findings, RESEARCH.md updated | the findings file with JSON paths, the RESEARCH.md diff |

## Out of scope

Parsing into `Entry` (#6). Any removal or sort change. The sort menu is
captured because it is in the first browse response; its semantics are #7.
