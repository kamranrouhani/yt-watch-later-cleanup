'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.WL_CHROME
  || '/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';

const CAPTURED = path.join(ROOT, 'test', 'fixtures', 'captured', '2026-09-24');
const page1 = JSON.parse(fs.readFileSync(path.join(CAPTURED, 'page-1.json'), 'utf8'));

const OLDEST_ORDER = 2;

function sortMenu(selectedOrder) {
  return {
    contents: {
      playlistVideoListRenderer: {
        sortFilterMenu: { sortFilterSubMenuRenderer: { title: 'Sort by', subMenuItems: [
          { title: 'Manual', selected: false, serviceEndpoint: { playlistEditEndpoint: { actions: [{ action: 'ACTION_SET_PLAYLIST_VIDEO_ORDER', playlistVideoOrder: 0 }] } } },
          { title: 'Date added (oldest)', selected: selectedOrder === OLDEST_ORDER, serviceEndpoint: { playlistEditEndpoint: { actions: [{ action: 'ACTION_SET_PLAYLIST_VIDEO_ORDER', playlistVideoOrder: OLDEST_ORDER }] } } },
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
const BROWSE_RESPONSE = withOldestSortSelected(page1.response);

const FAKE_PAGE = `<!doctype html><html><head><title>Watch later - YouTube</title></head><body>
<script>
  window.ytcfg = { data_: {
    INNERTUBE_API_KEY: 'AIzaFakeBrowserKey',
    INNERTUBE_CLIENT_VERSION: '2.20260923.08.00',
    HL: 'en', GL: 'DE', VISITOR_DATA: 'FakeVisitor',
  }, get(k) { return this.data_[k]; } };
</script></body></html>`;

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-dashboard-scan-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    args: ['--no-sandbox', `--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`],
  });

  try {
    await context.addCookies([
      { name: 'SAPISID', value: 'FakeSapisidForScan', domain: '.youtube.com', path: '/', secure: true },
      { name: 'CONSENT', value: 'YES+1', domain: '.youtube.com', path: '/', secure: true },
    ]);

    let editCalls = 0;
    let browseCalls = 0;
    await context.route('https://www.youtube.com/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/playlist') {
        return route.fulfill({ status: 200, contentType: 'text/html', body: FAKE_PAGE });
      }
      if (url.pathname === '/youtubei/v1/browse/edit_playlist') {
        editCalls += 1;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EDIT_RESPONSE) });
      }
      if (url.pathname === '/youtubei/v1/browse') {
        browseCalls += 1;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BROWSE_RESPONSE) });
      }
      return route.fulfill({ status: 404, body: '' });
    });

    const worker = context.serviceWorkers()[0]
      || await context.waitForEvent('serviceworker', { timeout: 10000 });
    const extensionId = new URL(worker.url()).host;

    const errors = [];
    const consoleErrors = [];
    const dashboard = await context.newPage();
    dashboard.on('pageerror', (err) => errors.push(err.message));
    dashboard.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    await dashboard.goto(`chrome-extension://${extensionId}/dashboard/dashboard.html`);

    await dashboard.click('#scan-btn');

    const newPagePromise = context.waitForEvent('page', { timeout: 10000 });
    const newPage = await newPagePromise;
    await newPage.goto('https://www.youtube.com/playlist?list=WL');

    await dashboard.waitForFunction(
      () => document.getElementById('table-body').querySelectorAll('tr').length > 0,
      null,
      { timeout: 10000 }
    );

    const rowCount = await dashboard.evaluate(() => document.getElementById('table-body').querySelectorAll('tr').length);

    assert.ok(rowCount > 0, 'no rows rendered after a real scan click');
    assert.ok(browseCalls >= 1, 'browseWatchLater was never called through the tab bridge');
    assert.ok(editCalls >= 1, 'editPlaylist (sort verification) was never called');

    const firstRowTitle = await dashboard.evaluate(() =>
      document.querySelector('#table-body tr td:nth-child(2) a').textContent
    );
    assert.strictEqual(firstRowTitle, 'Video title 1', 'first rendered row does not match the fixture');

    const errorBannerHidden = await dashboard.evaluate(() => document.getElementById('error-banner').hidden);
    assert.strictEqual(errorBannerHidden, true, 'error banner shown after a scan that should have succeeded');

    assert.deepStrictEqual(errors, [], 'uncaught page errors during scan');
    console.log(`ok clicking Scan in real Chrome opened a Watch Later tab and rendered ${rowCount} rows`);
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
