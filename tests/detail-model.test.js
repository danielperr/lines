import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detailHeader, lectureLine, prepLine, splitTimeline, timelineRow } from '../src/detail-model.js';

test('lecture line shows watched, total and how many are out', () => {
  assert.equal(lectureLine({ watched: 5, total: 24, released: 8 }), '5 of 24 watched · 8 out');
  assert.equal(lectureLine({ watched: 24, total: 24, released: 24 }), 'All 24 watched');
});

test('prep line shows progress in the prep unit', () => {
  assert.equal(prepLine({ unit: 'chapters', total: 5, done: 1, hoursPerUnit: 2 }), '1 of 5 chapters of prep');
  assert.equal(prepLine({ unit: 'days', total: 1, done: 1, hoursPerUnit: 4 }), 'Prep done');
  assert.equal(prepLine(null), null);
});

test('an unwatched lecture can be cancelled; a one-off can be removed', () => {
  assert.deepEqual(timelineRow({ type: 'lecture', date: '2026-11-25', number: 4, state: 'upcoming', extra: false }), {
    title: 'Lecture 4', note: null, state: 'upcoming', action: { label: 'Cancel', op: 'cancel' },
  });
  assert.deepEqual(timelineRow({ type: 'lecture', date: '2026-11-27', number: 5, state: 'out', extra: true }).action,
    { label: 'Remove', op: 'cancel' });
  assert.equal(timelineRow({ type: 'lecture', date: '2026-11-27', number: 5, state: 'out', extra: true }).note, 'Extra');
});

test('a watched lecture has no action', () => {
  assert.equal(timelineRow({ type: 'lecture', date: '2026-11-16', number: 1, state: 'watched', extra: false }).action, null);
});

test('a cancelled lecture can be restored', () => {
  assert.deepEqual(timelineRow({ type: 'cancelled', date: '2026-11-25' }), {
    title: 'Cancelled lecture', note: null, state: 'cancelled', action: { label: 'Restore', op: 'add' },
  });
});

test('milestones and today are labelled', () => {
  assert.equal(timelineRow({ type: 'milestone', date: '2026-11-30', id: 'm', kind: 'exam', title: 'Midterm' }).title, 'Midterm');
  assert.equal(timelineRow({ type: 'milestone', date: '2026-11-30', id: 'm', kind: 'exam', title: 'Midterm' }).note, 'Exam');
  assert.equal(timelineRow({ type: 'today', date: '2026-11-23' }).title, 'Today');
});

test('splitTimeline folds everything before today into an earlier part', () => {
  const entries = [
    { type: 'lecture', date: '2026-11-16' }, { type: 'today', date: '2026-11-23' }, { type: 'lecture', date: '2026-11-23' },
  ];
  assert.deepEqual(splitTimeline(entries), { earlier: [entries[0]], upcoming: entries.slice(1) });
});

const planned = (over = {}) => ({
  id: 'c1', name: 'Algebra', status: 'behind', statusText: '5 lectures behind',
  signals: [{ status: 'behind', text: '5 lectures behind' }],
  lectures: { watched: 6, total: 24, released: 11 }, nextPrep: null, ...over,
});

test('the detail header carries name, short pill, full status and lecture progress', () => {
  assert.deepEqual(detailHeader(planned()), {
    name: 'Algebra',
    status: 'behind',
    pillText: 'Behind',
    statusText: '5 lectures behind',
    progress: 0.25,
    progressText: '6 of 24 lectures',
  });
});

test('the detail header has no progress for a course without lectures', () => {
  const header = detailHeader(planned({ lectures: null, status: 'ok', statusText: 'On track' }));
  assert.equal(header.progress, null);
  assert.equal(header.progressText, null);
  assert.equal(header.pillText, 'On track');
});

test('the detail header shows a finished course as done', () => {
  const header = detailHeader(planned({ status: 'done', statusText: 'All done', lectures: { watched: 24, total: 24, released: 24 } }));
  assert.equal(header.pillText, 'Done');
  assert.equal(header.progress, 1);
  assert.equal(header.progressText, 'All 24 lectures');
});
