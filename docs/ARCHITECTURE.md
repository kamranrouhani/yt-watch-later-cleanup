# Architecture

Plain Manifest V3 Chrome extension. No bundler, no transpiler, no build step,
no runtime dependencies. Development dependencies are for tests only.

## Components

```
 dashboard.html  (extension page: table, rules, preview, run)
      |   chrome.runtime / chrome.tabs messaging
      v
 content/bridge.js        isolated world, on www.youtube.com
      |   window.postMessage with a per-session nonce
      v
 page/innertube.js        MAIN world, on www.youtube.com
      |   same-origin fetch, cookies included, SAPISIDHASH signed
      v
 www.youtube.com/youtubei/v1/{browse, browse/edit_playlist}


 dashboard.html --> src/core/dataApi.js --> www.googleapis.com/youtube/v3/videos
                   (optional, user's own API key)
```

### Why the InnerTube calls run in the page's main world

The client needs `ytcfg` values (`INNERTUBE_API_KEY`,
`INNERTUBE_CLIENT_VERSION`, the client context) that exist only in the page's
JavaScript world, and the `SAPISID` cookie to sign requests. Upstream runs in
the main world and is proven to work there, so the port keeps that. The
isolated content script only relays messages between the page and the
extension. MV3 supports this directly with `"world": "MAIN"` on a content
script entry.

Messages from the page world are accepted only with a nonce the bridge hands
over at startup, so another script on youtube.com cannot drive removals.

Whether the dashboard could call InnerTube itself is open question 4 in
[RESEARCH.md](RESEARCH.md). The tab design does not depend on the answer.

### The dashboard needs a YouTube tab

If no Watch Later tab is open, the dashboard opens
`https://www.youtube.com/playlist?list=WL` in a background tab and uses that
as its bridge. The dashboard shows which tab it is connected to and handles
that tab closing mid-run.

## Modules

Everything under `src/core/` is plain JavaScript that attaches to a global
`WLCore` and also exports through `module.exports`, so the same file runs in
the browser and under `node --test`.

| Module | Responsibility |
|---|---|
| `net.js` | The only place allowed to call `fetch`. Enforces an origin allowlist |
| `auth.js` | SAPISIDHASH header from cookie, origin and time |
| `innertube.js` | `browse`, continuation and `edit_playlist` calls, typed errors |
| `playlistParser.js` | Raw renderer to normalised `Entry` |
| `scanner.js` | Full scan: sort to oldest-first, verify, paginate, dedupe, progress, cancel |
| `rules.js` | Pure rule evaluation. No I/O |
| `dataApi.js` | `videos.list` batching, quota accounting, per-video cache |
| `remover.js` | Batched removal, throttle, backoff, stop, per-batch result |
| `runLog.js` | What was removed and why, exportable as JSON |
| `storage.js` | Typed wrapper over `chrome.storage.local`, quota-safe |

The dashboard UI lives in `dashboard/` and consumes these modules. It holds no
YouTube logic of its own.

## Data model

```js
Entry {
  setVideoId,          // playlist item id, what removal needs
  videoId,
  position,            // 1-based under oldest-first sort
  title,
  channelName,         // null when the renderer is missing or carries no name
  channelId,           // null when the byline has no browseId
  durationSeconds,     // null for live, unknown or unparseable
  watchedPercent,      // 0 when no progress overlay, clamped to 0..100
  playable,            // false for deleted, private, blocked
  unavailableReason,   // null for playable items
  publishedText,       // "3 years ago", as YouTube renders it
  isShort, isLive,     // false when the renderer says otherwise
  enrichment: {        // present only after a Data API lookup
    categoryId,
    topics,            // Wikipedia slugs, e.g. "Association_football"
    tags,
    publishedAt        // ISO timestamp
  }
}
```

Every field the parser can fail to derive is `null` or a boolean, never
`undefined`: a null text field is a fact YouTube did not give us and is
covered by the missing-data rule (the `isMissing` check in rules.js treats
`null` and `undefined` alike, so a condition on it evaluates as missing and
can never decide a removal). `channelId`, `channelName` and
`unavailableReason` are the fields where this actually happens in captures,
so they are written into the parser's tests explicitly.

`watchedPercent` is the one field that is special here: a missing progress
overlay is stored as **0, not null**, because 0 is a true reading (YouTube
serve no overlay for a fully unwatched item), and no rule needs to
distinguish "0 watched" from "not told". Rules operating on
`watchedPercent` (`>=`, `<`, `== 0`) therefore always get a number, and the
missing-data protection they need comes from the clamp, not from a null.

## Rule semantics

A rule set has two lists: **remove** rules and **protect** rules. Each rule is
a list of conditions joined by AND.

```
remove(entry) = any(removeRules, r => all(r.conditions, entry))
             && !any(protectRules, r => all(r.conditions, entry))
```

Protect always wins. A rule set with no remove rules removes nothing. An
empty condition list never matches, so a half-built rule cannot select the
whole playlist.

Conditions:

| Field | Operators |
|---|---|
| `watchedPercent` | `>=`, `<`, `== 0` |
| `channelId` | in list, not in list |
| `topic` | has any of |
| `categoryId` | in list |
| `title` | contains (case-insensitive), matches regex |
| `durationSeconds` | `>=`, `<` |
| `position` | among oldest N |
| `playable` | is false |
| `isShort` | is true |

A condition on an enrichment field against an entry that has not been
enriched evaluates to **no match**, and the preview reports how many entries
were skipped for that reason. Missing data must never cause a removal.

## Safety

- **Dry run is the only way to reach the remove button.** The executor takes
  the `setVideoId` list produced by the preview the user looked at, never a
  fresh evaluation.
- **Stale preview check.** If a new scan changes the playlist between preview
  and run, the run refuses and asks for a new preview.
- **Confirmation shows the count** and the first few titles.
- **Batches are small and throttled.** Default 25 items per request with a
  pause between. Any HTTP 429 or non-success status stops the run and keeps
  the log.
- **Every removal is logged** with its entry snapshot and the rule that
  matched, before the next batch starts. The log survives closing the
  dashboard.

## Network rule

Only `src/core/net.js` may make network requests, and only to:

- `https://www.youtube.com`
- `https://www.googleapis.com` (Data API, only when a key is configured)

A test reads every shipped file and fails if anything else calls `fetch`,
`XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `import()` or
`new Worker()`, or references another origin. No analytics, telemetry,
remote config or update checks, ever.

## Storage

`chrome.storage.local`, 10 MB default quota. Stored: the last scan (entries,
no raw responses), the enrichment cache keyed by video ID, rule presets, the
API key, run logs. The enrichment cache and old run logs are evicted oldest
first when a write approaches the quota. A write that fails must degrade to a
warning, never abort a run.

## Testing

| Tier | Runs | Covers |
|---|---|---|
| Unit | `npm test`, Node, jsdom | every `src/core` module, parser against captured fixtures |
| Guard | `npm test` | manifest wiring, no-network rule, no stray origins |
| Browser | `npm run test:browser`, Playwright, real Chrome | extension loads, dashboard renders, full flow against a fake YouTube served from fixtures |
| Live | by hand, documented checklist | one real run against a real signed-in account |

Captured fixtures are real responses from a signed-in session, scrubbed of
names, channel IDs of private playlists, tokens and cookies before commit.
