// Pure logic for the "Add course" wizard: a draft course (name, optional
// lecture schedule, exams and assignments) becomes one lecture track plus the
// deadlines that link to it. No DOM — safe to unit test in Node.

import { isValidIsoDate } from './dates.js';
import { EFFORT_PRESETS, TRACK_PART } from './scheduler.js';
import { WEEKDAY_NAMES, lectureDates, releasedBy, validateTrack } from './tracks.js';

export const WIZARD_STEPS = Object.freeze(['name', 'lectures', 'deadlines', 'review']);
export const DEADLINE_KINDS = Object.freeze(['exam', 'assignment']);
export const MAX_COURSE_NAME = 60;
export const MAX_DEADLINE_TITLE = 80;
export const DEFAULT_HOURS_PER_LECTURE = 1.5;

const KIND_LABEL = Object.freeze({ exam: 'Exam', assignment: 'Assignment' });
const AMOUNT_HINT = Object.freeze({
  exam: 'Enter how many chapters there are to study.',
  assignment: 'Enter how many days of work it needs.',
});

export const kindLabel = (kind) => KIND_LABEL[kind];

/** "Exam 1", "Assignment 1", "Exam 2" — each kind counted on its own. */
export const deadlineLabels = (kinds) => kinds.map((kind, i) =>
  `${KIND_LABEL[kind]} ${kinds.slice(0, i + 1).filter((k) => k === kind).length}`);

export const blankDeadline = (kind) => ({
  kind, title: '', due: '', amount: '', coversLectures: kind === 'exam',
});

export const blankDraft = (today) => ({
  name: '',
  hasLectures: true,
  lectures: {
    weekdays: [], startDate: today, endDate: '', hoursPerLecture: DEFAULT_HOURS_PER_LECTURE, watched: 0, breaks: [],
  },
  deadlines: [],
});

const hasAmount = (deadline) => deadline.amount !== '' && Number.isFinite(Number(deadline.amount)) && Number(deadline.amount) > 0;
const linksLectures = (draft, deadline) => draft.hasLectures && deadline.coversLectures;

const trackFrom = (draft, id) => ({ id, name: draft.name.trim(), ...draft.lectures, breaks: [...draft.lectures.breaks] });

// ---- Validation per step ----

const nameErrors = (draft) => {
  const name = draft.name.trim();
  if (name === '') return ['Give the course a name.'];
  if (name.length > MAX_COURSE_NAME) return [`Keep the name to ${MAX_COURSE_NAME} characters.`];
  return [];
};

const lectureErrors = (draft, today) => {
  if (!draft.hasLectures) return [];
  // The name has its own step; validate the schedule alone here.
  const track = { ...trackFrom(draft, 'draft'), name: 'draft' };
  const errors = validateTrack(track);
  if (errors.length) return errors;
  const out = releasedBy(track, today);
  return track.watched > out ? [`Only ${out} lectures are out so far, so you can't have watched ${track.watched}.`] : [];
};

const deadlineProblems = (draft, deadline) => {
  const problems = [];
  if (deadline.title.trim() === '') problems.push('Title is required.');
  else if (deadline.title.trim().length > MAX_DEADLINE_TITLE) problems.push(`Keep the title to ${MAX_DEADLINE_TITLE} characters.`);
  if (!isValidIsoDate(deadline.due)) problems.push('Pick a due date.');
  if (!hasAmount(deadline) && !(linksLectures(draft, deadline) && deadline.amount === '')) {
    problems.push(AMOUNT_HINT[deadline.kind]);
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
  name: (draft) => nameErrors(draft),
  lectures: (draft, today) => lectureErrors(draft, today),
  deadlines: (draft) => deadlineErrors(draft),
  review: (draft, today) => [...nameErrors(draft), ...lectureErrors(draft, today), ...deadlineErrors(draft)],
});

/** Human-readable problems that block leaving the given step; empty means OK. */
export const stepErrors = (step, draft, today) => STEP_CHECKS[step](draft, today);

// ---- Building ----

const unitPart = (deadline, id) => {
  const preset = EFFORT_PRESETS[deadline.kind];
  return { id, type: deadline.kind, unit: preset.unit, hoursPerUnit: preset.hoursPerUnit, totalUnits: Number(deadline.amount), doneUnits: 0 };
};

const itemFrom = (draft, deadline, track, makeId) => {
  const parts = [
    hasAmount(deadline) ? unitPart(deadline, makeId()) : null,
    track && linksLectures(draft, deadline) ? { id: makeId(), type: TRACK_PART, trackId: track.id } : null,
  ].filter(Boolean);
  return { id: makeId(), title: deadline.title.trim(), course: draft.name.trim(), due: deadline.due, parts };
};

/** The track (or null) and deadlines to add. Assumes stepErrors('review') is empty. */
export const buildCourse = (draft, makeId) => {
  const track = draft.hasLectures ? trackFrom(draft, makeId()) : null;
  const items = draft.deadlines.map((deadline) => itemFrom(draft, deadline, track, makeId));
  return { track, items };
};

// ---- Review text ----

const plural = (n, word) => `${n} ${n === 1 ? word.replace(/s$/, '') : word}`;

const lectureLine = (draft, today) => {
  if (!draft.hasLectures) return null;
  const track = trackFrom(draft, 'draft');
  const days = [...track.weekdays].sort().map((d) => WEEKDAY_NAMES[d]).join(', ');
  const total = lectureDates(track).length;
  return `${days} · ${plural(total, 'lectures')} (${releasedBy(track, today)} out, ${track.watched} watched)`;
};

const deadlineDetail = (draft, deadline) => [
  hasAmount(deadline) ? plural(Number(deadline.amount), EFFORT_PRESETS[deadline.kind].unit) : null,
  linksLectures(draft, deadline) ? 'lectures' : null,
].filter(Boolean).join(' + ');

/** Plain-text recap for the review step. */
export const courseSummary = (draft, today) => ({
  lectures: lectureLine(draft, today),
  deadlines: draft.deadlines.map((d) => ({ title: d.title.trim(), due: d.due, detail: deadlineDetail(draft, d) })),
});
