# The batched remover

- **Issue:** #9
- **Branch:** `feature/0009-batched-remover`
- **Written:** 2026-09-23 14:29, on `main` at `8fc25b5`
- **Supersedes:** nothing

## Goal

`src/core/remover.js`: remove exactly a frozen plan built from a preview,
in small batches, stoppably, reporting per batch.

## Decisions

- **`createPlan(previewResult, scanFingerprint)`** returns
  `{ kind: 'removal-plan', version: 1, setVideoIds: [...], entries: [...],
  fingerprint }`, `Object.freeze`n deeply, where `setVideoIds` comes only
  from `previewResult.remove[].entry.setVideoId`. A previewResult without a
  `remove` array, or entries without `setVideoId`, is rejected at plan
  creation, so nothing half-built ever reaches the remover.
- **`run(approvedPlan, options)`** validates its input is a frozen removal
  plan from `createPlan` (kind, version, frozen, non-empty ids) and throws
  otherwise. Options: `{ innertube, batchSize = 25, pauseMs = 1500, signal,
  onBatch }`. Hard limits: batch 1 to 50, pause 0 to 60000; outside, throw.
- **The signal** is an `{ aborted: boolean }` style object checked between
  batches and before the first, so #15 can flip it from a stop button
  without AbortController wiring in core.
- **Batching:** chunks of `batchSize` over `setVideoIds`, each chunk sent as
  `editPlaylist(ids.map(id => ({ action: 'ACTION_REMOVE_VIDEO', setVideoId:
  id })))` through the injected `innertube` (#5), exactly upstream's
  `removeFromWatchLaterBatch` payload shape.
- **Result:** `{ status, removedSetVideoIds, batches: [{ index, entries,
  ok }], stopReason }` where status is `complete` or `stopped`. `onBatch`
  fires after each successful batch with the entries it removed, before the
  pause, so the log is written before the next request. The pause only
  happens between batches, never after the last.
- **Stops:** a thrown `RateLimitedError`, `AuthError` or `EditRejectedError`
  from the innertube client, or an aborted signal, ends the run
  immediately. `HttpError` and anything else also stop the run; the issue
  names the three, but a 500 mid-run must not be swallowed either. The
  result reports which batches succeeded and `stopReason` names the cause.
- **A plan with zero ids** throws at `createPlan`, per "removing nothing"
  being a caller bug, not a run.
- **Safety first:** the safety boxes (anything not from createPlan throws;
  stop semantics; batch limits) are tests before implementation.

## Steps

### Step 1: Plan

This file and a seeded progress log, one commit.

### Step 2: Safety tests first

`test/remover.test.js`, safety boxes first, then the full behaviour.
Expected: missing module.

### Step 3: `src/core/remover.js`

Bites: accept an unfrozen lookalike plan; drop the batch limit check; send
the pause after the last batch; ignore the signal; send batches of the
wrong size; omit the ACTION_REMOVE_VIDEO action name.

### Step 4: Review, PR, CI, merge, close out

## Acceptance, from the issue

| Box | How it is shown |
|---|---|
| passing anything other than a plan from `createPlan` throws | lookalikes: unfrozen, wrong kind, wrong version, plain object, array |
| a 60 item plan with batch size 25 sends 3 requests of 25, 25, 10, with the exact ACTION_REMOVE_VIDEO payloads | fake innertube records every editPlaylist call, asserted payload by payload |
| a 429 on batch 2 stops the run, reports batch 1 done and 2 and 3 not attempted | fake innertube throws RateLimitedError on the second call |
| abort between batches stops before the next request | signal flipped in onBatch after batch 1 |
| a batch size of 0, 51 or a string is rejected | three throws |

## Out of scope

The run button and log UI (#15), the preview (#14), the stale-fingerprint
check between preview and run (#14/#15 boundary, plan carries the
fingerprint so the caller can compare).
