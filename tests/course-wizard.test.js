import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIZARD_STEPS, blankDraft, deadlineLabels, blankDeadline, buildCourse, courseSummary, stepErrors } from '../src/course-wizard.js';
import { validateItem } from '../src/scheduler.js';
import { validateTrack } from '../src/tracks.js';

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

test('a blank exam covers lectures by default, an assignment does not', () => {
  assert.equal(blankDeadline('exam').coversLectures, true);
  assert.equal(blankDeadline('assignment').coversLectures, false);
});

test('name step requires a non-blank name', () => {
  assert.deepEqual(stepErrors('name', draft({ name: '   ' }), TODAY), ['Give the course a name.']);
  assert.deepEqual(stepErrors('name', draft(), TODAY), []);
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

test('an exam that covers lectures needs no study amount', () => {
  const d = draft({ deadlines: [exam({ amount: '' })] });
  assert.deepEqual(stepErrors('deadlines', d, TODAY), []);
});

test('a deadline with no lectures needs an amount of work', () => {
  const d = draft({ hasLectures: false, deadlines: [exam({ amount: '' })] });
  assert.deepEqual(stepErrors('deadlines', d, TODAY), ['Exam 1: Enter how many chapters there are to study.']);
});

test('a course with neither lectures nor deadlines is refused', () => {
  const d = draft({ hasLectures: false, deadlines: [] });
  assert.deepEqual(stepErrors('deadlines', d, TODAY), ['Add at least one exam or assignment, or go back and add lectures.']);
});

test('review step reports every earlier problem', () => {
  const d = draft({ name: '', lectures: lectures({ weekdays: [] }) });
  assert.deepEqual(stepErrors('review', d, TODAY), ['Give the course a name.', 'Pick at least one lecture day.']);
});

test('buildCourse creates a valid track and items that share the course name', () => {
  const { track, items } = buildCourse(draft({ name: '  Algorithms ' }), counterIds());
  assert.deepEqual(validateTrack(track), []);
  assert.equal(track.name, 'Algorithms');
  assert.equal(items.length, 1);
  assert.equal(items[0].course, 'Algorithms');
  assert.deepEqual(validateItem(items[0], [track.id]), []);
});

test('an exam covering lectures links the track and adds study chapters', () => {
  const { track, items } = buildCourse(draft(), counterIds());
  const [unit, link] = items[0].parts;
  assert.deepEqual(
    { type: unit.type, unit: unit.unit, totalUnits: unit.totalUnits, doneUnits: unit.doneUnits, hoursPerUnit: unit.hoursPerUnit },
    { type: 'exam', unit: 'chapters', totalUnits: 6, doneUnits: 0, hoursPerUnit: 2 },
  );
  assert.deepEqual({ type: link.type, trackId: link.trackId }, { type: 'track', trackId: track.id });
});

test('an exam with only lectures gets just the track link', () => {
  const { items } = buildCourse(draft({ deadlines: [exam({ amount: '' })] }), counterIds());
  assert.deepEqual(items[0].parts.map((p) => p.type), ['track']);
});

test('an assignment counts days of work and skips lectures', () => {
  const d = draft({ deadlines: [{ ...blankDeadline('assignment'), title: 'HW1', due: '2026-12-01', amount: 2 }] });
  const { items } = buildCourse(d, counterIds());
  assert.deepEqual(items[0].parts.map((p) => [p.type, p.unit, p.totalUnits]), [['assignment', 'days', 2]]);
});

test('without lectures there is no track and nothing links to one', () => {
  const { track, items } = buildCourse(draft({ hasLectures: false }), counterIds());
  assert.equal(track, null);
  assert.deepEqual(items[0].parts.map((p) => p.type), ['exam']);
});

test('every created id is unique', () => {
  const d = draft({ deadlines: [exam(), exam({ title: 'Midterm', due: '2026-11-30' })] });
  const { track, items } = buildCourse(d, counterIds());
  const ids = [track.id, ...items.flatMap((i) => [i.id, ...i.parts.map((p) => p.id)])];
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
      { title: 'Final', due: '2026-12-20', detail: '6 chapters + lectures' },
      { title: 'HW1', due: '2026-12-01', detail: '2 days' },
    ],
  });
});

test('summary says when there are no recorded lectures', () => {
  assert.equal(courseSummary(draft({ hasLectures: false }), TODAY).lectures, null);
});
