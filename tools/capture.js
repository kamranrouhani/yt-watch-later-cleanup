(async () => {
  'use strict';

  const MAX_CONTINUATIONS = 2;

  function getCookie(name) {
    const parts = document.cookie.split(';').map((x) => x.trim());
    const key = `${name}=`;
    for (const part of parts) {
      if (part.startsWith(key)) {
        return decodeURIComponent(part.slice(key.length));
      }
    }
    return '';
  }

  async function sha1Hex(input) {
    const enc = new TextEncoder();
    const data = enc.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function buildAuthHeader(origin) {
    const sapisid = getCookie('SAPISID') || getCookie('__Secure-3PAPISID') || getCookie('__Secure-1PAPISID');
    if (!sapisid) {
      throw new Error('Missing SAPISID/3PAPISID cookie. Are you logged in to YouTube?');
    }

    const now = Math.floor(Date.now() / 1000);
    const input = `${now} ${sapisid} ${origin}`;
    const hash = await sha1Hex(input);
    return `SAPISIDHASH ${now}_${hash}`;
  }

  function getYtcfgValue(key) {
    if (window.ytcfg && typeof window.ytcfg.get === 'function') {
      return window.ytcfg.get(key);
    }
    return undefined;
  }

  function getApiKey() {
    const key = getYtcfgValue('INNERTUBE_API_KEY');
    if (!key || typeof key !== 'string') {
      throw new Error('Failed to get INNERTUBE_API_KEY from page config.');
    }
    return key;
  }

  function getClientContext() {
    const clientVersion = getYtcfgValue('INNERTUBE_CLIENT_VERSION');
    const hl = getYtcfgValue('HL') || 'en';
    const gl = getYtcfgValue('GL') || 'US';
    const visitorData = getYtcfgValue('VISITOR_DATA');

    if (!clientVersion) {
      throw new Error('Failed to get INNERTUBE_CLIENT_VERSION from page config.');
    }

    const ctx = {
      client: {
        clientName: 'WEB',
        clientVersion,
        hl,
        gl,
      },
    };

    if (visitorData) {
      ctx.client.visitorData = visitorData;
    }

    return ctx;
  }

  function getWatchLaterBrowseParamsFromInitialData() {
    const root = window.ytInitialData;
    if (!root || typeof root !== 'object') {
      return null;
    }

    const seenNodes = new Set();
    let found = null;

    function visit(node) {
      if (found || !node || typeof node !== 'object') {
        return;
      }
      if (seenNodes.has(node)) {
        return;
      }
      seenNodes.add(node);

      const endpoint = node?.browseEndpoint;
      if (endpoint?.browseId === 'VLWL' && typeof endpoint?.params === 'string' && endpoint.params) {
        found = endpoint.params;
        return;
      }

      if (Array.isArray(node)) {
        for (const item of node) {
          visit(item);
          if (found) return;
        }
      } else {
        for (const key of Object.keys(node)) {
          visit(node[key]);
          if (found) return;
        }
      }
    }

    visit(root);
    return found;
  }

  function buildWatchLaterBrowseBody(context) {
    const body = {
      context,
      browseId: 'VLWL',
    };
    const browseParams = getWatchLaterBrowseParamsFromInitialData();
    if (browseParams) {
      body.params = browseParams;
    }
    return body;
  }

  async function youtubeiRequest(path, body) {
    const origin = location.origin;
    const apiKey = getApiKey();
    const auth = await buildAuthHeader(origin);

    const res = await fetch(`${origin}/youtubei/v1/${path}?prettyPrint=false&key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-youtube-client-name': '1',
        'x-youtube-client-version': getYtcfgValue('INNERTUBE_CLIENT_VERSION') || '2.20260101.00.00',
        'x-origin': origin,
        authorization: auth,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      const err = new Error(`youtubei ${path} failed (${res.status}): ${txt.slice(0, 400)}`);
      err.status = res.status;
      err.responseText = txt;
      throw err;
    }

    return res.json();
  }

  function walk(node, visit) {
    if (!node || typeof node !== 'object') return;
    visit(node);
    for (const value of Array.isArray(node) ? node : Object.values(node)) walk(value, visit);
  }

  function continuationTokens(json) {
    const tokens = [];
    walk(json, (node) => {
      for (const token of [node.nextContinuationData?.continuation, node.continuationCommand?.token]) {
        if (typeof token === 'string' && token && !tokens.includes(token)) tokens.push(token);
      }
    });
    return tokens;
  }

  function looksLikeShort(renderer) {
    let found = false;
    walk(renderer, (node) => {
      if (typeof node.url === 'string' && node.url.startsWith('/shorts/')) found = true;
      if (node.thumbnailOverlayTimeStatusRenderer?.style === 'SHORTS') found = true;
    });
    return found;
  }

  function summarise(responses, moreAvailable) {
    const summary = {
      pages: responses.length,
      playlistVideoRenderer: 0,
      lockupViewModel: 0,
      resumeOverlays: 0,
      resumePercentages: {},
      unplayable: 0,
      shortsLike: 0,
      moreAvailable,
    };
    for (const { response } of responses) {
      walk(response, (node) => {
        if (node.lockupViewModel) summary.lockupViewModel += 1;
        const overlay = node.thumbnailOverlayResumePlaybackRenderer;
        if (overlay) {
          summary.resumeOverlays += 1;
          const key = String(overlay.percentDurationWatched);
          summary.resumePercentages[key] = (summary.resumePercentages[key] || 0) + 1;
        }
        const renderer = node.playlistVideoRenderer;
        if (!renderer) return;
        summary.playlistVideoRenderer += 1;
        if (renderer.isPlayable === false || renderer.unplayableText) summary.unplayable += 1;
        if (looksLikeShort(renderer)) summary.shortsLike += 1;
      });
    }
    return summary;
  }

  function download(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function timestamp(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-`
      + `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  if (location.origin !== 'https://www.youtube.com') {
    throw new Error('Run this on https://www.youtube.com/playlist?list=WL');
  }

  const context = getClientContext();
  const firstBody = buildWatchLaterBrowseBody(context);
  const responses = [{ continuation: null, response: await youtubeiRequest('browse', firstBody) }];
  const seen = new Set();

  let next = continuationTokens(responses[0].response).find((t) => !seen.has(t));
  while (next && responses.length <= MAX_CONTINUATIONS) {
    seen.add(next);
    const response = await youtubeiRequest('browse', { context, continuation: next });
    responses.push({ continuation: next, response });
    next = continuationTokens(response).find((t) => !seen.has(t));
  }

  const capturedAt = new Date();
  const capture = {
    format: 'wl-capture/1',
    capturedAt: capturedAt.toISOString(),
    pageUrl: location.pathname + location.search,
    client: {
      clientVersion: context.client.clientVersion,
      hl: context.client.hl,
      gl: context.client.gl,
    },
    browseParams: firstBody.params || null,
    summary: summarise(responses, Boolean(next)),
    responses,
  };

  const filename = `wl-capture-${timestamp(capturedAt)}.json`;
  download(filename, JSON.stringify(capture, null, 2));
  console.log(`wl-capture: saved ${filename}`);
  console.table(capture.summary);
  return capture.summary;
})();
