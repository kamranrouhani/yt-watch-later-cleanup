'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createNet } = require('../src/core/net.js');

function stubbedFetch() {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200 };
  };
  return calls;
}

const ALLOWED = ['https://www.youtube.com', 'https://www.googleapis.com'];

test('net rejects a url whose origin is not allowlisted, before any request', async () => {
  const calls = stubbedFetch();
  const { fetch } = createNet(ALLOWED);
  await assert.rejects(
    () => fetch('https://example.com/path?q=1'),
    (err) => err instanceof TypeError && err.message.includes('https://example.com'),
  );
  assert.deepStrictEqual(calls, []);
});

test('net allows both allowlisted origins through to fetch', async () => {
  const calls = stubbedFetch();
  const { fetch } = createNet(ALLOWED);
  await fetch('https://www.youtube.com/youtubei/v1/browse?x=1');
  await fetch('https://www.googleapis.com/youtube/v3/videos');
  assert.deepStrictEqual(calls.map((c) => new URL(c.url).origin), ALLOWED);
});

test('net forces credentials include on allowed calls', async () => {
  const calls = stubbedFetch();
  const { fetch } = createNet(ALLOWED);
  await fetch('https://www.youtube.com/youtubei/v1/browse');
  assert.strictEqual(calls[0].init.credentials, 'include');
});

test('net rejects lookalike hosts, scheme swaps and relative urls', async () => {
  const calls = stubbedFetch();
  const { fetch } = createNet(ALLOWED);
  for (const url of [
    'https://www.youtube.com.evil.io/x',
    'http://www.youtube.com/x',
    'ftp://www.youtube.com/x',
    '/youtubei/v1/browse',
    'youtubei/v1/browse',
  ]) {
    await assert.rejects(() => fetch(url), TypeError, `${url} should be rejected`);
  }
  assert.deepStrictEqual(calls, []);
});

test('net passes method and headers through unchanged', async () => {
  const calls = stubbedFetch();
  const { fetch } = createNet(ALLOWED);
  await fetch('https://www.youtube.com/youtubei/v1/browse', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const { init } = calls[0];
  assert.strictEqual(init.method, 'POST');
  assert.strictEqual(init.headers['content-type'], 'application/json');
  assert.strictEqual(init.body, '{}');
});

test('a net instance only allows what it was built with', async () => {
  const calls = stubbedFetch();
  const { fetch } = createNet(['https://www.youtube.com']);
  await fetch('https://www.youtube.com/x');
  await assert.rejects(() => fetch('https://www.googleapis.com/youtube/v3/videos'));
  assert.strictEqual(calls.length, 1);
});
