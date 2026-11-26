import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lectureProgress } from '../src/progress-model.js';

test('lecture progress has two layers: lectures out and lectures watched', () => {
  assert.deepEqual(lectureProgress({ total: 10, released: 7, watched: 4 }), {
    out: 0.7,
    watched: 0.4,
    label: '4 of 10 lectures watched, 7 out',
    legend: { watched: '4 watched', out: '7 of 10 out' },
  });
});

test('lecture progress is null without lectures', () => {
  assert.equal(lectureProgress(null), null);
  assert.equal(lectureProgress({ total: 0, released: 0, watched: 0 }), null);
});

test('lecture progress stays between 0 and 1', () => {
  const p = lectureProgress({ total: 4, released: 9, watched: 6 });
  assert.equal(p.out, 1);
  assert.equal(p.watched, 1);
});

test('lecture progress says when every lecture is watched', () => {
  const done = lectureProgress({ total: 12, released: 12, watched: 12 });
  assert.equal(done.label, 'All 12 lectures watched');
  assert.deepEqual(done.legend, { watched: 'All 12 watched', out: null });
});
