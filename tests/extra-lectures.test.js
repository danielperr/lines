import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankDraft, buildCourse, courseSummary, stepErrors } from '../src/course-wizard.js';
import { planCourses } from '../src/course/planner.js';
import { MAX_ADDED_DATES, lectureDates, releasedBy, validateSchedule } from '../src/course/schedule.js';
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

const lecturesOf = (schedule) => planCourses({
  weeklyHours: 14, courses: [{ id: 'algo', name: 'Algorithms', schedule, watched: 4, milestones: [] }],
}, TODAY).courses[0].lectures;

test('an extra lecture on a non-lecture day is added in date order', () => {
  const s = makeSchedule({ addedDates: ['2026-11-20'] }); // Friday
  const dates = lectureDates(s);
  assert.equal(dates.length, 11);
  assert.deepEqual(dates.slice(5, 8), ['2026-11-18', '2026-11-20', '2026-11-23']);
  assert.equal(releasedBy(s, TODAY), 8);
});

test('an extra lecture on a regular lecture day counts as a second lecture', () => {
  const s = makeSchedule({ addedDates: ['2026-11-04'] });
  assert.equal(lectureDates(s).filter((d) => d === '2026-11-04').length, 2);
});

test('an extra lecture during a break still happens', () => {
  const s = makeSchedule({ breaks: [{ from: '2026-11-09', to: '2026-11-13' }], addedDates: ['2026-11-12'] });
  assert.deepEqual(lectureDates(s).filter((d) => d.startsWith('2026-11-1')), ['2026-11-12', '2026-11-16', '2026-11-18']);
});

test('extra lectures add to the backlog', () => {
  const plain = lecturesOf(makeSchedule());
  const extra = lecturesOf(makeSchedule({ addedDates: ['2026-11-20'] }));
  assert.equal(extra.behind, plain.behind + 1);
  assert.equal(extra.total, plain.total + 1);
});

test('validateSchedule rejects malformed extra dates or ones outside the semester', () => {
  assert.deepEqual(validateSchedule(makeSchedule({ addedDates: ['2026-11-20'] })), []);
  assert.match(validateSchedule(makeSchedule({ addedDates: ['soon'] })).join(' '), /Extra lecture 1/);
  assert.match(validateSchedule(makeSchedule({ addedDates: ['2026-11-20', '2027-01-10'] })).join(' '), /Extra lecture 2.*between/);
  assert.match(validateSchedule(makeSchedule({ addedDates: 'tuesday' })).join(' '), /Extra lectures are invalid/);
  const tooMany = Array.from({ length: MAX_ADDED_DATES + 1 }, () => '2026-11-20');
  assert.match(validateSchedule(makeSchedule({ addedDates: tooMany })).join(' '), new RegExp(`${MAX_ADDED_DATES}`));
});

test('extra lectures alone are enough for a schedule with no regular days', () => {
  const s = makeSchedule({ weekdays: [], addedDates: ['2026-11-20'] });
  assert.deepEqual(validateSchedule(s), []);
  assert.deepEqual(lectureDates(s), ['2026-11-20']);
});

test('storage keeps extra dates sorted', () => {
  const course = { id: 'algo', name: 'Algorithms', schedule: makeSchedule({ addedDates: ['2026-11-27', '2026-11-20'] }), watched: 0, milestones: [] };
  const loaded = parseState(serializeState({ weeklyHours: 20, courses: [course] }));
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state.courses[0].schedule.addedDates, ['2026-11-20', '2026-11-27']);
});

const wizardDraft = (lectures) => ({
  ...blankDraft(TODAY),
  name: 'Algorithms',
  lectures: { ...blankDraft(TODAY).lectures, ...lectures },
});

test('the wizard starts with no extra lectures and carries them into the course schedule', () => {
  assert.deepEqual(blankDraft(TODAY).lectures.extraDates, []);
  const draft = wizardDraft({ weekdays: [1, 3], startDate: '2026-11-02', endDate: '2026-12-06', extraDates: ['2026-11-20'] });
  assert.deepEqual(stepErrors('lectures', draft, TODAY), []);
  let n = 0;
  const { schedule } = buildCourse(draft, () => `id-${++n}`);
  assert.deepEqual(schedule.addedDates, ['2026-11-20']);
});

test('the wizard summary mentions extra lectures', () => {
  const draft = wizardDraft({ weekdays: [1, 3], startDate: '2026-11-02', endDate: '2026-12-06', extraDates: ['2026-11-20'] });
  assert.equal(courseSummary(draft, TODAY).lectures, 'Mon, Wed + 1 extra · 11 lectures (8 out, 0 watched)');
});
