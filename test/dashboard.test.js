'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const CAPTURED = path.join(__dirname, 'fixtures', 'captured', '2026-09-24');
const realPages = [1, 2, 3].map((n) =>
  JSON.parse(fs.readFileSync(path.join(CAPTURED, `page-${n}.json`), 'utf8')).response
);

const OLDEST_ORDER = 2;

function sortMenu(selectedOrder) {
  return {
    contents: {
      playlistVideoListRenderer: {
        sortFilterMenu: { sortFilterSubMenuRenderer: { title: 'Sort by', subMenuItems: [
          { title: 'Manual', selected: false, serviceEndpoint: { playlistEditEndpoint: { actions: [{ action: 'ACTION_SET_PLAYLIST_VIDEO_ORDER', playlistVideoOrder: 0 }] } } },
          { title: 'Date added (newest)', selected: selectedOrder === 1, serviceEndpoint: { playlistEditEndpoint: { actions: [{ action: 'ACTION_SET_PLAYLIST_VIDEO_ORDER', playlistVideoOrder: 1 }] } } },
          { title: 'Date added (oldest)', selected: selectedOrder === 2, serviceEndpoint: { playlistEditEndpoint: { actions: [{ action: 'ACTION_SET_PLAYLIST_VIDEO_ORDER', playlistVideoOrder: 2 }] } } },
        ]} },
      },
    },
  };
}

function withOldestSortSelected(pageJson) {
  const clone = JSON.parse(JSON.stringify(pageJson));
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.sortFilterSubMenuRenderer && Array.isArray(node.sortFilterSubMenuRenderer.subMenuItems)) {
      for (const item of node.sortFilterSubMenuRenderer.subMenuItems) {
        const action = (item?.serviceEndpoint?.playlistEditEndpoint?.actions || []).find(
          (a) => a?.action === 'ACTION_SET_PLAYLIST_VIDEO_ORDER'
        );
        item.selected = Number(action?.playlistVideoOrder) === OLDEST_ORDER;
      }
      return;
    }
    for (const v of Object.values(node)) walk(v);
  })(clone);
  return clone;
}

const EDIT_RESPONSE = sortMenu(OLDEST_ORDER);
const BROWSE_RESPONSE = withOldestSortSelected(realPages[0]);
const CONTINUATION_RESPONSES = {
  CONTINUATION_1: realPages[1],
  CONTINUATION_2: realPages[2],
};

// --- Fake chrome extension messaging, matching what tabBridge.js speaks to. ---

function makeFakeChrome(options = {}) {
  const {
    editResponse = EDIT_RESPONSE,
    browseResponse = BROWSE_RESPONSE,
    continuationResponses = CONTINUATION_RESPONSES,
    continuationDelays = {},
    storageApi = makeMemoryStorage(),
  } = options;

  let nextTabId = 1;
  const messageListeners = [];
  const counts = { browseWatchLater: 0, editPlaylist: 0, browseContinuation: 0, sendMessage: 0 };

  function respond(id, ok, resultOrError) {
    const msg = ok
      ? { wlResponse: true, id, ok: true, result: resultOrError }
      : { wlResponse: true, id, ok: false, error: resultOrError };
    for (const fn of messageListeners) fn(msg);
  }

  return {
    counts,
    chrome: {
      tabs: {
        query: async () => [],
        create: async () => ({ id: nextTabId++ }),
        onRemoved: { addListener: () => {} },
        sendMessage: async (tabId, msg) => {
          counts.sendMessage += 1;
          if (msg.kind === '__wlReadyProbe') {
            queueMicrotask(() => respond(msg.id, true, null));
            return;
          }
          if (msg.kind === 'editPlaylist') {
            counts.editPlaylist += 1;
            queueMicrotask(() => respond(msg.id, true, editResponse));
            return;
          }
          if (msg.kind === 'browseWatchLater') {
            counts.browseWatchLater += 1;
            queueMicrotask(() => respond(msg.id, true, browseResponse));
            return;
          }
          if (msg.kind === 'browseContinuation') {
            counts.browseContinuation += 1;
            const token = msg.payload;
            const page = continuationResponses[token];
            const delay = continuationDelays[token] || 0;
            setTimeout(() => respond(msg.id, true, page), delay);
            return;
          }
          throw new Error('unhandled kind: ' + msg.kind);
        },
      },
      runtime: {
        onMessage: { addListener: (fn) => messageListeners.push(fn) },
      },
      storage: { local: storageApi },
    },
  };
}

function makeErrorChrome(errorName, errorMessage) {
  const messageListeners = [];
  function respond(id, ok, resultOrError) {
    const msg = ok
      ? { wlResponse: true, id, ok: true, result: resultOrError }
      : { wlResponse: true, id, ok: false, error: resultOrError };
    for (const fn of messageListeners) fn(msg);
  }
  return {
    tabs: {
      query: async () => [],
      create: async () => ({ id: 1 }),
      onRemoved: { addListener: () => {} },
      sendMessage: async (tabId, msg) => {
        if (msg.kind === '__wlReadyProbe') {
          queueMicrotask(() => respond(msg.id, true, null));
          return;
        }
        queueMicrotask(() => respond(msg.id, false, { name: errorName, message: errorMessage }));
      },
    },
    runtime: { onMessage: { addListener: (fn) => messageListeners.push(fn) } },
    storage: { local: makeMemoryStorage() },
  };
}

function makeMemoryStorage(data) {
  const store = data ? { [data.key]: data.value } : {};
  return {
    get: function (keys) {
      const result = {};
      for (const k of keys) {
        if (store[k]) result[k] = store[k];
      }
      return Promise.resolve(result);
    },
    set: function (obj) {
      Object.assign(store, obj);
      return Promise.resolve();
    },
  };
}

const DASHBOARD_HTML = fs.readFileSync(path.join(__dirname, '..', 'dashboard', 'dashboard.html'), 'utf8')
  .replace(/<link[^>]*>/g, '')
  .replace(/<script[^>]*><\/script>/g, '');

function createDashboardDOM(chromeApi) {
  const constantsContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'constants.js'), 'utf8');
  const tabBridgeContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'tabBridge.js'), 'utf8');
  const playlistParserContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'playlistParser.js'), 'utf8');
  const storageContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'storage.js'), 'utf8');
  const scannerContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'scanner.js'), 'utf8');
  const dashboardContent = fs.readFileSync(path.join(__dirname, '..', 'dashboard', 'dashboard.js'), 'utf8');

  const dom = new JSDOM(DASHBOARD_HTML, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/dashboard/',
  });
  const win = dom.window;

  win.eval(constantsContent);
  win.eval(tabBridgeContent);
  win.eval(playlistParserContent);
  win.eval(storageContent);
  win.eval(scannerContent);

  win.TextEncoder = TextEncoder;
  win.crypto.subtle = require('node:crypto').webcrypto.subtle;
  win.chrome = chromeApi;

  win.eval(dashboardContent);

  return dom;
}

function waitFor(predicate, timeoutMs = 3000, pollMs = 10) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      if (predicate()) return resolve();
      if (Date.now() > deadline) return reject(new Error('waitFor: timed out'));
      setTimeout(poll, pollMs);
    })();
  });
}

// Acceptance box 1: dashboard scans through the real tab-bridge path and
// renders every entry with correct values.

test('acceptance 1: table shows every entry from captured fixtures with correct values', async () => {
  const { chrome: chromeApi, counts } = makeFakeChrome();
  const dom = createDashboardDOM(chromeApi);
  const win = dom.window;

  const { scan } = require('../src/core/scanner.js');
  const fakeInnertube = {
    async editPlaylist() { return EDIT_RESPONSE; },
    async browseWatchLater() { return BROWSE_RESPONSE; },
    async browseContinuation(token) { return CONTINUATION_RESPONSES[token]; },
  };
  const expected = await scan({ innertube: fakeInnertube, sortVerifyPollMs: 0, scanPageThrottleMs: 0 });

  win.document.getElementById('scan-btn').click();

  await waitFor(() => win.document.getElementById('table-body').querySelectorAll('tr').length === expected.entryCount, 5000);

  assert.strictEqual(counts.browseWatchLater, 1, 'scan went through the tab bridge, not an invented message kind');

  const tbody = win.document.getElementById('table-body');
  const rows = tbody.querySelectorAll('tr');
  assert.strictEqual(rows.length, expected.entryCount, 'all entries rendered in table');

  for (let i = 0; i < expected.entries.length; i++) {
    const entry = expected.entries[i];
    const cells = rows[i].querySelectorAll('td');
    assert.strictEqual(cells[0].textContent, String(entry.position), `row ${i} position`);
    const link = cells[1].querySelector('a.title-link');
    assert.strictEqual(link.textContent, entry.title || '', `row ${i} title`);
    assert.strictEqual(link.getAttribute('href'), 'https://www.youtube.com/watch?v=' + (entry.videoId || ''), `row ${i} link href`);
    assert.strictEqual(!!cells[1].querySelector('.short-badge'), !!entry.isShort, `row ${i} short marker`);
    assert.strictEqual(cells[2].textContent, entry.channelName || '', `row ${i} channel`);
    const expectedDuration = (function formatDuration(seconds) {
      if (seconds == null || !Number.isFinite(seconds)) return '';
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      return m + ':' + String(s).padStart(2, '0');
    })(entry.durationSeconds);
    assert.strictEqual(cells[3].textContent, expectedDuration, `row ${i} duration`);
    assert.ok(cells[4].textContent.startsWith(String(entry.watchedPercent) + '%'), `row ${i} watched percent`);
    if (entry.playable) {
      assert.strictEqual(cells[6].textContent, 'Playable', `row ${i} availability`);
    } else {
      assert.strictEqual(cells[6].textContent, entry.unavailableReason || 'Unavailable', `row ${i} availability reason`);
    }
  }

  const filterInput = win.document.getElementById('filter-input');
  const targetTitle = expected.entries[0].title;
  filterInput.value = targetTitle;
  filterInput.dispatchEvent(new win.Event('input', { bubbles: true }));

  const expectedFilteredCount = expected.entries.filter((e) =>
    (e.title || '').toLowerCase().includes(targetTitle.toLowerCase())
  ).length;
  await waitFor(() => tbody.querySelectorAll('tr').length === expectedFilteredCount, 2000);
  const filteredRows = tbody.querySelectorAll('tr');
  assert.ok(filteredRows.length >= 1, 'filter still shows matching rows');

  dom.window.close();
});

// Acceptance box 2: reopening the dashboard shows the saved scan without a rescan.

test('acceptance 2: reopened dashboard shows saved scan without rescanning', async () => {
  const scanResult = {
    entries: [
      { position: 1, setVideoId: 'S1', videoId: 'v1', title: 'Test Video', channelName: 'Test Channel', channelId: 'UC123', durationSeconds: 120, watchedPercent: 50, playable: true, unavailableReason: null, publishedText: '2 days ago', isShort: false, isLive: false },
      { position: 2, setVideoId: 'S2', videoId: 'v2', title: 'Another Video', channelName: 'Other Channel', channelId: 'UC456', durationSeconds: 300, watchedPercent: 100, playable: true, unavailableReason: null, publishedText: '1 week ago', isShort: false, isLive: false },
    ],
    scannedAt: new Date().toISOString(),
    pageCount: 1,
    entryCount: 2,
    fingerprint: 'abc123def456',
    sortState: { selectedTitle: 'Date added (oldest)', selectedOrder: 2 },
    status: 'complete',
  };

  const storageApi = makeMemoryStorage({ key: 'scan:v1', value: { v: 1, data: scanResult } });
  const { chrome: chromeApi, counts } = makeFakeChrome({ storageApi });
  const dom = createDashboardDOM(chromeApi);

  const win = dom.window;
  const savedSection = win.document.getElementById('saved-scan');
  const tbody = win.document.getElementById('table-body');
  await waitFor(() => savedSection.hidden === false && tbody.querySelectorAll('tr').length === 2, 2000);

  assert.strictEqual(counts.browseWatchLater, 0, 'no scan request fired on reopen');
  assert.strictEqual(counts.sendMessage, 0, 'no tab bridge message sent at all on reopen');

  const savedInfo = win.document.getElementById('saved-info');
  assert.ok(savedInfo.textContent.startsWith('Last scan:'), 'saved-info shows the scan age');
  assert.ok(savedInfo.textContent.includes('2'), 'saved-info mentions the entry count');

  assert.strictEqual(tbody.querySelectorAll('tr').length, 2, 'two rows rendered from saved scan');

  dom.window.close();
});

// Acceptance box 3: cancel mid scan leaves the previous saved scan intact,
// even once the aborted request's response arrives late.

test('acceptance 3: cancel mid scan leaves previous saved scan intact', async () => {
  const savedScan = {
    entries: [{ position: 1, setVideoId: 'S1', videoId: 'v1', title: 'Saved Video', channelName: 'Saved Channel', channelId: 'UC1', durationSeconds: 60, watchedPercent: 0, playable: true, unavailableReason: null, publishedText: '1 hour ago', isShort: false, isLive: false }],
    scannedAt: new Date(Date.now() - 3600000).toISOString(),
    pageCount: 1,
    entryCount: 1,
    fingerprint: 'saved123',
    sortState: { selectedTitle: 'Date added (oldest)', selectedOrder: 2 },
    status: 'complete',
  };

  const storageApi = makeMemoryStorage({ key: 'scan:v1', value: { v: 1, data: savedScan } });
  const { chrome: chromeApi } = makeFakeChrome({
    storageApi,
    continuationDelays: { CONTINUATION_1: 200 },
  });
  const dom = createDashboardDOM(chromeApi);

  const win = dom.window;
  await waitFor(() => win.document.getElementById('saved-scan').hidden === false, 2000);

  win.document.getElementById('scan-btn').click();
  await waitFor(() => win.document.getElementById('progress').hidden === false, 2000);
  assert.strictEqual(win.document.getElementById('saved-scan').hidden, true, 'saved scan hidden during new scan');

  win.document.getElementById('cancel-btn').click();
  await waitFor(() => win.document.getElementById('progress').hidden === true, 2000);
  const tbodyAfterCancel = win.document.getElementById('table-body');
  await waitFor(() => win.document.getElementById('saved-scan').hidden === false
    && tbodyAfterCancel.querySelectorAll('tr').length === 1, 2000);
  assert.strictEqual(win.document.getElementById('saved-scan').hidden, false, 'saved scan restored right after cancel');

  assert.strictEqual(tbodyAfterCancel.querySelectorAll('tr').length, 1, 'restored table shows the old saved scan');
  assert.strictEqual(tbodyAfterCancel.querySelector('tr td:nth-child(2) a').textContent, 'Saved Video');

  // Let the delayed, now-aborted browseContinuation response land.
  await new Promise((resolve) => setTimeout(resolve, 350));

  const stored = await storageApi.get(['scan:v1']);
  assert.strictEqual(stored['scan:v1'].data.entries[0].title, 'Saved Video', 'storage still holds the old saved scan');
  assert.strictEqual(stored['scan:v1'].data.entryCount, 1, 'storage was not overwritten by the late aborted response');

  const tbodyAfterLateResponse = win.document.getElementById('table-body');
  assert.strictEqual(tbodyAfterLateResponse.querySelectorAll('tr').length, 1, 'rendered rows are still the old ones');
  assert.strictEqual(tbodyAfterLateResponse.querySelector('tr td:nth-child(2) a').textContent, 'Saved Video');

  dom.window.close();
});

// Acceptance box 4: 5,000 deterministic synthetic rows render, sort and
// filter, and each interaction stays under 200 ms of main-thread work.

test('acceptance 4: 5000 rows render and sort correctly without freezing the page', async () => {
  const entries = [];
  for (let i = 1; i <= 5000; i++) {
    entries.push({
      position: i,
      setVideoId: 'S' + i,
      videoId: 'v' + i,
      title: 'Video number ' + String(i).padStart(4, '0') + ' with a reasonably long title for testing',
      channelName: 'Channel ' + String(i % 50).padStart(2, '0'),
      channelId: 'UC' + String(i).padStart(3, '0'),
      durationSeconds: (i * 37) % 3600,
      watchedPercent: (i * 7) % 101,
      playable: i % 10 !== 0,
      unavailableReason: i % 10 === 0 ? 'Private video' : null,
      publishedText: i % 7 === 0 ? '2 years ago' : (i % 3 === 0 ? '3 months ago' : '1 day ago'),
      isShort: i % 20 === 0,
      isLive: false,
    });
  }

  const scanResult = {
    entries: entries,
    scannedAt: new Date().toISOString(),
    pageCount: 100,
    entryCount: 5000,
    fingerprint: 'synthetic5000',
    sortState: { selectedTitle: 'Date added (oldest)', selectedOrder: 2 },
    status: 'complete',
  };

  const storageApi = makeMemoryStorage({ key: 'scan:v1', value: { v: 1, data: scanResult } });
  const { chrome: chromeApi } = makeFakeChrome({ storageApi });
  const dom = createDashboardDOM(chromeApi);
  const win = dom.window;

  await waitFor(() => win.document.getElementById('table-body').querySelectorAll('tr').length === 5000, 5000);

  const tbody = win.document.getElementById('table-body');
  const headers = win.document.querySelectorAll('th.sortable');

  const firstTitleBefore = win.document.querySelector('#table-body tr td:nth-child(2)');
  assert.ok(firstTitleBefore.textContent.startsWith('Video number 0001'), 'first row is position-ordered');

  async function timedInteraction(action) {
    const durations = [];
    let last = win.performance.now();
    const originalAppend = tbody.appendChild.bind(tbody);
    tbody.appendChild = function (node) {
      const now = win.performance.now();
      durations.push(now - last);
      last = now;
      return originalAppend(node);
    };
    action();
    await waitFor(() => tbody.querySelectorAll('tr').length === 5000, 3000);
    tbody.appendChild = originalAppend;
    return durations;
  }

  const titleSortDurations = await timedInteraction(() => headers[1].click());
  assert.strictEqual(tbody.querySelectorAll('tr').length, 5000, 'title sort preserves all rows');
  for (const d of titleSortDurations) {
    assert.ok(d < 200, `title sort chunk took ${d.toFixed(1)} ms, over the 200 ms budget`);
  }

  assert.strictEqual(headers[1].textContent, 'Title \u25B2', 'ascending arrow shown after first click');

  const channelSortDurations = await timedInteraction(() => headers[2].click());
  assert.strictEqual(tbody.querySelectorAll('tr').length, 5000, 'channel sort preserves all rows');
  for (const d of channelSortDurations) {
    assert.ok(d < 200, `channel sort chunk took ${d.toFixed(1)} ms, over the 200 ms budget`);
  }
  assert.strictEqual(headers[1].textContent, 'Title', 'previous header arrow cleared on new sort');
  assert.strictEqual(headers[2].textContent, 'Channel \u25B2', 'new header shows exactly one arrow');

  const filterInput = win.document.getElementById('filter-input');
  const rowsBeforeFilter = tbody.querySelectorAll('tr').length;
  const filterDurations = await timedInteractionFilter();
  async function timedInteractionFilter() {
    const durations = [];
    let last = win.performance.now();
    const originalAppend = tbody.appendChild.bind(tbody);
    tbody.appendChild = function (node) {
      const now = win.performance.now();
      durations.push(now - last);
      last = now;
      return originalAppend(node);
    };
    filterInput.value = 'Video number 0100 ';
    filterInput.dispatchEvent(new win.Event('input', { bubbles: true }));
    await waitFor(() => tbody.querySelectorAll('tr').length < rowsBeforeFilter, 2000);
    tbody.appendChild = originalAppend;
    return durations;
  }
  for (const d of filterDurations) {
    assert.ok(d < 200, `filter chunk took ${d.toFixed(1)} ms, over the 200 ms budget`);
  }
  const rowsAfterFilter = tbody.querySelectorAll('tr').length;
  assert.ok(rowsAfterFilter < rowsBeforeFilter, 'filter reduces row count');
  assert.ok(rowsAfterFilter >= 1, 'filter still shows matching rows');

  const rowCountEl = win.document.getElementById('row-count');
  assert.ok(rowCountEl.textContent.includes('of'), 'row count shows filtered/total');

  dom.window.close();
});

// Additional: sort header click toggles direction on the same column.

test('sort header shows the correct direction and never accumulates arrows', async () => {
  const entries = [
    { position: 1, setVideoId: 'S1', videoId: 'v1', title: 'B video', channelName: 'C', channelId: 'UC1', durationSeconds: 60, watchedPercent: 10, playable: true, unavailableReason: null, publishedText: 'x', isShort: false, isLive: false },
    { position: 2, setVideoId: 'S2', videoId: 'v2', title: 'A video', channelName: 'C', channelId: 'UC1', durationSeconds: 60, watchedPercent: 10, playable: true, unavailableReason: null, publishedText: 'x', isShort: false, isLive: false },
  ];
  const scanResult = {
    entries, scannedAt: new Date().toISOString(), pageCount: 1, entryCount: 2,
    fingerprint: 'f', sortState: { selectedTitle: 'x', selectedOrder: 2 }, status: 'complete',
  };
  const storageApi = makeMemoryStorage({ key: 'scan:v1', value: { v: 1, data: scanResult } });
  const { chrome: chromeApi } = makeFakeChrome({ storageApi });
  const dom = createDashboardDOM(chromeApi);
  const win = dom.window;

  await waitFor(() => win.document.getElementById('table-body').querySelectorAll('tr').length === 2, 2000);

  const titleHeader = win.document.querySelectorAll('th.sortable')[1];
  const tbody = win.document.getElementById('table-body');
  titleHeader.click();
  await waitFor(() => {
    const cell = tbody.querySelector('tr td:nth-child(2) a');
    return cell && cell.textContent === 'A video';
  }, 2000);
  assert.strictEqual(titleHeader.textContent, 'Title \u25B2');
  assert.strictEqual(titleHeader.getAttribute('data-active-sort'), 'asc');
  let firstCell = win.document.querySelector('#table-body tr td:nth-child(2) a');
  assert.strictEqual(firstCell.textContent, 'A video', 'ascending sort shows A before B');

  titleHeader.click();
  await waitFor(() => {
    const cell = tbody.querySelector('tr td:nth-child(2) a');
    return cell && cell.textContent === 'B video';
  }, 2000);
  assert.strictEqual(titleHeader.textContent, 'Title \u25BC');
  assert.strictEqual(titleHeader.getAttribute('data-active-sort'), 'desc');
  firstCell = win.document.querySelector('#table-body tr td:nth-child(2) a');
  assert.strictEqual(firstCell.textContent, 'B video', 'descending sort shows B before A');

  titleHeader.click();
  await waitFor(() => {
    const cell = tbody.querySelector('tr td:nth-child(2) a');
    return cell && cell.textContent === 'A video';
  }, 2000);
  assert.strictEqual(titleHeader.textContent, 'Title \u25B2', 'a third click does not accumulate arrows');

  dom.window.close();
});

// Additional: scan errors are shown by type, using the real error object.

test('scan errors show type-specific messages for every named error', async () => {
  const cases = [
    { name: 'SortNotVerifiedError', message: 'unrelated detail', expected: 'Could not verify playlist sort. Stop playlist changes on all devices and retry.' },
    { name: 'SortDriftError', message: 'unrelated detail', expected: 'Playlist sort changed during scan. Refresh and try again.' },
    { name: 'TabGoneError', message: 'unrelated detail', expected: 'The YouTube tab closed mid-scan. Open the Watch Later page and try again.' },
    { name: 'TimeoutError', message: 'unrelated detail', expected: 'The request timed out. Check your connection and retry.' },
    { name: 'AuthError', message: 'unrelated detail', expected: 'Not signed in to YouTube. Sign in and try again.' },
    { name: 'RateLimitedError', message: 'unrelated detail', expected: 'YouTube rate limited the request. Wait and try again.' },
  ];

  for (const { name, message, expected } of cases) {
    const chromeApi = makeErrorChrome(name, message);
    const dom = createDashboardDOM(chromeApi);
    const win = dom.window;

    win.document.getElementById('scan-btn').click();
    await waitFor(() => win.document.getElementById('error-banner').hidden === false, 2000);

    assert.strictEqual(win.document.getElementById('error-text').textContent, expected, `wrong message for ${name}`);
    dom.window.close();
  }
});
