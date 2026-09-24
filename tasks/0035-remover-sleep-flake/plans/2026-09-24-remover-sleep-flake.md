# Make the remover default sleep test deterministic

- **Issue:** #35
- **Branch:** `fix/0035-remover-sleep-flake`
- **Written:** 2026-09-24 08:05, on `main` at `04c3562`
- **Supersedes:** nothing

## Goal

`test/remover.test.js` "a default sleep is used when none is injected"
(line 175) stops failing about one run in four. The test pauses 5 ms through
the real `setTimeout` and asserts `Date.now() - start >= 5`. Node timers can
answer up to about a millisecond before `Date.now()` says 5 ms have passed,
so the comparison is off by one now and then.

## Decisions

- **Observe the default through the timer, not the wall clock.** The test
  cannot inject a sleep, because the default is exactly what it tests. But
  `defaultSleep` is `new Promise((resolve) => setTimeout(resolve, ms))`, so
  the test swaps `globalThis.setTimeout` for a recording wrapper for the
  duration of one `run()` (saved and restored in `finally`): the wrapper
  records the requested delay and schedules through the real `setTimeout`
  with a 0 ms delay. The test then asserts the recorded schedule is exactly
  `[5]`, the `pauseMs` between the two batches. No `Date.now()` anywhere.
- **What this proves.** With no `sleep` injected, `run()` scheduled a timer
  for the full pause and awaited it before the next batch. That is the
  default sleep running. It cannot pass without the default sleep: a no-op
  or a `Promise.resolve()` default schedules nothing, an unawaited default
  still schedules (so the bite for removal is the schedule assertion, and
  awaiting is covered by the run finishing after the schedule).
- **`src/core/remover.js` does not change.** The card allows a code change
  only if the default is not observable otherwise. A scoped timer stub
  observes it, so the remover keeps every behaviour it has, safety included.
  `run()` gains nothing, loses nothing.
- **The early wake-up is allowed for by not being measured.** The acceptance
  offers either proof without wall-clock precision or allowance for the
  known early wake-up. Taking the first branch: the delay is recorded at
  schedule time, which is exact by construction.

## Steps

### Step 1: Plan

This file and a seeded progress log, one commit.

### Step 2: Reproduce, then replace the test

Run the current test in a loop (`node --test test/remover.test.js`, 40
rounds or until a failure) and record the flake rate. Then rewrite the
default-sleep test with the timer stub. Expected: the new test passes
immediately, the code is already correct; the fix is in the observation,
not the behaviour.

### Step 3: Prove it bites

Temporarily make `defaultSleep` in `src/core/remover.js` a bare
`Promise.resolve()` (no timer), run the test, watch it red on the schedule
assertion, restore the file exactly. Second bite: drop the `await
sleep(pauseMs)` call between batches, watch red, restore.

### Step 4: Green suite and the 50-run loop

`npm run check && npm run test:all` in the worktree, then
`for i in $(seq 1 50); do node --test test/remover.test.js > /dev/null 2>&1 || echo "run $i failed"; done`
with the count pasted into the PR.

### Step 5: Review, PR, hand off

Self review to `reviews/`, PR body with each acceptance box and its real
output, push, `kanban_request_review(reviewer="metis-review")`.

## Acceptance, from the issue

| Box | How it is shown |
|---|---|
| proves the default sleep ran without depending on wall-clock precision, or allows for the known early wake-up | timer-stub test asserting the scheduled delay, zero wall-clock reads |
| `node --test test/remover.test.js` passes 50 runs in a row | loop and its count in the PR body |

## Out of scope

The remover's behaviour, `DEFAULT_PAUSE_MS`, the batch loop, the other 13
remover tests, the dashboard.
