'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.WL_CHROME
  || '/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';

const FAKE_PAGE = `<!doctype html><html><head><title>Watch later - YouTube</title></head><body>
<script>
  window.ytcfg = { data_: {
    INNERTUBE_API_KEY: 'AIzaFakeBrowserKey',
    INNERTUBE_CLIENT_VERSION: '2.20260923.08.00',
    HL: 'en', GL: 'DE', VISITOR_DATA: 'FakeVisitor',
  }, get(k) { return this.data_[k]; } };
</script></body></html>`;

const BROWSE_RESPONSE = { contents: { playlist: ['fake'] }, responseContext: {} };

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-bridge-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    args: ['--no-sandbox', `--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`],
  });

  try {
    await context.addCookies([
      { name: 'SAPISID', value: 'FakeSapisidForBridge', domain: '.youtube.com', path: '/', secure: true },
    ]);
    await context.route('https://www.youtube.com/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/playlist') {
        return route.fulfill({ status: 200, contentType: 'text/html', body: FAKE_PAGE });
      }
      if (url.pathname === '/youtubei/v1/browse') {
        const auth = request.headers().authorization || '';
        if (!/^SAPISIDHASH \d+_[0-9a-f]{40}$/.test(auth)) {
          return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"no auth"}' });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BROWSE_RESPONSE) });
      }
      return route.fulfill({ status: 404, body: '' });
    });

    const worker = context.serviceWorkers()[0]
      || await context.waitForEvent('serviceworker', { timeout: 10000 });
    const extensionId = new URL(worker.url()).host;

    const ytPage = await context.newPage();
    await ytPage.goto('https://www.youtube.com/playlist?list=WL');
    await ytPage.waitForFunction(() => window.__wlPage === true, null, { timeout: 10000 });
    await ytPage.waitForFunction(() => window.__wlReady === true, null, { timeout: 10000 });
    console.log('ok both worlds installed, the bridge said hello and the page took the nonce');

    const dashboard = await context.newPage();
    const errors = [];
    dashboard.on('pageerror', (err) => errors.push(err.message));
    await dashboard.goto(`chrome-extension://${extensionId}/dashboard/dashboard.html`);

    const ping = await dashboard.evaluate(async () => {
      const bridge = WLCore.tabBridge.createTabBridge({ ...chrome, tabs: chrome.tabs });
      await bridge.ensureTab();
      return bridge.request('ping', null);
    });
    assert.strictEqual(ping.clientVersion, '2.20260923.08.00');
    assert.strictEqual(ping.signedIn, true);
    console.log('ok ping crossed both worlds and returned the ytcfg client version');

    const browse = await dashboard.evaluate(async () => {
      const bridge = WLCore.tabBridge.createTabBridge({ ...chrome, tabs: chrome.tabs });
      await bridge.ensureTab();
      return bridge.request('browseWatchLater', null);
    });
    assert.deepStrictEqual(browse.contents.playlist, ['fake']);
    console.log('ok browseWatchLater crossed the bridge and the signed request returned the payload');

    await context.unrouteAll({ behavior: 'wait' });
    await context.route('https://www.youtube.com/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/playlist') {
        return route.fulfill({ status: 200, contentType: 'text/html', body: FAKE_PAGE });
      }
      if (url.pathname === '/youtubei/v1/browse') {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BROWSE_RESPONSE) });
      }
      return route.fulfill({ status: 404, body: '' });
    });
    const gone = await dashboard.evaluate(async () => {
      const bridge = WLCore.tabBridge.createTabBridge({ ...chrome, tabs: chrome.tabs });
      const tab = await bridge.ensureTab();
      const pending = bridge.request('browseWatchLater', null);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await chrome.tabs.remove(tab.id);
      try {
        await pending;
        return 'resolved';
      } catch (err) {
        return err.name;
      }
    });
    assert.strictEqual(gone, 'TabGoneError', `expected TabGoneError, got ${gone}`);
    console.log('ok closing the tab mid request rejected with TabGoneError, not a hang');

    const unexpected = errors.filter((e) => !/the YouTube tab closed mid request/.test(e));
    assert.deepStrictEqual(unexpected, []);
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
