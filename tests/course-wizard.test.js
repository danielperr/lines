import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIZARD_STEPS, blankDraft, deadlineLabels, blankDeadline, buildCourse, courseSummary, stepErrors } from '../src/course-wizard.js';
import { validateCourse } from '../src/course/course.js';

// Monday. Mon/Wed lectures Nov 2 – Dec 6 = 10 lectures, 7 released by today.
const TODAY = '2026-11-23';
const MON = 1;
const WED = 3;

const counterIds = () => {
  let n = 0;
  return () => `id-${++n}`;
};

const lectures = (overrides = {}) => ({
  weekdays: [MON, WED],
  startDate: '2026-11-02',
  endDate: '2026-12-06',
  hoursPerLecture: 1.5,
  watched: 4,
  breaks: [],
  ...overrides,
});

const exam = (overrides = {}) => ({ ...blankDeadline('exam'), title: 'Final', due: '2026-12-20', amount: 6, ...overrides });

const draft = (overrides = {}) => ({
  ...blankDraft(TODAY),
  name: 'Algorithms',
  hasLectures: true,
  lectures: lectures(),
  deadlines: [exam()],
  ...overrides,
});

test('the wizard walks name, lectures, deadlines, review in order', () => {
  assert.deepEqual(WIZARD_STEPS, ['name', 'lectures', 'deadlines', 'review']);
});

test('a blank draft starts today with no deadlines', () => {
  const d = blankDraft(TODAY);
  assert.equal(d.name, '');
  assert.equal(d.hasLectures, true);
  assert.equal(d.lectures.startDate, TODAY);
  assert.equal(d.lectures.watched, 0);
  assert.deepEqual(d.deadlines, []);
});

test('a blank draft starts with the color it is given', () => {
  assert.equal(blankDraft(TODAY, 'teal').color, 'teal');
  assert.equal(blankDraft(TODAY).color, null);
});

test('buildCourse keeps a picked palette color', () => {
  assert.equal(buildCourse(draft({ color: 'pink' }), counterIds()).color, 'pink');
});

test('buildCourse leaves out a missing or unknown color', () => {
  assert.equal('color' in buildCourse(draft({ color: null }), counterIds()), false);
  assert.equal('color' in buildCourse(draft({ color: 'plaid' }), counterIds()), false);
});

test('deadlines no longer carry a covers-lectures flag (exams always do)', () => {
  assert.equal('coversLectures' in blankDeadline('exam'), false);
});

test('name step requires a non-blank name', () => {
  assert.deepEqual(stepErrors('name', draft({ name: '   ' }), TODAY), ['Give the course a name.']);
  assert.deepEqual(stepErrors('name', draft(), TODAY), []);
});

test('name step refuses a name already in use, ignoring case and spaces', () => {
  assert.deepEqual(stepErrors('name', draft({ name: ' algorithms ' }), TODAY, ['Algorithms']),
    ['You already have "Algorithms". Pick another name.']);
  assert.deepEqual(stepErrors('review', draft(), TODAY, ['Algorithms']).length, 1);
  assert.deepEqual(stepErrors('name', draft(), TODAY, ['Biology']), []);
});

test('name step rejects names longer than 60 characters', () => {
  assert.equal(stepErrors('name', draft({ name: 'x'.repeat(61) }), TODAY).length, 1);
});

test('lectures step reuses track validation', () => {
  const errors = stepErrors('lectures', draft({ lectures: lectures({ weekdays: [] }) }), TODAY);
  assert.deepEqual(errors, ['Pick at least one lecture day.']);
});

test('lectures step refuses watching more lectures than are out', () => {
  const errors = stepErrors('lectures', draft({ lectures: lectures({ watched: 8 }) }), TODAY);
  assert.deepEqual(errors, ["Only 7 lectures are out so far, so you can't have watched 8."]);
});

test('lectures step is skipped when the course has no recorded lectures', () => {
  assert.deepEqual(stepErrors('lectures', draft({ hasLectures: false, lectures: lectures({ weekdays: [] }) }), TODAY), []);
});

test('deadlines step numbers problems within each kind', () => {
  const hw = { ...blankDeadline('assignment'), title: '', due: '2026-12-01', amount: 3 };
  const d = draft({ deadlines: [exam(), hw, exam({ due: '' })] });
  assert.deepEqual(stepErrors('deadlines', d, TODAY), ['Assignment 1: Title is required.', 'Exam 2: Pick a due date.']);
});

test('deadlineLabels numbers each kind separately', () => {
  assert.deepEqual(deadlineLabels(['exam', 'assignment', 'exam']), ['Exam 1', 'Assignment 1', 'Exam 2']);
});

test('prep is optional for every deadline', () => {
  const d = draft({ hasLectures: false, deadlines: [exam({ amount: '' })] });
  assert.deepEqual(stepErrors('deadlines', d, TODAY), []);
});

test('a prep amount, when given, must be more than 0', () => {
  const d = draft({ deadlines: [exam({ amount: '0' })] });
  assert.deepEqual(stepErrors('deadlines', d, TODAY), ['Exam 1: Prep amount must be more than 0, or leave it empty.']);
});

test('a course with neither lectures nor deadlines is refused', () => {
  const d = draft({ hasLectures: false, deadlines: [] });
  assert.deepEqual(stepErrors('deadlines', d, TODAY), ['Add at least one exam or assignment, or go back and add lectures.']);
});

test('review step reports every earlier problem', () => {
  const d = draft({ name: '', lectures: lectures({ weekdays: [] }) });
  assert.deepEqual(stepErrors('review', d, TODAY), ['Give the course a name.', 'Pick at least one lecture day.']);
});

test('buildCourse creates one valid course with a trimmed name', () => {
  const course = buildCourse(draft({ name: '  Algorithms ' }), counterIds());
  assert.deepEqual(validateCourse(course), []);
  assert.equal(course.name, 'Algorithms');
  assert.equal(course.watched, 4);
  assert.deepEqual(course.schedule, {
    weekdays: [MON, WED],
    startDate: '2026-11-02',
    endDate: '2026-12-06',
    hoursPerLecture: 1.5,
    breaks: [],
    addedDates: [],
    removedDates: [],
  });
});

test('extra lectures become added dates, sorted', () => {
  const course = buildCourse(draft({ lectures: lectures({ extraDates: ['2026-11-27', '2026-11-20'] }) }), counterIds());
  assert.deepEqual(course.schedule.addedDates, ['2026-11-20', '2026-11-27']);
});

test('an exam with an amount gets chapters of prep', () => {
  const [m] = buildCourse(draft(), counterIds()).milestones;
  assert.deepEqual({ ...m, id: 'x' }, {
    id: 'x', kind: 'exam', title: 'Final', date: '2026-12-20', prep: { unit: 'chapters', total: 6, done: 0, hoursPerUnit: 2 },
  });
});

test('a deadline without an amount has no prep', () => {
  assert.equal(buildCourse(draft({ deadlines: [exam({ amount: '' })] }), counterIds()).milestones[0].prep, null);
});

test('an assignment counts days of prep', () => {
  const d = draft({ deadlines: [{ ...blankDeadline('assignment'), title: 'HW1', due: '2026-12-01', amount: 2 }] });
  const [m] = buildCourse(d, counterIds()).milestones;
  assert.equal(m.kind, 'assignment');
  assert.deepEqual(m.prep, { unit: 'days', total: 2, done: 0, hoursPerUnit: 4 });
});

test('without lectures the course has no schedule', () => {
  const course = buildCourse(draft({ hasLectures: false }), counterIds());
  assert.equal(course.schedule, null);
  assert.equal(course.watched, 0);
  assert.deepEqual(validateCourse(course), []);
});

test('every created id is unique', () => {
  const d = draft({ deadlines: [exam(), exam({ title: 'Midterm', due: '2026-11-30' })] });
  const course = buildCourse(d, counterIds());
  const ids = [course.id, ...course.milestones.map((m) => m.id)];
  assert.equal(new Set(ids).size, ids.length);
});

test('buildCourse does not change the draft', () => {
  const d = draft();
  const before = JSON.stringify(d);
  buildCourse(d, counterIds());
  assert.equal(JSON.stringify(d), before);
});

test('summary describes the lectures and each deadline', () => {
  const d = draft({ deadlines: [exam(), { ...blankDeadline('assignment'), title: 'HW1', due: '2026-12-01', amount: 2 }] });
  assert.deepEqual(courseSummary(d, TODAY), {
    lectures: 'Mon, Wed · 10 lectures (7 out, 4 watched)',
    deadlines: [
      { title: 'Final', due: '2026-12-20', detail: 'lectures + 6 chapters of prep' },
      { title: 'HW1', due: '2026-12-01', detail: '2 days of prep' },
    ],
  });
});

test('summary says when there are no recorded lectures', () => {
  assert.equal(courseSummary(draft({ hasLectures: false }), TODAY).lectures, null);
});
