import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseRow, homeStatus, todayCards, todayRows, todaySummary } from '../src/home-model.js';

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
  assert.equal(row.progress.out, 0.7);
  assert.equal(row.progress.watched, 0.4);
  assert.equal(row.lecturesText, '4 of 10 watched · 7 out');
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
  assert.equal(courseRow(plannedCourse()).label, 'Algorithms: 3 lectures behind. 4 of 10 lectures watched, 7 out.');
});

// ---- Style C: color-coded cards ----

const colors = new Map([['algo', 'violet'], ['os', 'amber']]);

test('todayCards groups tasks into one card per course, in priority order', () => {
  const tasks = [
    lectureTask({ courseId: 'os', courseName: 'Operating Systems' }),
    lectureTask(),
    prepTask({ courseId: 'os', courseName: 'Operating Systems', hours: 2 }),
  ];
  const cards = todayCards(tasks, colors);
  assert.deepEqual(cards.map((c) => c.courseId), ['os', 'algo']);
  assert.equal(cards[0].courseName, 'Operating Systems');
  assert.equal(cards[0].rows.length, 2);
  assert.equal(cards[1].rows.length, 1);
});

test('a today card carries its course color and total hours', () => {
  const [card] = todayCards([lectureTask(), prepTask()], colors);
  assert.equal(card.color, 'violet');
  assert.equal(card.hoursText, '7h');
});

test('rows inside a today card show only the hours, not the course again', () => {
  const [card] = todayCards([lectureTask()], colors);
  assert.equal(card.rows[0].title, 'Lectures 5–6');
  assert.equal(card.rows[0].detail, '3h');
  assert.deepEqual(card.rows[0].action, { kind: 'lectures', courseId: 'algo' });
});

test('a card with one task has no total: its row already shows the hours', () => {
  assert.equal(todayCards([lectureTask()], colors)[0].hoursText, null);
});

test('todayCards is empty when there is nothing to do', () => {
  assert.deepEqual(todayCards([], colors), []);
});

test('a course row carries its color, a short pill label and each signal', () => {
  const signals = [
    { kind: 'lectures', status: 'tight', text: '3 lectures behind' },
    { kind: 'prep', milestoneId: 'mid', status: 'behind', text: 'Midterm prep behind 2h' },
  ];
  const row = courseRow(plannedCourse({ status: 'behind', signals }), 'teal');
  assert.equal(row.color, 'teal');
  assert.equal(row.pillText, 'Behind');
  assert.deepEqual(row.signals, [
    { status: 'tight', text: '3 lectures behind' },
    { status: 'behind', text: 'Midterm prep behind 2h' },
  ]);
});

test('pill labels cover every status', () => {
  const label = (status) => courseRow(plannedCourse({ status }), 'teal').pillText;
  assert.deepEqual(['ok', 'tight', 'behind', 'overdue', 'done'].map(label), ['On track', 'Tight', 'Behind', 'Overdue', 'Done']);
});

test('homeStatus counts courses that are behind, then tight', () => {
  const c = (status) => ({ status });
  assert.deepEqual(homeStatus([c('behind'), c('overdue'), c('tight')]), { status: 'behind', text: '2 behind' });
  assert.deepEqual(homeStatus([c('ok'), c('tight')]), { status: 'tight', text: '1 tight' });
  assert.deepEqual(homeStatus([c('ok'), c('done')]), { status: 'ok', text: 'On track' });
  assert.deepEqual(homeStatus([c('done'), c('done')]), { status: 'done', text: 'All done' });
});
