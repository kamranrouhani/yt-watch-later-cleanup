# Captured fixture: 2026-09-24

Real Watch Later responses from Kamran's signed-in Chrome, captured with
`tools/capture.js` and scrubbed with `tools/scrub.js`. The raw capture that
produced them is under `raw/`, which git ignores.

## What the capture covers

- 3 pages of the `browse VLWL` response chain, 300 `playlistVideoRenderer`
  items in total, no `lockupViewModel`.
- 187 items with a `thumbnailOverlayResumePlaybackRenderer` progress overlay,
  spanning every percentage bucket from 10 to 100, 73 of them at exactly 100.
- No unplayable items and no Shorts in the captured sample: YouTube does not
  serve deleted or private items in Watch Later, and the playlist happened to
  contain no Shorts. Those two shapes stay covered by
  `test/fixtures/synthetic/raw-capture.json`.
- `clientVersion` 2.20260922.06.00, `hl` en, `gl` DE, first page sent the
  canonical Watch Later `params` (captured by the browser, scrubbed here).

## What was scrubbed

Video IDs, set video IDs, titles, channel names and IDs, handles, the account
name, tracking and continuation tokens, datasync IDs, thumbnail URLs and
googlevideo playback probe URLs (which carry the client IP) are replaced with
stable placeholders. `denylist.sha256` holds the SHA-256 of every real value,
and `test/fixtures-guard.test.js` fails if any of them, an `@`, or `SAPISID`
appears in a committed fixture. The plaintext mapping is kept in `raw/` only.
