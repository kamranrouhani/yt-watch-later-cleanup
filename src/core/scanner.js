'use strict';

(function (root) {
  const playlistParser = root.WLCore && root.WLCore.playlistParser
    ? root.WLCore.playlistParser
    : require('./playlistParser.js');

  const WL_OLDEST_SORT_ORDER = 2;
  const SORT_VERIFY_MAX_ATTEMPTS = 6;
  const SORT_VERIFY_POLL_MS = 350;

  class SortNotVerifiedError extends Error {
    constructor(message) {
      super(message);
      this.name = this.constructor.name;
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function findSortSubMenu(node, seen = new Set()) {
    if (!node || typeof node !== 'object' || seen.has(node)) return null;
    seen.add(node);
    if (node.sortFilterSubMenuRenderer && typeof node.sortFilterSubMenuRenderer === 'object') {
      return node.sortFilterSubMenuRenderer;
    }
    const values = Array.isArray(node) ? node : Object.values(node);
    for (const value of values) {
      const found = findSortSubMenu(value, seen);
      if (found) return found;
    }
    return null;
  }

  function extractSortState(json) {
    const subMenu = findSortSubMenu(json);
    if (!subMenu) return null;

    const items = (subMenu.subMenuItems || []).map((item) => {
      const action = (item?.serviceEndpoint?.playlistEditEndpoint?.actions || []).find(
        (a) => a?.action === 'ACTION_SET_PLAYLIST_VIDEO_ORDER'
      );
      const parsedOrder = Number(action?.playlistVideoOrder);
      return {
        title: item?.title || '',
        selected: !!item?.selected,
        playlistVideoOrder: Number.isFinite(parsedOrder) ? parsedOrder : null,
      };
    });

    const selectedItem = items.find((item) => item.selected) || null;
    return {
      selectedTitle: selectedItem?.title || '',
      selectedOrder: selectedItem?.playlistVideoOrder ?? null,
    };
  }

  async function verifyOldestFirst(innertube, { maxAttempts, pollMs }) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const editJson = await innertube.editPlaylist([
        { action: 'ACTION_SET_PLAYLIST_VIDEO_ORDER', playlistVideoOrder: WL_OLDEST_SORT_ORDER },
      ]);
      const editSortState = extractSortState(editJson);
      if (editSortState?.selectedOrder === WL_OLDEST_SORT_ORDER) {
        return editSortState;
      }

      const browseJson = await innertube.browseWatchLater();
      const browseSortState = extractSortState(browseJson);
      if (browseSortState?.selectedOrder === WL_OLDEST_SORT_ORDER) {
        return browseSortState;
      }

      if (attempt < maxAttempts) {
        await sleep(pollMs);
      }
    }
    throw new SortNotVerifiedError(
      'Could not verify oldest-first sort. Stop playlist changes from all devices/sessions and retry.'
    );
  }

  async function computeFingerprint(orderedSetVideoIds) {
    const input = orderedSetVideoIds.join('\n');
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function scan(options = {}) {
    const { innertube, onProgress, signal } = options;
    if (!innertube || typeof innertube.browseWatchLater !== 'function') {
      throw new TypeError('scan: options.innertube is required');
    }
    const maxAttempts = Number.isInteger(options.sortVerifyMaxAttempts)
      ? options.sortVerifyMaxAttempts
      : SORT_VERIFY_MAX_ATTEMPTS;
    const pollMs = Number.isInteger(options.sortVerifyPollMs)
      ? options.sortVerifyPollMs
      : SORT_VERIFY_POLL_MS;

    const sortState = await verifyOldestFirst(innertube, { maxAttempts, pollMs });

    const entries = [];
    const seenSetIds = new Set();
    const addEntries = (pageEntries) => {
      for (const entry of pageEntries) {
        if (!entry.setVideoId || seenSetIds.has(entry.setVideoId)) continue;
        seenSetIds.add(entry.setVideoId);
        entries.push(entry);
      }
    };

    let status = 'complete';
    let pageCount = 0;

    const firstJson = await innertube.browseWatchLater();
    const firstPage = playlistParser.parsePage(firstJson);
    addEntries(firstPage.entries);
    pageCount += 1;
    if (onProgress) onProgress({ page: pageCount, pageEntries: firstPage.entries.length, totalEntries: entries.length });

    let nextToken = firstPage.continuationToken;
    while (nextToken) {
      if (signal && signal.aborted) {
        status = 'aborted';
        break;
      }
      const json = await innertube.browseContinuation(nextToken);
      const page = playlistParser.parsePage(json);
      addEntries(page.entries);
      pageCount += 1;
      if (onProgress) onProgress({ page: pageCount, pageEntries: page.entries.length, totalEntries: entries.length });
      nextToken = page.continuationToken;
    }

    const indexedEntries = entries.map((entry, idx) => ({ ...entry, position: idx + 1 }));
    const fingerprint = await computeFingerprint(indexedEntries.map((e) => e.setVideoId));

    return {
      entries: indexedEntries,
      scannedAt: new Date().toISOString(),
      pageCount,
      entryCount: indexedEntries.length,
      fingerprint,
      sortState,
      status,
    };
  }

  const api = { scan, SortNotVerifiedError, extractSortState, computeFingerprint };

  root.WLCore = Object.assign(root.WLCore || {}, { scanner: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
