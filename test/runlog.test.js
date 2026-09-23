'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createStorage, KEYS } = require('../src/core/storage.js');
const { createRunLog, exportJSON } = require('../src/core/runLog.js');
const { createFakeStorage } = require('./helpers/fake-storage.js');

function snapshot(n) {
  return {
    setVideoId: `S${n}`, videoId: `vid${n}`, title: `Title ${n}`,
    channelName: `Channel ${n}`, channelId: `UC${n}`,
  };
}

const RULE = { conditions: [{ field: 'watchedPercent', operator: '>=', value: 90 }] };

async function aFinishedRun(area) {
  const storage = createStorage(area);
  const run = createRunLog(storage);
  const handle = await run.start({ ruleSetSummary: 'finished' });
  await handle.appendBatch([snapshot(1), snapshot(2)], RULE);
  await handle.appendBatch([snapshot(3)], RULE);
  await handle.finish();
  return handle;
}

test('a run log survives a simulated dashboard reload', async () => {
  const { area } = createFakeStorage();
  await aFinishedRun(area);

  const fresh = createRunLog(createStorage(area));
  const logs = await fresh.list();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].status, 'finished');
  assert.strictEqual(logs[0].batches.length, 2);
  assert.deepStrictEqual(logs[0].batches[0].entries.map((e) => e.videoId), ['vid1', 'vid2']);
});

test('an aborted run keeps the batches it already wrote', async () => {
  const { area } = createFakeStorage();
  const storage = createStorage(area);
  const run = createRunLog(storage);
  const handle = await run.start({});
  await handle.appendBatch([snapshot(1)], RULE);
  await handle.abort('stopped by user');
  const logs = await run.list();
  assert.strictEqual(logs[0].status, 'aborted');
  assert.strictEqual(logs[0].abortedReason, 'stopped by user');
  assert.strictEqual(logs[0].batches.length, 1);
});

test('appendBatch persists immediately, one batch at a time', async () => {
  const { area } = createFakeStorage();
  const storage = createStorage(area);
  const run = createRunLog(storage);
  const handle = await run.start({});
  await handle.appendBatch([snapshot(1)], RULE);
  const mid = await run.list();
  assert.strictEqual(mid[0].batches.length, 1);
  assert.strictEqual(mid[0].status, 'running');
  await handle.appendBatch([snapshot(2)], RULE);
  const after = await run.list();
  assert.strictEqual(after[0].batches.length, 2);
});

test('the exported json contains every videoId, title, channel and matched rule', async () => {
  const { area } = createFakeStorage();
  await aFinishedRun(area);
  const storage = createStorage(area);
  const second = createRunLog(storage);
  const handle = await second.start({ preset: 'second run' });
  await handle.appendBatch([snapshot(4)], RULE);
  await handle.finish();

  const exported = exportJSON(await storage.get(KEYS.runLogs, []));
  assert.strictEqual(exported.runs.length, 2);
  const removed = exported.runs.flatMap((r) => r.removed);
  assert.deepStrictEqual(removed.map((e) => e.videoId), ['vid4', 'vid1', 'vid2', 'vid3']);
  for (const e of removed) {
    assert.ok(e.title.startsWith('Title '), 'title missing');
    assert.ok(e.channelName.startsWith('Channel '), 'channel missing');
    assert.deepStrictEqual(e.matchedRule, RULE);
  }
});

test('a handle whose write failed stays truthful in memory', async () => {
  const { area } = createFakeStorage({ quotaBytes: 60 });
  const storage = createStorage(area);
  const run = createRunLog(storage);
  const handle = await run.start({});
  const warning = await handle.appendBatch([snapshot(1)], RULE);
  assert.strictEqual(warning.ok, false);
  const json = handle.toJSON();
  assert.strictEqual(json.batches.length, 1);
  assert.deepStrictEqual(json.batches[0].entries.map((e) => e.videoId), ['vid1']);
});

test('newest run is listed first', async () => {
  const { area } = createFakeStorage();
  const storage = createStorage(area);
  const run = createRunLog(storage);
  const first = await run.start({ name: 'first' });
  await first.finish();
  const second = await run.start({ name: 'second' });
  await second.finish();
  const logs = await run.list();
  assert.deepStrictEqual(logs.map((l) => l.meta.name), ['second', 'first']);
});
