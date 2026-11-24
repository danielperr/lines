import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSchedule } from '../src/scheduler.js';
import { parseState, serializeState } from '../src/storage.js';
import { MAX_BREAKS, lectureDates, releasedBy, validateTrack } from '../src/tracks.js';

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
  ...overrides,
});

test('lectures inside a break range are not counted', () => {
  // Nov 9 – Nov 13 removes Mon 9 and Wed 11.
  const track = makeTrack({ breaks: [{ from: '2026-11-09', to: '2026-11-13' }] });
  assert.equal(lectureDates(track).length, 8);
  assert.equal(lectureDates(track).includes('2026-11-09'), false);
  assert.equal(lectureDates(track).includes('2026-11-11'), false);
  assert.equal(releasedBy(track, TODAY), 5);
});

test('a single-day break removes just that day, and break edges are inclusive', () => {
  const track = makeTrack({ breaks: [{ from: '2026-11-16', to: '2026-11-16' }, { from: '2026-12-02', to: '2026-12-06' }] });
  assert.deepEqual(lectureDates(track), [
    '2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11', '2026-11-18', '2026-11-23', '2026-11-25', '2026-11-30',
  ]);
});

test('breaks outside the semester or on non-lecture days change nothing', () => {
  const track = makeTrack({ breaks: [{ from: '2026-08-01', to: '2026-08-31' }, { from: '2026-11-14', to: '2026-11-15' }] });
  assert.equal(lectureDates(track).length, 10);
});

test('breaks shrink the backlog shown on the track', () => {
  const plain = planSchedule([], 14, TODAY, [makeTrack()]).tracks[0];
  const withBreak = planSchedule([], 14, TODAY, [makeTrack({ breaks: [{ from: '2026-11-16', to: '2026-11-18' }] })]).tracks[0];
  assert.equal(plain.behind, 3);
  assert.equal(withBreak.behind, 1);
  assert.equal(withBreak.total, 8);
});

test('validateTrack rejects malformed or reversed breaks', () => {
  assert.deepEqual(validateTrack(makeTrack()), []);
  assert.match(validateTrack(makeTrack({ breaks: [{ from: '2026-11-20', to: '2026-11-10' }] })).join(' '), /Break 1/);
  assert.match(validateTrack(makeTrack({ breaks: [{ from: 'soon', to: '2026-11-10' }] })).join(' '), /Break 1/);
  assert.match(validateTrack(makeTrack({ breaks: 'none' })).join(' '), /Breaks/);
  const tooMany = Array.from({ length: MAX_BREAKS + 1 }, () => ({ from: '2026-11-09', to: '2026-11-09' }));
  assert.match(validateTrack(makeTrack({ breaks: tooMany })).join(' '), new RegExp(`${MAX_BREAKS}`));
});

test('validateTrack rejects breaks that cover every lecture', () => {
  const errors = validateTrack(makeTrack({ watched: 0, breaks: [{ from: '2026-11-01', to: '2026-12-31' }] }));
  assert.match(errors.join(' '), /No lectures/);
});

test('storage keeps breaks, drops their unknown fields, and defaults to none', () => {
  const track = makeTrack({ breaks: [{ from: '2026-11-09', to: '2026-11-13', junk: true }] });
  const loaded = parseState(serializeState({ weeklyHours: 20, items: [], tracks: [track] }));
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state.tracks[0].breaks, [{ from: '2026-11-09', to: '2026-11-13' }]);

  const { breaks, ...older } = makeTrack();
  const legacy = parseState(JSON.stringify({ weeklyHours: 20, items: [], tracks: [older] }));
  assert.equal(legacy.ok, true);
  assert.deepEqual(legacy.state.tracks[0].breaks, []);
});
