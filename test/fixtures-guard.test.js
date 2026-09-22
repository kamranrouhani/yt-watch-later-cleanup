'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { findLeaks } = require('./helpers/fixture-guard.js');

const CAPTURED = path.join(__dirname, 'fixtures/captured');

test('committed captures contain no @, no SAPISID and no denylisted value', () => {
  assert.deepStrictEqual(findLeaks(CAPTURED), []);
});

function plant(files, denylist = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-guard-'));
  fs.mkdirSync(path.join(dir, '2026-01-01'));
  fs.mkdirSync(path.join(dir, 'raw'));
  fs.writeFileSync(path.join(dir, 'raw', 'ignored.json'), JSON.stringify({ a: 'me@example.com SAPISID' }));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, '2026-01-01', name), JSON.stringify(content));
  }
  const hashes = denylist.map((v) => crypto.createHash('sha256').update(v).digest('hex'));
  fs.writeFileSync(path.join(dir, 'denylist.sha256'), `${hashes.join('\n')}\n`);
  return dir;
}

test('the guard catches an @ sign', () => {
  const leaks = findLeaks(plant({ 'page-1.json': { a: { b: ['fine', 'reach me at x@y.z'] } } }));
  assert.deepStrictEqual(leaks, ['2026-01-01/page-1.json $.a.b[1]: contains @']);
});

test('the guard catches SAPISID in any case', () => {
  const leaks = findLeaks(plant({ 'page-1.json': { cookie: 'x; sapisid=abc' } }));
  assert.deepStrictEqual(leaks, ['2026-01-01/page-1.json $.cookie: contains SAPISID']);
});

test('the guard catches a denylisted value on its own and inside a longer string', () => {
  const dir = plant({
    'page-1.json': {
      title: 'My Real Title',
      label: 'My Real Title by Channel 1 3 minutes',
      clean: 'Video title 1 by Channel 1 3 minutes',
    },
  }, ['My Real Title']);
  assert.deepStrictEqual(findLeaks(dir), [
    '2026-01-01/page-1.json $.title: matches the denylist',
    '2026-01-01/page-1.json $.label: matches the denylist',
  ]);
});

test('the guard catches a denylisted value that is not whitespace separated', () => {
  const dir = plant({ 'page-1.json': { url: '/watch?v=RealVid0001&list=WL' } }, ['RealVid0001']);
  assert.deepStrictEqual(findLeaks(dir), ['2026-01-01/page-1.json $.url: matches the denylist']);
});

test('the guard skips raw/ and reads every json file under the root', () => {
  const dir = plant({ 'page-1.json': { a: 'clean' }, 'page-2.json': { b: 'x@y' } });
  assert.deepStrictEqual(findLeaks(dir), ['2026-01-01/page-2.json $.b: contains @']);
});

test('scrubber output passes the guard, the raw capture does not', () => {
  const { execFileSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-guard-'));
  fs.mkdirSync(path.join(dir, 'raw'));
  const raw = path.join(dir, 'raw', 'wl-capture.json');
  fs.copyFileSync(path.join(__dirname, 'fixtures/synthetic/raw-capture.json'), raw);
  execFileSync(process.execPath, [path.join(__dirname, '..', 'tools/scrub.js'), raw, path.join(dir, '2026-01-01')]);
  assert.deepStrictEqual(findLeaks(dir), []);

  fs.copyFileSync(raw, path.join(dir, '2026-01-01', 'unscrubbed.json'));
  const leaks = findLeaks(dir).filter((leak) => leak.startsWith('2026-01-01/unscrubbed.json'));
  assert.ok(leaks.some((leak) => leak.endsWith('contains @')));
  assert.ok(leaks.some((leak) => leak.endsWith('matches the denylist')));
});
