// Pure logic for the "Add course" wizard: a draft course (name, optional
// lecture schedule, exams and assignments) becomes one v5 course record.
// No DOM — safe to unit test in Node.

import { isValidIsoDate } from './dates.js';
import { isColorKey } from './course/color.js';
import { PREP_PRESETS } from './course/milestone.js';
import { WEEKDAY_NAMES, lectureDates, releasedBy, validateSchedule } from './course/schedule.js';

export const WIZARD_STEPS = Object.freeze(['name', 'lectures', 'deadlines', 'review']);
export const DEADLINE_KINDS = Object.freeze(['exam', 'assignment']);
export const MAX_COURSE_NAME = 60;
export const MAX_DEADLINE_TITLE = 80;
export const DEFAULT_HOURS_PER_LECTURE = 1.5;

const KIND_LABEL = Object.freeze({ exam: 'Exam', assignment: 'Assignment' });

export const kindLabel = (kind) => KIND_LABEL[kind];

/** "Exam 1", "Assignment 1", "Exam 2" — each kind counted on its own. */
export const deadlineLabels = (kinds) => kinds.map((kind, i) =>
  `${KIND_LABEL[kind]} ${kinds.slice(0, i + 1).filter((k) => k === kind).length}`);

export const blankDeadline = (kind) => ({
  kind, title: '', due: '', amount: '',
});

export const blankDraft = (today, color = null) => ({
  name: '',
  color,
  hasLectures: true,
  lectures: {
    weekdays: [], startDate: today, endDate: '', hoursPerLecture: DEFAULT_HOURS_PER_LECTURE, watched: 0, breaks: [], extraDates: [],
  },
  deadlines: [],
});

const hasAmount = (deadline) => deadline.amount !== '' && Number.isFinite(Number(deadline.amount)) && Number(deadline.amount) > 0;
/** Exams always come after the lectures before them; assignments do not. */
const linksLectures = (draft, deadline) => draft.hasLectures && deadline.kind === 'exam';

const scheduleFrom = (draft) => ({
  weekdays: [...draft.lectures.weekdays],
  startDate: draft.lectures.startDate,
  endDate: draft.lectures.endDate,
  hoursPerLecture: draft.lectures.hoursPerLecture,
  breaks: draft.lectures.breaks.map(({ from, to }) => ({ from, to })),
  addedDates: [...(draft.lectures.extraDates ?? [])].sort(),
  removedDates: [],
});

// ---- Validation per step ----

const nameKey = (name) => name.trim().toLocaleLowerCase();

/** The existing course name that clashes with `name`, if any (case and spaces ignored). */
export const takenName = (name, takenNames) => takenNames.find((taken) => nameKey(taken) === nameKey(name)) ?? null;

const nameErrors = (draft, takenNames) => {
  const name = draft.name.trim();
  if (name === '') return ['Give the course a name.'];
  if (name.length > MAX_COURSE_NAME) return [`Keep the name to ${MAX_COURSE_NAME} characters.`];
  const clash = takenName(name, takenNames);
  return clash ? [`You already have "${clash}". Pick another name.`] : [];
};

const lectureErrors = (draft, today) => {
  if (!draft.hasLectures) return [];
  const schedule = scheduleFrom(draft);
  const errors = validateSchedule(schedule);
  if (errors.length) return errors;
  const { watched } = draft.lectures;
  if (!Number.isInteger(watched) || watched < 0) return ['Watched lectures must be a whole number, 0 or more.'];
  const out = releasedBy(schedule, today);
  return watched > out ? [`Only ${out} lectures are out so far, so you can't have watched ${watched}.`] : [];
};

const deadlineProblems = (draft, deadline) => {
  const problems = [];
  if (deadline.title.trim() === '') problems.push('Title is required.');
  else if (deadline.title.trim().length > MAX_DEADLINE_TITLE) problems.push(`Keep the title to ${MAX_DEADLINE_TITLE} characters.`);
  if (!isValidIsoDate(deadline.due)) problems.push('Pick a due date.');
  if (String(deadline.amount).trim() !== '' && !hasAmount(deadline)) {
    problems.push('Prep amount must be more than 0, or leave it empty.');
  }
  return problems;
};

const deadlineErrors = (draft) => {
  if (draft.deadlines.length === 0 && !draft.hasLectures) {
    return ['Add at least one exam or assignment, or go back and add lectures.'];
  }
  const labels = deadlineLabels(draft.deadlines.map((d) => d.kind));
  return draft.deadlines.flatMap((deadline, i) =>
    deadlineProblems(draft, deadline).map((p) => `${labels[i]}: ${p}`));
};

const STEP_CHECKS = Object.freeze({
  name: (draft, today, takenNames) => nameErrors(draft, takenNames),
  lectures: (draft, today) => lectureErrors(draft, today),
  deadlines: (draft) => deadlineErrors(draft),
  review: (draft, today, takenNames) => [...nameErrors(draft, takenNames), ...lectureErrors(draft, today), ...deadlineErrors(draft)],
});

/**
 * Human-readable problems that block leaving the given step; empty means OK.
 * `takenNames` are the names of courses that already exist.
 */
export const stepErrors = (step, draft, today, takenNames = []) => STEP_CHECKS[step](draft, today, takenNames);

// ---- Building ----

const prepFrom = (deadline) => {
  if (!hasAmount(deadline)) return null;
  const { unit, hoursPerUnit } = PREP_PRESETS[deadline.kind];
  return { unit, total: Number(deadline.amount), done: 0, hoursPerUnit };
};

const milestoneFrom = (deadline, id) => ({
  id, kind: deadline.kind, title: deadline.title.trim(), date: deadline.due, prep: prepFrom(deadline),
});

/** The course to add. Assumes stepErrors('review') is empty. */
export const buildCourse = (draft, makeId) => ({
  id: makeId(),
  name: draft.name.trim(),
  ...(isColorKey(draft.color) ? { color: draft.color } : {}),
  schedule: draft.hasLectures ? scheduleFrom(draft) : null,
  watched: draft.hasLectures ? draft.lectures.watched : 0,
  milestones: draft.deadlines.map((deadline) => milestoneFrom(deadline, makeId())),
});

// ---- Review text ----

const plural = (n, word) => `${n} ${n === 1 ? word.replace(/s$/, '') : word}`;

const lectureLine = (draft, today) => {
  if (!draft.hasLectures) return null;
  const schedule = scheduleFrom(draft);
  const days = [...schedule.weekdays].sort().map((d) => WEEKDAY_NAMES[d]).join(', ');
  const extras = schedule.addedDates.length ? `${schedule.addedDates.length} extra` : '';
  const pattern = [days, extras].filter(Boolean).join(' + ');
  const total = lectureDates(schedule).length;
  return `${pattern} · ${plural(total, 'lectures')} (${releasedBy(schedule, today)} out, ${draft.lectures.watched} watched)`;
};

const deadlineDetail = (draft, deadline) => [
  linksLectures(draft, deadline) ? 'lectures' : null,
  hasAmount(deadline) ? `${plural(Number(deadline.amount), PREP_PRESETS[deadline.kind].unit)} of prep` : null,
].filter(Boolean).join(' + ');

/** Plain-text recap for the review step. */
export const courseSummary = (draft, today) => ({
  lectures: lectureLine(draft, today),
  deadlines: draft.deadlines.map((d) => ({ title: d.title.trim(), due: d.due, detail: deadlineDetail(draft, d) })),
});
