'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function readManifest(root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
}

function manifestPaths(manifest) {
  const paths = [];
  if (manifest.background?.service_worker) paths.push(manifest.background.service_worker);
  if (manifest.action?.default_popup) paths.push(manifest.action.default_popup);
  for (const icon of Object.values(manifest.icons || {})) paths.push(icon);
  for (const resource of manifest.web_accessible_resources || []) paths.push(resource);
  for (const script of manifest.content_scripts || []) {
    for (const file of script.js || []) paths.push(file);
    for (const file of script.css || []) paths.push(file);
  }
  return paths;
}

test('every file the manifest references exists', () => {
  for (const rel of manifestPaths(readManifest())) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} missing`);
  }
});

test('the manifest declares no duplicate permissions or host permissions', () => {
  const manifest = readManifest();
  for (const key of ['permissions', 'host_permissions']) {
    const list = manifest[key] || [];
    assert.strictEqual(new Set(list).size, list.length, `${key} holds duplicates`);
  }
  for (const script of manifest.content_scripts || []) {
    for (const key of ['matches', 'js', 'css']) {
      const list = script[key] || [];
      assert.strictEqual(new Set(list).size, list.length, `content_scripts ${key} holds duplicates`);
    }
  }
});

test('every script the dashboard loads is a real file', () => {
  const dashboardDir = path.join(ROOT, 'dashboard');
  const html = fs.readFileSync(path.join(dashboardDir, 'dashboard.html'), 'utf8');
  const sources = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(sources.length > 0, 'dashboard.html loads no scripts');
  for (const src of sources) {
    assert.ok(fs.existsSync(path.join(dashboardDir, src)), `${src} missing`);
  }
});

test('a manifest referencing a missing content script file is caught', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-wire-'));
  fs.writeFileSync(path.join(root, 'background.js'), "'use strict';\n");
  fs.writeFileSync(path.join(root, 'ok.js'), "'use strict';\n");
  const bad = { ...readManifest(), content_scripts: [{ matches: ['https://www.youtube.com/*'], js: ['ok.js', 'missing.js'] }] };
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(bad));
  const missing = manifestPaths(readManifest(root)).filter((rel) => !fs.existsSync(path.join(root, rel)));
  assert.deepStrictEqual(missing, ['missing.js']);
});

test('a duplicate permission is caught', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-wire-'));
  const manifest = readManifest();
  const doubled = { ...manifest, permissions: [...manifest.permissions, manifest.permissions[0]] };
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(doubled));
  assert.throws(() => {
    const list = readManifest(root).permissions;
    if (new Set(list).size !== list.length) throw new Error('permissions holds duplicates');
  }, /duplicates/);
});

test('the manifest still asks for only storage and tabs', () => {
  const manifest = readManifest();
  assert.deepStrictEqual([...manifest.permissions].sort(), ['storage', 'tabs']);
  assert.deepStrictEqual(manifest.host_permissions, ['https://www.youtube.com/*']);
});

test('the main world entry lists exactly the scripts the page needs, in order', () => {
  const manifest = readManifest();
  const main = (manifest.content_scripts || []).find((s) => s.world === 'MAIN');
  assert.ok(main, 'no MAIN world content script');
  assert.deepStrictEqual(main.js, [
    'src/core/constants.js',
    'src/core/auth.js',
    'src/core/net.js',
    'src/core/innertube.js',
    'content/page.js',
  ]);
  const isolated = (manifest.content_scripts || []).find((s) => !s.world);
  assert.ok(isolated, 'no isolated world content script');
  assert.deepStrictEqual(isolated.js, ['content/bridge.js']);
});
