'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const { pickSapisid, buildAuthHeader, NotSignedInError } = require('../src/core/auth.js');

const VECTOR = { nowSeconds: 1758600000, sapisid: 'aVeryFakeSapisidForTesting', origin: 'https://www.youtube.com' };

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

test('a known input produces the header upstream would send', async () => {
  const header = await buildAuthHeader(VECTOR);
  assert.strictEqual(header, `SAPISIDHASH ${VECTOR.nowSeconds}_${sha1(`${VECTOR.nowSeconds} ${VECTOR.sapisid} ${VECTOR.origin}`)}`);
});

test('the timestamp in the header is the seconds value given, not milliseconds', async () => {
  const header = await buildAuthHeader(VECTOR);
  const [tag, timestamp] = header.split(' ');
  assert.strictEqual(tag, 'SAPISIDHASH');
  assert.strictEqual(timestamp.split('_')[0], String(VECTOR.nowSeconds));
});

test('a different origin changes the hash', async () => {
  const base = await buildAuthHeader(VECTOR);
  const other = await buildAuthHeader({ ...VECTOR, origin: 'https://music.youtube.com' });
  assert.notStrictEqual(other, base);
});

test('pickSapisid prefers SAPISID over the secure variants', () => {
  assert.strictEqual(
    pickSapisid('__Secure-3PAPISID=bbb; SAPISID=aaa; __Secure-1PAPISID=ccc'),
    'aaa',
  );
});

test('pickSapisid falls back to __Secure-3PAPISID then __Secure-1PAPISID', () => {
  assert.strictEqual(pickSapisid('SID=zzz; __Secure-1PAPISID=ccc'), 'ccc');
  assert.strictEqual(pickSapisid('__Secure-3PAPISID=bbb; __Secure-1PAPISID=ccc'), 'bbb');
});

test('pickSapisid reads the first cookie of a repeated name, as upstream does', () => {
  assert.strictEqual(pickSapisid('SAPISID=first; SAPISID=second'), 'first');
});

test('pickSapisid decodes percent-encoded values', () => {
  assert.strictEqual(pickSapisid('SAPISID=a%2Fb%3Dc'), 'a/b=c');
});

test('pickSapisid needs no spaces, and a space before the equals sign is not a cookie', () => {
  assert.strictEqual(pickSapisid('SAPISID=abc'), 'abc');
  assert.throws(() => pickSapisid('  SAPISID = abc ;'), NotSignedInError);
});

test('missing cookies raise NotSignedInError', async () => {
  for (const cookies of ['', 'SID=only; VISITOR_INFO1_LIVE=none', 'SAPISID=']) {
    assert.throws(() => pickSapisid(cookies), NotSignedInError);
  }
  await assert.rejects(() => buildAuthHeader({ ...VECTOR, sapisid: '' }), NotSignedInError);
});

test('NotSignedInError carries the upstream message and its own name', () => {
  try {
    pickSapisid('');
  } catch (err) {
    assert.strictEqual(err.name, 'NotSignedInError');
    assert.match(err.message, /Missing SAPISID\/3PAPISID cookie/);
    assert.ok(err instanceof Error);
  }
});

test('buildAuthHeader with a real sapisid only needs the pure input', async () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = await buildAuthHeader({ sapisid: 's3cret', origin: 'https://www.youtube.com', nowSeconds });
  assert.strictEqual(header, `SAPISIDHASH ${nowSeconds}_${sha1(`${nowSeconds} s3cret https://www.youtube.com`)}`);
});
