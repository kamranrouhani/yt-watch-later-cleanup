'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'reference', 'tasks']);

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

let failed = 0;
for (const file of jsFiles(ROOT)) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed += 1;
    console.error(`SYNTAX FAIL: ${path.relative(ROOT, file)}`);
    console.error(err.stderr.toString());
  }
}

for (const file of ['manifest.json', 'package.json']) {
  try {
    JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  } catch (err) {
    failed += 1;
    console.error(`JSON FAIL: ${file}: ${err.message}`);
  }
}

if (failed) process.exit(1);
console.log('all files parse');
