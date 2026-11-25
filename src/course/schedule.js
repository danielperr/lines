// A course's weekly lecture schedule: fixed weekdays between the first lecture
// and semester end, minus breaks and one-off cancellations, plus one-off extra
// lectures. Pure — no DOM, no storage.

import { addDays, daysBetween, dayOfWeek, isValidIsoDate } from '../dates.js';

export const WEEKDAY_NAMES = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
export const MAX_SEMESTER_DAYS = 400;
export const MAX_BREAKS = 30;
export const MAX_ADDED_DATES = 60;
export const MAX_REMOVED_DATES = 60;

const isPositiveNumber = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;

const datesAreUsable = (s) =>
  isValidIsoDate(s.startDate) && isValidIsoDate(s.endDate)
  && daysBetween(s.startDate, s.endDate) >= 0
  && daysBetween(s.startDate, s.endDate) <= MAX_SEMESTER_DAYS;

const weekdaysAreValid = (weekdays) =>
  Array.isArray(weekdays) && weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  && new Set(weekdays).size === weekdays.length;

const breaksOf = (s) => s.breaks ?? [];
const addedOf = (s) => s.addedDates ?? [];
const removedOf = (s) => s.removedDates ?? [];

const isOnBreak = (s, iso) => breaksOf(s).some((b) => b.from <= iso && iso <= b.to);

const isInSemester = (s, iso) => datesAreUsable(s) && s.startDate <= iso && iso <= s.endDate;

/** Regular weekday lectures outside breaks, before one-off changes. */
export const regularDates = (s) => {
  const span = daysBetween(s.startDate, s.endDate);
  return Array.from({ length: span + 1 }, (_, i) => addDays(s.startDate, i))
    .filter((iso) => s.weekdays.includes(dayOfWeek(iso)) && !isOnBreak(s, iso));
};

/**
 * Date of every lecture, in order. Cancelled dates drop a regular lecture;
 * extra lectures happen even during a break, and on a regular day count as a
 * second lecture.
 */
export const lectureDates = (s) => {
  const removed = new Set(removedOf(s));
  return [...regularDates(s).filter((iso) => !removed.has(iso)), ...addedOf(s)].sort();
};

/** How many lectures are out by the given date (inclusive). */
export const releasedBy = (s, iso) => lectureDates(s).filter((d) => d <= iso).length;

// ---- Validation ----

const breakProblem = (b, index) => {
  const ok = isValidIsoDate(b?.from) && isValidIsoDate(b?.to) && b.from <= b.to;
  return ok ? null : `Break ${index + 1} needs a start date on or before its end date.`;
};

const listShapeError = (list, max, label) => {
  if (list === undefined) return null;
  if (!Array.isArray(list)) return `${label}s are invalid.`;
  return list.length > max ? `At most ${max} ${label.toLowerCase()}s per course.` : null;
};

const breaksErrors = (s) => {
  const shape = listShapeError(s.breaks, MAX_BREAKS, 'Break');
  return shape ? [shape] : breaksOf(s).map(breakProblem).filter(Boolean);
};

const addedErrors = (s) => {
  const shape = listShapeError(s.addedDates, MAX_ADDED_DATES, 'Extra lecture');
  if (shape) return [shape];
  return addedOf(s).map((iso, i) => (isValidIsoDate(iso) && isInSemester(s, iso)
    ? null
    : `Extra lecture ${i + 1} must be between the first lecture and semester end.`)).filter(Boolean);
};

const removedErrors = (s) => {
  const shape = listShapeError(s.removedDates, MAX_REMOVED_DATES, 'Cancelled lecture');
  if (shape) return [shape];
  const regular = new Set(regularDates(s));
  return removedOf(s).map((iso, i) => (regular.has(iso)
    ? null
    : `Cancelled lecture ${i + 1} is not on a regular lecture day.`)).filter(Boolean);
};

const basicErrors = (s) => {
  const errors = [];
  if (!weekdaysAreValid(s.weekdays)) errors.push('Lecture days are invalid.');
  else if (s.weekdays.length === 0 && addedOf(s).length === 0) errors.push('Pick at least one lecture day.');
  if (!datesAreUsable(s)) errors.push(`Semester dates must be in order and at most ${MAX_SEMESTER_DAYS} days apart.`);
  if (!isPositiveNumber(s.hoursPerLecture)) errors.push('Hours per lecture must be greater than 0.');
  return errors;
};

/** Returns human-readable problems; empty means valid. */
export const validateSchedule = (s) => {
  if (s === null || typeof s !== 'object') return ['The lecture schedule is invalid.'];
  const errors = [...basicErrors(s), ...breaksErrors(s)];
  if (errors.length) return errors;
  const dateErrors = [...addedErrors(s), ...removedErrors(s)];
  if (dateErrors.length) return dateErrors;
  return lectureDates(s).length === 0 ? ['No lectures fall on those days between the semester dates.'] : [];
};

// ---- One-off changes (immutable) ----

const withoutOne = (list, iso) => {
  const index = list.indexOf(iso);
  return index === -1 ? list : [...list.slice(0, index), ...list.slice(index + 1)];
};

/** Cancel the lecture on `iso`: drops an extra lecture if there is one, else cancels the regular one. */
export const withLectureRemoved = (s, iso) => (addedOf(s).includes(iso)
  ? { ...s, addedDates: withoutOne(addedOf(s), iso) }
  : { ...s, removedDates: [...removedOf(s), iso].sort() });

/** Add a lecture on `iso`: restores a cancelled one if there is one, else adds an extra lecture. */
export const withLectureAdded = (s, iso) => (removedOf(s).includes(iso)
  ? { ...s, removedDates: withoutOne(removedOf(s), iso) }
  : { ...s, addedDates: [...addedOf(s), iso].sort() });

/** Drops cancellations that no longer fall on a regular lecture day (e.g. after the weekdays changed). */
export const pruneRemoved = (s) => {
  const regular = new Set(regularDates(s));
  return { ...s, removedDates: removedOf(s).filter((iso) => regular.has(iso)) };
};
