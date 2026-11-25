// Release-aware slack: how long you could stay idle from today and still
// finish every job due by a date. A job has a release date (earliest day it
// can be worked on), a due date and hours.

import { addDays, daysBetween } from '../dates.js';

/** Spare time below this many days is flagged as "tight". */
export const TIGHT_SLACK_DAYS = 2;

const sumBy = (list, fn) => list.reduce((sum, x) => sum + fn(x), 0);
const isPositiveNumber = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;

export const dailyHours = (weeklyHours) => {
  if (!isPositiveNumber(weeklyHours)) throw new Error('Weekly hours must be a positive number.');
  return weeklyHours / 7;
};

export const statusFor = (daysToDue, slackHours, slackDays) => {
  if (daysToDue < 0) return 'overdue';
  if (slackHours < 0) return 'behind';
  if (slackDays < TIGHT_SLACK_DAYS) return 'tight';
  return 'ok';
};

/**
 * Returns `slackAt(due)`: capacity from today minus all work due by then —
 * unless some window [s, due) is overloaded because work is released too
 * late, in which case the worst shortfall is reported instead.
 * Work days run from the start (inclusive) up to the due date (exclusive).
 */
export const slackCalculator = (jobs, todayIso, perDay) => (due) => {
  const margin = (start) => {
    const capacity = Math.max(0, daysBetween(start, due)) * perDay;
    const load = sumBy(jobs.filter((j) => j.release >= start && j.due <= due), (j) => j.hours);
    return capacity - load;
  };
  const laterStarts = [...new Set(jobs.filter((j) => j.release > todayIso && j.release < due).map((j) => j.release))];
  const worst = Math.min(margin(todayIso), ...laterStarts.map(margin));
  return worst < 0 ? worst : margin(todayIso);
};

/** Slack figures and status for work due on `due`. */
export const slackInfo = (due, slackAt, perDay, todayIso) => {
  const daysToDue = daysBetween(todayIso, due);
  const slackHours = slackAt(due);
  const slackDays = slackHours / perDay;
  return {
    daysToDue,
    slackHours,
    slackDays,
    startBy: addDays(todayIso, Math.floor(slackDays)),
    status: statusFor(daysToDue, slackHours, slackDays),
  };
};
