# Orchestration: kanban epic pipeline (2026-09-24)

This repo now runs its tickets through a kanban epic pipeline. Written by the
metis session that set it up; update this file when the pipeline changes.

## What happens to a GitHub issue

For engineering issues (not human-blocked spike steps):

1. metis (orchestrator session) creates a kanban card on board `yt-cleanup`,
   one per issue, body self-contained: issue number, acceptance criteria,
   branch `feature/NNNN-<slug>`, required CI check, review round cap.
2. Board assigns it to `metis-dev`. A fresh session runs the card in its own
   git worktree: task folder, failing test first, implement, green suite,
   commit, push, DRAFT PR, progress-log entry. Then same-card review.
3. `metis-review` (fresh session) reviews the PR: writes a review in
   `tasks/0022-sprint-1/reviews/`, approves (`kanban_complete`) or
   `kanban_request_changes` (spawns a NEW implementer session). Max
   3 review rounds; then approve-with-residual-risk or block.
4. Merge card (linked child), regular merge commit only, never squash,
   never force, only when required CI check `test` is green on main.
   - merge policy per epic: `merge: approve` (default; Kamran unblocks or
     merges) or `merge: auto` stated in the epic plan.
5. Next ticket's card is linked behind the merge card: strictly one
   ticket runs at a time, each in a fresh session.

## Issue/card sync rules

- Every engineering issue that gets a card gets label `kanban:card`.
- Card body starts with `GitHub issue #NNN`. PR title carries the issue
  scope. Merge comment references the issue, closing it.
- A worker never edits issue state directly except closing it via the
  merge, and commenting progress with the card id.
- If a worker blocks with needs_input, it comments the block reason on
  the issue too, so GitHub shows exactly what Kamran must do.

## How CI was added

Via `gh api ... /branches/main/protection` (the GitHub REST API), NOT via
commits: branch protection is repository settings, not files in git, so
there are no new commits for it. Context `test` (the name of the only job
in .github/workflows/ci.yml) is required, strict up-to-date enforcement on.

## How to not step on an already-running session

- Kanban worktrees are per-card (`.worktrees/<card-id>`), so concurrent
  sessions never share an index or branch.
- One dispatcher (argos's gateway) claims cards atomically; a card can't
  run twice.
- Before writing to the shared repo from a manual session, check
  `hermes kanban --board yt-cleanup list` for `running` cards and the
  PR list; if a sprint is executing, do interactive work on OTHER
  branches, not the sprint's.
- Never rebase/force-push a branch while a card owns it.

## Profiles and models

- `metis` Opus 5.5 primary (glm-5.2 -> glm-5.3 -> glm-5.3-flash fallbacks):
  plans epics, creates cards, wraps them up.
- `metis-dev` Sonnet 5 primary (glm-5.3-flash -> glm-5.2 -> deepseek-v4-flash):
  implementation cards.
- `metis-review` Opus 5.5 primary (same glm fallbacks): review + merge.
- LM quota exhaustion in a card: card requeues (rc75), no failure counted.
- Card bodies carry explicit `merge: approve/auto`, even though boards have a default.
