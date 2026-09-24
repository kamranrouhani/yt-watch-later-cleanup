# KICKOFF: sprint 1, session 2

You are picking up a project mid-sprint. Eight of seventeen issues are
merged. A previous session did that work and ran out of context; its record
is in the repository, and this file is the map to it.

WORKING DIRECTORY
  /root/projects/yt-watch-later-playlist-cleanup

WHAT THIS IS
  A Chrome Manifest V3 extension that cleans up a YouTube Watch Later
  playlist with rules (watch progress, channel, position, duration, title,
  availability, Shorts, and later topics), previews exactly what would be
  removed, then removes it in batches with a log. Plain JavaScript, no
  bundler, no framework. Personal project of Kamran Rouhani, public on
  GitHub at kamranrouhani/yt-watch-later-cleanup, MIT.

READ THESE, IN ORDER, BEFORE ANYTHING ELSE

  1. tasks/0022-sprint-1/GOAL.md
     rules, git permissions, what done means. Read all of it.
  2. tasks/0022-sprint-1/LOOP.md
     the nine step cycle per issue. Your only workflow.
  3. tasks/0022-sprint-1/implementation/STATE.md
     where work stopped.
  4. tasks/0022-sprint-1/implementation/open-items-for-kamran.md
     the things only he can do, including the one that blocks the sprint.
  5. tasks/0022-sprint-1/implementation/BLOCKED.md and
     tasks/0022-sprint-1/implementation/2026-09-22-sprint-1-progress.md
     what waits on him, and how each merged issue went, failures included.
  6. docs/ARCHITECTURE.md, docs/RESEARCH.md, CONTRIBUTING.md

  Then run:

      bash tasks/0022-sprint-1/scripts/status.sh

WHAT IS MERGED
  #1 scaffold (PR #23), #4 signing (#26), #2 net guard (#27),
  #5 innertube client (#28), #8 rules (#29), #10 storage and run log
  (#30), #9 batched remover (#31), #11 tab bridge (#32). All regular merge
  commits, CI green on each. On main now: 119 unit tests and 6 browser
  assertions pass. Per-issue folders tasks/0001, 0002, 0003, 0004, 0005,
  0008, 0009, 0010, 0011 each hold a plan, an append-only progress log and
  a pre-merge review.

WHERE IT STOPS
  Everything left in sprint 1 chains through #6, the playlist parser, and
  #6 is written against real captured Watch Later responses that only
  Kamran can produce (issue #3). Branch feature/0003-capture-spike on draft
  PR #25 already holds the capture snippet, the scrubber and the fixture
  guard test. Its plan
  tasks/0003-capture-spike/plans/2026-09-22-capture-spike.md is done
  through step 8.

FIRST THING TO DO
  Check for a capture file:

      ls test/fixtures/captured/raw/wl-capture-*.json

  Present: resume issue #3 at step 9 of its plan (scrub, commit fixtures
  with their README, answer the five questions in docs/RESEARCH.md in a
  findings.md with exact JSON paths, update RESEARCH.md, review, take the
  PR out of draft, merge as a regular merge). Then start #6.

  Absent: tell Kamran in your first reply, in this shape:
    1. the capture is the one thing that unblocks the sprint, with the
       four numbered steps from open-items-for-kamran.md and the raw URL
       for tools/capture.js,
    2. the two manual checklists he can run meanwhile, with their paths,
    3. the stray branch to delete on GitHub, one click.
  Then work what does not need the capture: #24, keep dev files out of the
  loaded extension, is open and unblocked. If nothing at all is workable,
  say so and stop.

HOW KAMRAN PASSES YOU THINGS
  - Capture or export files by scp to this host, for example:
      scp ~/Downloads/wl-capture-*.json root@192.168.2.205:/root/projects/yt-watch-later-playlist-cleanup/test/fixtures/captured/raw/
    Anything personal goes under raw/ or another gitignored folder and is
    never committed before scrubbing. See CONTRIBUTING.md, "Fixtures".
  - Checklist results, decisions and answers as plain chat replies. Record
    what he says in the matching progress log or under its BLOCKED.md
    entry.

YOU ARE ALLOWED TO DO GIT AND GITHUB WRITES
  Unchanged from session 1 and still standing: branches, commits, pushes to
  origin only, PRs, regular merge commits (gh pr merge --merge), issue
  housekeeping, ticking #22. Never squash or rebase merges, never
  force-push main, never push to another remote, never change git identity.
  If a push or merge is rejected, stop and report the exact error.

RULES THAT GET WORK REVERTED

  1. No AI attribution anywhere. Every commit is authored as
     Kamran Rouhani <kamran.rouhani@outlook.com>.
  2. Commits read like Kamran wrote them: plain, imperative, lowercase, no
     trailing period. Match `git log --oneline`.
  3. No em dashes or en dashes anywhere, in code or prose.
  4. No comments by default, and never one addressed to a person.
  5. Files under tasks/ never share a commit with code.
  6. Plans are frozen once work starts. To change approach, write a new
     dated plan saying what it supersedes.
  7. Progress logs are append-only: an entry per step, failures included.
  8. Never fabricate output. Paste what a command actually returned.

TEST EVERYTHING BEFORE YOU REPORT IT DONE
  See each new test fail before it passes. Break the code briefly to prove
  the test bites, then restore. Run the whole suite. Run the extension in
  real Chrome through Playwright where the host allows. Anything that
  cannot run here goes on a numbered manual checklist with expected
  observations.
  Known host limits, found in session 1: real youtube.com redirects to
  consent.youtube.com from this egress IP, so browser tests route a fake
  page; headless Chrome cannot click the toolbar icon; a signed-in session
  is impossible here. All of it is in the task progress logs.

REPORT AFTER EACH MERGED ISSUE
  The shape at the end of LOOP.md: what merged, the real test summary, what
  failed along the way, what sits on the manual checklist, what is next.
