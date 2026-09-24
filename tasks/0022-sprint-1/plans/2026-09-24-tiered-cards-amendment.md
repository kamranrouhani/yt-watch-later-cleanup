# Sprint 1 amendment: three cards per issue

- **Written:** 2026-09-24 21:58
- **Supersedes:** the "How the rest of sprint 1 runs" and round cap parts of
  `2026-09-24-card-execution-amendment.md`. Its bookkeeping rules, merge
  policy and the waves, dependencies and acceptance boxes of the sprint plan
  all stand.

## Why

The five issues merged since the card switch (#33, #24, #6, #35, #7) took
two or three review rounds each, and every round ran on the most expensive
tier. Most of what those rounds caught was ordinary: a missing progress
entry, a stale PR body, a test that hung instead of failing. The findings
that mattered came from the last, strictest review. So the cheap rounds move
to a cheaper tier, and the strongest review becomes a fixed gate that every
issue passes through before it can merge.

## How an issue runs now

Three chained cards on board `yt-cleanup`, all on the issue's branch and in
the first card's worktree:

1. **Build.** Implementation as before (`LOOP.md` steps 4 to 7, PR with
   `Closes #N`), then up to two review rounds. Round 1 may send it back once;
   round 2 always hands on. It never merges. Done means an open PR with the
   required `test` check green and a list of anything the reviewer still
   doubts.
2. **Gate.** One review by the stronger tier, round 3 of the issue. It reads
   the PR cold with the build reviews as input, writes
   `reviews/<date>-<HHMM>-review-r3-gate.md`, and lists numbered findings or
   none. It changes no code and never merges.
3. **Finish.** The stronger tier fixes the gate's findings, once. A review
   run then checks each finding against the new commits and reruns the
   suites. A finding left open goes back to the fixer once more, then
   blocks for Kamran. When all are closed it does the bookkeeping and merges
   exactly as before.

Issues labelled `safety` skip the tiers and run all three rounds on the
stronger tier, in the single-card flow of the earlier amendment.

## Merge policy

Unchanged: `merge: auto`, regular merge commits, no squash, no force, no
direct commits to `main`. Only the finish card merges.

## Notifications

Every card reports its terminal events (blocked, crashed, review verdicts,
done) to Kamran directly, so no session has to sit and watch the board.

## Order from here

1. #12 dashboard table, the first issue on the three-card flow
2. #13 to #16 in wave order, each queued once its dependencies close
3. #14 and #15 are `safety`: stronger tier throughout

#17 still needs Kamran live and gets a card that starts blocked.
