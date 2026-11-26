import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SWIPE, dragOffset, gestureIntent, releaseVelocity, shouldClose } from '../src/sheet-swipe.js';
import { CLOSE_MS, closeDuration } from '../src/sheet-motion.js';

test('the sheet follows the finger down but never up', () => {
  assert.equal(dragOffset(120), 120);
  assert.equal(dragOffset(0), 0);
  assert.equal(dragOffset(-40), 0);
});

const H = 700;

test('letting go slowly near the top springs back, even past the old threshold', () => {
  assert.equal(shouldClose({ dy: 160, velocity: 0, height: H }), false);
  assert.equal(shouldClose({ dy: 300, velocity: 0.1, height: H }), false);
});

test('dragging most of the way down and letting go closes', () => {
  assert.equal(shouldClose({ dy: H * SWIPE.closeFraction, velocity: 0, height: H }), true);
});

test('a flick down closes, even when short', () => {
  assert.equal(shouldClose({ dy: 60, velocity: 0.9, height: H }), true);
});

test('a tiny jitter never closes the sheet, however fast', () => {
  assert.equal(shouldClose({ dy: 12, velocity: 3, height: H }), false);
});

test('throwing the sheet back up keeps it open, however far it was dragged', () => {
  assert.equal(shouldClose({ dy: H * 0.9, velocity: -0.8, height: H }), false);
});

test('the thresholds can be tuned', () => {
  const loose = { ...SWIPE, closeFraction: 0.2 };
  assert.equal(shouldClose({ dy: 160, velocity: 0, height: H }, loose), true);
});

test('release speed comes from the last stretch of the drag', () => {
  const samples = [{ y: 0, t: 0 }, { y: 10, t: 200 }, { y: 50, t: 260 }, { y: 110, t: 300 }];
  assert.equal(releaseVelocity(samples, 310, 100), 100 / 100);
});

test('a finger that stopped before letting go has no speed', () => {
  const samples = [{ y: 0, t: 0 }, { y: 200, t: 100 }];
  assert.equal(releaseVelocity(samples, 400, 100), 0);
  assert.equal(releaseVelocity([], 10, 100), 0);
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

test('a tap or slow release closes at the default pace', () => {
  assert.equal(closeDuration({ distance: 500, velocity: 0 }), CLOSE_MS);
  assert.equal(closeDuration({ distance: 500, velocity: 0.5 }), CLOSE_MS);
});

test('a fast flick slides out quicker, within limits', () => {
  assert.equal(closeDuration({ distance: 400, velocity: 4 }), 200);
  assert.equal(closeDuration({ distance: 100, velocity: 10 }), 160);
});
