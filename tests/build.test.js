import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hashFiles, stampCacheName } from '../tools/cache-version.mjs';
import { build } from '../tools/build.mjs';

const SW = "const CACHE_NAME = 'deadlines-shell-dev';\nconst X = 1;\n";

test('hash changes when any file content changes', () => {
  const a = hashFiles([{ path: 'a.js', content: 'one' }, { path: 'b.js', content: 'two' }]);
  const b = hashFiles([{ path: 'a.js', content: 'one' }, { path: 'b.js', content: 'TWO' }]);
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]{12}$/);
});

test('hash changes when a file is renamed, even with the same content', () => {
  const a = hashFiles([{ path: 'a.js', content: 'x' }]);
  const b = hashFiles([{ path: 'b.js', content: 'x' }]);
  assert.notEqual(a, b);
});

test('hash is stable for identical input', () => {
  const files = [{ path: 'a.js', content: 'x' }];
  assert.equal(hashFiles(files), hashFiles(files));
});

test('stampCacheName replaces the cache name and nothing else', () => {
  const stamped = stampCacheName(SW, 'abc123def456');
  assert.equal(stamped, "const CACHE_NAME = 'deadlines-shell-abc123def456';\nconst X = 1;\n");
});

test('stampCacheName fails loudly when sw.js has no CACHE_NAME', () => {
  assert.throws(() => stampCacheName('const Y = 1;', 'abc'), /CACHE_NAME/);
});

test('source sw.js uses the dev cache name so the build can stamp it', () => {
  const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(source, /const CACHE_NAME = 'deadlines-shell-dev';/);
});

test('build stamps a content hash into dist/sw.js', () => {
  const dir = mkdtempSync(join(tmpdir(), 'study-build-'));
  try {
    const { cacheName } = build(pathToFileURL(`${dir}/`));
    const built = readFileSync(join(dir, 'sw.js'), 'utf8');
    assert.match(cacheName, /^deadlines-shell-[0-9a-f]{12}$/);
    assert.ok(built.includes(`const CACHE_NAME = '${cacheName}';`));
    assert.ok(!built.includes('deadlines-shell-dev'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
