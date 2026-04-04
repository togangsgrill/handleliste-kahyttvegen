#!/usr/bin/env node
// Patches dist/index.html:
// 1. Adds viewport-fit=cover for iOS safe-area-inset support
// 2. Injects PWA meta tags for installable web app
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../dist/index.html');
if (!fs.existsSync(file)) {
  console.error('dist/index.html not found — run expo export first');
  process.exit(1);
}

let html = fs.readFileSync(file, 'utf8');

// 1. Patch viewport
const before = 'width=device-width, initial-scale=1, shrink-to-fit=no"';
const after  = 'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"';
if (!html.includes(after)) {
  if (!html.includes(before)) {
    console.error('Could not find viewport meta to patch.');
    process.exit(1);
  }
  html = html.replace(before, after);
  console.log('Patched viewport-fit=cover');
} else {
  console.log('viewport-fit=cover already present, skipping.');
}

// 2. Inject PWA meta tags if not already present
const pwaTags = `
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Handleliste" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#006947" />
    <link rel="apple-touch-icon" href="/assets/images/icon.png" />`;

if (!html.includes('apple-mobile-web-app-capable')) {
  html = html.replace('</head>', pwaTags + '\n  </head>');
  console.log('Injected PWA meta tags');
} else {
  console.log('PWA meta tags already present, skipping.');
}

fs.writeFileSync(file, html, 'utf8');

// 3. Copy icon to dist/ for PWA manifest and apple-touch-icon
const srcIcon = path.join(__dirname, '../assets/images/icon.png');
const distIconDir = path.join(__dirname, '../dist/assets/images');
const distIcon = path.join(distIconDir, 'icon.png');
if (!fs.existsSync(distIconDir)) {
  fs.mkdirSync(distIconDir, { recursive: true });
}
fs.copyFileSync(srcIcon, distIcon);
console.log('Copied icon.png to dist/assets/images/');

// 4. Write manifest.json if not present
const manifestPath = path.join(__dirname, '../dist/manifest.json');
if (!fs.existsSync(manifestPath)) {
  const manifest = {
    name: 'Handleliste - Kahyttvegen',
    short_name: 'Handleliste',
    description: 'Familiens handleliste',
    start_url: '/',
    display: 'standalone',
    background_color: '#d8fff0',
    theme_color: '#006947',
    orientation: 'portrait',
    icons: [
      { src: '/assets/images/icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'any maskable' }
    ]
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('Created manifest.json');
} else {
  console.log('manifest.json already exists, skipping.');
}

// 5. Add <link rel="manifest"> to dist/index.html if not present
let finalHtml = fs.readFileSync(file, 'utf8');
if (!finalHtml.includes('rel="manifest"')) {
  finalHtml = finalHtml.replace('</head>', '    <link rel="manifest" href="/manifest.json" />\n  </head>');
  fs.writeFileSync(file, finalHtml, 'utf8');
  console.log('Added <link rel="manifest"> to index.html');
}

console.log('Done.');
