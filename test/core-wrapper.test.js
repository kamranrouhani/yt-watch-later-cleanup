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
