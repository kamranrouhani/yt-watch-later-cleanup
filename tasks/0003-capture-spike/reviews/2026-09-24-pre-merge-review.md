# Review: capture spike, steps 9 to 11

When: 2026-09-24 05:00, pre-merge.
Stage: branch feature/0003-capture-spike at b121c51, two commits on top of
the rebased tooling history. Reviewed as the worktree diff of these two
commits plus the rebase outcome.
Scope: everything, the whole issue #3. Episodes: the fixture commit, the
scrubber fixes, findings, RESEARCH.md, the progress log, git state.

## What was checked

Git. Branch history is 6 rebased tooling commits + the 2 capture commits,
linear on top of ef20c51, pushed with one forced update (a plain
git push origin +feature/0003-capture-spike). main was never force-pushed.
Commit authorships checked with `git log --format='%an <%ae>'`: all Kamran
Rouhani. No AI attribution. tasks/ docs and tools share commits here; that
is correct on this branch, the task-files-only-in-their-own-commit rule is
for code changes on main history, and the progress log entries ride with
their own commits (0651231 code+fixtures, b121c51 docs).

Secrets. Ran the guard (`test/fixtures-guard.test.js`, 7/7 green) and an
independent grep pass over the committed fixtures: no @, no SAPISID, no
visitorData key, no real datasync value, no ip= or initplayback substrings,
no real host names. The denylist holds 1569 sha256 hashes of the replaced
values and the guard test would fail the suite if any of them returned.
The raw captures and the plaintext mapping stay under raw/, confirmed
gitignored.

The two scrubber fixes each bite: stashing the fix made both their tests
fail (not ok 9 channel-name collision, not ok 8 googlevideo), restoring
greened them. The synthetic fixture grows a literal "Channel 5" channel and
a planted googlevideo url so future regressions surface in CI on main.

Findings vs evidence. Every claim in findings.md holds a JSON path I traced
into the committed files by script: fourteen keys per item (counted over all
300), zero added/published-item fields, 187 overlays with the 47-at-10 and
73-at-100 buckets matching the capture summary, ACTION_REMOVE_VIDEO x100 per
page, sort params "QAE%3D" with playlistVideoOrder 2 read from the oldest
menu entry. RESEARCH.md's new answers match findings.md.

Suite at review time: npm run check clean, 140/140 unit tests, 7/7 browser
assertions including the capture spec, all three specs wired into
test:browser after the package.json conflict resolution. One flaky timing
test (remover, "a default sleep") failed once on the first post-rebase run
and passed on every rerun, noted rather than hidden.

## Judgment

The channel-name collision fix is the most load-bearing change: it changes
placeholder assignment. The do/while would in theory loop forever if a
suffix ran out; impossible here since reals are finite and placeholders are
monotone in n, and it self-terminates in practice. The googlevideo rule
replaces the whole URL string when the host matches anywhere in it; a url
that embeds a personal value but not on googlevideo.com could still pass,
but the fixture sweep found none, and the guard's denylist substring
matching catches leftovers.

Verdict: ready. Take the PR out of draft and merge as a regular merge.

Sign-off: nothing found that blocks the merge.

## What this review does not cover

#6, the parser. It starts from these fixtures next.
