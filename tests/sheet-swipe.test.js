import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dragOffset, gestureIntent, shouldClose } from '../src/sheet-swipe.js';

test('the sheet follows the finger down but never up', () => {
  assert.equal(dragOffset(120), 120);
  assert.equal(dragOffset(0), 0);
  assert.equal(dragOffset(-40), 0);
});

test('a long enough drag closes the sheet', () => {
  assert.equal(shouldClose({ dy: 160, ms: 900, height: 700 }), true);
  assert.equal(shouldClose({ dy: 100, ms: 900, height: 700 }), false);
});

test('on a short sheet a quarter of its height is enough', () => {
  assert.equal(shouldClose({ dy: 90, ms: 900, height: 320 }), true);
});

test('a quick flick closes the sheet even when short', () => {
  assert.equal(shouldClose({ dy: 60, ms: 80, height: 700 }), true);
});

test('a tiny jitter never closes the sheet, however fast', () => {
  assert.equal(shouldClose({ dy: 12, ms: 5, height: 700 }), false);
});

test('a downward move at the top of the sheet starts a drag', () => {
  assert.equal(gestureIntent({ dx: 2, dy: 14, atTop: true, onHeader: false }), 'drag');
});

test('the header can always be dragged, even when the sheet is scrolled', () => {
  assert.equal(gestureIntent({ dx: 0, dy: 14, atTop: false, onHeader: true }), 'drag');
});

test('a scrolled sheet scrolls instead of dragging', () => {
  assert.equal(gestureIntent({ dx: 0, dy: 14, atTop: false, onHeader: false }), 'scroll');
});

test('upward and sideways moves scroll, and tiny moves wait', () => {
  assert.equal(gestureIntent({ dx: 0, dy: -14, atTop: true, onHeader: true }), 'scroll');
  assert.equal(gestureIntent({ dx: 20, dy: 12, atTop: true, onHeader: true }), 'scroll');
  assert.equal(gestureIntent({ dx: 1, dy: 3, atTop: true, onHeader: true }), 'wait');
});
