// Plans every course at once: lectures and prep from all courses compete for
// the same weekly hours. Returns each course's status (most urgent first) and
// today's suggested tasks. Pure — no DOM, no storage.

import { daysBetween } from '../dates.js';
import { courseLectures, lectureJobs, summarizeLectures } from './lectures.js';
import { prepJobs, summarizePrep } from './prep.js';
import { dailyHours, slackCalculator } from './slack.js';
import { SEVERITY, courseSignals, courseStatus } from './status.js';
import { todayTasks } from './today.js';

const nextMilestoneOf = (course, todayIso) => {
  const upcoming = course.milestones
    .filter((m) => m.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  if (upcoming.length === 0) return null;
  const { id, kind, title, date } = upcoming[0];
  return { id, kind, title, date, daysTo: daysBetween(todayIso, date) };
};

const nextPrepOf = (prep) => {
  const waiting = prep.find((p) => !p.inWindow);
  return waiting
    ? { milestoneId: waiting.milestoneId, title: waiting.title, startBy: waiting.startBy, opensOn: waiting.opensOn }
    : null;
};

const summarizeCourse = ({ course, lectures, prep }, slackAt, perDay, todayIso) => {
  const lectureSummary = summarizeLectures(course, lectures, slackAt, perDay, todayIso);
  const signals = courseSignals(lectureSummary, prep);
  return {
    id: course.id,
    name: course.name,
    ...courseStatus(lectureSummary, prep, signals),
    signals,
    lectures: lectureSummary,
    prep,
    nextMilestone: nextMilestoneOf(course, todayIso),
    nextPrep: nextPrepOf(prep),
  };
};

const byUrgency = (a, b) => SEVERITY[b.status] - SEVERITY[a.status]
  || (a.nextMilestone?.date ?? '9999').localeCompare(b.nextMilestone?.date ?? '9999')
  || a.name.localeCompare(b.name);

/** Plans `{ weeklyHours, courses }` as of `todayIso`. Returns `{ courses, today }`. */
export const planCourses = ({ weeklyHours, courses }, todayIso) => {
  const perDay = dailyHours(weeklyHours);
  const withLectures = courses.map((course) => ({ course, lectures: courseLectures(course) }));
  const jobs = withLectures.flatMap(({ course, lectures }) => [...lectureJobs(lectures, todayIso), ...prepJobs(course, todayIso)]);
  const slackAt = slackCalculator(jobs, todayIso, perDay);
  const entries = withLectures.map((e) => ({ ...e, prep: summarizePrep(e.course, slackAt, perDay, todayIso) }));
  return {
    courses: entries.map((e) => summarizeCourse(e, slackAt, perDay, todayIso)).sort(byUrgency),
    today: todayTasks(entries, perDay, todayIso),
  };
};
