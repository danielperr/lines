// Text and data for the home screen (Today + course list), built from the
// planner's output. Pure — dates stay ISO here and are formatted by the view.

import { formatHours } from './dom.js';
import { lectureProgress, lectureText } from './progress-model.js';

const singular = (unit) => unit.replace(/s$/, '');
const amount = (n, unit) => `${n} ${n === 1 ? singular(unit) : unit}`;

const lectureTitle = (task) => (task.units === 1 ? `Lecture ${task.from}` : `Lectures ${task.from}–${task.to}`);

const lectureRow = (task) => ({
  key: `${task.courseId}:lectures:${task.from}`,
  title: lectureTitle(task),
  plusLabel: `Mark lecture ${task.from} of ${task.courseName} watched`,
  action: { kind: 'lectures', courseId: task.courseId },
});

const prepRow = (task) => ({
  key: `${task.courseId}:prep:${task.milestoneId}`,
  title: `${task.title} prep · ${amount(task.units, task.unit)}`,
  plusLabel: `Mark one ${singular(task.unit)} of ${task.title} prep done`,
  action: { kind: 'prep', courseId: task.courseId, milestoneId: task.milestoneId },
});

/** One row per Today task: title, detail line, +1 label and what +1 does. */
export const todayRows = (tasks) => tasks.map((task) => ({
  ...(task.kind === 'lectures' ? lectureRow(task) : prepRow(task)),
  detail: `${task.courseName} · ${formatHours(task.hours)}`,
}));

/**
 * One card per course with tasks today, in priority order (the order of each
 * course's first task). Rows drop the course name: the card shows it. The
 * total hours only show when the card has more than one task.
 */
export const todayCards = (tasks, colors) => {
  const courseIds = [...new Set(tasks.map((t) => t.courseId))];
  return courseIds.map((courseId) => {
    const own = tasks.filter((t) => t.courseId === courseId);
    return {
      courseId,
      courseName: own[0].courseName,
      color: colors.get(courseId),
      hoursText: own.length > 1 ? formatHours(own.reduce((sum, t) => sum + t.hours, 0)) : null,
      rows: todayRows(own).map((row, i) => ({ ...row, detail: formatHours(own[i].hours) })),
    };
  });
};

/** "2 tasks · about 7h", or null when there is nothing to do today. */
export const todaySummary = (tasks) => {
  if (tasks.length === 0) return null;
  const hours = tasks.reduce((sum, t) => sum + t.hours, 0);
  return `${amount(tasks.length, 'tasks')} · about ${formatHours(hours)}`;
};

export const PILL_TEXT = Object.freeze({ ok: 'On track', tight: 'Tight', behind: 'Behind', overdue: 'Overdue', done: 'Done' });
const AT_RISK = new Set(['behind', 'overdue']);

/** The header pill: how many courses need attention, worst first. */
export const homeStatus = (courses) => {
  const atRisk = courses.filter((c) => AT_RISK.has(c.status)).length;
  if (atRisk) return { status: 'behind', text: `${atRisk} behind` };
  const tight = courses.filter((c) => c.status === 'tight').length;
  if (tight) return { status: 'tight', text: `${tight} tight` };
  return courses.every((c) => c.status === 'done') ? { status: 'done', text: 'All done' } : { status: 'ok', text: 'On track' };
};

/** One course-list card from a planned course and its color key. */
export const courseRow = (course, color) => {
  const progress = lectureProgress(course.lectures);
  return {
    id: course.id,
    name: course.name,
    color,
    status: course.status,
    statusText: course.statusText,
    pillText: PILL_TEXT[course.status],
    signals: course.signals.map(({ status, text }) => ({ status, text })),
    progress,
    lecturesText: progress ? lectureText(course.lectures) : null,
    milestone: course.nextMilestone
      ? { title: course.nextMilestone.title, date: course.nextMilestone.date, daysTo: course.nextMilestone.daysTo }
      : null,
    snoozedUntil: course.snoozedUntil ?? null,
    prepNotice: course.nextPrep ? { title: course.nextPrep.title, opensOn: course.nextPrep.opensOn } : null,
    label: [`${course.name}: ${course.statusText}.`, progress ? `${progress.label}.` : null].filter(Boolean).join(' '),
  };
};
