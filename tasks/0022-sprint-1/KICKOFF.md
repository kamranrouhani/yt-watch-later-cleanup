You are picking up a project that is fully planned. Nothing needs designing
from scratch. Everything you need is written down in the repository.

WORKING DIRECTORY
  /root/projects/yt-watch-later-playlist-cleanup

WHAT THIS IS
  A Chrome Manifest V3 extension that cleans up a YouTube Watch Later
  playlist with rules (watch progress, channel, position, duration, title,
  availability, later topics like football), previews exactly what would be
  removed, then removes it in batches with a log. Plain JavaScript, no
  bundler, no framework. Personal project of Kamran Rouhani, public on
  GitHub at kamranrouhani/yt-watch-later-cleanup, MIT.

READ THESE, IN ORDER, BEFORE ANYTHING ELSE

  1. tasks/0022-sprint-1/GOAL.md
       rules, permissions, what done means. Read all of it.
  2. tasks/0022-sprint-1/LOOP.md
       the nine step cycle you repeat per issue. Your only workflow.
  3. docs/ARCHITECTURE.md, docs/RESEARCH.md, CONTRIBUTING.md
       the design, the facts behind it, the repository's own rules.
  4. tasks/0022-sprint-1/plans/2026-09-22-sprint-1.md
       the waves and dependencies across issues #1 to #17.
  5. tasks/0001-scaffold-extension/plans/2026-09-22-scaffold-extension.md
       the plan for your first issue. Its code was already run on this host
       and passed, including loading in real Chrome.

  Then run:
      bash tasks/0022-sprint-1/scripts/status.sh

YOU ARE ALLOWED TO DO GIT AND GITHUB WRITES

  Kamran has explicitly approved this for the whole sprint. Do not ask
  before each one. On this repository and the origin remote only, you may:
  create branches, commit, push your branches, open pull requests, merge
  them with a regular merge commit (gh pr merge --merge), push main after a
  merge, close and label issues, tick boxes in tracking issue #22, and file
  new issues for problems you find.

  Still never: squash or rebase merges, force-push main, rewrite merged
  history, push to any other remote, change git identity or signing config,
  skip or disable a failing check. If a push or merge is rejected, stop and
  report the exact error.

TEST EVERYTHING BEFORE YOU REPORT IT DONE

  Kamran wants each feature gone over and proven working, not just built.
  For every issue: see each new test fail before it passes, prove the test
  bites by briefly breaking the code, run the full suite, and actually run
  the extension in Chrome through Playwright where the host allows it. Put
  anything that cannot run here (a real signed-in YouTube session, a real
  toolbar click) on a numbered manual checklist with expected observations.
  Never report a feature as working on the strength of unit tests alone.

TELL KAMRAN WHAT WOULD HELP

  If a real artifact would do the job better than guessing, ask for it. Say
  what it is for, how to produce it in a few numbered steps, and what it
  must not contain. Useful things include: running the capture snippet on
  his signed-in Watch Later page (issue #3), a saved copy of that page, a
  DevTools HAR while scrolling it and removing one video, screenshots, a
  Google Takeout export of Watch Later, a Data API key (sprint 2), or his
  opinion on a UI choice. Record each request in
  tasks/0022-sprint-1/implementation/BLOCKED.md, then keep working on any
  other unblocked issue while you wait.

RULES THAT GET WORK REVERTED

  1. No AI attribution anywhere: no Co-Authored-By for a model or agent, no
     "Generated with", no robot emoji, no tool names in trailers, commits,
     PRs, issues, code or docs. Every commit is authored as
     Kamran Rouhani <kamran.rouhani@outlook.com>, which the repo already
     resolves to.
  2. Commits read like Kamran wrote them: plain, imperative, lowercase, no
     trailing period, varied phrasing. Match git log --oneline.
  3. No em dashes or en dashes, anywhere, including when talking to him.
  4. No comments by default, and never a comment addressed to a person.
  5. Task files under tasks/ never share a commit with code.
  6. Plans are frozen once work starts; supersede with a new dated plan.
  7. Progress logs are append-only, an entry per step, failures included.
  8. Never fabricate output. Paste real output. A blocker beats a fake pass.

HOW YOU RUN

  Start at issue #1. Work one issue per cycle through LOOP.md. When an issue
  is merged and the next one is unblocked, start it straight away without
  asking. Stop only at the four stop conditions in LOOP.md.

  After each merged issue, report in the short shape at the end of LOOP.md:
  what merged, the real test summary, what failed along the way, what is on
  the manual checklist, and what is next.

FIRST THING TO DO

  Read the five files, run status.sh, then start #1. Nothing needs asking
  first. The first thing Kamran will be needed for is issue #3, the capture;
  when you reach wave 2, prepare the snippet and its instructions, ask him
  for it, and work #4, #8 and #10 while you wait.
