'use strict';

(function (root) {
  const WATCH_LATER_URL = 'https://www.youtube.com/playlist?list=WL';
  const DEFAULT_TIMEOUT_MS = 30000;

  class TabGoneError extends Error {
    constructor(message) {
      super(message || 'the YouTube tab is gone');
      this.name = 'TabGoneError';
    }
  }

  class TimeoutError extends Error {
    constructor(message) {
      super(message || 'the YouTube tab did not answer in time');
      this.name = 'TimeoutError';
    }
  }

  const DEFAULT_READY_POLL_MS = 100;

  function isWatchLaterUrl(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'www.youtube.com'
        && parsed.pathname === '/playlist'
        && parsed.searchParams.get('list') === 'WL';
    } catch {
      return false;
    }
  }

  function createTabBridge(chromeApi, {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    readyPollMs = DEFAULT_READY_POLL_MS,
  } = {}) {
    let connectedTabId = null;
    let lastId = 0;
    const pending = new Map();

    chromeApi.tabs.onRemoved.addListener((tabId) => {
      if (tabId !== connectedTabId) return;
      connectedTabId = null;
      for (const { reject } of pending.values()) {
        reject(new TabGoneError('the YouTube tab closed mid request'));
      }
      pending.clear();
    });

    chromeApi.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.wlResponse !== true) return false;
      const entry = pending.get(msg.id);
      if (!entry) return false;
      pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.ok) {
        entry.resolve(msg.result);
      } else {
        const err = new Error(msg.error && msg.error.message);
        err.name = (msg.error && msg.error.name) || 'Error';
        entry.reject(err);
      }
      return false;
    });

    async function probeOnce(tabId, attemptTimeoutMs) {
      const id = (lastId += 1);
      return new Promise((resolveOuter) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          pending.delete(id);
          resolveOuter(false);
        }, attemptTimeoutMs);
        pending.set(id, {
          resolve: () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolveOuter(true);
          },
          reject: () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolveOuter(true);
          },
          timer,
        });
        chromeApi.tabs.sendMessage(tabId, { wlRequest: true, kind: '__wlReadyProbe', id, payload: null })
          .catch(() => {
            pending.delete(id);
          });
      });
    }

    async function waitUntilReady(tabId) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const answered = await probeOnce(tabId, readyPollMs);
        if (answered) return;
        if (Date.now() >= deadline) {
          connectedTabId = null;
          throw new TimeoutError(`tab bridge: the tab never became ready within ${timeoutMs} ms`);
        }
      }
    }

    async function ensureTab() {
      const candidates = await chromeApi.tabs.query({ url: 'https://www.youtube.com/playlist*' });
      const existing = candidates.find((tab) => isWatchLaterUrl(tab.url));
      const tab = existing
        || await chromeApi.tabs.create({ url: WATCH_LATER_URL, active: false });
      connectedTabId = tab.id;
      await waitUntilReady(tab.id);
      return tab;
    }

    async function request(kind, payload) {
      if (connectedTabId === null) {
        throw new Error('tab bridge: no tab yet, call ensureTab first');
      }
      const id = (lastId += 1);
      const promise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new TimeoutError(`tab bridge: no answer for ${kind} within ${timeoutMs} ms`));
          }
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
      });
      try {
        await chromeApi.tabs.sendMessage(connectedTabId, { wlRequest: true, kind, id, payload });
      } catch (err) {
        const entry = pending.get(id);
        if (entry) {
          pending.delete(id);
          clearTimeout(entry.timer);
          entry.reject(new TabGoneError(`tab bridge: the tab is unreachable: ${err.message}`));
        }
      }
      return promise;
    }

    return {
      ensureTab,
      request,
      get connectedTabId() { return connectedTabId; },
    };
  }

  const api = { createTabBridge, TabGoneError, TimeoutError, WATCH_LATER_URL };

  root.WLCore = Object.assign(root.WLCore || {}, { tabBridge: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
