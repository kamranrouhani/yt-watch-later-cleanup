'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createStorage, KEYS } = require('../src/core/storage.js');
const { createFakeStorage } = require('./helpers/fake-storage.js');

test('set and get round trip a value', async () => {
  const { area } = createFakeStorage();
  const storage = createStorage(area);
  assert.deepStrictEqual((await storage.set(KEYS.scan, { entries: [1, 2] })), { ok: true });
  assert.deepStrictEqual(await storage.get(KEYS.scan, null), { entries: [1, 2] });
});

test('get returns the fallback for an absent key', async () => {
  const storage = createStorage(createFakeStorage().area);
  assert.deepStrictEqual(await storage.get('nothing:v1', { a: 1 }), { a: 1 });
});

test('get returns the fallback for a corrupt payload', async () => {
  const { area, backing } = createFakeStorage();
  backing.set('scan:v1', 'not an envelope');
  const storage = createStorage(area);
  assert.deepStrictEqual(await storage.get(KEYS.scan, 'fallback'), 'fallback');
});

test('get treats an unknown envelope version as absent', async () => {
  const { area, backing } = createFakeStorage();
  backing.set('scan:v1', { v: 99, data: { stale: true } });
  const storage = createStorage(area);
  assert.deepStrictEqual(await storage.get(KEYS.scan, 'fallback'), 'fallback');
});

test('values are stored as versioned envelopes', async () => {
  const { area, backing } = createFakeStorage();
  await createStorage(area).set(KEYS.scan, { x: 1 });
  const raw = backing.get('scan:v1');
  assert.strictEqual(raw.v, 1);
  assert.deepStrictEqual(raw.data, { x: 1 });
});

test('remove deletes a key', async () => {
  const { area } = createFakeStorage();
  const storage = createStorage(area);
  await storage.set(KEYS.scan, 1);
  await storage.remove(KEYS.scan);
  assert.deepStrictEqual(await storage.get(KEYS.scan, null), null);
});

test('a non-quota failure also resolves with a warning', async () => {
  const { area } = createFakeStorage();
  area.set = async () => { throw new Error('disk on fire'); };
  const storage = createStorage(area);
  const result = await storage.set(KEYS.presets, { rules: [] });
  assert.strictEqual(result.ok, false);
  assert.match(result.warning, /disk on fire/);
});

test('a failed write resolves with a warning and does not throw', async () => {
  const storage = createStorage(createFakeStorage({ quotaBytes: 0 }).area);
  let warning = null;
  try {
    warning = await storage.set(KEYS.presets, { rules: [] });
  } catch (err) {
    assert.fail(`set threw: ${err.message}`);
  }
  assert.strictEqual(warning.ok, false);
  assert.ok(warning.warning.length > 0);
});

test('a quota failure with no run logs to evict resolves with a warning', async () => {
  const storage = createStorage(createFakeStorage({ quotaBytes: 0 }).area);
  const result = await storage.set(KEYS.runLogs, [{ id: 'r1' }]);
  assert.strictEqual(result.ok, false);
});

test('a quota failure evicts the oldest run log and the new write succeeds', async () => {
  const { area } = createFakeStorage({ quotaBytes: 280 });
  const storage = createStorage(area);
  await storage.set(KEYS.runLogs, [
    { id: 'newest', batches: [{ entries: [{ videoId: 'v2', title: 'New one', channelName: 'C', matchedRule: 'r1' }] }] },
    { id: 'oldest', batches: [{ entries: [{ videoId: 'v1', title: 'Old one that is big enough to matter', channelName: 'C', matchedRule: 'r1' }] }] },
  ]);
  const result = await storage.set(KEYS.presets, { rules: [{ pad: 'x'.repeat(40) }] });
  assert.strictEqual(result.ok, true);
  const logs = await storage.get(KEYS.runLogs, []);
  assert.deepStrictEqual(logs.map((l) => l.id), ['newest']);
  assert.ok((await storage.get(KEYS.presets, null)) !== null);
});

test('eviction never touches the scan or presets', async () => {
  const { area } = createFakeStorage({ quotaBytes: 400 });
  const storage = createStorage(area);
  await storage.set(KEYS.scan, { entries: ['keep me around for a while, plenty of bytes'] });
  await storage.set(KEYS.presets, { name: 'also kept, with some padding to cost bytes' });
  await storage.set(KEYS.runLogs, [{ id: 'old', note: 'old log that will be evicted when the quota bites' }]);
  const result = await storage.set(KEYS.runLogs, [{ id: 'new', note: 'the new log that needs the space of the old one' }]);
  assert.strictEqual(result.ok, true);
  assert.ok((await storage.get(KEYS.scan, null)) !== null);
  assert.ok((await storage.get(KEYS.presets, null)) !== null);
});

test('a retry that still fails resolves with a warning, after one eviction round', async () => {
  const { area, rejects } = (() => {
    const fake = createFakeStorage({ quotaBytes: 200 });
    return { area: fake.area, rejects: fake.backing };
  })();
  const storage = createStorage(area);
  await storage.set(KEYS.runLogs, [{ id: 'old', pad: 'x'.repeat(80) }]);
  const result = await storage.set(KEYS.runLogs, [{ id: 'new', pad: 'y'.repeat(180) }]);
  assert.strictEqual(result.ok, false);
});
