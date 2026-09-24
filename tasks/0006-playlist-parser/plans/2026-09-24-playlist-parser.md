# Port the playlist parser

- **Issue:** #6
- **Branch:** `feature/0006-playlist-parser`
- **Written:** 2026-09-24 07:12, on `main` at `b741d69` (after merging PR #36)
- **Supersedes:** nothing

## Goal

`src/core/playlistParser.js` with `parsePage(json)` returning
`{ entries, continuationToken, droppedItems }`, ported from
`extractEntriesAndContinuation` (upstream line 174) with identical
behaviour first, restructured second. Field assertions pinned to the real
captured fixtures. The rules engine (#8, already merged) consumes this
output to decide deletions, so missing data lands where `rules.js`
already treats it as a non-match.

## Decisions

- **Port contract.** First commit keeps upstream's algorithm exactly:
  recursive visit, dedupe of setVideoIds across the walk, collection of
  every continuation token seen (first one wins), item coming either from
  `playlistVideoRenderer` in an item array or, as a fallback, from
  wherever the node appears. The entries keep upstream's field names in
  the port commit (`publishedTimeText`, `lengthText`, `isPlayable`),
  and the restructuring commit maps them onto the `Entry` contract of
  `docs/ARCHITECTURE.md`. Two commits, per CONTRIBUTING.
- **`parsePage(json)` returns `{ entries, continuationToken, droppedItems }`**
  per the issue. The issue names `continuationToken` singular; the walk
  may find several, so the API is: `continuationToken` is the first
  token found in document order (that is the one the scanner follows),
  and `continuationTokens` (the port's array) stays exported on the api
  object for whoever needs the rest. Dedupe on `setVideoId` within the
  page is upstream behaviour and stays; the cross-page dedupe is #7's
  scanner, with a note in the PR that the fixture pages are disjoint.
- **Dropped items.** The issue: an item with no `setVideoId` is dropped
  and counted, never guessed. A `playlistVideoRenderer` without a
  removable `setVideoId` (neither top level nor in its menu) is skipped
  by upstream's `pushEntryFromRenderer`; the restructured parser counts
  it in `droppedItems` instead of silently skipping. Which one carried
  it is decided at runtime: menu value if present, else top level.
- **fields per `docs/ARCHITECTURE.md` Entry:**
  - `setVideoId`, `videoId` straight off the renderer.
  - `title` from `title.simpleText` or joined `title.runs[].text`.
  - `channelName` from joined `shortBylineText.runs[].text`,
    `channelId` from the first run whose `navigationEndpoint.\
browseEndpoint.browseId` exists. Both missing-safe: the captured
    page 2 item 103 has a byline with no `browseId`, so `channelId`
    must reach the rules engine as "unknown", not a wrong ID.rules.js
    misses (`channelId: ''` is a non-match for `in` on empty lists and
    a non-match for `in value` generally; tested to prove it).
  - `durationSeconds` parsed from `lengthText.simpleText` (or the
    `thumbnailOverlayTimeStatusRenderer.text` fallback, upstream's
    fallback), accepting `h:mm:ss`, `m:ss` and `m:ss` with single-digit
    minutes; missing or unparseable gives `null` so a
    `durationSeconds` condition reads "missing" and never matches
    (rules.js line 20 to 24). `r.lengthSeconds` is kept in the port
    but not used for the Entry: it is a string in the real fixtures,
    and the fallback text path exists for items that lack lengthText
    but carry a time-status overlay (existing upstream behaviour).
  - `watchedPercent` from
    `thumbnailOverlays[].thumbnailOverlayResumePlaybackRenderer.\
percentDurationWatched`, `0` when the overlay is absent, clamped to
    0..100 (issue requirement), non-numeric treated as absent.
  - `playable` is `false` only when `unplayableText` is present or
    `isPlayable === false`; `unavailableReason` from
    `unplayableText.simpleText` or `null`.
  - `publishedText` from `publishedTimeText` (simpleText or runs) or
    `null`. In the capture no item carries it; the synthetic fixture's
    PlantVid003 does.
  - `isLive` true when the time status overlay (if any) says LIVE or the
    response marks it; else false. `isShort` true when the time status
    overlay carries `style: 'SHORTS'` or its text is literally
    `SHORTS`, else false. Nothing in the captured set is a Short, the
    synthetic PlantVid003 has `style: 'SHORTS'`, so the matrix covers
    both sides.
- **UMD wrapper** like `innertube.js`/`remover.js`:
  `root.WLCore.playlistParser = api; module.exports = api`.
- **Manifest.** Not added to `manifest.json`. The module never runs in
  the page or content world, it lives in the dashboard's script chain;
  the dashboard loads it in a later issue (#12 chain), the tests load it
  through CommonJS. `scripts/shipped-files.js` already ships the whole
  `src/` directory, so it will be in `dist/` without manifest changes,
  and `test/wiring.test.js` stays green without touching the manifest.
- **Fixtures read, never written.** The synthetic fixture
  (`test/fixtures/synthetic/raw-capture.json`) stays untouched; the
  unavailable and Short coverage comes from it exactly as committed.

## Real fixture facts this plan is built on

From the fixtures in `test/fixtures/captured/2026-09-24/` (checked
programmatically before this plan was written, walking every item):

- page 1: 100 items plus a 101st array element holding the continuation
  item; the token `CONTINUATION_1` sits at
  `...playlistVideoListRenderer.contents[100].continueItemRenderer.\
continuationEndpoint.commandExecutorCommand.commands[1].\
continuationCommand.token` (a shape the generic node walk covers). Page
  2 and page 3 carry `CONTINUATION_2` and `CONTINUATION_3` under
  `onResponseReceivedActions[0].appendContinuationItemsAction.\
continuationItems[100]`, the classic `continuationItemRenderer.\
continuationEndpoint.continuationCommand.token` shape.
- All 300 items have exactly fourteen keys (`findings.md`): all with
  `setVideoId` top level and an `ACTION_REMOVE_VIDEO` in the menu.
- `lengthSeconds` arrives as a string ("323"), not a number.
- Watched/partial/unwatched spread: 187 resume overlays (73 at exactly
  100), 113 with none. watchable percentages hit every bucket 10 to
  100.
- 4 items with `h:mm:ss` lengths; no `0:59` or missing lengths in the
  captured set. The missing case comes from the synthetic PlantVid004,
  which has no `lengthText` and no time-status overlay.
- One captured item (page 2, index 103, `vid00000103`) has a
  `shortBylineText` whose `navigationEndpoint` holds a
  `showDialogCommand` (no `browseEndpoint`), so `channelId` is
  legitimately absent there.
- One captured item (page 3, index 298) has no `shortBylineText` at all.

## Steps

### Step 1: Plan and task folder

This file and a seeded progress log, one commit, task files only.

### Step 2: Safety tests first, then planted item tests, all failing

`test/playlist-parser.test.js`, written before any implementation code
exists, mostly against the real captured fixtures plus the synthetic
one. Commands and outputs go into the progress log. The suite:

- Every fixture parses with zero thrown errors and zero dropped items:
  `parsePage(page-1.json)`, `page-2.json`, `page-3.json` each assert
  `droppedItems === 0` and `entries.length === 100`; the synthetic
  fixture asserts all four items across its two pages come through.
- Watched (page 1, index 5, `vid00000005`) asserted field by field:
  setVideoId, videoId, title, channelName, channelId,
  durationSeconds 524, watchedPercent 100, playable true,
  publishedText null, isShort false, isLive false.
- Partial (page 1, index 7, `vid00000007`): watchedPercent 33,
  durationSeconds 1539, everything else as above.
- Unwatched (page 1, index 1, `vid00000001`): watchedPercent 0,
  durationSeconds 323, playable true.
- Unavailable (synthetic page 1, PlantVid002): playable false,
  unavailableReason '[Private video]', durationSeconds null
  (missing lengthText reads null, never a wrong number),
  watchedPercent 0.
- Short (synthetic page 1, PlantVid003): isShort true, isLive false,
  playable true, watchedPercent 37, durationSeconds null (the overlay
  says SHORTS with no time text).
- Missing-data rule semantics: a `channel2 = ''` item and an
  unparseable duration both drop through `rules.js`'s
  `missing` path, never matching, when targeted by a remove rule. This
  is the box that keeps a wrong field from causing a wrong removal.
- `durationSeconds` matrix: `1:02:03` (real, page 3 index 230
  `1:38:12` covers it too), `12:34`, `0:59`, missing, from the
  parser's own function exported for direct testing.
- Continuation token: page 1 gives `CONTINUATION_1`, page 2 gives
  `CONTINUATION_2` (both asserted, proving first page and continuation
  page both yield a token).
- Dedupe/drop: an item with no setVideoId anywhere is dropped and
  counted; a duplicate setVideoId in one page returns one entry.

Expected at the end of this step: the whole file fails with
`Cannot find module '../src/core/playlistParser.js'`.

### Step 3: Port, behaviour identical to upstream (commit 1)

Copy upstream verbatim with only the repo's `'use strict'` plus the
UMD wrapper, exporting `extractEntriesAndContinuation` unchanged. Run
the full suite, confirm the behavioural subset (tokens found on both
page kinds, all 300 items, 0 dropped in upstream terms though the port
has the same silent skip) passes.

### Step 4: Restructure to parsePage and the Entry shape (commit 2)

- Rename to `parsePage`, map fields per Decisions, add `droppedItems`.
- Keep `extractEntriesAndContinuation` exported on the api object
  (port compatibility), delegating to `parsePage` with the shared walk.
- Full suite green, `npm run check` green.
- Bites: change `watchedPercent` fallback to 1, break the
  `h:mm:ss` split, return watchedPercent null instead of 0, watch the
  relevant tests go red, restore. All logged.

### Step 5: Progress log, self review, PR

- `reviews/<date>-pre-merge.md` with the header Git metadata filled
  from commands run, after checking each acceptance box against its
  test.
- Push, `gh pr create`, title "playlist parser: raw renderers to
  Entries", body includes `Closes #6` and each acceptance box with the
  command that pins it and the real output. Round 1 goes to
  `metis-review` with the metadata the card names.

## Acceptance, from the issue

| Box | How it is shown |
|---|---|
| every captured fixture parses with zero thrown errors and zero dropped items | the three-page suite, output pasted |
| a watched, partially watched, unwatched, unavailable and Short item asserted field by field from real fixture data | the five field-by-field tests, output pasted |
| `durationSeconds` handles `1:02:03`, `12:34`, `0:59` and missing | the duration matrix test, output pasted |
| the continuation token is found in both the first page and a continuation page | the token test, output pasted |
| zero dropped items or a documented reason per drop | zero in all fixtures; the unavailable and Short coverage coming from the synthetic fixture is documented here and in the PR |

## So what the fixtures do not cover

The captured set has no unavailable item and no Short
(`capture.json`: `unplayable: 0`, `shortsLike: 0`; the fixture README
states YouTube does not serve deleted or private items in Watch Later
and the playlist happened to contain no Shorts). Both shapes are
covered by `test/fixtures/synthetic/raw-capture.json`, which exists for
exactly that reason. This is stated again in the PR body, so the gap is
honest, not hidden.

## Out of scope

The scanner (#7), the dashboard chain (#12 to #16), the enrichment
layer, any change to `reference/upstream/` beyond reading it.
