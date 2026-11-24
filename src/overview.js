// Per-course roll-up of deadlines and lecture tracks for the overview bars.

const OTHER_COURSE = 'Other';
const STATUS_WORD = { overdue: 'Overdue', behind: 'Behind', tight: 'Tight', ok: null, done: 'Done' };
const SEVERITY = { overdue: 4, behind: 3, tight: 2, ok: 1, done: 0 };

const sumBy = (list, fn) => list.reduce((sum, x) => sum + fn(x), 0);
const worse = (a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a);

/** One colour for a track: green when caught up, otherwise at least amber. */
export const trackTone = (track) => {
  if (track.status === 'done') return 'done';
  if (track.behind === 0) return 'ok';
  return track.status === 'ok' ? 'tight' : track.status;
};

const courseName = (raw) => (typeof raw === 'string' && raw.trim() ? raw.trim() : OTHER_COURSE);

// Lecture work is counted on the track itself, so only unit parts count here.
const unitHours = (item, field) => sumBy(
  item.effort.filter((e) => e.kind !== 'track'),
  (e) => e[field] * e.hoursPerUnit,
);

const itemEntry = (item) => ({
  name: courseName(item.course),
  totalHours: unitHours(item, 'total'),
  doneHours: unitHours(item, 'done'),
  lecturesBehind: 0,
  status: item.status ?? 'done',
  due: item.status ? item.due : null,
});

const trackEntry = (track) => ({
  name: courseName(track.name),
  totalHours: track.total * track.hoursPerLecture,
  doneHours: Math.min(track.watched, track.total) * track.hoursPerLecture,
  lecturesBehind: track.behind,
  status: trackTone(track),
  due: null,
});

const earlier = (a, b) => (a && b ? (a < b ? a : b) : a ?? b);

const mergeEntry = (row, entry) => ({
  name: row.name,
  totalHours: row.totalHours + entry.totalHours,
  doneHours: row.doneHours + entry.doneHours,
  lecturesBehind: row.lecturesBehind + entry.lecturesBehind,
  status: worse(row.status, entry.status),
  nextDue: earlier(row.nextDue, entry.due),
});

const emptyRow = (name) => ({ name, totalHours: 0, doneHours: 0, lecturesBehind: 0, status: 'done', nextDue: null });

const byUrgency = (a, b) => SEVERITY[b.status] - SEVERITY[a.status]
  || (a.nextDue ?? '9999').localeCompare(b.nextDue ?? '9999')
  || a.name.localeCompare(b.name);

/**
 * Groups a plan by course (deadline course or track name, case-insensitive)
 * into rows of { name, totalHours, doneHours, hoursLeft, lecturesBehind,
 * status, nextDue }, most urgent first.
 */
export const courseOverview = ({ active, done, tracks }) => {
  const entries = [...active, ...done].map(itemEntry).concat(tracks.map(trackEntry));
  const rows = entries.reduce((map, entry) => {
    const key = courseKey(entry.name);
    return new Map(map).set(key, mergeEntry(map.get(key) ?? emptyRow(entry.name), entry));
  }, new Map());
  return [...rows.values()]
    .map((row) => ({ ...row, hoursLeft: Math.max(0, row.totalHours - row.doneHours) }))
    .sort(byUrgency);
};

/** Words for a row's status, so it never depends on colour alone (null when on track). */
export const statusText = ({ status, lecturesBehind }) => (status === 'tight' && lecturesBehind > 0
  ? `${lecturesBehind} behind`
  : STATUS_WORD[status]);

/** Lower-cased course key, shared by overview rows and the cards they jump to. */
export const courseKey = (name) => courseName(name).toLocaleLowerCase();
