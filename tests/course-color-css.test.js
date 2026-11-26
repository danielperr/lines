import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLOR_KEYS, PALETTE } from '../src/course/color.js';

// styles.css repeats the palette as [data-color] blocks; these tests keep
// the two in sync. Dark blocks come after the "course colors: dark" marker.
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const DARK_MARKER = '/* course colors: dark */';

const ROLE_VARS = { solid: '--course-solid', on: '--course-on', tint: '--course-tint', ink: '--course-ink' };

const colorRules = (text) => Object.fromEntries(
  [...text.matchAll(/\[data-color="([a-z]+)"\]\s*\{([^}]*)\}/g)].map(([, key, body]) => [
    key,
    Object.fromEntries([...body.matchAll(/(--course-[a-z]+):\s*(#[0-9a-f]{6})/g)].map(([, name, value]) => [name, value])),
  ]),
);

const [lightCss, darkCss = ''] = css.split(DARK_MARKER);
const light = colorRules(lightCss);
const dark = colorRules(darkCss);

const expected = (key, mode) => Object.fromEntries(
  Object.entries(ROLE_VARS).map(([role, name]) => [name, PALETTE[key][mode][role]]),
);

test('styles.css has a dark course-color section', () => {
  assert.ok(css.includes(DARK_MARKER));
});

test('every palette color has light and dark CSS blocks matching color.js', () => {
  for (const key of COLOR_KEYS) {
    assert.deepEqual(light[key], expected(key, 'light'), `${key} light`);
    assert.deepEqual(dark[key], expected(key, 'dark'), `${key} dark`);
  }
});

test('styles.css has no course colors that the palette lacks', () => {
  assert.deepEqual(Object.keys(light).sort(), [...COLOR_KEYS].sort());
  assert.deepEqual(Object.keys(dark).sort(), [...COLOR_KEYS].sort());
});
