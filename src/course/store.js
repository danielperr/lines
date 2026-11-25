// Course-first persistence (v5). Reads older deadline/track data and migrates
// it; never overwrites the old key, so pre-v5 data stays as a backup.

import { validateCourse } from './course.js';
import { migrateV4 } from './migrate-v4.js';

export const STORAGE_KEY = 'study-courses:v5';
export const LEGACY_STORAGE_KEY = 'study-deadlines:v1';
export const STATE_VERSION = 5;
export const DEFAULT_STATE = Object.freeze({ weeklyHours: 20, courses: Object.freeze([]) });

const COURSE_FIELDS = ['id', 'name', 'watched'];
const SCHEDULE_FIELDS = ['weekdays', 'startDate', 'endDate', 'hoursPerLecture'];
const MILESTONE_FIELDS = ['id', 'kind', 'title', 'date'];
const PREP_FIELDS = ['unit', 'total', 'done', 'hoursPerUnit'];
const BREAK_FIELDS = ['from', 'to'];

const pick = (raw, fields) => Object.fromEntries(fields.map((key) => [key, raw?.[key]]));
const sortedIfList = (list) => (Array.isArray(list) ? [...list].sort() : list);

const normalizeSchedule = (raw) => {
  if (raw === null || raw === undefined) return null;
  const breaks = raw.breaks ?? [];
  return {
    ...pick(raw, SCHEDULE_FIELDS),
    breaks: Array.isArray(breaks) ? breaks.map((b) => pick(b, BREAK_FIELDS)) : breaks,
    addedDates: sortedIfList(raw.addedDates ?? []),
    removedDates: sortedIfList(raw.removedDates ?? []),
  };
};

const normalizeMilestone = (raw) => ({
  ...pick(raw, MILESTONE_FIELDS),
  prep: raw?.prep === null || raw?.prep === undefined ? null : pick(raw.prep, PREP_FIELDS),
});

/** Keep only known fields at every level; fill optional lists. */
const normalizeCourse = (raw) => ({
  ...pick(raw, COURSE_FIELDS),
  schedule: normalizeSchedule(raw?.schedule),
  milestones: Array.isArray(raw?.milestones) ? raw.milestones.map(normalizeMilestone) : raw?.milestones,
});

const courseLabel = (course, index) =>
  (typeof course.name === 'string' && course.name.trim() ? `"${course.name.trim()}"` : `#${index + 1}`);

const courseProblem = (course, index) => {
  if (typeof course.id !== 'string' || course.id === '') return `Course ${courseLabel(course, index)} has no id.`;
  const errors = validateCourse(course);
  return errors.length ? `Course ${courseLabel(course, index)}: ${errors.join(' ')}` : null;
};

const hasDuplicates = (values) => new Set(values).size !== values.length;
const nameKey = (course) => course.name.trim().toLocaleLowerCase();

const weeklyHoursAreValid = (h) => typeof h === 'number' && Number.isFinite(h) && h > 0 && h <= 168;

const isLegacy = (raw) => raw?.version === undefined || raw.version < STATE_VERSION;

const validateRaw = (raw) => {
  if (!weeklyHoursAreValid(raw?.weeklyHours)) return { ok: false, error: 'Weekly hours must be between 0 and 168.' };
  if (!Array.isArray(raw.courses)) return { ok: false, error: 'The data has no course list.' };
  const courses = raw.courses.map(normalizeCourse);
  const problem = courses.map(courseProblem).find(Boolean);
  if (problem) return { ok: false, error: problem };
  if (hasDuplicates(courses.map((c) => c.id))) return { ok: false, error: 'Two courses share the same id.' };
  if (hasDuplicates(courses.map(nameKey))) return { ok: false, error: 'Two courses share the same name.' };
  return { ok: true, state: { weeklyHours: raw.weeklyHours, courses } };
};

/** Parse and validate stored/imported JSON of any version. Never throws. */
export const parseState = (json) => {
  if (json === null || json === undefined || json === '') return { ok: true, state: DEFAULT_STATE };
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'The data is not valid JSON.' };
  }
  return validateRaw(isLegacy(raw) ? migrateV4(raw) : raw);
};

export const serializeState = (state) =>
  JSON.stringify({ version: STATE_VERSION, weeklyHours: state.weeklyHours, courses: state.courses }, null, 2);

/** Loads v5 data, or migrates the old key when there is no v5 data yet. */
export const loadState = (storage = globalThis.localStorage) => {
  const current = storage.getItem(STORAGE_KEY);
  return parseState(current ?? storage.getItem(LEGACY_STORAGE_KEY));
};

export const saveState = (state, storage = globalThis.localStorage) => {
  try {
    storage.setItem(STORAGE_KEY, serializeState(state));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Could not save: ${error.message}` };
  }
};
