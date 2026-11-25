import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDetails, addLecture, cancelLecture, detailsErrors, removeMilestone, saveMilestone, setWatched, stepPrep,
} from '../src/course/edit.js';
import { courseTimeline } from '../src/course/timeline.js';
import { draftFromMilestone, milestoneFromDraft } from '../src/course/milestone-draft.js';
import { pruneRemoved } from '../src/course/schedule.js';

// Monday. Mon/Wed Nov 16 – Dec 6: Nov 16, 18, 23, 25, 30, Dec 2 (6). Out by today: 3.
const TODAY = '2026-11-23';

const schedule = (overrides = {}) => ({
  weekdays: [1, 3],
  startDate: '2026-11-16',
  endDate: '2026-12-06',
  hoursPerLecture: 1.5,
  breaks: [],
  addedDates: [],
  removedDates: [],
  ...overrides,
});

const exam = (overrides = {}) => ({ id: 'mid', kind: 'exam', title: 'Midterm', date: '2026-11-30', prep: null, ...overrides });

const makeCourse = (overrides = {}) => ({
  id: 'c', name: 'Algorithms', schedule: schedule(), watched: 1, milestones: [exam()], ...overrides,
});

const deepFreeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

// ---- Progress ----

test('setWatched clamps between 0 and the lectures out so far', () => {
  const course = deepFreeze(makeCourse());
  assert.equal(setWatched(course, 2, TODAY).watched, 2);
  assert.equal(setWatched(course, 9, TODAY).watched, 3);
  assert.equal(setWatched(course, -1, TODAY).watched, 0);
});

test('setWatched leaves a course with no lectures alone', () => {
  const course = makeCourse({ schedule: null, watched: 0 });
  assert.equal(setWatched(course, 2, TODAY), course);
});

test('stepPrep moves done within 0 and total', () => {
  const course = deepFreeze(makeCourse({ milestones: [exam({ prep: { unit: 'chapters', total: 2, done: 1, hoursPerUnit: 2 } })] }));
  assert.equal(stepPrep(course, 'mid', 1).milestones[0].prep.done, 2);
  assert.equal(stepPrep(stepPrep(course, 'mid', 1), 'mid', 1).milestones[0].prep.done, 2);
  assert.equal(stepPrep(course, 'mid', -5).milestones[0].prep.done, 0);
});

// ---- One-off lectures ----

test('cancelLecture removes a regular lecture and keeps watched within the new total', () => {
  const course = deepFreeze(makeCourse({ watched: 3 }));
  const next = cancelLecture(course, '2026-11-25');
  assert.deepEqual(next.schedule.removedDates, ['2026-11-25']);
  const allGone = ['2026-11-16', '2026-11-18', '2026-11-23', '2026-11-25', '2026-11-30']
    .reduce(cancelLecture, makeCourse({ watched: 3 }));
  assert.equal(allGone.watched, 1);
});

test('addLecture adds a one-off lecture or restores a cancelled one', () => {
  const course = deepFreeze(makeCourse({ schedule: schedule({ removedDates: ['2026-11-25'] }) }));
  assert.deepEqual(addLecture(course, '2026-11-25').schedule.removedDates, []);
  assert.deepEqual(addLecture(course, '2026-11-27').schedule.addedDates, ['2026-11-27']);
});

test('pruneRemoved drops cancellations that are no longer regular lecture days', () => {
  const s = schedule({ weekdays: [1], removedDates: ['2026-11-16', '2026-11-18'] });
  assert.deepEqual(pruneRemoved(s).removedDates, ['2026-11-16']);
});

// ---- Milestones ----

test('saveMilestone adds or replaces, keeping milestones in date order', () => {
  const course = deepFreeze(makeCourse());
  const hw = { id: 'hw', kind: 'assignment', title: 'HW1', date: '2026-11-20', prep: null };
  assert.deepEqual(saveMilestone(course, hw).milestones.map((m) => m.id), ['hw', 'mid']);
  const moved = saveMilestone(course, exam({ title: 'Mid', date: '2026-12-01' }));
  assert.equal(moved.milestones.length, 1);
  assert.equal(moved.milestones[0].title, 'Mid');
});

test('removeMilestone drops it by id', () => {
  assert.deepEqual(removeMilestone(deepFreeze(makeCourse()), 'mid').milestones, []);
});

// ---- Details ----

test('applyDetails renames and replaces the schedule, pruning stale cancellations', () => {
  const course = deepFreeze(makeCourse({ schedule: schedule({ removedDates: ['2026-11-18'] }) }));
  const next = applyDetails(course, { name: ' Algo ', schedule: schedule({ weekdays: [1], removedDates: ['2026-11-18'] }), watched: 2 });
  assert.equal(next.name, 'Algo');
  assert.deepEqual(next.schedule.removedDates, []);
  assert.equal(next.watched, 2);
  assert.deepEqual(next.milestones, course.milestones);
});

test('applyDetails without a schedule resets watched', () => {
  const next = applyDetails(makeCourse(), { name: 'Algorithms', schedule: null, watched: 3 });
  assert.equal(next.schedule, null);
  assert.equal(next.watched, 0);
});

// ---- Timeline ----

test('timeline lists lectures, milestones and today in date order', () => {
  const kinds = courseTimeline(makeCourse(), TODAY).map((e) => `${e.type}:${e.date}`);
  assert.deepEqual(kinds, [
    'lecture:2026-11-16', 'lecture:2026-11-18', 'today:2026-11-23', 'lecture:2026-11-23',
    'lecture:2026-11-25', 'milestone:2026-11-30', 'lecture:2026-11-30', 'lecture:2026-12-02',
  ]);
});

test('timeline lectures carry their number and state', () => {
  const lectures = courseTimeline(makeCourse(), TODAY).filter((e) => e.type === 'lecture');
  assert.deepEqual(lectures.map((l) => [l.number, l.state]), [
    [1, 'watched'], [2, 'out'], [3, 'out'], [4, 'upcoming'], [5, 'upcoming'], [6, 'upcoming'],
  ]);
});

test('timeline shows cancelled dates and marks one-off lectures', () => {
  const course = makeCourse({ schedule: schedule({ removedDates: ['2026-11-25'], addedDates: ['2026-11-25', '2026-11-27'] }) });
  const entries = courseTimeline(course, TODAY).filter((e) => e.date === '2026-11-25' || e.date === '2026-11-27');
  assert.deepEqual(entries.map((e) => [e.type, e.extra ?? null]), [
    ['lecture', true], ['cancelled', null], ['lecture', true],
  ]);
});

test('timeline of a course with no lectures has milestones and today only', () => {
  const kinds = courseTimeline(makeCourse({ schedule: null, watched: 0 }), TODAY).map((e) => e.type);
  assert.deepEqual(kinds, ['today', 'milestone']);
});

// ---- Milestone form drafts ----

test('a blank draft uses the kind preset for prep', () => {
  assert.deepEqual(draftFromMilestone(null, 'assignment'), {
    kind: 'assignment', title: '', date: '', hasPrep: false, unit: 'days', total: '', done: '0', hoursPerUnit: '4',
  });
});

test('a draft round-trips an existing milestone with prep', () => {
  const m = exam({ prep: { unit: 'chapters', total: 5, done: 1, hoursPerUnit: 2 } });
  assert.deepEqual(milestoneFromDraft(draftFromMilestone(m), m.id), { ok: true, milestone: m });
});

test('a draft without prep gives prep null and trims the title', () => {
  const draft = { ...draftFromMilestone(null, 'exam'), title: ' Final ', date: '2026-12-20', total: '9' };
  assert.deepEqual(milestoneFromDraft(draft, 'f'), {
    ok: true, milestone: { id: 'f', kind: 'exam', title: 'Final', date: '2026-12-20', prep: null },
  });
});

test('a draft reports readable problems', () => {
  const draft = { ...draftFromMilestone(null, 'exam'), title: '', date: '', hasPrep: true, total: '' };
  const result = milestoneFromDraft(draft, 'x');
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, ['Title is required.', 'Date is invalid.', 'Prep amount must be greater than 0.']);
});

// ---- Edit sheet validation ----

test('detailsErrors accepts valid details', () => {
  assert.deepEqual(detailsErrors(makeCourse(), ['Biology'], TODAY), []);
});

test('detailsErrors refuses a name another course uses', () => {
  assert.deepEqual(detailsErrors(makeCourse({ name: 'biology ' }), ['Biology'], TODAY), ['You already have "Biology".']);
});

test('detailsErrors refuses watching lectures that are not out yet', () => {
  assert.deepEqual(detailsErrors(makeCourse({ watched: 5 }), [], TODAY),
    ['Only 3 lectures are out so far, so you can\'t have watched 5.']);
});

test('detailsErrors passes on schedule problems', () => {
  const errors = detailsErrors(makeCourse({ schedule: schedule({ hoursPerLecture: 0 }) }), [], TODAY);
  assert.match(errors[0], /hours per lecture/i);
});
