# Progress: 2026-09-24-scanner

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

## 2026-09-24 09:45  Step 1: Plan and task folder

Worked: plan written from main at 00254c2 after rebasing on origin/main,
along with this seeded log. Before writing it, the real page-1 fixture was
walked programmatically to confirm the sort-order mapping: order 0 is
Manual, order 1 is "Date added (newest)" (the fixture's actual selection),
order 2 is "Date added (oldest)" (what the scanner must verify against).
Innertube's real shape (`browseWatchLater`, `browseContinuation`,
`editPlaylist`, from PR #38) and the existing fake-client patterns in
`remover.test.js` and `innertube.test.js` were read so the scanner's test
fake matches how the rest of the repo already fakes this dependency.
Next: step 2, tests first.

## 2026-09-24 09:50  Step 2: Safety tests first, then the rest, all failing

Worked: `test/scanner.test.js` written before `src/core/scanner.js`
exists, 12 tests. Safety pair first: never-verifies raises
`SortNotVerifiedError` before any page fetch (asserts zero continuation
calls), and a browse-fallback verification (the edit response never
confirms but the following browse does) still proceeds, matching
upstream's two-path check. Then the four acceptance boxes: the 300-item
real capture across all 3 fixture pages plus a synthetic terminal page,
a crafted two-page fixture with one shared setVideoId for the duplicate
box, an abort test using a real AbortController asserting no
continuation call happens after abort, and three fingerprint-diff tests
(add, remove, move) plus a stability test. A fake innertube matching
`remover.test.js`'s pattern (`browseWatchLater`, `browseContinuation`,
`editPlaylist`, scripted response queues) stands in for the real
dependency.
Verification: `node --test test/scanner.test.js` prints
`Cannot find module '../src/core/scanner.js'`, `# fail 1` (the whole
file, since `require` at module load time fails before any test runs).
Next: step 3, port sort verification and pagination.

## 2026-09-24 10:05  Step 3 and 4 combined: implement scan, fingerprint, abort, position

Worked: `src/core/scanner.js` written directly to the restructured shape
(composing over `innertube` and `playlistParser.parsePage` rather than a
first verbatim-port commit), since the issue's named upstream functions
operate on a raw `youtubeiRequest` this repo does not have; the sort
verification algorithm (edit then browse fallback, `sortVerifyMaxAttempts`
6, `sortVerifyPollMs` 350, both upstream's defaults) and the continuation
walk are the parts actually ported, kept behaviourally identical to
`ensureWatchLaterOrderOldest` / `fetchAllWatchLaterEntries`. Added
`extractSortState` (a fresh recursive `sortFilterSubMenuRenderer` walk,
confirmed against the real page-1 fixture: order 0 Manual, order 1 Date
added newest, order 2 Date added oldest), `computeFingerprint` over
`crypto.subtle.digest('SHA-256', ...)` on the ordered setVideoId list, an
`AbortSignal` check before each continuation fetch, and a final
`position` pass over the deduped entries.
Verification: `node --test test/scanner.test.js` prints `# tests 12`,
`# pass 12`, `# fail 0` on first run against the implementation.
Bites, each restored after: (1) fingerprint hashed a sorted-then-joined
id list instead of the ordered join, reds test 9 (moved item); (2)
removed the abort check before the continuation fetch, reds test 5
(continuation.length goes from 0 to 1); (3) dedupe kept every occurrence
instead of the first, reds test 4 (entryCount 4 instead of 3, position
sequence carries a duplicate). All three restored, full scanner suite
green again after each.
Final: `npm run check` prints `all files parse`; `npm test` prints
`# tests 187`, `# pass 187`, `# fail 0` (175 before this issue plus the
12 new scanner tests); `npm run test:browser` prints 8 `ok` lines,
unaffected since `scanner.js` is not wired into the manifest (dashboard
consumes it through CommonJS in a later issue, same as
`playlistParser.js`).
Next: step 5, self review, PR.
