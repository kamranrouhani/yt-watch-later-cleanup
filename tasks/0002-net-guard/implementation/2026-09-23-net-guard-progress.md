# Progress: 2026-09-23-net-guard

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

## 2026-09-23 14:08  Step 1: Plan

Worked: plan and this log, from main at ee6cd1b.
Next: step 2, safety tests first.

## 2026-09-23 14:11  Steps 2 and 3: net tests first, then net.js

Worked: safety tests written before any implementation, failed on the
missing module, then `src/core/net.js` with createNet and an exact origin
allowlist. `# tests 26`, `# pass 26`.
Bites, each restored: no allowlist check failed 2 tests; startsWith matching
instead of origin equality let the lookalike host through and failed the
lookalike test; dropping forced credentials failed the credentials test.
Verification of the issue's first box: the reject and allow tests, with a
stubbed global fetch recording that nothing is sent on rejection.

## 2026-09-23 14:11  Steps 4 and 5: guard tests

Worked: `test/helpers/no-network-scan.js` plus
`test/no-network.test.js`, `test/wiring.test.js`.
Found and fixed before anything was committed: the live scan test was
passing vacuously. The helper resolved the repo root one level short
(`test/helpers` -> `test`), so shippedFiles() was empty and the
assertion never ran. The first plant against dashboard.js stayed green and
that is what exposed it. Two attempts per the stuck rule: read the error,
then print the intermediate value, which showed the empty list. Fixed to
`path.join(__dirname, '..', '..')` and every plant went red as it should.
Also fixed: the scan compares full origins, not hosts, so http scheme swaps
are caught too, matching what net.js enforces at runtime.
Acceptance plants, each reverted: stray fetch in dashboard.js -> `not ok
27` with `dashboard/dashboard.js: fetch(`; WebSocket in background.js ->
`background.js: WebSocket`; evil origin in a string -> `dashboard.js:
origin https://evil.example.com`; scratch root with the same violations
under reference/ and tools/ -> no violations, proving the exclusion.
Wiring bites: service worker pointed at nope.js failed 2 tests; duplicate
tabs permission failed 2 tests.
Verification: `npm run test:all` exit 0, `# pass 41`, all browser ok
lines.
Next: review, PR, merge.
