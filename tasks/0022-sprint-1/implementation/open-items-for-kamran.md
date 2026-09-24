# Open items for Kamran

Everything here is yours alone to do or decide. As one is done, say so in
chat and the agent records the answer under its entry in `BLOCKED.md`.

## 1. One click on GitHub. Housekeeping, not blocking

Delete the stray branch `feature/0004-sapisidhash-signing` on GitHub. It
holds only commits already in the merged history; a merge race recreated it,
and this host's config forbids the agent from deleting branches.

https://github.com/kamranrouhani/yt-watch-later-cleanup/branches

## 2. Deferred by you early on. Sprint 2 or later, not required now

From the help list in your kickoff message, parked when you said to get
back to them later:

- A Google Takeout export of Watch Later: tells us whether items carry an
  added-at timestamp (#20). The capture settled this: items do not carry
  one. Only needed if you want date based rules.
- A YouTube Data API key of your own: needed for topic rules like "only
  football" (#18, #19) when sprint 2 starts.

Later there is one more: #17, the live run on your real playlist, first run
capped at 10 videos. The agent writes `docs/LIVE-CHECKLIST.md` when it gets
there.

## Done this sprint, for the record

- 2026-09-24: the capture run. You ran the snippet twice, both files
  arrived with identical summaries, and the merged fixtures landed in PR
  #25. The parser's five open research questions are answered in
  `tasks/0003-capture-spike/implementation/findings.md`.
- 2026-09-24: both manual checklists.
  - Checklist 1 (#1 scaffold): all five steps pass, and the details page
    size stays under 1 MB.
  - Checklist 2 (#11 tab bridge): steps 1 to 4 pass. The signed-in ping
    (step 3) returned
    `{ clientVersion: "2.20260922.06.00", signedIn: true }`, matching the
    page. Step 5 found a real bug: after closing the Watch Later tab,
    `ensureTab()` misses the redirected URL, opens a background tab no
    content script attaches to, and the ping rejects with "Could not
    establish connection". Recorded under the #11 entry in `BLOCKED.md`;
    the fix is a normal branch from main, not a blocker.

The earlier items "run the capture snippet" and "run the two checklists"
are gone from the list: both landed, both resolved in `BLOCKED.md`.

## Not yours

Everything left in sprint 1 is agent work now. Next in the chain: the #11
ensureTab fix, #24, then #6 (the playlist parser) and #7 (the scanner), then
the dashboard issues #12 to #16.
