'use strict';

(function (root) {
  const playlistParser = root.WLCore && root.WLCore.playlistParser
    ? root.WLCore.playlistParser
    : require('./playlistParser.js');

  const WL_OLDEST_SORT_ORDER = 2;
  const SORT_VERIFY_MAX_ATTEMPTS = 6;
  const SORT_VERIFY_POLL_MS = 350;
  const SCAN_PAGE_THROTTLE_MS = 50;

  class SortNotVerifiedError extends Error {
    constructor(message) {
      super(message);
      this.name = this.constructor.name;
    }
  }

  class SortDriftError extends SortNotVerifiedError {
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
    const pageThrottleMs = Number.isInteger(options.scanPageThrottleMs)
      ? options.scanPageThrottleMs
      : SCAN_PAGE_THROTTLE_MS;

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
    // Upstream `fetchAllWatchLaterEntries` (reference/upstream/yt-watch-later-tools.user.js
    // lines 566-574) refuses to trust positions from a page whose own sort state has
    // drifted from what verification just confirmed, even though verification itself
    // passed. A confirmed edit does not guarantee the page this scan actually reads
    // reflects it.
    const firstPageSortState = extractSortState(firstJson);
    if (firstPageSortState?.selectedOrder !== WL_OLDEST_SORT_ORDER) {
      const observedOrder = Number.isFinite(firstPageSortState?.selectedOrder)
        ? firstPageSortState.selectedOrder
        : 'unknown';
      const observedTitle = firstPageSortState?.selectedTitle || 'unknown';
      throw new SortDriftError(
        `Sort drift detected while scanning: expected order=${WL_OLDEST_SORT_ORDER} but got order=${observedOrder} (${observedTitle}).`
      );
    }

    const firstPage = playlistParser.parsePage(firstJson);
    addEntries(firstPage.entries);
    pageCount += 1;
    if (onProgress) onProgress({ page: pageCount, pageEntries: firstPage.entries.length, totalEntries: entries.length });

    // Upstream (lines 588-624) tracks `seenTokens` and skips a continuation token it
    // has already consumed, so a misbehaving response that repeats its own token can
    // never turn into an unbounded request loop against YouTube.
    const seenTokens = new Set();
    let nextToken = firstPage.continuationToken;
    while (nextToken) {
      if (signal && signal.aborted) {
        status = 'aborted';
        break;
      }
      if (seenTokens.has(nextToken)) {
        break;
      }
      seenTokens.add(nextToken);

      const json = await innertube.browseContinuation(nextToken);
      const page = playlistParser.parsePage(json);
      addEntries(page.entries);
      pageCount += 1;
      if (onProgress) onProgress({ page: pageCount, pageEntries: page.entries.length, totalEntries: entries.length });
      nextToken = page.continuationToken;

      // Upstream (lines 621-623) sleeps between continuation fetches when another
      // page remains, to throttle the request rate.
      if (nextToken && !seenTokens.has(nextToken) && pageThrottleMs > 0) {
        await sleep(pageThrottleMs);
      }
    }

    const indexedEntries = entries.map((entry, idx) => ({ ...entry, position: idx + 1 }));
    // An aborted scan is a partial list, not a whole playlist: leaving its fingerprint
    // null means #14's stale-preview check can never mistake it for a complete scan.
    const fingerprint = status === 'complete'
      ? await computeFingerprint(indexedEntries.map((e) => e.setVideoId))
      : null;

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

  const api = {
    scan,
    SortNotVerifiedError,
    SortDriftError,
    extractSortState,
    computeFingerprint,
    SCAN_PAGE_THROTTLE_MS,
  };

  root.WLCore = Object.assign(root.WLCore || {}, { scanner: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
