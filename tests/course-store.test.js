import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STATE, LEGACY_STORAGE_KEY, STORAGE_KEY, loadState, parseState, saveState, serializeState,
} from '../src/course/store.js';

const schedule = {
  weekdays: [1, 3],
  startDate: '2026-11-23',
  endDate: '2026-12-06',
  hoursPerLecture: 1.5,
  breaks: [{ from: '2026-11-30', to: '2026-11-30' }],
  addedDates: ['2026-11-27'],
  removedDates: ['2026-11-25'],
};

const course = {
  id: 'c1',
  name: 'Algorithms',
  schedule,
  watched: 1,
  milestones: [
    { id: 'm1', kind: 'exam', title: 'Midterm', date: '2026-12-10', prep: { unit: 'chapters', total: 5, done: 1, hoursPerUnit: 2 } },
    { id: 'm2', kind: 'assignment', title: 'HW1', date: '2026-12-01', prep: null },
  ],
};

const v5 = (overrides = {}) => JSON.stringify({ version: 5, weeklyHours: 20, courses: [course], ...overrides });

const memoryStorage = (entries = {}) => {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    dump: () => Object.fromEntries(map),
  };
};

test('round-trips a valid state', () => {
  const state = { weeklyHours: 20, courses: [course] };
  assert.deepEqual(parseState(serializeState(state)), { ok: true, state });
});

test('serializes with version 5', () => {
  assert.equal(JSON.parse(serializeState({ weeklyHours: 20, courses: [] })).version, 5);
});

test('empty input gives the default state', () => {
  assert.deepEqual(parseState(null), { ok: true, state: DEFAULT_STATE });
  assert.deepEqual(parseState(''), { ok: true, state: DEFAULT_STATE });
});

test('rejects malformed JSON and bad weekly hours', () => {
  assert.match(parseState('{nope').error, /not valid/i);
  assert.match(parseState(v5({ weeklyHours: 0 })).error, /weekly hours/i);
});

test('rejects a missing course list', () => {
  assert.match(parseState(JSON.stringify({ version: 5, weeklyHours: 20 })).error, /course list/i);
});

test('rejects an invalid course, naming it', () => {
  const result = parseState(v5({ courses: [{ ...course, watched: 99 }] }));
  assert.equal(result.ok, false);
  assert.match(result.error, /Algorithms/);
});

test('rejects duplicate course ids and duplicate names', () => {
  assert.match(parseState(v5({ courses: [course, { ...course, name: 'Other' }] })).error, /same id/i);
  assert.match(parseState(v5({ courses: [course, { ...course, id: 'c2', name: ' algorithms ' }] })).error, /same name/i);
});

test('drops unknown fields at every level', () => {
  const dirty = {
    ...course,
    junk: 1,
    schedule: { ...schedule, junk: 1 },
    milestones: [{ ...course.milestones[0], junk: 1, prep: { ...course.milestones[0].prep, junk: 1 } }],
  };
  const { state } = parseState(v5({ courses: [dirty] }));
  const [c] = state.courses;
  assert.equal('junk' in c, false);
  assert.equal('junk' in c.schedule, false);
  assert.equal('junk' in c.milestones[0], false);
  assert.equal('junk' in c.milestones[0].prep, false);
});

test('fills missing optional lists and prep', () => {
  const sparse = {
    ...course,
    schedule: { weekdays: [1], startDate: '2026-11-23', endDate: '2026-12-06', hoursPerLecture: 1 },
    milestones: [{ id: 'm1', kind: 'exam', title: 'Final', date: '2026-12-10' }],
  };
  const { state } = parseState(v5({ courses: [sparse] }));
  assert.deepEqual(state.courses[0].schedule.breaks, []);
  assert.deepEqual(state.courses[0].schedule.addedDates, []);
  assert.deepEqual(state.courses[0].schedule.removedDates, []);
  assert.equal(state.courses[0].milestones[0].prep, null);
});

test('migrates older data without a version', () => {
  const v4 = JSON.stringify({ weeklyHours: 12, items: [], tracks: [] });
  assert.deepEqual(parseState(v4), { ok: true, state: { weeklyHours: 12, courses: [] } });
});

test('loadState prefers the new key and falls back to migrating the old one', () => {
  const fresh = memoryStorage({ [STORAGE_KEY]: v5(), [LEGACY_STORAGE_KEY]: '{bad' });
  assert.equal(loadState(fresh).state.courses.length, 1);
  const old = memoryStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify({ weeklyHours: 9, items: [] }) });
  assert.deepEqual(loadState(old), { ok: true, state: { weeklyHours: 9, courses: [] } });
});

test('saveState writes only the new key, leaving old data as a backup', () => {
  const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: 'old' });
  assert.deepEqual(saveState({ weeklyHours: 20, courses: [] }, storage), { ok: true });
  assert.equal(storage.dump()[LEGACY_STORAGE_KEY], 'old');
  assert.equal(JSON.parse(storage.dump()[STORAGE_KEY]).version, 5);
});

test('saveState reports storage failures', () => {
  const broken = { setItem: () => { throw new Error('quota'); } };
  assert.match(saveState({ weeklyHours: 20, courses: [] }, broken).error, /quota/);
});
