import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createUndo } from '../src/undo.js';
import { createChangeGuard } from '../src/change-guard.js';
import { scrollDirection } from '../src/scroll.js';
import { statusText } from '../src/overview.js';

const fakeToast = () => {
  const calls = [];
  return {
    calls,
    show: (message, onUndo) => calls.push({ type: 'show', message, onUndo }),
    hide: () => calls.push({ type: 'hide' }),
  };
};

test('undo restores the latest offer once, then forgets it', () => {
  const toast = fakeToast();
  const restored = [];
  const undo = createUndo({ ...toast, timeoutMs: 5000 });
  undo.offer('Deleted "HW3"', () => restored.push('HW3'));
  assert.equal(toast.calls[0].message, 'Deleted "HW3"');
  toast.calls[0].onUndo();
  toast.calls[0].onUndo();
  assert.deepEqual(restored, ['HW3']);
  assert.equal(toast.calls.at(-1).type, 'hide');
});

test('a newer offer replaces the older one', () => {
  const toast = fakeToast();
  const restored = [];
  const undo = createUndo({ ...toast, timeoutMs: 5000 });
  undo.offer('first', () => restored.push('first'));
  undo.offer('second', () => restored.push('second'));
  toast.calls[0].onUndo(); // stale button from the first toast
  toast.calls[1].onUndo();
  assert.deepEqual(restored, ['second']);
});

test('an offer expires after the timeout', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const toast = fakeToast();
    const restored = [];
    const undo = createUndo({ ...toast, timeoutMs: 5000 });
    undo.offer('Deleted', () => restored.push('x'));
    mock.timers.tick(5000);
    assert.equal(toast.calls.at(-1).type, 'hide');
    toast.calls[0].onUndo();
    assert.deepEqual(restored, []);
  } finally {
    mock.timers.reset();
  }
});

test('dismiss drops a pending offer without restoring', () => {
  const toast = fakeToast();
  const restored = [];
  const undo = createUndo({ ...toast, timeoutMs: 5000 });
  undo.offer('Deleted', () => restored.push('x'));
  undo.dismiss();
  toast.calls[0].onUndo();
  assert.deepEqual(restored, []);
});

test('change guard closes freely when nothing changed', () => {
  let value = 'a';
  let asked = 0;
  const guard = createChangeGuard({ read: () => value, confirm: () => { asked += 1; return false; } });
  guard.markClean();
  assert.equal(guard.mayClose(), true);
  assert.equal(asked, 0);
});

test('change guard asks before discarding edits and respects the answer', () => {
  let value = 'a';
  let answer = false;
  const guard = createChangeGuard({ read: () => value, confirm: () => answer });
  guard.markClean();
  value = 'b';
  assert.equal(guard.mayClose(), false);
  answer = true;
  assert.equal(guard.mayClose(), true);
  value = 'a';
  answer = false;
  assert.equal(guard.mayClose(), true, 'changing a field back is not an edit');
});

test('scroll direction ignores small jitters', () => {
  assert.equal(scrollDirection(100, 104), null);
  assert.equal(scrollDirection(100, 140), 'down');
  assert.equal(scrollDirection(140, 100), 'up');
  assert.equal(scrollDirection(30, 0), 'up');
});

test('overview status text never relies on colour alone', () => {
  assert.equal(statusText({ status: 'overdue', lecturesBehind: 0 }), 'Overdue');
  assert.equal(statusText({ status: 'behind', lecturesBehind: 2 }), 'Behind');
  assert.equal(statusText({ status: 'tight', lecturesBehind: 0 }), 'Tight');
  assert.equal(statusText({ status: 'tight', lecturesBehind: 3 }), '3 behind');
  assert.equal(statusText({ status: 'ok', lecturesBehind: 0 }), null);
  assert.equal(statusText({ status: 'done', lecturesBehind: 0 }), 'Done');
});
