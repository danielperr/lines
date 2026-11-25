import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLOR_KEYS, PALETTE, assignColor, colorsById, courseColor, isColorKey, nextColor,
} from '../src/course/color.js';

// WCAG 2.x relative luminance and contrast ratio.
const channel = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const course = (id, color) => ({ id, name: id, schedule: null, watched: 0, milestones: [], ...(color ? { color } : {}) });

test('the palette has eight distinct keys, each with light and dark values', () => {
  assert.equal(COLOR_KEYS.length, 8);
  assert.equal(new Set(COLOR_KEYS).size, 8);
  assert.deepEqual(Object.keys(PALETTE), [...COLOR_KEYS]);
  const hex = /^#[0-9a-f]{6}$/;
  for (const key of COLOR_KEYS) {
    for (const mode of ['light', 'dark']) {
      for (const role of ['solid', 'on', 'tint', 'ink']) {
        assert.match(PALETTE[key][mode][role], hex, `${key}.${mode}.${role}`);
      }
    }
  }
});

test('the palette cannot be changed at run time', () => {
  assert.ok(Object.isFrozen(COLOR_KEYS));
  assert.ok(Object.isFrozen(PALETTE));
  assert.ok(Object.isFrozen(PALETTE.violet.light));
});

test('text on every course color meets 4.5:1 contrast in both modes', () => {
  for (const key of COLOR_KEYS) {
    for (const mode of ['light', 'dark']) {
      const { solid, on, tint, ink } = PALETTE[key][mode];
      const onSolid = contrast(solid, on);
      const onTint = contrast(tint, ink);
      assert.ok(onSolid >= 4.5, `${key} ${mode}: text on solid is ${onSolid.toFixed(2)}:1`);
      assert.ok(onTint >= 4.5, `${key} ${mode}: text on tint is ${onTint.toFixed(2)}:1`);
    }
  }
});

test('isColorKey accepts palette keys only', () => {
  assert.ok(isColorKey('violet'));
  assert.ok(!isColorKey('Violet'));
  assert.ok(!isColorKey('#6c4ce0'));
  assert.ok(!isColorKey(undefined));
  assert.ok(!isColorKey('toString'));
});

test('courseColor uses the stored color when it is valid', () => {
  assert.equal(courseColor(course('a', 'teal'), 0), 'teal');
});

test('courseColor falls back to the palette by position, wrapping around', () => {
  assert.equal(courseColor(course('a'), 0), COLOR_KEYS[0]);
  assert.equal(courseColor(course('a'), 3), COLOR_KEYS[3]);
  assert.equal(courseColor(course('a'), 8), COLOR_KEYS[0]);
  assert.equal(courseColor(course('a', 'plaid'), 1), COLOR_KEYS[1]);
});

test('nextColor picks the first unused color', () => {
  assert.equal(nextColor([]), COLOR_KEYS[0]);
  assert.equal(nextColor([course('a', COLOR_KEYS[0]), course('b', COLOR_KEYS[2])]), COLOR_KEYS[1]);
});

test('nextColor counts fallback colors of courses without one', () => {
  assert.equal(nextColor([course('a'), course('b')]), COLOR_KEYS[2]);
});

test('nextColor picks the least-used color once all are taken', () => {
  const courses = [...COLOR_KEYS, COLOR_KEYS[0], COLOR_KEYS[1]].map((key, i) => course(`c${i}`, key));
  assert.equal(nextColor(courses), COLOR_KEYS[2]);
});

test('assignColor keeps a valid color and replaces a missing or unknown one', () => {
  const others = [course('a', COLOR_KEYS[0])];
  assert.equal(assignColor(course('n', 'pink'), others).color, 'pink');
  assert.equal(assignColor(course('n'), others).color, COLOR_KEYS[1]);
  assert.equal(assignColor(course('n', 'plaid'), others).color, COLOR_KEYS[1]);
});

test('assignColor does not change the course it gets', () => {
  const original = course('n');
  const result = assignColor(original, []);
  assert.notEqual(result, original);
  assert.equal(original.color, undefined);
});

test('colorsById resolves every course color by its stored position', () => {
  const map = colorsById([course('a'), course('b', 'pink'), course('c')]);
  assert.deepEqual([...map], [['a', COLOR_KEYS[0]], ['b', 'pink'], ['c', COLOR_KEYS[2]]]);
});

// Course-colored text (steppers, add buttons, milestone titles) also sits on the
// sheet backgrounds: --sheet-group and --sheet-bg in styles.css.
const SHEET_BACKGROUNDS = Object.freeze({ light: ['#ffffff', '#f6f5f2'], dark: ['#232227', '#161518'] });

test('course ink text meets 4.5:1 on the sheet backgrounds in both modes', () => {
  for (const key of COLOR_KEYS) {
    for (const mode of ['light', 'dark']) {
      for (const bg of SHEET_BACKGROUNDS[mode]) {
        const ratio = contrast(PALETTE[key][mode].ink, bg);
        assert.ok(ratio >= 4.5, `${key} ${mode}: ink on ${bg} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
});
