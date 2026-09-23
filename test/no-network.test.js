'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { findViolations } = require('./helpers/no-network-scan.js');

test('no shipped file makes network calls or names another origin', () => {
  assert.deepStrictEqual(findViolations(), []);
});

function ship(roots, files, dirs = { dashboard: true, src: true }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-nn-'));
  for (const dir of Object.keys(dirs)) fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.mkdirSync(path.join(root, 'src/core'), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, rel), content);
  }
  fs.copyFileSync(path.join(__dirname, '..', 'src/core/net.js'), path.join(root, 'src/core/net.js'));
  return root;
}

test('a stray fetch in any shipped file is caught, net.js itself is not', () => {
  const root = ship(null, {
    'manifest.json': '{}',
    'background.js': "const x = 1;",
    'dashboard/dashboard.js': "fetch('https://www.youtube.com/x');",
  });
  assert.deepStrictEqual(findViolations(root), ['dashboard/dashboard.js: fetch(']);
});

test('prefetch and myfetch are not fetch calls', () => {
  const root = ship(null, {
    'manifest.json': '{}',
    'background.js': "const a = prefetch('x'); const b = myfetch('y');",
  });
  assert.deepStrictEqual(findViolations(root), []);
});

test('every other network api is caught outside net.js', () => {
  const apis = [
    "new WebSocket('wss://www.youtube.com/x');",
    "new EventSource('https://www.youtube.com/x');",
    "navigator.sendBeacon('https://www.youtube.com/x');",
    "const x = new XMLHttpRequest();",
    "await import('https://www.youtube.com/x.js');",
    "new Worker('https://www.youtube.com/x.js');",
  ];
  for (const api of apis) {
    const root = ship(null, { 'manifest.json': '{}', 'background.js': api });
    assert.deepStrictEqual(findViolations(root).length, 1, `${api} not caught`);
  }
});

test('an origin other than youtube or googleapis is caught, even in a string', () => {
  const root = ship(null, {
    'manifest.json': '{}',
    'background.js': "const u = 'https://evil.example.com/x';",
  });
  assert.deepStrictEqual(findViolations(root), ['background.js: origin https://evil.example.com']);
});

test('youtube and googleapis origins pass, scheme swaps do not', () => {
  const root = ship(null, {
    'manifest.json': '{}',
    'background.js': "const a = 'https://www.youtube.com/playlist?list=WL'; const b = 'https://www.googleapis.com/youtube/v3/videos';",
  });
  assert.deepStrictEqual(findViolations(root), []);
  const swapped = ship(null, {
    'manifest.json': '{}',
    'background.js': "const a = 'http://www.youtube.com/x';",
  });
  assert.deepStrictEqual(findViolations(swapped), ['background.js: origin http://www.youtube.com']);
});

test('dashboard html and css are scanned for origins', () => {
  const root = ship(null, {
    'manifest.json': '{}',
    'dashboard/dashboard.html': '<link rel="stylesheet" href="https://cdn.example.com/x.css">',
  });
  assert.deepStrictEqual(findViolations(root), ['dashboard/dashboard.html: origin https://cdn.example.com']);
});

test('reference, test, tools, docs, scripts and node_modules are never scanned', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-nn-'));
  for (const dir of ['reference', 'test', 'tools', 'docs', 'scripts', 'node_modules', 'tasks', '.github']) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.writeFileSync(path.join(root, dir, 'bad.js'), "fetch('https://evil.example.com/x'); new WebSocket('w://x');");
  }
  fs.mkdirSync(path.join(root, 'src/core'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/core/constants.js'), "'use strict';\n");
  fs.writeFileSync(path.join(root, 'manifest.json'), '{}');
  assert.deepStrictEqual(findViolations(root), []);
});

test('finding the repo root is not hardcoded to this checkout', () => {
  const root = ship(null, { 'manifest.json': '{}', 'background.js': 'const a = 1;' });
  assert.deepStrictEqual(findViolations(root), []);
});
