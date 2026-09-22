'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SUBSTRING_MIN_LENGTH = 4;
const ID_KEYS = { videoId: 'video', contentId: 'video', setVideoId: 'set', playlistSetVideoId: 'set' };
const TOKEN_KEYS = { visitorData: 'visitor', datasyncId: 'datasync', token: 'continuation', continuation: 'continuation' };
const TEXT_KEYS = { shortBylineText: 'channel', longBylineText: 'channel', ownerText: 'person' };
const TRACKING_KEYS = new Set(['trackingParams', 'clickTrackingParams', 'serviceTrackingParams', 'serializedShareEntity']);
const OPAQUE_KEYS = new Set(['params', 'playerParams']);
const IMAGE_HOST = /^(https?:)?\/\/[^/]*(ytimg\.com|ggpht\.com|googleusercontent\.com)\//;
const IMAGE_PLACEHOLDER = 'https://i.ytimg.com/placeholder.jpg';
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const HANDLE = /@[\w.-]+/g;
const NOT_PERSONAL = new Set(['WL', 'VLWL', '']);

const PLACEHOLDERS = {
  title: (n) => `Video title ${n}`,
  channel: (n) => `Channel ${n}`,
  person: (n) => `Account ${n}`,
  handle: (n) => `handle${n}`,
  email: (n) => `EMAIL_${n}`,
  video: (n) => `vid${String(n).padStart(8, '0')}`,
  set: (n) => `SET${String(n).padStart(13, '0')}`,
  channelId: (n) => `UCchannel${String(n).padStart(15, '0')}`,
  visitor: (n) => `VISITOR_DATA_${n}`,
  datasync: (n) => `DATASYNC_${n}`,
  continuation: (n) => `CONTINUATION_${n}`,
};

function textOf(value) {
  if (!value || typeof value !== 'object') return [];
  if (typeof value.simpleText === 'string') return [value.simpleText];
  if (typeof value.content === 'string') return [value.content];
  if (Array.isArray(value.runs)) return value.runs.map((run) => run?.text).filter((t) => typeof t === 'string');
  return [];
}

function walk(node, visit, key = null) {
  if (!node || typeof node !== 'object') return;
  visit(node, key);
  if (Array.isArray(node)) node.forEach((child) => walk(child, visit, key));
  else for (const [childKey, child] of Object.entries(node)) walk(child, visit, childKey);
}

function isUnavailableTitle(renderer, title) {
  const unplayable = textOf(renderer.unplayableText)[0];
  return title === unplayable || /^\[.*\]$/.test(title);
}

function collect(capture) {
  const found = [];
  const add = (kind, value) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (NOT_PERSONAL.has(trimmed)) return;
    found.push({ kind, value: trimmed });
  };

  walk(capture, (node) => {
    for (const [key, kind] of Object.entries(ID_KEYS)) add(kind, node[key]);
    for (const [key, kind] of Object.entries(TOKEN_KEYS)) {
      if (key === 'datasyncId' && typeof node[key] === 'string') {
        node[key].split('||').forEach((part) => add(kind, part));
      }
      add(kind, node[key]);
    }
    for (const key of ['browseId', 'channelId']) {
      if (typeof node[key] === 'string' && node[key].startsWith('UC')) add('channelId', node[key]);
    }
    if (typeof node.canonicalBaseUrl === 'string') {
      const handle = node.canonicalBaseUrl.match(/@[^/?#]+/);
      if (handle) {
        add('handle', handle[0]);
        add('handle', handle[0].slice(1));
      }
    }
    for (const [key, kind] of Object.entries(TEXT_KEYS)) textOf(node[key]).forEach((t) => add(kind, t));
    if (node.videoOwnerRenderer) textOf(node.videoOwnerRenderer.title).forEach((t) => add('person', t));
    if (node.playlistVideoRenderer) {
      const renderer = node.playlistVideoRenderer;
      textOf(renderer.title).filter((t) => !isUnavailableTitle(renderer, t)).forEach((t) => add('title', t));
    }
    if (node.lockupMetadataViewModel) textOf(node.lockupMetadataViewModel.title).forEach((t) => add('title', t));
  });

  walk(capture, (node) => {
    for (const value of Array.isArray(node) ? node : Object.values(node)) {
      if (typeof value !== 'string') continue;
      for (const email of value.match(EMAIL) || []) add('email', email);
      for (const handle of value.replace(EMAIL, '').match(HANDLE) || []) add('handle', handle);
    }
  });

  return found;
}

function buildMapping(found) {
  const counters = {};
  const byValue = new Map();
  const byKindAndBase = new Map();
  for (const { kind, value } of found) {
    if (byValue.has(value)) continue;
    const base = kind === 'handle' ? value.replace(/^@/, '') : value;
    const shared = byKindAndBase.get(`${kind}:${base}`);
    if (shared) {
      byValue.set(value, { kind, placeholder: shared });
      continue;
    }
    counters[kind] = (counters[kind] || 0) + 1;
    const placeholder = PLACEHOLDERS[kind](counters[kind]);
    byKindAndBase.set(`${kind}:${base}`, placeholder);
    byValue.set(value, { kind, placeholder });
  }
  return byValue;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeOpaque(value) {
  try {
    const b64 = decodeURIComponent(value).replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(b64, 'base64').toString('latin1');
  } catch {
    return '';
  }
}

function makeReplacer(mapping) {
  const long = [...mapping.keys()].filter((v) => v.length >= SUBSTRING_MIN_LENGTH).sort((a, b) => b.length - a.length);
  const pattern = long.length ? new RegExp(long.map(escapeRegExp).join('|'), 'g') : null;

  return function replace(value, key, inTracking) {
    if (inTracking) return 'TRACKING';
    if (OPAQUE_KEYS.has(key) && long.some((real) => decodeOpaque(value).includes(real))) return 'PARAMS';
    if (IMAGE_HOST.test(value)) return IMAGE_PLACEHOLDER;
    const exact = mapping.get(value.trim());
    if (exact) return exact.placeholder;
    let out = pattern ? value.replace(pattern, (real) => mapping.get(real).placeholder) : value;
    out = out.replace(EMAIL, 'EMAIL').replace(HANDLE, 'handle');
    return out;
  };
}

function transform(node, replace, key = null, inTracking = false) {
  if (typeof node === 'string') return replace(node, key, inTracking);
  if (Array.isArray(node)) return node.map((child) => transform(child, replace, key, inTracking));
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([childKey, child]) => [
      childKey,
      transform(child, replace, childKey, inTracking || TRACKING_KEYS.has(childKey)),
    ]));
  }
  return node;
}

function assertClean(json, realValues) {
  const long = realValues.filter((v) => v.length >= SUBSTRING_MIN_LENGTH);
  const short = new Set(realValues.filter((v) => v.length < SUBSTRING_MIN_LENGTH));
  const problems = [];
  (function check(node, at) {
    if (typeof node === 'string') {
      if (node.includes('@')) problems.push(`${at}: contains @`);
      if (short.has(node.trim()) || long.some((real) => node.includes(real))) problems.push(`${at}: holds a real value`);
      return;
    }
    if (Array.isArray(node)) node.forEach((child, i) => check(child, `${at}[${i}]`));
    else if (node && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) check(child, `${at}.${key}`);
    }
  })(json, '$');
  if (problems.length) {
    throw new Error(`scrub incomplete, ${problems.length} problem(s):\n${problems.slice(0, 50).join('\n')}`);
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function scrubCapture(capture) {
  const mapping = buildMapping(collect(capture));
  const scrubbed = transform(capture, makeReplacer(mapping));
  const realValues = [...mapping.keys()];
  assertClean(scrubbed, realValues);

  const { responses, ...meta } = scrubbed;
  return {
    meta,
    pages: responses,
    denylist: [...new Set(realValues.filter((v) => v.length >= SUBSTRING_MIN_LENGTH).map(sha256))].sort(),
    mapping: [...mapping].map(([real, { kind, placeholder }]) => ({ kind, real, placeholder })),
  };
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function main([rawFile, outDir]) {
  if (!rawFile || !outDir) {
    console.error('usage: node tools/scrub.js <raw-capture.json> <out-dir>');
    process.exit(2);
  }
  const result = scrubCapture(JSON.parse(fs.readFileSync(rawFile, 'utf8')));

  fs.mkdirSync(outDir, { recursive: true });
  writeJson(path.join(outDir, 'capture.json'), result.meta);
  result.pages.forEach((page, i) => writeJson(path.join(outDir, `page-${i + 1}.json`), page));

  const denylistFile = path.join(path.dirname(path.resolve(outDir)), 'denylist.sha256');
  const existing = fs.existsSync(denylistFile) ? fs.readFileSync(denylistFile, 'utf8').split('\n').filter(Boolean) : [];
  fs.writeFileSync(denylistFile, `${[...new Set([...existing, ...result.denylist])].sort().join('\n')}\n`);

  const mappingFile = rawFile.replace(/\.json$/, '.mapping.json');
  writeJson(mappingFile, result.mapping);

  const counts = {};
  for (const { kind } of result.mapping) counts[kind] = (counts[kind] || 0) + 1;
  console.log(`wrote ${result.pages.length} page(s) and capture.json to ${outDir}`);
  console.log(`replaced values by kind: ${JSON.stringify(counts)}`);
  console.log(`denylist now ${new Set([...existing, ...result.denylist]).size} hashes, mapping kept at ${mappingFile}`);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { scrubCapture, assertClean };
