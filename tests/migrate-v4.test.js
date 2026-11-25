import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateV4 } from '../src/course/migrate-v4.js';
import { parseState } from '../src/course/store.js';

const track = {
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

const unitPart = (overrides = {}) => ({
  id: 'p1', type: 'exam', unit: 'chapters', totalUnits: 6, doneUnits: 2, hoursPerUnit: 2, ...overrides,
});

const item = (overrides = {}) => ({
  id: 'i1', title: 'Midterm', course: 'Operating Systems', due: '2026-12-10', parts: [unitPart()], ...overrides,
});

const migrate = (raw) => migrateV4({ weeklyHours: 20, items: [], tracks: [], ...raw });

test('a track becomes a course with a schedule', () => {
  const { courses } = migrate({ tracks: [track] });
  assert.equal(courses.length, 1);
  assert.equal(courses[0].name, 'Operating Systems');
  assert.equal(courses[0].watched, 5);
  assert.deepEqual(courses[0].schedule, {
    weekdays: [1, 3],
    startDate: '2026-10-19',
    endDate: '2027-01-29',
    hoursPerLecture: 1.5,
    breaks: [{ from: '2026-12-24', to: '2027-01-02' }],
    addedDates: ['2027-01-08'],
    removedDates: [],
  });
  assert.deepEqual(courses[0].milestones, []);
});

test('deadlines join the course with the same name, case-insensitively', () => {
  const { courses } = migrate({ tracks: [track], items: [item({ course: ' operating systems ' })] });
  assert.equal(courses.length, 1);
  assert.deepEqual(courses[0].milestones, [{
    id: 'i1',
    kind: 'exam',
    title: 'Midterm',
    date: '2026-12-10',
    prep: { unit: 'chapters', total: 6, done: 2, hoursPerUnit: 2 },
  }]);
});

test('a deadline linked to a track joins that track course as an exam', () => {
  const linked = item({ course: 'Something else', parts: [{ id: 't', type: 'track', trackId: 'trk' }] });
  const { courses } = migrate({ tracks: [track], items: [linked] });
  assert.equal(courses.length, 1);
  assert.equal(courses[0].milestones[0].kind, 'exam');
  assert.equal(courses[0].milestones[0].prep, null);
});

test('a deadline with no track becomes a course of its own with no lectures', () => {
  const { courses } = migrate({ items: [item({ course: 'Algebra' })] });
  assert.equal(courses[0].name, 'Algebra');
  assert.equal(courses[0].schedule, null);
  assert.equal(courses[0].watched, 0);
});

test('deadlines with no course go to Unsorted', () => {
  const { courses } = migrate({ items: [item({ course: '' }), item({ id: 'i2', course: '  ' })] });
  assert.equal(courses.length, 1);
  assert.equal(courses[0].name, 'Unsorted');
  assert.equal(courses[0].milestones.length, 2);
});

test('assignment-only deadlines become assignments', () => {
  const hw = item({ parts: [unitPart({ type: 'assignment', unit: 'days', hoursPerUnit: 4 })] });
  assert.equal(migrate({ items: [hw] }).courses[0].milestones[0].kind, 'assignment');
});

test('several prep parts merge into hours', () => {
  const parts = [unitPart(), unitPart({ id: 'p2', type: 'custom', unit: 'days', totalUnits: 1, doneUnits: 0, hoursPerUnit: 4 })];
  const { prep } = migrate({ items: [item({ parts })] }).courses[0].milestones[0];
  assert.deepEqual(prep, { unit: 'hours', total: 16, done: 4, hoursPerUnit: 1 });
});

test('first-version single-effort items keep their effort as prep', () => {
  const legacy = {
    id: 'old', title: 'HW3', course: 'Algorithms', type: 'assignment', unit: 'days', totalUnits: 3, doneUnits: 1, hoursPerUnit: 4, due: '2026-12-01',
  };
  const [m] = migrate({ items: [legacy] }).courses[0].milestones;
  assert.equal(m.kind, 'assignment');
  assert.deepEqual(m.prep, { unit: 'days', total: 3, done: 1, hoursPerUnit: 4 });
});

test('a second track with the same course name gets its own numbered course', () => {
  const { courses } = migrate({ tracks: [track, { ...track, id: 'trk2', name: 'operating systems' }] });
  assert.deepEqual(courses.map((c) => c.name), ['Operating Systems', 'operating systems (2)']);
});

test('course ids are unique', () => {
  const { courses } = migrate({ tracks: [track], items: [item({ course: 'A' }), item({ id: 'i2', course: 'B' })] });
  assert.equal(new Set(courses.map((c) => c.id)).size, 3);
});

test('migrated v4 data passes v5 validation end to end', () => {
  const raw = JSON.stringify({
    version: 4,
    weeklyHours: 20,
    tracks: [track],
    items: [item(), item({ id: 'i2', course: '', parts: [unitPart({ type: 'assignment' })] })],
  });
  const result = parseState(raw);
  assert.equal(result.ok, true);
  assert.equal(result.state.courses.length, 2);
});
