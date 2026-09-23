'use strict';

(function (root) {
  const SAPISID_COOKIE_NAMES = ['SAPISID', '__Secure-3PAPISID', '__Secure-1PAPISID'];

  class NotSignedInError extends Error {
    constructor() {
      super('Missing SAPISID/3PAPISID cookie. Are you logged in to YouTube?');
      this.name = NotSignedInError.name;
    }
  }

  function getCookie(name, cookieString) {
    const parts = cookieString.split(';').map((x) => x.trim());
    const key = `${name}=`;
    for (const part of parts) {
      if (part.startsWith(key)) {
        return decodeURIComponent(part.slice(key.length));
      }
    }
    return '';
  }

  function pickSapisid(cookieString) {
    for (const name of SAPISID_COOKIE_NAMES) {
      const value = getCookie(name, cookieString);
      if (value) return value;
    }
    throw new NotSignedInError();
  }

  async function sha1Hex(input) {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function buildAuthHeader({ sapisid, origin, nowSeconds }) {
    if (!sapisid) throw new NotSignedInError();
    const input = `${nowSeconds} ${sapisid} ${origin}`;
    return `SAPISIDHASH ${nowSeconds}_${await sha1Hex(input)}`;
  }

  const api = { pickSapisid, buildAuthHeader, NotSignedInError };

  root.WLCore = Object.assign(root.WLCore || {}, { auth: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
