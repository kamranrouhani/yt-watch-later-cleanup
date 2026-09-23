'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SHIPPED = ['background.js', 'manifest.json'];
const SHIPPED_DIRS = ['dashboard', 'src'];
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

function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(full);
    return entry.name.match(/\.(js|json|html|css)$/) ? [full] : [];
  });
}

function shippedFiles(root = ROOT) {
  const files = SHIPPED
    .map((f) => path.join(root, f))
    .filter((f) => fs.existsSync(f));
  for (const dir of SHIPPED_DIRS) {
    const full = path.join(root, dir);
    if (fs.existsSync(full)) files.push(...walkFiles(full));
  }
  return files.map((f) => ({ abs: f, rel: path.relative(root, f) }));
}

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
