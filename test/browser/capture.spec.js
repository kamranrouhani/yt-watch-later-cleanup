'use strict';

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.WL_CHROME
  || '/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';
const SNIPPET = fs.readFileSync(path.join(ROOT, 'tools/capture.js'), 'utf8');

const FAKE_SAPISID = 'fakeSapisidValue123';
const FAKE_API_KEY = 'AIzaFakeInnertubeKey';
const FAKE_VISITOR = 'CgtGYWtlVmlzaXRvcg%3D%3D';
const BROWSE_PARAMS = 'wgYCCAA%3D';

function item(n, extra = {}) {
  return {
    playlistVideoRenderer: {
      videoId: `vid${n}`,
      title: { runs: [{ text: `Video ${n}` }] },
      menu: { menuRenderer: { items: [{ menuServiceItemRenderer: { serviceEndpoint: {
        playlistEditEndpoint: { actions: [{ action: 'ACTION_REMOVE_VIDEO', setVideoId: `set${n}` }] },
      } } }] } },
      ...extra,
    },
  };
}

function continuationItem(token) {
  return { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token } } } };
}

const PAGES = {
  first: {
    responseContext: { visitorData: FAKE_VISITOR },
    contents: { twoColumnBrowseResultsRenderer: { tabs: [{ tabRenderer: { content: { sectionListRenderer: {
      contents: [{ itemSectionRenderer: { contents: [{ playlistVideoListRenderer: {
        contents: [
          item(1, { thumbnailOverlays: [{ thumbnailOverlayResumePlaybackRenderer: { percentDurationWatched: 100 } }] }),
          item(2, { isPlayable: false, unplayableText: { simpleText: '[Private video]' } }),
          continuationItem('TOKEN_2'),
        ],
      } }] } }],
    } } } }] } },
  },
  TOKEN_2: {
    onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [
      item(3, { navigationEndpoint: { commandMetadata: { webCommandMetadata: { url: '/shorts/vid3' } } } }),
      continuationItem('TOKEN_3'),
    ] } }],
  },
  TOKEN_3: {
    onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [
      { lockupViewModel: { contentId: 'vid4' } },
      continuationItem('TOKEN_4'),
    ] } }],
  },
  TOKEN_4: {
    onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [item(5)] } }],
  },
};

const FAKE_PAGE = `<!doctype html><html><head><title>Watch later - YouTube</title></head><body>
<script>
  window.ytcfg = { data_: {
    INNERTUBE_API_KEY: '${FAKE_API_KEY}',
    INNERTUBE_CLIENT_VERSION: '2.20260922.01.00',
    HL: 'en', GL: 'DE', VISITOR_DATA: '${FAKE_VISITOR}',
  }, get(k) { return this.data_[k]; } };
  window.ytInitialData = { header: { browseEndpoint: { browseId: 'VLWL', params: '${BROWSE_PARAMS}' } } };
</script></body></html>`;

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-capture-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    args: ['--no-sandbox'],
    acceptDownloads: true,
  });

  try {
    await context.addCookies([{
      name: 'SAPISID', value: FAKE_SAPISID, domain: '.youtube.com', path: '/', secure: true,
    }]);

    const browseRequests = [];
    const otherRequests = [];
    let loaded = false;

    await context.route('https://www.youtube.com/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/playlist') {
        return route.fulfill({ status: 200, contentType: 'text/html', body: FAKE_PAGE });
      }
      if (url.pathname === '/youtubei/v1/browse' && request.method() === 'POST') {
        const body = JSON.parse(request.postData());
        browseRequests.push({ url, headers: request.headers(), body });
        const response = PAGES[body.continuation || 'first'];
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
      }
      return route.fulfill({ status: 404, body: '' });
    });

    const page = await context.newPage();
    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));
    page.on('request', (request) => {
      const url = request.url();
      if (loaded && !url.startsWith('blob:') && !url.includes('/youtubei/v1/browse')) otherRequests.push(url);
    });

    await page.goto('https://www.youtube.com/playlist?list=WL');
    loaded = true;

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.evaluate(SNIPPET),
    ]);

    assert.strictEqual(browseRequests.length, 3, `expected 3 browse requests, got ${browseRequests.length}`);
    assert.deepStrictEqual(otherRequests, [], 'the snippet requested something other than browse');

    for (const { url, headers } of browseRequests) {
      assert.strictEqual(url.searchParams.get('key'), FAKE_API_KEY);
      const [, ts, hash] = headers.authorization.match(/^SAPISIDHASH (\d{10})_([0-9a-f]{40})$/) || [];
      assert.ok(ts, `unexpected authorization header ${headers.authorization}`);
      const expected = crypto.createHash('sha1').update(`${ts} ${FAKE_SAPISID} https://www.youtube.com`).digest('hex');
      assert.strictEqual(hash, expected);
      assert.strictEqual(headers['x-origin'], 'https://www.youtube.com');
    }

    const [first, second, third] = browseRequests.map((r) => r.body);
    assert.strictEqual(first.browseId, 'VLWL');
    assert.strictEqual(first.params, BROWSE_PARAMS);
    assert.strictEqual(first.context.client.clientName, 'WEB');
    assert.strictEqual(second.continuation, 'TOKEN_2');
    assert.strictEqual(third.continuation, 'TOKEN_3');

    assert.match(download.suggestedFilename(), /^wl-capture-\d{8}-\d{6}\.json$/);
    const text = fs.readFileSync(await download.path(), 'utf8');
    for (const secret of [FAKE_SAPISID, FAKE_API_KEY, 'SAPISIDHASH']) {
      assert.ok(!text.includes(secret), `capture file contains ${secret}`);
    }

    const capture = JSON.parse(text);
    assert.strictEqual(capture.format, 'wl-capture/1');
    assert.deepStrictEqual(
      capture.responses.map((r) => r.response),
      [PAGES.first, PAGES.TOKEN_2, PAGES.TOKEN_3],
    );
    assert.deepStrictEqual(capture.responses.map((r) => r.continuation), [null, 'TOKEN_2', 'TOKEN_3']);
    assert.strictEqual(capture.client.clientVersion, '2.20260922.01.00');
    assert.strictEqual(capture.browseParams, BROWSE_PARAMS);

    assert.deepStrictEqual(capture.summary, {
      pages: 3,
      playlistVideoRenderer: 3,
      lockupViewModel: 1,
      resumeOverlays: 1,
      resumePercentages: { '100': 1 },
      unplayable: 1,
      shortsLike: 1,
      moreAvailable: true,
    });
    assert.ok(logs.some((line) => line.includes('wl-capture')), 'the snippet printed no summary');

    console.log(`ok capture snippet made 3 signed browse requests and downloaded ${download.suggestedFilename()}`);
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
