# Progress: 2026-09-23-rules-engine

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

## 2026-09-23 14:18  Step 1: Plan

Worked: plan and this log, from main at a4de2aa.
Next: step 2, safety tests first.

## 2026-09-23 14:20  Steps 2 and 3: safety tests first, then the engine

Worked: the four safety tests written before any implementation, failing on
the missing module. Then src/core/ruleModel.js (schema, field and operator
tables, validate) and src/core/rules.js (evaluate). `# tests 69`,
`# pass 69`.
Found while testing: my readme-example expectation of skippedMissingData 1
was wrong, the real semantics give 3 (entry 3 and 5 miss the topic rule,
entry 4 matches topic but fails among-oldest and still saw the missing
topic on rule 1). Printed the actual evaluation, fixed the test, logged it.
Also fixed: operators that take no value (`== 0`, is-false, is-true) must
not demand a value in validate; validate is re-exported through rules.js
because the issue scopes validate into the rules module.
Bites, each restored: protect precedence inverted failed 2 tests; empty
conditions matching everything failed safety 2; missing data matching
failed 4; among-oldest strict less-than failed the boundary test; regex
validation removed failed the validate matrix. One bite did not bite:
removing the explicit topic-missing guard stayed green because the generic
undefined-field path also reports topic as missing. Double enforcement,
noted here rather than claimed as a proven test.
Next: step 4, review, PR, merge.
