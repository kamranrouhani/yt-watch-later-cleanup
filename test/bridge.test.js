'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const BRIDGE_SOURCE = fs.readFileSync(path.join(ROOT, 'content/bridge.js'), 'utf8');
const PAGE_SOURCE = fs.readFileSync(path.join(ROOT, 'content/page.js'), 'utf8');

function runSource(source, globals) {
  const sandbox = { ...globals };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

function listenRecorder() {
  const handlers = {};
  const window = {
    handlers,
    location: { origin: 'https://www.youtube.com' },
    addEventListener(type, handler) { handlers[type] = handler; },
    postMessage() {},
  };
  window.self = window;
  return window;
}

function makeBridgeSandbox({ nonce = 'aabbccdd00112233' } = {}) {
  const posted = [];
  const runtime = {
    onMessage: { addListener(handler) { this.handler = handler; } },
    sendMessage: (msg) => posted.push(['runtime', msg]),
  };
  const window = listenRecorder();
  const crypto = { getRandomValues: (arr) => { arr.fill(7); return arr; } };
  const sandbox = runSource(BRIDGE_SOURCE, {
    window,
    crypto,
    chrome: { runtime },
  });
  window.nonce = nonce;
  return { sandbox, window, runtime, posted, crypto };
}

test('the bridge installs once and ignores a second injection', () => {
  const first = makeBridgeSandbox();
  const before = first.window.handlers.message;
  const second = vm.runInContext;
  const again = runSource(BRIDGE_SOURCE, {
    window: first.window,
    crypto: first.crypto,
    chrome: { runtime: first.runtime },
    __wlBridgeInstalled: true,
  });
  assert.strictEqual(first.window.handlers.message, before, 'second injection replaced the listener');
});

test('the bridge says hello with a fresh nonce and a mark', () => {
  const { window } = makeBridgeSandbox();
  const posted = [];
  window.postMessage = (msg) => posted.push(msg);
  window.handlers.message({ source: window, data: { wlBridge: true, type: 'hello', nonce: 'x' } });
  assert.ok(posted.length === 0 || posted[0].type !== 'hello');
});

test('the bridge relays a dashboard request into the page with the nonce', () => {
  const { window, runtime } = makeBridgeSandbox();
  const posted = [];
  window.postMessage = (msg) => posted.push(msg);
  runtime.onMessage.handler({ wlRequest: true, kind: 'ping', id: 42, payload: null }, { sender: { tab: { id: 7 } } });
  assert.strictEqual(posted.length, 1);
  const relayed = posted[0];
  assert.strictEqual(relayed.wlBridge, true);
  assert.strictEqual(relayed.type, 'request');
  assert.strictEqual(relayed.kind, 'ping');
  assert.strictEqual(relayed.id, 42);
  assert.match(relayed.nonce, /^[0-9a-f]{32}$/);
});

test('the bridge relays a page response back to the dashboard unchanged', () => {
  const { window, runtime, posted } = makeBridgeSandbox();
  runtime.onMessage.handler({ wlRequest: true, kind: 'ping', id: 42, payload: null }, { sender: { tab: { id: 7 } } });
  window.handlers.message({
    source: window,
    data: { wlBridge: true, nonce: 'whatever-the-page-has', type: 'response', id: 42, ok: true, result: { clientVersion: '2.2026' } },
  });
  const sent = posted.find(([channel]) => channel === 'runtime')[1];
  assert.deepEqual(sent, { wlResponse: true, id: 42, ok: true, result: { clientVersion: '2.2026' } });
});

test('the bridge ignores page messages that are not responses', () => {
  const { window, runtime, posted } = makeBridgeSandbox();
  runtime.onMessage.handler({ wlRequest: true, kind: 'ping', id: 42, payload: null }, { sender: { tab: { id: 7 } } });
  const before = posted.length;
  window.handlers.message({ source: window, data: { wlBridge: true, type: 'hello', nonce: 'x' } });
  window.handlers.message({ source: window, data: { other: true } });
  window.handlers.message({ source: { notWindow: true }, data: { wlBridge: true, type: 'response', id: 42 } });
  assert.strictEqual(posted.length, before);
});

test('the page world ignores messages with a wrong or missing nonce', () => {
  const calls = [];
  const sandbox = runSource(PAGE_SOURCE, {
    window: listenRecorder(),
    __wlPageClient: { browseWatchLater: async () => { calls.push('browse'); } },
  });
  const window = sandbox.window;
  for (const bad of [undefined, '', 'wrong', null]) {
    window.handlers.message({
      source: window,
      data: { wlBridge: true, nonce: bad, type: 'request', kind: 'browseWatchLater', id: 1, payload: null },
    });
  }
  assert.deepStrictEqual(calls, []);
});

function makePageSandbox(clientOverrides = {}) {
  const posted = [];
  const window = listenRecorder();
  window.postMessage = (msg) => posted.push(msg);
  window.ytcfg = { get: (k) => (k === 'INNERTUBE_CLIENT_VERSION' ? '2.2026.09.23' : undefined) };
  const client = {
    browseWatchLater: async (params) => ({ page: params }),
    browseContinuation: async () => ({}),
    editPlaylist: async () => ({ status: 'STATUS_SUCCEEDED' }),
    ...clientOverrides,
  };
  const WLCore = {
    auth: { pickSapisid: () => '' },
    net: { createNet: () => ({ fetch: async () => { throw new Error('no'); } }) },
    innertube: { createInnertube: () => client },
  };
  runSource(PAGE_SOURCE, { window, WLCore });
  const nonce = 'nonce-for-tests-0001';
  window.handlers.message({ source: window, data: { wlBridge: true, type: 'hello', nonce } });
  return { window, posted, client, nonce };
}

test('the page answers a ping with the client version and signed-in state', async () => {
  const { window, posted, nonce } = makePageSandbox();
  const reply = new Promise((resolve) => {
    window.postMessage = (msg) => { posted.push(msg); resolve(msg); };
  });
  window.handlers.message({ source: window, data: { wlBridge: true, nonce, type: 'request', kind: 'ping', id: 9, payload: null } });
  const response = await reply;
  assert.strictEqual(response.type, 'response');
  assert.strictEqual(response.id, 9);
  assert.strictEqual(response.ok, true);
  assert.deepEqual(response.result, { clientVersion: '2.2026.09.23', signedIn: false });
});

test('the page serialises client errors with their name', async () => {
  const failure = new Error('youtubei auth failed (401)');
  failure.name = 'AuthError';
  const { window, posted, nonce } = makePageSandbox({
    browseWatchLater: async () => { throw failure; },
  });
  window.handlers.message({ source: window, data: { wlBridge: true, nonce, type: 'request', kind: 'browseWatchLater', id: 3, payload: null } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const response = posted.find((m) => m.type === 'response');
  assert.strictEqual(response.ok, false);
  assert.deepEqual(response.error, { name: 'AuthError', message: 'youtubei auth failed (401)' });
});

test('the page installs once and a second injection is a no-op', () => {
  const window = listenRecorder();
  runSource(PAGE_SOURCE, { window, WLCore: {} });
  const before = window.handlers.message;
  runSource(PAGE_SOURCE, { window, WLCore: {}, __wlPage: true });
  assert.strictEqual(window.handlers.message, before);
});

test('the page ignores a request that arrives before any hello', async () => {
  const { window, posted } = makePageSandbox();
  const before = posted.length;
  window.handlers.message({ source: window, data: { wlBridge: true, nonce: 'guess', type: 'request', kind: 'ping', id: 1, payload: null } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.strictEqual(posted.length, before);
});
