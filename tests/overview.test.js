import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSchedule } from '../src/scheduler.js';
import { courseOverview, trackTone } from '../src/overview.js';

const TODAY = '2026-11-23'; // a Monday

const assignment = (id, course, due, totalUnits, doneUnits) => ({
  id, title: id, course, due,
  parts: [{ id: `${id}-1`, type: 'assignment', unit: 'days', totalUnits, doneUnits, hoursPerUnit: 4 }],
});

// Mondays 2 Nov – 28 Dec: 9 lectures, 4 released by today.
const mondayTrack = (id, name, watched) => ({
  id, name, weekdays: [1], startDate: '2026-11-02', endDate: '2026-12-28', hoursPerLecture: 1, watched,
});

const overviewOf = (items, tracks = []) => courseOverview(planSchedule(items, 20, TODAY, tracks));

test('merges deadlines and a lecture track with the same course name', () => {
  const rows = overviewOf([assignment('HW', 'Algorithms', '2026-12-20', 2, 1)], [mondayTrack('t1', 'algorithms', 1)]);
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.name, 'Algorithms');
  assert.equal(row.totalHours, 8 + 9);
  assert.equal(row.doneHours, 4 + 1);
  assert.equal(row.hoursLeft, 12);
  assert.equal(row.lecturesBehind, 3);
  assert.equal(row.nextDue, '2026-12-20');
});

test('course status is its worst deadline or track, and worst courses come first', () => {
  const rows = overviewOf([
    assignment('Fine', 'Calculus', '2027-01-30', 1, 0),
    assignment('Late', 'Physics', '2026-11-20', 1, 0),
  ]);
  assert.deepEqual(rows.map((r) => [r.name, r.status]), [['Physics', 'overdue'], ['Calculus', 'ok']]);
});

test('a lecture backlog makes an otherwise relaxed course at least tight', () => {
  const [row] = overviewOf([], [mondayTrack('t1', 'History', 1)]);
  assert.equal(row.status, trackTone({ status: 'ok', behind: 3 }));
  assert.equal(row.status, 'tight');
});

test('finished courses are marked done and listed last', () => {
  const rows = overviewOf([
    assignment('Old', 'Art', '2026-12-01', 1, 1),
    assignment('New', 'Biology', '2027-01-30', 1, 0),
  ]);
  assert.deepEqual(rows.map((r) => [r.name, r.status, r.hoursLeft]), [['Biology', 'ok', 4], ['Art', 'done', 0]]);
});

test('deadlines without a course are grouped under "Other"', () => {
  const [row] = overviewOf([assignment('Misc', '  ', '2027-01-30', 1, 0)]);
  assert.equal(row.name, 'Other');
});

test('trackTone: caught up is ok, a backlog is never shown as ok', () => {
  assert.equal(trackTone({ status: 'done', behind: 0 }), 'done');
  assert.equal(trackTone({ status: 'tight', behind: 0 }), 'ok');
  assert.equal(trackTone({ status: 'behind', behind: 2 }), 'behind');
});
