'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createTabBridge, TabGoneError, TimeoutError } = require('../src/core/tabBridge.js');

function makeChrome({ tabs = [], createState = 'ready' } = {}) {
  const state = {
    tabs: tabs.map((t) => ({ active: true, contentState: 'ready', ...t })),
  };
  const removedListeners = [];
  const messages = [];
  const runtimeListeners = [];
  let nextId = 100;
  return {
    state,
    chrome: {
      runtime: {
        onMessage: { addListener: (fn) => runtimeListeners.push(fn) },
      },
      tabs: {
        query: async (q) => state.tabs.filter((t) => {
          if (!q.url) return true;
          if (q.url.endsWith('*')) return t.url.startsWith(q.url.slice(0, -1));
          return t.url === q.url;
        }),
        create: async ({ url, active }) => {
          const tab = { id: nextId++, url, active: active !== false, windowId: 1, contentState: createState };
          state.tabs.push(tab);
          return tab;
        },
        get: async (id) => state.tabs.find((t) => t.id === id) || Promise.reject(new Error('no tab')),
        onRemoved: { addListener: (fn) => removedListeners.push(fn) },
        sendMessage: async (tabId, msg) => {
          const tab = state.tabs.find((t) => t.id === tabId);
          if (!tab || tab.contentState === 'none') {
            throw new Error('Could not establish connection. Receiving end does not exist.');
          }
          if (!msg || msg.wlRequest !== true) return undefined;
          if (msg.kind === '__wlReadyProbe') {
            if (tab.contentState === 'ready') {
              queueMicrotask(() => {
                runtimeListeners.forEach((fn) => fn({ wlResponse: true, id: msg.id, ok: true, result: {} }));
              });
            }
            // contentState 'listening': bridge.js is attached but page.js has not
            // taken the nonce yet, so the request is accepted and silently dropped,
            // exactly like the real extension. No response ever arrives.
            return undefined;
          }
          messages.push({ tabId, msg });
          return undefined;
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

test('ensureTab waits for a freshly created tab to have no content script yet, then resolves once it answers', async () => {
  const { chrome, state, messages, respond } = makeChrome({ createState: 'none' });
  const bridge = createTabBridge(chrome, { readyPollMs: 1 });
  let resolved = false;
  const ensured = bridge.ensureTab().then((tab) => { resolved = true; return tab; });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.strictEqual(resolved, false, 'ensureTab must not resolve while the tab has no content script');
  assert.strictEqual(state.tabs[0].contentState, 'none');
  state.tabs[0].contentState = 'ready';
  await ensured;
  assert.strictEqual(resolved, true);
  const req = bridge.request('ping', null);
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(messages.length, 1);
  respond(messages[0].msg.id, { wlResponse: true, id: messages[0].msg.id, ok: true, result: { clientVersion: '2.x' } });
  assert.deepStrictEqual(await req, { clientVersion: '2.x' });
});

test('ensureTab keeps waiting when the bridge is attached but the page has not taken the nonce yet', async () => {
  const { chrome, state } = makeChrome({
    tabs: [{ id: 5, url: 'https://www.youtube.com/playlist?list=WL', contentState: 'listening' }],
  });
  const bridge = createTabBridge(chrome, { readyPollMs: 1 });
  let resolved = false;
  const ensured = bridge.ensureTab().then(() => { resolved = true; });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.strictEqual(resolved, false, 'sendMessage not throwing must not be mistaken for readiness');
  state.tabs[0].contentState = 'ready';
  await ensured;
  assert.strictEqual(resolved, true);
});

test('ensureTab waits for a reused tab that has no content script yet', async () => {
  const { chrome, state, messages, respond } = makeChrome({
    tabs: [{ id: 5, url: 'https://www.youtube.com/playlist?list=WL', contentState: 'none' }],
  });
  const bridge = createTabBridge(chrome, { readyPollMs: 1 });
  let resolved = false;
  const ensured = bridge.ensureTab().then(() => { resolved = true; });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.strictEqual(resolved, false);
  state.tabs[0].contentState = 'ready';
  await ensured;
  assert.strictEqual(resolved, true);
  const req = bridge.request('ping', null);
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(messages.length, 1);
  respond(messages[0].msg.id, { wlResponse: true, id: messages[0].msg.id, ok: true, result: { clientVersion: '2.x' } });
  assert.deepStrictEqual(await req, { clientVersion: '2.x' });
});

test('ensureTab rejects with TimeoutError if the tab never answers', async () => {
  const { chrome } = makeChrome({ createState: 'none' });
  const bridge = createTabBridge(chrome, { timeoutMs: 20, readyPollMs: 5 });
  await assert.rejects(() => bridge.ensureTab(), TimeoutError);
  assert.strictEqual(bridge.connectedTabId, null);
});

test('ensureTab rejects with TimeoutError if the bridge is attached but the nonce never arrives', async () => {
  const { chrome } = makeChrome({
    tabs: [{ id: 5, url: 'https://www.youtube.com/playlist?list=WL', contentState: 'listening' }],
  });
  const bridge = createTabBridge(chrome, { timeoutMs: 20, readyPollMs: 5 });
  await assert.rejects(() => bridge.ensureTab(), TimeoutError);
  assert.strictEqual(bridge.connectedTabId, null);
});

test('an existing Watch Later tab with extra query parameters is reused, no second tab opened', async () => {
  const { chrome, state } = makeChrome({
    tabs: [{ id: 5, url: 'https://www.youtube.com/playlist?list=WL&index=3&pp=abc' }],
  });
  const bridge = createTabBridge(chrome);
  const tab = await bridge.ensureTab();
  assert.strictEqual(tab.id, 5);
  assert.strictEqual(state.tabs.length, 1);
});

test('a tab that is not Watch Later is never picked', async () => {
  const { chrome, state } = makeChrome({
    tabs: [
      { id: 5, url: 'https://www.youtube.com/playlist?list=PLsomethingelse' },
      { id: 6, url: 'https://www.youtube.com/' },
    ],
  });
  const bridge = createTabBridge(chrome);
  const tab = await bridge.ensureTab();
  assert.strictEqual(state.tabs.length, 3);
  assert.strictEqual(tab.url, 'https://www.youtube.com/playlist?list=WL');
});
