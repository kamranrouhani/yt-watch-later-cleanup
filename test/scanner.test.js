'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { SortNotVerifiedError } = require('../src/core/scanner.js');

const CAPTURED = path.join(__dirname, 'fixtures', 'captured', '2026-09-24');
const realPages = [1, 2, 3].map((n) =>
  JSON.parse(fs.readFileSync(path.join(CAPTURED, `page-${n}.json`), 'utf8')).response
);

const OLDEST_ORDER = 2;
const NEWEST_ORDER = 1;

function sortMenu(selectedOrder) {
  const items = [
    { title: 'Manual', order: 0 },
    { title: 'Date added (newest)', order: NEWEST_ORDER },
    { title: 'Date added (oldest)', order: OLDEST_ORDER },
  ].map(({ title, order }) => ({
    title,
    selected: order === selectedOrder,
    serviceEndpoint: {
      playlistEditEndpoint: {
        actions: [{ action: 'ACTION_SET_PLAYLIST_VIDEO_ORDER', playlistVideoOrder: order }],
      },
    },
  }));
  return {
    contents: {
      playlistVideoListRenderer: {
        sortFilterMenu: { sortFilterSubMenuRenderer: { title: 'Sort by', subMenuItems: items } },
      },
    },
  };
}

function pageWithEntries(entries, { continuationToken = null, selectedOrder = OLDEST_ORDER } = {}) {
  const contents = entries.map((e) => ({
    playlistVideoRenderer: {
      videoId: e.videoId,
      title: { simpleText: e.title || e.videoId },
      setVideoId: e.setVideoId,
      menu: {
        menuRenderer: {
          items: [{
            menuServiceItemRenderer: {
              serviceEndpoint: { playlistEditEndpoint: { actions: [{ action: 'ACTION_REMOVE_VIDEO', setVideoId: e.setVideoId }] } },
            },
          }],
        },
      },
    },
  }));
  if (continuationToken) {
    contents.push({
      continuationItemRenderer: {
        continuationEndpoint: { continuationCommand: { token: continuationToken } },
      },
    });
  }
  return {
    contents: {
      playlistVideoListRenderer: {
        contents,
        sortFilterMenu: {
          sortFilterSubMenuRenderer: sortMenu(selectedOrder).contents.playlistVideoListRenderer.sortFilterMenu.sortFilterSubMenuRenderer,
        },
      },
    },
  };
}

function emptyTerminalPage(selectedOrder = OLDEST_ORDER) {
  return pageWithEntries([], { selectedOrder });
}

function fakeInnertube({ editResponses = [], browseResponses = [], continuationResponses = {} } = {}) {
  const calls = { edit: 0, browse: 0, continuation: [] };
  const editQueue = [...editResponses];
  const browseQueue = [...browseResponses];
  return {
    calls,
    async editPlaylist() {
      calls.edit += 1;
      return editQueue.shift() ?? sortMenu(OLDEST_ORDER);
    },
    async browseWatchLater() {
      calls.browse += 1;
      return browseQueue.shift() ?? realPages[0];
    },
    async browseContinuation(token) {
      calls.continuation.push(token);
      const next = continuationResponses[token];
      if (next === undefined) throw new Error(`unscripted continuation token ${token}`);
      return next;
    },
  };
}

function allSetVideoIds(pageJson) {
  const found = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.playlistVideoRenderer) found.push(node.playlistVideoRenderer.setVideoId);
    for (const v of Object.values(node)) walk(v);
  })(pageJson);
  return found;
}

// Safety first: written before any implementation code, per LOOP.md step 5.

test('safety: a sort that never verifies raises SortNotVerifiedError and returns no entries', async () => {
  const { scan } = require('../src/core/scanner.js');
  const innertube = fakeInnertube({
    editResponses: Array.from({ length: 6 }, () => sortMenu(NEWEST_ORDER)),
    browseResponses: Array.from({ length: 6 }, () => sortMenu(NEWEST_ORDER)),
  });
  await assert.rejects(
    () => scan({ innertube, sortVerifyPollMs: 0 }),
    SortNotVerifiedError
  );
  assert.strictEqual(innertube.calls.browse, innertube.calls.edit, 'browse fallback tried each attempt');
  assert.strictEqual(innertube.calls.continuation.length, 0, 'no pagination when the sort never verifies');
});

test('safety: verification confirmed via the browse fallback still proceeds to scan', async () => {
  const { scan } = require('../src/core/scanner.js');
  const innertube = fakeInnertube({
    editResponses: [sortMenu(NEWEST_ORDER)],
    browseResponses: [sortMenu(OLDEST_ORDER), emptyTerminalPage()],
  });
  const result = await scan({ innertube, sortVerifyPollMs: 0 });
  assert.strictEqual(result.status, 'complete');
  assert.strictEqual(innertube.calls.edit, 1);
  assert.strictEqual(innertube.calls.browse, 2, 'one fallback browse for verification, one real scan browse');
});

// Acceptance box 1: the fake client serving the real captured pages.

test('against a fake client serving the captured pages, every item comes back once, in order, positions 1..N', async () => {
  const { scan } = require('../src/core/scanner.js');
  const innertube = fakeInnertube({
    editResponses: [sortMenu(OLDEST_ORDER)],
    browseResponses: [realPages[0]],
    continuationResponses: {
      CONTINUATION_1: realPages[1],
      CONTINUATION_2: realPages[2],
      CONTINUATION_3: emptyTerminalPage(),
    },
  });
  const result = await scan({ innertube, sortVerifyPollMs: 0 });
  assert.strictEqual(result.status, 'complete');
  assert.strictEqual(result.pageCount, 4);
  assert.strictEqual(result.entryCount, 300);
  assert.strictEqual(result.entries.length, 300);
  assert.deepStrictEqual(result.entries.map((e) => e.position), Array.from({ length: 300 }, (_, i) => i + 1));

  const expectedOrder = [realPages[0], realPages[1], realPages[2]].flatMap(allSetVideoIds);
  assert.deepStrictEqual(result.entries.map((e) => e.setVideoId), expectedOrder);
  assert.ok(typeof result.scannedAt === 'string' && !Number.isNaN(Date.parse(result.scannedAt)));
  assert.ok(/^[0-9a-f]{64}$/.test(result.fingerprint));
});

// Acceptance box 2: duplicate across pages.

test('a duplicated item across pages appears once, and later positions shift down for it', async () => {
  const { scan } = require('../src/core/scanner.js');
  const page1 = pageWithEntries(
    [{ setVideoId: 'S1', videoId: 'v1' }, { setVideoId: 'S2', videoId: 'v2' }],
    { continuationToken: 'TOK_A' }
  );
  const page2 = pageWithEntries([
    { setVideoId: 'S2', videoId: 'v2' },
    { setVideoId: 'S3', videoId: 'v3' },
  ]);
  const innertube = fakeInnertube({
    editResponses: [sortMenu(OLDEST_ORDER)],
    browseResponses: [page1],
    continuationResponses: { TOK_A: page2 },
  });
  const result = await scan({ innertube, sortVerifyPollMs: 0 });
  assert.strictEqual(result.entryCount, 3);
  assert.deepStrictEqual(result.entries.map((e) => e.setVideoId), ['S1', 'S2', 'S3']);
  assert.deepStrictEqual(result.entries.map((e) => e.position), [1, 2, 3]);
});

// Acceptance box 3: abort mid scan.

test('aborting mid scan stops within one page: no continuation fetch happens after abort', async () => {
  const { scan } = require('../src/core/scanner.js');
  const page1 = pageWithEntries([{ setVideoId: 'S1', videoId: 'v1' }], { continuationToken: 'TOK_A' });
  const page2 = pageWithEntries([{ setVideoId: 'S2', videoId: 'v2' }], { continuationToken: 'TOK_B' });
  const innertube = fakeInnertube({
    editResponses: [sortMenu(OLDEST_ORDER)],
    browseResponses: [page1],
    continuationResponses: { TOK_A: page2 },
  });
  const controller = new AbortController();
  const result = await scan({
    innertube,
    sortVerifyPollMs: 0,
    signal: controller.signal,
    onProgress: () => controller.abort(),
  });
  assert.strictEqual(result.status, 'aborted');
  assert.strictEqual(innertube.calls.continuation.length, 0, 'aborted before the next page was requested');
  assert.strictEqual(result.entryCount, 1);
});

test('onProgress fires once per page with running totals, page 1 included', async () => {
  const { scan } = require('../src/core/scanner.js');
  const page1 = pageWithEntries([{ setVideoId: 'S1' }, { setVideoId: 'S2' }], { continuationToken: 'TOK_A' });
  const page2 = pageWithEntries([{ setVideoId: 'S3' }]);
  const innertube = fakeInnertube({
    editResponses: [sortMenu(OLDEST_ORDER)],
    browseResponses: [page1],
    continuationResponses: { TOK_A: page2 },
  });
  const seen = [];
  await scan({ innertube, sortVerifyPollMs: 0, onProgress: (p) => seen.push(p) });
  assert.deepStrictEqual(seen, [
    { page: 1, pageEntries: 2, totalEntries: 2 },
    { page: 2, pageEntries: 1, totalEntries: 3 },
  ]);
});

// Acceptance box 4: fingerprint sensitivity.

function idPage(ids, continuationToken = null) {
  return pageWithEntries(ids.map((id) => ({ setVideoId: id, videoId: id })), { continuationToken });
}

async function fingerprintFor(ids) {
  const { scan } = require('../src/core/scanner.js');
  const innertube = fakeInnertube({
    editResponses: [sortMenu(OLDEST_ORDER)],
    browseResponses: [idPage(ids)],
  });
  const result = await scan({ innertube, sortVerifyPollMs: 0 });
  return result.fingerprint;
}

test('the fingerprint changes when one item is added', async () => {
  const base = await fingerprintFor(['A', 'B', 'C']);
  const added = await fingerprintFor(['A', 'B', 'C', 'D']);
  assert.notStrictEqual(base, added);
});

test('the fingerprint changes when one item is removed', async () => {
  const base = await fingerprintFor(['A', 'B', 'C']);
  const removed = await fingerprintFor(['A', 'B']);
  assert.notStrictEqual(base, removed);
});

test('the fingerprint changes when one item is moved', async () => {
  const base = await fingerprintFor(['A', 'B', 'C']);
  const moved = await fingerprintFor(['B', 'A', 'C']);
  assert.notStrictEqual(base, moved);
});

test('the fingerprint is stable for the same ordered id list', async () => {
  const first = await fingerprintFor(['A', 'B', 'C']);
  const second = await fingerprintFor(['A', 'B', 'C']);
  assert.strictEqual(first, second);
});

test('sortState on a completed scan reports what was actually verified', async () => {
  const { scan } = require('../src/core/scanner.js');
  const innertube = fakeInnertube({
    editResponses: [sortMenu(OLDEST_ORDER)],
    browseResponses: [emptyTerminalPage()],
  });
  const result = await scan({ innertube, sortVerifyPollMs: 0 });
  assert.strictEqual(result.sortState.selectedOrder, OLDEST_ORDER);
  assert.strictEqual(result.sortState.selectedTitle, 'Date added (oldest)');
});

test('scan requires an innertube dependency', async () => {
  const { scan } = require('../src/core/scanner.js');
  await assert.rejects(() => scan({}), TypeError);
});
