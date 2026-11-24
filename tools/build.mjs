// Copies the deployable app (sw.js + every APP_SHELL file) into dist/ and
// stamps sw.js with a content hash so each deploy gets a fresh offline cache.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROOT, readAppShell } from './app-shell.mjs';
import { cacheNameFor, hashFiles, stampCacheName } from './cache-version.mjs';

const DEFAULT_DIST = new URL('dist/', ROOT);

// Cloudflare static-asset headers: always revalidate so phones pick up new versions.
const HEADERS = `/*
  Cache-Control: no-cache
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
`;

const shellFiles = () => ['index.html', ...readAppShell().filter((f) => f !== './')]
  .map((f) => f.replace(/^\.\//, ''));

const copyInto = (dist, file) => {
  const target = new URL(file, dist);
  mkdirSync(new URL('./', target), { recursive: true });
  cpSync(new URL(file, ROOT), target);
};

export const build = (dist = DEFAULT_DIST) => {
  rmSync(dist, { recursive: true, force: true });
  const files = shellFiles();
  files.forEach((file) => copyInto(dist, file));

  const swSource = readFileSync(new URL('sw.js', ROOT), 'utf8');
  const hash = hashFiles([
    ...files.map((path) => ({ path, content: readFileSync(new URL(path, ROOT)) })),
    { path: 'sw.js', content: swSource },
  ]);
  writeFileSync(new URL('sw.js', dist), stampCacheName(swSource, hash));
  writeFileSync(new URL('_headers', dist), HEADERS);
  return { count: files.length + 1, cacheName: cacheNameFor(hash) };
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const { count, cacheName } = build();
    process.stdout.write(`Built dist/ with ${count} files (cache ${cacheName})\n`);
  } catch (error) {
    process.stderr.write(`Build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
