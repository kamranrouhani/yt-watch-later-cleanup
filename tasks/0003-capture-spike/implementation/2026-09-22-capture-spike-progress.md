# Progress: 2026-09-22-capture-spike

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

## 2026-09-22 23:21  Step 1: Plan

Worked: plan and this log, from main at 30ebe45.
Next: step 2, snippet test first.

## 2026-09-22 23:23  Step 2: Snippet test first

Worked: `test/browser/capture.spec.js` drives the snippet on a fake Watch
Later page in the pinned Chromium, with routed browse responses chained by
continuation tokens and a fourth page that must not be fetched.
`test/capture-tool.test.js` checks the source statically: no
`edit_playlist` or `ACTION_*`, only `browse` calls, and no cookie or key
reference in the object written to the file.
Verification: both failed with `ENOENT ... tools/capture.js`. `npm test`
printed `not ok 1 - test/capture-tool.test.js`, `# fail 1`.
Next: step 3, the snippet.

## 2026-09-22 23:23  Step 3: tools/capture.js

Worked: upstream's getCookie, sha1Hex, buildAuthHeader, getYtcfgValue,
getApiKey, getClientContext, getWatchLaterBrowseParamsFromInitialData,
buildWatchLaterBrowseBody and youtubeiRequest copied verbatim, plus a token
finder, a coverage summary and a blob download.
Verification: `ok capture snippet made 3 signed browse requests and
downloaded wl-capture-20260922-232229.json`; `npm test` `# pass 12`.
Tightened after first green: the header check now recomputes the SHA-1 with
Node crypto instead of only matching the shape.
Bites, each restored after: no continuation loop gave `expected 3 browse
requests, got 1`; origin and sapisid swapped in the hash input gave a hash
mismatch; writing `getApiKey()` into the file failed both the browser test
(`capture file contains AIzaFakeInnertubeKey`) and the static test; an
appended `edit_playlist` call failed 2 static tests; an extra
`fetch('/generate_204')` gave `the snippet requested something other than
browse`.
Deviation from the plan: the spec runs as part of `test:browser` instead of
a separate `test:capture` script, so `test:all` stays one chain.
`npm run test:all` exit 0 with all three ok lines.
Next: step 4, docs/CAPTURE.md.

## 2026-09-22 23:26  Step 4: docs/CAPTURE.md

Worked: numbered run steps, what the snippet touches and what the file holds,
how to read the summary table, the scp line to the raw folder, and the scrub
command.
Next: step 5, scrubber test first.

## 2026-09-22 23:26  Step 5 and 6: scrubber, test first

Worked: `test/fixtures/synthetic/raw-capture.json` plants an account name,
handle, email, visitorData, datasyncId, tracking params, avatar and thumbnail
URLs, three items including a private one and a Short, titles repeated in an
accessibility label and a watch URL, 3 letter title and channel names, and a
second page repeating a video. `test/scrub.test.js` failed with `Cannot
find module '../tools/scrub.js'` before the scrubber existed.
First run with `tools/scrub.js`: 20 of 21, `Planted Person survived`.
Printed where: the pages had no occurrence (index -1). The test stringified
the whole result including `mapping`, which holds real values by design and
is only written next to the raw file. The test was wrong, not the scrubber.
Changing the test to check `meta`, `pages` and `denylist`, the three
things that get committed.
Verification after the test fix: `npm test` `# tests 21`, `# pass 21`.
Bites, each restored: substring pass off made the scrubber's own refusal
throw while the test file loaded (`not ok 4 - test/scrub.test.js`);
tracking keys kept gave `PlantedTracking survived`; min length 1 gave
`Tomorrow, Annually was lost`; no title collection gave `Secret Recipe
Collection survived`; private titles treated as personal gave `[Private
video] was lost`; assertClean disabled gave `Missing expected exception`;
image URLs kept gave `planted-avatar survived`; opaque params kept gave
`UGxhbnRWaWQwMDE survived`.
Changed: the denylist path was hardwired to the repo, which would have
dirtied it on a scratch run. It is now `denylist.sha256` next to the output
directory, which is `test/fixtures/captured/` in real use.
CLI run on a copy of the synthetic capture in the scratch dir: wrote
capture.json, page-1.json, page-2.json, 22 hashes, mapping next to the raw
file. A second run left it at 22.
Next: step 7, fixture guard test.

## 2026-09-22 23:27  Step 7: Fixture guard test first

Worked: `test/fixtures-guard.test.js` with the check in
`test/helpers/fixture-guard.js`, parameterised by root so tests plant into a
temp dir. Failed first with `Cannot find module './helpers/fixture-guard.js'`.
Decided: the denylist match hashes every span between word boundaries up to
300 characters, not only runs of whole words as the plan said. A video id
inside `/watch?v=...&list=WL` is not whitespace separated and would have
slipped through.
Added beyond the plan: an end-to-end test that scrubs the synthetic capture
with the real CLI into a temp dir and runs the guard on it (clean), then
drops the unscrubbed file beside it (caught for both @ and denylist).
Verification: `# tests 28`, `# pass 28`. Bites, each restored: no @ check
failed 3 tests, no SAPISID check 1, whole string matching only 3, raw/ not
skipped 6. `npm run test:all` exit 0.
Next: step 8, draft PR and the request to Kamran.

## 2026-09-22 23:27  Step 8: Draft PR, ask Kamran

Worked: pre-push checks clean. Request appended to the sprint BLOCKED.md,
STATE points at #4. Branch pushed, draft PR opened.
Note for #2: `tools/capture.js` calls `fetch` on purpose. It is not shipped
and not in the manifest, so the no-network scan must exclude `tools/` along
with `reference/` and `test/`.
Next: #4 from main while waiting. Resume here at step 9 when the file lands.

## 2026-09-24 04:30  Steps 9 and 10: rub the real capture into fixtures, findings

Kamran ran the snippet twice (wl-capture-20260924-050853 and -051020). The
summaries match exactly; the only byte differences are per-request tracking
ids, so the fresher file (-051020) is the raw input, kept in raw/ out of git.
The capture answers research questions 1, 2 and 3 outright: no added-at
timestamp anywhere in 300 items, the 100% overlay is a normal
resume-playback renderer (73 items at exactly 100, 187 watched in total,
113 never started), and all 300 items are playlistVideoRenderer with 0
lockupViewModel. No unplayable and no Shorts items: YouTube does not serve
deleted/private items in Watch Later at all, so those shapes stay synthetic.
Found a scrubber bug on the real data: one channel is literally named
"Channel 8", which collided with the "Channel <n>" placeholder pool and the
mapping produced a placeholder equal to a real value; a second collision
surfaced later when a placeholder "Channel 80" contained the real "Channel 8"
as a substring. buildMapping now skips any placeholder that is or contains a
real value, and googlevideo initplayback urls (they carry the client ip) are
replaced whole. Both fixes test-first: the synthetic fixture grows a literal
"Channel 5" channel and a planted googlevideo url, each new test seen failing
before the fix (not ok 9 scrub, not ok 8 googlevideo), then green after.
Verification of the fixture itself, by eye and script: no @, no SAPISID, no
visitorData key, no datasync real value, no ip=/initplayback strings, all
thumbnail and playback urls placeholders, percentages and structure intact
(shape unchanged, 187 overlays preserved, continuation chain intact).
Committed: fixtures 2026-09-24 (3 pages, capture.json, README, 1569-hash
denylist), scrubber fix, synthetic fixture additions. 140/140 unit tests,
7/7 browser assertions incl. the capture spec, fixture guard 7/7.
Rewrote history once: rebased the branch onto main (Kamran's preference over
a merge) before pushing; conflicts in package.json (kept all three browser
specs) and stale STATE/BLOCKED copies (took main's). Force-pushed the draft
PR branch with a plain push (=ref), main untouched.
findings.md written with JSON paths for all five questions; docs/RESEARCH.md
open-questions section replaced by the capture's answers. Sort params for
oldest is now primary evidence: "QAE%3D", not upstream's CAFAAQ%3D%3D.
Next: step 11, review, PR out of draft, merge as a regular merge.
