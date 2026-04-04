#!/usr/bin/env node
// Patches dist/index.html to add viewport-fit=cover, needed for env(safe-area-inset-*)
// to work correctly in iOS Safari (mobile web PWA).
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../dist/index.html');
if (!fs.existsSync(file)) {
  console.error('dist/index.html not found — run expo export first');
  process.exit(1);
}

let html = fs.readFileSync(file, 'utf8');
const before = 'width=device-width, initial-scale=1, shrink-to-fit=no"';
const after  = 'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"';

if (html.includes(after)) {
  console.log('viewport-fit=cover already present, skipping.');
  process.exit(0);
}

if (!html.includes(before)) {
  console.error('Could not find viewport meta to patch.');
  process.exit(1);
}

html = html.replace(before, after);
fs.writeFileSync(file, html, 'utf8');
console.log('Patched dist/index.html with viewport-fit=cover');
