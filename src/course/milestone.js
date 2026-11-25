// A milestone is a dated checkpoint inside a course (exam or assignment),
// optionally with extra prep work to do before it.

import { isValidIsoDate } from '../dates.js';

export const MILESTONE_KINDS = Object.freeze(['exam', 'assignment']);
export const MAX_MILESTONE_TITLE = 80;

/** Default prep unit for each kind, used to pre-fill forms. */
export const PREP_PRESETS = Object.freeze({
  exam: Object.freeze({ unit: 'chapters', hoursPerUnit: 2 }),
  assignment: Object.freeze({ unit: 'days', hoursPerUnit: 4 }),
});

const isPositiveNumber = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;
const isNonNegativeNumber = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Exams set when earlier lectures are due; assignments do not. */
export const gatesLectures = (milestone) => milestone.kind === 'exam';

const prepErrors = (prep) => {
  if (prep === null) return [];
  if (typeof prep !== 'object') return ['Prep is invalid.'];
  const errors = [];
  if (typeof prep.unit !== 'string' || prep.unit.trim() === '') errors.push('Prep needs a unit name.');
  if (!isPositiveNumber(prep.total)) errors.push('Prep amount must be greater than 0.');
  if (!isNonNegativeNumber(prep.done)) errors.push('Prep done cannot be negative.');
  else if (isPositiveNumber(prep.total) && prep.done > prep.total) errors.push('Prep done cannot exceed the total.');
  if (!isPositiveNumber(prep.hoursPerUnit)) errors.push('Prep hours per unit must be greater than 0.');
  return errors;
};

const titleError = (title) => {
  if (typeof title !== 'string' || title.trim() === '') return 'Title is required.';
  return title.trim().length > MAX_MILESTONE_TITLE ? `Keep the title to ${MAX_MILESTONE_TITLE} characters.` : null;
};

/** Returns human-readable problems; empty means valid. */
export const validateMilestone = (m) => {
  const errors = [];
  if (!MILESTONE_KINDS.includes(m.kind)) errors.push('Pick exam or assignment.');
  const title = titleError(m.title);
  if (title) errors.push(title);
  if (!isValidIsoDate(m.date)) errors.push('Date is invalid.');
  return [...errors, ...prepErrors(m.prep ?? null)];
};
