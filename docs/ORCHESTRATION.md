# Orchestration

How an issue travels from GitHub to a merge commit on `main`. Issues are
worked one at a time, each in its own git worktree, and every change goes
through a review and green CI before it merges.

## One issue, three cards

Each workable issue gets three chained cards on the kanban board
`yt-cleanup`. They share the issue's branch and the first card's worktree,
and each starts only when the one before it is done.

1. **Build.** The worktree lives at `.worktrees/<card-id>` on the branch
   `feature/NNNN-<slug>` or `fix/NNNN-<slug>`, NNNN being the issue number.
   The work follows steps 4 to 7 of
   [`tasks/0022-sprint-1/LOOP.md`](../tasks/0022-sprint-1/LOOP.md): task
   folder, plan committed alone, failing test first, green suite, progress
   entry per step. It ends with a pushed branch and a PR that says
   `Closes #N`. A separate run then reviews it cold, runs the suite, and
   writes `tasks/NNNN-<slug>/reviews/YYYY-MM-DD-HHMM-review-r<round>.md`
   with its header taken from git. Round 1 may send the card back to
   implementation on the same branch; round 2 always hands on. The build
   card never merges.
2. **Gate.** Round 3 is a fixed review by a stronger reviewer than rounds 1
   and 2. It reads the PR cold, uses the earlier reviews as input, and
   writes `reviews/YYYY-MM-DD-HHMM-review-r3-gate.md` with numbered findings
   or none. It changes no code.
3. **Finish.** The gate's findings are fixed once, on the same branch. A
   review run checks each finding against the new commits and reruns the
   suites. A finding still open goes back for one more fix, then the card
   blocks for Kamran. When all are closed the finish card appends the
   issue's entry to the sprint log and moves `STATE.md` on, in a tasks-only
   commit on the PR branch, waits for the required `test` check on that
   head, and merges with a regular merge commit. The PR closes the issue.
4. **Close-out.** Tick the issue in the tracking issue (#22 for sprint 1) and
   take `blocked` off any issue whose last dependency just closed.

Issues labelled `safety` run as a single card instead, with all three
review rounds done by the stronger reviewer.

The issue's cards are chained to the previous issue's finish card, so one
issue is worked at a time. Code reaches `main` only through a merged PR.
Every card reports blocks, crashes, review verdicts and completion to
Kamran as they happen.

## Merge policy

Every card states `merge: auto` or `merge: approve`.

- `merge: auto`: the finish card merges once every gate finding is closed
  and the required check is green.
- `merge: approve`: the finish card stops there and waits for Kamran to
  merge the PR or to say go.

Sprint 1 cards are `merge: auto`, the grant in
[`tasks/0022-sprint-1/GOAL.md`](../tasks/0022-sprint-1/GOAL.md). A new
sprint or epic states its own policy in its plan. It never inherits one.

In every mode: no squash, no rebase merges, no force push, no direct commits
to `main`.

## Issues and cards stay in sync

- An issue that has a card carries the label `kanban:card`.
- The card body starts with `GitHub issue #N` and holds the acceptance boxes.
- The PR title names the change, the body says `Closes #N` and shows each
  acceptance box with the command that demonstrates it.
- When a card needs something only Kamran can provide, the request goes into
  `tasks/0022-sprint-1/implementation/BLOCKED.md`, is commented on the issue,
  and the card blocks until it arrives.
- Problems found along the way become new issues in the milestone, not
  silent scope growth on the current card.

## Working beside a running card

- Look first: `hermes kanban --board yt-cleanup list` for `running` or
  `review` cards, and `gh pr list`.
- Never check a card's branch out in the main checkout. Its worktree owns
  it, and a second checkout makes the next run fail to start.
- Never rebase or force push a branch a card owns.
- Work that is not part of a card happens on its own branch, merged through
  its own PR.

## CI

`.github/workflows/ci.yml` has one job, `test`: `npm ci`, `npm run check`,
`npm test`. Branch protection on `main` requires it, up to date with `main`.
It is a repository setting, not a file, so it does not show up in history.
The browser specs (`npm run test:browser`) run locally and in each review,
not in CI.
