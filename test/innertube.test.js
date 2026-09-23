'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  createInnertube, RateLimitedError, AuthError, EditRejectedError, HttpError,
} = require('../src/core/innertube.js');

const ORIGIN = 'https://www.youtube.com';

function fakeDeps(responses) {
  const calls = [];
  const queue = [...responses];
  const net = {
    fetch: async (url, init) => {
      calls.push({ url, init });
      const scripted = queue.shift() || { status: 200, body: { status: 'STATUS_SUCCEEDED' } };
      return {
        ok: scripted.status >= 200 && scripted.status < 300,
        status: scripted.status,
        text: async () => (typeof scripted.body === 'string' ? scripted.body : JSON.stringify(scripted.body)),
        json: async () => {
          if (typeof scripted.body === 'string') throw new SyntaxError('not json');
          return scripted.body;
        },
      };
    },
  };
  return { calls, net, authHeader: async () => 'SAPISIDHASH 1234567890_deadbeef' };
}

const CONFIG = { apiKey: 'AIzaFake', clientVersion: '2.20260923.01.00', hl: 'en', gl: 'DE' };

function client(deps) {
  return createInnertube(CONFIG, deps);
}

test('browseWatchLater sends exactly what upstream sends, field by field', async () => {
  const deps = fakeDeps([{ status: 200, body: { contents: {} } }]);
  const innertube = client(deps);
  await innertube.browseWatchLater('wgYCCAA%3D');

  assert.strictEqual(deps.calls.length, 1);
  const { url, init } = deps.calls[0];
  assert.strictEqual(url, `${ORIGIN}/youtubei/v1/browse?prettyPrint=false&key=AIzaFake`);
  assert.strictEqual(init.method, 'POST');
  assert.strictEqual(init.headers['content-type'], 'application/json');
  assert.strictEqual(init.headers['x-youtube-client-name'], '1');
  assert.strictEqual(init.headers['x-youtube-client-version'], '2.20260923.01.00');
  assert.strictEqual(init.headers['x-origin'], ORIGIN);
  assert.match(init.headers.authorization, /^SAPISIDHASH /);
  assert.deepStrictEqual(JSON.parse(init.body), {
    context: { client: { clientName: 'WEB', clientVersion: '2.20260923.01.00', hl: 'en', gl: 'DE' } },
    browseId: 'VLWL',
    params: 'wgYCCAA%3D',
  });
});

test('browseWatchLater omits params when none is given', async () => {
  const deps = fakeDeps([{ status: 200, body: {} }]);
  await client(deps).browseWatchLater(null);
  assert.deepStrictEqual(JSON.parse(deps.calls[0].init.body), {
    context: { client: { clientName: 'WEB', clientVersion: '2.20260923.01.00', hl: 'en', gl: 'DE' } },
    browseId: 'VLWL',
  });
});

test('visitorData is included when present and omitted when absent', async () => {
  const withVisitor = fakeDeps([{ status: 200, body: {} }]);
  await createInnertube({ ...CONFIG, visitorData: 'CgtW' }, withVisitor).browseWatchLater(null);
  assert.strictEqual(JSON.parse(withVisitor.calls[0].init.body).context.client.visitorData, 'CgtW');

  const without = fakeDeps([{ status: 200, body: {} }]);
  await client(without).browseWatchLater(null);
  assert.ok(!('visitorData' in JSON.parse(without.calls[0].init.body).context.client));
});

test('browseContinuation sends the token in the body', async () => {
  const deps = fakeDeps([{ status: 200, body: {} }]);
  await client(deps).browseContinuation('TOKEN_2');
  assert.strictEqual(deps.calls[0].url, `${ORIGIN}/youtubei/v1/browse?prettyPrint=false&key=AIzaFake`);
  assert.deepStrictEqual(JSON.parse(deps.calls[0].init.body), {
    context: { client: { clientName: 'WEB', clientVersion: '2.20260923.01.00', hl: 'en', gl: 'DE' } },
    continuation: 'TOKEN_2',
  });
});

test('editPlaylist sends the actions with the watch later params', async () => {
  const deps = fakeDeps([{ status: 200, body: { status: 'STATUS_SUCCEEDED' } }]);
  await client(deps).editPlaylist([{ action: 'ACTION_REMOVE_VIDEO', setVideoId: 'S1' }]);
  assert.strictEqual(deps.calls[0].url, `${ORIGIN}/youtubei/v1/browse/edit_playlist?prettyPrint=false&key=AIzaFake`);
  assert.deepStrictEqual(JSON.parse(deps.calls[0].init.body), {
    context: { client: { clientName: 'WEB', clientVersion: '2.20260923.01.00', hl: 'en', gl: 'DE' } },
    playlistId: 'WL',
    actions: [{ action: 'ACTION_REMOVE_VIDEO', setVideoId: 'S1' }],
    params: 'CAFAAQ%3D%3D',
  });
});

test('each error type is raised by the matching fake response', async () => {
  const cases = [
    [{ status: 429, body: '{}' }, RateLimitedError],
    [{ status: 401, body: '{}' }, AuthError],
    [{ status: 403, body: '{}' }, AuthError],
    [{ status: 500, body: '{}' }, HttpError],
    [{ status: 200, body: '<html>not json</html>' }, HttpError],
    [{ status: 200, body: { status: 'FAILED_TRANSACTION' } }, EditRejectedError],
  ];
  for (const [scripted, errorType] of cases) {
    const deps = fakeDeps([scripted]);
    const call = errorType === EditRejectedError
      ? () => client(deps).editPlaylist([])
      : () => client(deps).browseWatchLater(null);
    await assert.rejects(call, errorType, JSON.stringify(scripted));
  }
});

test('an absent status in an edit response passes, as upstream allows', async () => {
  const deps = fakeDeps([{ status: 200, body: {} }]);
  const json = await client(deps).editPlaylist([]);
  assert.deepStrictEqual(json, {});
});

test('http errors carry status and response text', async () => {
  const deps = fakeDeps([{ status: 503, body: 'overloaded' }]);
  await assert.rejects(
    () => client(deps).browseWatchLater(null),
    (err) => err instanceof HttpError && err.status === 503 && err.responseText === 'overloaded',
  );
});

test('a missing authHeader in deps is a setup error, not a silent call', async () => {
  const deps = fakeDeps([]);
  delete deps.authHeader;
  assert.throws(() => client(deps), TypeError);
  const noNet = fakeDeps([]);
  delete noNet.net;
  assert.throws(() => client(noNet), TypeError);
});

test('the module reads nothing from window or document', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/core/innertube.js'), 'utf8');
  for (const global of ['window', 'document', 'location']) {
    assert.ok(!source.includes(global), `innertube.js references ${global}`);
  }
});
