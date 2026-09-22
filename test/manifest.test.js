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
