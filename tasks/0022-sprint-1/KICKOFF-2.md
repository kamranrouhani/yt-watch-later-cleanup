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
  (#30), #9 batched remover (#31), #11 tab bridge (#32), #3 capture spike
  (#25, merged 2026-09-24). All regular merge commits, CI green on each.
  On main now: 140 unit tests and 7 browser assertions pass. The real
  Watch Later fixtures from Kamran's capture run are committed under
  test/fixtures/captured/2026-09-24/ with their README and denylist.
  Per-issue folders tasks/0001, 0002, 0003, 0004, 0005, 0008, 0009, 0010,
  0011 each hold a plan, an append-only progress log and a pre-merge review.

WHERE IT STOPS
  #3 is done: the fixtures are in, findings are in
  tasks/0003-capture-spike/implementation/findings.md, docs/RESEARCH.md
  carries the capture's answers. Two loose ends sit before #6, neither
  blocking: the #11 ensureTab fix (Kamran's checklist step 5 found that a
  closed and reverted Watch Later tab is not found by the exact-URL query,
  so the ping rejects with "Could not establish connection"; fix on a fresh
  branch from main), and #24, keep dev files out of the loaded extension.
  #6, the parser, is next in the chain and is now unblocked: it is written
  against the real fixtures.

FIRST THING TO DO
  Run the orientation script, then pick the current issue from STATE.md.

      bash tasks/0022-sprint-1/scripts/status.sh

  Working order for the next issues: the #11 ensureTab fix, #24, then #6
  and #7, then the dashboard chain #12 to #16. #17 needs Kamran live.

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
  housekeeping, ticking #22, and the kanban board (hermes kanban, board
  yt-cleanup). Never squash or rebase merges, never force-push main, never
  push to another remote, never change git identity.
  Two session 2 amendments, from Kamran directly:
    - On an UNMERGED branch, prefer rebase over merging main in. Approved
      once for PR #25 with the rewritten-history push; per merge, not
      blanket.
    - Unblocking a kanban card whose needs_input has arrived is fine;
      record why in the unblock reason.

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
