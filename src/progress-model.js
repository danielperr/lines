// Two-layer lecture progress: how far the course itself has gone (lectures
// out) and how far you are (lectures watched). The gap between them is your
// backlog. Pure — the view draws it.

const clamp01 = (n) => Math.min(1, Math.max(0, n));

const label = ({ total, released, watched }) => (watched >= total
  ? `All ${total} lectures watched`
  : `${watched} of ${total} lectures watched, ${released} out`);

const legend = ({ total, released, watched }) => (watched >= total
  ? { watched: `All ${total} watched`, out: null }
  : { watched: `${watched} watched`, out: `${released} of ${total} out` });

/** "4 of 10 watched · 7 out", or "All 10 watched": one line of text. */
export const lectureText = ({ total, released, watched }) => (watched >= total
  ? `All ${total} watched`
  : `${watched} of ${total} watched · ${released} out`);

/**
 * { out, watched } as fractions of all lectures, a spoken label and a short
 * legend for each layer; null without lectures.
 */
export const lectureProgress = (lectures) => {
  if (!lectures || !lectures.total) return null;
  const { total, released, watched } = lectures;
  return {
    out: clamp01(released / total),
    watched: clamp01(watched / total),
    label: label(lectures),
    legend: legend(lectures),
  };
};
