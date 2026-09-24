# Findings from the real capture, 2026-09-24

Answers to the five open questions in `docs/RESEARCH.md`, from the scrubbed
fixtures in `test/fixtures/captured/2026-09-24/` (page-1.json, page-2.json,
page-3.json; capture.json holds the summary). Evidence paths into these files
are given for each. Percentages and counts come from `capture.json`'s
`summary`, which mirrors what the raw console table printed: 3 pages, 300
`playlistVideoRenderer`, 187 resume overlays, 49 percentage buckets, 73 at
exactly 100.

## 1. Is there an added-at timestamp per item?

No. The item shape has exactly fourteen keys on all 300 items:
`page-1.json`, path
`$.response.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents[0].playlistVideoListRenderer.contents[0].playlistVideoRenderer`
holds `videoId, thumbnail, title, index, shortBylineText, lengthText,
navigationEndpoint, setVideoId, lengthSeconds, trackingParams, isPlayable,
menu, thumbnailOverlays, videoInfo`. There is no added-at, created or date
key anywhere in the 300 items. This was checked by walking every item's keys
programmatically, not by eye alone.

The only "Date added" strings in the responses are the sort menu labels:
`page-1.json` ... `playlistVideoListRenderer` is preceded by a
`sortFilterSubMenuRenderer` (and a modern `chipViewModel` equivalent on later
pages) whose items read `Date added (newest)`, `Date added (oldest)`,
`Most popular`, `Date published (newest/oldest)`. The oldest entry's command
is exactly what upstream relies on:
`playlistEditEndpoint.params = "QAE%3D"` with
`ACTION_SET_PLAYLIST_VIDEO_ORDER, playlistVideoOrder: 2`.

Consequence: rules stay position-based under the oldest-first sort. A calendar
date rule still needs the Takeout import (#20).

## 2. Does the overlay appear for every watched video, or only partly watched ones?

Every watched video has the same overlay, including fully watched ones. All
187 overlaid items carry
`thumbnailOverlayResumePlaybackRenderer.percentDurationWatched`, 10 to 100,
and every one of them also carries a
`thumbnailOverlayPlaybackStatusRenderer` with the text `WATCHED`. The 113
never-started items carry neither. Eyeball pairs (WATCHED, percentage) over
all 300 items count 47 at pct 10 (the cap for a few seconds of watching), 73
at pct 100, and no other badge change at 100. Example of a fully watched
item, `page-2.json`:
`$.response.onResponseReceivedActions[0].appendContinuationItemsAction.continuationItems[*].playlistVideoRenderer.thumbnailOverlays`
starts with `{"thumbnailOverlayPlaybackStatusRenderer": {"texts": [{"runs":
[{"text": "WATCHED"}]}]}}, {"thumbnailOverlayResumePlaybackRenderer":
{"percentDurationWatched": 100}}`.

Consequence: "finished" (say 90 and over, or exactly 100) and "started"
are both reliable signals from one field, at no extra request.

## 3. Are Watch Later items still playlistVideoRenderer?

Yes. 300 of 300 items are `playlistVideoRenderer`; `lockupViewModel` count
is 0 (`capture.json` summary). The parser can stay on the old shape, but the
sort menu on pages 2 and 3 already speaks the new `listItemViewModel` /
`chipViewModel` dialect, so the removal command paths should be sourced from
the item menus, which still are classic renderers.

## 4. Can the dashboard call InnerTube directly?

Still open, unchanged by this capture: the capture ran inside a youtube.com
tab, per the plan. Resolving it belongs to the bridge/parser work in #6, not
to this spike.

## 5. Where does rate limiting start for batched removals?

Still open: the capture contains removal affordances only, no removals were
performed. What the capture does add: every item menu carries
`ACTION_REMOVE_VIDEO`, `ACTION_MOVE_VIDEO_AFTER` and `ACTION_MOVE_VIDEO_BEFORE`
100 times each on page 1 (match on
`$.response...playlistVideoListRenderer.contents[*].playlistVideoRenderer.menu`),
and the page menu holds `ACTION_REMOVE_WATCHED_VIDEOS`, so the write path the
remover (#9) ports is exactly these commands. The limit itself gets probed by
#17 on the live playlist.

## Bonus findings the capture settled while it was open

- Sort menu params for oldest is `"QAE%3D"` (percent-encoded `QAE=`), not
  upstream's `CAFAAQ%3D%3D`, which is the edit_playlist removal params. Both
  values now have primary evidence.
- Every page-1 item carries `videoInfo` with view count and upload age as
  runs (`"609K views"`, `"9 hours ago"`), useful for cheap display without a
  Data API call.
- A channel literally named "Channel 8" exists in the sample; the scrubber
  placeholder pool collides with real values that look like placeholders, so
  `buildMapping` now skips any placeholder that equals or contains a real
  value (covered by `test/scrub.test.js`).
- googlevideo `initplayback` probe URLs appear inside item payloads and carry
  the client IP; the scrubber replaces the whole URL
  (`test/scrub.test.js`, googlevideo test).
