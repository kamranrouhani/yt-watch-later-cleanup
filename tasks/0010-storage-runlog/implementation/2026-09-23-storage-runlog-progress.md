# Progress: 2026-09-23-storage-runlog

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

## 2026-09-23 14:22  Step 1: Plan

Worked: plan and this log, from main at 1ce15ea.
Next: step 2, fake storage and failing tests.

## 2026-09-23 14:27  Steps 2 to 4: tests first, then the modules

Worked: fake storage with a settable quota, both test files failing on the
missing modules, then src/core/storage.js and src/core/runLog.js.
`# tests 87`, `# pass 87`.
Found and fixed in the implementation: appendBatch mapped over an empty
list when the run was not yet persisted, losing the first batch of a fresh
run. persistStatus called run.toJSON before the handle existed; both now
share a serialise() helper.
Found and fixed in the tests: three of my planned bites did not bite.
The generic-error branch had no test (the fake only throws quota errors),
the eviction test replaced the whole list so it could not tell which log
was evicted, and no test wrote a non-log key over quota. Added: a
disk-on-fire set() failure, and an eviction test that writes the presets
key over quota and asserts only the oldest log is gone. Rereading the
issue also showed eviction belongs on any quota failure, not just log
writes, so the implementation was changed to match the issue text.
Also fixed: my first quota number (320) let the write fit without evicting;
computed the envelope sizes (both logs 273 bytes, one log 130, presets 77)
and set the quota to 280 so the first write genuinely fails and the retry
genuinely fits. One sed edit silently missed its target and cost a debug
loop, replaced with a patch.
Bites, each restored: set throwing non-quota errors failed the new warning
test; evicting the newest failed the eviction test; appendBatch in memory
only failed the truthfulness test; finish not persisted failed 2 reload
tests; export dropping matchedRule failed the export test.
Verification: `npm run check` `all files parse`, `npm test` `# tests 87`,
`# pass 87`.
Next: step 5, review, PR, merge.
