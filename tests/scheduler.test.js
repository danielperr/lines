import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  daysBetween,
  hoursLeft,
  itemProgress,
  validateItem,
  planSchedule,
  todaysTask,
} from '../src/scheduler.js';

const TODAY = '2026-11-23';

const makePart = (overrides = {}) => ({
  id: 'p1',
  type: 'custom',
  unit: 'hours',
  totalUnits: 1,
  doneUnits: 0,
  hoursPerUnit: 1,
  ...overrides,
});

/** Item with a single 1h-per-unit part of `hours` units, unless parts are given. */
const makeItem = ({ hours = 1, parts, ...overrides } = {}) => ({
  id: 'x',
  title: 'Item',
  course: 'Course',
  due: addDays(TODAY, 10),
  parts: parts ?? [makePart({ totalUnits: hours })],
  ...overrides,
});

const examParts = () => [
  makePart({ id: 'lec', type: 'lectures', unit: 'lectures', totalUnits: 10, doneUnits: 4, hoursPerUnit: 1.5 }),
  makePart({ id: 'study', type: 'assignment', unit: 'days', totalUnits: 2, doneUnits: 0, hoursPerUnit: 4 }),
];

test('daysBetween counts calendar days, unaffected by DST', () => {
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  assert.equal(daysBetween('2026-11-23', '2026-11-20'), -3);
});

test('addDays crosses month boundaries', () => {
  assert.equal(addDays('2026-11-29', 3), '2026-12-02');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('hoursLeft sums every part of a mixed deadline', () => {
  // 6 lectures × 1.5h + 2 days × 4h = 17h
  assert.equal(hoursLeft(makeItem({ parts: examParts() })), 17);
});

test('hoursLeft never counts over-completed parts as negative', () => {
  const parts = [makePart({ totalUnits: 3, doneUnits: 5 }), makePart({ id: 'p2', totalUnits: 2 })];
  assert.equal(hoursLeft(makeItem({ parts })), 2);
});

test('itemProgress is weighted by hours, not units', () => {
  // done: 4 × 1.5 = 6h of 15 + 8 = 23h total
  assert.equal(itemProgress(makeItem({ parts: examParts() })), 6 / 23);
});

test('validateItem accepts a valid mixed deadline', () => {
  assert.deepEqual(validateItem(makeItem({ parts: examParts() })), []);
});

test('validateItem reports item-level problems', () => {
  const errors = validateItem(makeItem({ title: '  ', due: '2026-13-40' }));
  assert.equal(errors.length, 2);
});

test('validateItem requires at least one part', () => {
  assert.equal(validateItem(makeItem({ parts: [] })).length, 1);
});

test('validateItem reports problems per part, numbered', () => {
  const parts = [
    makePart(),
    makePart({ id: 'p2', unit: ' ', totalUnits: 0, doneUnits: -1, hoursPerUnit: 0 }),
  ];
  const errors = validateItem(makeItem({ parts }));
  assert.equal(errors.length, 4);
  assert.ok(errors.every((e) => e.startsWith('Part 2:')));
});

test('validateItem rejects done units above total', () => {
  const errors = validateItem(makeItem({ parts: [makePart({ totalUnits: 2, doneUnits: 3 })] }));
  assert.equal(errors.length, 1);
});

test('planSchedule computes slack for a single item', () => {
  // 14h/week = 2h/day. 6h of work, 10 days available = 20h -> 14h slack = 7 days.
  const { active } = planSchedule([makeItem({ hours: 6 })], 14, TODAY);
  const [item] = active;
  assert.equal(item.hoursLeft, 6);
  assert.equal(item.slackHours, 14);
  assert.equal(item.slackDays, 7);
  assert.equal(item.startBy, addDays(TODAY, 7));
  assert.equal(item.status, 'ok');
});

test('planSchedule uses the combined hours of all parts', () => {
  // 17h of mixed work, 10 days × 2h = 20h -> 3h slack.
  const { active } = planSchedule([makeItem({ parts: examParts() })], 14, TODAY);
  assert.equal(active[0].slackHours, 3);
  assert.equal(active[0].status, 'tight');
});

test('planSchedule accounts for competing deadlines sharing the same hours', () => {
  const a = makeItem({ id: 'a', hours: 6, due: addDays(TODAY, 5) });
  const b = makeItem({ id: 'b', hours: 8, due: addDays(TODAY, 6) });
  const { active } = planSchedule([a, b], 14, TODAY);
  // B alone would have 12 - 8 = 4h slack, but A eats 6h first: 12 - 14 = -2h.
  assert.deepEqual(active.map((i) => i.id), ['b', 'a']);
  assert.equal(active[0].slackHours, -2);
  assert.equal(active[0].status, 'behind');
  assert.equal(active[1].slackHours, 4);
  assert.equal(active[1].status, 'ok');
});

test('planSchedule ranks a big later deadline above a small sooner one', () => {
  const small = makeItem({ id: 'small', hours: 2, due: addDays(TODAY, 5) });
  const big = makeItem({ id: 'big', hours: 16, due: addDays(TODAY, 10) });
  const { active } = planSchedule([small, big], 14, TODAY);
  assert.deepEqual(active.map((i) => i.id), ['big', 'small']);
  assert.equal(active[0].status, 'tight');
});

test('items sharing a due date share the same slack', () => {
  const due = addDays(TODAY, 4);
  const { active } = planSchedule([
    makeItem({ id: 'p', hours: 2, due }),
    makeItem({ id: 'q', hours: 3, due }),
  ], 14, TODAY);
  assert.equal(active[0].slackHours, 3);
  assert.equal(active[1].slackHours, 3);
});

test('past-due items with work left are overdue', () => {
  const { active } = planSchedule([makeItem({ due: addDays(TODAY, -1) })], 14, TODAY);
  assert.equal(active[0].status, 'overdue');
});

test('an item is done only when every part is done', () => {
  const finished = makeItem({ id: 'done', parts: [makePart({ totalUnits: 5, doneUnits: 5 })], due: addDays(TODAY, 1) });
  const halfDone = makeItem({
    id: 'half',
    parts: [makePart({ totalUnits: 5, doneUnits: 5 }), makePart({ id: 'p2', totalUnits: 2 })],
    due: addDays(TODAY, 2),
  });
  const { active, done } = planSchedule([finished, halfDone], 14, TODAY);
  assert.deepEqual(active.map((i) => i.id), ['half']);
  assert.deepEqual(done.map((i) => i.id), ['done']);
  assert.equal(active[0].slackHours, 2);
});

test('planSchedule does not mutate its input', () => {
  const item = Object.freeze({ ...makeItem(), parts: Object.freeze([Object.freeze(makePart())]) });
  assert.doesNotThrow(() => planSchedule(Object.freeze([item]), 14, TODAY));
});

test('planSchedule rejects non-positive weekly hours', () => {
  assert.throws(() => planSchedule([], 0, TODAY), /weekly hours/i);
  assert.throws(() => planSchedule([], Number.NaN, TODAY), /weekly hours/i);
});

test('todaysTask suggests about a day of work from the first unfinished part', () => {
  // 2h/day, lectures are 1.5h each -> 2 lectures (3h).
  const task = todaysTask(makeItem({ parts: examParts() }), 14);
  assert.deepEqual(task, [{ partId: 'lec', unit: 'lectures', units: 2, hours: 3 }]);
});

test('todaysTask continues into the next part when the first runs out', () => {
  const parts = examParts().map((p) => (p.id === 'lec' ? { ...p, doneUnits: 9 } : p));
  // 1 lecture left (1.5h), 0.5h of budget remains -> 1 study day.
  const task = todaysTask(makeItem({ parts }), 14);
  assert.deepEqual(task, [
    { partId: 'lec', unit: 'lectures', units: 1, hours: 1.5 },
    { partId: 'study', unit: 'days', units: 1, hours: 4 },
  ]);
});

test('todaysTask skips finished parts', () => {
  const parts = examParts().map((p) => (p.id === 'lec' ? { ...p, doneUnits: 10 } : p));
  const task = todaysTask(makeItem({ parts }), 14);
  assert.deepEqual(task, [{ partId: 'study', unit: 'days', units: 1, hours: 4 }]);
});
