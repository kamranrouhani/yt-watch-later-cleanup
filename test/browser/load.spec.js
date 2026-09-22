'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.WL_CHROME
  || '/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-profile-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    args: [
      '--no-sandbox',
      `--disable-extensions-except=${ROOT}`,
      `--load-extension=${ROOT}`,
    ],
  });

  try {
    const worker = context.serviceWorkers()[0]
      || await context.waitForEvent('serviceworker', { timeout: 10000 });
    const extensionId = new URL(worker.url()).host;

    assert.strictEqual(
      await worker.evaluate(() => chrome.action.onClicked.hasListeners()),
      true,
      'toolbar click listener is not registered',
    );

    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(`chrome-extension://${extensionId}/dashboard/dashboard.html`);

    assert.strictEqual(await page.title(), 'Watch Later Cleanup');
    assert.strictEqual(
      await page.evaluate(() => typeof window.WLCore?.constants?.WATCH_LATER_URL),
      'string',
      'WLCore did not load in the dashboard',
    );
    assert.strictEqual(
      await page.getAttribute('#status', 'data-version'),
      'wl-cleanup',
      'dashboard.js did not run',
    );
    assert.deepStrictEqual(errors, []);

    const dashboardUrl = `chrome-extension://${extensionId}/dashboard/dashboard.html`;
    await page.close();
    await worker.evaluate(() => openDashboard());
    await worker.evaluate(() => openDashboard());
    const dashboardTabs = await worker.evaluate(
      (url) => chrome.tabs.query({ url }).then((tabs) => tabs.length),
      dashboardUrl,
    );
    assert.strictEqual(dashboardTabs, 1, 'opening the dashboard twice should focus, not duplicate');

    console.log(`ok extension ${extensionId} loaded, dashboard rendered, no errors`);
    console.log('ok toolbar handler opens one dashboard tab and refocuses it');
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
