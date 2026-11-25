// Per-lecture planning for a course: when each lecture is out, when it is due
// (by the next exam after it, or semester end), and the course's backlog.

import { addDays } from '../dates.js';
import { gatesLectures } from './milestone.js';
import { lectureDates } from './schedule.js';
import { slackInfo } from './slack.js';

/** Every lecture with release date, due date, hours and watched flag (watched oldest first). */
export const courseLectures = (course) => {
  if (!course.schedule) return [];
  const examDates = [...new Set(course.milestones.filter(gatesLectures).map((m) => m.date))].sort();
  const semesterTail = addDays(course.schedule.endDate, 1);
  return lectureDates(course.schedule).map((release, index) => ({
    index,
    release,
    due: examDates.find((d) => release < d) ?? semesterTail,
    hours: course.schedule.hoursPerLecture,
    watched: index < course.watched,
  }));
};

/** Unwatched lectures as slack jobs; a lecture can be watched from its release date. */
export const lectureJobs = (lectures, todayIso) => lectures
  .filter((l) => !l.watched)
  .map((l) => ({ release: l.release > todayIso ? l.release : todayIso, due: l.due, hours: l.hours }));

/**
 * Backlog summary. Caught up (nothing released left unwatched) is always "ok";
 * any backlog is at least "tight", worse when the slack says so.
 */
export const summarizeLectures = (course, lectures, slackAt, perDay, todayIso) => {
  if (!course.schedule) return null;
  const released = lectures.filter((l) => l.release <= todayIso).length;
  const watched = Math.min(course.watched, lectures.length);
  const behind = Math.max(0, released - watched);
  const nextUnwatched = lectures.find((l) => !l.watched);
  const summary = {
    total: lectures.length,
    released,
    watched,
    behind,
    hoursBehind: behind * course.schedule.hoursPerLecture,
    nextRelease: lectures.find((l) => l.release > todayIso)?.release ?? null,
  };
  if (!nextUnwatched) return { ...summary, dueBy: null, status: 'done' };
  const { status } = slackInfo(nextUnwatched.due, slackAt, perDay, todayIso);
  const tone = behind === 0 ? 'ok' : (status === 'ok' ? 'tight' : status);
  return { ...summary, dueBy: nextUnwatched.due, status: tone };
};
