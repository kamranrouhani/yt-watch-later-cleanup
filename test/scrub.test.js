'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { scrubCapture, assertClean } = require('../tools/scrub.js');

const RAW = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/synthetic/raw-capture.json'), 'utf8'));

const PLANTED = [
  'Planted Person', 'PlantedPerson', 'planted.person', 'planted-avatar',
  'CgtQbGFudGVkVmlzaXRvcg', 'PlantedDatasync123', 'PlantedTracking', 'PlantedClick',
  'Secret Recipe Collection', 'Kitchen Planted', 'KitchenPlanted',
  'PlantVid001', 'PlantVid002', 'PlantVid003',
  'PLANTSETID000001', 'PLANTSETID000002', 'PLANTSETID000003', 'PLANTSETID000004',
  'UCplantedOwnerChannel0001', 'UCplantedKitchenChannel01', 'UCplantedAnnChannel000001',
  'PlantedContinuationToken2', 'UGxhbnRWaWQwMDE', 'CgtQbGFudFZpZDAwMQ',
  'sqp=planted',
];

function shape(value) {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).map((key) => [key, shape(value[key])]));
  }
  return typeof value === 'string' ? 'string' : value;
}

const out = scrubCapture(RAW);
const committed = { meta: out.meta, pages: out.pages, denylist: out.denylist };
const text = JSON.stringify(committed);

test('no planted personal value survives', () => {
  for (const value of PLANTED) {
    assert.ok(!text.includes(value), `${value} survived`);
  }
  assert.ok(!text.includes('@'), 'an @ survived');
});

test('structure, numbers and booleans are unchanged', () => {
  assert.strictEqual(out.pages.length, RAW.responses.length);
  RAW.responses.forEach(({ response }, i) => {
    assert.deepStrictEqual(shape(out.pages[i].response), shape(response));
  });
});

test('strings the parser reads and that are not personal are kept', () => {
  for (const kept of ['12:34', '[Private video]', '3 years ago', '1.2K views', 'ACTION_REMOVE_VIDEO',
    'CAFAAQ%3D%3D', 'SHORTS', '/shorts/', 'WL', 'Tomorrow, Annually']) {
    assert.ok(text.includes(kept), `${kept} was lost`);
  }
});

test('the same real value gets the same placeholder on every page', () => {
  const first = out.pages[0].response.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content
    .sectionListRenderer.contents[0].itemSectionRenderer.contents[0].playlistVideoListRenderer.contents[0]
    .playlistVideoRenderer;
  const again = out.pages[1].response.onResponseReceivedActions[0].appendContinuationItemsAction
    .continuationItems[0].playlistVideoRenderer;
  assert.strictEqual(again.videoId, first.videoId);
  assert.strictEqual(again.title.runs[0].text, first.title.runs[0].text);
  assert.strictEqual(first.setVideoId,
    first.menu.menuRenderer.items[0].menuServiceItemRenderer.serviceEndpoint.playlistEditEndpoint.actions[0].setVideoId);
  assert.notStrictEqual(again.setVideoId, first.setVideoId);
  const token = out.pages[0].response.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content
    .sectionListRenderer.contents[0].itemSectionRenderer.contents[0].playlistVideoListRenderer.contents[3]
    .continuationItemRenderer.continuationEndpoint.continuationCommand.token;
  assert.strictEqual(out.pages[1].continuation, token);
});

test('a title quoted inside another string is replaced with its placeholder', () => {
  const renderer = out.pages[0].response.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content
    .sectionListRenderer.contents[0].itemSectionRenderer.contents[0].playlistVideoListRenderer.contents[0]
    .playlistVideoRenderer;
  const title = renderer.title.runs[0].text;
  const channel = renderer.shortBylineText.runs[0].text;
  assert.strictEqual(renderer.title.accessibility.accessibilityData.label,
    `${title} by ${channel} 12 minutes, 34 seconds`);
  assert.match(renderer.navigationEndpoint.commandMetadata.webCommandMetadata.url,
    new RegExp(`^/watch\\?v=${renderer.videoId}&list=WL&index=1$`));
});

test('values shorter than four characters are replaced only where they are the whole string', () => {
  const short = out.pages[0].response.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content
    .sectionListRenderer.contents[0].itemSectionRenderer.contents[0].playlistVideoListRenderer.contents[2]
    .playlistVideoRenderer;
  assert.notStrictEqual(short.title.simpleText, 'Tom');
  assert.notStrictEqual(short.shortBylineText.runs[0].text, 'Ann');
  assert.strictEqual(short.publishedTimeText.simpleText, 'Tomorrow, Annually');
});

test('image urls become a placeholder', () => {
  assert.ok(!/ggpht\.com|ytimg\.com\/vi\//.test(text));
});

test('googlevideo playback urls never survive, they carry the ip address', () => {
  const scrubbed = scrubCapture(RAW);
  const text2 = JSON.stringify({ meta: scrubbed.meta, pages: scrubbed.pages });
  assert.ok(!text2.includes('googlevideo.com/initplayback'));
  assert.ok(text2.includes('https://googlevideo.com/placeholder'));
});

test('the denylist holds sha256 hashes of real values of four characters or more', () => {
  const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
  assert.ok(out.denylist.every((h) => /^[0-9a-f]{64}$/.test(h)));
  assert.ok(out.denylist.includes(sha('Secret Recipe Collection')));
  assert.ok(out.denylist.includes(sha('PlantVid001')));
  assert.ok(!out.denylist.includes(sha('Tom')));
});

test('a real channel whose name duplicates a placeholder number does not break the scrub', () => {
  assert.doesNotThrow(() => scrubCapture(RAW));
  const again = scrubCapture(RAW);
  const planted = again.pages[1].response.onResponseReceivedActions[0].appendContinuationItemsAction
    .continuationItems.find((item) => item.playlistVideoRenderer &&
      item.playlistVideoRenderer.videoId === 'vid00000004').playlistVideoRenderer;
  assert.notStrictEqual(planted.shortBylineText.runs[0].text, 'Channel 5');
});

test('assertClean refuses output that still holds a real value, without printing it', () => {
  assert.throws(
    () => assertClean({ a: ['x', 'still has Kitchen Planted in it'] }, ['Kitchen Planted']),
    (err) => /\$\.a\[1\]/.test(err.message) && !err.message.includes('Kitchen Planted'),
  );
  assert.throws(() => assertClean({ a: 'someone@example.org' }, []), /@/);
  assert.doesNotThrow(() => assertClean({ a: 'Channel 1' }, ['Kitchen Planted']));
});
