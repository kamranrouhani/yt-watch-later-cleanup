'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildDist } = require('../scripts/build.js');

const FORBIDDEN = ['node_modules', 'test', 'tasks', 'reference'];

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, base);
    return [path.relative(base, full)];
  });
}

test('the build copies only shipped files, no dev directories', () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-dist-'));
  const rels = buildDist(path.join(__dirname, '..'), distDir);
  assert.ok(rels.length > 0, 'build produced no files');
  for (const rel of rels) {
    const top = rel.split(path.sep)[0];
    assert.ok(!FORBIDDEN.includes(top), `${rel} should not be shipped`);
  }
  assert.ok(rels.includes('manifest.json'));
  assert.ok(rels.includes('background.js'));
  fs.rmSync(distDir, { recursive: true, force: true });
});

test('a build directory containing a forbidden directory is caught', () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-dist-'));
  fs.mkdirSync(path.join(distDir, 'node_modules', 'playwright'), { recursive: true });
  fs.writeFileSync(path.join(distDir, 'node_modules', 'playwright', 'index.js'), '');
  fs.mkdirSync(path.join(distDir, 'tasks', '0024-shipped-build'), { recursive: true });
  fs.writeFileSync(path.join(distDir, 'tasks', '0024-shipped-build', 'notes.md'), '');
  const rels = walk(distDir);
  const violations = rels.filter((rel) => FORBIDDEN.includes(rel.split(path.sep)[0]));
  assert.deepStrictEqual(violations.sort(), [
    path.join('node_modules', 'playwright', 'index.js'),
    path.join('tasks', '0024-shipped-build', 'notes.md'),
  ].sort());
  fs.rmSync(distDir, { recursive: true, force: true });
});
