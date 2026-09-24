'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { parsePage, parseDurationSeconds, extractEntriesAndContinuation } = require('../src/core/playlistParser.js');
const { evaluate } = require('../src/core/rules.js');

const CAPTURED = path.join(__dirname, 'fixtures', 'captured', '2026-09-24');
const pages = [1, 2, 3].map((n) =>
  JSON.parse(fs.readFileSync(path.join(CAPTURED, `page-${n}.json`), 'utf8'))
);
const synthetic = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'synthetic', 'raw-capture.json'), 'utf8')
);

function syntheticPages() {
  return synthetic.responses.map((r) => r.response);
}

function itemAt(pageJson, index) {
  const found = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (node.playlistVideoRenderer) found.push(node.playlistVideoRenderer);
    for (const value of Object.values(node)) walk(value);
  })(pageJson);
  return found[index];
}

// Safety first: written before any parser code exists, per LOOP.md step 5.

test('safety: a channelId the parser could not find never matches a channel remove rule', () => {
  const page = parsePage(pages[1]);
  const blind = page.entries.find((e) => e.videoId === 'vid00000103');
  assert.ok(blind, 'fixture item with a byline but no browseId is parsed');
  assert.strictEqual(blind.channelName, 'Channel 70');
  assert.strictEqual(blind.channelId, null);

  const { remove } = evaluate(
    { version: 1, remove: [{ conditions: [{ field: 'channelId', operator: 'in', value: ['UCchannel000000000000071'] }] }], protect: [] },
    [blind]
  );
  assert.strictEqual(remove.length, 0);
});

test('safety: an unparseable duration reads null and never matches a duration rule', () => {
  assert.strictEqual(parseDurationSeconds('not a clock'), null);
  assert.strictEqual(parseDurationSeconds(''), null);
  const entry = { durationSeconds: parseDurationSeconds('garbage') };
  const { remove, skippedMissingData } = evaluate(
    { version: 1, remove: [{ conditions: [{ field: 'durationSeconds', operator: '<', value: 60 }] }], protect: [] },
    [entry]
  );
  assert.strictEqual(remove.length, 0);
  assert.strictEqual(skippedMissingData, 1);
});

test('safety: an unparseable duration never matches in the other direction either', () => {
  const entry = { durationSeconds: null };
  const { remove } = evaluate(
    { version: 1, remove: [{ conditions: [{ field: 'durationSeconds', operator: '>=', value: 30 }] }], protect: [] },
    [entry]
  );
  assert.strictEqual(remove.length, 0);
});

// Acceptance box 1: every captured fixture parses clean.

test('each captured page parses with zero thrown errors, zero dropped items, 100 entries', () => {
  for (const [index, json] of pages.entries()) {
    const parsed = parsePage(json);
    assert.strictEqual(parsed.droppedItems, 0, `page-${index + 1} drops`);
    assert.strictEqual(parsed.entries.length, 100, `page-${index + 1} count`);
    assert.ok(parsed.entries.every((e) => typeof e.setVideoId === 'string' && e.setVideoId.length > 0));
  }
});

test('the synthetic fixture parses with zero dropped items and deduplicates the planted repeats', () => {
  for (const json of syntheticPages()) {
    const parsed = parsePage(json);
    assert.strictEqual(parsed.droppedItems, 0);
  }
  const all = syntheticPages().flatMap((json) => parsePage(json).entries);
  assert.deepStrictEqual(
    all.filter((e) => e.videoId === 'PlantVid001').map((e) => e.setVideoId),
    ['PLANTSETID000001', 'PLANTSETID000004'],
    'same videoId under different playlists stays, shared setVideoId collapses'
  );
});

// Acceptance box 2: watched, partial, unwatched, unavailable, short.

test('a watched item from the real capture, field by field', () => {
  const parsed = parsePage(pages[0]);
  const entry = parsed.entries.find((e) => e.videoId === 'vid00000005');
  assert.strictEqual(entry.setVideoId.length > 0, true);
  assert.strictEqual(entry.title, 'Video title 5');
  assert.strictEqual(entry.channelName, 'Channel 5');
  assert.strictEqual(entry.channelId, 'UCchannel000000000000005');
  assert.strictEqual(entry.durationSeconds, 524);
  assert.strictEqual(entry.watchedPercent, 100);
  assert.strictEqual(entry.playable, true);
  assert.strictEqual(entry.unavailableReason, null);
  assert.strictEqual(entry.publishedText, null);
  assert.strictEqual(entry.isShort, false);
  assert.strictEqual(entry.isLive, false);
});

test('a partially watched item from the real capture, field by field', () => {
  const parsed = parsePage(pages[0]);
  const entry = parsed.entries.find((e) => e.videoId === 'vid00000007');
  assert.strictEqual(entry.title, 'Video title 7');
  assert.strictEqual(entry.channelName, 'Channel 7');
  assert.strictEqual(entry.channelId, 'UCchannel000000000000007');
  assert.strictEqual(entry.durationSeconds, 1539);
  assert.strictEqual(entry.watchedPercent, 33);
  assert.strictEqual(entry.playable, true);
  assert.strictEqual(entry.isShort, false);
});

test('an unwatched item from the real capture, field by field', () => {
  const parsed = parsePage(pages[0]);
  const entry = parsed.entries.find((e) => e.videoId === 'vid00000001');
  assert.strictEqual(entry.title, 'Video title 1');
  assert.strictEqual(entry.channelName, 'Channel 1');
  assert.strictEqual(entry.channelId, 'UCchannel000000000000001');
  assert.strictEqual(entry.durationSeconds, 323);
  assert.strictEqual(entry.watchedPercent, 0);
  assert.strictEqual(entry.playable, true);
  assert.strictEqual(entry.isShort, false);
  assert.strictEqual(entry.isLive, false);
});

test('an unavailable item from the synthetic fixture, field by field', () => {
  const [firstPage] = syntheticPages();
  const parsed = parsePage(firstPage);
  const entry = parsed.entries.find((e) => e.videoId === 'PlantVid002');
  assert.ok(entry, 'unavailable item parsed');
  assert.strictEqual(entry.title, '[Private video]');
  assert.strictEqual(entry.setVideoId, 'PLANTSETID000002');
  assert.strictEqual(entry.playable, false);
  assert.strictEqual(entry.unavailableReason, '[Private video]');
  assert.strictEqual(entry.durationSeconds, null);
  assert.strictEqual(entry.watchedPercent, 0);
  assert.strictEqual(entry.isShort, false);
  assert.strictEqual(entry.isLive, false);
});

test('a Short from the synthetic fixture, field by field', () => {
  const [firstPage] = syntheticPages();
  const parsed = parsePage(firstPage);
  const entry = parsed.entries.find((e) => e.videoId === 'PlantVid003');
  assert.ok(entry, 'short parsed');
  assert.strictEqual(entry.title, 'Tom');
  assert.strictEqual(entry.setVideoId, 'PLANTSETID000003');
  assert.strictEqual(entry.playable, true);
  assert.strictEqual(entry.channelName, 'Ann');
  assert.strictEqual(entry.channelId, 'UCplantedAnnChannel000001');
  assert.strictEqual(entry.watchedPercent, 37);
  assert.strictEqual(entry.durationSeconds, null);
  assert.strictEqual(entry.isShort, true);
  assert.strictEqual(entry.isLive, false);
  assert.strictEqual(entry.publishedText, 'Tomorrow, Annually');
});

test('the item with no byline gets an unknown channel both ways', () => {
  const parsed = parsePage(pages[2]);
  const entry = parsed.entries.find((e) => e.videoId === 'vid00000298');
  assert.ok(entry, 'no-byline item parsed');
  assert.strictEqual(entry.channelName, null);
  assert.strictEqual(entry.channelId, null);
});

// Acceptance box 3: duration parsing.

test('durationSeconds handles h:mm:ss, m:ss, 0:59 and missing', () => {
  assert.strictEqual(parseDurationSeconds('1:02:03'), 3723);
  assert.strictEqual(parseDurationSeconds('12:34'), 754);
  assert.strictEqual(parseDurationSeconds('0:59'), 59);
  assert.strictEqual(parseDurationSeconds('1:38:12'), 5892);
  assert.strictEqual(parseDurationSeconds(null), null);
  assert.strictEqual(parseDurationSeconds(undefined), null);
});

test('a real h:mm:ss item carries the parsed duration', () => {
  const parsed = parsePage(pages[2]);
  const entry = parsed.entries.find((e) => e.videoId === 'vid00000230');
  assert.strictEqual(entry.durationSeconds, 3782);
});

test('no captured item ever ends up with a fabricated non-null duration the fixture contradicts', () => {
  for (const [index, json] of pages.entries()) {
    const { entries } = parsePage(json);
    for (const entry of entries) {
      if (entry.durationSeconds === null) continue;
      assert.ok(Number.isInteger(entry.durationSeconds) && entry.durationSeconds > 0,
        `page-${index + 1} produced ${entry.durationSeconds}`);
    }
  }
});

// Acceptance box 4: continuation tokens.

test('the first page yields its continuation token', () => {
  const parsed = parsePage(pages[0]);
  assert.strictEqual(parsed.continuationToken, 'CONTINUATION_1');
});

test('a continuation page yields its token', () => {
  assert.strictEqual(parsePage(pages[1]).continuationToken, 'CONTINUATION_2');
  assert.strictEqual(parsePage(pages[2]).continuationToken, 'CONTINUATION_3');
});

test('the synthetic first page yields its planted continuation token', () => {
  const [firstPage] = syntheticPages();
  assert.strictEqual(parsePage(firstPage).continuationToken, '4qmFsgPlantedContinuationToken2');
});

// Drop and dedupe behaviour the issue calls out.

test('an item with no setVideoId anywhere is dropped and counted, never guessed', () => {
  const fixture = {
    contents: {
      playlistVideoListRenderer: {
        contents: [
          {
            playlistVideoRenderer: {
              videoId: 'hasId',
              title: { simpleText: 'Has' },
              menu: {
                menuRenderer: {
                  items: [{
                    menuServiceItemRenderer: {
                      serviceEndpoint: {
                        playlistEditEndpoint: {
                          actions: [{ action: 'ACTION_REMOVE_VIDEO', setVideoId: 'SET1' }],
                        },
                      },
                    },
                  }],
                },
              },
            },
          },
          { playlistVideoRenderer: { videoId: 'orphan', title: { simpleText: 'Orphan' } } },
        ],
      },
    },
  };
  const parsed = parsePage(fixture);
  assert.strictEqual(parsed.entries.length, 1);
  assert.strictEqual(parsed.entries[0].setVideoId, 'SET1');
  assert.strictEqual(parsed.droppedItems, 1);
});

test('a renderer with no setVideoId and no menu is still dropped, not defaulted', () => {
  const fixture = {
    contents: {
      playlistVideoListRenderer: {
        contents: [{ playlistVideoRenderer: { videoId: 'x', title: { simpleText: 'X' } } }],
      },
    },
  };
  const parsed = parsePage(fixture);
  assert.deepStrictEqual(parsed.entries, []);
  assert.strictEqual(parsed.droppedItems, 1);
});

test('a duplicated setVideoId within one page yields one entry', () => {
  const render = (id) => ({
    playlistVideoRenderer: {
      videoId: 'dup',
      title: { simpleText: 'Dup' },
      menu: {
        menuRenderer: {
          items: [{
            menuServiceItemRenderer: {
              serviceEndpoint: {
                playlistEditEndpoint: {
                  actions: [{ action: 'ACTION_REMOVE_VIDEO', setVideoId: id }],
                },
              },
            },
          }],
        },
      },
    },
  });
  const parsed = parsePage({ contents: { playlistVideoListRenderer: { contents: [render('SAME'), render('SAME')] } } });
  assert.strictEqual(parsed.entries.length, 1);
  assert.strictEqual(parsed.droppedItems, 0);
});

test('watchedPercent is clamped to 0..100', () => {
  const fixture = (pct) => ({
    contents: {
      playlistVideoListRenderer: {
        contents: [{
          playlistVideoRenderer: {
            videoId: 'v', title: { simpleText: 'T' }, setVideoId: 'S',
            thumbnailOverlays: [{ thumbnailOverlayResumePlaybackRenderer: { percentDurationWatched: pct } }],
          },
        }],
      },
    },
  });
  assert.strictEqual(parsePage(fixture(150)).entries[0].watchedPercent, 100);
  assert.strictEqual(parsePage(fixture(-5)).entries[0].watchedPercent, 0);
  assert.strictEqual(parsePage(fixture('37')).entries[0].watchedPercent, 37);
  assert.strictEqual(parsePage(fixture(null)).entries[0].watchedPercent, 0);
});

test('the port export keeps upstream behaviour: same tokens, same set', () => {
  for (const [index, json] of pages.entries()) {
    const { entries, continuationTokens } = extractEntriesAndContinuation(json);
    const parsed = parsePage(json);
    assert.strictEqual(continuationTokens[0], parsed.continuationToken, `page-${index + 1}`);
    assert.strictEqual(entries.length, parsed.entries.length, `page-${index + 1}`);
    const upIds = new Set(entries.map((e) => e.setVideoId));
    const parsedIds = new Set(parsed.entries.map((e) => e.setVideoId));
    assert.deepStrictEqual([...upIds].sort(), [...parsedIds].sort(), `page-${index + 1}`);
  }
});

test('the port keeps upstream field names so the port commit can be diffed against upstream', () => {
  const [firstPage] = syntheticPages();
  const { entries } = extractEntriesAndContinuation(firstPage);
  const port = entries.find((e) => e.setVideoId === 'PLANTSETID000002');
  assert.ok('isPlayable' in port);
  assert.ok('lengthText' in port);
  assert.ok('publishedTimeText' in port);
  assert.strictEqual(port.isPlayable, false);
  assert.strictEqual(port.unavailableReason, '[Private video]');
  assert.ok('isPlayable' in port);
});

test('parsePage tolerates garbage input without throwing', () => {
  assert.deepStrictEqual(parsePage(null), { entries: [], continuationToken: null, droppedItems: 0 });
  assert.deepStrictEqual(parsePage(42), { entries: [], continuationToken: null, droppedItems: 0 });
  assert.deepStrictEqual(parsePage({}), { entries: [], continuationToken: null, droppedItems: 0 });
});
