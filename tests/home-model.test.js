import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseRow, todayRows, todaySummary } from '../src/home-model.js';

const lectureTask = (overrides = {}) => ({
  courseId: 'algo', courseName: 'Algorithms', kind: 'lectures', units: 2, unit: 'lectures', hours: 3, from: 5, to: 6, due: '2026-12-01', ...overrides,
});

const prepTask = (overrides = {}) => ({
  courseId: 'algo', courseName: 'Algorithms', kind: 'prep', milestoneId: 'mid', title: 'Midterm', units: 2, unit: 'chapters', hours: 4, due: '2026-12-01', ...overrides,
});

test('a lecture task names the lecture range, course and hours', () => {
  const [row] = todayRows([lectureTask()]);
  assert.equal(row.title, 'Lectures 5–6');
  assert.equal(row.detail, 'Algorithms · 3h');
  assert.equal(row.plusLabel, 'Mark lecture 5 of Algorithms watched');
  assert.deepEqual(row.action, { kind: 'lectures', courseId: 'algo' });
});

test('a single lecture is named on its own', () => {
  assert.equal(todayRows([lectureTask({ units: 1, to: 5, hours: 1.5 })])[0].title, 'Lecture 5');
});

test('a prep task names the milestone and amount', () => {
  const [row] = todayRows([prepTask({ units: 1, hours: 2 })]);
  assert.equal(row.title, 'Midterm prep · 1 chapter');
  assert.equal(row.detail, 'Algorithms · 2h');
  assert.equal(row.plusLabel, 'Mark one chapter of Midterm prep done');
  assert.deepEqual(row.action, { kind: 'prep', courseId: 'algo', milestoneId: 'mid' });
});

test('rows have distinct keys', () => {
  const rows = todayRows([lectureTask(), prepTask(), lectureTask({ courseId: 'os' })]);
  assert.equal(new Set(rows.map((r) => r.key)).size, 3);
});

test('today summary totals the hours, or is null when there is nothing', () => {
  assert.equal(todaySummary([lectureTask(), prepTask()]), '2 tasks · about 7h');
  assert.equal(todaySummary([lectureTask()]), '1 task · about 3h');
  assert.equal(todaySummary([]), null);
});

const plannedCourse = (overrides = {}) => ({
  id: 'algo',
  name: 'Algorithms',
  status: 'tight',
  statusText: '3 lectures behind',
  signals: [],
  lectures: { total: 10, released: 7, watched: 4, behind: 3 },
  prep: [],
  nextMilestone: { id: 'mid', kind: 'exam', title: 'Midterm', date: '2026-12-01', daysTo: 8 },
  nextPrep: null,
  ...overrides,
});

test('a course row shows status, lecture progress and the next milestone', () => {
  const row = courseRow(plannedCourse());
  assert.equal(row.statusText, '3 lectures behind');
  assert.equal(row.status, 'tight');
  assert.equal(row.progress, 0.4);
  assert.equal(row.lecturesText, '4 of 10 lectures watched');
  assert.deepEqual(row.milestone, { title: 'Midterm', date: '2026-12-01', daysTo: 8 });
  assert.equal(row.prepNotice, null);
});

test('a course row announces prep that has not started counting yet', () => {
  const row = courseRow(plannedCourse({ nextPrep: { milestoneId: 'mid', title: 'Midterm', startBy: '2026-12-13', opensOn: '2026-12-10' } }));
  assert.deepEqual(row.prepNotice, { title: 'Midterm', opensOn: '2026-12-10' });
});

test('a course with no lectures has no lecture progress', () => {
  const row = courseRow(plannedCourse({ lectures: null }));
  assert.equal(row.progress, null);
  assert.equal(row.lecturesText, null);
});

test('a course row describes itself for screen readers in words', () => {
  assert.equal(courseRow(plannedCourse()).label, 'Algorithms: 3 lectures behind. 4 of 10 lectures watched.');
});
