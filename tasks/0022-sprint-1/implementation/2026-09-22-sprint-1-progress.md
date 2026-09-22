# Progress: 2026-09-22-sprint-1

## 2026-09-22 21:20  Setup: repository, docs, issues

Worked: public repo `kamranrouhani/yt-watch-later-cleanup`, MIT. Upstream
userscript kept whole under `reference/upstream/` at 01bbde3 with its
SHA-256, rather than as forked history, so the project is not shaped by the
upstream layout. Credit sits in README and LICENSE.

Found: upstream has no LICENSE file, only an MIT line in its README and
`@license MIT` in the script header. The upstream notice in our LICENSE is
reconstructed from those, and `reference/upstream/README.md` says so.

Decided: task folder number equals issue number, so resuming needs no index.
Sprint planning is task 0022 after tracking issue #22. CONTRIBUTING updated
to match.

Created: labels, milestones for sprints 1 and 2, issues #1 to #21, tracking
issue #22. Every issue except #1 carries `blocked` until its dependencies
close.

Did not work: a GitHub Projects board. `gh project list` fails with
"authentication token is missing required scopes [read:project]"; the token
has `gist`, `read:org` and `repo` only. The milestone and #22 are the board
for now. Adding one needs `gh auth refresh -s project`, which is an
interactive login Kamran has to do.

Next: #1, scaffold.

## 2026-09-22 21:25  Setup: licence detection fix

Did not work: combining both MIT notices in the root LICENSE. GitHub's
licence detection reported `NOASSERTION` instead of MIT, so the repo showed
no licence at all.

Worked: root LICENSE now holds only our notice. The reconstructed upstream
notice moved to `reference/upstream/LICENSE`, next to the code it covers.
README credit and `reference/upstream/README.md` point there.

Next: #1, scaffold.

## 2026-09-22 23:05  Setup: handover to a fresh session

Worked: built the whole #1 scaffold in a scratch directory first and ran it.
`npm run check` parses, `npm test` 9 of 9, `npm run test:browser` loads the
extension in the pinned Chrome and renders the dashboard with no errors.
Proved the tests bite: removing `constants.js` and `dashboard/` failed 5
unit tests, a throwing `dashboard.js` failed the browser test. The proven
files are transcribed into `tasks/0001-scaffold-extension/plans/`.

Worked: GOAL, LOOP, KICKOFF, status.sh, STATE, BLOCKED, reviews README, root
HANDOVER. Amendment plan records the pre-approved git writes. status.sh ran
against an empty log, a populated log and a populated blocked list, and with
the scaffold files present; each section read correctly.

Did not work: a single smoke test file for both the wrapper and the manifest.
It mixed two concerns and made the fail-first step for #1 muddy, so it is
split into `core-wrapper.test.js` and `manifest.test.js`.

Moved: the local folder is `/root/projects/yt-watch-later-playlist-cleanup`
again. Renaming it earlier broke the workspace Kamran had pointed at it.

Next: fresh session starts #1 from KICKOFF.md.
