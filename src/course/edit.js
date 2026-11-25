// Immutable edits to one course. Each returns a new course (or the same one
// when nothing changes); validation of whole forms happens elsewhere.

import { validateCourse } from './course.js';
import { isColorKey } from './color.js';
import { lectureDates, pruneRemoved, releasedBy, withLectureAdded, withLectureRemoved } from './schedule.js';

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

/** Watched count, kept between 0 and the lectures released by today. */
export const setWatched = (course, watched, todayIso) => {
  if (!course.schedule) return course;
  const next = clamp(watched, 0, releasedBy(course.schedule, todayIso));
  return next === course.watched ? course : { ...course, watched: next };
};

const mapMilestone = (course, milestoneId, fn) => ({
  ...course,
  milestones: course.milestones.map((m) => (m.id === milestoneId ? fn(m) : m)),
});

/** One unit of prep more (+1) or less (−1), kept between 0 and the total. */
export const stepPrep = (course, milestoneId, delta) => {
  const milestone = course.milestones.find((m) => m.id === milestoneId);
  if (!milestone?.prep) return course;
  const done = clamp(milestone.prep.done + delta, 0, milestone.prep.total);
  if (done === milestone.prep.done) return course;
  return mapMilestone(course, milestoneId, (m) => ({ ...m, prep: { ...m.prep, done } }));
};

const withSchedule = (course, schedule) => ({
  ...course,
  schedule,
  watched: Math.min(course.watched, lectureDates(schedule).length),
});

/** Cancels the lecture on a date (or drops a one-off lecture there). */
export const cancelLecture = (course, iso) => (course.schedule
  ? withSchedule(course, withLectureRemoved(course.schedule, iso))
  : course);

/** Adds a one-off lecture on a date (or restores a cancelled one). */
export const addLecture = (course, iso) => (course.schedule
  ? withSchedule(course, withLectureAdded(course.schedule, iso))
  : course);

const byDate = (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title);

/** Adds the milestone, or replaces the one with the same id; keeps date order. */
export const saveMilestone = (course, milestone) => {
  const others = course.milestones.filter((m) => m.id !== milestone.id);
  return { ...course, milestones: [...others, milestone].sort(byDate) };
};

export const removeMilestone = (course, milestoneId) => ({
  ...course,
  milestones: course.milestones.filter((m) => m.id !== milestoneId),
});

/** Name, schedule and watched count from the edit sheet; milestones are kept. */
export const applyDetails = (course, { name, schedule, watched, color }) => ({
  ...course,
  name: name.trim(),
  schedule: schedule ? pruneRemoved(schedule) : null,
  watched: schedule ? watched : 0,
  ...(isColorKey(color) ? { color } : {}),
});

const nameKey = (name) => name.trim().toLocaleLowerCase();

/** Problems with edited details; `otherNames` are the other courses' names. */
export const detailsErrors = (course, otherNames, todayIso) => {
  const clash = otherNames.find((name) => nameKey(name) === nameKey(course.name));
  if (clash) return [`You already have "${clash}".`];
  const errors = validateCourse(course);
  if (errors.length || !course.schedule) return errors;
  const out = releasedBy(course.schedule, todayIso);
  return course.watched > out ? [`Only ${out} lectures are out so far, so you can't have watched ${course.watched}.`] : [];
};
