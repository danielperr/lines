import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gatesLectures, validateMilestone } from '../src/course/milestone.js';
import { lectureCount, validateCourse } from '../src/course/course.js';

const schedule = {
  weekdays: [1, 3],
  startDate: '2026-11-23',
  endDate: '2026-12-06',
  hoursPerLecture: 1.5,
  breaks: [],
  addedDates: [],
  removedDates: [],
};

const makeMilestone = (overrides = {}) => ({
  id: 'm1', kind: 'exam', title: 'Midterm', date: '2026-12-10', prep: null, ...overrides,
});

const makeCourse = (overrides = {}) => ({
  id: 'c1', name: 'Algorithms', schedule, watched: 1, milestones: [makeMilestone()], ...overrides,
});

const prep = (overrides = {}) => ({ unit: 'chapters', total: 5, done: 1, hoursPerUnit: 2, ...overrides });

test('validateMilestone accepts a milestone with and without prep', () => {
  assert.deepEqual(validateMilestone(makeMilestone()), []);
  assert.deepEqual(validateMilestone(makeMilestone({ prep: prep() })), []);
});

test('validateMilestone reports kind, title and date problems', () => {
  const errors = validateMilestone(makeMilestone({ kind: 'party', title: ' ', date: '2026-13-01' }));
  assert.equal(errors.length, 3);
});

test('validateMilestone checks prep amounts', () => {
  assert.equal(validateMilestone(makeMilestone({ prep: prep({ total: 0 }) })).length, 1);
  assert.equal(validateMilestone(makeMilestone({ prep: prep({ done: 6 }) })).length, 1);
  assert.equal(validateMilestone(makeMilestone({ prep: prep({ unit: '', hoursPerUnit: -1 }) })).length, 2);
});

test('only exams set when lectures are due', () => {
  assert.equal(gatesLectures(makeMilestone()), true);
  assert.equal(gatesLectures(makeMilestone({ kind: 'assignment' })), false);
});

test('validateCourse accepts a valid course', () => {
  assert.deepEqual(validateCourse(makeCourse()), []);
});

test('validateCourse accepts a course with no lectures', () => {
  assert.deepEqual(validateCourse(makeCourse({ schedule: null, watched: 0 })), []);
  assert.equal(lectureCount(makeCourse({ schedule: null, watched: 0 })), 0);
});

test('validateCourse requires a name', () => {
  assert.match(validateCourse(makeCourse({ name: '  ' }))[0], /name/i);
});

test('validateCourse rejects more watched lectures than exist', () => {
  assert.equal(lectureCount(makeCourse()), 4);
  assert.match(validateCourse(makeCourse({ watched: 5 }))[0], /4/);
  assert.equal(validateCourse(makeCourse({ watched: -1 })).length, 1);
});

test('validateCourse names the broken milestone and rejects duplicate milestone ids', () => {
  const broken = validateCourse(makeCourse({ milestones: [makeMilestone({ date: 'soon' })] }));
  assert.match(broken[0], /Midterm/);
  const dupes = validateCourse(makeCourse({ milestones: [makeMilestone(), makeMilestone({ title: 'Final' })] }));
  assert.match(dupes[0], /same id/i);
});

test('validateCourse names schedule problems', () => {
  const errors = validateCourse(makeCourse({ schedule: { ...schedule, hoursPerLecture: 0 } }));
  assert.match(errors[0], /hours per lecture/i);
});
