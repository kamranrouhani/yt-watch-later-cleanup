# Goal: sprint 1

Build the first working version of Watch Later Cleanup: a Chrome extension
whose dashboard scans a YouTube Watch Later playlist, filters it with remove
and protect rules, previews exactly what would go, and removes it in batches
with a log. Sprint 1 is issues #1 to #17, tracked in #22.

## The repository

| | |
|---|---|
| Path | `/root/projects/yt-watch-later-playlist-cleanup` (the folder name differs from the repo name, that is fine) |
| Remote | `origin` = `git@github.com:kamranrouhani/yt-watch-later-cleanup.git`, public |
| Kind | Personal project. MIT |
| Identity | `Kamran Rouhani <kamran.rouhani@outlook.com>`, already what the repo resolves to. No signing key configured |
| Default branch | `main`. Squash and rebase merges are disabled on GitHub. Merged branches auto-delete |
| Gitea mirror | Created automatically. Never add or push to a Gitea remote yourself |

## Read before your first line of code

1. `docs/ARCHITECTURE.md`: modules, data model, rule semantics, safety
   design. Every issue implements a piece of it.
2. `docs/RESEARCH.md`: what the official API cannot do, why the upstream code
   was chosen, and five open questions. #3 answers them.
3. `CONTRIBUTING.md`: code style, the no-network rule, removal safety rules,
   the workflow. These are the repository's own rules and they win.
4. `tasks/0022-sprint-1/plans/2026-09-22-sprint-1.md`: waves, dependencies,
   risks.
5. The plan for the issue you are on, in `tasks/000N-*/plans/`. For #1 it
   exists and its code is already proven. For later issues you write it.

`reference/upstream/yt-watch-later-tools.user.js` is the source of every
YouTube call you will port. Read the functions an issue names before porting
them. Never edit that file.

## What you are allowed to do

**Git writes are pre-approved for this sprint.** Kamran said so explicitly.
You do not ask before any of these, on this repository, on `origin`:

- create and switch branches named `feature/000N-<slug>` or `fix/000N-<slug>`
- commit, and amend or rebase your own unpushed or unmerged work when that is
  cheap and clean
- push your branches, and push `main` after a merge
- open pull requests with `gh pr create`, comment on them, and merge them with
  a **regular merge commit** (`gh pr merge --merge`)
- close and relabel issues, tick boxes in #22, remove `blocked` labels
- create follow-up issues for problems you find

Still forbidden, approval or not:

- **Never squash-merge.** Never `--squash`, never `--rebase` on merge
- **Never force-push `main`**, never rewrite anything already merged. On your
  own unmerged branch, `--force-with-lease` is fine
- **Never push anywhere except `origin`.** Never add remotes
- **Never change git identity or signing config**
- **Never bypass a failing check.** No `--no-verify`, no disabling CI, no
  editing a test to make it pass without saying why in the progress log
  first
- If a push is rejected, stop and report the exact error. Do not work around it

## Hard rules

These are standing rules for everything that lands in the repository or on
GitHub.

1. **No AI attribution, anywhere.** No `Co-Authored-By` naming a model, agent,
   assistant or bot. No "Generated with", "AI-assisted", robot emoji, or any
   trailer or footer naming a tool. Not in commits, PR text, issue comments,
   code, or docs. Check with `git log --format=%B` before every push.
2. **Write like Kamran.** Commit subjects are plain, imperative, lowercase, no
   trailing period, no prefix scheme. Look at `git log --oneline` for the
   voice. A body only when the why is not obvious. Vary the phrasing, a series
   of identically shaped messages is itself a tell. PR descriptions are short
   prose plus the acceptance evidence, not "Summary / Changes / Testing"
   scaffolding.
3. **No em dashes or en dashes** in anything you write: code, commits, PRs,
   docs, the progress log, your replies. Use a full stop, comma or colon.
4. **No comments by default.** Rename or restructure instead. Comment only for
   a constraint the code cannot express, such as where a magic InnerTube value
   came from. Never a comment addressed to a person, never "as requested",
   never "changed this", never a TODO for Kamran.
5. **Task files commit separately** from code. A commit touches `tasks/` or it
   touches everything else, never both.
6. **Plans are frozen once work starts.** If an approach changes, write a new
   dated plan in the same `plans/` folder that says what it supersedes.
7. **Progress logs are append-only.** An entry at the end of every step,
   including what failed. Never tidy.
8. **Reviews are kept.** Every review goes to `reviews/` with git metadata
   produced by running commands, never typed from memory. Never edited or
   deleted afterwards.
9. **Never fabricate output.** Paste real command output. If something could
   not be run, say so. An honest blocker beats an invented success.
10. **No secrets in commits.** No cookies, tokens, API keys, `SAPISID` values,
    or unscrubbed captures. Check staged content before every commit.

## Test it, do not just build it

Kamran wants every feature exercised before it is reported done, not only
unit tested. For each issue:

- Run the whole suite, and the browser harness once it covers the feature.
- Prove each new test can fail: break the code briefly, watch the test go
  red, restore.
- Actually run the thing: load the extension, drive the flow, look at the
  result. A green unit suite is not proof that an extension works.
- Say plainly what could not be exercised from this host (a real signed-in
  YouTube session, a real toolbar click) and put it on a manual checklist
  in the task's `implementation/manual-check.md`, each step with the expected
  observation.

## What you cannot do from this host

- **No signed-in YouTube session.** Nothing that needs Kamran's cookies can
  run here. The real responses come from #3, captured by Kamran.
- **No real toolbar click** in headless Chrome. Assert the listener instead
  and put the click on the manual checklist.
- **No visible browser.** Screenshots through Playwright are fine and useful.

## Ask Kamran when something would help

Do not guess when a real artifact would settle it. Write the request into
`tasks/0022-sprint-1/implementation/BLOCKED.md` and tell him in your reply,
as a short numbered list he can do in five minutes. Things that are likely to
help, and are fine to ask for:

- running the capture snippet on his signed-in Watch Later page (#3)
- a saved copy of the Watch Later page (`Ctrl+S`, "Webpage, Complete") or a
  HAR export from DevTools while scrolling it and removing one video
- screenshots of the page or of the extension in his browser
- a Google Takeout export of his Watch Later playlist, for the added-date
  question
- a YouTube Data API key, when sprint 2 starts
- his opinion on UI when a design choice is genuinely a matter of taste

Always say what the artifact is for and what it must not contain. Captures
from a signed-in session contain cookies and personal data: ask for them to
be put under a gitignored `raw/` folder, never committed, and scrub before
anything reaches `test/fixtures/`.

## Done, for one issue

1. Every acceptance box in the issue is shown with a command and its real
   output, in the PR description.
2. `npm run check` and `npm test` are green locally and CI is green on the PR.
   From #16 on, `npm run test:browser` too.
3. Each new test was seen failing before it passed.
4. The feature was exercised for real where the host allows it, and the rest
   is on a manual checklist.
5. The task's progress log has an entry per step.
6. A review is written to the task's `reviews/`.
7. The PR is merged with a regular merge commit, the issue is closed, #22 is
   ticked, and `blocked` is removed from anything now unblocked.

## Done, for the sprint

A real Watch Later cleanup runs from the dashboard following
`docs/LIVE-CHECKLIST.md`, the removed set equals the previewed set, and
`npm run test:all` is green on `main`.
