import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SNOOZE_DAYS, activeSnooze, defaultSnoozeUntil, snoozeCourse, snoozeError, unsnoozeCourse,
} from '../src/course/snooze.js';
import { validateCourse } from '../src/course/course.js';
import { parseState, serializeState } from '../src/course/store.js';
import { planCourses } from '../src/course/planner.js';
import { courseRow } from '../src/home-model.js';

const TODAY = '2026-11-23';

const schedule = {
  weekdays: [1, 3], startDate: '2026-11-02', endDate: '2026-12-06', hoursPerLecture: 1.5,
  breaks: [], addedDates: [], removedDates: [],
};

const makeCourse = (overrides = {}) => ({
  id: 'algo', name: 'Algorithms', schedule, watched: 4, milestones: [], ...overrides,
});

const exam = (overrides = {}) => ({
  id: 'mid', kind: 'exam', title: 'Midterm', date: '2026-12-01',
  prep: { unit: 'chapters', total: 3, done: 1, hoursPerUnit: 2 }, ...overrides,
});

// ---- Pure snooze helpers ----

test('the default snooze is one week from today', () => {
  assert.equal(DEFAULT_SNOOZE_DAYS, 7);
  assert.equal(defaultSnoozeUntil(TODAY), '2026-11-30');
});

test('a snooze is active until (not including) its end date', () => {
  const course = makeCourse({ snoozedUntil: '2026-11-30' });
  assert.equal(activeSnooze(course, '2026-11-29'), '2026-11-30');
  assert.equal(activeSnooze(course, '2026-11-30'), null);
  assert.equal(activeSnooze(makeCourse(), TODAY), null);
});

test('snoozing returns a new course and leaves the original alone', () => {
  const course = Object.freeze(makeCourse());
  const next = snoozeCourse(course, '2026-11-30', TODAY);
  assert.equal(next.snoozedUntil, '2026-11-30');
  assert.equal(course.snoozedUntil, undefined);
});

test('snoozing to today or earlier, or to a bad date, changes nothing', () => {
  const course = makeCourse();
  assert.equal(snoozeCourse(course, TODAY, TODAY), course);
  assert.equal(snoozeCourse(course, '2026-11-01', TODAY), course);
  assert.equal(snoozeCourse(course, 'soon', TODAY), course);
});

test('snoozeError explains a date that cannot be used', () => {
  assert.equal(snoozeError('2026-11-30', TODAY), null);
  assert.match(snoozeError(TODAY, TODAY), /after today/);
  assert.match(snoozeError('', TODAY), /date/);
});

test('unsnoozing drops the field, or returns the same course when not snoozed', () => {
  const plain = makeCourse();
  assert.equal(unsnoozeCourse(plain), plain);
  assert.equal('snoozedUntil' in unsnoozeCourse(makeCourse({ snoozedUntil: '2026-11-30' })), false);
});

// ---- Validation and storage ----

test('a course validates with or without a snooze date, but not a broken one', () => {
  assert.deepEqual(validateCourse(makeCourse({ snoozedUntil: '2026-11-30' })), []);
  assert.deepEqual(validateCourse(makeCourse()), []);
  assert.ok(validateCourse(makeCourse({ snoozedUntil: 'next week' })).length > 0);
});

test('the snooze date survives a save and load', () => {
  const state = { weeklyHours: 14, courses: [makeCourse({ snoozedUntil: '2026-11-30' })] };
  const loaded = parseState(serializeState(state));
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.courses[0].snoozedUntil, '2026-11-30');
});

test('an unreadable snooze date is dropped on load rather than failing it', () => {
  const json = JSON.stringify({ version: 5, weeklyHours: 14, courses: [makeCourse({ snoozedUntil: 42 })] });
  const loaded = parseState(json);
  assert.equal(loaded.ok, true);
  assert.equal('snoozedUntil' in loaded.state.courses[0], false);
});

// ---- Planner ----

const plan = (courses, weeklyHours = 14, today = TODAY) => planCourses({ weeklyHours, courses }, today);

test('a snoozed course has no tasks today', () => {
  assert.deepEqual(plan([makeCourse({ snoozedUntil: '2026-11-30' })]).today, []);
});

test('lectures come back on the day the snooze ends', () => {
  const { today } = plan([makeCourse({ snoozedUntil: '2026-11-30' })], 14, '2026-11-30');
  assert.deepEqual(today.map((t) => t.kind), ['lectures']);
});

test('snoozing hides prep tasks too, and frees the hours for other courses', () => {
  const snoozed = makeCourse({ snoozedUntil: '2026-11-30', milestones: [exam()] });
  const other = makeCourse({ id: 'os', name: 'Operating Systems' });
  const { today } = plan([snoozed, other], 70);
  assert.deepEqual(today.map((t) => [t.courseId, t.kind]), [['os', 'lectures']]);
});

test('prep comes back with the lectures when the snooze ends', () => {
  const course = makeCourse({ snoozedUntil: '2026-11-30', milestones: [exam()] });
  const { today } = plan([course], 70, '2026-11-30');
  assert.deepEqual([...new Set(today.map((t) => t.kind))], ['lectures', 'prep']);
});

test('a snoozed course still reports how far behind it is', () => {
  const planned = plan([makeCourse({ snoozedUntil: '2026-11-30' })]).courses[0];
  assert.equal(planned.lectures.behind, 3);
  assert.equal(planned.snoozedUntil, '2026-11-30');
  assert.equal(plan([makeCourse({ snoozedUntil: '2026-11-20' })]).courses[0].snoozedUntil, null);
});

test('the course card mentions an active snooze', () => {
  const planned = plan([makeCourse({ snoozedUntil: '2026-11-30' })]).courses[0];
  assert.equal(courseRow(planned, 'blue').snoozedUntil, '2026-11-30');
  assert.equal(courseRow(plan([makeCourse()]).courses[0], 'blue').snoozedUntil, null);
});
