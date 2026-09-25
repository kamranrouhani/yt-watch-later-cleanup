# Sprint 1 amendment: build cards escalate, and every merge is rebased first

- **Written:** 2026-09-25 08:25
- **Supersedes:** the build card rules in `2026-09-24-tiered-cards-amendment.md`
  (two review rounds, round 2 always hands on). Everything else in it stands.

## Why

The #12 build card stopped at 00:27 and sat blocked all night. Its round 2
review found that CI was red because `jsdom` was installed but never added
to `package.json`. A review run may not edit code, round 2 was the last
local round, and the card required green CI to complete, so nothing could
move it until a person did.

## Build cards now

- Up to three local review rounds. Rounds 1 and 2 may send the card back,
  round 3 always hands on to the gate.
- Every review round checks CI. Red CI is a finding like any other.
- The build card no longer needs green CI to complete. The finish card
  still does before it merges.
- A build card that stops on a problem code can fix gets one more local
  rework round automatically. If it stops again, it is completed as
  escalated, with the open problem listed, and the gate takes it.
- It only waits for Kamran on what code cannot solve: a capture, a live
  run, a product decision.

## Gate

When the build card arrives escalated, every open problem it lists becomes
a numbered gate finding, so the finish card fixes it.

## Final rebase before every merge

Once the finish review passes and the bookkeeping commit is in, the branch
is rebased onto the current `main`, the suites run again, and the branch is
pushed with `--force-with-lease`. The merge only happens after the required
`test` check is green on that rebased head. The merge itself stays a
regular merge commit. This replaces the earlier rule that a card branch is
never rewritten: that rule still holds for everyone outside the card and
for every step before this one.
