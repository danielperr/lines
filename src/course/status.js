// One course's status. Every relevant signal is shown, not just the worst:
// lectures must be watched before exam prep, so when both are due the user
// sees both ("3 lectures behind · Midterm prep behind 2h").

export const SEVERITY = Object.freeze({ overdue: 4, behind: 3, tight: 2, ok: 1, done: 0 });
const SEPARATOR = ' · ';

const worse = (a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a);

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const PREP_TEXT = Object.freeze({
  ok: (p) => `${p.title} prep on track`,
  tight: (p) => `${p.title} prep is tight`,
  behind: (p) => `${p.title} prep behind ${p.hoursShort}h`,
  overdue: (p) => `${p.title} prep overdue`,
});

const lectureSignal = (lectures) => (lectures && lectures.behind > 0
  ? [{ kind: 'lectures', status: lectures.status, text: `${plural(lectures.behind, 'lecture')} behind` }]
  : []);

const prepSignal = (p) => ({ kind: 'prep', milestoneId: p.milestoneId, status: p.status, text: PREP_TEXT[p.status](p) });

/** Signals that count right now: lecture backlog, then prep whose window is open. */
export const courseSignals = (lectures, prep) => [
  ...lectureSignal(lectures),
  ...prep.filter((p) => p.inWindow).map(prepSignal),
];

const isFinished = (lectures, prep, hasUpcoming) =>
  (!lectures || lectures.status === 'done') && prep.length === 0 && !hasUpcoming;

/**
 * Overall tone (for colour and sorting) and the words that explain it.
 * `hasUpcoming`: the course still has a milestone ahead, so it is not done.
 */
export const courseStatus = (lectures, prep, signals, hasUpcoming = false) => {
  if (signals.length === 0) {
    const finished = isFinished(lectures, prep, hasUpcoming);
    return { status: finished ? 'done' : 'ok', statusText: finished ? 'All done' : 'On track' };
  }
  return {
    status: signals.map((s) => s.status).reduce(worse, 'ok'),
    statusText: signals.map((s) => s.text).join(SEPARATOR),
  };
};
