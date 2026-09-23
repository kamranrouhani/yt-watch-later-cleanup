'use strict';

(function (root) {
  const ENVELOPE_VERSION = 1;

  const KEYS = {
    scan: 'scan:v1',
    presets: 'presets:v1',
    apiKey: 'apiKey:v1',
    runLogs: 'runLogs:v1',
    enrichmentCache: 'enrichmentCache:v1',
  };

  function isQuotaError(err) {
    return err && /quota/i.test(String(err.name || err.message || ''));
  }

  function createStorage(area) {
    async function readEnvelope(key) {
      const found = await area.get([key]);
      const raw = found && found[key];
      if (!raw || typeof raw !== 'object' || raw.v !== ENVELOPE_VERSION) return null;
      return raw.data;
    }

    async function set(key, value) {
      const payload = { v: ENVELOPE_VERSION, data: value };
      try {
        await area.set({ [key]: payload });
        return { ok: true };
      } catch (err) {
        if (!isQuotaError(err)) {
          return { ok: false, warning: `storage write failed: ${err.message}` };
        }
        const logs = await readEnvelope(KEYS.runLogs);
        if (Array.isArray(logs) && logs.length > 0) {
          const trimmed = logs.slice(0, -1);
          try {
            await area.set({ [KEYS.runLogs]: { v: ENVELOPE_VERSION, data: trimmed } });
            await area.set({ [key]: payload });
            return { ok: true };
          } catch (retryErr) {
            return { ok: false, warning: `storage quota: write failed after evicting the oldest run log: ${retryErr.message}` };
          }
        }
        return { ok: false, warning: `storage quota exceeded: ${err.message}` };
      }
    }

    return {
      async get(key, fallback) {
        const data = await readEnvelope(key);
        return data === null ? fallback : data;
      },
      set,
      async remove(key) {
        await area.remove([key]);
      },
    };
  }

  const api = { createStorage, KEYS };

  root.WLCore = Object.assign(root.WLCore || {}, { storage: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
