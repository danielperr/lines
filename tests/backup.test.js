import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replacePrompt } from '../src/backup.js';

test('importing with no courses yet asks nothing', () => {
  assert.equal(replacePrompt(0, 5), null);
});

test('importing over existing courses asks before replacing them', () => {
  assert.equal(replacePrompt(3, 5), 'Replace your 3 courses with the 5 in this file?');
});

test('the replace question counts one course in the singular', () => {
  assert.equal(replacePrompt(1, 1), 'Replace your 1 course with the 1 in this file?');
});
