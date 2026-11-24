// Calendar-date helpers on ISO "YYYY-MM-DD" strings, computed in UTC so DST never shifts a day.

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseIsoDate = (iso) => {
  const match = ISO_DATE.exec(String(iso));
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const check = new Date(ms);
  const valid = check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
  return valid ? ms : null;
};

const requireDate = (iso) => {
  const ms = parseIsoDate(iso);
  if (ms === null) throw new Error(`Invalid date: ${iso}`);
  return ms;
};

export const isValidIsoDate = (iso) => parseIsoDate(iso) !== null;

export const daysBetween = (fromIso, toIso) =>
  Math.round((requireDate(toIso) - requireDate(fromIso)) / MS_PER_DAY);

export const addDays = (iso, days) =>
  new Date(requireDate(iso) + days * MS_PER_DAY).toISOString().slice(0, 10);

/** 0 = Sunday … 6 = Saturday */
export const dayOfWeek = (iso) => new Date(requireDate(iso)).getUTCDay();
