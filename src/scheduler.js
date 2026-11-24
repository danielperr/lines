// Pure scheduling logic. No DOM, no storage — safe to unit test in Node.

import { addDays, daysBetween, isValidIsoDate } from './dates.js';
import { trackLectures } from './tracks.js';

export { addDays, daysBetween, isValidIsoDate };

export const EFFORT_PRESETS = Object.freeze({
  lectures: Object.freeze({ label: 'Lectures', unit: 'lectures', hoursPerUnit: 1.5 }),
  assignment: Object.freeze({ label: 'Assignment', unit: 'days', hoursPerUnit: 4 }),
  exam: Object.freeze({ label: 'Exam prep', unit: 'chapters', hoursPerUnit: 2 }),
  custom: Object.freeze({ label: 'Custom', unit: 'units', hoursPerUnit: 1 }),
});

/** Part type that links a deadline to a lecture track instead of counting units. */
export const TRACK_PART = 'track';

/** Slack below this many days is flagged as "tight". */
export const TIGHT_SLACK_DAYS = 2;

const sumBy = (list, fn) => list.reduce((sum, x) => sum + fn(x), 0);
const isTrackPart = (part) => part.type === TRACK_PART;
const isPositiveNumber = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;
const isNonNegativeNumber = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

export const remainingUnits = (part) => Math.max(0, part.totalUnits - part.doneUnits);

export const partHoursLeft = (part) => (isTrackPart(part) ? 0 : remainingUnits(part) * part.hoursPerUnit);

/** Hours left on an item's own (non-track) parts. Use planSchedule for track-aware totals. */
export const hoursLeft = (item) => sumBy(item.parts, partHoursLeft);

/** Effort description shared by unit parts and track parts, used by the UI and todaysTask. */
const unitEffort = (part) => {
  const remaining = remainingUnits(part);
  return {
    partId: part.id,
    kind: 'units',
    type: part.type,
    unit: part.unit,
    done: Math.min(part.doneUnits, part.totalUnits),
    total: part.totalUnits,
    hoursPerUnit: part.hoursPerUnit,
    remaining,
    available: remaining,
    hoursLeft: remaining * part.hoursPerUnit,
  };
};

const effortOf = (item) => item.effort ?? item.parts.filter((p) => !isTrackPart(p)).map(unitEffort);

/** Fraction of an item's total hours already done (0..1). */
export const itemProgress = (item) => {
  const effort = effortOf(item);
  const total = sumBy(effort, (e) => e.total * e.hoursPerUnit);
  const done = sumBy(effort, (e) => e.done * e.hoursPerUnit);
  return total > 0 ? done / total : 0;
};

const validateUnitPart = (part) => {
  const errors = [];
  if (typeof part.unit !== 'string' || part.unit.trim() === '') errors.push('Unit name is required.');
  if (!isPositiveNumber(part.totalUnits)) errors.push('Total amount must be greater than 0.');
  if (!isNonNegativeNumber(part.doneUnits)) errors.push('Done amount cannot be negative.');
  else if (isPositiveNumber(part.totalUnits) && part.doneUnits > part.totalUnits) {
    errors.push('Done amount cannot exceed the total.');
  }
  if (!isPositiveNumber(part.hoursPerUnit)) errors.push('Hours per unit must be greater than 0.');
  return errors;
};

const validateTrackPart = (part, trackIds) => {
  if (typeof part.trackId !== 'string' || part.trackId === '') return ['Pick a lecture track.'];
  if (trackIds && !trackIds.includes(part.trackId)) return ['The linked lecture track no longer exists.'];
  return [];
};

/**
 * Returns a list of human-readable problems; empty means valid.
 * Pass `trackIds` to also check that linked tracks exist.
 */
export const validateItem = (item, trackIds = null) => {
  const errors = [];
  if (typeof item.title !== 'string' || item.title.trim() === '') errors.push('Title is required.');
  if (!isValidIsoDate(item.due)) errors.push('Due date is invalid.');
  if (!Array.isArray(item.parts) || item.parts.length === 0) {
    return [...errors, 'Add at least one effort part.'];
  }
  const partErrors = item.parts.flatMap((part, i) => {
    const problems = isTrackPart(part) ? validateTrackPart(part, trackIds) : validateUnitPart(part);
    return problems.map((e) => `Part ${i + 1}: ${e}`);
  });
  const linked = item.parts.filter(isTrackPart).map((p) => p.trackId);
  const duplicate = new Set(linked).size !== linked.length ? ['The same lecture track is linked twice.'] : [];
  return [...errors, ...partErrors, ...duplicate];
};

export const dailyHours = (weeklyHours) => {
  if (!isPositiveNumber(weeklyHours)) throw new Error('Weekly hours must be a positive number.');
  return weeklyHours / 7;
};

const statusFor = (daysToDue, slackHours, slackDays) => {
  if (daysToDue < 0) return 'overdue';
  if (slackHours < 0) return 'behind';
  if (slackDays < TIGHT_SLACK_DAYS) return 'tight';
  return 'ok';
};

const byDueThenTitle = (a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title);

const linkedDuesFor = (trackId, items) =>
  items.filter((item) => item.parts.some((p) => isTrackPart(p) && p.trackId === trackId)).map((item) => item.due);

/**
 * Work as "jobs": each has a release date (earliest day it can be worked on),
 * a due date and hours. Deadline work is available today; a lecture is
 * available from its release date.
 */
const buildJobs = (items, lectures, todayIso) => [
  ...items.map((item) => ({ release: todayIso, due: item.due, hours: hoursLeft(item) })),
  ...lectures
    .filter((l) => !l.watched)
    .map((l) => ({ release: l.release > todayIso ? l.release : todayIso, due: l.due, hours: l.hours })),
].filter((job) => job.hours > 0);

/**
 * Spare hours before `due` = how long you could stay idle starting today and
 * still finish everything due by then. That is the plain "capacity minus all
 * work due by then" — unless some window [s, due) is overloaded because
 * lectures come out too late (work released on/after s exceeds the hours left
 * after s). Then it is infeasible and the worst shortfall is reported instead.
 */
const slackCalculator = (jobs, todayIso, perDay) => (due) => {
  const margin = (start) => {
    const capacity = Math.max(0, daysBetween(start, due)) * perDay;
    const load = sumBy(jobs.filter((j) => j.release >= start && j.due <= due), (j) => j.hours);
    return capacity - load;
  };
  const laterStarts = [...new Set(jobs.filter((j) => j.release > todayIso && j.release < due).map((j) => j.release))];
  const worst = Math.min(margin(todayIso), ...laterStarts.map(margin));
  return worst < 0 ? worst : margin(todayIso);
};

const trackEffort = (part, item, track, lectures, todayIso) => {
  const group = lectures.filter((l) => l.trackId === part.trackId && l.due === item.due);
  const done = group.filter((l) => l.watched).length;
  const remaining = group.length - done;
  return {
    partId: part.id,
    kind: 'track',
    type: TRACK_PART,
    trackId: part.trackId,
    trackName: track?.name ?? 'Missing track',
    unit: 'lectures',
    done,
    total: group.length,
    hoursPerUnit: track?.hoursPerLecture ?? 0,
    remaining,
    available: group.filter((l) => !l.watched && l.release <= todayIso).length,
    hoursLeft: remaining * (track?.hoursPerLecture ?? 0),
  };
};

const withSlack = (thing, due, slackAt, perDay, todayIso) => {
  const daysToDue = daysBetween(todayIso, due);
  const slackHours = slackAt(due);
  const slackDays = slackHours / perDay;
  return {
    ...thing,
    daysToDue,
    slackHours,
    slackDays,
    startBy: addDays(todayIso, Math.floor(slackDays)),
    status: statusFor(daysToDue, slackHours, slackDays),
  };
};

const summarizeTrack = (track, lectures, items, slackAt, perDay, todayIso) => {
  const own = lectures.filter((l) => l.trackId === track.id);
  const released = own.filter((l) => l.release <= todayIso).length;
  const behind = Math.max(0, released - track.watched);
  const nextUnwatched = own.find((l) => !l.watched);
  const summary = {
    ...track,
    total: own.length,
    released,
    behind,
    hoursBehind: behind * track.hoursPerLecture,
    hoursLeft: (own.length - Math.min(track.watched, own.length)) * track.hoursPerLecture,
    nextRelease: own.find((l) => l.release > todayIso)?.release ?? null,
    linkedTitles: items.filter((i) => linkedDuesFor(track.id, [i]).length).map((i) => i.title),
  };
  if (!nextUnwatched) return { ...summary, status: 'done' };
  return { ...withSlack(summary, nextUnwatched.due, slackAt, perDay, todayIso), dueBy: nextUnwatched.due };
};

/**
 * Plans all deadlines and lecture tracks. Slack for a deadline = study hours
 * available before it minus all work that must be done by then (including
 * competing deadlines and linked lectures), respecting lecture release dates.
 * Deadlines are ordered least-slack first.
 *
 * Work days run from today (inclusive) up to the due date (exclusive).
 */
export const planSchedule = (items, weeklyHours, todayIso, tracks = []) => {
  const perDay = dailyHours(weeklyHours);
  const trackById = new Map(tracks.map((t) => [t.id, t]));
  const lectures = tracks.flatMap((t) => trackLectures(t, linkedDuesFor(t.id, items)));
  const slackAt = slackCalculator(buildJobs(items, lectures, todayIso), todayIso, perDay);

  const planned = items.map((item) => {
    const effort = item.parts.map((part) => (isTrackPart(part)
      ? trackEffort(part, item, trackById.get(part.trackId), lectures, todayIso)
      : unitEffort(part)));
    return { ...item, effort, hoursLeft: sumBy(effort, (e) => e.hoursLeft) };
  });

  const active = planned
    .filter((item) => item.hoursLeft > 0)
    .map((item) => withSlack(item, item.due, slackAt, perDay, todayIso))
    .sort((a, b) => a.slackHours - b.slackHours || byDueThenTitle(a, b));
  const done = planned.filter((item) => item.hoursLeft === 0).sort(byDueThenTitle);
  const trackSummaries = tracks.map((t) => summarizeTrack(t, lectures, items, slackAt, perDay, todayIso));

  return { active, done, tracks: trackSummaries };
};

/**
 * Suggested work for today on one item: roughly one day's study hours, taken
 * from the item's parts in the order they are listed. Only lectures that are
 * already released are suggested. Returns one entry per part touched.
 */
export const todaysTask = (item, weeklyHours) => {
  const { tasks } = effortOf(item).reduce(({ budget, tasks: acc }, effort) => {
    if (budget <= 0 || effort.available === 0) return { budget, tasks: acc };
    const units = Math.min(effort.available, Math.ceil(budget / effort.hoursPerUnit));
    const hours = units * effort.hoursPerUnit;
    return { budget: budget - hours, tasks: [...acc, { partId: effort.partId, unit: effort.unit, units, hours }] };
  }, { budget: dailyHours(weeklyHours), tasks: [] });
  return tasks;
};
