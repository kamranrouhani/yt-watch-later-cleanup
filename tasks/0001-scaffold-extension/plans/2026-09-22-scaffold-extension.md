# Scaffold the MV3 extension and the test runner

- **Issue:** #1
- **Branch:** `feature/0001-scaffold-extension`
- **Written:** 2026-09-22 22:56, on `main` at `d1368b6`
- **Supersedes:** nothing

## Goal

An empty extension that loads in Chrome, opens a dashboard from the toolbar,
and a test setup every later issue builds on: unit tests, a syntax check, a
real browser load check, and CI.

## Already proven

Every file below was built and run in a scratch directory on this host before
this plan was written. The results:

```
npm run check          all files parse
npm test               # tests 9  # pass 9  # fail 0
npm run test:browser   ok extension ... loaded, dashboard rendered, no errors
```

Deleting `src/core/constants.js` and `dashboard/` made 5 of the unit tests
fail for the right reasons. Replacing `dashboard.js` with a throwing line made
the browser test fail with `dashboard.js did not run`. `npm test` launched no
browser.

So this task is mostly transcription, done test first. If anything here fails
on the real repository, the difference between the scratch run and the repo
is the bug. Record it in the progress log.

## Decisions

- **Dashboard is a full tab, not a popup.** The toolbar click opens
  `dashboard/dashboard.html`, or focuses it if already open. There is no
  `default_popup`, because a popup closes when it loses focus and a scan or
  run takes minutes.
- **Permissions are minimal:** `storage`, `tabs`, and host access to
  `https://www.youtube.com/*`. `scripting` and the content scripts arrive in
  #11. The Data API origin arrives in #18. A test pins the list so any
  widening is deliberate.
- **`src/core/constants.js` exists to prove the wrapper pattern** with real
  values later modules will use, not a throwaway.
- **Playwright is a dev dependency of this repo.** It is not borrowed from
  the Amazon repo. The browser binary is pinned to the one installed on this
  host, overridable with `WL_CHROME`, because Playwright's default resolution
  picks a version that is not installed.
- **`npm test` never runs `test/browser/`.** The glob is `test/*.test.js`,
  not recursive, and browser files are named `*.spec.js`.
- **CI runs `check` and `test`, not the browser test.** The browser test
  needs the pinned binary; CI can take it on later if it earns its place.

## Steps

### Step 1: Branch

```bash
git checkout main && git pull --ff-only
git checkout -b feature/0001-scaffold-extension
```

### Step 2: package.json and install

**File: `package.json`**

```json
{
  "name": "yt-watch-later-cleanup",
  "version": "0.1.0",
  "private": true,
  "license": "MIT",
  "description": "Dev harness for the Watch Later Cleanup extension. Not shipped.",
  "scripts": {
    "test": "node --test \"test/*.test.js\"",
    "test:watch": "node --test --watch \"test/*.test.js\"",
    "test:browser": "node test/browser/load.spec.js",
    "test:all": "npm run check && npm test && npm run test:browser",
    "check": "node scripts/check-syntax.js"
  },
  "devDependencies": {
    "playwright": "^1.56.0"
  }
}
```

```bash
npm install
npx playwright --version
```

Expected: `package-lock.json` created, a Playwright version printed. Commit
the lockfile; CI uses `npm ci`.

### Step 3: Failing tests for the core wrapper

**File: `test/core-wrapper.test.js`**

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'src/core/constants.js'), 'utf8');

function runAsClassicScript(globals) {
  const sandbox = { ...globals };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);
  return sandbox;
}

test('constants load under node through module.exports', () => {
  const { constants } = require('../src/core/constants.js');
  assert.strictEqual(constants.WATCH_LATER_PLAYLIST_ID, 'WL');
  assert.strictEqual(constants.YOUTUBE_ORIGIN, 'https://www.youtube.com');
});

test('constants attach to WLCore when loaded as a classic browser script', () => {
  const sandbox = runAsClassicScript({});
  assert.strictEqual(sandbox.WLCore.constants.WATCH_LATER_PLAYLIST_ID, 'WL');
});

test('a second core script extends WLCore instead of replacing it', () => {
  const sandbox = runAsClassicScript({ WLCore: { existing: true } });
  assert.strictEqual(sandbox.WLCore.existing, true);
  assert.ok(sandbox.WLCore.constants);
});

test('constants cannot be mutated at runtime', () => {
  const { constants } = require('../src/core/constants.js');
  assert.ok(Object.isFrozen(constants));
});
```

Run `npm test`. Expected: 4 failures, `Cannot find module
'../src/core/constants.js'`. If they pass, the test is wrong.

### Step 4: The first core module

**File: `src/core/constants.js`**

```js
'use strict';

(function (root) {
  const constants = Object.freeze({
    VERSION_TAG: 'wl-cleanup',
    WATCH_LATER_PLAYLIST_ID: 'WL',
    WATCH_LATER_URL: 'https://www.youtube.com/playlist?list=WL',
    YOUTUBE_ORIGIN: 'https://www.youtube.com',
    DATA_API_ORIGIN: 'https://www.googleapis.com',
  });

  const api = { constants };

  root.WLCore = Object.assign(root.WLCore || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

Run `npm test`. Expected: `# pass 4`, `# fail 0`.

### Step 5: Failing tests for the manifest and dashboard wiring

**File: `test/manifest.test.js`**

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

test('manifest is MV3', () => {
  assert.strictEqual(manifest.manifest_version, 3);
});

test('manifest asks for no permissions beyond storage and tabs', () => {
  assert.deepStrictEqual([...manifest.permissions].sort(), ['storage', 'tabs']);
  assert.deepStrictEqual(manifest.host_permissions, ['https://www.youtube.com/*']);
});

test('the background service worker exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, manifest.background.service_worker)));
});

test('the dashboard page the background opens exists', () => {
  const background = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8');
  const match = background.match(/DASHBOARD_PATH = '([^']+)'/);
  assert.ok(match, 'background.js does not declare DASHBOARD_PATH');
  assert.ok(fs.existsSync(path.join(ROOT, match[1])), `${match[1]} missing`);
});

test('every script the dashboard loads exists', () => {
  const dashboardDir = path.join(ROOT, 'dashboard');
  const html = fs.readFileSync(path.join(dashboardDir, 'dashboard.html'), 'utf8');
  const sources = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(sources.length > 0, 'dashboard.html loads no scripts');
  for (const src of sources) {
    assert.ok(fs.existsSync(path.join(dashboardDir, src)), `${src} missing`);
  }
});
```

Run `npm test`. Expected: the 5 new tests fail on the missing
`manifest.json`.

### Step 6: Manifest, background, dashboard

**File: `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Watch Later Cleanup",
  "version": "0.1.0",
  "description": "Clean up a YouTube Watch Later playlist with rules. Preview first, then remove.",
  "permissions": ["storage", "tabs"],
  "host_permissions": ["https://www.youtube.com/*"],
  "action": {
    "default_title": "Open Watch Later Cleanup"
  },
  "background": {
    "service_worker": "background.js"
  }
}
```

**File: `background.js`**

```js
'use strict';

const DASHBOARD_PATH = 'dashboard/dashboard.html';

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL(DASHBOARD_PATH);
  const [existing] = await chrome.tabs.query({ url });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url });
});
```

**File: `dashboard/dashboard.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Watch Later Cleanup</title>
  <link rel="stylesheet" href="dashboard.css">
</head>
<body>
  <main id="app">
    <h1>Watch Later Cleanup</h1>
    <p id="status">Not connected to YouTube yet.</p>
  </main>
  <script src="../src/core/constants.js"></script>
  <script src="dashboard.js"></script>
</body>
</html>
```

**File: `dashboard/dashboard.css`**

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
}

body {
  margin: 0;
  padding: 2rem;
}
```

**File: `dashboard/dashboard.js`**

```js
'use strict';

(function () {
  const status = document.getElementById('status');
  status.dataset.version = WLCore.constants.VERSION_TAG;
})();
```

Run `npm test`. Expected: `# tests 9`, `# pass 9`, `# fail 0`.

### Step 7: Syntax check script

**File: `scripts/check-syntax.js`**

```js
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'reference', 'tasks']);

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

let failed = 0;
for (const file of jsFiles(ROOT)) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed += 1;
    console.error(`SYNTAX FAIL: ${path.relative(ROOT, file)}`);
    console.error(err.stderr.toString());
  }
}

for (const file of ['manifest.json', 'package.json']) {
  try {
    JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  } catch (err) {
    failed += 1;
    console.error(`JSON FAIL: ${file}: ${err.message}`);
  }
}

if (failed) process.exit(1);
console.log('all files parse');
```

Run `npm run check`. Expected: `all files parse`. Then prove it bites: add a
stray `{` to `dashboard/dashboard.js`, run it, see `SYNTAX FAIL:
dashboard/dashboard.js`, revert.

### Step 8: Real browser load test

**File: `test/browser/load.spec.js`**

```js
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

    console.log(`ok extension ${extensionId} loaded, dashboard rendered, no errors`);
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Run `npm run test:browser`. Expected: `ok extension <id> loaded, dashboard
rendered, no errors`.

Then prove it bites: replace `dashboard/dashboard.js` with
`WLCore.nope.boom();`, rerun, see `AssertionError ... dashboard.js did not
run`, restore.

Then prove the separation: run `npm test` and confirm no browser launched and
the count is still 9.

### Step 9: CI

**File: `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm test
```

The push goes over SSH, so the gh token lacking the `workflow` scope does not
matter.

### Step 10: Docs

- `CONTRIBUTING.md`: the test command block already lists `npm test` and
  `npm run test:browser`. Add `npm run check`, and replace the "fake YouTube
  from fixtures" description of the browser test with what it does today
  (loads the extension and opens the dashboard). #16 widens it later.
- `README.md`: add a "Try it" section with the load unpacked steps from
  `CONTRIBUTING.md`, marked as showing an empty dashboard for now.

### Step 11: Verify, push, PR, CI, review, merge

```bash
npm run test:all
```

Then commit in small pieces (config and tests, extension files, check
script, browser test, CI, docs), push, open the PR with `Closes #1`, and wait
for CI to go green on the PR before reviewing. The review is written to this
task's `reviews/`. Merge with a regular merge commit.

## Acceptance, from the issue

| Criterion | How it is shown |
|---|---|
| `npm test` passes locally and in CI | local output, and the green check on the PR |
| manifest parses | `npm run check` |
| loads unpacked with no errors | `npm run test:browser` asserts no page or console errors; also listed for a manual check |
| toolbar icon opens the dashboard | the browser test asserts the click listener is registered. The click itself cannot be driven headless, so it goes on the manual checklist |

## Out of scope

Content scripts, the YouTube bridge, any network code (#2, #11). No UI beyond
the placeholder heading (#12).
