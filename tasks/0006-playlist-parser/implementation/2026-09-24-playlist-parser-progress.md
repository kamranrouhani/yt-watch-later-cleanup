# Progress: 2026-09-24-playlist-parser

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

## 2026-09-24 07:14  Step 1: Plan and task folder

Worked: plan written from main at b741d69 after rebasing on origin/main,
along with this seeded log. Before writing it, every real fixture was
walked programmatically: 300 playlistVideoRenderer items, exactly four
h:mm:ss lengths, 187 resume overlays, 0 unplayable, 0 shorts, string
lengthSeconds, one no-byline item (page 3 index 298), one byline
without browseId (page 2 index 103), tokens CONTINUATION_1/2/3 with
page 2 and 3 using the classic continuationItemRenderer shape and page
1 burying its token in a commandExecutorCommand.commands list.
Next: step 2, tests first.

## 2026-09-24 07:21  Step 2: Tests first, all failing

Worked: `test/playlist-parser.test.js` written before any parser code,
23 tests. Safety trio first: a byline without browseId (the real page 2
item vid00000103) yields channelId null and a channelId remove rule
never matches it; an unparseable duration reads null, which makes
rules.js report it as missing data and skip the entry in both
directions of the duration operator. Then the four acceptance boxes as
tests against the real pages plus the synthetic fixture, the drop and
dedupe behaviour, the clamp, and a port-compat test that pins
`extractEntriesAndContinuation` to the same token and setVideoId set as
`parsePage` so the two commits of the port stay comparable.
Did not work: the first write of the file had two test fixtures as
one-liner objects with an unbalanced bracket; the write-time syntax
check caught it, both blocks were reindented, clean.
Verification: `node --test test/playlist-parser.test.js` prints
`# Error: Cannot find module '../src/core/playlistParser.js'`,
`# fail 1`. `npm run check` prints `all files parse`.
Next: step 3, the verbatim port.

## 2026-09-24 07:28  Step 3: Port, behaviour identical to upstream

Worked: `src/core/playlistParser.js` copied from upstream
`extractEntriesAndContinuation` (line 174) plus its private `pickTitle`
and `safeText`, wrapped in the repo's UMD pattern. The walk dedupes
nodes, so page 1 items reachable both through `contents` and elsewhere
are visited once; upstream behaviour kept exactly.
Verification: direct run against page-1.json prints
`tokens: [ 'CONTINUATION_1' ]`, `entries: 100`, first entry
`{"setVideoId":"SET0000000000001","videoId":"vid00000001",...`.
The suite fails only on the `parsePage` surface that does not exist
yet: 24 tests, 1 pass (a duration safety test that holds against any
implementation), 23 fail, including the port-compat test which fails
with `parsePage is not a function`, the expected cross-reference.
Next: step 4, restructure to parsePage and Entry.

## 2026-09-24 07:41  Step 4: Restructure to parsePage and the Entry shape

Worked: `parsePage(json)` in the same file, `parseDurationSeconds`
exported for the duration matrix test, `extractSetVideoId` centralised
(menu ACTION_REMOVE_VIDEO first, top level as fallback, null means
dropped), `resumePercent` clamped, `shortBylineText` returning
name-plus-first-browseId so a byline without browseId yields null
instead of a wrong ID, `isShort`/`isLive` from the time status overlay's
text and style, and `droppedItems` counted wherever the walk consumed a
renderer it could not turn into an entry. The verbatim upstream port is
kept in the file as `extractEntriesAndContinuationPort`, exported under
its upstream name so the two behaviours stay comparable and the port
commit remains the diff base.
Did not work: the first restructure delegated
`extractEntriesAndContinuation` to itself through `buildPort` and blew
up with `Maximum call stack size exceeded`; fixed by giving the
verbatim implementation its own name. One test expectation was wrong,
not the code: the port (faithfully to upstream) fills
`unavailableReason` from unplayableText, the test asserted undefined,
the test was corrected to assert the real value.
Verification: bites, in order. Removing the watchedPercent fallback to
return 1 reds tests 8 and 9 (unwatched and unavailable fields). Breaking
h:mm:ss to null reds tests 12 and 13. Making an absent overlay return
null reds tests 6, 7, 8. Each restored after the run. Final:
`node --test test/playlist-parser.test.js` prints `# tests 24`,
`# pass 24`, `# fail 0`; `npm run check` prints `all files parse`;
`npm test` prints `# pass 175`, `# fail 0`.
Next: step 5, self review, PR.
