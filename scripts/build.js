'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { shippedFiles } = require('./shipped-files.js');

const ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');

function buildDist(root = ROOT, distDir = DIST_DIR) {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
  const files = shippedFiles(root);
  for (const { abs, rel } of files) {
    const dest = path.join(distDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(abs, dest);
  }
  return files.map((f) => f.rel);
}

function build() {
  const rels = buildDist();
  console.log(`built ${rels.length} files into ${path.relative(ROOT, DIST_DIR)}`);
}

module.exports = { buildDist };

if (require.main === module) build();
