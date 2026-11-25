import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSchedule } from '../src/scheduler.js';
import { parseState, serializeState } from '../src/storage.js';
import { MAX_EXTRA_DATES, lectureDates, releasedBy, validateTrack } from '../src/tracks.js';
import { blankDraft, buildCourse, courseSummary, stepErrors } from '../src/course-wizard.js';

const TODAY = '2026-11-23'; // Monday

/** Mon/Wed, Nov 2 – Dec 6: 10 lectures; 7 out by today. */
const makeTrack = (overrides = {}) => ({
  id: 'algo',
  name: 'Algorithms',
  weekdays: [1, 3],
  startDate: '2026-11-02',
  endDate: '2026-12-06',
  hoursPerLecture: 1.5,
  watched: 4,
  breaks: [],
  extraDates: [],
  ...overrides,
});

test('an extra lecture on a non-lecture day is added in date order', () => {
  const track = makeTrack({ extraDates: ['2026-11-20'] }); // Friday
  const dates = lectureDates(track);
  assert.equal(dates.length, 11);
  assert.deepEqual(dates.slice(5, 8), ['2026-11-18', '2026-11-20', '2026-11-23']);
  assert.equal(releasedBy(track, TODAY), 8);
});

test('an extra lecture on a regular lecture day counts as a second lecture', () => {
  const track = makeTrack({ extraDates: ['2026-11-04'] });
  assert.equal(lectureDates(track).filter((d) => d === '2026-11-04').length, 2);
});

test('an extra lecture during a break still happens', () => {
  const track = makeTrack({ breaks: [{ from: '2026-11-09', to: '2026-11-13' }], extraDates: ['2026-11-12'] });
  assert.deepEqual(lectureDates(track).filter((d) => d.startsWith('2026-11-1')), ['2026-11-12', '2026-11-16', '2026-11-18']);
});

test('extra lectures add to the backlog', () => {
  const plain = planSchedule([], 14, TODAY, [makeTrack()]).tracks[0];
  const extra = planSchedule([], 14, TODAY, [makeTrack({ extraDates: ['2026-11-20'] })]).tracks[0];
  assert.equal(extra.behind, plain.behind + 1);
  assert.equal(extra.total, plain.total + 1);
});

test('validateTrack rejects malformed extra dates or ones outside the semester', () => {
  assert.deepEqual(validateTrack(makeTrack({ extraDates: ['2026-11-20'] })), []);
  assert.match(validateTrack(makeTrack({ extraDates: ['soon'] })).join(' '), /Extra lecture 1/);
  assert.match(validateTrack(makeTrack({ extraDates: ['2026-11-20', '2027-01-10'] })).join(' '), /Extra lecture 2.*between/);
  assert.match(validateTrack(makeTrack({ extraDates: 'tuesday' })).join(' '), /Extra lectures are invalid/);
  const tooMany = Array.from({ length: MAX_EXTRA_DATES + 1 }, () => '2026-11-20');
  assert.match(validateTrack(makeTrack({ extraDates: tooMany })).join(' '), new RegExp(`${MAX_EXTRA_DATES}`));
});

test('extra lectures alone are enough for a track with no regular days', () => {
  const track = makeTrack({ weekdays: [], watched: 0, extraDates: ['2026-11-20'] });
  assert.deepEqual(validateTrack(track), []);
  assert.deepEqual(lectureDates(track), ['2026-11-20']);
});

test('storage keeps extra dates, sorted, and defaults older tracks to none', () => {
  const track = makeTrack({ extraDates: ['2026-11-27', '2026-11-20'] });
  const loaded = parseState(serializeState({ weeklyHours: 20, items: [], tracks: [track] }));
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state.tracks[0].extraDates, ['2026-11-20', '2026-11-27']);

  const { extraDates, ...older } = makeTrack();
  const legacy = parseState(JSON.stringify({ weeklyHours: 20, items: [], tracks: [older] }));
  assert.equal(legacy.ok, true);
  assert.deepEqual(legacy.state.tracks[0].extraDates, []);
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
