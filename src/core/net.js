'use strict';

(function (root) {
  function createNet(allowedOrigins) {
    const allowed = new Set(allowedOrigins);

    async function fetch(url, init = {}) {
      const parsed = new URL(url, 'file:///net-guard');
      if (parsed.protocol === 'file:') {
        throw new TypeError(`net: refusing a url without an http origin: ${url}`);
      }
      if (!allowed.has(parsed.origin)) {
        throw new TypeError(`net: origin not allowed: ${parsed.origin}`);
      }
      return globalThis.fetch(url, { ...init, credentials: 'include' });
    }

    return { fetch };
  }

  const api = { createNet };

  root.WLCore = Object.assign(root.WLCore || {}, { net: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
