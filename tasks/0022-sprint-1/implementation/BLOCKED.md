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
Status: open
