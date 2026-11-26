// Text and per-row actions for the course detail sheet. Pure — dates stay ISO
// and are formatted by the view.

import { PILL_TEXT } from './home-model.js';
import { lectureProgress } from './progress-model.js';

const KIND_LABEL = Object.freeze({ exam: 'Exam', assignment: 'Assignment' });

export const kindLabel = (kind) => KIND_LABEL[kind];

/** "5 of 24 watched · 8 out", or "All 24 watched". */
export const lectureLine = ({ watched, total, released }) => (watched >= total
  ? `All ${total} watched`
  : `${watched} of ${total} watched · ${released} out`);

/** "1 of 5 chapters of prep", "Prep done", or null without prep. */
export const prepLine = (prep) => {
  if (!prep) return null;
  return prep.done >= prep.total ? 'Prep done' : `${prep.done} of ${prep.total} ${prep.unit} of prep`;
};

const lectureRow = (entry) => ({
  title: `Lecture ${entry.number}`,
  note: entry.extra ? 'Extra' : null,
  state: entry.state,
  action: entry.state === 'watched' ? null : { label: entry.extra ? 'Remove' : 'Cancel', op: 'cancel' },
});

const ROWS = Object.freeze({
  lecture: lectureRow,
  cancelled: () => ({ title: 'Cancelled lecture', note: null, state: 'cancelled', action: { label: 'Restore', op: 'add' } }),
  milestone: (entry) => ({ title: entry.title, note: KIND_LABEL[entry.kind], state: 'milestone', action: null }),
  today: () => ({ title: 'Today', note: null, state: 'today', action: null }),
});

/** Title, small note, visual state and optional action for one timeline entry. */
export const timelineRow = (entry) => ROWS[entry.type](entry);

/** Entries before the "today" marker (folded away by default) and the rest. */
export const splitTimeline = (entries) => {
  const at = entries.findIndex((e) => e.type === 'today');
  return at === -1 ? { earlier: [], upcoming: entries } : { earlier: entries.slice(0, at), upcoming: entries.slice(at) };
};

/** The colored header band: name, short status pill, full status and two-layer lecture progress. */
export const detailHeader = (planned) => ({
  name: planned.name,
  status: planned.status,
  pillText: PILL_TEXT[planned.status],
  statusText: planned.statusText,
  progress: lectureProgress(planned.lectures),
});
