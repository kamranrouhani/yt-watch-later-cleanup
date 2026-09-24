# Handover

Starting point for any fresh session on this project. The detail lives in the
files this points to.

## Start a session

Paste the contents of `tasks/0022-sprint-1/KICKOFF-2.md` as the first
message. It points the new session at everything below and at what has
already merged. `KICKOFF.md` is the session 1 prompt, kept for the record.

## Where things are

```
README.md, ROADMAP.md, CONTRIBUTING.md   what, when, and the house rules
docs/RESEARCH.md                         facts checked before any code, open questions
docs/ARCHITECTURE.md                     modules, data model, rule semantics, safety
reference/upstream/                      the userscript every YouTube call is ported from
tasks/0022-sprint-1/                     sprint brief, loop, cursor, blocked list, log
  GOAL.md                                rules and git permissions for the sprint
  LOOP.md                                the per-issue workflow
  KICKOFF.md                             the session 1 prompt, kept for the record
  KICKOFF-2.md                           the paste-once prompt from here on
  scripts/status.sh                      read-only orientation, run first each cycle
  implementation/STATE.md                which issue is current
  implementation/BLOCKED.md              what is waiting on Kamran
  implementation/open-items-for-kamran.md  Kamran's checklist, what he must do
tasks/000N-<slug>/                       one folder per issue, same number as the issue
```

## Where the project stands

| | |
|---|---|
| Repo | https://github.com/kamranrouhani/yt-watch-later-cleanup, public, MIT |
| Local | `/root/projects/yt-watch-later-playlist-cleanup` |
| Sprint 1 | issues #1 to #17, tracking issue #22 |
| Sprint 2 | issues #18 to #21 |
| Merged | #1, #2, #4, #5, #8, #9, #10, #11 (PRs 23, 26 to 32) |
| Next | #3 resumes at step 9 of its plan when the capture file lands. #24 is workable while waiting |
| Waiting on Kamran | the capture run, two manual checklists, one branch deletion. All in `tasks/0022-sprint-1/implementation/open-items-for-kamran.md` |

## Environment on this host

| | |
|---|---|
| Node | v22, `node --test` built in |
| Chrome for Playwright | `/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`, override with `WL_CHROME` |
| gh | logged in as `kamranrouhani`, scopes `gist`, `read:org`, `repo`. No `project` or `workflow` scope |
| Push | SSH to GitHub works. Workflow files can be pushed over SSH despite the missing `workflow` scope |
| Sibling project | `/root/projects/amazon-order-scraper` uses the same stack and conventions. Its `test/browser/extension.spec.js` and `CONTRIBUTING.md` are good references |

## Things that would be easy to get wrong

- **Watch Later is not in the public API.** Do not reach for `playlistItems`.
  Everything goes through `youtubei/v1` from a youtube.com tab, as upstream
  does. See `docs/RESEARCH.md`.
- **Position means oldest first only after the sort is verified.** Upstream
  sets `ACTION_SET_PLAYLIST_VIDEO_ORDER` and polls until the server confirms.
  Skipping that turns "remove the oldest 300" into "remove 300 at random".
- **The remover must never evaluate rules itself.** It takes a frozen plan
  built from the preview the user saw. That is the core safety property.
- **Captures from a signed-in session are full of secrets.** Cookies,
  `SAPISID`, `visitorData`, account names. They live under a gitignored `raw/`
  and are scrubbed before anything reaches `test/fixtures/`.
- **Headless Chrome cannot click the toolbar icon.** Assert the listener and
  put the click on the manual checklist.
