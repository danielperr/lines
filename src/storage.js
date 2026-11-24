import { EFFORT_PRESETS, TRACK_PART, validateItem } from './scheduler.js';
import { validateTrack } from './tracks.js';

export const STORAGE_KEY = 'study-deadlines:v1';
export const DEFAULT_STATE = Object.freeze({ weeklyHours: 20, items: Object.freeze([]), tracks: Object.freeze([]) });

const ITEM_FIELDS = ['id', 'title', 'course', 'due'];
const UNIT_PART_FIELDS = ['id', 'type', 'unit', 'totalUnits', 'doneUnits', 'hoursPerUnit'];
const TRACK_PART_FIELDS = ['id', 'type', 'trackId'];
const TRACK_FIELDS = ['id', 'name', 'weekdays', 'startDate', 'endDate', 'hoursPerLecture', 'watched'];
const BREAK_FIELDS = ['from', 'to'];

const pick = (raw, fields) => Object.fromEntries(fields.map((key) => [key, raw?.[key]]));

const normalizePart = (raw) => pick(raw, raw?.type === TRACK_PART ? TRACK_PART_FIELDS : UNIT_PART_FIELDS);

/** Keep only known fields; tracks saved before breaks existed get none. */
const normalizeTrack = (raw) => {
  const track = pick(raw, TRACK_FIELDS);
  const breaks = raw?.breaks ?? [];
  return { ...track, breaks: Array.isArray(breaks) ? breaks.map((b) => pick(b, BREAK_FIELDS)) : breaks };
};

const isLegacyItem = (raw) => !Array.isArray(raw?.parts) && raw?.totalUnits !== undefined;

/** Keep only known fields; convert first-version single-effort items into one part. */
const normalizeItem = (raw) => {
  const base = pick(raw, ITEM_FIELDS);
  if (isLegacyItem(raw)) return { ...base, parts: [{ ...pick(raw, UNIT_PART_FIELDS), id: `${raw.id}-1` }] };
  return { ...base, parts: Array.isArray(raw?.parts) ? raw.parts.map(normalizePart) : [] };
};

const displayName = (text, index) => (typeof text === 'string' && text.trim() ? `"${text}"` : `#${index + 1}`);

const partProblem = (part) => {
  if (typeof part.id !== 'string' || part.id === '') return 'has a part with no id.';
  if (part.type !== TRACK_PART && !(part.type in EFFORT_PRESETS)) return 'has a part with an unknown effort type.';
  return null;
};

const itemProblem = (trackIds) => (item, index) => {
  const name = displayName(item.title, index);
  if (typeof item.id !== 'string' || item.id === '') return `Item ${name} has no id.`;
  if (typeof item.course !== 'string') return `Item ${name} has an invalid course.`;
  const partIssue = item.parts.map(partProblem).find(Boolean);
  if (partIssue) return `Item ${name} ${partIssue}`;
  if (new Set(item.parts.map((p) => p.id)).size !== item.parts.length) return `Item ${name} has duplicate part ids.`;
  const errors = validateItem(item, trackIds);
  return errors.length ? `Item ${name}: ${errors.join(' ')}` : null;
};

const trackProblem = (track, index) => {
  const name = displayName(track.name, index);
  if (typeof track.id !== 'string' || track.id === '') return `Lecture track ${name} has no id.`;
  const errors = validateTrack(track);
  return errors.length ? `Lecture track ${name}: ${errors.join(' ')}` : null;
};

const hasUniqueIds = (list) => new Set(list.map((x) => x.id)).size === list.length;

/** Parse and validate stored/imported JSON. Never throws. */
export const parseState = (json) => {
  if (json === null || json === undefined || json === '') return { ok: true, state: DEFAULT_STATE };
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'The data is not valid JSON.' };
  }
  const weeklyHours = raw?.weeklyHours;
  if (typeof weeklyHours !== 'number' || !Number.isFinite(weeklyHours) || weeklyHours <= 0 || weeklyHours > 168) {
    return { ok: false, error: 'Weekly hours must be between 0 and 168.' };
  }
  if (!Array.isArray(raw.items)) return { ok: false, error: 'The data has no item list.' };
  if (raw.tracks !== undefined && !Array.isArray(raw.tracks)) return { ok: false, error: 'The lecture track list is invalid.' };

  const tracks = (raw.tracks ?? []).map(normalizeTrack);
  const trackIssue = tracks.map(trackProblem).find(Boolean);
  if (trackIssue) return { ok: false, error: trackIssue };
  if (!hasUniqueIds(tracks)) return { ok: false, error: 'Two lecture tracks share the same id.' };

  const items = raw.items.map(normalizeItem);
  const itemIssue = items.map(itemProblem(tracks.map((t) => t.id))).find(Boolean);
  if (itemIssue) return { ok: false, error: itemIssue };
  if (!hasUniqueIds(items)) return { ok: false, error: 'Two deadlines share the same id.' };

  return { ok: true, state: { weeklyHours, items, tracks } };
};

export const serializeState = (state) =>
  JSON.stringify({ version: 4, weeklyHours: state.weeklyHours, items: state.items, tracks: state.tracks ?? [] }, null, 2);

export const loadState = (storage = globalThis.localStorage) => parseState(storage.getItem(STORAGE_KEY));

export const saveState = (state, storage = globalThis.localStorage) => {
  try {
    storage.setItem(STORAGE_KEY, serializeState(state));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Could not save: ${error.message}` };
  }
};
