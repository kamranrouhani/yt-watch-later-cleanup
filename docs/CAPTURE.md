# Capturing Watch Later responses

`tools/capture.js` records what YouTube's own web client receives when it
loads your Watch Later playlist, so the parser can be written against real
data. It is used once per YouTube layout change, not by the extension.

## What it does and does not do

- It sends up to three `POST /youtubei/v1/browse` requests to
  `www.youtube.com`, the same request the Watch Later page makes when it loads
  and when you scroll: the first page and up to two more.
- It signs them the way the page does, from your `SAPISID` cookie. The cookie,
  the signature and the page's API key never go into the file.
- It never calls `edit_playlist`. It cannot remove, add or reorder anything,
  and a test in `test/capture-tool.test.js` keeps it that way.
- It sends nothing anywhere else. The file is downloaded by your browser to
  your own Downloads folder.

## What the file contains

The raw responses, which include your Watch Later titles and channels, your
account name and avatar, and a `visitorData` identifier. Treat it as
personal. It must only ever sit under `test/fixtures/captured/raw/`, which is
gitignored, until `tools/scrub.js` has produced the committed fixtures from
it.

## Running it

1. In Chrome, signed in to YouTube, open
   `https://www.youtube.com/playlist?list=WL` and let it finish loading.
2. Open DevTools with `F12` and go to the Console tab.
3. Paste the whole of `tools/capture.js` and press Enter. If Chrome refuses
   to paste, type `allow pasting`, press Enter, and paste again.
4. A file named `wl-capture-<date>-<time>.json` downloads, and the console
   prints a table.

## Reading the table

| Row | Meaning |
|---|---|
| `pages` | responses captured, 3 unless the playlist is short |
| `playlistVideoRenderer`, `lockupViewModel` | how many items came in each shape |
| `resumeOverlays`, `resumePercentages` | items with a red progress bar, and their percentages |
| `unplayable` | deleted, private or blocked items |
| `shortsLike` | items that look like Shorts |
| `moreAvailable` | the playlist continues past what was captured |

The parser needs at least one example of each: a fully watched video (a
percentage of 100 or close), a partly watched one, one never started, an
unavailable one, and a Short. If a row you need is 0, move an example of it
near the top of the list (or add a Short to Watch Later) and run it again.
Both files are useful.

## Getting it to the build host

```bash
scp ~/Downloads/wl-capture-*.json \
  root@192.168.2.205:/root/projects/yt-watch-later-playlist-cleanup/test/fixtures/captured/raw/
```

Create the `raw/` folder first if it does not exist. Nothing in that folder is
ever committed.

## After the capture

```bash
node tools/scrub.js test/fixtures/captured/raw/wl-capture-<stamp>.json test/fixtures/captured/<date>/
```

This writes one scrubbed file per response and adds the SHA-256 of every real
value it replaced to `test/fixtures/captured/denylist.sha256`.
`test/fixtures-guard.test.js` then fails if any of those values, an `@`, or
`SAPISID` ever appears in a committed fixture.
