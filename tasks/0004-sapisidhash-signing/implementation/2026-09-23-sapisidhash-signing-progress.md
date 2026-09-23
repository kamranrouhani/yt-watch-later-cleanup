# Progress: 2026-09-23-sapisidhash-signing

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

## 2026-09-23 14:01  Step 1: Plan

Worked: plan and this log, from main at 5673b43.
Next: step 2, test first.

## 2026-09-23 14:03  Steps 2 and 3: test first, port

Worked: `test/auth.test.js` failed first with `Cannot find module
'../src/core/auth.js'`. `src/core/auth.js` ports upstream's getCookie
fallback, sha1Hex and buildAuthHeader inside the WLCore wrapper, plus
pickSapisid as the pure front door. NotSignedInError carries upstream's
message.
Found while porting: upstream's getCookie returns the first cookie of a
repeated name, and "SAPISID = abc" with a space before the equals sign is
not a cookie by its matcher. Two of my tests were wrong, they asserted
document.cookie semantics upstream does not have. Fixed the tests, logged
the behaviour they now pin.
Verification: `npm run check` `all files parse`, `npm test` `# tests 20`,
`# pass 20`. `npm run test:browser` still 2 ok.
Bites: swapping origin and sapisid in the hash input failed the vector test
with a hash mismatch. Dropping the __Secure-3PAPISID fallback failed the
fallback order test ('ccc' !== 'bbb'). Removing decodeURIComponent failed
the encoded cookie test. First attempt at that second bite edited nothing,
the search string missed the real line, so the run stayed green and I redid
it against the actual file content.
Next: step 4 is folded into this commit; the port kept upstream behaviour
and the tests use the final API, so a separate restructure commit would
have been empty. Step 5: review, PR, merge.

## 2026-09-23 14:03  Step 5: Review, PR, CI, merge

Worked: review at `reviews/2026-09-23-1403-pre-merge.md`, no blockers. Two
deviations noted: steps 3 and 4 folded into one commit with the reason, and
two upstream behaviours (first repeated cookie, no space before the equals)
pinned by tests rather than carried silently.
Next: push, PR with the acceptance evidence, CI, merge.
