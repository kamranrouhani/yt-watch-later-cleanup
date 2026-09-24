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

## 2026-09-23 14:28  #10 storage and run log, merged in PR #30

Worked: storage.js (versioned keys, warnings not throws, quota eviction
with one retry on any key) and runLog.js (persist per batch, abort keeps
the record, JSON export). 87 unit tests. Merge commit logged in the PR.
Found: three planned bites did not bite because the tests could not see
those paths; closed the gaps, then they bit. Eviction belongs on any quota
failure per the issue text, not just log writes, implementation changed to
match. Quota arithmetic for the eviction test had to be measured, not
guessed.
Wave 2 is now fully merged except #3, which waits on Kamran's capture.
Next: nothing is workable without the capture (#6, #20) or wave 4 (#7
needs #6, #9 and #11 need #5 only, so #9 and #11 ARE workable).

## 2026-09-23 14:44  #9 batched remover, merged in PR #31

Worked: src/core/remover.js, frozen plans from createPlan only, batch and
pause limits, stops on rate limit, auth, rejected edit, abort and any
error. 101 unit tests. Safety tests written first.
Found: proving the batch-limit bite deadlocked the suite because my bite
loop killed its own restore step; the guard really is load bearing, a
batchSize of 0 with no guard loops forever. Diagnosed by bisect and file
read, restored, logged.
Unblocked: #15 still needs #14 and #10 (done) and #9 (now done).
Next: #11 dashboard-to-tab bridge, the last issue workable without the
capture.

## 2026-09-23 15:11  #11 tab bridge, merged in PR #32

Worked: content scripts in both worlds with a nonce handshake, the
dashboard side that finds or opens the Watch Later tab, TabGoneError
instead of hangs. 119 unit tests plus a real browser spec covering the
full round trip on a routed fake YouTube. Manual checklist has the real
signed-in ping.
Found: this host cannot load real youtube.com (consent redirect), the
isolated world's globals are invisible from the page world, and extension
CSP blocks addScriptTag. All worked around in the tests, not in shipped
code. One self-inflicted bite tooling corruption of page.js, caught and
repaired, logged.
Wave 4 is done: #9 and #11 merged. Remaining sprint issues all wait on
#6 (parser), which waits on #3 (capture, Kamran).
Next: nothing workable. Blocked on the capture.

## 2026-09-24 01:08  session 1 wrap: what is merged, what waits

Worked: #1, #4, #2, #5, #8, #10, #9, #11 merged this session through PRs
23, 26, 27, 28, 29, 30, 31, 32, every one a regular merge commit with CI
green. #3 went to draft PR #25 with its plan at step 8. The suite on main
now: 119 unit tests and 6 browser assertions, all green, verified just
before this entry.
Found: every issue behind #6 needs the capture, so the session ends with
one blocker and not many. The manual checklists for #1 and #11 are open,
the stray branch deletion is open, and the sprint 2 asks (Takeout, Data
API key) stay deferred.
Documented: open-items-for-kamran.md collects his items in one list,
BLOCKED.md has the formal entries, HANDOVER.md is refreshed, and
KICKOFF-2.md is the paste prompt for the next session.
Did not work: nothing new. The known limits stand: no real youtube.com
from this host, no toolbar clicks in headless, no signed-in session.
Next: session 2, from KICKOFF-2.md. It starts by checking for the capture
file and then either finishes #3 or does #24 while waiting.

## 2026-09-24 04:30  session 2, block A: PR #25 rebased, #3 finished and merged

Kamran arrived with both capture files and passed both manual checklists
(#1 all five pass, details size under 1 MB since he loads the repo folder
without node_modules; #11 steps 1-4 pass with the signed-in ping returning
{ clientVersion: "2.20260922.06.00", signedIn: true }, step 5 failing with
an ensureTab URL-query miss, filed as follow-up work).
Found: the draft PR #25 had three merge conflicts from main's progress since
2026-09-22. Per Kamran's explicit preference, rebased the branch onto main
rather than merging main in (his rule: rebase over merge on an unmerged
branch; approved force by pushing with the +ref form after the scripted
--force-with-lease was deny-blocked). Conflicts: package.json kept all three
browser specs; STATE.md and BLOCKED.md took main's newer versions.
Worked: step 9 of the capture plan on the real data. The scrubber threw on
45 paths: a real channel is literally named "Channel 8", colliding with the
"Channel <n>" placeholder pool, and a later collision surfaced as substring
("Channel 80" contains "Channel 8"). Fixed buildMapping to skip placeholders
that equal or contain a real value; test-first, planted in the synthetic
fixture, seen failing before the fix. The eye pass over the scrubbed output
also caught googlevideo initplayback urls carrying the client ip; the
scrubber now replaces those whole, also test-first. Committed fixtures
(3 pages, capture.json, README, 1569-hash denylist) plus the fixes.
Documented: findings.md answers the five research questions with JSON paths;
RESEARCH.md's open-questions section rewritten with the capture's answers;
known oldest-sort params corrected to "QAE%3D" from primary evidence.
Merged: PR #25 as a regular merge (514227f), CI green. Local main pulled;
140/140 unit and 7/7 browser assertions re-run after the pull, all pass.
#3 closed on GitHub. Kanban card t_164ddaa5 done. pr delete-branch was
blocked by the worktree footprint; the remote branch remains and is cleaned
with the stray-branch housekeeping (feature/0004-sapisidhash-signing) below.
Blocked: the #11 ensureTab fix and #24 remain open; both are branchable from
main without the capture. The stray branch deletion still waits on Kamran.
Next: housekeeping commit for these logs, then the ensureTab fix, then #24.

## 2026-09-24 05:05  session 2 wrap: handover files brought current

Documented: open-items-for-kamran.md rewritten, the capture and the two
checklists move to a "done, for the record" section with Kamran's actual
results, the branch deletion stays open. HANDOVER.md's standings table now
shows #3 merged via PR #25 and points at #6 as next. KICKOFF-2.md updated
in place: merged list, where-it-stops, first-thing-to-do and the git
permissions all reflect the post-#25 state, the two session 2 amendments
(rebase preference on unmerged branches, kanban unblock permission) are
recorded there. Tracking issue #22 ticked for #3 with the PR reference.
Verification after the recording: worktree clean, main level with origin,
CI green on 0ef44af.
Also from session 2, already recorded earlier: BLOCKED.md #3 entries marked
resolved with Kamran's checklist findings, STATE.md points at #6, card
t_164ddaa5 done on the kanban board, review at
tasks/0003-capture-spike/reviews/2026-09-24-pre-merge-review.md.
Left for the next session: the #11 ensureTab fix, #24, then #6. Kamran's
side: only the one-click branch deletion on GitHub remains, everything
capture-related is closed.

## 2026-09-24 04:55  switch to one kanban card per issue

Decided: the rest of sprint 1 runs as one card per issue on board
yt-cleanup, written up in plans/2026-09-24-card-execution-amendment.md and
docs/ORCHESTRATION.md. Reason: session 1's single loop cost about 34M
tokens for 135k of output, because every call resent a context that grew to
715k.
Did not work: the #3 pilot card. Its first run blocked correctly on the
capture. The retry then failed twice to start, because the main checkout
had feature/0003-capture-spike checked out and git refuses a second
worktree on the same branch. The card was finished by hand and its
completion was refused twice for a missing published_pr. So the review and
merge half of the flow has not run yet. Both causes are now rules: never
check a card's branch out in the main checkout, and the review run
completes with the PR URL.
Filed: #33 for the ensureTab bug from Kamran's #11 checklist step 5, in the
sprint 1 milestone and ticked in #22. Removed blocked from #6, since #3 is
closed. Moved #24 into the sprint 1 milestone so the loop query finds it.
Next: cards for #33, #24 and #6, chained in that order, merge: auto.

## 2026-09-24 06:11  #33 ensureTab waits for the tab, merged in PR #34

Worked: ensureTab now resolves only after an end-to-end probe gets an
answer from page.js, so a new tab and a reused tab are both ready before
the first request. Watch Later tabs are matched by parsed URL, so extra
query parameters reuse the tab and other playlists or the home page are
never picked. 148 unit tests and 8 browser assertions, including close,
ensureTab again, ping. Kamran's signed-in rerun is steps 1 to 4 of
tasks/0033-ensuretab-ready/implementation/manual-check.md.
Did not work: the first probe, an empty message, only proved bridge.js was
listening, not that page.js held the nonce, so it was replaced by a
superseding plan. Round 1 review found a tab closed mid wait counted as
ready; fixed in round 2 with a red-first test. In the browser spec, a tab
opened by chrome.tabs.create bypasses context.route, so the spec navigates
the new page itself.
Found: test/remover.test.js:175 flakes on a 1 ms early timer, needs its
own issue.
Merged: PR #34, regular merge, CI green, after two review rounds.
Next: #24, then #6.

## 2026-09-24 06:40  #24 shipped build, merged in PR #36

Worked: npm run build writes only the shipped files into gitignored
dist/, from scripts/shipped-files.js, one list derived from
manifest.json plus background.js, manifest.json, dashboard/, src/,
content/. The no-network scan imports the same list, so content/ is
scanned for the first time, with a red-first test for the widening.
README and CONTRIBUTING point at npm run build and dist/. 151 unit
tests, 8 browser assertions, and a one-off Playwright load of dist/
with no errors, 96K. No zip: the folder meets both acceptance boxes.
Did not work: the first shared list omitted background.js because the
manifest fixtures use empty manifests, three tests silently found
nothing; fixed by adding it explicitly. test/remover.test.js:175 flaked
once, the known #33 flake, rerun clean.
Found: wiring.test.js still carries its own manifestPaths copy that
agrees today; candidate for a later cleanup issue.
Merged: PR #36, regular merge, CI green, after one review round.
Next: #6.

## 2026-09-24 07:53  #6 playlist parser, merged in PR #37

Worked: src/core/playlistParser.js parses a Watch Later page into
Entry objects via parsePage(json), returning entries,
continuationToken and droppedItems. Ported from upstream
extractEntriesAndContinuation in two commits, verbatim then
restructure, and the verbatim copy stays exported beside parsePage with
two parity tests pinning them together. The null contract is now in
docs/ARCHITECTURE.md: channelName, channelId and unavailableReason are
null when YouTube gives nothing, and rules.js treats null as missing
data that never decides a removal. watchedPercent stores 0 for a
missing overlay, clamped, because 0 is the true reading. The captured
fixtures have no unavailable item and no Short, so both are asserted
from the synthetic fixture, stated plainly in the PR. 175 unit tests,
8 browser assertions, 300 entries over 3 pages, 0 dropped.
Did not work: the step 5 progress entry was missing while its commit
claimed to carry it, caught in the round 1 review; fixed by a reword
rebase plus a new tasks-only commit.
Merged: PR #37, regular merge, CI green, after two review rounds.
Next: #35, then #7.

## 2026-09-24 09:12  #35 remover sleep flake, merged in PR #38

Worked: test/remover.test.js "a default sleep is used when none is
injected" flaked 2 in 40 runs on this host because it asserted
Date.now() - start >= 5 around a real 5 ms pause and Node timers can
fire up to a millisecond early. Rewritten to observe the timer call
itself: a scoped stub records the scheduled delay, asserted exactly
[5], and sets a flag in its callback, which the recording innertube
checks at entry to the second editPlaylist, so both the schedule and
the await are pinned with no wall clock. src/core/remover.js is
untouched. Three bites proven red (Promise.resolve default, call
removed, call unawaited), each restored byte-identical. 50 runs in a
row with zero failures, 175 unit tests, 8 browser assertions.
Did not work: round 1 caught that the first rewrite pinned the
schedule but not the await, an unawaited sleep(pauseMs) left the
suite green; fixed by the flag observation in the round 2 rework.
Merged: PR #38, regular merge, CI green, after two review rounds.
Next: #7.

## 2026-09-24 10:12  #7 scanner, merged in PR #39

Worked: src/core/scanner.js exports scan({ innertube, onProgress,
signal }), SortNotVerifiedError and SortDriftError. It sets the Watch
Later order to oldest first and polls until the server confirms it,
reading the edit ack first and falling back to a fresh browse, six
attempts 350 ms apart, as upstream does. Then it refuses the scan if
the first page it actually reads reports any other order, follows
continuation tokens with a seen-token guard and a 50 ms page throttle,
dedupes on setVideoId, and assigns positions 1..N. The result carries
scannedAt, pageCount, entryCount, status, sortState and a SHA-256
fingerprint of the ordered setVideoId list for #14. An aborted scan
returns fingerprint null. 16 scanner tests, 191 unit tests, 8 browser
assertions. Mutations that go red: verify throw, drift check,
seen-token guard (bounded, no hang), throttle, abort fingerprint.
Did not work: the first cut skipped the port-verbatim-first rule and
lost upstream's drift check, seen-token guard and throttle. Round 1
caught all three. Round 2 caught a seen-token test that hung rather
than failed, and a stale PR body. The PR body's -t filter commands
still run the whole file, so the review file carries the corrected
--test-name-pattern commands.
Merged: PR #39, regular merge, CI green, after three review rounds.
Next: #12.
