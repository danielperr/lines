// Text and data for the home screen (Today + course list), built from the
// planner's output. Pure — dates stay ISO here and are formatted by the view.

import { formatHours } from './dom.js';

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

/** "2 tasks · about 7h", or null when there is nothing to do today. */
export const todaySummary = (tasks) => {
  if (tasks.length === 0) return null;
  const hours = tasks.reduce((sum, t) => sum + t.hours, 0);
  return `${amount(tasks.length, 'tasks')} · about ${formatHours(hours)}`;
};

const lecturesText = (lectures) => (lectures ? `${lectures.watched} of ${lectures.total} lectures watched` : null);

/** One course-list row from a planned course. */
export const courseRow = (course) => {
  const lectureLine = lecturesText(course.lectures);
  return {
    id: course.id,
    name: course.name,
    status: course.status,
    statusText: course.statusText,
    progress: course.lectures && course.lectures.total ? course.lectures.watched / course.lectures.total : null,
    lecturesText: lectureLine,
    milestone: course.nextMilestone
      ? { title: course.nextMilestone.title, date: course.nextMilestone.date, daysTo: course.nextMilestone.daysTo }
      : null,
    prepNotice: course.nextPrep ? { title: course.nextPrep.title, opensOn: course.nextPrep.opensOn } : null,
    label: [`${course.name}: ${course.statusText}.`, lectureLine ? `${lectureLine}.` : null].filter(Boolean).join(' '),
  };
};
