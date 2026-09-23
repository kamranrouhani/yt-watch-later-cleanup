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

  function createTabBridge(chromeApi, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
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

    async function ensureTab() {
      const [existing] = await chromeApi.tabs.query({ url: WATCH_LATER_URL });
      if (existing) {
        connectedTabId = existing.id;
        return existing;
      }
      const created = await chromeApi.tabs.create({ url: WATCH_LATER_URL, active: false });
      connectedTabId = created.id;
      return created;
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
