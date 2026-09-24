'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { shippedFiles } = require('../../scripts/shipped-files.js');

const ROOT = path.join(__dirname, '..', '..');
const NET_MODULE = 'src/core/net.js';
const ALLOWED_ORIGINS = new Set(['https://www.youtube.com', 'https://www.googleapis.com']);

const CALL_PATTERNS = [
  [/(?<![.\w])fetch\(/, 'fetch('],
  [/XMLHttpRequest/, 'XMLHttpRequest'],
  [/sendBeacon/, 'sendBeacon'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/\bEventSource\b/, 'EventSource'],
  [/\bimport\(/, 'dynamic import('],
  [/new Worker\(/, 'new Worker('],
];
const ORIGIN_PATTERN = /https?:\/\/[^/"'\s)>]+/g;

function disallowedOrigins(text) {
  const origins = new Set();
  for (const match of text.matchAll(ORIGIN_PATTERN)) {
    const origin = new URL(match[0]).origin;
    if (!ALLOWED_ORIGINS.has(origin)) origins.add(origin);
  }
  return [...origins];
}

function findViolations(root = ROOT) {
  const violations = [];
  for (const { abs, rel } of shippedFiles(root)) {
    if (!rel.match(/\.(js|json|html|css)$/)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    const isNet = rel === NET_MODULE || rel.split(path.sep).join('/') === NET_MODULE;
    for (const [pattern, label] of CALL_PATTERNS) {
      if (!isNet && pattern.test(text)) violations.push(`${rel}: ${label}`);
    }
    for (const origin of disallowedOrigins(text)) {
      violations.push(`${rel}: origin ${origin}`);
    }
  }
  return violations;
}

module.exports = { findViolations, shippedFiles };

if (require.main === module) {
  require('node:test').run().catch(() => {});
}
