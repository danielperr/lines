import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Guards against stylesheet edits that drop rules by accident (a bad cut once
// removed the sheet bar and its buttons). Every class the markup or the views
// use must be styled somewhere, unless it is only a hook for scripts.

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');
const STYLESHEETS = ['styles.css', 'motion.css'];

// Classes used only as script or structure hooks; they need no rule of their own.
const HOOKS = new Set([
  'sheet', 'wizard', 'breaks-list', 'extras-list', 'wizard-deadlines', 'wizard-summary', 'break-row',
  'timeline', 'summary-text', 'courses-section', 'minus', 'wizard-deadline-title',
]);

const css = STYLESHEETS.map(read).join('\n');

const usedClasses = () => {
  const html = [...read('index.html').matchAll(/class="([^"]+)"/g)].map((m) => m[1]);
  const sources = readdirSync(new URL('src/', ROOT)).filter((f) => f.endsWith('.js')).map((f) => read(`src/${f}`));
  const literals = sources.flatMap((src) => [...src.matchAll(/class: '([^'$]+)'/g)].map((m) => m[1]));
  return [...new Set([...html, ...literals].flatMap((list) => list.split(/\s+/)))];
};

const isStyled = (name) => new RegExp(`\\.${name.replace(/[-]/g, '\\-')}(?![\\w-])`).test(css);

test('every stylesheet is linked from index.html and cached for offline use', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  for (const file of STYLESHEETS) {
    assert.ok(html.includes(`href="${file}"`), `${file} is not linked`);
    assert.ok(sw.includes(`'./${file}'`), `${file} is not in the offline list`);
  }
});

test('every stylesheet has balanced braces', () => {
  for (const file of STYLESHEETS) {
    const text = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    const opens = (text.match(/{/g) ?? []).length;
    const closes = (text.match(/}/g) ?? []).length;
    assert.equal(opens, closes, `${file}: ${opens} { vs ${closes} }`);
  }
});

test('every class used in the markup and views is styled, or listed as a hook', () => {
  const missing = usedClasses().filter((name) => !HOOKS.has(name) && !isStyled(name));
  assert.deepEqual(missing, []);
});

test('the hook list has no stale entries', () => {
  const used = new Set(usedClasses());
  assert.deepEqual([...HOOKS].filter((name) => !used.has(name) || isStyled(name)), []);
});
