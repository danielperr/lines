// Snoozing a course: while snoozed (until, not including, the `snoozedUntil`
// date) none of its lectures or prep show on Today — for when recordings are
// not uploaded yet. Status and catch-up figures still count its work.

import { addDays, isValidIsoDate } from '../dates.js';

export const DEFAULT_SNOOZE_DAYS = 7;

/** The date a new snooze ends on unless the user picks another. */
export const defaultSnoozeUntil = (todayIso) => addDays(todayIso, DEFAULT_SNOOZE_DAYS);

/** The snooze end date when the course is snoozed today, else null. */
export const activeSnooze = (course, todayIso) =>
  (typeof course.snoozedUntil === 'string' && course.snoozedUntil > todayIso ? course.snoozedUntil : null);

/** Why `untilIso` can't end a snooze, or null when it can. */
export const snoozeError = (untilIso, todayIso) => {
  if (!isValidIsoDate(untilIso)) return 'Pick a date to snooze until.';
  return untilIso > todayIso ? null : 'Pick a date after today.';
};

/** Snoozes until `untilIso`; returns the same course when the date can't be used. */
export const snoozeCourse = (course, untilIso, todayIso) => {
  if (snoozeError(untilIso, todayIso) || course.snoozedUntil === untilIso) return course;
  return { ...course, snoozedUntil: untilIso };
};

/** Ends the snooze now; returns the same course when it wasn't snoozed. */
export const unsnoozeCourse = (course) => {
  if (!('snoozedUntil' in course)) return course;
  const { snoozedUntil, ...rest } = course;
  return rest;
};
