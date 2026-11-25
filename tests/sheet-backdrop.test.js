import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOutside } from '../src/sheet-backdrop.js';

const sheet = { left: 0, top: 300, right: 375, bottom: 812 };

test('a tap above the sheet is outside it', () => {
  assert.equal(isOutside(sheet, { x: 180, y: 120 }), true);
});

test('a tap on the sheet, including its edges, is inside it', () => {
  assert.equal(isOutside(sheet, { x: 180, y: 500 }), false);
  assert.equal(isOutside(sheet, { x: 0, y: 300 }), false);
  assert.equal(isOutside(sheet, { x: 375, y: 812 }), false);
});

test('beside a centered card is outside it', () => {
  const card = { left: 114, top: 200, right: 654, bottom: 800 };
  assert.equal(isOutside(card, { x: 40, y: 400 }), true);
  assert.equal(isOutside(card, { x: 700, y: 400 }), true);
});
