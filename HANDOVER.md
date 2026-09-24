# Handover

Starting point for any fresh session on this project. The detail lives in the
files this points to.

## Start a session

Issues now run as one kanban card each on board `yt-cleanup`: see
`docs/ORCHESTRATION.md` and
`tasks/0022-sprint-1/plans/2026-09-24-card-execution-amendment.md`. Check the
board before touching anything:

    hermes kanban --board yt-cleanup list

A session that is not a card (orchestrating, or a question) starts from this
file and those two. `KICKOFF.md` and `KICKOFF-2.md` are the prompts of the
two single-session runs, kept for the record.

## Where things are

```
README.md, ROADMAP.md, CONTRIBUTING.md   what, when, and the house rules
docs/RESEARCH.md                         facts checked before any code, open questions
docs/ARCHITECTURE.md                     modules, data model, rule semantics, safety
reference/upstream/                      the userscript every YouTube call is ported from
tasks/0022-sprint-1/                     sprint brief, loop, cursor, blocked list, log
  GOAL.md                                rules and git permissions for the sprint
  LOOP.md                                the per-issue workflow, steps 4 to 7 run inside each card
  plans/2026-09-24-card-execution-amendment.md  how cards replace the single loop
  KICKOFF.md, KICKOFF-2.md               the single-session prompts, kept for the record
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
| Merged | #1, #2, #3, #4, #5, #8, #9, #10, #11 (PRs 23 to 32, then #25 for #3) |
| Next | #33 (the `ensureTab` bug from Kamran's #11 checklist step 5), #24, then #6, the playlist parser, against the real fixtures merged in PR #25. One card each, chained |
| Waiting on Kamran | one branch deletion on GitHub (`feature/0004-sapisidhash-signing`). Everything capture-related is done and merged |

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
