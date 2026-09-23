# Progress: 2026-09-23-batched-remover

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

## 2026-09-23 14:29  Step 1: Plan

Worked: plan and this log, from main at 8fc25b5.
Next: step 2, safety tests first.

## 2026-09-23 14:43  Steps 2 and 3: safety tests first, then the remover

Worked: safety tests (plan gate, freezing, batch limits) written before
implementation, failing on the missing module. Then src/core/remover.js.
`# tests 101`, `# pass 101`.
Rough edge, recorded: while proving the batch-limit bite, my bite loop
killed its own restore step (a pkill pattern matched the driving shell
itself), leaving the guard removed on disk. The suite then deadlocked:
batchSize 0 with no guard loops forever slicing empty batches. Diagnosed by
bisecting test files, then the single test, then a probe script, then
reading the file, which showed `if (false)` still on line 69. Restored.
The deadlock was the bite proving itself harder than intended: the guard
exists precisely because batchSize 0 must never reach the loop.
Bites, each restored: unfrozen lookalike accepted failed the plan gate
test; batch guard removed (the deadlock above); pause after the last batch
failed the pause test; signal ignored failed the abort test; off-by-one
batch slicing failed 3 tests; ACTION_REMOVE_VIDEO dropped failed the exact
payload test. Two small test-message alignments: the fake's 429 message
and the empty-preview wording.
Verification: `npm test` `# tests 101`, `# pass 101`, exit 0, no hang.
`npm run check` `all files parse`. `npm run test:browser` 2 ok lines.
Next: step 4, review, PR, merge.
