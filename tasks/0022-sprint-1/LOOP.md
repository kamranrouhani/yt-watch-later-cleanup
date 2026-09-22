# The loop

You are working through sprint 1, one issue at a time, until the sprint is
done or you reach a stop condition. Read this file at the start of every
issue. It is the only workflow.

**One cycle = one issue.** Not two issues because they look related.

## Files that matter

| File | What it is | You may write it? |
|---|---|---|
| `tasks/0022-sprint-1/GOAL.md` | Rules and permissions | No |
| `tasks/0022-sprint-1/plans/2026-09-22-sprint-1.md` | Waves and dependencies | No, supersede instead |
| `tasks/0022-sprint-1/implementation/STATE.md` | Five line cursor | Yes, overwrite each cycle |
| `tasks/0022-sprint-1/implementation/2026-09-22-sprint-1-progress.md` | Sprint log, one entry per issue | Append only |
| `tasks/0022-sprint-1/implementation/BLOCKED.md` | Requests waiting on Kamran | Append |
| `tasks/000N-*/` | One folder per issue: plan, progress, reviews | Yes, following the rules |

`STATE.md` is a cursor so you never have to read a long log to find your
place. The progress logs are the record. If they disagree, rebuild `STATE.md`
from the logs.

## The cycle

Print the step numbers as you go.

### 1. Orient

```bash
bash tasks/0022-sprint-1/scripts/status.sh
```

Read its output and `STATE.md`. If the worktree is dirty with changes you did
not make, stop and ask.

### 2. Pick the issue

The issue in `STATE.md`. If that is done, the lowest numbered issue in the
earliest unfinished wave without the `blocked` label:

```bash
gh issue list --milestone "Sprint 1: scan, rules, preview, remove" --state open \
  --search "-label:blocked" --json number,title
```

Read the issue in full with `gh issue view N`, then read the next issue in the
same area. Reading ahead stops you writing something the next issue deletes.

### 3. Gate

If any of these is true, go to the stop conditions.

- The issue needs something only Kamran can provide, and it is not already
  in the repo or under a `raw/` capture folder.
- A dependency named in "Depends on" is not closed.
- An open entry in `BLOCKED.md` affects this issue.

### 4. Plan

Create `tasks/000N-<slug>/` with `plans/`, `implementation/`, `reviews/`.
Write `plans/<date>-<slug>.md`: goal, decisions, numbered steps with the test
to write first, the exact commands and the output you expect, and a table
mapping each acceptance box to how it will be shown. Seed the progress log
with the same header as `tasks/0001-scaffold-extension`.

For #1 the plan and its seeded progress log are already on `main`. Skip
writing one: create the branch and go straight to step 5.

For every later issue, commit the plan on its own on the new branch before
any code:

```bash
git checkout main && git pull --ff-only
git checkout -b feature/000N-<slug>
git add tasks/000N-<slug> && git commit -m "add the plan for <thing>"
```

### 5. Build, test first

For each step in your plan:

1. Write the failing test. Run it. **Watch it fail for the right reason.**
2. Write the smallest code that passes.
3. Run `npm run check && npm test`. Paste the summary lines.
4. Commit when a coherent piece is green. Small commits, human messages.
5. Append a progress entry for the step.

Porting from upstream: first commit the port with behaviour identical to the
original, then restructure in a separate commit.

`safety` issues: write every safety acceptance box as a test before any
implementation code.

### 6. Exercise it

Beyond the unit tests:

- Prove each new test can fail: break the code, watch it go red, restore.
- Run the real thing where the host allows: load the extension with
  Playwright, drive the flow, take a screenshot if it is UI.
- Write `implementation/manual-check.md` for what cannot run here, numbered,
  each step with the expected observation.

### 7. Review

Review your own diff against the issue and against `GOAL.md`. Write it to
`reviews/<date>-<HHMM>-pre-merge.md` with this header, filled from commands:

```bash
git rev-parse --abbrev-ref HEAD
git merge-base HEAD main
git rev-parse --short HEAD
git log --oneline $(git merge-base HEAD main)..HEAD
```

Check at least: every acceptance box met, no attribution
(`git log --format=%B main..HEAD`), no dashes (`grep -rnP '\x{2014}|\x{2013}'`
over changed files), no comments addressed to a person, no secrets in the
diff, task files in separate commits. Fix what it finds, then note the fixes
in a second review or the progress log. Never edit the first review.

### 8. Ship

```bash
git push -u origin HEAD
gh pr create --title "<plain title>" --body-file <file>   # includes "Closes #N" and the evidence
gh pr checks --watch
gh pr merge --merge
git checkout main && git pull --ff-only
```

Then close out: tick the issue in #22, remove `blocked` from issues whose
last dependency just closed, append one entry to the sprint progress log,
overwrite `STATE.md` with the next issue.

### 9. Continue

**If the next issue passes the gate, start the next cycle immediately.** Do
not stop to report, do not ask "shall I continue?". Running many issues in a
row is expected.

## Stop conditions

There are exactly four. Nothing else stops you.

**A. Kamran is needed.** Append to `BLOCKED.md` under today's date and the
issue number: what you need, what it is for, how to produce it in numbered
steps, what it must not contain. Tell him in your reply. While waiting, move
on to another unblocked issue in the same or an earlier wave if there is one.
Stop only when nothing is workable.

**B. A push, CI run or merge fails in a way you did not cause.** Report the
exact error and the commit hash. Do not work around it.

**C. You are stuck.** See below.

**D. The sprint is done.** Every issue closed, `npm run test:all` green on
`main`. Write the sprint review into `tasks/0022-sprint-1/reviews/` and
report.

## When you are stuck

**Attempt 1.** Read the actual error, then the file you just wrote. Fix it.

**Attempt 2.** Print the intermediate value. Find out what the code really
does before changing it again.

**No attempt 3.** Revert this step's changes, log both attempts in the
progress log, and report what you expected, what happened with real output,
what you tried, and your best guess.

Never, when stuck: change a test to pass without saying why first, wrap a
failure in `try/catch`, skip the issue, delete an assertion, write a second
implementation beside the broken one, or disable a check. Two honest failed
attempts and a clean revert is a good cycle.

## Anti-drift, re-read every third issue

1. One issue per cycle, one branch per issue.
2. Plans are frozen once work starts. Supersede, never edit.
3. Progress logs are append-only.
4. No comments to a person. No AI attribution. No em or en dashes.
5. Task files never share a commit with code.
6. Every network call goes through `src/core/net.js` (from #2 on).
7. Every file the extension injects is listed in `manifest.json`;
   `test/wiring.test.js` enforces it from #2 on.
8. The remover only ever receives a plan built from a preview.
9. Missing data never matches a remove rule.
10. Regular merge commits only. Never squash.
11. Never fabricate output.

## What a good report looks like

```
Issue #4, Port SAPISIDHASH request signing. Merged in PR #24.

Tests:  npm test  # pass 31  # fail 0
Failing first: auth.test.js failed with "Cannot find module ../src/core/auth.js"
Proved it bites: swapped origin and sapisid in the hash input, 2 tests red, restored.
Hit a problem: the first test vector used milliseconds. Upstream uses seconds
  (Math.floor(Date.now() / 1000)). Fixed the test input, logged it.
Manual: nothing, pure module.
Unblocked: #5 (still waits on #2)
Next: #8 rules engine, starting now.
```

## STATE.md shape

```markdown
# STATE

CURRENT ISSUE: #1
WAVE: 1
LAST COMPLETED: none
BLOCKED ON: nothing
UPDATED: 2026-09-22
```
