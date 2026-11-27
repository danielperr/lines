// Today's suggested work across all courses: about one day's study hours,
// earliest due first. Only released lectures and prep whose window is open
// are suggested; on a tie, lectures come before prep. A snoozed course is
// left out (lectures and prep) until the snooze ends.

import { activeSnooze } from './snooze.js';

const KIND_ORDER = Object.freeze({ lectures: 0, prep: 1 });

const groupByDue = (lectures) => lectures.reduce((groups, l) => {
  const last = groups[groups.length - 1];
  if (last && last.due === l.due) return [...groups.slice(0, -1), { ...last, available: last.available + 1 }];
  return [...groups, { due: l.due, from: l.index + 1, available: 1, hoursPerUnit: l.hours }];
}, []);

const lectureGroups = (course, lectures, todayIso) =>
  groupByDue(lectures.filter((l) => !l.watched && l.release <= todayIso)).map((g) => ({
    ...g, courseId: course.id, courseName: course.name, kind: 'lectures', unit: 'lectures',
  }));

const prepGroups = (course, prep) => prep.filter((p) => p.inWindow).map((p) => ({
  courseId: course.id,
  courseName: course.name,
  kind: 'prep',
  milestoneId: p.milestoneId,
  title: p.title,
  unit: p.unit,
  due: p.date,
  available: p.remaining,
  hoursPerUnit: p.hoursPerUnit,
}));

const byPriority = (a, b) => a.due.localeCompare(b.due)
  || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
  || a.courseName.localeCompare(b.courseName);

const toTask = (group, units) => {
  const hours = units * group.hoursPerUnit;
  const base = { courseId: group.courseId, courseName: group.courseName, kind: group.kind };
  if (group.kind === 'lectures') {
    return { ...base, units, unit: group.unit, hours, from: group.from, to: group.from + units - 1, due: group.due };
  }
  return { ...base, milestoneId: group.milestoneId, title: group.title, units, unit: group.unit, hours, due: group.due };
};

/**
 * `entries` is a list of { course, lectures, prep } (lectures from
 * courseLectures, prep from summarizePrep). Returns tasks in the order to do them.
 */
export const todayTasks = (entries, budgetHours, todayIso) => {
  const groups = entries
    .filter(({ course }) => !activeSnooze(course, todayIso))
    .flatMap(({ course, lectures, prep }) => [...lectureGroups(course, lectures, todayIso), ...prepGroups(course, prep)])
    .sort(byPriority);
  return groups.reduce(({ budget, tasks }, group) => {
    if (budget <= 0) return { budget, tasks };
    const units = Math.min(group.available, Math.ceil(budget / group.hoursPerUnit));
    const task = toTask(group, units);
    return { budget: budget - task.hours, tasks: [...tasks, task] };
  }, { budget: budgetHours, tasks: [] }).tasks;
};
