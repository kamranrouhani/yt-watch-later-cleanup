# Sprint 1 amendment: one card per issue

- **Written:** 2026-09-24 04:55
- **Amends:** `2026-09-22-sprint-1.md` and
  `2026-09-22-autonomous-execution-amendment.md`. It replaces how the
  sprint is executed, not what it builds. Waves, dependencies, the
  acceptance boxes, `GOAL.md` and its hard rules all stand.

## Why

Session 1 ran the loop in one long session. It merged eight issues, but the
session grew to 715k tokens of context and every call resent it, so it cost
about 34M tokens for 135k of output. Running each issue in a fresh session
with the repository as the only handover keeps every call small, and a
separate review run reads each change cold instead of the author grading
its own work.

## How the rest of sprint 1 runs

One kanban card per issue on board `yt-cleanup`, chained in wave order.
`docs/ORCHESTRATION.md` describes the flow. Against `LOOP.md`:

| LOOP.md step | Now |
|---|---|
| 1 Orient | Inside the card's worktree `.worktrees/<card-id>`, after `git fetch origin && git rebase origin/main`. `status.sh` still works there |
| 2 Pick the issue | The card names it. The orchestrator picks, using the same rule |
| 3 Gate | Unchanged. A failed gate blocks the card with `needs_input` |
| 4 to 7 | Unchanged, done by the implementation run. Step 7's self review keeps its name, `reviews/<date>-<HHMM>-pre-merge.md` |
| 8 Ship | Split. The implementation run pushes and opens the PR. A separate review run writes `reviews/<date>-<HHMM>-review-r<round>.md`, requests changes or approves, then does the bookkeeping on the PR branch and merges |
| 9 Continue | Replaced by the card chain. The next card starts when the previous one is done |

Bookkeeping moves before the merge: the sprint log entry and the new
`STATE.md` go into a tasks-only commit on the PR branch, so they land with
the merge commit and nothing is pushed to `main` directly. Ticking #22 and
removing `blocked` labels happen right after the merge, on GitHub only.

Review rounds are capped at three. After the third, the reviewer approves
and lists what remains as residual risk, or blocks for Kamran.

## Merge policy

`merge: auto` for every sprint 1 card. That is the pre-approval in
`GOAL.md`, unchanged in scope: `origin` only, regular merge commits, no
squash, no force, no identity changes. Sprint 2 states its own policy.

## Order from here

1. #33 ensureTab waits for the tab to answer (found by the #11 manual check)
2. #24 keep dev files out of the loaded extension
3. #6 playlist parser, against the real fixtures from #3
4. #7 scanner, then the dashboard chain #12 to #16, in wave order

#17 needs Kamran live and gets a card that starts blocked.

Cards are created a few at a time rather than all at once, so each body can
point at what the previous merge actually changed.

## What stays for a manual session

A session that is not a card reads `HANDOVER.md` and this file, and checks
the board before touching anything. `KICKOFF-2.md` is kept for the record.
