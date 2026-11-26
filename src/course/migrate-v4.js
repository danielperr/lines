// One-way conversion of pre-course data (v1–v4: deadlines + lecture tracks,
// grouped only by a course text label) into v5 courses. Best effort: the
// result is validated by the v5 store afterwards.

const UNSORTED = 'Unsorted';
const TRACK_PART = 'track';

const keyOf = (name) => name.toLocaleLowerCase();
const trimmed = (text) => (typeof text === 'string' ? text.trim() : '');
const sumBy = (list, fn) => list.reduce((sum, x) => sum + fn(x), 0);

const scheduleFrom = (track) => ({
  weekdays: track.weekdays,
  startDate: track.startDate,
  endDate: track.endDate,
  hoursPerLecture: track.hoursPerLecture,
  breaks: Array.isArray(track.breaks) ? track.breaks.map(({ from, to }) => ({ from, to })) : [],
  addedDates: Array.isArray(track.extraDates) ? [...track.extraDates].sort() : [],
  removedDates: [],
});

/** First-version items stored one effort directly on the item. */
const partsOf = (item) => {
  if (Array.isArray(item.parts)) return item.parts;
  if (item.totalUnits === undefined) return [];
  return [{ type: item.type, unit: item.unit, totalUnits: item.totalUnits, doneUnits: item.doneUnits, hoursPerUnit: item.hoursPerUnit }];
};

const sameRate = (parts) => parts.every((p) => p.unit === parts[0].unit && p.hoursPerUnit === parts[0].hoursPerUnit);

const prepFrom = (unitParts) => {
  if (unitParts.length === 0) return null;
  if (sameRate(unitParts)) {
    const { unit, hoursPerUnit } = unitParts[0];
    return { unit, total: sumBy(unitParts, (p) => p.totalUnits), done: sumBy(unitParts, (p) => p.doneUnits), hoursPerUnit };
  }
  return {
    unit: 'hours',
    total: sumBy(unitParts, (p) => p.totalUnits * p.hoursPerUnit),
    done: sumBy(unitParts, (p) => p.doneUnits * p.hoursPerUnit),
    hoursPerUnit: 1,
  };
};

/** Exams make earlier lectures due, so only deadlines that clearly are exams become one. */
const kindFor = (linked, unitParts) => (linked || unitParts.some((p) => p.type === 'exam') ? 'exam' : 'assignment');

const milestoneFrom = (item, linked, unitParts) => ({
  id: item.id,
  kind: kindFor(linked, unitParts),
  title: item.title,
  date: item.due,
  prep: prepFrom(unitParts),
});

/** Name that no existing course uses yet: "X", then "X (2)", "X (3)"… */
const freeName = (byKey, name) => {
  const candidates = [name, ...Array.from({ length: byKey.size + 1 }, (_, i) => `${name} (${i + 2})`)];
  return candidates.find((n) => !byKey.has(keyOf(n)));
};

const addCourse = (acc, name, schedule, watched) => {
  const course = { id: `course-${acc.order.length + 1}`, name, schedule, watched, milestones: [] };
  return {
    order: [...acc.order, keyOf(name)],
    byKey: new Map(acc.byKey).set(keyOf(name), course),
    byTrack: acc.byTrack,
  };
};

const addTrack = (acc, track) => {
  const name = freeName(acc.byKey, trimmed(track.name) || UNSORTED);
  const next = addCourse(acc, name, scheduleFrom(track), track.watched ?? 0);
  return { ...next, byTrack: new Map(next.byTrack).set(track.id, keyOf(name)) };
};

const courseKeyForItem = (acc, item) => {
  const linkedTrack = partsOf(item).find((p) => p.type === TRACK_PART && acc.byTrack.has(p.trackId));
  if (linkedTrack) return { key: acc.byTrack.get(linkedTrack.trackId), linked: true };
  return { key: keyOf(trimmed(item.course) || UNSORTED), linked: false };
};

const addItem = (acc, item) => {
  const { key, linked } = courseKeyForItem(acc, item);
  const withCourse = acc.byKey.has(key) ? acc : addCourse(acc, trimmed(item.course) || UNSORTED, null, 0);
  const course = withCourse.byKey.get(key);
  const unitParts = partsOf(item).filter((p) => p.type !== TRACK_PART);
  const updated = { ...course, milestones: [...course.milestones, milestoneFrom(item, linked, unitParts)] };
  return { ...withCourse, byKey: new Map(withCourse.byKey).set(key, updated) };
};

/** Converts a raw v1–v4 state object into a raw v5 state object. */
export const migrateV4 = (raw) => {
  const tracks = Array.isArray(raw?.tracks) ? raw.tracks : [];
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const empty = { order: [], byKey: new Map(), byTrack: new Map() };
  const acc = items.reduce(addItem, tracks.reduce(addTrack, empty));
  return { version: 5, weeklyHours: raw?.weeklyHours, courses: acc.order.map((key) => acc.byKey.get(key)) };
};
