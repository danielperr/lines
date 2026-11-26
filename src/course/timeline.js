// A course's semester as one dated list: lectures (numbered, with state),
// cancelled lectures, milestones and a "today" marker.

import { lectureDates, regularDates } from './schedule.js';

// Same-day order: today marker, then milestones (an exam happens before that
// day's lecture counts toward the next one), then lectures, then cancellations.
const TYPE_ORDER = Object.freeze({ today: 0, milestone: 1, lecture: 2, cancelled: 3 });

const lectureState = (index, date, course, todayIso) => {
  if (index < course.watched) return 'watched';
  return date <= todayIso ? 'out' : 'upcoming';
};

/** Lectures in order, each marked extra when it is not one of the regular weekday lectures. */
const lectureEntries = (course, todayIso) => {
  const { schedule } = course;
  const removed = new Set(schedule.removedDates);
  const regular = regularDates(schedule).filter((iso) => !removed.has(iso));
  const { entries } = lectureDates(schedule).reduce(({ left, entries: acc }, date, index) => {
    const at = left.indexOf(date);
    const extra = at === -1;
    const remaining = extra ? left : [...left.slice(0, at), ...left.slice(at + 1)];
    const entry = { type: 'lecture', date, number: index + 1, state: lectureState(index, date, course, todayIso), extra };
    return { left: remaining, entries: [...acc, entry] };
  }, { left: regular, entries: [] });
  return entries;
};

const cancelledEntries = (schedule) => schedule.removedDates.map((date) => ({ type: 'cancelled', date }));

const milestoneEntries = (course) => course.milestones.map((m) => ({
  type: 'milestone', date: m.date, id: m.id, kind: m.kind, title: m.title,
}));

/** Every dated entry for the course, in order. */
export const courseTimeline = (course, todayIso) => {
  const lectures = course.schedule ? [...lectureEntries(course, todayIso), ...cancelledEntries(course.schedule)] : [];
  return [...lectures, ...milestoneEntries(course), { type: 'today', date: todayIso }]
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => a.entry.date.localeCompare(b.entry.date)
      || TYPE_ORDER[a.entry.type] - TYPE_ORDER[b.entry.type]
      || a.i - b.i)
    .map(({ entry }) => entry);
};
