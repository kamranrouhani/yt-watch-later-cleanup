'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MAX_WINDOW = 300;
const WORD_CHAR = /[\p{L}\p{N}]/u;

function jsonFiles(dir, root = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'raw' ? [] : jsonFiles(full, root);
    return entry.name.endsWith('.json') ? [path.relative(root, full)] : [];
  });
}

function boundaries(text) {
  const chars = [...text];
  const cuts = [];
  let offset = 0;
  for (let i = 0; i <= chars.length; i += 1) {
    const inWord = i > 0 && i < chars.length && WORD_CHAR.test(chars[i - 1]) && WORD_CHAR.test(chars[i]);
    if (!inWord) cuts.push(offset);
    if (i < chars.length) offset += chars[i].length;
  }
  return cuts;
}

function containsDenylisted(text, denylist) {
  const cuts = boundaries(text);
  for (let a = 0; a < cuts.length; a += 1) {
    for (let b = a + 1; b < cuts.length && cuts[b] - cuts[a] <= MAX_WINDOW; b += 1) {
      const hash = crypto.createHash('sha256').update(text.slice(cuts[a], cuts[b])).digest('hex');
      if (denylist.has(hash)) return true;
    }
  }
  return false;
}

function loadDenylist(root) {
  const file = path.join(root, 'denylist.sha256');
  if (!fs.existsSync(file)) return new Set();
  return new Set(fs.readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean));
}

function findLeaks(root) {
  const denylist = loadDenylist(root);
  const leaks = [];
  for (const file of jsonFiles(root)) {
    const json = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    (function check(node, at) {
      if (typeof node === 'string') {
        if (node.includes('@')) leaks.push(`${file} ${at}: contains @`);
        else if (/sapisid/i.test(node)) leaks.push(`${file} ${at}: contains SAPISID`);
        else if (containsDenylisted(node, denylist)) leaks.push(`${file} ${at}: matches the denylist`);
        return;
      }
      if (Array.isArray(node)) node.forEach((child, i) => check(child, `${at}[${i}]`));
      else if (node && typeof node === 'object') {
        for (const [key, child] of Object.entries(node)) {
          if (/sapisid/i.test(key)) leaks.push(`${file} ${at}.${key}: contains SAPISID`);
          check(child, `${at}.${key}`);
        }
      }
    })(json, '$');
  }
  return leaks;
}

module.exports = { findLeaks };
