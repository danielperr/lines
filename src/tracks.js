// Lecture tracks: recorded lectures released on fixed weekdays until semester end,
// minus breaks, plus any extra (make-up) lectures on specific dates.
// A lecture has no deadline of its own — it is due by the next exam/assignment
// linked to its track, or by semester end if nothing later links to it.

import { addDays, daysBetween, dayOfWeek, isValidIsoDate } from './dates.js';

export const WEEKDAY_NAMES = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
export const MAX_SEMESTER_DAYS = 400;
export const MAX_BREAKS = 30;
export const MAX_EXTRA_DATES = 60;

const isPositiveNumber = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;

const datesAreUsable = (track) =>
  isValidIsoDate(track.startDate) && isValidIsoDate(track.endDate)
  && daysBetween(track.startDate, track.endDate) >= 0
  && daysBetween(track.startDate, track.endDate) <= MAX_SEMESTER_DAYS;

const weekdaysAreValid = (weekdays) =>
  Array.isArray(weekdays) && weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  && new Set(weekdays).size === weekdays.length;

const breaksOf = (track) => track.breaks ?? [];
const extrasOf = (track) => track.extraDates ?? [];

/** True when the date falls inside one of the track's breaks (both ends inclusive). */
const isOnBreak = (track, iso) => breaksOf(track).some((b) => b.from <= iso && iso <= b.to);

/**
 * Release date of every lecture in the track, in order: regular weekdays
 * outside breaks, plus extra lectures (which happen even during a break, and
 * on a regular day count as a second lecture).
 */
export const lectureDates = (track) => {
  const span = daysBetween(track.startDate, track.endDate);
  const regular = Array.from({ length: span + 1 }, (_, i) => addDays(track.startDate, i))
    .filter((iso) => track.weekdays.includes(dayOfWeek(iso)) && !isOnBreak(track, iso));
  return [...regular, ...extrasOf(track)].sort();
};

const breakProblem = (b, index) => {
  const ok = isValidIsoDate(b?.from) && isValidIsoDate(b?.to) && b.from <= b.to;
  return ok ? null : `Break ${index + 1} needs a start date on or before its end date.`;
};

const breaksErrors = (breaks) => {
  if (breaks === undefined) return [];
  if (!Array.isArray(breaks)) return ['Breaks are invalid.'];
  if (breaks.length > MAX_BREAKS) return [`At most ${MAX_BREAKS} breaks per track.`];
  return breaks.map(breakProblem).filter(Boolean);
};

const extraProblem = (track) => (iso, index) => {
  if (!isValidIsoDate(iso)) return `Extra lecture ${index + 1} needs a date.`;
  const inside = datesAreUsable(track) && track.startDate <= iso && iso <= track.endDate;
  return inside ? null : `Extra lecture ${index + 1} must be between the first lecture and semester end.`;
};

const extrasErrors = (track) => {
  const extras = track.extraDates;
  if (extras === undefined) return [];
  if (!Array.isArray(extras)) return ['Extra lectures are invalid.'];
  if (extras.length > MAX_EXTRA_DATES) return [`At most ${MAX_EXTRA_DATES} extra lectures per track.`];
  return extras.map(extraProblem(track)).filter(Boolean);
};

/** Returns a list of human-readable problems; empty means valid. */
export const validateTrack = (track) => {
  const errors = [];
  if (typeof track.name !== 'string' || track.name.trim() === '') errors.push('Name is required.');
  if (!weekdaysAreValid(track.weekdays)) errors.push('Lecture days are invalid.');
  else if (track.weekdays.length === 0 && extrasOf(track).length === 0) errors.push('Pick at least one lecture day.');
  if (!datesAreUsable(track)) errors.push(`Semester dates must be in order and at most ${MAX_SEMESTER_DAYS} days apart.`);
  if (!isPositiveNumber(track.hoursPerLecture)) errors.push('Hours per lecture must be greater than 0.');
  errors.push(...breaksErrors(track.breaks));
  if (datesAreUsable(track)) errors.push(...extrasErrors(track));
  if (!Number.isInteger(track.watched) || track.watched < 0) {
    errors.push('Watched lectures must be a whole number, 0 or more.');
  } else if (errors.length === 0) {
    const total = lectureDates(track).length;
    if (total === 0) errors.push('No lectures fall on those days between the semester dates.');
    else if (track.watched > total) errors.push(`Watched lectures cannot exceed the ${total} in the semester.`);
  }
  return errors;
};

/**
 * Every lecture with its release date, the date it is due by, and whether it
 * has been watched (lectures are watched oldest first).
 */
export const trackLectures = (track, linkedDues) => {
  const dues = [...new Set(linkedDues)].sort();
  const semesterTail = addDays(track.endDate, 1);
  return lectureDates(track).map((release, index) => ({
    trackId: track.id,
    index,
    release,
    due: dues.find((d) => release < d) ?? semesterTail,
    hours: track.hoursPerLecture,
    watched: index < track.watched,
  }));
};

/** How many lectures are out by the given date (inclusive). */
export const releasedBy = (track, iso) => lectureDates(track).filter((d) => d <= iso).length;
