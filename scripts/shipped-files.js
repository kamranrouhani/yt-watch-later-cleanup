'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const EXTRA_SHIPPED = ['manifest.json', 'background.js'];
const EXTRA_SHIPPED_DIRS = ['dashboard', 'src', 'content'];

function readManifest(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
}

function manifestPaths(manifest) {
  const paths = [];
  if (manifest.background?.service_worker) paths.push(manifest.background.service_worker);
  if (manifest.action?.default_popup) paths.push(manifest.action.default_popup);
  for (const icon of Object.values(manifest.icons || {})) paths.push(icon);
  for (const resource of manifest.web_accessible_resources || []) paths.push(resource);
  for (const script of manifest.content_scripts || []) {
    for (const file of script.js || []) paths.push(file);
    for (const file of script.css || []) paths.push(file);
  }
  return paths;
}

function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(full);
    return [full];
  });
}

function shippedFiles(root = ROOT) {
  const manifest = readManifest(root);
  const rels = new Set(EXTRA_SHIPPED);
  for (const rel of manifestPaths(manifest)) rels.add(rel);

  const files = [...rels]
    .map((rel) => path.join(root, rel))
    .filter((abs) => fs.existsSync(abs));

  for (const dir of EXTRA_SHIPPED_DIRS) {
    const full = path.join(root, dir);
    if (fs.existsSync(full)) files.push(...walkFiles(full));
  }

  const seen = new Set();
  const result = [];
  for (const abs of files) {
    const rel = path.relative(root, abs);
    if (seen.has(rel)) continue;
    seen.add(rel);
    result.push({ abs, rel });
  }
  return result;
}

module.exports = { shippedFiles, manifestPaths, readManifest };
