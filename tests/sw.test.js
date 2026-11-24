import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { readAppShell } from '../tools/app-shell.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

const appShell = readAppShell;

test('every source module is available offline', () => {
  const shell = appShell();
  const modules = readdirSync(new URL('src/', ROOT)).filter((f) => f.endsWith('.js')).map((f) => `./src/${f}`);
  const missing = modules.filter((m) => !shell.includes(m));
  assert.deepEqual(missing, [], `add these to APP_SHELL in sw.js: ${missing.join(', ')}`);
});

test('every file the page and manifest reference is available offline', () => {
  const shell = appShell();
  const html = read('index.html');
  const fromHtml = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map((m) => `./${m[1]}`);
  const manifest = JSON.parse(read('manifest.webmanifest'));
  const fromManifest = manifest.icons.map((i) => `./${i.src}`);
  const missing = [...fromHtml, ...fromManifest].filter((f) => !shell.includes(f));
  assert.deepEqual(missing, [], `add these to APP_SHELL in sw.js: ${missing.join(', ')}`);
});

test('every offline file exists', () => {
  const missing = appShell().filter((f) => f !== './').filter((f) => {
    try { read(f); return false; } catch { return true; }
  });
  assert.deepEqual(missing, []);
});

test('pages are cached under ./ only, never under a path a host may redirect', () => {
  const shell = appShell();
  assert.ok(shell.includes('./'));
  assert.equal(shell.includes('./index.html'), false);
  assert.match(read('sw.js'), /request\.mode === 'navigate' \? '\.\/'/);
});
