'use strict';

(function () {
  if (window.__wlPage) return;
  window.__wlPage = true;

  let nonce = null;
  let client = null;

  function ytcfgValue(key) {
    if (window.ytcfg && typeof window.ytcfg.get === 'function') {
      return window.ytcfg.get(key);
    }
    return undefined;
  }

  function getClient() {
    if (client) return client;
    const origin = window.location.origin;
    const net = WLCore.net.createNet([origin]);
    const config = {
      apiKey: ytcfgValue('INNERTUBE_API_KEY'),
      clientVersion: ytcfgValue('INNERTUBE_CLIENT_VERSION'),
      hl: ytcfgValue('HL') || 'en',
      gl: ytcfgValue('GL') || 'US',
      visitorData: ytcfgValue('VISITOR_DATA'),
    };
    const authHeader = (requestOrigin) => WLCore.auth.buildAuthHeader({
      sapisid: WLCore.auth.pickSapisid(document.cookie),
      origin: requestOrigin,
      nowSeconds: Math.floor(Date.now() / 1000),
    });
    client = WLCore.innertube.createInnertube(config, { net, authHeader });
    return client;
  }

  function signedIn() {
    try {
      return Boolean(WLCore.auth.pickSapisid(document.cookie));
    } catch {
      return false;
    }
  }

  async function handleRequest(kind, payload) {
    if (kind === 'ping') {
      return { clientVersion: ytcfgValue('INNERTUBE_CLIENT_VERSION') || null, signedIn: signedIn() };
    }
    if (kind === 'browseWatchLater') return getClient().browseWatchLater(payload);
    if (kind === 'browseContinuation') return getClient().browseContinuation(payload);
    if (kind === 'editPlaylist') return getClient().editPlaylist(payload);
    throw new Error(`unknown request kind: ${kind}`);
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.wlBridge !== true) return;

    if (data.type === 'hello' && typeof data.nonce === 'string' && data.nonce) {
      nonce = data.nonce;
      window.__wlReady = true;
      return;
    }
    if (data.type !== 'request') return;
    if (!nonce || data.nonce !== nonce) return;

    try {
      const result = await handleRequest(data.kind, data.payload);
      window.postMessage({
        wlBridge: true, nonce, type: 'response', id: data.id, ok: true, result,
      }, window.location.origin);
    } catch (err) {
      window.postMessage({
        wlBridge: true, nonce, type: 'response', id: data.id, ok: false,
        error: { name: err.name, message: err.message },
      }, window.location.origin);
    }
  });
})();
