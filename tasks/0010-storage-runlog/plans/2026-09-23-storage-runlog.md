# Storage wrapper and run log

- **Issue:** #10
- **Branch:** `feature/0010-storage-runlog`
- **Written:** 2026-09-23 14:21, on `main` at `1ce15ea`
- **Supersedes:** nothing

## Goal

`src/core/storage.js` and `src/core/runLog.js`: a typed wrapper over
`chrome.storage.local` whose failures resolve as warnings, and a run log
that records every removal and survives a dashboard reload.

## Decisions

- **Storage API:** `createStorage(area)` where `area` is anything with the
  `chrome.storage.local` shape (`get`, `set`, `remove`). Returns
  `{ get(key, fallback), set(key, value), remove(key) }`. `set` resolves to
  `{ ok: true }` or `{ ok: false, warning: string }`, never throws. `get`
  returns the fallback when the key is absent or the JSON is corrupt.
- **Keys are versioned strings** owned by the module: `scan:v1`,
  `presets:v1`, `apiKey:v1` (unused until #18, declared now so the shape is
  fixed), `runLogs:v1`, `enrichmentCache:v1` (same). Values are stored as
  `{ v: 1, data }` envelopes so a future bump can migrate rather than
  collide. Unknown envelope versions read as absent, with the fallback
  returned.
- **The run log is a list in one key** (`runLogs:v1`), newest first, each
  entry `{ id, startedAt, finishedAt | abortedAt, status, batches: [{ at,
    entries: [entrySnapshot], matchedRule }] }`. One key, not one key per
  run, so eviction is a single write and reload survival needs no scan of
  the storage area.
- **`createRunLog(storage)`:** `start(meta)` returns a run handle
  `{ appendBatch(entries, matchedRule), finish(), abort(reason), toJSON() }`.
  `appendBatch` writes the snapshot and the matched rule immediately, per
  the architecture's "every removal is logged before the next batch
  starts", so an aborted run keeps what it did. `finish` stamps
  `finishedAt` and `status: 'finished'`; `abort` stamps `abortedAt` and the
  reason. Both persist. A handle whose write failed is still usable: the
  in-memory copy stays complete and `toJSON` tells the truth, the warning
  surfaces to the caller.
- **Quota eviction:** `set` catches a quota failure (the fake and real both
  report it through the promise rejection or a `runtime.lastError` shaped
  object; the fake rejects, which is the harder case), evicts the oldest
  run log by dropping the tail of the list, retries the write once, and if
  it still fails resolves `{ ok: false, warning }`. Eviction never touches
  the scan, presets or key.
- **Fake storage for tests:** `createFakeStorage({ quotaBytes })` in
  `test/helpers/fake-storage.js`, plain object backing, byte counting by
  `JSON.stringify(value).length` per key, rejects with
  `QuotaExceededError` when a write would pass the quota. Not in `src/`,
  it is test tooling.
- **`exportJSON(storage)`** on runLog reads all logs and returns a
  serialisable structure containing, per run, every removed `videoId`,
  title, channel and matched rule.

## Steps

### Step 1: Plan

This file and a seeded progress log, one commit.

### Step 2: Fake storage and failing tests

`test/helpers/fake-storage.js` plus `test/storage.test.js` and
`test/runlog.test.js`, every acceptance box first. Expected: missing
module errors.

### Step 3: `src/core/storage.js`

Bites: make `set` throw on failure (the warning box fails); evict the
newest log instead of the oldest; evict the scan key instead of logs; retry
twice instead of once (observable via a counting fake).

### Step 4: `src/core/runLog.js`

Bites: `appendBatch` only in memory (reload box fails); `finish` not
persisted; export missing the matched rule.

### Step 5: Review, PR, CI, merge, close out

## Acceptance, from the issue

| Box | How it is shown |
|---|---|
| a run log survives a simulated dashboard reload (new module instance, same fake storage) | create, append, finish, then a fresh createRunLog over the same fake area and read the log back |
| a quota failure evicts the oldest log and the new write succeeds | set quota, fill, append until quota, assert the oldest run is gone and the write landed |
| a write that still fails returns a warning and does not throw | quota 0, set, assert the resolved warning, assert nothing threw |
| the exported JSON contains every removed videoId, title, channel and matched rule | exportJSON over a two-batch run, field by field |

## Out of scope

The dashboard UI reading these (#12, #15), enrichment cache semantics
(#18), preset files (#21).
