'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createTabBridge, TabGoneError, TimeoutError } = require('../src/core/tabBridge.js');

function makeChrome({ tabs = [] } = {}) {
  const state = { tabs: tabs.map((t) => ({ active: true, ...t })) };
  const removedListeners = [];
  const messages = [];
  const pending = [];
  const runtimeListeners = [];
  let nextId = 100;
  return {
    state,
    chrome: {
      runtime: {
        onMessage: { addListener: (fn) => runtimeListeners.push(fn) },
      },
      tabs: {
        query: async (q) => state.tabs.filter((t) => !q.url || t.url === q.url),
        create: async ({ url, active }) => {
          const tab = { id: nextId++, url, active: active !== false, windowId: 1 };
          state.tabs.push(tab);
          return tab;
        },
        get: async (id) => state.tabs.find((t) => t.id === id) || Promise.reject(new Error('no tab')),
        onRemoved: { addListener: (fn) => removedListeners.push(fn) },
        sendMessage: async (tabId, msg) => {
          messages.push({ tabId, msg });
          pending.push({ id: msg.id });
        },
      },
    },
    removedListeners,
    runtimeListeners,
    messages,
    respond(id, payload) {
      runtimeListeners.forEach((fn) => fn(payload));
    },
  };
}

test('ensureTab finds an existing watch later tab', async () => {
  const { chrome, state } = makeChrome({ tabs: [{ id: 5, url: 'https://www.youtube.com/playlist?list=WL' }] });
  const bridge = createTabBridge(chrome);
  const tab = await bridge.ensureTab();
  assert.strictEqual(tab.id, 5);
  assert.strictEqual(state.tabs.length, 1);
  assert.strictEqual(bridge.connectedTabId, 5);
});

test('ensureTab opens a background tab when none is open', async () => {
  const { chrome, state } = makeChrome();
  const bridge = createTabBridge(chrome);
  const tab = await bridge.ensureTab();
  assert.strictEqual(tab.url, 'https://www.youtube.com/playlist?list=WL');
  assert.strictEqual(state.tabs.length, 1);
  assert.strictEqual(state.tabs[0].active, false);
});

test('a request reaches the tab and its response comes back', async () => {
  const { chrome, messages, respond } = makeChrome({ tabs: [{ id: 5, url: 'https://www.youtube.com/playlist?list=WL' }] });
  const bridge = createTabBridge(chrome);
  await bridge.ensureTab();
  const pending = bridge.request('ping', null);
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0].tabId, 5);
  assert.deepStrictEqual(messages[0].msg, { wlRequest: true, kind: 'ping', id: messages[0].msg.id, payload: null });
  respond(messages[0].msg.id, { wlResponse: true, id: messages[0].msg.id, ok: true, result: { clientVersion: '2.x' } });
  assert.deepStrictEqual(await pending, { clientVersion: '2.x' });
});

test('a failing response rejects with the error name and message', async () => {
  const { chrome, messages, respond } = makeChrome({ tabs: [{ id: 5, url: 'https://www.youtube.com/playlist?list=WL' }] });
  const bridge = createTabBridge(chrome);
  await bridge.ensureTab();
  const pending = bridge.request('browseWatchLater', 'params');
  await new Promise((resolve) => setImmediate(resolve));
  respond(messages[0].msg.id, { wlResponse: true, id: messages[0].msg.id, ok: false, error: { name: 'RateLimitedError', message: '429' } });
  await assert.rejects(() => pending, (err) => err.name === 'RateLimitedError' && err.message === '429');
});

test('closing the tab mid request rejects with TabGoneError, not a hang', async () => {
  const { chrome, removedListeners } = makeChrome({ tabs: [{ id: 5, url: 'https://www.youtube.com/playlist?list=WL' }] });
  const bridge = createTabBridge(chrome);
  await bridge.ensureTab();
  const pending = bridge.request('browseWatchLater', null);
  await new Promise((resolve) => setImmediate(resolve));
  removedListeners.forEach((fn) => fn(5, { windowId: 1, isWindowClosing: false }));
  await assert.rejects(() => pending, TabGoneError);
});

test('a request that never answers times out', async () => {
  const { chrome } = makeChrome({ tabs: [{ id: 5, url: 'https://www.youtube.com/playlist?list=WL' }] });
  const bridge = createTabBridge(chrome, { timeoutMs: 10 });
  await bridge.ensureTab();
  await assert.rejects(() => bridge.request('ping', null), TimeoutError);
});

test('a request before ensureTab throws a setup error', async () => {
  const { chrome } = makeChrome();
  const bridge = createTabBridge(chrome);
  await assert.rejects(() => bridge.request('ping', null), /no tab/i);
});
