import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planCourses } from '../src/course/planner.js';
import { MAX_BREAKS, lectureDates, releasedBy, validateSchedule } from '../src/course/schedule.js';
import { parseState, serializeState } from '../src/course/store.js';

const TODAY = '2026-11-23'; // Monday

/** Mon/Wed, Nov 2 – Dec 6: 10 lectures; 7 out by today. */
const makeSchedule = (overrides = {}) => ({
  weekdays: [1, 3],
  startDate: '2026-11-02',
  endDate: '2026-12-06',
  hoursPerLecture: 1.5,
  breaks: [],
  addedDates: [],
  removedDates: [],
  ...overrides,
});

const makeCourse = (schedule) => ({ id: 'algo', name: 'Algorithms', schedule, watched: 4, milestones: [] });

const lecturesOf = (schedule) => planCourses({ weeklyHours: 14, courses: [makeCourse(schedule)] }, TODAY).courses[0].lectures;

test('lectures inside a break range are not counted', () => {
  // Nov 9 – Nov 13 removes Mon 9 and Wed 11.
  const s = makeSchedule({ breaks: [{ from: '2026-11-09', to: '2026-11-13' }] });
  assert.equal(lectureDates(s).length, 8);
  assert.equal(lectureDates(s).includes('2026-11-09'), false);
  assert.equal(lectureDates(s).includes('2026-11-11'), false);
  assert.equal(releasedBy(s, TODAY), 5);
});

test('a single-day break removes just that day, and break edges are inclusive', () => {
  const s = makeSchedule({ breaks: [{ from: '2026-11-16', to: '2026-11-16' }, { from: '2026-12-02', to: '2026-12-06' }] });
  assert.deepEqual(lectureDates(s), [
    '2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11', '2026-11-18', '2026-11-23', '2026-11-25', '2026-11-30',
  ]);
});

test('breaks outside the semester or on non-lecture days change nothing', () => {
  const s = makeSchedule({ breaks: [{ from: '2026-08-01', to: '2026-08-31' }, { from: '2026-11-14', to: '2026-11-15' }] });
  assert.equal(lectureDates(s).length, 10);
});

test('breaks shrink the lecture backlog', () => {
  const plain = lecturesOf(makeSchedule());
  const withBreak = lecturesOf(makeSchedule({ breaks: [{ from: '2026-11-16', to: '2026-11-18' }] }));
  assert.equal(plain.behind, 3);
  assert.equal(withBreak.behind, 1);
  assert.equal(withBreak.total, 8);
});

test('validateSchedule rejects malformed or reversed breaks', () => {
  assert.deepEqual(validateSchedule(makeSchedule()), []);
  assert.match(validateSchedule(makeSchedule({ breaks: [{ from: '2026-11-20', to: '2026-11-10' }] })).join(' '), /Break 1/);
  assert.match(validateSchedule(makeSchedule({ breaks: [{ from: 'soon', to: '2026-11-10' }] })).join(' '), /Break 1/);
  assert.match(validateSchedule(makeSchedule({ breaks: 'none' })).join(' '), /Breaks/);
  const tooMany = Array.from({ length: MAX_BREAKS + 1 }, () => ({ from: '2026-11-09', to: '2026-11-09' }));
  assert.match(validateSchedule(makeSchedule({ breaks: tooMany })).join(' '), new RegExp(`${MAX_BREAKS}`));
});

test('validateSchedule rejects breaks that cover every lecture', () => {
  const errors = validateSchedule(makeSchedule({ breaks: [{ from: '2026-11-01', to: '2026-12-31' }] }));
  assert.match(errors.join(' '), /No lectures/);
});

test('storage keeps breaks and drops their unknown fields', () => {
  const course = { ...makeCourse(makeSchedule({ breaks: [{ from: '2026-11-09', to: '2026-11-13', junk: true }] })), watched: 0 };
  const loaded = parseState(serializeState({ weeklyHours: 20, courses: [course] }));
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state.courses[0].schedule.breaks, [{ from: '2026-11-09', to: '2026-11-13' }]);
});
