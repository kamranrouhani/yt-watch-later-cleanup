'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'tools/capture.js'), 'utf8');

test('the capture snippet cannot edit a playlist', () => {
  assert.ok(!SOURCE.includes('edit_playlist'));
  assert.ok(!/ACTION_(REMOVE|ADD|SET)/.test(SOURCE));
});

test('the capture snippet only calls browse', () => {
  const paths = [...SOURCE.matchAll(/youtubeiRequest\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(paths.length > 0);
  assert.deepStrictEqual([...new Set(paths)], ['browse']);
});

test('the capture snippet writes no cookie or key into the file', () => {
  const payload = SOURCE.slice(SOURCE.indexOf('const capture = {'));
  assert.ok(payload.startsWith('const capture = {'), 'capture object not found');
  const objectLiteral = payload.slice(0, payload.indexOf('\n  };') + 5);
  for (const forbidden of ['getCookie', 'getApiKey', 'buildAuthHeader', 'document.cookie', 'ytcfg']) {
    assert.ok(!objectLiteral.includes(forbidden), `capture object references ${forbidden}`);
  }
});
