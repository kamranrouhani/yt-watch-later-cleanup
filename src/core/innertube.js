'use strict';

(function (root) {
  const ORIGIN = 'https://www.youtube.com';
  const API_STATUS_SUCCEEDED = 'STATUS_SUCCEEDED';
  // Derived from a HAR by the upstream author; YouTube expects it on every
  // Watch Later edit_playlist call. reference/upstream keeps the derivation.
  const WL_PARAMS = 'CAFAAQ%3D%3D';

  class InnertubeError extends Error {
    constructor(message) {
      super(message);
      this.name = this.constructor.name;
    }
  }

  class RateLimitedError extends InnertubeError {}
  class AuthError extends InnertubeError {}
  class HttpError extends InnertubeError {
    constructor(status, responseText) {
      super(`youtubei request failed (${status}): ${responseText.slice(0, 400)}`);
      this.status = status;
      this.responseText = responseText;
    }
  }
  class EditRejectedError extends InnertubeError {}

  function createInnertube(config, deps) {
    const { apiKey, clientVersion, hl = 'en', gl = 'US', visitorData } = config;
    const { net, authHeader } = deps;
    if (!net || typeof net.fetch !== 'function') throw new TypeError('innertube: deps.net is required');
    if (typeof authHeader !== 'function') throw new TypeError('innertube: deps.authHeader is required');

    const context = { client: { clientName: 'WEB', clientVersion, hl, gl } };
    if (visitorData) context.client.visitorData = visitorData;

    async function request(path, body) {
      const url = `${ORIGIN}/youtubei/v1/${path}?prettyPrint=false&key=${encodeURIComponent(apiKey)}`;
      const res = await net.fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-youtube-client-name': '1',
          'x-youtube-client-version': clientVersion,
          'x-origin': ORIGIN,
          authorization: await authHeader(ORIGIN),
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429) throw new RateLimitedError('youtubei rate limited (429)');
      if (res.status === 401 || res.status === 403) throw new AuthError(`youtubei auth failed (${res.status})`);

      let json = null;
      const text = await res.text();
      if (res.ok || res.status < 500) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }
      if (!res.ok) throw new HttpError(res.status, text);
      if (json === null) throw new HttpError(res.status, text);
      return json;
    }

    function assertEditSucceeded(json) {
      const status = String(json?.status || '').trim();
      if (status && status !== API_STATUS_SUCCEEDED) {
        throw new EditRejectedError(`edit_playlist failed with API status "${status}"`);
      }
    }

    return {
      async browseWatchLater(browseParams) {
        const body = { context, browseId: 'VLWL' };
        if (browseParams) body.params = browseParams;
        return request('browse', body);
      },
      async browseContinuation(token) {
        return request('browse', { context, continuation: token });
      },
      async editPlaylist(actions) {
        const json = await request('browse/edit_playlist', {
          context,
          playlistId: 'WL',
          actions,
          params: WL_PARAMS,
        });
        assertEditSucceeded(json);
        return json;
      },
    };
  }

  const api = { createInnertube, RateLimitedError, AuthError, EditRejectedError, HttpError };

  root.WLCore = Object.assign(root.WLCore || {}, { innertube: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
