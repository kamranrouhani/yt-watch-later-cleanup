# Full scan in verified oldest-first order (round 1 fixes)

- **Issue:** #7
- **Branch:** `feature/0007-scanner`
- **Written:** 2026-09-24 10:00, after round 1 review (PR #39, review at
  `tasks/0007-scanner/reviews/2026-09-24-0954-review-r1.md`)
- **Supersedes:** `2026-09-24-scanner.md`

## What changed from the superseded plan

The superseded plan's port list named `ensureWatchLaterOrderOldest` and
`fetchAllWatchLaterEntries` but the first implementation only ported the
sort-verification retry loop and the plain continuation walk. Three pieces
of `fetchAllWatchLaterEntries` (lines 535-651) were dropped in step 3's
combined commit and are restored here, cited to the upstream lines they
come from:

- **Sort drift check on the scanned page itself (lines 566-574).**
  Verification confirming order 2 does not guarantee the page `scan` goes
  on to actually read for pagination still reports order 2; some accounts
  only echo the confirmed order intermittently. `scan` now reads
  `extractSortState` off the first browsed page and throws a new
  `SortDriftError` (a `SortNotVerifiedError` subclass, so existing
  `instanceof SortNotVerifiedError` callers keep working) before any entry
  is added, when that page's own sort state is not order 2. No page is
  fetched past the first, `entries` is never populated. This is the
  safety-critical fix: without it a genuine drift after verification but
  before or during the scan silently returns positions in the wrong order.
- **Seen-token guard (lines 557-559, 588-597, 616-620).** `scan` now
  tracks a `seenTokens` set and stops pagination instead of refetching a
  continuation token it has already consumed. Upstream keeps a token
  queue and skips already-seen tokens found in a later page's own
  continuation list; this port keeps the existing linear
  `nextToken`-from-`page.continuationToken` shape (there is exactly one
  outgoing token per page in this codebase's parser, never a list) and
  stops instead of skipping, since a token that repeats itself has nowhere
  else to go from a linear walk. Bounded by construction: at most one
  extra fetch of a repeated token, then the loop ends with `status:
  'complete'`, not an error, since the pages already fetched are still a
  valid (if possibly incomplete) result.
- **Page throttle (lines 538, 621-623).** `scanPageThrottleMs` option,
  default `SCAN_PAGE_THROTTLE_MS` (50, upstream's `ADVANCED_DEFAULTS.
  scanPageThrottleMs`), sleeps between continuation fetches when another
  page remains to be fetched. Tests set it to 0 except the one that
  verifies the wait actually happens.

## Aborted-scan fingerprint (review finding 4)

An aborted scan's `entries` array is real but partial: it has positions
1..k over whatever was fetched before the signal fired, not the whole
playlist. Leaving `fingerprint` populated on that result would let a
caller compare it against a prior complete scan's fingerprint and treat a
partial list as evidence nothing changed, or as a legitimate new baseline.
`scan` now sets `fingerprint: null` whenever `status !== 'complete'`, so
`entries`/`positions` are still available to whatever needs to show
"scan was interrupted, here is what we had", but the fingerprint #14
compares against can never come from a partial scan. `status` remains the
authoritative field for whether `entries` is a complete playlist; this is
additional guarding, not a replacement for checking it.

## Verification

- `node --test test/scanner.test.js`: 16 tests, 16 pass (12 from the
  original plan plus 4 new: sort-drift-on-scanned-page, seen-token guard,
  throttle-waits, throttle-default-matches-upstream).
- `npm test`: 191 pass, 0 fail (187 before this round plus the 4 new
  tests).
- `npm run check`: all files parse.
- `npm run test:browser`: 8 ok, unaffected.

## Out of scope

Unchanged from the superseded plan: no dashboard, no rule evaluation, no
storage write, no stale-preview check itself.
