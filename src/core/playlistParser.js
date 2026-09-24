'use strict';

// Ported from reference/upstream/yt-watch-later-tools.user.js,
// extractEntriesAndContinuation at line 174 (and its private helpers
// pickTitle and safeText), with behaviour identical to the original.
// Restructuring into parsePage and the Entry shape happens in the next
// commit, so this one can be diffed against upstream directly.

(function (root) {
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

  function extractEntriesAndContinuation(json, options = {}) {
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

  const api = { extractEntriesAndContinuation, safeText };

  root.WLCore = Object.assign(root.WLCore || {}, { playlistParser: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
