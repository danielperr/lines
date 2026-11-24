import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STATE, parseState, serializeState } from '../src/storage.js';

const validItem = {
  id: 'a1',
  title: 'OS exam',
  course: 'Operating Systems',
  due: '2026-12-10',
  parts: [
    { id: 'p1', type: 'lectures', unit: 'lectures', totalUnits: 12, doneUnits: 3, hoursPerUnit: 1.5 },
    { id: 'p2', type: 'exam', unit: 'days', totalUnits: 2, doneUnits: 0, hoursPerUnit: 4 },
  ],
};

const legacyItem = {
  id: 'old',
  title: 'HW3',
  course: 'Algorithms',
  type: 'assignment',
  unit: 'days',
  totalUnits: 3,
  doneUnits: 1,
  hoursPerUnit: 4,
  due: '2026-12-01',
};

const validTrack = {
  id: 'trk',
  name: 'Operating Systems',
  weekdays: [1, 3],
  startDate: '2026-10-19',
  endDate: '2027-01-29',
  hoursPerLecture: 1.5,
  watched: 5,
  breaks: [{ from: '2026-12-24', to: '2027-01-02' }],
  extraDates: ['2027-01-08'],
};

const linkedItem = { ...validItem, id: 'a2', parts: [{ id: 'p9', type: 'track', trackId: 'trk' }] };

test('round-trips a valid state', () => {
  const state = { weeklyHours: 25, items: [validItem, linkedItem], tracks: [validTrack] };
  assert.deepEqual(parseState(serializeState(state)), { ok: true, state });
});

test('empty or missing input gives the default state', () => {
  assert.deepEqual(parseState(null), { ok: true, state: DEFAULT_STATE });
  assert.deepEqual(parseState(''), { ok: true, state: DEFAULT_STATE });
});

test('rejects malformed JSON with a readable error', () => {
  const result = parseState('{not json');
  assert.equal(result.ok, false);
  assert.match(result.error, /not valid/i);
});

test('rejects invalid weekly hours', () => {
  const result = parseState(JSON.stringify({ weeklyHours: -3, items: [] }));
  assert.equal(result.ok, false);
  assert.match(result.error, /weekly hours/i);
});

test('rejects items that fail validation, naming the item', () => {
  const bad = { ...validItem, title: 'Broken', parts: [{ ...validItem.parts[0], totalUnits: 0 }] };
  const result = parseState(JSON.stringify({ weeklyHours: 20, items: [bad] }));
  assert.equal(result.ok, false);
  assert.match(result.error, /Broken/);
});

test('rejects unknown effort types and missing ids', () => {
  const badPart = { ...validItem.parts[0], type: 'nap' };
  const result1 = parseState(JSON.stringify({ weeklyHours: 20, items: [{ ...validItem, parts: [badPart] }] }));
  assert.equal(result1.ok, false);
  const result2 = parseState(JSON.stringify({ weeklyHours: 20, items: [{ ...validItem, id: '' }] }));
  assert.equal(result2.ok, false);
});

test('rejects duplicate part ids within an item', () => {
  const parts = [validItem.parts[0], { ...validItem.parts[1], id: 'p1' }];
  const result = parseState(JSON.stringify({ weeklyHours: 20, items: [{ ...validItem, parts }] }));
  assert.equal(result.ok, false);
});

test('drops unknown fields from items and parts', () => {
  const parts = [{ ...validItem.parts[0], junk: 1 }];
  const result = parseState(JSON.stringify({ weeklyHours: 20, items: [{ ...validItem, parts, extra: '<script>' }] }));
  assert.equal(result.ok, true);
  assert.equal('extra' in result.state.items[0], false);
  assert.equal('junk' in result.state.items[0].parts[0], false);
});

test('migrates single-effort items from the first version into one part', () => {
  const result = parseState(JSON.stringify({ weeklyHours: 20, items: [legacyItem] }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.items[0], {
    id: 'old',
    title: 'HW3',
    course: 'Algorithms',
    due: '2026-12-01',
    parts: [{ id: 'old-1', type: 'assignment', unit: 'days', totalUnits: 3, doneUnits: 1, hoursPerUnit: 4 }],
  });
});

test('older data without tracks loads with an empty track list', () => {
  const result = parseState(JSON.stringify({ weeklyHours: 20, items: [validItem] }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.tracks, []);
});

test('rejects invalid tracks, naming the track', () => {
  const bad = { ...validTrack, weekdays: [] };
  const result = parseState(JSON.stringify({ weeklyHours: 20, items: [], tracks: [bad] }));
  assert.equal(result.ok, false);
  assert.match(result.error, /Operating Systems/);
});

test('rejects items linked to a track that does not exist', () => {
  const result = parseState(JSON.stringify({ weeklyHours: 20, items: [linkedItem], tracks: [] }));
  assert.equal(result.ok, false);
});

test('drops unknown fields from tracks and track parts', () => {
  const parts = [{ ...linkedItem.parts[0], unit: 'x', junk: 1 }];
  const result = parseState(JSON.stringify({
    weeklyHours: 20,
    items: [{ ...linkedItem, parts }],
    tracks: [{ ...validTrack, junk: 1 }],
  }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.items[0].parts[0], { id: 'p9', type: 'track', trackId: 'trk' });
  assert.equal('junk' in result.state.tracks[0], false);
});
