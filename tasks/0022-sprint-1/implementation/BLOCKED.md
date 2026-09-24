# Blocked on Kamran

Requests that need Kamran. Append only. When one is answered, append a line
under it saying when and how, never delete it.

Entry shape:

    ## YYYY-MM-DD  #N  <what is needed, one line>

    For: <what it unblocks and why a real artifact beats guessing>
    Steps:
      1. ...
      2. ...
    Must not contain: <cookies, tokens, personal data, whatever applies>
    Put it at: <path, under a gitignored raw/ folder if it is a capture>
    Status: open

<!-- append entries below this line -->

## 2026-09-22  #3  one run of the capture snippet on the signed-in Watch Later page

For: #6 (parser) and everything after it parse these responses. A real capture
settles the five open questions in docs/RESEARCH.md (added date, overlay on
fully watched videos, playlistVideoRenderer or lockupViewModel, unavailable
items, Shorts) with evidence instead of guesses from third-party parsers.
Steps:
  1. In Chrome, signed in, open https://www.youtube.com/playlist?list=WL and
     let it load.
  2. F12, Console tab. Paste the whole of tools/capture.js from branch
     feature/0003-capture-spike (PR linked in the reply). If Chrome blocks the
     paste, type `allow pasting` and paste again.
  3. A file wl-capture-<date>-<time>.json downloads and a table prints. If
     resumePercentages has no value near 100, or unplayable or shortsLike is 0,
     move such an example near the top of the list and run it again.
  4. scp ~/Downloads/wl-capture-*.json root@192.168.2.205:/root/projects/yt-watch-later-playlist-cleanup/test/fixtures/captured/raw/
     (mkdir the raw/ folder first if needed).
Must not contain: cookies, the SAPISID value, auth headers, the API key. The
snippet never writes any of those, a test checks it. The file does contain
your titles, channels, account name and visitorData, which is why it goes
only under raw/ (gitignored, checked with git check-ignore) and is scrubbed
before anything is committed.
Put it at: test/fixtures/captured/raw/ on LXC103
Status: resolved 2026-09-24. Kamran ran the snippet twice and sent both
files; summaries identical, kept -051020. Merged in PR #25 (merge commit
514227f). Resumed at step 9 of the plan; the questions it settles and the
two scrubber bugs found on the real data are in the capture progress log.

## 2026-09-22  #3  manual checklists for the merged issues

For: #1 and #11 acceptance boxes that only run in a signed-in browser.
Neither can run on this host, and both are the last proof that the merged
core works in your Chrome.
Steps:
  1. tasks/0001-scaffold-extension/implementation/manual-check.md (5 steps)
  2. tasks/0011-tab-bridge/implementation/manual-check.md (5 steps, the
     signed-in ping is the one that matters)
Must not contain: nothing sensitive here, it is only observations.
Put it at: reply in chat with pass or fail per step.
Status: resolved 2026-09-24. Kamran's report: checklist 1 (#1 scaffold), all
five steps pass, and the details page size is under 1 MB, the node_modules
note does not apply to his load. Checklist 2 (#11 tab bridge): steps 1 to 3
pass, step 3's signed-in ping returned
{ clientVersion: "2.20260922.06.00", signedIn: true }, matching the page.
Step 4 was hit naturally by accident and rejected with TabGoneError, which
is the expected behavior. Step 5 failed as observed: after closing the tab,
ensureTab() queried the exact WATCH_LATER_URL, missed the (redirected or
renamed URL) tab, opened an inactive tab no content script attaches to, and
the ping rejected with "Could not establish connection". Filed as follow-up
work; the fix belongs to the tab bridge, on a fresh branch from main.

## 2026-09-22  housekeeping  delete one stray branch on GitHub

For: cleaning the branch list. The branch holds only commits already in
the merged history; a merge race recreated it and this host's config
forbids me from deleting branches.
Steps:
  1. Open https://github.com/kamranrouhani/yt-watch-later-cleanup/branches
  2. Delete feature/0004-sapisidhash-signing
Must not contain: nothing, it is a click.
Put it at: nowhere, reply done when it is gone.
Status: open

## 2026-09-22  sprint 2  a Takeout export and a Data API key, deferred

For: #20 (added-at timestamps from a Google Takeout export of Watch Later)
and #18, #19 (topic rules need a YouTube Data API key of your own). You
said early in the session to get back to these later. Sprint 2 only.
Steps:
  1. Takeout: takeout.google.com, deselect all, tick only "YouTube and
     YouTube Music", JSON format, just Watch Later.
  2. API key: console.cloud.google.com, YouTube Data API v3, an API key.
     Put the key in chat only when #18 starts, it goes into .env.
Must not contain: for the Takeout, it is your own watch data; it lands
under a gitignored raw/ folder like any capture. The API key goes into
.env, never into a commit.
Put it at: test/fixtures/captured/raw/ for the Takeout, .env for the key.
Status: open, deferred to sprint 2
