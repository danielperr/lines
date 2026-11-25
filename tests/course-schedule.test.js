import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lectureDates, releasedBy, validateSchedule, withLectureAdded, withLectureRemoved,
} from '../src/course/schedule.js';

const MON = 1;
const WED = 3;

// Mon/Wed, Nov 23 – Dec 6: Nov 23, 25, 30, Dec 2.
const makeSchedule = (overrides = {}) => ({
  weekdays: [MON, WED],
  startDate: '2026-11-23',
  endDate: '2026-12-06',
  hoursPerLecture: 1.5,
  breaks: [],
  addedDates: [],
  removedDates: [],
  ...overrides,
});

test('lectureDates lists regular weekdays in order', () => {
  assert.deepEqual(lectureDates(makeSchedule()), ['2026-11-23', '2026-11-25', '2026-11-30', '2026-12-02']);
});

test('lectureDates skips breaks', () => {
  const schedule = makeSchedule({ breaks: [{ from: '2026-11-25', to: '2026-11-30' }] });
  assert.deepEqual(lectureDates(schedule), ['2026-11-23', '2026-12-02']);
});

test('lectureDates drops removed dates and adds added ones', () => {
  const schedule = makeSchedule({ removedDates: ['2026-11-25'], addedDates: ['2026-11-27'] });
  assert.deepEqual(lectureDates(schedule), ['2026-11-23', '2026-11-27', '2026-11-30', '2026-12-02']);
});

test('an added lecture on a regular day counts twice, and during a break still happens', () => {
  const schedule = makeSchedule({
    breaks: [{ from: '2026-11-30', to: '2026-12-06' }],
    addedDates: ['2026-11-23', '2026-12-01'],
  });
  assert.deepEqual(lectureDates(schedule), ['2026-11-23', '2026-11-23', '2026-11-25', '2026-12-01']);
});

test('releasedBy counts lectures out by a date, inclusive', () => {
  assert.equal(releasedBy(makeSchedule(), '2026-11-25'), 2);
  assert.equal(releasedBy(makeSchedule(), '2026-11-01'), 0);
});

test('validateSchedule accepts a valid schedule', () => {
  assert.deepEqual(validateSchedule(makeSchedule()), []);
});

test('validateSchedule reports bad dates, days and hours', () => {
  const errors = validateSchedule(makeSchedule({
    weekdays: [], startDate: '2026-12-10', endDate: '2026-12-01', hoursPerLecture: 0,
  }));
  assert.equal(errors.length, 3);
});

test('validateSchedule allows no weekdays when there are added lectures', () => {
  assert.deepEqual(validateSchedule(makeSchedule({ weekdays: [], addedDates: ['2026-11-24'] })), []);
});

test('validateSchedule rejects removing a date that is not a regular lecture', () => {
  const errors = validateSchedule(makeSchedule({ removedDates: ['2026-11-24'] }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /cancelled lecture 1/i);
});

test('validateSchedule rejects added lectures outside the semester', () => {
  const errors = validateSchedule(makeSchedule({ addedDates: ['2026-12-20'] }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /extra lecture 1/i);
});

test('validateSchedule rejects a schedule with no lectures at all', () => {
  const errors = validateSchedule(makeSchedule({ removedDates: ['2026-11-23', '2026-11-25', '2026-11-30', '2026-12-02'] }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /no lectures/i);
});

test('withLectureRemoved cancels a regular lecture without changing the original', () => {
  const original = makeSchedule();
  const next = withLectureRemoved(original, '2026-11-25');
  assert.deepEqual(next.removedDates, ['2026-11-25']);
  assert.deepEqual(original.removedDates, []);
});

test('withLectureRemoved drops an added lecture instead of cancelling', () => {
  const next = withLectureRemoved(makeSchedule({ addedDates: ['2026-11-27'] }), '2026-11-27');
  assert.deepEqual(next.addedDates, []);
  assert.deepEqual(next.removedDates, []);
});

test('withLectureAdded restores a cancelled lecture instead of adding a second one', () => {
  const next = withLectureAdded(makeSchedule({ removedDates: ['2026-11-25'] }), '2026-11-25');
  assert.deepEqual(next.removedDates, []);
  assert.deepEqual(next.addedDates, []);
});

test('withLectureAdded adds a one-off lecture, kept sorted', () => {
  const next = withLectureAdded(makeSchedule({ addedDates: ['2026-12-04'] }), '2026-11-27');
  assert.deepEqual(next.addedDates, ['2026-11-27', '2026-12-04']);
});
