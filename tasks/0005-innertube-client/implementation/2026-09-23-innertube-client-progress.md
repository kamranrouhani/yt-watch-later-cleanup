# Progress: 2026-09-23-innertube-client

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

## 2026-09-23 14:13  Step 1: Plan

Worked: plan and this log, from main at f1df0e7.
Next: step 2, tests first.

## 2026-09-23 14:15  Steps 2 and 3: tests first, then the client

Worked: `test/innertube.test.js` failed on the missing module, then
`src/core/innertube.js`. Field by field assertions against upstream's
url, headers and bodies, the error matrix, absent-status semantics.
Hit a problem: the no-network guard failed on my own module. I had
destructured `fetch` out of deps, so the source held a bare `fetch(`
call. Per the stuck rule, read the error first: the guard was right, the
module was wrong. The client now takes the net instance and calls
`net.fetch`, and the scan's fetch pattern got a lookbehind so calling the
injected chokepoint stays legal while a bare fetch anywhere outside net.js
still fails. The #2 plant in dashboard.js re-proven red after the pattern
change.
Also fixed in the tests: the error matrix drove edit-status cases through
browseWatchLater, which never checks edit status, so the EditRejectedError
case passed vacuously until pointed at editPlaylist.
Bites, each restored: client name '2' failed the field-by-field test;
prettyPrint dropped failed 3 tests; absent edit status treated as failure
failed the upstream semantics test; 429 mapping removed failed the error
matrix.
Verification: `npm run test:all` exit 0, `# tests 51`, `# pass 51`,
both browser ok lines.
Next: step 4, review, PR, merge.
