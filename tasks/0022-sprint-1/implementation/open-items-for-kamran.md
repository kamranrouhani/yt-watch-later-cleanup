# Open items for Kamran

Everything here is yours alone to do or decide. As one is done, say so in
chat and the agent records the answer under its entry in `BLOCKED.md`.

## 1. The capture run. Required, and it unblocks the rest of sprint 1

For: issue #3 and every issue behind it. The parser (#6), the scanner
(#7) and the whole dashboard chain (#12 to #17) are written against these
real responses. This is the one thing that keeps the sprint from finishing.

What it does: `tools/capture.js` (written, on draft PR #25) reads the API
responses your Watch Later page already makes and downloads them as one
JSON file. It only reads. It cannot remove anything, and it never writes
your cookies, key or auth header anywhere (a test enforces that).

Steps, about five minutes on the machine where you browse YouTube:

1. Signed in, open https://www.youtube.com/playlist?list=WL and let it load.
2. F12, Console tab. Paste all of `tools/capture.js`, press Enter. If
   Chrome blocks the paste, type `allow pasting`, Enter, paste again.
   The file:
   https://raw.githubusercontent.com/kamranrouhani/yt-watch-later-cleanup/feature/0003-capture-spike/tools/capture.js
3. A file `wl-capture-<date>-<time>.json` downloads and a table prints.
   Run it again if the table shows no percentage near 100 under
   `resumePercentages`, or 0 under `unplayable` or `shortsLike` (move such
   a video near the top of the list first).
4. Send it over:
   scp ~/Downloads/wl-capture-*.json root@192.168.2.205:/root/projects/yt-watch-later-playlist-cleanup/test/fixtures/captured/raw/

Must not contain: cookies, the SAPISID value, auth headers, the API key.
The snippet never writes those. It does contain your titles, channels and
account name, which is why it lands only in the gitignored raw/ folder.

Status: open since 2026-09-22. You said early in the session to get back to
it later; #4, #5, #8, #9, #10 and #11 were built meanwhile. It is now the
only thing left that unblocks sprint 1 code.

## 2. Two manual checklists. Required before anything is called done

Run in your own Chrome, on main:

- `tasks/0001-scaffold-extension/implementation/manual-check.md`, 5 steps.
  Toolbar click opens the dashboard, a second click refocuses it, the
  details page stays clean.
- `tasks/0011-tab-bridge/implementation/manual-check.md`, 5 steps. The
  important one is step 3, the real signed-in ping. In the dashboard
  DevTools console:

  ```js
  const b = WLCore.tabBridge.createTabBridge(chrome);
  await b.ensureTab();
  await b.request('ping', null);
  ```

  Expected: `{ clientVersion: "2.2026...", signedIn: true }` with the
  version matching the real page.

Later there is one more: #17, the live run on your real playlist, first run
capped at 10 videos. The agent writes `docs/LIVE-CHECKLIST.md` when it gets
there.

## 3. One click on GitHub. Housekeeping, not blocking

Delete the stray branch `feature/0004-sapisidhash-signing`. It holds only
commits already in the merged history. A merge race recreated it, and this
host's config forbids me from deleting branches.

https://github.com/kamranrouhani/yt-watch-later-cleanup/branches

## 4. Deferred by you early in the session. Sprint 2 or later, not required now

From the help list in your kickoff message, parked when you said to get
back to them later:

- A Google Takeout export of Watch Later: tells us whether items carry an
  added-at timestamp (#20). Only needed if you want date based rules.
- A YouTube Data API key of your own: needed for topic rules like "only
  football" (#18, #19) when sprint 2 starts.

## Not yours

While the capture waits, the agent can work #24 (keep dev files out of the
loaded extension) and anything else in the repo that does not depend on
the capture.
