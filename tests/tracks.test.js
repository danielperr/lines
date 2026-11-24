import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSchedule, todaysTask, validateItem } from '../src/scheduler.js';
import { lectureDates, validateTrack } from '../src/tracks.js';

// Monday. 14h/week = 2h/day throughout.
const TODAY = '2026-11-23';
const WEEKLY = 14;
const MON = 1;
const WED = 3;

/**
 * Mon/Wed lectures, Nov 2 – Dec 6: 10 lectures in total.
 * Released by today (inclusive): Nov 2, 4, 9, 11, 16, 18, 23 = 7.
 * Still to come: Nov 25, Nov 30, Dec 2.
 * 4 watched -> 3 behind.
 */
const makeTrack = (overrides = {}) => ({
  id: 'algo',
  name: 'Algorithms',
  weekdays: [MON, WED],
  startDate: '2026-11-02',
  endDate: '2026-12-06',
  hoursPerLecture: 1.5,
  watched: 4,
  ...overrides,
});

const trackPart = (trackId = 'algo', id = 't') => ({ id, type: 'track', trackId });

const unitPart = (overrides = {}) => ({
  id: 's', type: 'custom', unit: 'hours', totalUnits: 4, doneUnits: 0, hoursPerUnit: 1, ...overrides,
});

const makeItem = (overrides = {}) => ({
  id: 'exam', title: 'Exam', course: 'Algorithms', due: '2026-12-01', parts: [trackPart()], ...overrides,
});

test('lectureDates lists every lecture weekday in the semester', () => {
  const track = makeTrack({ startDate: '2026-11-23', endDate: '2026-12-06' });
  assert.deepEqual(lectureDates(track), ['2026-11-23', '2026-11-25', '2026-11-30', '2026-12-02']);
});

test('validateTrack accepts a valid track', () => {
  assert.deepEqual(validateTrack(makeTrack()), []);
});

test('validateTrack reports each problem', () => {
  const errors = validateTrack(makeTrack({
    name: ' ', weekdays: [], startDate: '2026-12-10', endDate: '2026-12-01', hoursPerLecture: 0,
  }));
  assert.equal(errors.length, 4);
});

test('validateTrack rejects more watched lectures than exist', () => {
  assert.equal(validateTrack(makeTrack({ watched: 11 })).length, 1);
});

test('validateTrack rejects bad weekday values', () => {
  assert.equal(validateTrack(makeTrack({ weekdays: [1, 9] })).length, 1);
});

test('track summary shows the backlog and what is coming', () => {
  const { tracks } = planSchedule([], WEEKLY, TODAY, [makeTrack()]);
  const [t] = tracks;
  assert.equal(t.total, 10);
  assert.equal(t.released, 7);
  assert.equal(t.behind, 3);
  assert.equal(t.hoursBehind, 4.5);
  assert.equal(t.nextRelease, '2026-11-25');
  assert.equal(t.hoursLeft, 9);
  assert.deepEqual(t.linkedTitles, []);
  assert.notEqual(t.status, 'done');
});

test('a fully watched track is done', () => {
  const { tracks } = planSchedule([], WEEKLY, TODAY, [makeTrack({ watched: 10 })]);
  assert.equal(tracks[0].status, 'done');
});

test('a linked exam picks up the lectures released before its date', () => {
  const { active, tracks } = planSchedule([makeItem()], WEEKLY, TODAY, [makeTrack()]);
  const [exam] = active;
  // Lectures before Dec 1: 9 (through Nov 30). 4 watched -> 5 left = 7.5h.
  assert.equal(exam.hoursLeft, 7.5);
  const [effort] = exam.effort;
  assert.equal(effort.kind, 'track');
  assert.equal(effort.done, 4);
  assert.equal(effort.total, 9);
  // Only released, unwatched lectures can be watched now: Nov 16, 18, 23.
  assert.equal(effort.available, 3);
  assert.deepEqual(tracks[0].linkedTitles, ['Exam']);
});

test('two linked deadlines split the track between them', () => {
  const midterm = makeItem({ id: 'mid', title: 'Midterm', due: '2026-11-26' });
  const final = makeItem({ id: 'fin', title: 'Final', due: '2026-12-07' });
  const { active } = planSchedule([midterm, final], WEEKLY, TODAY, [makeTrack()]);
  const byId = Object.fromEntries(active.map((i) => [i.id, i.effort[0]]));
  assert.deepEqual([byId.mid.done, byId.mid.total], [4, 8]);
  assert.deepEqual([byId.fin.done, byId.fin.total], [0, 2]);
});

test('a lecture cannot be watched before it is released', () => {
  // Exam in 10 days: 4h of study (available now) + one 3h lecture released the day before.
  // Ignoring release dates: 20h - 7h = 13h slack. In reality the lecture must fit in 2h.
  const track = makeTrack({ weekdays: [WED], startDate: '2026-12-02', endDate: '2026-12-02', hoursPerLecture: 3, watched: 0 });
  const exam = makeItem({ due: '2026-12-03', parts: [unitPart(), trackPart()] });
  const { active } = planSchedule([exam], WEEKLY, TODAY, [track]);
  assert.equal(active[0].slackHours, -1);
  assert.equal(active[0].status, 'behind');
});

test('linked lectures compete with other deadlines for the same hours', () => {
  // Assignment (6h) due Dec 1; exam Dec 3 needs 6 unwatched lectures (9h).
  // 10 days × 2h = 20h - 15h = 5h spare (every late-released lecture still fits).
  const assignment = { id: 'hw', title: 'HW', course: 'X', due: '2026-12-01', parts: [unitPart({ totalUnits: 6 })] };
  const exam = makeItem({ due: '2026-12-03' });
  const { active } = planSchedule([assignment, exam], WEEKLY, TODAY, [makeTrack()]);
  const planned = Object.fromEntries(active.map((i) => [i.id, i]));
  assert.equal(planned.exam.slackHours, 5);
  assert.equal(planned.exam.status, 'ok');
  assert.equal(planned.hw.slackHours, 10);
});

test('watching lectures restores slack', () => {
  const track = makeTrack({ weekdays: [WED], startDate: '2026-12-02', endDate: '2026-12-02', hoursPerLecture: 3, watched: 1 });
  const exam = makeItem({ due: '2026-12-03', parts: [unitPart(), trackPart()] });
  const { active } = planSchedule([exam], WEEKLY, TODAY, [track]);
  assert.equal(active[0].slackHours, 16);
});

test('todaysTask only suggests lectures that are already out', () => {
  // 6 watched -> only the Nov 23 lecture is released and unwatched.
  const exam = makeItem({ parts: [trackPart(), unitPart()] });
  const { active } = planSchedule([exam], WEEKLY, TODAY, [makeTrack({ watched: 6 })]);
  assert.deepEqual(todaysTask(active[0], WEEKLY), [
    { partId: 't', unit: 'lectures', units: 1, hours: 1.5 },
    { partId: 's', unit: 'hours', units: 1, hours: 1 },
  ]);
});

test('an exam whose lectures are all watched (and nothing else left) is done', () => {
  const exam = makeItem({ due: '2026-11-24' });
  const { active, done } = planSchedule([exam], WEEKLY, TODAY, [makeTrack({ watched: 7 })]);
  assert.equal(active.length, 0);
  assert.deepEqual(done.map((i) => i.id), ['exam']);
});

test('validateItem checks track links when track ids are given', () => {
  assert.deepEqual(validateItem(makeItem(), ['algo']), []);
  assert.equal(validateItem(makeItem(), ['other']).length, 1);
  assert.equal(validateItem(makeItem({ parts: [trackPart('algo', 'a'), trackPart('algo', 'b')] }), ['algo']).length, 1);
});
