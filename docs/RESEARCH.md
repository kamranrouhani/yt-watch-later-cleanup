# Research

Findings from 2026-09-22, before any code was written. Everything below was
checked against a primary source at the time. Things that were not checked
are listed as open questions at the end, not stated as facts.

## The official API cannot touch Watch Later

From the YouTube Data API revision history and error reference:

- `channel.contentDetails.relatedPlaylists.watchLater` was deprecated on
  11 August 2016 and later removed from the documentation.
- `playlistItems.insert` and `playlistItems.delete` support for the Watch
  Later and history playlists is described as "fully deprecated".
- `playlistItems.list` on Watch Later returns
  `403 watchLaterNotAccessible`. A later revision notes the lists are
  "indeed, not accessible via the API".

No OAuth application can read or edit Watch Later. Anything that works uses
the internal `youtubei/v1` endpoints the YouTube web client calls.

## Existing tools

Two GitHub repository searches returned roughly 35 candidates. Almost all
click the page's own remove buttons one at a time: slow, broken by any
layout change, and without filtering.

| Tool | What it does | Why it is not enough |
|---|---|---|
| [JadenJSJ/yt-watch-later-tools](https://github.com/JadenJSJ/yt-watch-later-tools) (38 stars, MIT) | Userscript. Calls `browse/edit_playlist` directly, batches removals, forces and verifies oldest-first sort, paginates the whole list, exports JSON | One rule only: remove the oldest N. Extracts channel, duration and playability per video but never filters on them |
| [ImprovedTube](https://github.com/code-charity/youtube) | Large general extension. Absorbed `yt-playlists-delete-enhancer` in 2025, which removes videos watched past a percentage threshold | Single threshold rule, no channel or topic filters, no preview, buried among 200+ unrelated features |
| YouTube's own "Remove watched videos" | Built into the Watch Later page | Removes anything started, even a video watched for ten seconds |
| DOM-clicking userscripts and extensions (about 30) | Click remove repeatedly | Fragile and slow, no rules |

Nothing combines several criteria, protects videos from removal, or previews
a run. That combination is what this project builds.

## Why fork yt-watch-later-tools

It already solves the two parts that are hard to get right by trial and
error:

1. The exact `browse/edit_playlist` payload for Watch Later, including the
   `params` value `CAFAAQ%3D%3D`, which upstream derived from a captured HAR.
2. Setting the playlist to "Date added (oldest)" with
   `ACTION_SET_PLAYLIST_VIDEO_ORDER` (order value `2`) and polling until the
   server confirms the sort before deleting anything. Without this, "the
   oldest N" silently means whatever order the list happens to be in.

It also has working SAPISIDHASH request signing, continuation-token
pagination with deduplication, and batched removal. Porting those saves the
riskiest week of the project.

## Watch progress is available

Each `playlistVideoRenderer` in the browse response can carry a thumbnail
overlay:

```json
{ "thumbnailOverlayResumePlaybackRenderer": { "percentDurationWatched": 87 } }
```

It is the red progress bar under a thumbnail. Confirmed as a field of
playlist items in the `LuanRT/YouTube.js` parser
(`ThumbnailOverlayResumePlayback.ts`), in independent InnerTube type
definitions, and in the working `yt-playlists-delete-enhancer` source, which
read it from Watch Later.

It arrives in the same response as the rest of the item, so it costs no extra
request. It is a percentage, not a flag, which allows "finished" (say, 90 and
over) to be told apart from "started".

## Topics are available, categories are too coarse

Both come from the public `videos.list` method, looked up by video ID. Reading
public metadata by ID is permitted; only the Watch Later playlist is blocked.

- `snippet.categoryId`: one of about 30 fixed categories. Football is
  "Sports" (17), together with every other sport. Too coarse on its own.
- `topicDetails.topicCategories[]`: "A list of Wikipedia URLs that provide a
  high-level description of the video's content", for example
  `https://en.wikipedia.org/wiki/Association_football`. This is what makes
  "only football" possible.
- `snippet.tags[]` and `snippet.publishedAt` come in the same call.

Cost: `videos.list` is 1 quota unit per call and takes up to 50 IDs.
A 5,000 video playlist is 100 units against the default 10,000 per day.
Results are cached per video, so only new videos cost anything on later runs.

## Answers from the real capture, 2026-09-24

These settle three of the five open questions. Full evidence with JSON
paths into the committed fixtures is in
`tasks/0003-capture-spike/implementation/findings.md`.

1. **Is there an added-at timestamp per item?** No. All 300 items have the
   same fourteen keys, none of them a date; the only "Date added" strings are
   the sort menu labels. The oldest-first sort with
   `ACTION_SET_PLAYLIST_VIDEO_ORDER 2` and `params "QAE%3D"` (verified in the
   capture, not assumed from upstream) is the only ordering signal. Calendar
   date rules still wait on the Takeout import (#20). The "added before
   March" example stays unbuildable from Watch Later alone.
2. **Does the overlay appear for every watched video?** Yes, including fully
   watched ones. All 187 watched items carry
   `thumbnailOverlayResumePlaybackRenderer.percentDurationWatched` and a
   `WATCHED` badge; the 113 untouched items carry neither. A 100 percent value
   is a regular overlay, no special ending shape.
3. **Are Watch Later items still `playlistVideoRenderer`?** Yes, 300 of 300,
   `lockupViewModel` 0. The sort menu has already moved to the new
   `listItemViewModel`/`chipViewModel` dialect; item menus have not.
4. **Can the dashboard call InnerTube directly?** Still open. The capture ran
   inside a youtube.com tab; settling this belongs to the bridge work in #6.
5. **Where does rate limiting start?** Still open, removals were not
   performed by the spike. The capture proves every item menu carries
   `ACTION_REMOVE_VIDEO` and move commands, and the page menu carries
   `ACTION_REMOVE_WATCHED_VIDEOS`, so the remover's write path targets the
   right commands. The limit gets probed in #17.

Also settled while the capture was open: the oldest sort's `params` is
`"QAE%3D"` with `ACTION_SET_PLAYLIST_VIDEO_ORDER 2` (upstream's
`CAFAAQ%3D%3D` is the removal params, a different value), and item menus hold
`ACTION_REMOVE_VIDEO`, `ACTION_MOVE_VIDEO_AFTER` and
`ACTION_MOVE_VIDEO_BEFORE` per item. Item `videoInfo` carries cheap view
count and upload age strings.
