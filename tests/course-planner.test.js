import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planCourses } from '../src/course/planner.js';

// Monday. 14h/week = 2h/day.
const TODAY = '2026-11-23';
const WEEKLY = 14;

/**
 * Mon/Wed lectures Nov 2 – Dec 6: 10 lectures.
 * Released by today: Nov 2, 4, 9, 11, 16, 18, 23 = 7. Coming: Nov 25, 30, Dec 2.
 * 4 watched -> 3 behind.
 */
const schedule = {
  weekdays: [1, 3],
  startDate: '2026-11-02',
  endDate: '2026-12-06',
  hoursPerLecture: 1.5,
  breaks: [],
  addedDates: [],
  removedDates: [],
};

const makeCourse = (overrides = {}) => ({
  id: 'algo', name: 'Algorithms', schedule, watched: 4, milestones: [], ...overrides,
});

const exam = (overrides = {}) => ({
  id: 'mid', kind: 'exam', title: 'Midterm', date: '2026-12-01', prep: null, ...overrides,
});

const prep = (overrides = {}) => ({ unit: 'chapters', total: 1, done: 0, hoursPerUnit: 2, ...overrides });

const plan = (courses, weeklyHours = WEEKLY) => planCourses({ weeklyHours, courses }, TODAY);
const only = (courses, weeklyHours) => plan(courses, weeklyHours).courses[0];

const deepFreeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

// ---- Lectures ----

test('lecture summary shows the backlog and what is coming', () => {
  const { lectures } = only([makeCourse()]);
  assert.equal(lectures.total, 10);
  assert.equal(lectures.released, 7);
  assert.equal(lectures.watched, 4);
  assert.equal(lectures.behind, 3);
  assert.equal(lectures.hoursBehind, 4.5);
  assert.equal(lectures.nextRelease, '2026-11-25');
});

test('lectures are due by the next exam, or by semester end', () => {
  assert.equal(only([makeCourse()]).lectures.dueBy, '2026-12-07');
  assert.equal(only([makeCourse({ milestones: [exam()] })]).lectures.dueBy, '2026-12-01');
});

test('assignments do not make lectures due early', () => {
  const course = makeCourse({ milestones: [exam({ kind: 'assignment', title: 'HW1' })] });
  assert.equal(only([course]).lectures.dueBy, '2026-12-07');
});

test('a caught-up course is on track', () => {
  const course = only([makeCourse({ watched: 7 })]);
  assert.equal(course.status, 'ok');
  assert.equal(course.statusText, 'On track');
  assert.deepEqual(course.signals, []);
});

test('lectures behind are named even when there is time to catch up', () => {
  const course = only([makeCourse()]);
  assert.equal(course.status, 'tight');
  assert.equal(course.statusText, '3 lectures behind');
  assert.deepEqual(course.signals.map((s) => s.kind), ['lectures']);
});

test('lectures still unwatched after their exam are overdue', () => {
  const course = only([makeCourse({ milestones: [exam({ date: '2026-11-20' })] })]);
  assert.equal(course.lectures.status, 'overdue');
  assert.equal(course.status, 'overdue');
});

test('a fully watched course with nothing left is done', () => {
  const course = only([makeCourse({ watched: 10 })]);
  assert.equal(course.status, 'done');
  assert.equal(course.statusText, 'All done');
});

// ---- Prep window ----

test('prep before its window is not counted, only announced', () => {
  // Due by Dec 20: 3 lectures (4.5h) + 8h prep = 12.5h of 54h -> 41.5h spare = 20.75 days.
  // Start by Dec 13, window opens 3 days earlier on Dec 10.
  const course = only([makeCourse({ watched: 7, milestones: [exam({ date: '2026-12-20', prep: prep({ total: 4 }) })] })]);
  assert.equal(course.statusText, 'On track');
  assert.deepEqual(course.signals, []);
  assert.deepEqual(course.nextPrep, { milestoneId: 'mid', title: 'Midterm', startBy: '2026-12-13', opensOn: '2026-12-10' });
  assert.equal(course.prep[0].inWindow, false);
});

test('inside the window both lectures and prep are shown', () => {
  // Due by Dec 1: 5 lectures (7.5h) + 2h prep of 16h -> 6.5h spare = 3.25 days: window open, prep on track.
  const course = only([makeCourse({ milestones: [exam({ prep: prep() })] })]);
  assert.equal(course.prep[0].inWindow, true);
  assert.equal(course.prep[0].status, 'ok');
  assert.equal(course.statusText, '3 lectures behind · Midterm prep on track');
  assert.deepEqual(course.signals.map((s) => s.kind), ['lectures', 'prep']);
  assert.equal(course.nextPrep, null);
});

test('when lectures and prep do not fit, both say the user is behind', () => {
  // Due by Dec 1: 7.5h lectures + 16h prep against 16h -> 7.5h short.
  const course = only([makeCourse({ milestones: [exam({ prep: prep({ total: 8 }) })] })]);
  assert.equal(course.lectures.status, 'behind');
  assert.equal(course.prep[0].status, 'behind');
  assert.equal(course.prep[0].hoursShort, 7.5);
  assert.equal(course.status, 'behind');
  assert.equal(course.statusText, '3 lectures behind · Midterm prep behind 7.5h');
});

test('prep already started counts even before its window', () => {
  const started = exam({ date: '2026-12-20', prep: prep({ total: 4, done: 1 }) });
  const course = only([makeCourse({ watched: 7, milestones: [started] })]);
  assert.equal(course.prep[0].inWindow, true);
  assert.equal(course.statusText, 'Midterm prep on track');
});

test('prep left on a past milestone is overdue', () => {
  const hw = exam({ id: 'hw', kind: 'assignment', title: 'HW1', date: '2026-11-20', prep: prep({ total: 2, done: 1 }) });
  const course = only([makeCourse({ watched: 7, milestones: [hw] })]);
  assert.equal(course.status, 'overdue');
  assert.equal(course.statusText, 'HW1 prep overdue');
});

test('finished prep is not listed', () => {
  const course = only([makeCourse({ watched: 7, milestones: [exam({ prep: prep({ done: 1 }) })] })]);
  assert.deepEqual(course.prep, []);
});

test('a course with no lectures gets its status from prep alone', () => {
  const hw = exam({ kind: 'assignment', title: 'Essay', date: '2026-11-25', prep: prep({ total: 2 }) });
  const course = only([makeCourse({ schedule: null, watched: 0, milestones: [hw] })]);
  assert.equal(course.lectures, null);
  assert.equal(course.statusText, 'Essay prep is tight');
});

// ---- Course list ----

test('next milestone is the earliest one not yet past', () => {
  const milestones = [exam({ id: 'old', date: '2026-11-01' }), exam({ id: 'final', title: 'Final', date: '2027-01-10' }), exam()];
  const { nextMilestone } = only([makeCourse({ milestones })]);
  assert.deepEqual(nextMilestone, { id: 'mid', kind: 'exam', title: 'Midterm', date: '2026-12-01', daysTo: 8 });
});

test('courses are sorted most urgent first, then by name', () => {
  const courses = [
    makeCourse({ id: 'b', name: 'Biology', watched: 7 }),
    makeCourse({ id: 'a', name: 'Algebra', watched: 7 }),
    makeCourse({ id: 'z', name: 'Zoology', milestones: [exam({ date: '2026-11-20' })] }),
  ];
  assert.deepEqual(plan(courses).courses.map((c) => c.name), ['Zoology', 'Algebra', 'Biology']);
});

// ---- Today ----

test('today suggests about a day of released lectures', () => {
  const { today } = plan([makeCourse()]);
  assert.deepEqual(today, [{
    courseId: 'algo', courseName: 'Algorithms', kind: 'lectures', units: 2, unit: 'lectures', hours: 3, from: 5, to: 6, due: '2026-12-07',
  }]);
});

test('today takes work with the earliest due date first, across courses', () => {
  const later = makeCourse({ id: 'later', name: 'Later' });
  const sooner = makeCourse({ id: 'sooner', name: 'Sooner', milestones: [exam()] });
  assert.equal(plan([later, sooner]).today[0].courseId, 'sooner');
});

test('today puts lectures before prep for the same exam', () => {
  const started = exam({ date: '2026-12-01', prep: prep({ total: 3, done: 1 }) });
  const { today } = plan([makeCourse({ milestones: [started] })], 70);
  assert.deepEqual(today.map((t) => [t.kind, t.units, t.hours]), [['lectures', 3, 4.5], ['prep', 2, 4]]);
  assert.equal(today[1].milestoneId, 'mid');
  assert.equal(today[1].unit, 'chapters');
});

test('today leaves out prep whose window has not opened', () => {
  const { today } = plan([makeCourse({ milestones: [exam({ date: '2026-12-20', prep: prep({ total: 4 }) })] })], 70);
  assert.deepEqual(today.map((t) => t.kind), ['lectures']);
});

test('today is empty when everything released is done', () => {
  assert.deepEqual(plan([makeCourse({ watched: 7 })]).today, []);
});

test('planning never changes its input', () => {
  const state = deepFreeze({ weeklyHours: WEEKLY, courses: [makeCourse({ milestones: [exam({ prep: prep() })] })] });
  assert.doesNotThrow(() => planCourses(state, TODAY));
});
