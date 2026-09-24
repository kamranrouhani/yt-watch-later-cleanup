'use strict';

(function (root) {
  // The verbatim port of upstream's extractEntriesAndContinuation is kept
  // under its own name so parsePage can be diffed against it; the progress
  // log records why both exist. Behaviour: upstream line 174, identical.
  const port = buildPort();

  function extractEntriesAndContinuationPort(json, options = {}) {
    const includeRawRenderer = !!options.includeRawRenderer;
    const entries = [];
    const seenSetIds = new Set();
    const continuationTokens = [];
    const seenContinuationTokens = new Set();
    const seenNodes = new Set();

    function pushToken(token) {
      if (typeof token !== 'string' || !token) {
        return;
      }
      if (seenContinuationTokens.has(token)) {
        return;
      }
      seenContinuationTokens.add(token);
      continuationTokens.push(token);
    }

    function tokenFromContinuationItem(item) {
      return (
        item?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ||
        item?.continuationItemRenderer?.button?.buttonRenderer?.command?.continuationCommand?.token ||
        null
      );
    }

    function pushEntryFromRenderer(r) {
      const videoId = typeof r.videoId === 'string' ? r.videoId : '';
      const title = pickTitle(r.title);
      const menuItems = r?.menu?.menuRenderer?.items || [];

      for (const item of menuItems) {
        const endpoint = item?.menuServiceItemRenderer?.serviceEndpoint;
        const actions = endpoint?.playlistEditEndpoint?.actions;
        if (!Array.isArray(actions)) continue;
        for (const action of actions) {
          if (action?.action === 'ACTION_REMOVE_VIDEO' && typeof action.setVideoId === 'string') {
            if (!seenSetIds.has(action.setVideoId)) {
              seenSetIds.add(action.setVideoId);
              entries.push({
                setVideoId: action.setVideoId,
                videoId,
                title,
                channelName: safeText((r.shortBylineText?.runs || []).map((run) => run?.text || '').join('')),
                channelId:
                  (r.shortBylineText?.runs || []).find((run) => run?.navigationEndpoint?.browseEndpoint?.browseId)?.navigationEndpoint
                    ?.browseEndpoint?.browseId || '',
                publishedTimeText: pickTitle(r.publishedTimeText),
                lengthText:
                  pickTitle(r.lengthText) ||
                  pickTitle(
                    (r.thumbnailOverlays || []).find((ov) => ov?.thumbnailOverlayTimeStatusRenderer)?.thumbnailOverlayTimeStatusRenderer?.text
                  ),
                isPlayable: r.isPlayable !== false && !r.unplayableText,
                unavailableReason: pickTitle(r.unplayableText),
                thumbnails: (r.thumbnail?.thumbnails || []).map((t) => ({
                  url: t?.url || '',
                  width: t?.width || null,
                  height: t?.height || null,
                })),
                badges: (r.badges || [])
                  .map((b) => safeText(b?.metadataBadgeRenderer?.label || pickTitle(b?.metadataBadgeRenderer?.label) || ''))
                  .filter(Boolean),
                ...(includeRawRenderer ? { rawRenderer: r } : {}),
              });
            }
            return;
          }
        }
      }
    }

    function consumeItemArray(items) {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        if (item?.playlistVideoRenderer) {
          pushEntryFromRenderer(item.playlistVideoRenderer);
          continue;
        }
        const token = tokenFromContinuationItem(item);
        if (token) {
          pushToken(token);
        }
      }
    }

    function visit(node) {
      if (!node || typeof node !== 'object') {
        return;
      }
      if (seenNodes.has(node)) {
        return;
      }
      seenNodes.add(node);

      if (node.playlistVideoListRenderer && typeof node.playlistVideoListRenderer === 'object') {
        consumeItemArray(node.playlistVideoListRenderer.contents);
        const token = node.playlistVideoListRenderer?.continuations?.[0]?.nextContinuationData?.continuation;
        pushToken(token);
      }

      if (node.appendContinuationItemsAction && typeof node.appendContinuationItemsAction === 'object') {
        consumeItemArray(node.appendContinuationItemsAction.continuationItems);
      }

      if (node.reloadContinuationItemsCommand && typeof node.reloadContinuationItemsCommand === 'object') {
        consumeItemArray(node.reloadContinuationItemsCommand.continuationItems);
      }

      // Fallback: collect continuation tokens wherever they appear in the payload.
      pushToken(node?.nextContinuationData?.continuation);
      pushToken(node?.continuationCommand?.token);

      if (Array.isArray(node)) {
        for (const item of node) {
          visit(item);
        }
      } else {
        for (const key of Object.keys(node)) {
          visit(node[key]);
        }
      }
    }

    visit(json);
    return { entries, continuationTokens };
  }

  function buildPort() {
    return {
      extractEntriesAndContinuation: extractEntriesAndContinuationPort,
      safeText,
    };
  }

  function safeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function pickTitle(titleObj) {
    if (!titleObj || typeof titleObj !== 'object') {
      return '';
    }
    if (typeof titleObj.simpleText === 'string') {
      return safeText(titleObj.simpleText);
    }
    if (Array.isArray(titleObj.runs)) {
      return safeText(titleObj.runs.map((r) => r?.text || '').join(''));
    }
    return '';
  }

  function parseDurationSeconds(text) {
    const value = safeText(text);
    if (!value) return null;
    const parts = value.split(':');
    if (!parts.every((p) => /^\d{1,2}$/.test(p))) return null;
    if (parts.length < 1 || parts.length > 3) return null;
    const numbers = parts.map(Number);
    if (numbers.some((n) => !Number.isFinite(n))) return null;
    let seconds = numbers.pop() || 0;
    const minutes = numbers.pop() || 0;
    const hours = numbers.pop() || 0;
    if (seconds > 59 || minutes > 59) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }

  function extractSetVideoId(renderer) {
    const menuItems = renderer?.menu?.menuRenderer?.items || [];
    for (const item of menuItems) {
      const actions = item?.menuServiceItemRenderer?.serviceEndpoint?.playlistEditEndpoint?.actions;
      if (!Array.isArray(actions)) continue;
      for (const action of actions) {
        if (action?.action === 'ACTION_REMOVE_VIDEO' && typeof action.setVideoId === 'string') {
          return action.setVideoId;
        }
      }
    }
    return typeof renderer?.setVideoId === 'string' ? renderer.setVideoId : null;
  }

  function resumePercent(renderer) {
    for (const overlay of renderer?.thumbnailOverlays || []) {
      const resume = overlay?.thumbnailOverlayResumePlaybackRenderer;
      const pct = Number(resume?.percentDurationWatched);
      if (Number.isFinite(pct)) return Math.min(100, Math.max(0, pct));
    }
    return 0;
  }

  function timeStatus(renderer) {
    for (const overlay of renderer?.thumbnailOverlays || []) {
      const status = overlay?.thumbnailOverlayTimeStatusRenderer;
      if (status) return status;
    }
    return null;
  }

  function parseEntry(renderer) {
    const shortByline = shortBylineText(renderer);
    const status = timeStatus(renderer);
    const statusText = pickTitle(status?.text);
    const isLive = String(statusText).toUpperCase() === 'LIVE'
      || String(status?.style || '').toUpperCase() === 'LIVE';
    const isShort = String(status?.style || '').toUpperCase() === 'SHORTS'
      || String(statusText).toUpperCase() === 'SHORTS';

    return {
      setVideoId: extractSetVideoId(renderer),
      videoId: typeof renderer.videoId === 'string' ? renderer.videoId : null,
      title: pickTitle(renderer.title) || null,
      channelName: shortByline.name || null,
      channelId: shortByline.id || null,
      durationSeconds: parseDurationSeconds(
        pickTitle(renderer.lengthText) || (status && statusText)
      ),
      watchedPercent: resumePercent(renderer),
      playable: renderer.isPlayable !== false && !renderer.unplayableText,
      unavailableReason: pickTitle(renderer.unplayableText) || null,
      publishedText: pickTitle(renderer.publishedTimeText) || null,
      isShort,
      isLive,
    };
  }

  function shortBylineText(renderer) {
    const runs = renderer?.shortBylineText?.runs || [];
    let name = '';
    let id = null;
    for (const run of runs) {
      name += run?.text || '';
      const browseId = run?.navigationEndpoint?.browseEndpoint?.browseId;
      if (id === null && typeof browseId === 'string' && browseId) id = browseId;
    }
    return { name: safeText(name), id };
  }

  function parsePage(json) {
    const walk = createWalk();
    const droppedItems = { count: 0 };

    function consumeItemArray(items) {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        if (item?.playlistVideoRenderer) {
          const renderer = item.playlistVideoRenderer;
          const setVideoId = extractSetVideoId(renderer);
          if (setVideoId === null) {
            droppedItems.count += 1;
            continue;
          }
          walk.pushEntry(renderer, setVideoId);
          continue;
        }
        const token = walk.tokenFromContinuationItem(item);
        if (token) walk.pushToken(token);
      }
    }

    walk.consumeItemArray = consumeItemArray;
    walk.droppedItems = droppedItems;
    visit(json, walk);

    return {
      entries: walk.entries,
      continuationToken: walk.continuationTokens[0] || null,
      droppedItems: droppedItems.count,
    };
  }

  function createWalk() {
    const entries = [];
    const seenSetIds = new Set();
    const continuationTokens = [];
    const seenContinuationTokens = new Set();
    const seenNodes = new Set();
    const state = { entries, seenSetIds, continuationTokens, seenContinuationTokens, seenNodes };

    state.pushEntry = (renderer, setVideoId) => {
      if (!seenSetIds.has(setVideoId)) {
        seenSetIds.add(setVideoId);
        entries.push(parseEntry(renderer));
      }
    };

    state.pushToken = (token) => {
      if (typeof token !== 'string' || !token) return;
      if (seenContinuationTokens.has(token)) return;
      seenContinuationTokens.add(token);
      continuationTokens.push(token);
    };

    state.tokenFromContinuationItem = (item) =>
      item?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ||
      item?.continuationItemRenderer?.button?.buttonRenderer?.command?.continuationCommand?.token ||
      null;

    return state;
  }

  function visit(node, walk) {
    if (!node || typeof node !== 'object') return;
    if (walk.seenNodes.has(node)) return;
    walk.seenNodes.add(node);

    if (node.playlistVideoListRenderer && typeof node.playlistVideoListRenderer === 'object') {
      walk.consumeItemArray(node.playlistVideoListRenderer.contents);
      walk.pushToken(node.playlistVideoListRenderer?.continuations?.[0]?.nextContinuationData?.continuation);
    }
    if (node.appendContinuationItemsAction && typeof node.appendContinuationItemsAction === 'object') {
      walk.consumeItemArray(node.appendContinuationItemsAction.continuationItems);
    }
    if (node.reloadContinuationItemsCommand && typeof node.reloadContinuationItemsCommand === 'object') {
      walk.consumeItemArray(node.reloadContinuationItemsCommand.continuationItems);
    }

    walk.pushToken(node?.nextContinuationData?.continuation);
    walk.pushToken(node?.continuationCommand?.token);

    if (Array.isArray(node)) {
      for (const item of node) visit(item, walk);
    } else {
      for (const key of Object.keys(node)) visit(node[key], walk);
    }
  }

  function extractEntriesAndContinuation(json, options = {}) {
    return port.extractEntriesAndContinuation(json, options);
  }

  const api = { parsePage, parseDurationSeconds, extractEntriesAndContinuation };

  root.WLCore = Object.assign(root.WLCore || {}, { playlistParser: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
