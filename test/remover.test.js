'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createPlan, run } = require('../src/core/remover.js');
const { RateLimitedError, AuthError, EditRejectedError } = require('../src/core/innertube.js');

function previewEntry(n) {
  return {
    setVideoId: `S${String(n).padStart(3, '0')}`, videoId: `v${n}`,
    title: `Title ${n}`, channelName: `Channel ${n}`,
    position: n, watchedPercent: 100, channelId: `UC${n}`,
    durationSeconds: 600, playable: true, isShort: false, isLive: false,
  };
}

function previewResult(count, matchedRule = { conditions: [] }) {
  return { remove: Array.from({ length: count }, (_, i) => ({ entry: previewEntry(i + 1), matchedRule })), protected: [], skippedMissingData: 0 };
}

function fakeInnertube(script = []) {
  const calls = [];
  const queue = [...script];
  return {
    calls,
    async editPlaylist(actions) {
      calls.push(actions);
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return next || { status: 'STATUS_SUCCEEDED' };
    },
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function previewOf(count) {
  return previewResult(count);
}

test('safety: anything that is not a plan from createPlan throws', async () => {
  const innertube = fakeInnertube();
  const plan = createPlan(previewOf(3), { entries: 3, scannedAt: 'x' });
  const lookalikes = [
    null,
    undefined,
    { kind: 'removal-plan', version: 1, setVideoIds: ['S1'], entries: [], fingerprint: {} },
    { ...plan, kind: 'other' },
    { ...plan, version: 2 },
    ['S1'],
  ];
  for (const bad of lookalikes) {
    await assert.rejects(() => run(bad, { innertube, pauseMs: 0 }), TypeError, JSON.stringify(bad && bad.kind));
  }
  assert.deepStrictEqual(innertube.calls, []);
});

test('safety: a plan is frozen deeply and cannot be widened after creation', () => {
  const plan = createPlan(previewOf(2), { entries: 2 });
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.setVideoIds));
  assert.ok(Object.isFrozen(plan.entries));
  assert.throws(() => { plan.setVideoIds.push('S999'); });
  assert.throws(() => { plan.entries[0].title = 'changed'; });
});

test('safety: batch size 0, 51 or a string is rejected before any request', async () => {
  const innertube = fakeInnertube();
  const plan = createPlan(previewOf(3), { entries: 3 });
  for (const bad of [0, 51, '25', -1, 1.5]) {
    await assert.rejects(() => run(plan, { innertube, batchSize: bad, pauseMs: 0 }), RangeError, String(bad));
  }
  assert.deepStrictEqual(innertube.calls, []);
});

test('a 60 item plan with batch size 25 sends 25, 25 and 10 with exact payloads', async () => {
  const innertube = fakeInnertube();
  const plan = createPlan(previewOf(60), { entries: 60 });
  const result = await run(plan, { innertube, batchSize: 25, pauseMs: 0 });
  assert.deepStrictEqual(innertube.calls.map((actions) => actions.length), [25, 25, 10]);
  const first = innertube.calls[0];
  assert.deepStrictEqual(first[0], { action: 'ACTION_REMOVE_VIDEO', setVideoId: 'S001' });
  assert.deepStrictEqual(first[24], { action: 'ACTION_REMOVE_VIDEO', setVideoId: 'S025' });
  assert.deepStrictEqual(innertube.calls[2][9], { action: 'ACTION_REMOVE_VIDEO', setVideoId: 'S060' });
  assert.strictEqual(result.status, 'complete');
  assert.strictEqual(result.removedSetVideoIds.length, 60);
  assert.strictEqual(result.batches.length, 3);
});

test('onBatch fires after each batch with the entries it removed', async () => {
  const innertube = fakeInnertube();
  const plan = createPlan(previewOf(30), { entries: 30 });
  const seen = [];
  const result = await run(plan, { innertube, batchSize: 10, pauseMs: 0, onBatch: (batch) => seen.push(batch.entries.map((e) => e.setVideoId)) });
  assert.deepStrictEqual(seen, [
    ['S001', 'S002', 'S003', 'S004', 'S005', 'S006', 'S007', 'S008', 'S009', 'S010'],
    ['S011', 'S012', 'S013', 'S014', 'S015', 'S016', 'S017', 'S018', 'S019', 'S020'],
    ['S021', 'S022', 'S023', 'S024', 'S025', 'S026', 'S027', 'S028', 'S029', 'S030'],
  ]);
  assert.strictEqual(result.status, 'complete');
});

test('a 429 on batch 2 stops the run: batch 1 done, batches 2 and 3 not attempted', async () => {
  const innertube = fakeInnertube([null, new RateLimitedError('youtubei rate limited (429)')]);
  const plan = createPlan(previewOf(60), { entries: 60 });
  const batches = [];
  const result = await run(plan, {
    innertube, batchSize: 25, pauseMs: 0,
    onBatch: (batch) => batches.push(batch.index),
  });
  assert.strictEqual(result.status, 'stopped');
  assert.match(result.stopReason, /rate limited/i);
  assert.strictEqual(result.removedSetVideoIds.length, 25);
  assert.deepStrictEqual(batches, [1]);
  assert.deepStrictEqual(result.batches.map((b) => b.ok), [true]);
  assert.strictEqual(innertube.calls.length, 2);
});

test('auth and edit-rejected errors stop the run too', async () => {
  for (const error of [new AuthError('401'), new EditRejectedError('FAILED_TRANSACTION')]) {
    const innertube = fakeInnertube([error]);
    const plan = createPlan(previewOf(2), { entries: 2 });
    const result = await run(plan, { innertube, batchSize: 1, pauseMs: 0 });
    assert.strictEqual(result.status, 'stopped');
    assert.strictEqual(result.removedSetVideoIds.length, 0);
  }
});

test('an unexpected http error also stops rather than being swallowed', async () => {
  const { HttpError } = require('../src/core/innertube.js');
  const innertube = fakeInnertube([new HttpError(500, 'boom')]);
  const plan = createPlan(previewOf(2), { entries: 2 });
  const result = await run(plan, { innertube, batchSize: 1, pauseMs: 0 });
  assert.strictEqual(result.status, 'stopped');
  assert.match(result.stopReason, /500/);
});

test('abort between batches stops before the next request', async () => {
  const innertube = fakeInnertube();
  const plan = createPlan(previewOf(30), { entries: 30 });
  const signal = { aborted: false };
  let calls = 0;
  const result = await run(plan, {
    innertube, batchSize: 10, pauseMs: 0, signal,
    onBatch: () => { calls += 1; if (calls === 1) signal.aborted = true; },
  });
  assert.strictEqual(result.status, 'stopped');
  assert.match(result.stopReason, /abort/i);
  assert.strictEqual(result.removedSetVideoIds.length, 10);
  assert.strictEqual(innertube.calls.length, 1);
});

test('abort before the first batch sends nothing', async () => {
  const innertube = fakeInnertube();
  const plan = createPlan(previewOf(5), { entries: 5 });
  const result = await run(plan, { innertube, batchSize: 5, pauseMs: 0, signal: { aborted: true } });
  assert.strictEqual(result.status, 'stopped');
  assert.deepStrictEqual(innertube.calls, []);
  assert.strictEqual(result.removedSetVideoIds.length, 0);
});

test('the pause happens between batches and not after the last', async () => {
  const innertube = fakeInnertube();
  const plan = createPlan(previewOf(6), { entries: 6 });
  let waited = 0;
  const result = await run(plan, {
    innertube, batchSize: 3, pauseMs: 1,
    sleep: async (ms) => { waited += ms; },
  });
  assert.strictEqual(waited, 1);
  assert.strictEqual(result.status, 'complete');
});

test('a default sleep is used when none is injected', async () => {
  const innertube = fakeInnertube();
  const plan = createPlan(previewOf(2), { entries: 2 });
  const realSetTimeout = globalThis.setTimeout;
  const scheduled = [];
  globalThis.setTimeout = (fn, ms, ...rest) => {
    scheduled.push(ms);
    return realSetTimeout(fn, 0, ...rest);
  };
  try {
    const result = await run(plan, { innertube, batchSize: 1, pauseMs: 5 });
    assert.deepStrictEqual(scheduled, [5]);
    assert.strictEqual(result.status, 'complete');
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
});

test('createPlan rejects previews without remove lists or usable entries', () => {
  assert.throws(() => createPlan({}, {}), /remove/);
  assert.throws(() => createPlan({ remove: [] }, {}), /empty/i);
  assert.throws(() => createPlan({ remove: [{ entry: { title: 'no id' } }] }, {}), /setVideoId/);
  assert.throws(() => createPlan({ remove: [{ entry: { setVideoId: '' } }] }, {}), /setVideoId/);
});

test('the plan carries the entries and the fingerprint the caller gave', () => {
  const fingerprint = { entries: 7, scannedAt: '2026-09-23T00:00:00Z' };
  const plan = createPlan(previewOf(7), fingerprint);
  assert.deepStrictEqual(plan.fingerprint, fingerprint);
  assert.strictEqual(plan.entries.length, 7);
  assert.deepStrictEqual(plan.setVideoIds, plan.entries.map((e) => e.setVideoId));
  assert.ok(Object.isFrozen(plan.fingerprint));
});
