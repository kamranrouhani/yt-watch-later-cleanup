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

## 2026-09-22 23:28  #1 scaffold, merged in PR #23

Worked: plan transcribed test first; 9 unit tests, syntax check, real Chrome
load test, CI. Merge commit 30ebe45. CI 9 of 9.
Added: the toolbar handler is a named `openDashboard` so the browser test
calls it twice and checks one dashboard tab, not just that a listener exists.
Did not work: the unit files fail as one file level ENOENT rather than per
test as the plan predicted; four progress log timestamps were estimated and
are corrected in that log.
Found: `node_modules/` is inside the unpacked extension, filed as #24. #22
pointed at `tasks/0001-sprint-1/`, fixed to 0022.
Unblocked: #2, #3, #4, #8, #10.
Then: #3 tooling done on its branch, draft PR #25, waiting on the capture
(BLOCKED.md on that branch). Working #4 meanwhile.

## 2026-09-23 14:06  #4 signing, merged in PR #26

Worked: upstream signing ported as src/core/auth.js, pickSapisid plus
buildAuthHeader with pinned vectors, 20 unit tests. Merge commit 1a2e715.
Found: upstream's cookie matcher takes the first repeated cookie and needs
no space before the equals sign; both pinned by tests.
Did not work: one transient push failure (reason lost to tail -1), and the
merge race left a stray origin branch the host deny rules will not let the
agent delete. Kamran needs to delete feature/0004-sapisidhash-signing from
origin once, it only holds commits already in the merge.
Unblocked: nothing yet, #5 still waits on #2.
Next: #2 net guard.

## 2026-09-23 14:12  #2 net guard, merged in PR #27

Worked: src/core/net.js createNet with an exact origin allowlist, the
no-network scan over shipped files, the wiring guard. 41 unit tests. Merge
commit b01562a. Every acceptance plant shown red then reverted.
Found and fixed before commit: the live scan test was passing vacuously,
its repo root resolved one directory short so it scanned nothing. Exposed by
a plant that stayed green, root cause found by printing the file list, both
attempts logged.
Unblocked: #5 (its last dependency closed).
Next: #5 InnerTube client.

## 2026-09-23 14:16  #5 innertube client, merged in PR #28

Worked: src/core/innertube.js, three calls, config injected, typed errors,
51 unit tests. Merge commit 8cd8a6b.
Found: the no-network guard caught my own first draft, which destructured
fetch out of deps and held a bare fetch( call. The client now calls
net.fetch on the injected net instance and the guard pattern was tightened
with a lookbehind, #2's plants re-proven red.
Unblocked: #9, #11.
Next: #8 rules engine (wave 2, no dependencies left) while #3 waits on the
capture. #6 stays blocked on #3.

## 2026-09-23 14:21  #8 rules engine, merged in PR #29

Worked: ruleModel.js (schema, tables, validate) and rules.js (evaluate),
69 unit tests, safety cases written first per the safety label. Merge
commit 6e2a940.
Found: the readme example's skipped count is 3, not the 1 my first test
expected; printed the real evaluation and fixed the test. The explicit
topic-missing guard is redundant with the generic undefined-field path,
noted as double enforcement.
Unblocked: nothing on its own (#13 also needs #12, #20 also needs #3).
Next: #10 storage wrapper and run log, the last workable wave 2 issue.
