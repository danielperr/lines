// A course is the root entity: a name, an optional lecture schedule, how many
// lectures have been watched, and its milestones.

import { validateMilestone } from './milestone.js';
import { lectureDates, validateSchedule } from './schedule.js';

export const MAX_COURSE_NAME = 60;

/** Total lectures in the semester (0 for a course with no lectures). */
export const lectureCount = (course) => (course.schedule ? lectureDates(course.schedule).length : 0);

const nameErrors = (name) => {
  if (typeof name !== 'string' || name.trim() === '') return ['Name is required.'];
  return name.trim().length > MAX_COURSE_NAME ? [`Keep the name to ${MAX_COURSE_NAME} characters.`] : [];
};

const watchedErrors = (course) => {
  if (!Number.isInteger(course.watched) || course.watched < 0) return ['Watched lectures must be a whole number, 0 or more.'];
  const total = lectureCount(course);
  return course.watched > total ? [`Watched lectures cannot exceed the ${total} in the semester.`] : [];
};

const milestoneLabel = (m, index) => (typeof m?.title === 'string' && m.title.trim() ? `"${m.title}"` : `#${index + 1}`);

const milestonesErrors = (milestones) => {
  if (!Array.isArray(milestones)) return ['Milestones are invalid.'];
  const broken = milestones
    .map((m, i) => {
      const errors = validateMilestone(m);
      return errors.length ? `Milestone ${milestoneLabel(m, i)}: ${errors.join(' ')}` : null;
    })
    .filter(Boolean);
  if (broken.length) return broken;
  const ids = milestones.map((m) => m.id);
  if (ids.some((id) => typeof id !== 'string' || id === '')) return ['A milestone has no id.'];
  return new Set(ids).size === ids.length ? [] : ['Two milestones share the same id.'];
};

/** Returns human-readable problems; empty means valid. */
export const validateCourse = (course) => {
  const scheduleErrors = course.schedule === null ? [] : validateSchedule(course.schedule);
  const errors = [...nameErrors(course.name), ...scheduleErrors];
  if (scheduleErrors.length === 0) errors.push(...watchedErrors(course));
  return [...errors, ...milestonesErrors(course.milestones)];
};
